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

/**
 * Filesystem path-containment helper shared by the embedded editor's file routers.
 *
 * The static (`editor/static.php`) and styles (`editor/styles.php`) endpoints both
 * resolve a caller-supplied path with realpath() and must then confirm it stays
 * inside an allowed root before serving it. A loose `strpos($path, $root) === 0`
 * check is unsafe: a sibling directory whose name merely starts with the root —
 * e.g. `/var/www/static-evil` for the root `/var/www/static` — shares the prefix
 * and would pass. {@see self::is_within()} centralises the strict rule so both
 * routers behave identically and the rule is unit-testable.
 *
 * @package    mod_exelearning
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class editor_paths {
    /**
     * Returns whether $path is the root itself or a descendant of it.
     *
     * Strict containment: the path must equal $root exactly, or begin with
     * $root followed by a directory separator. This rejects sibling paths that
     * only share $root as a string prefix (e.g. `/root-evil` for `/root`). Both
     * arguments are expected to be already canonicalised (realpath()) by the
     * caller, so this performs no normalisation of its own.
     *
     * @param string $path The resolved path to test.
     * @param string $root The allowed root directory.
     * @return bool True when $path is contained within (or equal to) $root.
     */
    public static function is_within(string $path, string $root): bool {
        return $path === $root
            || strpos($path, $root . DIRECTORY_SEPARATOR) === 0;
    }

    /**
     * Returns whether a resolved bundle path is the editor's own entry page.
     *
     * `editor/static.php` exists to serve the bundle's assets to the page that
     * `editor/index.php` builds; the entry page itself is never requested through
     * it (the bootstrap inlines index.html, and the app-shell service worker that
     * would fetch it only registers in the standalone PWA). Served as a page under
     * a teacher's session, index.html boots a second, un-bridged editor whose own
     * `?url=` / `?import=` handling fetches and opens whatever package the link
     * names: attacker-chosen content rendered on the Moodle origin for a teacher
     * who merely follows a link. So the router refuses it.
     *
     * Both arguments are canonical paths from realpath(), as for is_within(). The
     * file name is compared ignoring case because a case-insensitive filesystem
     * resolves INDEX.HTML to the same file.
     *
     * @param string $path The resolved path to test.
     * @param string $root The bundle root directory.
     * @return bool True when $path is the bundle's top-level index.html.
     */
    public static function is_entry_page(string $path, string $root): bool {
        return dirname($path) === $root
            && strcasecmp(basename($path), 'index.html') === 0;
    }
}
