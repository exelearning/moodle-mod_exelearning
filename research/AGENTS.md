# Research operating rules

Follow these rules when adding, editing or citing research. Preserve historical
records in their original language; write new agent instructions and contributions
in English. Documentation under the project's `docs/` may remain Spanish.

## Evidence and scope

- Support technical claims with a repository path and commit, versioned official
  documentation with consultation date, or a reproducible experiment. Distinguish
  facts, interpretations, hypotheses and unresolved questions explicitly.
- SCORM 1.2 is the only browser tracking channel, with stable objectid routing and
  ingestion shared with mobile services. DEC-122-01 superseded DEC-17-01, DEC-0-18
  and DEC-85-01. Consult `../docs/tracking-architecture.md` and current code;
  historical xAPI plans are not instructions to restore it. LRS, cmi5 and LTI 1.3
  AGS remain outside current scope.
- Keep facts in `fuentes/`, interpretation in `analisis/` and decisions in
  `decisiones/`. An analysis note does not make an architecture decision.
- Each TAREA links to at least one source, analysis or question. Decisions cite
  evidence; experiments record command, commit, environment, measurements and limits.
- Use Context7 for API, standard and library documentation. Record the exact query,
  resolved library ID, consultation date and returned version in the relevant source note.
- Retain accessibility and privacy requirements: WCAG 2.2 AA, GDPR and special care
  for children's data. Consult `cumplimiento/` when the task affects these areas.
- Declare external licenses and compatibility with Moodle's GPLv3.

## Records and identifiers

- `status.yaml`, ADRs and diary entries are append-only. Supersede invalidated
  decisions with a new ADR and update supersession metadata using the current
  format in `decisiones/README.md`; do not rewrite their historical rationale.
- REPO, FTE, AN, EXP, TAREA, PREG and RIE IDs are monotonic and never reused.
  Decisions use `DEC-<GitHub tracking number>-<two-digit sequence>`: issue number,
  or PR number when no issue exists. Never open an issue just to allocate a number.
  Consult `decisiones/mapa-migracion-ids.md` when dealing with retired identifiers.
- Preserve schema field names and literal identifiers/API names. Record AI assistance
  in the record's supported metadata (`herramienta_ia` for research YAML or
  `ai_assistance` in the current ADR format), using the actual tool/model.
- Before adding records, inspect current status and related sources. A task introducing
  a durable technical decision needs an ADR with evidence, not just an analysis note.
- Add a diary entry for research changes, append status when task status changes,
  and regenerate indexes with `python3 research/tools/build_indexes.py`.
- Validate current ADRs with `node research/tools/architecture-records.mts check`.
  `test_schema_validation.py` is a legacy checker that still requires Spanish ADR
  field names; do not rewrite migrated ADRs to satisfy it. Compare any reported
  failures with the base branch before attributing them to a change.

## Reference material and experiments

- Do not vendor external repositories into research. Reference a local clone path
  and upstream URL/commit; `../_repos/` is the conventional reference-clone location
  from DEC-0-02, not a directory to create automatically.
- Do not add heavyweight ELP/ELPX, SCORM ZIP or binary artifacts. Reference existing
  fixtures or provide reproducible generation/acquisition instructions.
- Do not copy production code from Moodle or other plugins into research, or write
  this plugin's production implementation here.
- Keep research tools repeatable without external side effects. A proof of concept
  is an experiment only when its commands, commit, environment and results are recorded.
