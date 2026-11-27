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
 * Request handling of the content domain endpoint.
 *
 * @package    mod_exelearning
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_exelearning\local;

use context;
use moodle_exception;
use stdClass;
use stored_file;

/**
 * Decides what content.php answers. Kept apart from the script so it can be tested.
 *
 * Content hosts answer `<token>/player.html`, the two scripts of that page and
 * `<token>/<revision>/<file>`; anything else is a 404. A request is served only when
 * all of these hold:
 *
 * - the request host is `<label>.<content domain>`;
 * - the token was issued by this plugin and has not expired;
 * - the label is the one of the activity named in the token;
 * - the user named in the token may view that activity right now.
 *
 * The user comes from the token and never from a session: content.php runs without
 * cookies, so nothing on a content host can read or set the Moodle session.
 */
final class content_endpoint {
    /** Scripts of the player page, by the name they are served under. */
    private const PLAYER_SCRIPTS = [
        'scorm_tracker.js' => 'js/scorm_tracker.js',
        'content_player.js' => 'js/content_player.js',
    ];

    /**
     * Resolves a request for a content host.
     *
     * @param string $host Request host.
     * @param string $path Path after content.php, starting with a slash.
     * @param int|null $now Current time, for tests.
     * @return array Key status (int). A served response also has headers (array) and
     *         either body (string) or file (stored_file) with lifetime (int, seconds).
     */
    public static function resolve(string $host, string $path, ?int $now = null): array {
        global $CFG, $DB;

        $now = $now ?? time();
        $domain = content_domain::get();
        $label = $domain ? content_domain::host_label($host, $domain) : null;
        if ($label === null || !preg_match('~^/([^/]+)/(.+)$~s', $path, $match)) {
            return ['status' => 404];
        }
        $claims = content_domain::check_token($match[1], $now);
        if (!$claims) {
            return ['status' => 403];
        }
        if (!hash_equals(content_domain::label($claims['contextid']), $label)) {
            return ['status' => 404];
        }

        $context = context::instance_by_id($claims['contextid'], IGNORE_MISSING);
        $cm = ($context && $context->contextlevel == CONTEXT_MODULE)
            ? get_coursemodule_from_id('exelearning', $context->instanceid)
            : false;
        if (!$cm) {
            return ['status' => 404];
        }
        $course = get_course($cm->course);
        if (!self::can_view($claims['userid'], $course, $cm, $context)) {
            return ['status' => 403];
        }
        $exelearning = $DB->get_record('exelearning', ['id' => $cm->instance], '*', MUST_EXIST);

        $headers = content_domain::headers();
        $route = $match[2];
        if ($route === 'player.html') {
            return [
                'status' => 200,
                'headers' => $headers + ['Content-Type' => 'text/html; charset=utf-8', 'Cache-Control' => 'no-store'],
                'body' => self::player_page($exelearning, $context),
            ];
        }
        if (isset(self::PLAYER_SCRIPTS[$route])) {
            return [
                'status' => 200,
                'headers' => $headers + [
                    'Content-Type' => 'application/javascript; charset=utf-8',
                    'Cache-Control' => 'no-store',
                ],
                'body' => file_get_contents(__DIR__ . '/../../' . self::PLAYER_SCRIPTS[$route]),
            ];
        }
        $file = preg_match('~^(\d{1,10})/(.*)$~s', $route, $parts)
            ? self::package_file($context->id, (int) $parts[1], $parts[2])
            : null;
        if (!$file) {
            return ['status' => 404];
        }
        return [
            'status' => 200,
            'headers' => $headers,
            'file' => $file,
            // The browser may keep a file for as long as the URL it came from is valid.
            'lifetime' => min((int) ($CFG->filelifetime ?? DAYSECS), $claims['expires'] - $now),
        ];
    }

    /**
     * Whether a user may view the activity now: the checks of exelearning_pluginfile().
     *
     * @param int $userid User named in the token; 0 for a visitor who is not logged in.
     * @param stdClass $course Course record.
     * @param stdClass $cm Course module.
     * @param context $context Module context.
     * @return bool
     */
    private static function can_view(int $userid, stdClass $course, stdClass $cm, context $context): bool {
        global $DB;

        if ($userid > 0) {
            $user = $DB->get_record('user', ['id' => $userid, 'deleted' => 0, 'suspended' => 0]);
            if (!$user || $user->auth === 'nologin') {
                return false;
            }
            // The request has no session (NO_MOODLE_COOKIES): this sets the user for
            // this request only, as core does for tokenpluginfile.php.
            \core\session\manager::set_user($user);
        }
        try {
            require_course_login($course, true, $cm, false, true);
            require_capability('mod/exelearning:view', $context);
        } catch (moodle_exception $e) {
            return false;
        }
        return true;
    }

    /**
     * Finds a file of the extracted package, as exelearning_pluginfile() does.
     *
     * @param int $contextid Module context id.
     * @param int $revision Content revision.
     * @param string $relativepath Path inside the package.
     * @return stored_file|null
     */
    private static function package_file(int $contextid, int $revision, string $relativepath): ?stored_file {
        $fs = get_file_storage();
        $fullpath = rtrim("/{$contextid}/mod_exelearning/content/{$revision}/{$relativepath}", '/');
        foreach (['', '/index.html', '/index.htm', '/Default.htm'] as $candidate) {
            $file = $fs->get_file_by_hash(sha1($fullpath . $candidate));
            if ($file && !$file->is_directory()) {
                return $file;
            }
        }
        return null;
    }

    /**
     * The player page: the document that frames the package on the content origin.
     *
     * It takes the place the Moodle page has without a content domain. The package's
     * SCORM runtime looks for `API` in its parent window and the tracker reads the
     * package document, so both stay in one origin; only the saved scores cross to
     * Moodle (js/content_player.js).
     *
     * @param stdClass $exelearning Instance record.
     * @param context $context Module context.
     * @return string HTML.
     */
    private static function player_page(stdClass $exelearning, context $context): string {
        // Teacher-only content is revealed by the package's own URL parameter (see view.php).
        $entry = (int) $exelearning->revision . '/index.html'
            . (empty($exelearning->teachermodevisible) ? '' : '?exe-teacher=1');
        // Unescaped by format_string() and escaped once here: the title is also an attribute value.
        $title = s(format_string($exelearning->name, true, ['context' => $context, 'escape' => false]));
        $lang = s(str_replace('_', '-', current_language()));
        $apporigin = s(content_domain::app_origin());
        return <<<HTML
<!DOCTYPE html>
<html lang="{$lang}" data-app-origin="{$apporigin}" data-entry="{$entry}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{$title}</title>
<style>html,body{height:100%;margin:0}iframe{border:0;width:100%;height:100%;display:block}</style>
</head>
<body>
<iframe id="exelearningobject" title="{$title}" allow="fullscreen"></iframe>
<script src="scorm_tracker.js"></script>
<script src="content_player.js"></script>
</body>
</html>

HTML;
    }
}
