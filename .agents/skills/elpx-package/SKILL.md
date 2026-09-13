---
name: elpx-package
description: Change content.xml parsing, extraction, replacement or serving of ELPX packages in the Moodle plugin.
---

# ELPX packages

Read `docs/ELPX_PACKAGE.md`; check `classes/local/package.php`, `package_manager.php`,
`zip_utils.php`, `mod_form.php` and callers in `lib.php` and `editor/save.php`.
A valid archive is a v4 ZIP with root `content.xml`, whether named `.elpx` or `.zip`.

- Use Moodle's packer/File API and existing path checks. Validate actual contents,
  not extension/MIME hints. Do not introduce another extractor.
- Store and validate the new revision before activating its pointer and pruning the
  previous one. Failure removes only newly staged data; preserve the previous package,
  content, revision and grades. Reuse `store_and_activate_revision()` where applicable.
- DOM traversal by `local-name()` preserves namespaces, CDATA and ordering; retain
  controlled malformed-XML fallback and real-export fixtures.
- Accept `DOCTYPE ... SYSTEM "content.dtd"` without resolving it: `LIBXML_NONET`,
  no `LIBXML_DTDLOAD` or `LIBXML_NOENT`; retain internal-entity defenses. Do not reject
  all DOCTYPE declarations or enable expansion to make a fixture work.
- Detect using `isScorm > 0`, encrypted DataGame and the GeoGebra marker as implemented
  by the parser, not the historical type list. Preserve objectid and semantic hashing
  that ignores volatile export metadata.
- Serve through the callback/File API with the area's context and access checks;
  never expose dataroot paths. Consult the SCORM contract before changing injection
  or sandbox behavior.

Select tests from `package_test.php`, `package_legacy_test.php`, `zip_utils_test.php`,
`lib_extract_test.php`, `local/package_manager*_test.php`, plus grade regressions
when detection/sync changes. Include failed replacement preserving previous state.
