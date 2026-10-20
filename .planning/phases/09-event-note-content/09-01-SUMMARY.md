---
phase: 09-event-note-content
plan: 01
subsystem: notes
tags: [luxon, template-variables, iso-week, esbuild, harness]

requires: []
provides:
  - "{{week}} (ISO 8601 week, unpadded), {{dd}}, {{d}}, {{year}} (calendar year) event template variables in title, template body and default frontmatter"
  - "src/utils/eventDateVariables.ts: getEventDateVariables(date) / EventDateVariables"
  - "verify-09.mjs phase harness that drives the real NoteService.createEventNote in 4 timezones with 1.15.0 parity"
affects: [09-02, 11-docs]

actuals:
  tokens: 4049
  tasks: 2
  commits: 2
plan_head_before: 2bd564d4390063a4fc9bf2020dbe2c69886b281e
plan_head_after: d47fab1eae3ff7edda520e26a96e7af68ab0ecc1

tech-stack:
  added: []
  patterns:
    - "Pure date-part helper in src/utils with luxon only (no obsidian import), spread into getEventTemplateVariables"
    - "Phase harness: esbuild-bundle real service with obsidian stubbed, data: URL import, per-TZ child processes, git-tag baseline parity"

key-files:
  created:
    - src/utils/eventDateVariables.ts
    - .planning/phases/09-event-note-content/verify-09.mjs
  modified:
    - src/services/NoteService.ts

key-decisions:
  - "Week uses luxon DateTime.fromJSDate(date).weekNumber (ISO), not localWeekNumber; year uses getFullYear() (calendar year, never ISO week-year)"
  - "New keys sit after month and before source in EventTemplateVariables and the returned object, so tokens inside ICS description/location/attendee text are never substituted"
  - "Pre-existing UTC-based {{date}}/{{date-iso}} left unchanged (A-UTC); harness expects the toISOString() value"
  - "Phase work committed on branch gsd/phase-09-event-note-content because the commit guard reports main as protected"

patterns-established:
  - "verify-09.mjs CHECKS array of top-level async function checkName() declarations; Plan 09-02 appends to it"

requirements-completed: [ENH-09, ENH-10, ENH-11, ENH-12]

coverage:
  - id: D1
    description: "{{week}}/{{dd}}/{{d}}/{{year}} resolve through the real createEventNote path: 2026-05-04 -> 19/04/4/2026, 2027-01-01 -> 53/01/1/2027, plus year-boundary matrix, in 4 timezones"
    requirement: ENH-09
    verification:
      - kind: integration
        ref: "node .planning/phases/09-event-note-content/verify-09.mjs#checkTracer,checkBoundaries,checkPrecision"
        status: pass
    human_judgment: false
  - id: D2
    description: "Day-of-month and calendar-year values are local-time, unpadded/padded as specified and independent of the Note date format setting"
    requirement: ENH-10
    verification:
      - kind: integration
        ref: "node .planning/phases/09-event-note-content/verify-09.mjs#checkPrecision,checkDateFormatIndependence"
        status: pass
    human_judgment: false
  - id: D3
    description: "{{year}} is the calendar year (2027 for 2027-01-01), never the ISO week-year"
    requirement: ENH-11
    verification:
      - kind: integration
        ref: "node .planning/phases/09-event-note-content/verify-09.mjs#checkTracer,checkBoundaries"
        status: pass
    human_judgment: false
  - id: D4
    description: "No cross-substitution between {{d}}/{{dd}}/{{date}}, sanitized titles, and byte parity with 1.15.0 for users not using the new tokens"
    requirement: ENH-12
    verification:
      - kind: integration
        ref: "node .planning/phases/09-event-note-content/verify-09.mjs#checkAdjacency,checkSanitizedTitle,checkParity"
        status: pass
      - kind: other
        ref: "npm run lint && npm run build"
        status: pass
    human_judgment: false
  - id: D5
    description: "Rendering in Obsidian: file names, body lines and Properties panel for timed 12:00 events on 2026-05-04 and 2027-01-01"
    requirement: ENH-12
    verification: []
    human_judgment: true
    rationale: "Plan backstop truth: real Obsidian vault rendering and Properties panel cannot be asserted from Node; harvested into 09-HUMAN-UAT.md at end of phase"

