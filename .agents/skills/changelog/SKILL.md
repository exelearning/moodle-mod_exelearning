---
name: changelog
description: Draft or update mod_exelearning release notes from merged GitHub PRs, preserving the existing changelog style and published entries.
---

# Changelog draft

`CHANGELOG.md` ships in the plugin ZIP. Describe outcomes for teachers, students and
administrators, not internal implementation. This skill prepares a reviewable draft;
it does not publish a release. Adapted from the changelog workflow in
`exelearning/exelearning`, with this plugin's paths and repository identity.

Use the mode, cutoff and target version already supplied by the user. Ask only for
missing information that cannot be established reliably:

- **Update draft:** keep the top version block and add PRs merged after the last PR
  already incorporated. If that cutoff is not recorded or supplied, ask for it;
  do not guess by matching changelog prose to PR titles.
- **New block:** use the requested target version/type and today's date. Obtain the
  cutoff from the latest published GitHub release. Do not invent a target version.

Sources:

```bash
gh pr view NUMBER --repo exelearning/moodle-mod_exelearning --json number,title,mergedAt
gh release view --repo exelearning/moodle-mod_exelearning --json tagName,publishedAt
gh pr list --repo exelearning/moodle-mod_exelearning --state merged --search 'merged:>TIMESTAMP' --json number,title,body,labels,mergedAt --limit 200
```

Read each PR's full body, ordered by merge time; paginate if the limit is reached.
Follow linked issues in the repository actually referenced (plugin issues may live
in `exelearning/exelearning` with the Moodle label). Split mixed PRs into individual
user-facing changes. Skip test/CI/tooling-only work, but retain behavioral fixes
hidden in test-titled PRs. Do not treat unmerged work as released.

Use `Added`, `Changed`, `Fixed`, `Upgraded`, `Removed` in that order, omitting empty
sections. Match existing headings (`## vX.Y.Z – YYYY-MM-DD`) and bullets:

- One sentence, initial capital, no final full stop.
- Lead with an area when useful: `Gradebook:`, `Embedded editor:`, `Attempts report:`.
- Dependency upgrades use `package-name: OLD → NEW`; verify editor against `.editor-version`.
- Deduplicate by meaning. Do not rewrite published blocks or unrelated content.

Report which PRs contributed entries and which were skipped with their reason.
Mark the result as a draft requiring editorial review; existing authorization to
commit the prepared change still applies. No forced confirmation when the request
already establishes the mode, version, cutoff or permission.
