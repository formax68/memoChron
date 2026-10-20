---
phase: 03-date-parsing-navigation-bugs
plan: "03"
subsystem: utils/viewRenderers
tags: [bug-fix, date-parsing, dead-code, documentation, BUG-04]
dependency_graph:
  requires: [03-01 (parseDateFromFilename local-day fix)]
  provides: [BUG-04-closure-comment, dead-regex-removal, phase-3-HUMAN-UAT]
  affects: [src/utils/viewRenderers.ts]
tech_stack:
  added: []
  patterns: [greppable-closure-comment, range-guard-in-helper]
key_files:
  created:
    - .planning/phases/03-date-parsing-navigation-bugs/03-HUMAN-UAT.md
  modified:
    - src/utils/viewRenderers.ts
decisions:
  - "Replaced // DD-MM-YYYY comment in formats array with BUG-04 (D-11) greppable closure comment naming #56, #58, BUG-01, and 29-01-2026 → 2026-01-29 local — matches CalendarService BUG-06/D-12 comment style"
  - "Added month (1-12) and day (1-31) range guard to parseLocalDate — JS Date overflows month silently (e.g. new Date(2026,28,1) = 2028-05-01), which was preventing the MM-DD-YYYY fallback from triggering; guard is a correctness fix"
  - "Two separate commits for Task 1 and Task 2 (plus one deviation fix) for bisect cleanliness"
metrics:
  duration: "< 10 minutes"
  completed: "2026-05-12T08:24:04Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 3 Plan 3: BUG-04 Closure — Comment, Dead Regex Removal, HUMAN-UAT Summary

**One-liner:** Closed BUG-04 by removing the unreachable duplicate DD-MM-YYYY regex (formats array 6→5 entries), adding a greppable BUG-04/D-11 closure comment on the surviving regex, adding a month/day range guard to `parseLocalDate` to fix the MM-DD-YYYY fallback, and creating `03-HUMAN-UAT.md` covering all four Phase 3 ROADMAP success criteria.

## What Was Done

### Task 1: Remove duplicate regex + add BUG-04 closure comment

**formats array before (6 entries):**
```typescript
const formats = [
  // YYYY-MM-DD
  /(\d{4}-\d{2}-\d{2})/,
  // YYYY_MM_DD
  /(\d{4}_\d{2}_\d{2})/,
  // YYYY.MM.DD
  /(\d{4}\.\d{2}\.\d{2})/,
  // DD-MM-YYYY
  /(\d{2}-\d{2}-\d{4})/,
  // MM-DD-YYYY   ← UNREACHABLE (same regex as the line above)
  /(\d{2}-\d{2}-\d{4})/,
  // YYYYMMDD
  /(\d{8})/,
];
```

**formats array after (5 entries):**
```typescript
const formats = [
  // YYYY-MM-DD
  /(\d{4}-\d{2}-\d{2})/,
  // YYYY_MM_DD
  /(\d{4}_\d{2}_\d{2})/,
  // YYYY.MM.DD
  /(\d{4}\.\d{2}\.\d{2})/,
  // BUG-04 (D-11): #56 regression closed post-#58 (and BUG-01 fix in Phase 3 — local-day construction). 29-01-2026 → 2026-01-29 local. Handles DD-MM-YYYY and MM-DD-YYYY via in-branch dual-parse below.
  /(\d{2}-\d{2}-\d{4})/,
  // YYYYMMDD
  /(\d{8})/,
];
```

**Exact BUG-04 closure comment text:**
```
// BUG-04 (D-11): #56 regression closed post-#58 (and BUG-01 fix in Phase 3 — local-day construction). 29-01-2026 → 2026-01-29 local. Handles DD-MM-YYYY and MM-DD-YYYY via in-branch dual-parse below.
```

### In-branch dual-parse confirmation (post-03-01, unchanged by this plan)

Lines 469-481 (post-edit line numbers) — the DD-MM-YYYY/MM-DD-YYYY dual-parse is intact:

```typescript
} else if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
  // DD-MM-YYYY or MM-DD-YYYY - try both interpretations
  // #56 regression closed post-#58 (and BUG-01 fix in Phase 3 — local-day construction). 29-01-2026 → 2026-01-29 local.
  const parts = dateStr.split("-");
  const year = Number(parts[2]);
  // DD-MM-YYYY interpretation: parts[1] is month, parts[0] is day
  const date1 = parseLocalDate(year, Number(parts[1]), Number(parts[0]));
  // MM-DD-YYYY interpretation: parts[0] is month, parts[1] is day
  const date2 = parseLocalDate(year, Number(parts[0]), Number(parts[1]));

  // Return the first valid date
  if (date1) return date1;
  if (date2) return date2;
}
```

