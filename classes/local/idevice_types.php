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
 * Human-readable, translated names for eXeLearning iDevice types.
 *
 * content.xml only stores the type slug (odeIdeviceTypeName, e.g. "trueorfalse"),
 * which is a code name, not something to show a teacher. Each gradable slug has an
 * `idevicetype:<slug>` string whose values are the names eXeLearning itself shows in
 * its editor (the iDevice config.xml title and its translations), so Moodle and the
 * editor call an iDevice the same thing. Unknown slugs (new or third-party iDevices)
 * fall back to the slug rather than failing.
 *
 * @package    mod_exelearning
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class idevice_types {
    /**
     * Returns the translated name of an iDevice type, or the slug when there is none.
     *
     * @param string $type The iDevice type slug from content.xml.
     * @param string|null $lang Language to translate into; null for the current language.
     * @return string The translated name (plain text, not escaped).
     */
    public static function label(string $type, ?string $lang = null): string {
        $type = trim($type);
        $key = 'idevicetype:' . $type;
        $manager = get_string_manager();
        if ($type === '' || !$manager->string_exists($key, 'mod_exelearning')) {
            return $type;
        }
        return $manager->get_string($key, 'mod_exelearning', null, $lang);
    }

    /**
     * Builds the "#1 True or false · #2 Guess" list shown to teachers on the activity
     * page, in the viewing user's language.
     *
     * @param \stdClass[] $items exelearning_grade_item rows (itemnumber, idevicetype).
     * @return string HTML-escaped summary, safe to echo.
     */
    public static function detected_items_summary(array $items): string {
        $labels = [];
        foreach ($items as $item) {
            $labels[] = '#' . (int) $item->itemnumber . ' ' . self::label((string) $item->idevicetype);
        }
        return s(implode(' · ', $labels));
    }
}
