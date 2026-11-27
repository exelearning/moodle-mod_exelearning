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

/**
 * Optional content domain for package content.
 *
 * @package    mod_exelearning
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_exelearning\local;

use moodle_url;

/**
 * Names, labels and tokens of the content domain (admin setting `contentdomain`).
 *
 * A package is HTML and JavaScript written by its author. Served by pluginfile.php it
 * runs in the Moodle origin, with the viewer's session (docs/TRACKING.md, threats 8
 * and 10). When an administrator sets a content domain, each activity is served
 * instead from its own origin, `<scheme>://<label>.<content domain>`, on a different
 * site from Moodle. With the setting empty nothing here is used.
 *
 * Two values are derived from a secret that only this plugin holds:
 *
 * - the host label, from the module context and this site's origin, so a content
 *   host answers for one activity of one Moodle site and nobody can pick a label;
 * - the access token in the content URL, which names the user and the activity it
 *   was issued for. It replaces the session cookie, which a content host must never
 *   see, and is deliberately not a Moodle user key: the content can read its own
 *   URL, so the token must be worth nothing outside this activity.
 *
 * The same scheme as eXeLearning's `EXE_CONTENT_DOMAIN` (labels there start with `v`
 * or `p`; `m` lets a reverse proxy route both applications on one domain).
 */
final class content_domain {
    /** Host label of a content origin: `m` and 40 lowercase hexadecimal digits. */
    public const LABEL_PATTERN = '/^m[0-9a-f]{40}$/';

    /**
     * Sandbox tokens of the package frame, for the iframe attribute and the response CSP.
     *
     * On a content domain `allow-same-origin` keeps the content in its own origin,
     * which is not Moodle's. Never use these tokens for content on the Moodle host.
     * No `allow-top-navigation` and no `allow-modals`, as in view.php.
     */
    public const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-forms'
        . ' allow-popups-to-escape-sandbox allow-downloads';

    /** Leaves room for the label and its dot within the 253-byte limit of a DNS name. */
    private const MAX_HOST_LENGTH = 253 - 64;

    /**
     * Parses a `host[:port]` value.
     *
     * @param string $raw Setting value.
     * @return array|null Keys host (lowercase) and port (string or null); null when not valid.
     */
    public static function parse(string $raw): ?array {
        if (!preg_match('/^([^:\/\s]+)(?::(\d{1,5}))?$/', strtolower(trim($raw)), $match)) {
            return null;
        }
        $host = $match[1];
        $port = $match[2] ?? null;
        $labels = explode('.', $host);
        foreach ($labels as $label) {
            if (!preg_match('/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/', $label)) {
                return null;
            }
        }
        // A name whose last label is a number is an IP address, which has no subdomains.
        if (strlen($host) > self::MAX_HOST_LENGTH || ctype_digit(end($labels))) {
            return null;
        }
        if ($port !== null && ((int) $port < 1 || (int) $port > 65535)) {
            return null;
        }
        return ['host' => $host, 'port' => $port];
    }

    /**
     * How the Moodle host relates to a content domain host.
     *
     * @param string $apphost Host of $CFG->wwwroot.
     * @param string $contenthost Content domain host.
     * @return string same, app-under-content, content-under-app or unrelated.
     */
    public static function relation(string $apphost, string $contenthost): string {
        $apphost = strtolower($apphost);
        if ($apphost === $contenthost) {
            return 'same';
        }
        if (str_ends_with($apphost, '.' . $contenthost)) {
            return 'app-under-content';
        }
        if (str_ends_with($contenthost, '.' . $apphost)) {
            return 'content-under-app';
        }
        return 'unrelated';
    }

    /**
     * Explains why a setting value cannot be used, for the admin settings page.
     *
     * @param string $raw Setting value; empty turns the mode off and is valid.
     * @return string|null Translated error, or null when the value is acceptable.
     */
    public static function validation_error(string $raw): ?string {
        if (trim($raw) === '') {
            return null;
        }
        $domain = self::parse($raw);
        if (!$domain) {
            return get_string('contentdomaininvalid', 'mod_exelearning');
        }
        // On the Moodle host, or on a parent of it, the Moodle host would be a content host.
        if (in_array(self::relation(self::app_host(), $domain['host']), ['same', 'app-under-content'], true)) {
            return get_string('contentdomainapphost', 'mod_exelearning', self::app_host());
        }
        return null;
    }

    /**
     * Whether an administrator has set a content domain, valid or not.
     *
     * From the moment one is set, package content is never served from the Moodle
     * origin again: an unusable value shows an error instead of the content.
     *
     * @return bool
     */
    public static function configured(): bool {
        return trim((string) get_config('exelearning', 'contentdomain')) !== '';
    }

    /**
     * The content domain in use.
     *
     * @return array|null Keys host and port; null when the mode is off or the value is unusable.
     */
    public static function get(): ?array {
        $raw = (string) get_config('exelearning', 'contentdomain');
        return (trim($raw) !== '' && self::validation_error($raw) === null) ? self::parse($raw) : null;
    }

    /**
     * Whether the content domain is a subdomain of the Moodle host.
     *
     * That is a different origin but the same site: cookies set for the parent domain
     * reach the content and SameSite does not separate the two. It works, with less
     * isolation, so the settings page warns instead of refusing.
     *
     * @return bool
     */
    public static function same_site(): bool {
        $domain = self::get();
        return $domain !== null && self::relation(self::app_host(), $domain['host']) === 'content-under-app';
    }

    /**
     * Host of this Moodle site.
     *
     * @return string Lowercase host of $CFG->wwwroot.
     */
    private static function app_host(): string {
        global $CFG;
        return strtolower((string) parse_url($CFG->wwwroot, PHP_URL_HOST));
    }

