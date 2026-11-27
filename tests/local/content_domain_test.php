<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

namespace mod_exelearning\local;

use advanced_testcase;

/**
 * Tests for the content domain: setting values, host labels, tokens and headers.
 *
 * @package    mod_exelearning
 * @category   test
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_exelearning\local\content_domain
 * @covers     \mod_exelearning\admin\admin_setting_contentdomain
 */
final class content_domain_test extends advanced_testcase {
    /**
     * Setting values and what they parse to.
     *
     * @return array
     */
    public static function parse_provider(): array {
        return [
            'host' => ['exelearningusercontent.com', ['host' => 'exelearningusercontent.com', 'port' => null]],
            'host and port' => ['content.localhost:8080', ['host' => 'content.localhost', 'port' => '8080']],
            'trimmed and lowercased' => ["  Content.Example.ORG \n", ['host' => 'content.example.org', 'port' => null]],
            'scheme' => ['https://content.example.org', null],
            'path' => ['content.example.org/moodle', null],
            'wildcard' => ['*.content.example.org', null],
            'empty label' => ['content..example.org', null],
            'label starting with a hyphen' => ['-content.example.org', null],
            'IPv4 address' => ['192.168.1.10', null],
            'port out of range' => ['content.example.org:70000', null],
            'port zero' => ['content.example.org:0', null],
            'too long for a label in front' => [str_repeat('a.', 100) . 'org', null],
            'spaces inside' => ['content example.org', null],
            'empty' => ['', null],
        ];
    }

    /**
     * A value is accepted only as host[:port] of a DNS name.
     *
     * @dataProvider parse_provider
     * @param string $raw Setting value.
     * @param array|null $expected Parsed value.
     */
    public function test_parse(string $raw, ?array $expected): void {
        $this->assertSame($expected, content_domain::parse($raw));
    }

    /**
     * The relation tells a separate domain from the Moodle host, its parents and its subdomains.
     */
    public function test_relation(): void {
        $this->assertSame('same', content_domain::relation('Moodle.Example.org', 'moodle.example.org'));
        $this->assertSame('app-under-content', content_domain::relation('moodle.example.org', 'example.org'));
        $this->assertSame('content-under-app', content_domain::relation('moodle.example.org', 'c.moodle.example.org'));
        $this->assertSame('unrelated', content_domain::relation('moodle.example.org', 'content.example.org'));
        $this->assertSame('unrelated', content_domain::relation('moodle.example.org', 'notmoodle.example.org'));
    }

    /**
     * The settings page refuses a value that is not a domain, or that is the Moodle host or a parent of it.
     */
    public function test_validation_error(): void {
        global $CFG;
        $this->resetAfterTest();
        $CFG->wwwroot = 'https://moodle.example.org/lms';

        $this->assertNull(content_domain::validation_error(''));
        $this->assertNull(content_domain::validation_error('exelearningusercontent.com'));
        $this->assertNull(content_domain::validation_error('content.moodle.example.org'));
        $this->assertSame(
            get_string('contentdomaininvalid', 'mod_exelearning'),
            content_domain::validation_error('https://exelearningusercontent.com')
        );
        foreach (['moodle.example.org', 'MOODLE.example.org:8443', 'example.org', 'org'] as $value) {
            $this->assertSame(
                get_string('contentdomainapphost', 'mod_exelearning', 'moodle.example.org'),
                content_domain::validation_error($value),
                $value
            );
        }
    }

    /**
     * The admin setting applies the same validation.
     */
    public function test_admin_setting_validates(): void {
        global $CFG;
        require_once($CFG->libdir . '/adminlib.php');
        $this->resetAfterTest();
        $CFG->wwwroot = 'https://moodle.example.org';

        $setting = new \mod_exelearning\admin\admin_setting_contentdomain('exelearning/contentdomain', 'name', 'desc', '');
        $this->assertTrue($setting->validate(''));
        $this->assertTrue($setting->validate('exelearningusercontent.com'));
        $this->assertSame(get_string('contentdomaininvalid', 'mod_exelearning'), $setting->validate('not a domain'));
        $this->assertSame(
            get_string('contentdomainapphost', 'mod_exelearning', 'moodle.example.org'),
            $setting->validate('example.org')
        );
    }

