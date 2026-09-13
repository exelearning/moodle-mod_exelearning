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

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->dirroot . '/mod/exelearning/lib.php');

/**
 * Existing activities receive the bundled runtime without replacing learner data.
 *
 * @package    mod_exelearning
 * @category   test
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_exelearning\local\package_manager
 */
final class package_runtime_test extends advanced_testcase {
    /**
     * Creates an extracted activity, optionally simulating its previous runtime.
     *
     * @param bool $outdated Whether to replace the stored wrapper with old bytes.
     * @return array{0: \stdClass, 1: int} Activity and module context id.
     */
    private function create_activity(bool $outdated = true): array {
        $this->resetAfterTest();
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_exelearning');
        $instance = $generator->create_instance(['course' => $course->id]);
        $cm = get_coursemodule_from_instance('exelearning', $instance->id);
        $contextid = (int) \context_module::instance($cm->id)->id;
        if ($outdated) {
            $fs = get_file_storage();
            $file = $fs->get_file($contextid, 'mod_exelearning', 'content', $instance->revision, '/libs/', 'SCORM_API_wrapper.js');
            $record = [
                'contextid' => $contextid,
                'component' => 'mod_exelearning',
                'filearea' => 'content',
                'itemid' => $instance->revision,
                'filepath' => '/libs/',
                'filename' => 'SCORM_API_wrapper.js',
            ];
            $file->delete();
            $fs->create_file_from_string($record, '// Previous runtime.');
        }
        return [$instance, $contextid];
    }

    /**
     * A changed wrapper refreshes both files and bootstrap once, preserving grades and source.
     */
    public function test_refresh_rebuilds_revision_and_preserves_history(): void {
        global $CFG, $DB, $USER;
        [$instance, $contextid] = $this->create_activity();
        $staleviewer = clone $instance;
        $oldrevision = (int) $instance->revision;
        $sourcehash = package_manager::get_stored_package($contextid)->get_contenthash();
        attempts::record_item($instance->id, $USER->id, 1, 0, 75, 100, 'completed', 'existing');
        $history = $DB->get_records('exelearning_attempt', ['exelearningid' => $instance->id]);
        $itemfields = 'id, itemnumber, objectid, deleted';
        $items = $DB->get_records('exelearning_grade_item', ['exelearningid' => $instance->id], 'id', $itemfields);

        package_manager::refresh_runtime($contextid, $instance);

        $this->assertSame($oldrevision + 1, $instance->revision);
        $this->assertSame($instance->revision, (int) $DB->get_field('exelearning', 'revision', ['id' => $instance->id]));
        $fs = get_file_storage();
        foreach (['SCORM_API_wrapper.js', 'SCOFunctions.js'] as $name) {
            $file = $fs->get_file($contextid, 'mod_exelearning', 'content', $instance->revision, '/libs/', $name);
            $this->assertSame(sha1_file($CFG->dirroot . '/mod/exelearning/assets/scorm/' . $name), $file->get_contenthash());
        }
        $html = $fs->get_file($contextid, 'mod_exelearning', 'content', $instance->revision, '/', 'index.html')->get_content();
        $this->assertStringContainsString('ns.session.open({ ownsLifecycle: false })', $html);
        $this->assertFalse($fs->get_file($contextid, 'mod_exelearning', 'content', $oldrevision, '/', 'index.html'));
        $this->assertSame($sourcehash, package_manager::get_stored_package($contextid)->get_contenthash());
        $this->assertEquals($history, $DB->get_records('exelearning_attempt', ['exelearningid' => $instance->id]));
        $after = $DB->get_records('exelearning_grade_item', ['exelearningid' => $instance->id], 'id', $itemfields);
        $this->assertEquals($items, $after);
        $this->assertSame($instance->revision, (int) $DB->get_field('exelearning', 'gradesyncrev', ['id' => $instance->id]));

        // A request holding the old pointer must reuse the completed refresh.
        package_manager::refresh_runtime($contextid, $staleviewer);
        $this->assertSame($instance->revision, $staleviewer->revision);
        package_manager::refresh_runtime($contextid, $instance);
        $this->assertSame($oldrevision + 1, $instance->revision);
    }

    /**
     * A current extracted pair does not allocate or rewrite any revision.
     */
    public function test_current_pair_is_unchanged(): void {
        [$instance, $contextid] = $this->create_activity(false);
        $revision = (int) $instance->revision;
        $files = get_file_storage()->get_area_files($contextid, 'mod_exelearning', 'content', $revision, 'id', false);
        package_manager::refresh_runtime($contextid, $instance);
        $this->assertSame($revision, (int) $instance->revision);
        $this->assertSame(array_keys($files), array_keys(
            get_file_storage()->get_area_files($contextid, 'mod_exelearning', 'content', $revision, 'id', false)
        ));
    }

