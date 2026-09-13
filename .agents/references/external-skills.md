# External skills: selection and local limits

Reviewed 2026-09-12. Community skills are not official Moodle documentation.
Check version-specific examples against [Moodle developer resources](https://moodledev.io/)
and the supported branch before applying them. Keep upstream copies unchanged;
these local limits take precedence and survive `gh skills update`.

## Installed

- `SaadRahman01/claude-moodle-dev` — `moodle-phpunit-testing` and
  `moodle-amd-javascript`, installed with `gh skills` from release `v0.5.0`
  (`d49ea896f622f7edd269675f42a74158b097be7d`), MIT. Bodies were compared with the
  reviewed default-branch commit `18bf1180d236889d686ff683e37333c9544b662d`.
- `github/awesome-copilot` — `github-actions-hardening`, MIT. Exact source path,
  ref and tree identity are recorded in each installed SKILL.md frontmatter.
  This repository deliberately uses action version tags, not SHA pins. Apply
  authorized workflow edits; report-only guidance does not cancel the user's request.

### PHPUnit limits

Use this repository's `make test` / Moodle harness, fixtures and coverage policy.
`resetAfterTest()` handles database isolation; it is not a reason to remove a
necessary parent `setUp()` call. Preserve setup/teardown chains in existing tests.
Check clock/mock APIs in the minimum supported Moodle branch before using them.
The skill's general examples do not override local `@covers`, PHPCS or version rules.

### AMD limits

Scope to `amd/src/` and Moodle core helpers. The synchronous SCORM tracker uses
Vitest; do not move it to AMD/Jest or install a new test runner. The embedded editor
has its own upstream build. Verify named exports and return shapes against Moodle
4.5 before copying snippets. Use `Promise.all(Ajax.call(...))` when awaiting multiple
requests; AJAX uses Moodle session authentication/sesskey, not an external WS token.
Use existing pending/lifecycle patterns where needed; do not wrap every promise or
perform a generic migration of working modal code because a skill lists deprecations.

## Evaluation of the proposed Moodle catalog

Source: [claude-moodle-dev skills](https://github.com/SaadRahman01/claude-moodle-dev/tree/18bf1180d236889d686ff683e37333c9544b662d/skills).
The nine proposed skills, including accessibility, were inspected. Decisions concern this
plugin and the reviewed revision, not a blanket judgment of the author.

| Skill | Decision and reason |
|---|---|
| `moodle-plugin-development` | Not installed. Broad scaffold duplicates local guidance; PascalCase class advice and no-bump string/settings table conflict with Moodle/local conventions. It also names an obsolete privacy deletion method. |
| `moodle-phpunit-testing` | Installed with the limits above; useful generator, event and external-return validation patterns. |
| `moodle-behat-testing` | Not installed. Its custom-entity registration example puts `get_creatable_entities` in the step context. Official docs place that in a generator class under `tests/generator/`. The local `behat-test` skill follows existing plugin steps. |
| `moodle-amd-javascript` | Installed with narrow scope and local Vitest/build rules. |
| `moodle-web-services` | Not installed. Says capabilities metadata is checked in addition to method checks, and shows `await Ajax.call(...)` as if it resolved an array of promises. Follow the local endpoint tests and official API instead. |
| `moodle-security-audit` | Not installed. Broad checklist needs qualification for JSON endpoints and package serving; file-picker accepted types are not content validation. Local package/tracking skills preserve the actual trust boundaries. |
| `moodle-privacy-gdpr` | Not installed. The claim that declaring a subsystem link handles file export/deletion is insufficient for plugin-owned File API data. Existing provider and round-trip tests are more appropriate. |
| `moodle-upgrade-migration` | Not installed. Starts by bumping the compatibility floor and mixes version-specific migration claims; this plugin needs XMLDB/savepoint and monotonic-version guidance, supplied by local `moodle-upgrade`. |
| `moodle-accessibility` | Not installed. Assumes Bootstrap 5 and WCAG 2.1 throughout; the plugin retains Moodle 4.5 compatibility and its research policy targets WCAG 2.2 AA. Verify UI against supported core and accessibility docs. |

Theme, performance, mobile-app and hooks skills were not added merely because they
exist: the current task needs no theme, new mobile client, performance framework or
hook migration. The plugin already has mobile external functions; those are covered
by local service validation, not a mobile-app development skill.

Other candidates:

- [Coodle](https://github.com/catalanml/coodle-moodle45agentskills/tree/ba287dfe3cdad5f81a008e0f69b94aa0843ade54):
  useful separation into references, but a broad Moodle 4.5 catalog and no license file
  found in the reviewed tree. Not vendored. Its testing rule forbidding all direct
  inserts is too absolute for this plugin's migration/edge-case fixtures.
- [MoMoPDA](https://github.com/wilenius/momopda/tree/d69a37e986b700c9eb4fee683d004b260018b540):
  the inspected default branch contains `.prompts/` and an orchestrator, not the
  claimed `skills/moodle-plugin-development/SKILL.md`. Do not install a whole
  orchestration template over this established activity module.
- `moodle-internals` from Moodle Playground: not installed; runtime/SQLite/WASM
  integration advice is not the contract of a normal Moodle activity module.
- No Moodle MCP was configured: a new server is unnecessary to install these skills.
  Context7 and official versioned docs remain available on demand.

## Maintenance

```bash
gh skills install SaadRahman01/claude-moodle-dev skills/moodle-phpunit-testing --dir .agents/skills
gh skills install SaadRahman01/claude-moodle-dev skills/moodle-amd-javascript --dir .agents/skills
gh skills install github/awesome-copilot skills/github-actions-hardening --dir .agents/skills
gh skills update --all --dir .agents/skills
```

Review upstream prompts, links and licenses on update. Local skills have no GitHub
provenance and are skipped by the updater. Expose each installed skill through a
relative `.claude/skills/` symlink. Do not copy prompts into both locations.
Licenses are in `.agents/licenses/`; all agent tooling is excluded from releases.

Official checks used for the assessment:
[Behat generators](https://moodledev.io/general/development/tools/behat/writing),
[external services](https://moodledev.io/docs/apis/subsystems/external/description),
[Privacy API](https://moodledev.io/docs/apis/subsystems/privacy),
[coding style](https://moodledev.io/general/development/policies/codingstyle).

## Guidance design sources

Keep task triggers precise, reveal detail on demand, retain actual repository
invariants and avoid repeated mandatory planning or confirmation steps. References:
[OpenAI: rethinking skills and prompts](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra),
[Anthropic: prompting Claude Opus](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5),
[effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
and [agent skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills).
Prepared with OpenAI Codex assistance; the links are design references, not a claim
that Claude executed or validated these changes.