    /**
     * The mode is off by default, and a stored value that cannot be used counts as set but gives no domain.
     */
    public function test_configured_and_get(): void {
        global $CFG;
        $this->resetAfterTest();
        $CFG->wwwroot = 'https://moodle.example.org';

        $this->assertFalse(content_domain::configured());
        $this->assertNull(content_domain::get());
        $this->assertFalse(content_domain::same_site());

        set_config('contentdomain', ' ExeLearningUserContent.com:8443 ', 'exelearning');
        $this->assertTrue(content_domain::configured());
        $this->assertSame(['host' => 'exelearningusercontent.com', 'port' => '8443'], content_domain::get());
        $this->assertFalse(content_domain::same_site());

        set_config('contentdomain', 'content.moodle.example.org', 'exelearning');
        $this->assertSame(['host' => 'content.moodle.example.org', 'port' => null], content_domain::get());
        $this->assertTrue(content_domain::same_site());

        foreach (['example.org', 'moodle.example.org', 'https://x.example'] as $unusable) {
            set_config('contentdomain', $unusable, 'exelearning');
            $this->assertTrue(content_domain::configured(), $unusable);
            $this->assertNull(content_domain::get(), $unusable);
        }
    }

    /**
     * The Moodle origin is serialised as browsers do: lowercase, no path, no default port.
     */
    public function test_app_origin(): void {
        global $CFG;
        $this->resetAfterTest();
        foreach (
            [
                'https://moodle.example.org/lms' => 'https://moodle.example.org',
                'HTTPS://Moodle.Example.org:443' => 'https://moodle.example.org',
                'http://moodle.localhost:8080' => 'http://moodle.localhost:8080',
                'http://moodle.example.org:80/a/b' => 'http://moodle.example.org',
                'https://moodle.example.org:8443' => 'https://moodle.example.org:8443',
            ] as $wwwroot => $origin
        ) {
            $CFG->wwwroot = $wwwroot;
            $this->assertSame($origin, content_domain::app_origin());
        }
    }

    /**
     * A label is one DNS label bound to the activity, the Moodle origin and the plugin secret.
     */
    public function test_label(): void {
        global $CFG;
        $this->resetAfterTest();
        $CFG->wwwroot = 'https://moodle.example.org';

        $label = content_domain::label(123);
        $this->assertMatchesRegularExpression(content_domain::LABEL_PATTERN, $label);
        $this->assertSame(41, strlen($label));
        $this->assertSame($label, content_domain::label(123));
        $this->assertNotSame($label, content_domain::label(124));
        $this->assertSame(64, strlen(get_config('exelearning', 'contentsecret')));

        $CFG->wwwroot = 'https://other.example.org';
        $this->assertNotSame($label, content_domain::label(123));

        $CFG->wwwroot = 'https://moodle.example.org';
        set_config('contentsecret', str_repeat('ab', 32), 'exelearning');
        $this->assertNotSame($label, content_domain::label(123));
    }

    /**
     * A content origin uses the scheme of the Moodle site and the port of the setting.
     */
    public function test_origin(): void {
        global $CFG;
        $this->resetAfterTest();

        $CFG->wwwroot = 'https://moodle.example.org';
        $label = content_domain::label(5);
        $this->assertSame(
            "https://{$label}.content.example",
            content_domain::origin(['host' => 'content.example', 'port' => null], 5)
        );
        $this->assertSame(
            "https://{$label}.content.example",
            content_domain::origin(['host' => 'content.example', 'port' => '443'], 5)
        );
        $this->assertSame(
            "https://{$label}.content.example:8443",
            content_domain::origin(['host' => 'content.example', 'port' => '8443'], 5)
        );

        $CFG->wwwroot = 'http://moodle.localhost:8080';
        $this->assertSame(
            'http://' . content_domain::label(5) . '.content.localhost:8080',
            content_domain::origin(['host' => 'content.localhost', 'port' => '8080'], 5)
        );
    }

    /**
     * Only `<label>.<content domain>` is a content host.
     */
    public function test_host_label(): void {
        $domain = ['host' => 'content.example', 'port' => null];
        $label = 'm' . str_repeat('0123456789', 4);

        $this->assertSame($label, content_domain::host_label("{$label}.content.example", $domain));
        $this->assertSame($label, content_domain::host_label(strtoupper($label) . '.Content.Example:8443', $domain));
        foreach (
            [
                'content.example',
                'moodle.example.org',
                "{$label}.content.example.org",
                "{$label}.other.example",
                "x.{$label}.content.example",
                "{$label}.x.content.example",
                'v' . substr($label, 1) . '.content.example',
                substr($label, 0, 40) . '.content.example',
                "{$label}content.example",
                '',
            ] as $host
        ) {
            $this->assertNull(content_domain::host_label($host, $domain), $host);
        }
    }

