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
 * Tests for the translated iDevice type names.
 *
 * @package    mod_exelearning
 * @category   test
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_exelearning\local\idevice_types
 */
final class idevice_types_test extends advanced_testcase {
    /**
     * A known slug resolves to the translated iDevice name, in the current language by
     * default or in an explicit one.
     */
    public function test_label_translates_known_types(): void {
        $this->install_spanish();
        $this->assertSame('True or false', idevice_types::label('trueorfalse'));
        $this->assertSame('Guess', idevice_types::label('guess'));
        $this->assertSame('Select', idevice_types::label('quick-questions-multiple-choice'));
        $this->assertSame('Verdadero o falso', idevice_types::label('trueorfalse', 'es'));
        $this->assertSame('Adivina', idevice_types::label('guess', 'es'));
    }

    /**
     * Every type in the gradable catalogue has a translated name, so no known
     * gradable iDevice is ever shown by its code name.
     */
    public function test_every_gradable_type_has_a_name(): void {
        foreach (package::GRADABLE_IDEVICE_TYPES as $type) {
            $this->assertTrue(
                get_string_manager()->string_exists('idevicetype:' . $type, 'mod_exelearning'),
                "Missing idevicetype:$type"
            );
        }
    }

    /**
     * A type without a translation (a new or third-party iDevice) keeps its slug
     * instead of failing, and blank input stays blank.
     */
    public function test_label_falls_back_to_the_slug(): void {
        $this->assertSame('my-custom-game', idevice_types::label('my-custom-game'));
        $this->assertSame('', idevice_types::label('  '));
    }

    /**
     * The teacher's "Gradable iDevices detected" summary lists each item as
     * "#n Name" with translated names, escaped exactly once.
     */
    public function test_detected_items_summary(): void {
        $items = [
            (object) ['itemnumber' => 1, 'idevicetype' => 'trueorfalse'],
            (object) ['itemnumber' => 2, 'idevicetype' => 'guess'],
            (object) ['itemnumber' => 3, 'idevicetype' => 'a&b'],
        ];
        $this->assertSame(
            '#1 True or false · #2 Guess · #3 a&amp;b',
            idevice_types::detected_items_summary($items)
        );
    }

    /**
     * The summary follows the viewing user's language (exelearning PR 163 review).
     */
    public function test_detected_items_summary_follows_user_language(): void {
        $this->install_spanish();
        $items = [
            (object) ['itemnumber' => 1, 'idevicetype' => 'trueorfalse'],
            (object) ['itemnumber' => 2, 'idevicetype' => 'guess'],
        ];
        force_current_language('es');
        try {
            $this->assertSame('#1 Verdadero o falso · #2 Adivina', idevice_types::detected_items_summary($items));
        } finally {
            force_current_language('');
        }
    }

    /**
     * Makes Spanish an installed language for this test, so the plugin's own
     * lang/es strings resolve (the PHPUnit dataroot ships with English only).
     */
    private function install_spanish(): void {
        global $CFG;
        $this->resetAfterTest();
        $folder = $CFG->dataroot . '/lang/es';
        check_dir_exists($folder);
        file_put_contents($folder . '/langconfig.php', "<?php\n\$string['thislanguage'] = 'Español';\n");
        get_string_manager()->reset_caches();
    }
}
