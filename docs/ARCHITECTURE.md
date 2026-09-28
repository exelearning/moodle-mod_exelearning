# Architecture — `mod_exelearning`

> Responsibility map of the plugin. `mod_exelearning` delivers and grades eXeLearning v4
> (`.elpx`) packages inside a Moodle course, preserving the native eXe sidebar and
> recording multiple gradable items per activity.

## One-paragraph model

A teacher uploads an `.elpx` (a ZIP with `content.xml`). `lib.php` stores it and extracts
it to a per-revision file area; `local\package` parses `content.xml` and enumerates the
**gradable iDevices**; `lib.php` registers one Moodle grade item per iDevice
(multi-`itemnumber`). At view time `view.php` serves the package inside a sandboxed
iframe and injects a SCORM 1.2 `window.API` shim; learner interactions are POSTed to
`track.php`, normalised and scored **server-side** by `local\track`, recorded as
attempts by `local\attempts`, and pushed to the gradebook by `lib.php`. The same scoring
pipeline backs the `save_track` web service. `classes/external` exposes the API surface;
`classes/privacy` declares personal data; `backup/moodle2` exports/imports the activity.

## Layered responsibility map

| Layer | Code | Responsibility | Why it lives here |
|---|---|---|---|
| **Moodle façade** | `lib.php` | Module callbacks: `*_supports`, `*_add/update/delete_instance`, `*_pluginfile`, `*_get_file_areas`, `*_view`, grade callbacks (`*_grade_item_update`, `*_update_grades`, `*_recalculate_user_grades`, `*_get_grade_item_names`), reset, settings navigation. Each non-trivial callback is now a **thin delegator** to a domain class. | Moodle requires these named functions in `lib.php`; they are the contract with core. The heavy logic moved out ([[DEC-71-01]]); only the Moodle-mandated signatures and wrappers stay. |
| **Grades domain** | `classes/grades/grade_sync.php`, `grade_recalculator.php`, `grade_item_manager.php`, `completion_validator.php`, `gradeitems.php` | `grade_sync`: detect gradable iDevices and synchronise/soft-delete grade items (multi-`itemnumber`), staleness warning, re-publish from attempts. `grade_recalculator`: batched re-aggregation per user/item (no N+1). `grade_item_manager`: overall-item guard, column naming/truncation, remove-all, grade-category reparent. `completion_validator`: completion-by-grade form relaxation. `gradeitems`: `itemnumber_mapping`. | Gradebook math/lifecycle extracted from `lib.php` so it is unit-testable in isolation ([[DEC-71-01]]); no grade rule changed, only relocated. |
| **Package domain** | `classes/local/package.php`, `classes/local/package_manager.php`, `classes/local/zip_utils.php` | `package`: parse `content.xml`, detect gradable iDevices (`isScorm`), content hashing, XML hardening. `package_manager`: store/locate the ELPX (any itemid), validate `content.xml`, extract to `content/{revision}/`, activate a revision and prune superseded ones, build the package URL; `save_editor_package()` stages and activates an editor export (size limit, rollback on failure); `self_heal()` extracts/re-syncs a package stored without going through the form and `refresh_runtime()` re-extracts when the bundled SCORM runtime changed ([[DEC-105-01]]), both under the per-instance package lock. `zip_utils`: unsafe-entry and extraction-containment checks shared by every ZIP extraction site. | Pure parsing/detection (`package`) and filearea lifecycle (`package_manager`), testable in isolation; no UI coupling ([[DEC-71-01]]). |
| **SCORM transforms** | `classes/local/scorm/scorm_injector.php`, `classes/local/scorm/idevice_patch.php` | `scorm_injector`: inject the SCORM wrapper `<script>` tags + `init()` into the extracted HTML. `idevice_patch`: drop the `body.exe-scorm` save guard from `form`/`scrambled-list` ([[DEC-13-11]]). | Serve-time package mutation isolated from `lib.php` ([[DEC-71-01]]); the known debt is unchanged (see below). |
| **URLs** | `classes/local/urls.php` | Gradebook deep-link / grade-analysis / navigation-before-key builders. | Small URL helpers extracted from `lib.php` ([[DEC-71-01]]). Teacher-only content is no longer hidden by mutating the package: `view.php` appends the package's own `?exe-teacher=1` parameter when `teachermodevisible` is on. |
| **Tracking domain** | `classes/local/track.php`, `classes/local/tracking_endpoint.php` | `track`: ingest tracking payloads: normalise/clamp scores, route by stable `objectid`, recompute the overall server-side, enforce attempt caps, drive completion. `tracking_endpoint`: build the `js/scorm_tracker.js` config and confirm the sesskey carried in the JSON body (SEC-04). | Single source of truth for scoring; reused by both `track.php` and the `save_track` web service so web and WS cannot diverge ([[DEC-26-02]]). Both halves of the sesskey contract live in one class so the invariant is reviewable in one place. |
| **Attempts domain** | `classes/local/attempts.php` | Attempt numbering (session-token grouping), upsert of `exelearning_attempt`, aggregation (highest/average/first/last/lowest). Access rules: `can_review()` (learner reviews own attempts per `reviewmode`) and `can_view_user_data()` (enrolment + separate-groups boundary for another user's data). | Encapsulates attempt rules and aggregation independent of transport; the access rules are shared by `view.php`/`report.php` and the attempt/grade web services so web and mobile enforce the same boundary. |
| **Completion** | `classes/completion/custom_completion.php` | Module-level `completionstatusrequired` rule ([[DEC-69-01]]). | Moodle custom completion API; per-iDevice completion rules were rejected ([[DEC-67-01]]). |
| **Gradebook mapping** | `classes/grades/gradeitems.php` | `itemnumber_mapping` (0=overall, 1..100=iDevice) for Moodle 5.x completion-by-grade. | Implements a core interface; `strict_types`. |
| **API boundary** | `classes/external/*` (6 classes) | Web services for the mobile app; each validates context, login and capability. | The published Moodle external contract; fully declared in `db/services.php` ([[DEC-26-02]]). |
| **Privacy** | `classes/privacy/provider.php` | Declares `exelearning_attempt` metadata + the `core_grades` data flow; export/delete with grade recalculation. | Moodle Privacy API subsystem. |
| **Backup/Restore** | `backup/moodle2/*` | Export/import instance, grade-item mappings, attempts (gated by `userinfo`), and the `intro`/`package`/`content` file areas; remap user ids. | Moodle Backup/Restore API. |
| **Events** | `classes/event/*` | Views: `course_module_viewed`, `course_module_instance_list_viewed`, `report_viewed`. Attempts: `attempt_started`, `attempt_completed` (from `track::ingest()`, [[DEC-68-01]]), `attempt_deleted`. Migration: `migration_started`, `activity_migrated`, `activity_skipped`, `migration_failed`. | Selective observability ([[DEC-26-03]]); no per-commit event (would be noise). |
| **Global search** | `classes/search/activity.php` | Search area extending `\core_search\base_activity`: indexes the activity `intro` and, via file indexing, the text extracted from the package `content` file area. | Makes eXe content findable in Moodle global search; visibility/context resolved by the base class ([[DEC-70-01]]). |
| **Editor integration** | `classes/local/embedded_editor_source_resolver.php`, `classes/local/editor_paths.php`, `amd/src/editor_modal.js`, `editor/index.php`, `editor/save.php`, `editor/static.php`, `editor/styles.php` | Validate and serve the editor bundled in the release ZIP (`dist/static/`, the only source); `editor_paths::is_within()` confines the static and styles file routers to their root; `postMessage` open/export bridge; save → `package_manager::save_editor_package()` → re-sync. | Embedded-editor-only model ([[DEC-0-09]]); the editor is a release artifact, no runtime installer ([[DEC-106-01]]). |
| **Editor styles** | `classes/local/styles_service.php`, `classes/admin/admin_setting_styles{upload,uploaded,builtins}.php`, `admin/styles.php` | Registry of admin-uploaded style ZIPs (validate, install, enable/disable, delete) and built-in theme toggles; theme registry override handed to the editor. | Site-level admin settings; uploaded styles are served by `editor/styles.php`, not from the course file areas. |
| **Sibling migration** | `classes/local/migration/**`, `admin/migrate.php` | `migration_service` orchestrates preflight and non-destructive migration of `mod_exeweb` / `mod_exescorm` activities; `source/*` reads each sibling read-only behind `source_interface` (`package_probe` detects an ODE 2.0 `content.xml`); `target/activity_builder` creates the target activity, named after the source plus a translated "(migrated)" suffix (`migratedname`) so both can be told apart; `grade/overall_grade_migrator` copies final grades to the overall item; `migration_result` reports per-activity outcomes. | Site-wide admin tool isolated from the activity runtime ([[DEC-13-05]], [[DEC-13-12]]). |
| **Entry points** | `view.php`, `track.php`, `grade.php`, `report.php`, `index.php`, `mod_form.php`, `settings.php` | View + SCORM shim (runs `package_manager::refresh_runtime()` and `self_heal()` first); tracking endpoint; gradebook deep-link; attempts report; course instance list; activity form; admin settings. | Thin controllers; security checks here, scoring logic delegated to `local\*`. |

## Request flows

**Authoring (upload):**
`mod_form.php` (validate zip-has-`content.xml`) → `exelearning_add/update_instance`
(`lib.php`) → `package_manager::save_and_extract` → (`scorm_injector` + `idevice_patch`)
→ `grade_sync::sync` → `local\package::detect_gradable_idevices` →
`grade_update(..., itemnumber=N, ...)`. The `lib.php` callbacks are thin delegators to
these `grades\*` / `local\*` classes ([[DEC-71-01]]).

**Authoring (embedded editor):**
`amd/src/editor_modal.js` (export via `postMessage`) → POST `editor/save.php`
(`moodle/course:manageactivities`, package lock) → `package_manager::save_editor_package()`
(stage `package/{revision+1}/` → `store_and_activate_revision()` → extract + transforms,
then advance the pointer and prune) → `exelearning_sync_grade_items()`. See
`docs/EMBEDDED_EDITOR.md`.

**Delivery + grading (learner):**
`view.php` (sandboxed iframe + `window.API` shim, config from `tracking_endpoint`) → iDevice JS (pipwerks SCORM 1.2) →
POST `track.php` (sesskey confirmed from the JSON body, SEC-04, +
`require_capability('mod/exelearning:savetrack')`)
→ `local\track::ingest()` (normalise/clamp, objectid routing, server-side overall
recompute, attempt cap) → `local\attempts` (record) → `grade_update` + completion.
See `docs/TRACKING.md`.

**External/mobile:** `classes/external/save_track::execute` reuses the **same**
`local\track::ingest()`; read services (`get_user_grades`, `get_user_attempts`, …) read
the same tables. See `docs/EXTERNAL_SERVICES.md`.

## Design principles observed in the code

- **Thin controllers, fat domain classes.** Entry-point PHP files do auth + transport;
  scoring/parsing/aggregation live in `classes/local/*` and `classes/grades/*`. `lib.php`
  now holds only the Moodle-mandated callback signatures plus thin delegators to those
  classes — the grade-sync, package, SCORM and URL/UI logic was extracted ([[DEC-71-01]],
  ~1751 → ~980 lines). `exelearning_supports()` and the lifecycle/`pluginfile` callbacks
  stay because Moodle requires the named functions, not because of domain logic.
- **One scoring pipeline.** Web and web-service paths converge on `track::ingest()`
  ([[DEC-26-02]]), so a fix or a hardening applies to both.
- **Server authority over grades.** The client never sets the overall; it is recomputed
  from per-iDevice scores ([[DEC-6-01]]). See `docs/TRACKING.md`.
- **Stable identity.** Grade routing keys on the package `objectid`, not page order
  ([[DEC-5-01]]); items soft-delete and carry a content hash for staleness ([[DEC-12-01]]).
- **Defensive parsing.** `content.xml` is parsed with a hardened DOM loader and a
  controlled regex fallback ([[DEC-26-01]]). See `docs/ELPX_PACKAGE.md`.

## Known, deliberate coupling (technical debt, tracked)

The package HTML is mutated at extraction to inject the SCORM wrapper
(`local\scorm\scorm_injector`) and to drop the `body.exe-scorm` save guard
(`local\scorm\idevice_patch`). The teacher-mode toggle is no longer hidden by injection:
`view.php` uses the package's own `?exe-teacher=1` parameter. This couples the plugin to eXeLearning v4
internals. It is recognised as the main debt and has a documented exit:
serve-time transform ([[DEC-34-02]], deferred) → upstream option ([[DEC-36-01]]). The exit
via an xAPI channel was tried and retired ([[DEC-122-01]]). The SCORM 1.2 shim in `view.php`
is **not** debt.

## Functional classification

`exelearning_supports()` keeps the default archetype (`MOD_ARCHETYPE_OTHER`, which the
4.5 and 5.0 activity chooser needs to list the module under "Activities") and declares
`MOD_PURPOSE_INTERACTIVECONTENT` as primary purpose and, on Moodle 5.1+,
`MOD_PURPOSE_ASSESSMENT` as secondary purpose (`FEATURE_MOD_OTHERPURPOSE`, guarded
with `defined()` because 4.5 and 5.0 lack it). This matches core's own modules for
interactive content (`mod_h5pactivity`, `mod_lesson`). The purpose only places the
activity in the chooser: the icon is branded (`exelearning_is_branded()`), so it is
never tinted. These are resolved per **module type**, not per instance, so they do
not vary with the per-activity `gradeenabled` switch ([[DEC-13-07]]). Decision
recorded in [[DEC-159-01]], which supersedes [[DEC-37-01]].

## Global search

`classes/search/activity.php` registers a single search area (`mod_exelearning/activity`)
by extending `\core_search\base_activity`. The base class resolves the module context and
enforces visibility/access; the subclass only declares what to index:

- The activity **`intro`** is indexed as the document content (default `get_document()`).
- `uses_file_indexing()` returns `true` and `get_search_fileareas()` returns
  `['intro', 'content']`, so the HTML/text **extracted from the `.elpx` package** (the
  `content` file area populated by `exelearning_save_and_extract_package`, see
  `lib.php`) is attached and text-indexed — making the authored eXe content findable.

The area is auto-discovered; an admin enables it from the global search engine and
reindexes (`php admin/cli/search.php`). Two adjacent integrations were considered and
**deferred** ([[DEC-70-01]]): `core\activity_dates` (no `timeopen`/`timeclose` window in
`mod_form.php` today) and analytics indicators (only useful with active models).

## Related documentation

`docs/EXTERNAL_SERVICES.md` · `docs/GRADEBOOK.md` · `docs/TRACKING.md` ·
`docs/ELPX_PACKAGE.md` · `docs/EMBEDDED_EDITOR.md` · `docs/PRIVACY_BACKUP_FILES.md` ·
`docs/RELEASE_CHECKLIST.md` · `docs/AUDIT_FOLLOWUP.md` · `research/decisiones/adr/`.