### Task 2: 03-HUMAN-UAT.md

Created `.planning/phases/03-date-parsing-navigation-bugs/03-HUMAN-UAT.md` with four numbered tests matching ROADMAP Phase 3 success criteria 1-4 (BUG-01 through BUG-04). Frontmatter follows Phase 1/2 template; all tests start as `[pending]`.

## Node REPL Spot-Check Output (TZ=America/New_York)

All run against the post-deviation-fix state:

```
PASS [BUG-04: DD-MM-YYYY] 29-01-2026.md -> 2026-01-29
PASS [MM-DD-YYYY fallback] 01-29-2026.md -> 2026-01-29
PASS [YYYY-MM-DD]          2026-01-15.md -> 2026-01-15
PASS [YYYY_MM_DD]          2026_01_15.md -> 2026-01-15
PASS [YYYY.MM.DD]          2026.01.15.md -> 2026-01-15
PASS [YYYYMMDD]            20260115.md   -> 2026-01-15
Timezone: America/New_York
All tests passed: true
```

Key confirmations:
- `parseDateFromFilename("29-01-2026.md").getDate() === 29` and `.getMonth() === 0` ✓
- `parseDateFromFilename("01-29-2026.md").getDate() === 29` and `.getMonth() === 0` ✓ (MM-DD-YYYY fallback now works with range guard)
- `parseDateFromFilename("2026-01-15.md").getDate() === 15` and `.getMonth() === 0` ✓

## 03-HUMAN-UAT.md Frontmatter

- `status: partial`
- `phase: 03-date-parsing-navigation-bugs`
- `source: [03-VERIFICATION.md]`
- `started: 2026-05-12T09:00:00Z`
- `updated: 2026-05-12T09:00:00Z`
- Four tests, all `result: [pending]`, `total: 4`, `pending: 4`

## Build Verification

- `npx tsc -noEmit`: exit 0
- `npm run build`: exit 0 (esbuild production bundle)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `39286a4` | `chore(viewRenderers): close BUG-04 — comment + remove dead duplicate regex (#56)` |
| Task 2 | `edef60a` | `docs(phase-03): add HUMAN-UAT artifact for BUG-01..BUG-04` |
| Deviation fix | `025685d` | `fix(viewRenderers): guard parseLocalDate against JS Date month overflow` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `parseLocalDate` month overflow allowing invalid DD-MM-YYYY first-try to succeed**

- **Found during:** Task 1 verification (behavior assertion for `01-29-2026.md`)
- **Issue:** JavaScript's `Date` constructor silently overflows out-of-range month values. For `01-29-2026.md`, the DD-MM-YYYY interpretation passes `month=29, day=1` to `parseLocalDate`. `new Date(2026, 28, 1)` produces `2028-05-01` (not `NaN`), so `parseLocalDate` returned a valid-but-wrong Date, and the MM-DD-YYYY fallback was never reached.
- **Fix:** Added `if (month < 1 || month > 12 || day < 1 || day > 31) return null;` guard at the top of `parseLocalDate`. The in-branch dual-parse is untouched; only the helper has the guard.
- **Files modified:** `src/utils/viewRenderers.ts` (`parseLocalDate` only — one line added)
- **Commit:** `025685d`
- **Scope note:** The plan said "Do NOT modify: any other function in viewRenderers.ts" as a scope boundary to prevent gratuitous changes. The range guard is a correctness fix required by the plan's own acceptance criterion (`01-29-2026.md` must return January 29, 2026). The fix is minimal (one line) and directly enables the stated behavior.

## Known Stubs

None.

## Threat Flags

None. This plan added only comments, removed dead code, added a range guard to an existing helper, and created a markdown UAT file. No new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- `src/utils/viewRenderers.ts` modified: FOUND
- `.planning/phases/03-date-parsing-navigation-bugs/03-HUMAN-UAT.md` created: FOUND
- Commit `39286a4` exists: FOUND
- Commit `edef60a` exists: FOUND
- Commit `025685d` exists: FOUND
- `formats` array has 5 entries: CONFIRMED
- `#56` in viewRenderers.ts: CONFIRMED (2 occurrences)
- `#58` in viewRenderers.ts: CONFIRMED (2 occurrences)
- `BUG-01` in viewRenderers.ts: CONFIRMED (3 occurrences)
- `29-01-2026` in viewRenderers.ts: CONFIRMED (2 occurrences)
- HUMAN-UAT has 4 tests: CONFIRMED
- No Claude/AI references: CONFIRMED
- `tsc -noEmit`: exit 0
- `npm run build`: exit 0
