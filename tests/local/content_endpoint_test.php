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
use context_module;
use stdClass;

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->dirroot . '/mod/exelearning/lib.php');

/**
 * Tests for what a content host answers, and to whom.
 *
 * @package    mod_exelearning
 * @category   test
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_exelearning\local\content_endpoint
 * @covers     ::exelearning_pluginfile
 */
final class content_endpoint_test extends advanced_testcase {
    /** @var stdClass Course of the activity under test. */
    private stdClass $course;

    /** @var stdClass Instance record of the activity under test. */
    private stdClass $instance;

    /** @var stdClass Course module of the activity under test. */
    private stdClass $cm;

    /** @var context_module Context of the activity under test. */
    private context_module $context;

    /** @var stdClass A student enrolled in the course. */
    private stdClass $student;

    /**
     * An activity with an extracted package, an enrolled student and a content domain.
     */
    protected function setUp(): void {
        global $DB;
        parent::setUp();
        $this->resetAfterTest();
        $this->setAdminUser();
        $generator = $this->getDataGenerator();
        $this->course = $generator->create_course();
        $created = $generator->get_plugin_generator('mod_exelearning')->create_instance(['course' => $this->course->id]);
        $this->instance = $DB->get_record('exelearning', ['id' => $created->id], '*', MUST_EXIST);
        $this->cm = get_coursemodule_from_instance('exelearning', $this->instance->id);
        $this->context = context_module::instance($this->cm->id);
        $this->student = $generator->create_and_enrol($this->course, 'student');
        set_config('contentdomain', 'content.example', 'exelearning');
        // The request has no session: whoever is logged in elsewhere must not matter.
        $this->setUser(null);
    }

    /**
     * Resolves a request as content.php does.
     *
     * @param string $route Path after the token.
     * @param array $with Overrides: host, token, user (id) and now.
     * @return array The response description.
     */
    private function request(string $route, array $with = []): array {
        $host = $with['host'] ?? content_domain::label($this->context->id) . '.content.example';
        $token = $with['token'] ?? content_domain::token($this->context->id, $with['user'] ?? (int) $this->student->id);
        return content_endpoint::resolve($host, "/{$token}/{$route}", $with['now'] ?? null);
    }

    /**
     * The route of a file of the current package revision.
     *
     * @param string $path Path inside the package.
     * @return string
     */
    private function file(string $path): string {
        return (int) $this->instance->revision . '/' . $path;
    }

    /**
     * An enrolled user gets the package file, with the content headers and a private cache lifetime.
     */
    public function test_serves_a_package_file(): void {
        global $CFG;
        $CFG->filelifetime = DAYSECS;

        $response = $this->request($this->file('index.html'));

        $this->assertSame(200, $response['status']);
        $this->assertInstanceOf(\stored_file::class, $response['file']);
        $this->assertSame('index.html', $response['file']->get_filename());
        $this->assertSame((int) $this->context->id, (int) $response['file']->get_contextid());
        $this->assertSame(content_domain::headers(), $response['headers']);
        // Never cached beyond the token it was requested with.
        $this->assertGreaterThan(0, $response['lifetime']);
        $this->assertLessThanOrEqual(9 * HOURSECS, $response['lifetime']);

        $CFG->filelifetime = 60;
        $this->assertSame(60, $this->request($this->file('index.html'))['lifetime']);
    }

    /**
     * Files in folders are served, and a folder answers with its index page.
     */
    public function test_serves_nested_files_and_folder_indexes(): void {
        $script = $this->request($this->file('libs/SCORM_API_wrapper.js'));
        $this->assertSame(200, $script['status']);
        $this->assertSame('/libs/', $script['file']->get_filepath());

        $this->assertSame('index.html', $this->request($this->file(''))['file']->get_filename());
    }

