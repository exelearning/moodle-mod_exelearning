# SCORM 1.2 runtime integration

The plugin runtime is generated from eXeLearning commit
[`37922ad8586bb38974a6c32208ef940a1ea680fb`](https://github.com/exelearning/exelearning/tree/37922ad8586bb38974a6c32208ef940a1ea680fb).
`assets/scorm/SOURCE` records the exact digests and development version stamp.
This integrates Moodle PRs [#105](https://github.com/exelearning/moodle-mod_exelearning/pull/105)
and [#126](https://github.com/exelearning/moodle-mod_exelearning/pull/126).

## Upstream changes

| Upstream PR | Effect on this module |
|---|---|
| [#2209](https://github.com/exelearning/exelearning/pull/2209) | Complete five-layer runtime, unmodified pipwerks wrapper, stable activity IDs in `exe12/1`, explicit host session bootstrap and provenance. |
| [#2244](https://github.com/exelearning/exelearning/pull/2244) | Fixes sibling navigation in stock SCORM players through the manifest organization. This module retains its native sidebar based on `content.xml`. |
| [#2299](https://github.com/exelearning/exelearning/pull/2299) | Independent SCORM conformance tests using a development-only oracle. No additional production dependency is needed here. |
| [#2310](https://github.com/exelearning/exelearning/pull/2310) | Real export generator, hand-computed grading catalogue, Chromium/Firefox recorder and live Moodle matrix. Old recorded traces remain historical evidence, not proof of the new runtime. |
| [#2371](https://github.com/exelearning/exelearning/pull/2371) | Corrects iDevice save/restart/completion behavior, early reports and restoration, immediate commits, terminal exit and weighted arithmetic. Producer changes require newly exported packages. |

## Module changes and regression coverage

- Runtime files are generated with upstream's `buildScorm12RuntimeFiles()` and copied
  without patches. Both files are installed together at extraction.
- The injector loads the pair once and opens a host-owned session. Uploaded SCORM
  exports have their SCO lifecycle entry neutralized.
- Both suspend-data formats are accepted; versioned records route by stable objectid.
  Legacy trace regressions cover stale and colliding page-local slots.
- An existing extracted activity with outdated runtime files is rebuilt into a new
  validated revision when viewed. The new URL invalidates browser caches. Tests cover
  unchanged packages, concurrent stale viewers, missing content/source, extraction
  failure and preservation of grade mappings and attempt history. Viewer refreshes,
  form updates and editor saves share a package lock from revision allocation through
  activation, pruning and grade synchronization. Contention and failed-save tests
  verify that another writer cannot overwrite the staged revision.
- Grading disabled means no new attempts, grades or events (DEC-126-01). Tests retain
  the exclusion of historical ungraded sessions after upgrade in both grade models.
- `tests/js/scorm-runtime-integration.test.js` executes the vendored wrapper/runtime
  against the real tracker. It covers untouched opening, early reports, sibling score
  restoration, iframe navigation, host lifecycle ownership, completion/restart and
  weighted arithmetic in both response orders.

The new runtime integration regressions also reject the previous #105 runtime:
restoration and early reports fail, terminal exit is missing, and reversing the same
three scores produces 50.5 and 49.5 instead of 50. The current runtime passes all seven.

## Running checks

```sh
make test-js
make test
make test ARGS=mod/exelearning/tests/local/package_runtime_test.php
make architecture-check
make check-version
```

`make test` uses the dedicated Moodle PHPUnit database. Do not point PHPUnit at the
plugin directory, which also contains its development dependencies. PHPCS must use
`--standard=moodle` on changed PHP files.

For live package controls and gradebook results, use the pinned upstream checkout's
`scripts/build-grading-catalogue.ts` producer and its Playwright live `exelearning-matrix`
lane. The plugin's VM tests execute the runtime contract; live tests additionally
exercise exported iDevices, iframe delivery, authenticated tracking and Moodle grades.

## Validation evidence

Local validation on Moodle 5.0.7, PHP 8.3.15 and MariaDB 12.3.3 passed the full
381-test suite (1503 assertions). After the final shared-lock change, the affected
package/form tests passed again: 37 tests, 149 assertions. JavaScript passed all 70
tests. PHP style checks, version checks and architecture checks passed. PHPUnit
reported 67 existing metadata deprecations, with no errors or failures.

The live browser matrix uses hand-computed results and checks each item and the
actual Moodle gradebook. Its final browser/CI results are recorded on PR #105.

The upstream catalogue's original M5 fixture is a historical malformed-content
case: its old trueorfalse template has 15 opening and 14 closing divs, nesting the
following dragdrop inside it before Moodle sees the ZIP. Current production
`renderView()` has the #2307 fix. For the current-editor M5 check, regenerate that
stored `htmlView` with the unmodified current renderer and export with
`ElpxExporter`, retaining the same shared block, settings and expected grade 70.
The validated input provenance is:

- Upstream commit: `37922ad8586bb38974a6c32208ef940a1ea680fb`.
- Original ZIP SHA-256: `4365faac684d9a24b025bb28ba1842aec69585c036cf277bdafbbe54cb94d224`.
- Current-renderer ZIP SHA-256: `07f1e97552a2124cd387b950a17031348963a28bc7a3d6564033094989fa3428`.

The original fixture's failure is retained as diagnostic evidence; it is not
counted as a passing current-editor test.

## Preserved limits

See [the current tracking flow](scorm-shim-current-flow.md#boundaries). Full viewer
reloads start a fresh attempt, partial module totals use only reported items, and
runtime replacement cannot rewrite producer scripts embedded in old exports.

The old `research/tools/test_schema_validation.py` still expects Spanish ADR metadata
keys and rejects the current English frontmatter schema. The authoritative
`make architecture-check` accepts the integrated records; the legacy validator is a
separate tooling issue.