    /**
     * Programmatic uploads without extracted content keep the viewer's original self-heal path.
     */
    public function test_missing_content_keeps_revision_for_self_heal(): void {
        [$instance, $contextid] = $this->create_activity(false);
        $revision = (int) $instance->revision;
        get_file_storage()->delete_area_files($contextid, 'mod_exelearning', 'content');
        package_manager::refresh_runtime($contextid, $instance);
        $this->assertSame($revision, $instance->revision);
        $this->assertEmpty(get_file_storage()->get_area_files($contextid, 'mod_exelearning', 'content', false, 'id', false));
    }

    /**
     * An unavailable source leaves the existing extracted activity readable.
     */
    public function test_missing_source_keeps_existing_revision(): void {
        [$instance, $contextid] = $this->create_activity();
        $revision = (int) $instance->revision;
        get_file_storage()->delete_area_files($contextid, 'mod_exelearning', 'package');
        package_manager::refresh_runtime($contextid, $instance);
        $this->assertSame($revision, $instance->revision);
        $this->assertNotFalse(get_file_storage()->get_file($contextid, 'mod_exelearning', 'content', $revision, '/', 'index.html'));
    }

    /**
     * An active package writer blocks both a viewer refresh and a form save before either stages files.
     */
    public function test_form_save_and_refresh_wait_for_the_same_package_lock(): void {
        global $CFG, $DB;
        [$instance, $contextid] = $this->create_activity();
        // File locks are not reentrant, unlike some database-specific backends.
        $CFG->lock_factory = '\\core\\lock\\file_lock_factory';
        $lock = package_manager::get_package_lock((int) $instance->id);
        $this->assertNotNull($lock);
        $revision = (int) $instance->revision;
        $update = clone $instance;
        $update->instance = $instance->id;
        $update->coursemodule = get_coursemodule_from_instance('exelearning', $instance->id)->id;
        try {
            package_manager::refresh_runtime($contextid, $instance);
            $this->assertSame($revision, (int) $instance->revision);
            try {
                exelearning_update_instance($update);
                $this->fail('A form save must not stage a revision while a package writer holds the lock');
            } catch (\moodle_exception $e) {
                $this->assertSame('locktimeout', $e->errorcode);
            }
            $this->assertSame($revision, (int) $DB->get_field('exelearning', 'revision', ['id' => $instance->id]));
        } finally {
            $lock->release();
        }
        $this->assertTrue(exelearning_update_instance($update));
        $this->assertSame($revision + 1, (int) $DB->get_field('exelearning', 'revision', ['id' => $instance->id]));
    }

    /**
     * Failed extraction preserves the old pointer and content instead of breaking the viewer.
     */
    public function test_invalid_source_keeps_existing_revision(): void {
        global $CFG, $DB;
        [$instance, $contextid] = $this->create_activity();
        $CFG->lock_factory = '\\core\\lock\\file_lock_factory';
        $revision = (int) $instance->revision;
        $fs = get_file_storage();
        $oldhash = $fs->get_file($contextid, 'mod_exelearning', 'content', $revision, '/', 'index.html')->get_contenthash();
        $source = package_manager::get_stored_package($contextid);
        $record = [
            'contextid' => $contextid,
            'component' => 'mod_exelearning',
            'filearea' => 'package',
            'itemid' => $source->get_itemid(),
            'filepath' => '/',
            'filename' => $source->get_filename(),
        ];
        $source->delete();
        $stage = make_request_directory();
        file_put_contents($stage . '/content.xml', '<ode/>');
        get_file_packer('application/zip')->archive_to_pathname(
            ['content.xml' => $stage . '/content.xml'],
            $stage . '/broken.elpx'
        );
        $fs->create_file_from_pathname($record, $stage . '/broken.elpx');

        package_manager::refresh_runtime($contextid, $instance);

        $this->assertDebuggingCalled();
        $this->assertSame($revision, $instance->revision);
        $this->assertSame($revision, (int) $DB->get_field('exelearning', 'revision', ['id' => $instance->id]));
        $file = $fs->get_file($contextid, 'mod_exelearning', 'content', $revision, '/', 'index.html');
        $this->assertSame($oldhash, $file->get_contenthash());
        $this->assertEmpty($fs->get_area_files($contextid, 'mod_exelearning', 'content', $revision + 1, 'id', false));

        // The same failed extraction through the form must release its package lock.
        $update = clone $instance;
        $update->instance = $instance->id;
        $update->coursemodule = get_coursemodule_from_instance('exelearning', $instance->id)->id;
        $update->package = file_get_unused_draft_itemid();
        try {
            exelearning_update_instance($update);
            $this->fail('The form must reject a source without index.html');
        } catch (\moodle_exception $e) {
            $this->assertSame('migrateextractfailed', $e->errorcode);
        }
        $lock = package_manager::get_package_lock((int) $instance->id);
        $this->assertNotNull($lock, 'The failed form save must release its lock');
        $lock->release();
    }
}
