---
name: behat-test
description: Create or debug teacher, student and administrator Behat scenarios in mod_exelearning.
---

# Plugin Behat tests

Read the nearest scenario under `tests/behat/` and existing steps in
`tests/behat/behat_mod_exelearning.php`. Use `@mod_exelearning`; add `@javascript`
when the flow requires browser/JS behavior. Reuse course, user and enrolment generators
and `tests/generator/lib.php` with real fixtures.

The `the following eXeLearning SCORM scores exist` step seeds grades through actual
ingestion for deterministic report tests; it does not prove the JS bridge worked.
If the bridge changes, also exercise the `exelearningobject` iframe and tracker with
the appropriate user/permissions. Return to the parent frame when required.

Wait for observable state or Moodle pending work; do not hide races with sleeps.
Look for core steps before adding custom ones. Custom entity registration belongs
in a `behat_*_generator` class under `tests/generator/`, not an isolated
`get_creatable_entities` method in the step context.

Run against a test Moodle site with Selenium and initialized Behat configuration:
`vendor/bin/behat --tags @mod_exelearning` (or the affected feature/scenario and config).
CI uses `moodle-plugin-ci behat --profile chrome`; consult `DEVELOPMENT.md`.
Regenerate configuration through `admin/tool/behat/cli/init.php` after step/feature changes.
Do not claim that a seeded fixture validates a real browser interaction.
