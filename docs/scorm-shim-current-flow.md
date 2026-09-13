# SCORM 1.2 tracking flow

The plugin supplies one synchronous `window.API` in the Moodle viewer. All package
pages share it. Browser tracking uses SCORM 1.2 only; the mobile service enters the
same server ingestion pipeline (DEC-122-01).

## Package and host runtime

`package_manager::extract_stored()` installs the plugin's complete runtime pair,
regardless of which runtime the uploaded archive contained (DEC-105-01).
`assets/scorm/SOURCE` identifies the immutable upstream commit, version stamp and
both file digests. The runtime is generated with upstream's exporter assembler,
without local changes.

`scorm_injector::inject()` loads that pair once and opens
`exeScorm12.session.open({ ownsLifecycle: false })` (DEC-105-02). It removes an
uploaded SCORM export's `loadPage()` body handler and `exe-scorm`/`exe-scorm12`
classes. This keeps each iframe page from finishing the shared host session.
The iframe keeps the permissions documented in [TRACKING](TRACKING.md).

## Browser to gradebook

1. `view.php` creates the API from `js/scorm_tracker.js` before loading the iframe.
   Its session token groups all commits of this viewer load into one attempt.
2. `LMSSetValue` buffers CMI fields. On `cmi.suspend_data`, the tracker captures
   per-iDevice scores by stable objectid while the scoring page is available.
3. Versioned `exe12/1` records carry their objectids directly. Legacy records use
   the current iframe DOM to resolve page-local positions, with stale-slot guards.
   Non-evaluable records and empty score fields do not create per-item grades.
4. `LMSCommit` sends the buffered state immediately; a 500 ms autocommit also
   persists critical changes. The host flushes on `beforeunload`. Failed HTTP
   writes keep the buffer dirty for the next send.
5. `track.php` validates login, activity permissions and the sesskey in the JSON
   body, then calls `track::ingest()`. `save_track` uses the same ingestion service.
6. The service acknowledges preview and ungraded activity requests without writes
   (DEC-0-06, DEC-126-01). Scored work is serialized per activity/user, constrained
   by the attempt limit, clamped and filtered to registered objectids.
7. Per-item attempts are recorded; the overall is recomputed from reported item
   scores and their weights. PERITEM publishes only itemnumber 1..N; OVERALL
   publishes only itemnumber 0. Completion and lifecycle events follow the shared
   ingestion result.

## Boundaries

Iframe navigation retains the parent API's suspend data and accumulated scores.
Reloading the entire Moodle viewer starts a fresh session token and CMI buffer;
there is no persistent suspend-data hydration across viewer reloads. Attempts and
published grades already stored in Moodle remain intact.

The plugin overall uses the **reported** item map. It does not publish a zero for
an untouched iDevice or derive a package-wide denominator from browser statements.
Upstream's runtime counts registered, untouched evaluable activities as zero once
another activity has a score, so partial totals can differ. For example, 50% on a
60-weight item with its 40-weight peer untouched is 50 in the plugin and 30 in the
runtime. A package-wide plugin denominator requires author-owned weights parsed
from `content.xml`; see [GRADEBOOK](GRADEBOOK.md).

Runtime replacement does not rewrite the `common.js` or iDevice scripts embedded
in older packages. Upstream producer fixes require content exported with the
corrected eXeLearning version.

New work while grading is disabled cannot satisfy status completion because no
attempt is recorded. Historical attempts remain available to completion, and
historical `gradable = 0` rows remain excluded from grades and attempt limits.