    /**
     * The player page frames the current revision and names the Moodle origin it reports to.
     */
    public function test_serves_the_player_page(): void {
        global $DB;
        $DB->set_field('exelearning', 'name', 'Sound & "vision" <b>bold</b>', ['id' => $this->instance->id]);

        $response = $this->request('player.html');

        $this->assertSame(200, $response['status']);
        $this->assertSame('text/html; charset=utf-8', $response['headers']['Content-Type']);
        $this->assertSame('no-store', $response['headers']['Cache-Control']);
        $this->assertSame(content_domain::headers()['Content-Security-Policy'], $response['headers']['Content-Security-Policy']);
        $body = $response['body'];
        $this->assertStringContainsString('data-app-origin="https://www.example.com"', $body);
        $this->assertStringContainsString('data-entry="' . (int) $this->instance->revision . '/index.html"', $body);
        $this->assertStringContainsString('<title>Sound &amp; &quot;vision&quot; bold</title>', $body);
        $this->assertStringContainsString(
            '<iframe id="exelearningobject" title="Sound &amp; &quot;vision&quot; bold" allow="fullscreen">',
            $body
        );
        // The tracker must be there before the script that uses it.
        $this->assertLessThan(strpos($body, 'src="content_player.js"'), strpos($body, 'src="scorm_tracker.js"'));

        $DB->set_field('exelearning', 'teachermodevisible', 1, ['id' => $this->instance->id]);
        $this->assertStringContainsString(
            'data-entry="' . (int) $this->instance->revision . '/index.html?exe-teacher=1"',
            $this->request('player.html')['body']
        );
    }

    /**
     * The two scripts of the player page are the plugin's own files.
     */
    public function test_serves_the_player_scripts(): void {
        global $CFG;
        foreach (['scorm_tracker.js', 'content_player.js'] as $name) {
            $response = $this->request($name);
            $this->assertSame(200, $response['status']);
            $this->assertSame('application/javascript; charset=utf-8', $response['headers']['Content-Type']);
            $this->assertSame('nosniff', $response['headers']['X-Content-Type-Options']);
            $this->assertSame(file_get_contents($CFG->dirroot . '/mod/exelearning/js/' . $name), $response['body']);
        }
    }

    /**
     * Routes that are not content are not found, including other plugin files.
     */
    public function test_unknown_routes_are_not_found(): void {
        foreach (
            [
                'other.html',
                'content_relay.js',
                '../../config.php',
                'version.php',
                $this->file('missing.html'),
                ((int) $this->instance->revision + 1) . '/index.html',
                'player.html/extra',
            ] as $route
        ) {
            $this->assertSame(['status' => 404], $this->request($route), $route);
        }
        $token = content_domain::token($this->context->id, (int) $this->student->id);
        $host = content_domain::label($this->context->id) . '.content.example';
        foreach (['', '/', "/{$token}", "/{$token}/", '/player.html'] as $path) {
            $this->assertSame(404, content_endpoint::resolve($host, $path)['status'], $path);
        }
    }

    /**
     * Nothing is served unless the host is the content host of the activity in the token.
     */
    public function test_requires_the_content_host_of_the_activity(): void {
        $other = $this->getDataGenerator()->get_plugin_generator('mod_exelearning')
            ->create_instance(['course' => $this->course->id]);
        $othercontext = context_module::instance($other->cmid);
        $this->setUser(null);

        foreach (
            [
                'the Moodle host' => 'www.example.com',
                'the bare content domain' => 'content.example',
                'another activity' => content_domain::label($othercontext->id) . '.content.example',
                'another content domain' => content_domain::label($this->context->id) . '.other.example',
                'not a label' => 'www.content.example',
            ] as $case => $host
        ) {
            $this->assertSame(['status' => 404], $this->request($this->file('index.html'), ['host' => $host]), $case);
        }

        // A token of one activity opens nothing on the origin of another.
        $token = content_domain::token($othercontext->id, (int) $this->student->id);
        $this->assertSame(['status' => 404], $this->request('player.html', ['token' => $token]));
    }

    /**
     * With the setting empty, or unusable, content hosts answer nothing.
     */
    public function test_requires_the_mode_to_be_on(): void {
        $host = content_domain::label($this->context->id) . '.content.example';
        foreach (['', 'www.example.com', 'example.com'] as $value) {
            set_config('contentdomain', $value, 'exelearning');
            $this->assertSame(['status' => 404], $this->request('player.html', ['host' => $host]), $value);
        }
    }

    /**
     * A forged or expired token is refused.
     */
    public function test_requires_a_valid_token(): void {
        $token = content_domain::token($this->context->id, (int) $this->student->id);

        $this->assertSame(['status' => 403], $this->request('player.html', ['token' => 'x']));
        $this->assertSame(['status' => 403], $this->request('player.html', ['token' => strrev($token)]));
        $this->assertSame(['status' => 403], $this->request('player.html', ['token' => sesskey()]));
        $this->assertSame(['status' => 403], $this->request('player.html', ['now' => time() + 2 * DAYSECS]));

        $admin = get_admin();
        $forged = preg_replace('/^(\d+)-\d+-/', '${1}-' . $admin->id . '-', $token);
        $this->assertSame(['status' => 403], $this->request('player.html', ['token' => $forged]));
    }

