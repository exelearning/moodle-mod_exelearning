---
name: gradebook-tracking
description: Change or debug SCORM, attempts, gradebook, completion and tracking services in mod_exelearning.
---

# Grades and tracking

Trace `view.php` / `js/scorm_tracker.js` → `track.php` /
`classes/local/tracking_endpoint.php` → `classes/local/track.php` →
`classes/local/attempts.php` and `classes/grades/`. `classes/external/save_track.php`
reuses `track::ingest()`. Read `docs/GRADEBOOK.md` for columns/recalculation and
`docs/TRACKING.md` / `docs/scorm-shim-current-flow.md` for ingestion/bridge behavior.
`docs/tracking-architecture.md` explains xAPI retirement (DEC-122-01).

Preserve these invariants:

- Stable `objectid` → stable `itemnumber`, not a page-local index. Reappearing items
  retain their number; disappearing items are soft-deleted without losing history.
  Keep the 100-column cap and `grade_idevice1_name`…`grade_idevice100_name` plus overall strings.
- `peritem` only has per-iDevice columns: do not create a hidden/excluded overall
  (the historical model superseded by DEC-25-01). `overall` only publishes itemnumber 0.
- Authorized preview does not persist; clients cannot choose identity or create grade
  items. Filter `itemscores` to this instance's objectids, cap size, normalize and
  clamp scores; recompute overall using the current weighted contract.
- A `sessiontoken` groups commits within one attempt; preserve locking, attempt limits
  and highest/average/first/last/lowest aggregation.
- `gradable = 0` rows record participation but never become grades or consume the
  graded-attempt allowance (DEC-124-03). Check code/tests if an older document claims
  that enabling grading recalculates all historical participation.
- Preserve grade-based and status-based completion; do not convert a missing score
  into zero. Model switches, attempt deletion and privacy must recalculate consistently.
- Web requests require a session, sesskey in the JSON body and activity permissions;
  external services validate parameters/context/capabilities and return schemas.
  Browser SCORM and mobile share rules without duplicating them.

Candidate tests: `track_test.php`, `attempts_test.php`, `grades_test.php`,
`grademodel_test.php`, `completion_test.php`, `external_test.php`,
`local/tracking_endpoint_test.php` and `tests/js/scorm_tracker.test.js`.
Select by impact; reuse grade-related Behat scenarios for visible workflows.