    /**
     * Serialises an origin the way browsers do, without a default port.
     *
     * @param string $scheme http or https.
     * @param string $host Host name.
     * @param string|int|null $port Port, or null for the default one.
     * @return string Origin, comparable with `event.origin`.
     */
    private static function serialise_origin(string $scheme, string $host, $port): string {
        $default = ($scheme === 'https') ? 443 : 80;
        return $scheme . '://' . $host . (($port === null || (int) $port === $default) ? '' : ':' . (int) $port);
    }

    /**
     * Origin of this Moodle site: the only page that may frame the content.
     *
     * @return string
     */
    public static function app_origin(): string {
        global $CFG;
        $url = parse_url($CFG->wwwroot);
        return self::serialise_origin(strtolower($url['scheme']), self::app_host(), $url['port'] ?? null);
    }

    /**
     * The secret that labels and tokens are derived from, created on first use.
     *
     * @return string
     */
    private static function secret(): string {
        $secret = (string) get_config('exelearning', 'contentsecret');
        if ($secret === '') {
            $secret = bin2hex(random_bytes(32));
            set_config('contentsecret', $secret, 'exelearning');
        }
        return $secret;
    }

    /**
     * Host label of an activity.
     *
     * @param int $contextid Module context id.
     * @return string A label matching {@see self::LABEL_PATTERN}.
     */
    public static function label(int $contextid): string {
        $mac = hash_hmac('sha256', "activity\n{$contextid}\n" . self::app_origin(), self::secret());
        return 'm' . substr($mac, 0, 40);
    }

    /**
     * Origin that serves an activity. It uses the scheme of this Moodle site.
     *
     * @param array $domain Content domain, from {@see self::get()}.
     * @param int $contextid Module context id.
     * @return string
     */
    public static function origin(array $domain, int $contextid): string {
        global $CFG;
        $scheme = strtolower((string) parse_url($CFG->wwwroot, PHP_URL_SCHEME));
        return self::serialise_origin($scheme, self::label($contextid) . '.' . $domain['host'], $domain['port']);
    }

    /**
     * The label of a request host, when the host is a content host.
     *
     * @param string $host Request host, with or without a port.
     * @param array $domain Content domain, from {@see self::get()}.
     * @return string|null The label, or null when the host is not `<label>.<content domain>`.
     */
    public static function host_label(string $host, array $domain): ?string {
        $host = strtolower(preg_replace('/:\d+$/', '', trim($host)));
        $suffix = '.' . $domain['host'];
        if (!str_ends_with($host, $suffix)) {
            return null;
        }
        $label = substr($host, 0, -strlen($suffix));
        return preg_match(self::LABEL_PATTERN, $label) ? $label : null;
    }

    /**
     * Issues the access token that goes in a content URL.
     *
     * The expiry is rounded to the hour so that every view within the same hour gets
     * the same URL and the browser can reuse what it cached. The token lasts as long
     * as an idle Moodle session; what the user may see is checked again on every
     * request, so it never outlives an unenrolment.
     *
     * @param int $contextid Module context id.
     * @param int $userid User the content is served to; 0 for a visitor who is not logged in.
     * @param int|null $now Current time, for tests.
     * @return string
     */
    public static function token(int $contextid, int $userid, ?int $now = null): string {
        global $CFG;
        $lifetime = (int) ($CFG->sessiontimeout ?? 0) ?: 8 * HOURSECS;
        $expires = (intdiv($now ?? time(), HOURSECS) + 1) * HOURSECS + $lifetime;
        $claims = "{$contextid}-{$userid}-{$expires}";
        return $claims . '-' . hash_hmac('sha256', "token\n{$claims}", self::secret());
    }

    /**
     * Checks an access token.
     *
     * @param string $token Token from a content URL.
     * @param int|null $now Current time, for tests.
     * @return array|null Keys contextid, userid and expires; null when forged or expired.
     */
    public static function check_token(string $token, ?int $now = null): ?array {
        if (!preg_match('/^((\d{1,10})-(\d{1,10})-(\d{1,10}))-([0-9a-f]{64})$/', $token, $match)) {
            return null;
        }
        if (!hash_equals(hash_hmac('sha256', "token\n{$match[1]}", self::secret()), $match[5])) {
            return null;
        }
        if ((int) $match[4] <= ($now ?? time())) {
            return null;
        }
        return ['contextid' => (int) $match[2], 'userid' => (int) $match[3], 'expires' => (int) $match[4]];
    }

    /**
     * URL of the player page of an activity on its content origin.
     *
     * @param array $domain Content domain, from {@see self::get()}.
     * @param int $contextid Module context id.
     * @param int $userid User the content is served to.
     * @return string
     */
    public static function player_url(array $domain, int $contextid, int $userid): string {
        $path = (new moodle_url('/mod/exelearning/content.php'))->get_path(false);
        return self::origin($domain, $contextid) . $path . '/' . self::token($contextid, $userid) . '/player.html';
    }

    /**
     * Response headers of everything served on a content host.
     *
     * The sandbox is repeated here so that it also applies to a content URL opened
     * outside the iframe. The content may be framed by this Moodle site and by its own
     * origin (the player page frames the package). When Moodle itself may be embedded
     * anywhere ($CFG->allowframembedding), the list of ancestors is unknown and is not
     * restricted.
     *
     * @return array Header name => value.
     */
    public static function headers(): array {
        global $CFG;
        $csp = 'sandbox ' . self::SANDBOX;
        if (empty($CFG->allowframembedding)) {
            $csp .= "; frame-ancestors 'self' " . self::app_origin();
        }
        return [
            'Content-Security-Policy' => $csp,
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'X-Content-Type-Options' => 'nosniff',
        ];
    }
}
