---
name: moodle-upgrade
description: Change XMLDB, upgrade.php, versions or registered metadata in mod_exelearning and verify the data lifecycle.
---

# Upgrade mod_exelearning

Read `DEVELOPMENT.md` (Versioning and releases), `db/install.xml`, `db/upgrade.php`,
`version.php` and `scripts/check-version.sh`. Retain Moodle 4.5/PHP 8.1 compatibility.
Do not confuse `$plugin->requires` (compatibility) with `$plugin->version` (upgrade).

- For schema changes, keep fresh installation and upgrade results equivalent. Use
  XMLDB and existing stage conventions, with existence checks where they allow
  retrying a partial migration.
- Append stages; do not delete or rewrite historical ones. Each `$oldversion < N`
  guard ends with `upgrade_mod_savepoint(true, N, 'exelearning')` after successful work.
- Choose a real `YYYYMMDDXX` version above the published version and all guards and
  savepoints, following the local checker. Keep `release` as `dev` except during
  explicit release preparation; packaging validates and never rewrites `version.php`.
- Cacheable changes listed in DEVELOPMENT also require version detection: classes,
  JS, strings, settings, capabilities, services and tasks. Documentation/skills alone
  do not require a version bump.

When personal data, tables or fileareas change, trace them through
`classes/privacy/provider.php`, `backup/moodle2/`, activity deletion/reset and
`docs/PRIVACY_BACKUP_FILES.md`. Declaring metadata does not implement export/deletion.
Test all three deletion paths and grade recalculation; backup with/without `userinfo`,
user/category remapping and absence of retired data. `gradesyncrev` is deliberately
omitted to force a rescan after restore.

For services, registration in `db/services.php` does not replace `validate_parameters`,
`validate_context` and permissions inside `execute`. `save_track` shares ingestion
rather than introducing another grading engine.

Run `make check-version`, `moodle-plugin-ci validate`, `moodle-plugin-ci savepoints`,
install/upgrade checks and affected data tests (`backup_restore_test.php`,
`privacy/provider_test.php`, `external_test.php` as applicable). Reinitialize PHPUnit
when schema/version/capabilities change. Destructive changes require explicit scope,
a data strategy and a documented decision; preparing upgrade code does not authorize
running it on a live site.
