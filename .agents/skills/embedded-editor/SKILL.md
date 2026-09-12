---
name: embedded-editor
description: Change mod_exelearning embedded editor integration, bootstrap, saving or distribution.
---

# Embedded editor

Entry points: `editor/index.php`, `editor/static.php`, `editor/save.php`, `editor/styles.php`.
Resolution lives in `classes/local/embedded_editor_source_resolver.php` and `editor_paths.php`.
Read resolver, path and style tests before changing contracts.

The editor ships prebuilt in `dist/static/` (DEC-106-01); a running Moodle site does
not install or update it. Respect the global editor switch (player-only mode,
DEC-108-01); do not restore the runtime installer or Online/HMAC integration.

Saving requires login, sesskey, context and permission to manage the activity,
plus an enabled editor. Export uses `package_manager` revision activation before
synchronizing iDevices/gradebook: a corrupt save must not replace valid content.
Test changes at these boundaries with extraction and grading checks, not just an
HTTP response assertion.

Plugin AMD UI is rebuilt with Moodle Grunt. Changing its bootstrap does not require
a full upstream editor build. Use `make build-editor` when the task needs the bundle;
for releases use the workflow's reference/tag consistently with `.editor-version`,
never substitute `main`. Do not hand-edit `dist/static/` or commit it for documentation work.

Verify teacher/student access boundaries, player behavior when the editor is disabled,
and reopening saved content. Consult `release-preflight` when packaging changes.