    /**
     * A token names the activity and the user it was issued for and cannot be altered.
     */
    public function test_token(): void {
        $this->resetAfterTest();
        $now = 1800000000;
        $token = content_domain::token(123, 45, $now);

        $claims = content_domain::check_token($token, $now);
        $this->assertSame(123, $claims['contextid']);
        $this->assertSame(45, $claims['userid']);
        $this->assertGreaterThan($now, $claims['expires']);
        $this->assertMatchesRegularExpression('/^[0-9a-f-]+$/', $token);

        [$contextid, $userid, $expires, $mac] = explode('-', $token);
        foreach (
            [
                'another activity' => "124-{$userid}-{$expires}-{$mac}",
                'another user' => "{$contextid}-46-{$expires}-{$mac}",
                'a later expiry' => "{$contextid}-{$userid}-" . ($expires + 1) . "-{$mac}",
                'another signature' => "{$contextid}-{$userid}-{$expires}-" . strrev($mac),
                'no signature' => "{$contextid}-{$userid}-{$expires}",
                'a label signature' => "{$contextid}-{$userid}-{$expires}-" . substr(content_domain::label(123), 1),
                'empty' => '',
            ] as $case => $forged
        ) {
            $this->assertNull(content_domain::check_token($forged, $now), $case);
        }

        $this->assertNotNull(content_domain::check_token($token, $claims['expires'] - 1));
        $this->assertNull(content_domain::check_token($token, $claims['expires']));

        set_config('contentsecret', str_repeat('cd', 32), 'exelearning');
        $this->assertNull(content_domain::check_token($token, $now));
    }

    /**
     * A token is the same for an hour, so cached files are reused, and lasts an idle session.
     */
    public function test_token_lifetime(): void {
        global $CFG;
        $this->resetAfterTest();
        $CFG->sessiontimeout = 2 * HOURSECS;
        $hour = 500000 * HOURSECS;

        $this->assertSame(content_domain::token(1, 2, $hour), content_domain::token(1, 2, $hour + HOURSECS - 1));
        $this->assertNotSame(content_domain::token(1, 2, $hour), content_domain::token(1, 2, $hour + HOURSECS));
        $this->assertSame($hour + 3 * HOURSECS, content_domain::check_token(content_domain::token(1, 2, $hour), $hour)['expires']);
        $this->assertSame(
            $hour + 3 * HOURSECS,
            content_domain::check_token(content_domain::token(1, 2, $hour + HOURSECS - 1), $hour)['expires']
        );

        unset($CFG->sessiontimeout);
        $this->assertSame($hour + 9 * HOURSECS, content_domain::check_token(content_domain::token(1, 2, $hour), $hour)['expires']);
    }

    /**
     * The player URL is on the activity's origin, below the path of the Moodle site.
     */
    public function test_player_url(): void {
        global $CFG;
        $this->resetAfterTest();
        $CFG->wwwroot = 'https://moodle.example.org/lms';
        $domain = ['host' => 'content.example', 'port' => null];

        $url = content_domain::player_url($domain, 77, 9);
        $prefix = 'https://' . content_domain::label(77) . '.content.example/lms/mod/exelearning/content.php/';
        $this->assertStringStartsWith($prefix, $url);
        $this->assertStringEndsWith('/player.html', $url);
        $token = substr($url, strlen($prefix), -strlen('/player.html'));
        $this->assertSame(77, content_domain::check_token($token)['contextid']);
        $this->assertSame(9, content_domain::check_token($token)['userid']);
    }

    /**
     * Every content response is sandboxed in its own origin and framed only by Moodle and itself.
     */
    public function test_headers(): void {
        global $CFG;
        $this->resetAfterTest();
        $CFG->wwwroot = 'https://moodle.example.org/lms';
        $CFG->allowframembedding = 0;

        $headers = content_domain::headers();
        $this->assertSame(
            'sandbox ' . content_domain::SANDBOX . "; frame-ancestors 'self' https://moodle.example.org",
            $headers['Content-Security-Policy']
        );
        $this->assertSame('nosniff', $headers['X-Content-Type-Options']);
        $this->assertSame('strict-origin-when-cross-origin', $headers['Referrer-Policy']);

        $tokens = explode(' ', content_domain::SANDBOX);
        $this->assertContains('allow-scripts', $tokens);
        $this->assertContains('allow-same-origin', $tokens);
        $this->assertNotContains('allow-top-navigation', $tokens);
        $this->assertNotContains('allow-top-navigation-by-user-activation', $tokens);
        $this->assertNotContains('allow-modals', $tokens);

        // A Moodle that may be embedded anywhere has ancestors this plugin cannot list.
        $CFG->allowframembedding = 1;
        $this->assertSame('sandbox ' . content_domain::SANDBOX, content_domain::headers()['Content-Security-Policy']);
    }
}