duration: 5min
completed: 2026-10-20
status: complete
---

# Phase 9 Plan 01: Event Date Template Variables Summary

**`{{week}}` (ISO 8601 via luxon `weekNumber`), `{{dd}}`, `{{d}}` and `{{year}}` (calendar year) added to event note titles, templates and frontmatter, proven against the real `NoteService.createEventNote` in 4 timezones with byte parity to 1.15.0**

## Performance

- **Duration:** about 5 min
- **Started:** 2026-10-20T13:56:39Z
- **Completed:** 2026-10-20T14:02:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- New pure helper `getEventDateVariables(date)` in `src/utils/eventDateVariables.ts`. Its only import is luxon, and it uses local-time accessors only.
- `NoteService` exposes the four tokens through all three existing substitution paths: sanitized title, template body and default frontmatter. `applyTemplateVariables`, `formatTitle`, `sanitizeFileName` and the folder-template variables are untouched.
- `verify-09.mjs` harness: 7 checks run against production code in Europe/Athens, America/Los_Angeles, Pacific/Auckland and UTC. The output ends with `verify-09: all checks passed (4 timezones)`.

## Task Commits

1. **Task 1: End-to-end tracer (util, NoteService wiring, harness with checkTracer)**: `f4ea20e` (feat)
2. **Task 2: Harden the date-variable slice (boundaries, precision, adjacency, sanitized title, date-format independence, 1.15.0 parity)**: `d47fab1` (test)

## Files Created/Modified
- `src/utils/eventDateVariables.ts`: `EventDateVariables` interface and `getEventDateVariables(date)`.
- `src/services/NoteService.ts`: imports the helper. Adds `week`/`dd`/`d`/`year` fields with comments after `month` in `EventTemplateVariables`. Adds `...getEventDateVariables(event.start),` after `month:` in `getEventTemplateVariables`.
- `.planning/phases/09-event-note-content/verify-09.mjs`: phase verification harness, which Plan 09-02 extends.

## Harness structure (for Plan 09-02)

- `ROOT`: repo root, three directories above the harness.
- `TIMEZONES`: `["Europe/Athens", "America/Los_Angeles", "Pacific/Auckland", "UTC"]`.
- `loadBundle(baselineRef?)`: esbuild-bundles a stdin entry that re-exports `NoteService`, `DEFAULT_SETTINGS` and `getEventDateVariables`. The `obsidian-stub` plugin supplies `TFile`, `TFolder` and `normalizePath`. With `baselineRef`, the `baseline-noteservice` plugin swaps in `git show {ref}:src/services/NoteService.ts`. Results are cached per ref and imported through a `data:text/javascript;base64,` URL. **When 09-02 adds new modules, it must add their exports to the stdin `contents` list.**
- `createNote(mod, settingsPatch, event)`: builds a fake plugin (`structuredClone(DEFAULT_SETTINGS)` shallow-merged with the patch, plus a recording `app.vault`). It calls `createEventNote`, asserts exactly one `vault.create`, and returns `{ path, content }`.
- Helpers:
  - `workCalendar(extra)` returns the Work source.
  - `patch(extra)` returns `{ calendarUrls: [workCalendar()], ...extra }`.
  - `makeEvent(y, m0, d, hh, mm, extra)` builds a test event.
  - `bodyOf(content)` returns the text after the first `\n---\n`.
  - `basename(path)` returns the text after the last slash.
- Data tables: `BOUNDARY_CASES`, `TRACER_DATES`.
- `CHECKS` = `[checkTracer, checkBoundaries, checkPrecision, checkAdjacency, checkSanitizedTitle, checkDateFormatIndependence, checkParity]`. Each is a top-level `async function checkName()` at column 0.
- Runner: the parent spawns one child per zone with `TZ` and `VERIFY09_TZ_CHILD=1`. Each child prints `verify-09 [{zone}]: ok`. The parent prints `verify-09: FAILED in {zone}` and exits 1 on the first failing zone. Optional debug filter: `VERIFY09_ONLY=checkA,checkB`.

## Mutation checks (Task 2, performed and reverted, not committed)

