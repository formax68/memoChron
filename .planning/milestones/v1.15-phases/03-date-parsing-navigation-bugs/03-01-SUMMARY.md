---
phase: 03-date-parsing-navigation-bugs
plan: "01"
subsystem: utils/viewRenderers
tags: [bug-fix, date-parsing, timezone, BUG-01]
dependency_graph:
  requires: []
  provides: [parseDateFromFilename-local-day-fix]
  affects: [EmbeddedAgendaView, EmbeddedCalendarView, CalendarView]
tech_stack:
  added: []
  patterns: [numeric-Date-constructor, file-local-helper]
key_files:
  created: []
  modified:
    - src/utils/viewRenderers.ts
decisions:
  - "Extracted parseLocalDate(year, month, day) helper instead of inlining the numeric constructor in each branch — consistent with getReorderedWeekdays/getMonthInfo file-local helper style; makes the BUG-01 fix mechanically obvious"
  - "formats array duplicate at line 433 left in place — removal deferred to plan 03-03 per D-12 to keep diffs bisectable"
  - "parseDate() and its fallback new Date(input) at line 410 left untouched per D-03"
metrics:
  duration: "< 5 minutes"
  completed: "2026-05-12T08:15:07Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 3 Plan 1: BUG-01 parseDateFromFilename Local-Day Date Fix Summary

**One-liner:** Replaced six UTC-midnight `new Date("YYYY-MM-DD")` string constructions in `parseDateFromFilename` with a `parseLocalDate(year, month - 1, day)` helper using the numeric Date constructor so filenames like `2026-01-15.md` resolve to the correct local calendar day in every timezone.

## What Was Done

`parseDateFromFilename` in `src/utils/viewRenderers.ts` previously constructed `Date` objects via the JS string-form constructor (`new Date("2026-01-15")`). The JS spec treats this as UTC midnight — so in any timezone west of UTC (e.g. `TZ=America/New_York`, UTC-5) calling `.getDate()` returned the *previous* day (January 14 for a filename of `2026-01-15.md`). This caused the agenda view and embedded calendar/agenda views to show events for the wrong day for users in Americas timezones (issue #59).

### Fix approach

A file-local `parseLocalDate(year: number, month: number, day: number): Date | null` helper was extracted directly above `parseDateFromFilename`. The helper uses `new Date(year, month - 1, day)` — the numeric Date constructor — which produces a local-time Date anchored to the host machine's calendar day, matching the established idiom in `renderMonthDays` (CalendarView.ts:494) and `convertIcalTimeToDate` (timezoneUtils.ts:168).

All six format branches were updated to parse their digit substrings into `Number(...)` integers, then delegate to `parseLocalDate`.

### Helper extraction rationale

The six branches collapse to a uniform shape (parse → call helper → return-if-date). Extraction:
- Makes the BUG-01 fix visible in a single place
- Consistent with `getReorderedWeekdays` / `getMonthInfo` file-local helper style (lines 28, 40)
- The comment on `parseLocalDate` explains the UTC-midnight pitfall for future maintainers

## Diff Shape Per Branch

| Branch | Old | New |
|--------|-----|-----|
| YYYY-MM-DD | `new Date(dateStr)` | `parseLocalDate(Number(parts[0]), Number(parts[1]), Number(parts[2]))` |
| YYYY_MM_DD | `new Date(dateStr.replace(/_/g, "-"))` | `parseLocalDate(Number(parts[0]), Number(parts[1]), Number(parts[2]))` (split on `_`) |
| YYYY.MM.DD | `new Date(dateStr.replace(/\./g, "-"))` | `parseLocalDate(Number(parts[0]), Number(parts[1]), Number(parts[2]))` (split on `.`) |
| DD-MM-YYYY (primary) | `` new Date(`${parts[2]}-${parts[1]}-${parts[0]}`) `` | `parseLocalDate(year, Number(parts[1]), Number(parts[0]))` |
| MM-DD-YYYY (fallback) | `` new Date(`${parts[2]}-${parts[0]}-${parts[1]}`) `` | `parseLocalDate(year, Number(parts[0]), Number(parts[1]))` |
| YYYYMMDD | `` new Date(`${year}-${month}-${day}`) `` | `parseLocalDate(year, month, day)` (all Number()) |

## Node REPL Smoke Test (`TZ=America/New_York`)

```
PASS 2026-01-15.md -> 2026-01-15 (expected 2026-01-15)
PASS 15-01-2026.md -> 2026-01-15 (expected 2026-01-15)
PASS 29-01-2026.md -> 2026-01-29 (expected 2026-01-29)
PASS 2026_01_15.md -> 2026-01-15 (expected 2026-01-15)
PASS 20260115.md   -> 2026-01-15 (expected 2026-01-15)
Timezone: America/New_York
All tests passed: true
```

Key confirmation: `parseDateFromFilename("2026-01-15.md").getDate() === 15` under UTC-5 — the off-by-one from issue #59 is resolved.

## Untouched Code Confirmed

- `parseDate()` function (lines 385-416): unchanged
- `today` / `tomorrow` / `yesterday` keyword branches in `parseDate`: unchanged
- `new Date(input)` fallback at line 410 in `parseDate`: unchanged (D-03)
- `formats` array: still has six entries including the duplicate at line 433 (to be removed in plan 03-03 per D-12)
- Import count: unchanged (4 imports)

## Build Verification

- `npx tsc -noEmit`: exit 0
- `npm run build`: exit 0 (esbuild production bundle)

## Commit

- `df66516`: `fix(viewRenderers): construct local-day Date in parseDateFromFilename (BUG-01, #59)`

## Deviations from Plan

None — plan executed exactly as written. The `parseLocalDate` helper was extracted as recommended by D-02/planner note.

## Known Stubs

None.

## Threat Flags

None. Pure refactor of a local date-construction code path — no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- `src/utils/viewRenderers.ts` modified: FOUND
- Commit `df66516` exists: FOUND
- String-form Date constructions in parseDateFromFilename: 0 (verified)
- parseLocalDate call sites in parseDateFromFilename: 6 (verified)
- tsc -noEmit: exit 0
- npm run build: exit 0
