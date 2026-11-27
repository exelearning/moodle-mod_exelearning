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
 * Serves package content on the content domain (admin setting `contentdomain`).
 *
 * `https://<label>.<content domain>/mod/exelearning/content.php/<token>/…`. The
 * request has no session and sets no cookie; who it is for comes from the token and
 * is decided in {@see \mod_exelearning\local\content_endpoint}. This script answers
 * only on a content host: on the Moodle host it is a 404, so package content can
 * never be served from the Moodle origin through it.
 *
 * @package    mod_exelearning
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// The user and the permission are checked in content_endpoint::resolve().
// phpcs:disable moodle.Files.RequireLogin.Missing

define('NO_MOODLE_COOKIES', true);
define('NO_DEBUG_DISPLAY', true);
define('ABORT_AFTER_CONFIG', true);

require(__DIR__ . '/../../config.php');

$host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
if (!preg_match('/^m[0-9a-f]{40}\./', $host)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    die('Not found');
}

// Moodle's setup redirects every request whose host is not the one in $CFG->wwwroot,
// unless the site runs behind a reverse proxy that changes the host. A content host is
// by design a different host, so this request, and only this one, is handled that way.
// The value is not stored; it is also set among the config.php values because setup
// restores those after loading the stored configuration. Nothing below builds a URL
// from the request host.
$CFG->reverseproxy = true;
$CFG->config_php_settings['reverseproxy'] = true;

define('ABORT_AFTER_CONFIG_CANCEL', true);
require($CFG->dirroot . '/lib/setup.php');
require_once($CFG->libdir . '/filelib.php');

$response = \mod_exelearning\local\content_endpoint::resolve($host, (string) get_file_argument());

if ($response['status'] !== 200) {
    http_response_code($response['status']);
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    die($response['status'] === 403 ? 'Forbidden' : 'Not found');
}

foreach ($response['headers'] as $name => $value) {
    header($name . ': ' . $value);
}
if (isset($response['body'])) {
    echo $response['body'];
    die;
}

// SVG icons of the package must render inline, as in exelearning_pluginfile().
send_stored_file($response['file'], $response['lifetime'], 0, false, [
    'dontforcesvgdownload' => true,
    'cacheability' => 'private',
]);