    /**
     * The user named in the token must be able to view the activity at the time of the request.
     */
    public function test_requires_permission_now(): void {
        global $DB;
        $generator = $this->getDataGenerator();
        $route = $this->file('index.html');

        $outsider = $generator->create_user();
        $this->assertSame(['status' => 403], $this->request($route, ['user' => (int) $outsider->id]));
        $this->assertSame(['status' => 403], $this->request($route, ['user' => 0]));
        $this->assertSame(['status' => 403], $this->request($route, ['user' => 99999999]));

        // The student holds a valid token and then loses access in several ways.
        $token = content_domain::token($this->context->id, (int) $this->student->id);
        $this->assertSame(200, $this->request($route, ['token' => $token])['status']);

        $DB->set_field('user', 'suspended', 1, ['id' => $this->student->id]);
        $this->assertSame(['status' => 403], $this->request($route, ['token' => $token]));
        $DB->set_field('user', 'suspended', 0, ['id' => $this->student->id]);

        set_coursemodule_visible($this->cm->id, 0);
        $this->assertSame(['status' => 403], $this->request($route, ['token' => $token]));
        set_coursemodule_visible($this->cm->id, 1);
        $this->assertSame(200, $this->request($route, ['token' => $token])['status']);

        $studentrole = $DB->get_field('role', 'id', ['shortname' => 'student'], MUST_EXIST);
        assign_capability('mod/exelearning:view', CAP_PROHIBIT, $studentrole, $this->context->id, true);
        $this->assertSame(['status' => 403], $this->request($route, ['token' => $token]));
        unassign_capability('mod/exelearning:view', $studentrole, $this->context->id);

        $enrol = enrol_get_plugin('manual');
        $manual = $DB->get_record('enrol', ['courseid' => $this->course->id, 'enrol' => 'manual'], '*', MUST_EXIST);
        $enrol->unenrol_user($manual, $this->student->id);
        $this->assertSame(['status' => 403], $this->request($route, ['token' => $token]));
    }

    /**
     * A guest is served when the course admits guests, but not when that needs a password:
     * the password a guest typed lives in the Moodle session, which a content host never sees.
     */
    public function test_guest_access(): void {
        global $DB;
        $guest = guest_user();
        $route = $this->file('index.html');
        $instance = $DB->get_record('enrol', ['courseid' => $this->course->id, 'enrol' => 'guest'], '*', MUST_EXIST);

        $DB->set_field('enrol', 'status', ENROL_INSTANCE_DISABLED, ['id' => $instance->id]);
        $this->assertSame(['status' => 403], $this->request($route, ['user' => (int) $guest->id]));

        $DB->set_field('enrol', 'status', ENROL_INSTANCE_ENABLED, ['id' => $instance->id]);
        $DB->set_field('enrol', 'password', '', ['id' => $instance->id]);
        $this->assertSame(200, $this->request($route, ['user' => (int) $guest->id])['status']);

        $DB->set_field('enrol', 'password', 'secret', ['id' => $instance->id]);
        $this->assertSame(['status' => 403], $this->request($route, ['user' => (int) $guest->id]));
    }

    /**
     * The user is the one in the token, never the one of an existing session.
     */
    public function test_ignores_the_logged_in_user(): void {
        $outsider = $this->getDataGenerator()->create_user();
        $this->setAdminUser();

        $this->assertSame(['status' => 403], $this->request($this->file('index.html'), ['user' => (int) $outsider->id]));
    }

    /**
     * With a content domain, pluginfile.php no longer serves the package from the Moodle origin.
     */
    public function test_pluginfile_does_not_serve_content(): void {
        $this->setUser($this->student);
        $args = [(int) $this->instance->revision, 'index.html'];

        $this->assertFalse(exelearning_pluginfile($this->course, $this->cm, $this->context, 'content', $args, false));

        // Also when the value cannot be used: no fallback to the Moodle origin.
        set_config('contentdomain', 'example.com', 'exelearning');
        $this->assertFalse(exelearning_pluginfile($this->course, $this->cm, $this->context, 'content', $args, false));
    }
}
