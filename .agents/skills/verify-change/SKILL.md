---
name: verify-change
description: Select and run appropriate validation for a mod_exelearning diff before pushing or reviewing changes.
---

# Verify a change

Inspect the complete diff against the PR base, including new files and local changes;
follow callers of affected code. Use `DEVELOPMENT.md`, `Makefile` and
`.github/workflows/ci.yml` for actual commands. Select checks by behavior as well as
paths: a `lib.php` edit may affect grades, packages or callbacks.

| Change | Validation |
|---|---|
| PHP | PHPUnit for affected behavior and `vendor/bin/phpcs --standard=moodle <files>`; PHPDoc when API/docblocks change |
| `js/scorm_tracker.js` or its tests | `make test-js`; PHP tracking tests if the contract changes |
| `amd/src/` | Moodle Grunt AMD limited to `mod/exelearning`; review and commit `amd/build/`; relevant Behat flow |
| `db/`, user data or fileareas | `moodle-upgrade`; `moodle-plugin-ci validate` and `savepoints`; affected install/upgrade and backup/privacy tests |
| `classes/external/` or `db/services.php` | `tests/external_test.php`, parameters/context/capabilities and return schema through `clean_returnvalue` |
| Strings, settings or cacheable metadata | PHPCS and DEVELOPMENT version policy; `make check-version` |
| Templates or visible behavior | Mustache/Grunt as defined in CI and relevant Behat scenarios; explain when PHPUnit covers the change without a UI flow |
| Packages/editor/release | Domain skill; packaging checks when distribution changes |
| Markdown/skills only | Frontmatter, local links, discovery and provenance; no editor rebuild or new application tests |
| Workflows | `actionlint <workflow>` and review of triggers, permissions and inputs |

Local PHPUnit: `make test ARGS=mod/exelearning/tests/track_test.php` (example;
select the appropriate file). Do not pass the entire directory. If the test
environment reports a version mismatch, reinitialize with
`docker compose exec moodle php /var/www/html/admin/tool/phpunit/cli/init.php`.
Do not initialize a production site to run tests.

Real fixtures live in `tests/fixtures/` and `research/fixtures/elpx/`; the generator
is `tests/generator/lib.php`. Behavior changes add meaningful regressions; do not
exclude testable code to improve coverage.

Report commands and results, failures or missing dependencies. Distinguish checks
that are not applicable from pending ones; an unexecuted suite is not a PASS. Local
selection does not remove CI jobs or the complete release readiness criteria.
