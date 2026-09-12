# mod_exelearning

Moodle activity module for eXeLearning v4 packages (`.elpx` or `.zip` containing
`content.xml`). Compatibility is defined by `version.php` and the matrix in
`.github/workflows/ci.yml` (Moodle 4.5–5.2, minimum PHP 8.1). Do not raise the minimum
supported version to follow an external example.

## Orientation

- `lib.php` exposes callbacks; implementation lives in `classes/local/` and `classes/grades/`.
- `view.php` + `js/scorm_tracker.js` → `track.php` → `classes/local/track.php` →
  attempts, gradebook and completion. The mobile API shares `track::ingest()`.
- `classes/local/package.php` interprets manifests; `package_manager.php` manages
  revisions and extraction; `editor/` integrates the prebuilt editor in `dist/static/`.
- Code and tests define current behavior. Consult [ARCHITECTURE](docs/ARCHITECTURE.md)
  and the relevant domain documents; historical ADRs may describe superseded paths.
  Do not load all of `research/` at the start of a task.

## Project rules

- SCORM 1.2 is the only browser tracking channel (DEC-122-01). Do not restore xAPI,
  LRS, cmi5 or eXeLearning Online without an explicit scope change.
- Preserve the native sidebar, preview/grading separation and activity permissions.
  The same-origin sandbox has accepted risks and real bridge dependencies; consult
  [TRACKING](docs/TRACKING.md) before changing iframe permissions.
- Only ODE 2.0 v4; no legacy `.elp` or `iteexe_online`. Do not vendor external
  repositories into plugin code. Authorized skills under `.agents/` are development
  tooling excluded from the ZIP, not production dependencies.
- Behavior changes include regression tests for the relevant happy path and edge
  cases: PHPUnit for PHP, Vitest for the tracker. Use `verify-change` to select checks;
  documentation alone does not require new application tests.
- Write code, comments, agent instructions, skills and PRs in English. Documentation
  under `docs/` may remain Spanish. Preserve historical research records in their
  original language. Use translated UI strings, with keys in `lang/en/exelearning.php`
  in strict alphabetical order; no runtime loops generating strings.
  ATE stands for Área de Tecnología Educativa.
- PHPCS: `vendor/bin/phpcs --standard=moodle <files>` must report 0/0; do not use the
  local ruleset to hide errors. Include complete PHPDoc; explain nontrivial decisions
  alongside code and cite the relevant DEC/FTE.
- Rebuild `amd/build/` using Moodle Grunt after editing `amd/src/`; never edit generated
  AMD by hand. `js/scorm_tracker.js` keeps `window.API` synchronous and uses Vitest, not Jest.
- `version.php` carries a real, monotonic version; `release = 'dev'` during development.
  Follow [DEVELOPMENT](DEVELOPMENT.md#versioning-and-releases) when Moodle must detect
  code or metadata changes. No sentinels and no version bump for documentation alone.
- Branch names are English with `feature/` or `hotfix/`. User instructions about
  publication and merging persist throughout the task; a skill cannot expand authorization.

## Skills by task

Read only relevant skills. Local skills hold project invariants; external skills
provide general examples and do not override code or official documentation.

| Skill under `.agents/skills/` | When to use |
|---|---|
| [verify-change](.agents/skills/verify-change/SKILL.md) | Select and run checks for the diff |
| [moodle-upgrade](.agents/skills/moodle-upgrade/SKILL.md) | XMLDB, savepoints, versions and data lifecycle |
| [gradebook-tracking](.agents/skills/gradebook-tracking/SKILL.md) | Grades, attempts, completion, tracking endpoints and services |
| [elpx-package](.agents/skills/elpx-package/SKILL.md) | Package parsing, extraction, replacement and serving |
| [embedded-editor](.agents/skills/embedded-editor/SKILL.md) | Editor bootstrap, saving and distribution |
| [behat-test](.agents/skills/behat-test/SKILL.md) | Moodle scenarios and visible workflows |
| [release-preflight](.agents/skills/release-preflight/SKILL.md) | Audit release readiness without publishing |
| [changelog](.agents/skills/changelog/SKILL.md) | Draft changelog entries from merged PRs |
| [moodle-phpunit-testing](.agents/skills/moodle-phpunit-testing/SKILL.md) | PHPUnit patterns, using this project's harness |
| [moodle-amd-javascript](.agents/skills/moodle-amd-javascript/SKILL.md) | Moodle AMD, not the tracker or upstream editor |
| [github-actions-hardening](.agents/skills/github-actions-hardening/SKILL.md) | Author or review workflows and permissions |

Before using external examples, read the compatibility limits in
[external-skills](.agents/references/external-skills.md). Keep skills installed with
`gh skills` unchanged; local corrections live outside them so updates cannot erase
them. `.claude/skills/` links to the same canonical copy; `CLAUDE.md` points here.

`update-agent-skills.yml` proposes updates on Mondays or manual dispatch. Review
prompt changes, provenance and licenses; do not auto-merge. PRs created with
`GITHUB_TOKEN` do not trigger CI automatically. Maintainer preference: action version
tags, never SHA pins; checkout `v7`, create-pull-request `v8`, and update-agent-skills
`v13.3.3` until upstream publishes the floating `v13` tag.

## Documentation and commands

[DEVELOPMENT](DEVELOPMENT.md) documents commands; Makefile and CI resolve discrepancies.
`make test ARGS=mod/exelearning/tests/track_test.php`, `make test-js`, `make check-version`.
Do not point PHPUnit at the entire plugin directory: its `vendor/` can cause collisions.

For architecture decisions, read [research/AGENTS.md](research/AGENTS.md) and the
[decision guide](research/decisiones/README.md). IDs use the issue/PR number, not a global
counter; do not rewrite historical ADRs. Regenerate indexes when records change.
For APIs, consult Context7 and official documentation for the supported version.

Update this guide when architecture, commands or the skill catalog change. Session
history and status snapshots already live in Git and `research/`; do not duplicate them here.
