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
 * Unit tests for the strict path-containment helper used by the editor's static
 * and styles routers.
 *
 * @package    mod_exelearning
 * @category   test
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_exelearning\local\editor_paths
 */
final class editor_paths_test extends advanced_testcase {
    /**
     * The root itself is considered contained.
     */
    public function test_exact_root_is_within(): void {
        $root = '/var/www/static';
        $this->assertTrue(editor_paths::is_within($root, $root));
    }

    /**
     * A genuine child path is contained.
     */
    public function test_child_path_is_within(): void {
        $root = '/var/www/static';
        $this->assertTrue(editor_paths::is_within($root . '/app/main.js', $root));
        $this->assertTrue(editor_paths::is_within($root . '/index.html', $root));
    }

    /**
     * A sibling sharing the root as a string prefix (e.g. `/static-evil`) is NOT
     * contained: this is the loose-`strpos` bug the strict rule closes.
     */
    public function test_sibling_prefix_is_denied(): void {
        $root = '/var/www/static';
        $this->assertFalse(editor_paths::is_within($root . '-evil/secret', $root));
        $this->assertFalse(editor_paths::is_within($root . '-evil', $root));
        $this->assertFalse(editor_paths::is_within($root . 'extra', $root));
    }

    /**
     * A parent directory is not contained. (An unresolved `..` segment is the
     * caller's responsibility to canonicalise with realpath() before calling
     * is_within(); both editor routers do exactly that. is_within() is a pure
     * string-containment check over already-canonical paths.)
     */
    public function test_parent_is_denied(): void {
        $root = '/var/www/static';
        $this->assertFalse(editor_paths::is_within('/var/www', $root));
    }

    /**
     * A wholly unrelated path is not contained.
     */
    public function test_unrelated_path_is_denied(): void {
        $root = '/var/www/static';
        $this->assertFalse(editor_paths::is_within('/etc/passwd', $root));
        $this->assertFalse(editor_paths::is_within('', $root));
    }

    /**
     * The bundle's own entry page is recognised whatever its letter case, and only
     * at the top level: a nested index.html is an ordinary asset.
     */
    public function test_entry_page_is_recognised(): void {
        $root = '/var/www/static';
        $this->assertTrue(editor_paths::is_entry_page($root . '/index.html', $root));
        $this->assertTrue(editor_paths::is_entry_page($root . '/INDEX.HTML', $root));
    }

    /**
     * Everything the router must keep serving is not the entry page.
     */
    public function test_other_assets_are_not_the_entry_page(): void {
        $root = '/var/www/static';
        $this->assertFalse(editor_paths::is_entry_page($root . '/app/index.html', $root));
        $this->assertFalse(editor_paths::is_entry_page($root . '/viewer/index.html', $root));
        $this->assertFalse(editor_paths::is_entry_page($root . '/index.js', $root));
        $this->assertFalse(editor_paths::is_entry_page($root . '/index.html.map', $root));
        $this->assertFalse(editor_paths::is_entry_page($root . '/preview-sw.js', $root));
        $this->assertFalse(editor_paths::is_entry_page('/var/www/other/index.html', $root));
    }
}
