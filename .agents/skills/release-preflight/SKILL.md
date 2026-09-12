---
name: release-preflight
description: Audit a mod_exelearning release candidate and ZIP without creating tags or publishing by default.
---

# Release preflight

Use `docs/RELEASE_CHECKLIST.md`, `DEVELOPMENT.md` (Packaging and Versioning),
`.github/workflows/release.yml` and actual scripts as sources; do not duplicate the
whole checklist here. Obtain the target version from the request or preparation PR;
ask only if it is undetermined. An audit does not authorize publishing.

- Review administrator-facing release notes with `changelog` and merged PRs; flag
  omissions without inventing versions or entries.
- Check real monotonic `version.php`, final release, `.editor-version` and Playground
  pin consistency; run `make check-version` and `make check-release-version RELEASE=X.Y.Z`.
- Require a valid editor bundle built from the matching tag. Changes to `.editor-version`
  on main trigger release publication; do not change it merely to test a workflow.
- Check `scripts/check-release-workflow.sh` and `scripts/check-package.sh` when auditing
  distribution. To verify the actual artifact, `make package RELEASE=X.Y.Z` requires
  valid release metadata and a built editor, not `dev` metadata.
- Inspect the ZIP: top-level `exelearning/`, editor and `thirdpartylibs.xml` present;
  `.agents/`, `.claude/`, research, development dependencies and tooling excluded by
  `.distignore`. Packaging does not change the committed version.
- Review the PHPUnit/Behat matrix, Vitest, linters and checklist backup/privacy/upgrade
  cases. Old or unexecuted results do not satisfy the candidate's release gate.

Report PASS/FAIL/PENDING with evidence and version/commit; declare release readiness
only when applicable criteria are met. Do not create tags, publish releases or merge
PRs without user authorization; honor authorization already provided in the session.