| Mutation | Result |
|----------|--------|
| `weekNumber` changed to luxon `localWeekNumber` in `getEventDateVariables` | `checkBoundaries` fails, first at the 2026-12-31 case. `checkTracer` also fails (locale week gives 18 for 2026-05-04 and the wrong week for 2027-01-01). |
| `...getEventDateVariables(event.start),` moved below `description:` | `checkParity` fails on corpus `b-existing-vars-with-token-text` 2026-05-04, because ICS text tokens got substituted. |

Both files were restored with `git checkout -- <file>`. Re-running the harness passed.

## Decisions Made
- `getDate()` is computed once and reused for `d`/`dd`. This is equivalent to the plan's two expressions.
- A `VERIFY09_ONLY` debug filter was added to the harness runner, so the mutation checks could isolate a single check. Without the env var, behaviour is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Commit guard refused `main`, so work was re-homed onto a phase branch**
- **Found during:** Task 1 commit
- **Issue:** The executor Step 0 guard (`git.base-branch --is-protected main` returns `true`, and `git.allow_default_branch_commits` is unset) refuses commits on `main`.
- **Fix:** Created `gsd/phase-09-event-note-content` from `2bd564d` (the configured `phase_branch_template`) before the first commit. No refs were rewritten. `main` is untouched and can be fast-forwarded.
- **Commit:** f4ea20e onward

**2. [Project rule] Commit trailer removed**
- **Found during:** Task 1 commit
- **Issue:** PROJECT.md/CLAUDE.md commit hygiene forbids referencing AI assistance in commit messages. The first commit carried an attribution trailer.
- **Fix:** Amended the (unpushed, own) commit to drop the trailer. The final hash is `f4ea20e`.

---

**Total deviations:** 2 (1 blocking, 1 project-rule)
**Impact on plan:** No code scope change.

## Known pre-existing issues

- **A-UTC:** `{{date}}`/`{{date-iso}}` (and `start_date`/`end_date` in ISO format) use `toISOString()` (UTC). For all-day events in UTC+ zones they show the previous day, and the same happens for midday events in UTC+13/+14. The new local-time `{{dd}}` is correct alongside them. This phase does not change it (prohibition: changing it would rename future notes and break note-exists matching). It is a candidate for a follow-up decision. The harness `checkAdjacency` deliberately expects the `toISOString()` value.

## Issues Encountered
`npm ci` reports 8 audit vulnerabilities and an install-scripts notice for esbuild@0.17.3. Both are expected per plan and were not acted on (no dependency changes; `git diff --quiet 1.15.0 -- package.json package-lock.json` passes).

## User Setup Required
None. No external service configuration is required.

## End-of-phase human check (Obsidian UAT)
Run `npm run build` and copy `main.js`, `manifest.json` and `styles.css` into the vault plugin folder. Then:
- Set the title format to `{{year}}-W{{week}} {{dd}} {{event_title}}`.
- Add the template line `{{d}} | {{dd}} | {{date}} | {{week}} | {{year}}`.
- Add the frontmatter line `week: {{week}}`.

Timed 12:00 events give these results:

| Event date | Expected file | Expected body line | Expected frontmatter |
|------------|---------------|--------------------|----------------------|
| 2026-05-04 | `2026-W19 04 ...` | `4 \| 04 \| 2026-05-04 \| 19 \| 2026` | week 19 |
| 2027-01-01 | `2027-W53 01 ...` | `1 \| 01 \| 2027-01-01 \| 53 \| 2027` | week 53 |

The Properties panel should show no error.

## Next Phase Readiness
Ready for 09-02 (calendar tag merge, BUG-08/09). It should append checks to `verify-09.mjs` and add any new pure module to the `loadBundle` stdin re-exports.

## Self-Check: PASSED
- FOUND: src/utils/eventDateVariables.ts, src/services/NoteService.ts, .planning/phases/09-event-note-content/verify-09.mjs
- FOUND commits: f4ea20e, d47fab1
- Plan verification: `npm run lint && npm run build && node verify-09.mjs` exit 0. Interface and return-object order gates pass. No dependency diff since 1.15.0.

---
*Phase: 09-event-note-content*
*Completed: 2026-10-20*
