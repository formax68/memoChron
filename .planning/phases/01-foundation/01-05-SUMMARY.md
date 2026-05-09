---
phase: 01-foundation
plan: "05"
subsystem: cleanup
tags: [cleanup, dead-code, imports]
dependency_graph:
  requires: ["01-03"]
  provides: ["CLEAN-01"]
  affects: []
tech_stack:
  added: []
  patterns: []
key_files:
  modified:
    - src/services/CalendarService.ts
    - src/utils/constants.ts
    - src/views/EmbeddedCalendarView.ts
    - src/views/EmbeddedAgendaView.ts
decisions:
  - "D-10: Strict to four named dead-code targets — calculateEndDate method, DEFAULT_TEMPLATE_PATH and TEMPLATE_VARIABLES constants, unused App/TFile imports"
  - "D-11: renderAgendaList FUNCTION in viewRenderers.ts preserved intact; only the import in EmbeddedAgendaView.ts removed"
metrics:
  duration: "10 minutes"
  completed: "2026-05-09"
  tasks_completed: 6
  tasks_total: 6
---

# Phase 1 Plan 05: CLEAN-01 Dead Code Removal Summary

**One-liner:** Targeted removal of five dead-code symbols — private method `calculateEndDate`, constants `DEFAULT_TEMPLATE_PATH` and `TEMPLATE_VARIABLES`, and unused `App`/`TFile`/`renderAgendaList` imports — across four source files with zero callers confirmed by grep.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete CalendarService.calculateEndDate private method | 8370c12 | src/services/CalendarService.ts |
| 2 | Delete DEFAULT_TEMPLATE_PATH and TEMPLATE_VARIABLES from constants.ts | 8370c12 | src/utils/constants.ts |
| 3 | Drop unused App import from EmbeddedCalendarView.ts | 8370c12 | src/views/EmbeddedCalendarView.ts |
| 4 | Drop unused TFile and renderAgendaList imports from EmbeddedAgendaView.ts | 8370c12 | src/views/EmbeddedAgendaView.ts |
| 5 | Run final phase-wide dead-code grep gate | 8370c12 | (no files — verification only) |
| 6 | Commit CLEAN-01 atomically | 8370c12 | all four files above |

## Commit

**8370c12** — `chore(cleanup): remove dead code (calculateEndDate, template constants, unused imports)`

4 files changed, 2 insertions(+), 19 deletions(-)

## Dead-Code Gate Results

All five grep gates returned the expected output after Tasks 1–4:

```
Gate 1: grep -rn "calculateEndDate|DEFAULT_TEMPLATE_PATH|TEMPLATE_VARIABLES" src/
→ PASS: no output

Gate 2: grep -n "renderAgendaList" src/views/EmbeddedAgendaView.ts
→ PASS: no output

Gate 3: grep -nE "\bApp\b" src/views/EmbeddedCalendarView.ts
→ PASS: no output

Gate 4: grep -nE "\bTFile\b" src/views/EmbeddedAgendaView.ts
→ PASS: no output

Gate 5: grep -cE "export function renderAgendaList" src/utils/viewRenderers.ts
→ PASS: 1 (function intact at line 81)
```

## D-11 Compliance

`grep -n "export function renderAgendaList" src/utils/viewRenderers.ts` returns exactly 1 match at line 81. The function remains exported and available for future callers. Only the unused import in `EmbeddedAgendaView.ts` was removed.

## Other Constant Preservation Confirmed

`grep -c "MEMOCHRON_VIEW_TYPE" src/utils/constants.ts` returns 1. All other constants in `constants.ts` are preserved:
- `MEMOCHRON_VIEW_TYPE`
- `DEFAULT_CALENDAR_URLS`
- `DEFAULT_REFRESH_INTERVAL`
- `DEFAULT_VIEW`
- `DEFAULT_NOTE_LOCATION`
- `DEFAULT_NOTE_TITLE_FORMAT`
- `DEFAULT_NOTE_DATE_FORMAT`
- `DEFAULT_NOTE_TIME_FORMAT`
- `DEFAULT_FRONTMATTER`
- `DEFAULT_TAGS`
- `DEFAULT_FIRST_DAY_OF_WEEK`
- `CALENDAR_COLOR_PALETTE`
- `CUTYPE_*` constants
- `DEFAULT_FILTERED_CUTYPES`

## Time Import Preservation Confirmed

`grep -E "import \{[^}]*\bTime\b[^}]*\} from" src/services/CalendarService.ts` returns:
```
import { Component, Event as ICalEvent, parse, Time } from "ical.js";
```
The `Time` import is intact. It is still used elsewhere in `CalendarService.ts` (e.g., `let next: Time | null` for recurring event iteration).

## Build Verification

```
node /Users/mike/code/memoChron/node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck
→ exit code 0

node esbuild.config.mjs production
→ exit code 0
```

Note: `node_modules` are in the main repo at `/Users/mike/code/memoChron/node_modules/` (not in worktree). Used the main repo's TypeScript directly.

## Phase 1 Completion Note

This plan (01-05) completes the CLEAN-01 requirement. Combined with Plans 01-01 through 01-04 delivering TD-01, TD-02, TD-03, and TD-04, this completes Phase 1 / Foundation if all prior plans also landed cleanly.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — pure dead-code removal with no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- src/services/CalendarService.ts exists and lacks `calculateEndDate`: CONFIRMED
- src/utils/constants.ts exists and lacks `DEFAULT_TEMPLATE_PATH`/`TEMPLATE_VARIABLES`: CONFIRMED
- src/views/EmbeddedCalendarView.ts exists and lacks `App` import: CONFIRMED
- src/views/EmbeddedAgendaView.ts exists and lacks `TFile`/`renderAgendaList` imports: CONFIRMED
- src/utils/viewRenderers.ts has `export function renderAgendaList` at line 81: CONFIRMED
- Commit 8370c12 exists: CONFIRMED
