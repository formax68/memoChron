---
phase: 01-foundation
plan: 08
subsystem: parsing
tags: [code-blocks, parsing, embedded-views, wr-02, code-review-gap]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: existing parseAgendaCodeBlock and parseCalendarCodeBlock parsers from prior waves
provides:
  - First-colon-only split in both embedded code-block parsers so values containing colons (titles, ISO datetimes) are preserved verbatim
affects: [embedded-views, code-block-rendering, future code-block param work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-line key/value parsing uses indexOf(':') + substring rather than split(':') to preserve embedded delimiters"

key-files:
  created: []
  modified:
    - src/views/EmbeddedAgendaView.ts
    - src/views/EmbeddedCalendarView.ts

key-decisions:
  - "Replaced split(':') + destructure with indexOf(':') + two substrings to preserve values containing additional colons (titles like 'My Meeting: Q2 Review', ISO datetimes like '2026-05-09T10:30')"
  - "Strengthened the existing 'no colon' guard from `value === undefined` (post-split) to `colonIndex === -1` (pre-split) — same intent, cheaper and more explicit"
  - "Did not touch any switch case body in either parser; the calendars-case comma-split (value.split(',')) is preserved as-is"
  - "One atomic commit covering both files, per plan spec"

patterns-established:
  - "When parsing key:value config lines, use indexOf(':') + substring to preserve values that legitimately contain colons (titles, datetimes, URLs). Avoid plain split(':') destructuring."

requirements-completed: [WR-02-FIX]

# Metrics
duration: ~7 min
completed: 2026-05-09
---

# Phase 01 Plan 08: WR-02 Code-Block Parser Colon-Split Fix Summary

**parseAgendaCodeBlock and parseCalendarCodeBlock now split each config line on the first colon only, preserving titles like "My Meeting: Q2 Review" and ISO datetimes like 2026-05-09T10:30 verbatim.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-09T20:54Z (approx)
- **Completed:** 2026-05-09T21:01:18Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Replaced `line.split(":").map((s) => s.trim())` + `[key, value]` destructure with `line.indexOf(":")` + two `substring` calls in `parseAgendaCodeBlock` (`src/views/EmbeddedAgendaView.ts`)
- Applied the identical fix to `parseCalendarCodeBlock` (`src/views/EmbeddedCalendarView.ts`)
- Preserved every switch-case body (including the calendars-case comma-split) untouched in both parsers
- Strengthened the no-colon guard: skip the line up-front when `colonIndex === -1` instead of relying on `value === undefined` after a malformed split
- Single atomic commit (`bac3d92`) covering both files; commit message contains zero AI/Claude/Anthropic references per CLAUDE.md commit hygiene
- TypeScript type-check (`tsc -noEmit -skipLibCheck`) and esbuild production bundle both exit 0

## Task Commits

All three tasks were combined into a single atomic commit per the plan's explicit spec (Task 3 instructed staging both files together and producing one commit):

1. **Task 1: Replace split(":") with first-colon split in parseAgendaCodeBlock** — included in `bac3d92`
2. **Task 2: Replace split(":") with first-colon split in parseCalendarCodeBlock** — included in `bac3d92`
3. **Task 3: Commit WR-02 fix atomically** — `bac3d92` (fix)

The commit subject is exactly:
`fix(parsing): split code-block params on first colon to preserve values`

## Files Created/Modified
- `src/views/EmbeddedAgendaView.ts` — `parseAgendaCodeBlock` per-line split changed from `split(":")` destructure to `indexOf(":")` + `substring`. All six switch cases (`date`, `days`, `showpast`/`show-past`, `showdailynote`/`show-daily-note`, `title`, `calendars`) and the calendars-case comma-split unchanged.
- `src/views/EmbeddedCalendarView.ts` — `parseCalendarCodeBlock` per-line split changed identically. All four switch cases (`month`, `year`, `showdots`/`show-dots`, `title`) plus the calendars-case comma-split unchanged.

## Decisions Made
- Kept the fix surgical: only the per-line key/value split was edited. Switch bodies, the calendars-case comma-split, function signatures, return types, imports, and all surrounding code remain bit-for-bit identical.
- Replaced the original two-condition guard `if (!key || value === undefined) continue;` with two more explicit guards: `if (colonIndex === -1) continue;` (no colon) followed by `if (!key) continue;` (empty key). This preserves the original semantics — lines with no colon and lines with an empty key both still skip — while making the intent obvious.
- Combined Tasks 1 + 2 + 3 into one atomic commit, as Task 3 explicitly directs staging both files together. No intermediate per-file commits were created.

## Deviations from Plan

None — plan executed exactly as written.

The `value.split(",")` acceptance grep in Task 1 was technically a false negative (the source has the comma-split formatted across multiple lines as `value\n          .split(",")`, so the inline pattern `value.split(",")` does not appear on a single line). Visual inspection of `src/views/EmbeddedAgendaView.ts:446-452` confirms the calendars case is fully preserved with its comma-split intact, satisfying the underlying threat-model criterion (T-08-02). No code change was needed; this is purely a quirk of the multi-line formatting that pre-existed this plan.

## Issues Encountered
- The worktree did not have `node_modules` installed (fresh worktree). Resolved by running `npm ci` once before invoking `tsc` and `esbuild`. Both then passed cleanly.

## Verification

Per the plan's `<verification>` block:

- `grep -n 'line.split(":").map' src/views/EmbeddedAgendaView.ts src/views/EmbeddedCalendarView.ts` → no output (broken split is gone in both parsers).
- `grep -n 'line.indexOf(":")' src/views/EmbeddedAgendaView.ts src/views/EmbeddedCalendarView.ts` → exactly 2 matches, one per file:
  - `src/views/EmbeddedAgendaView.ts:415:    const colonIndex = line.indexOf(":");`
  - `src/views/EmbeddedCalendarView.ts:252:    const colonIndex = line.indexOf(":");`
- `node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck` → exit 0.
- `node esbuild.config.mjs production` → exit 0 (clean production bundle).
- `git log -1 --pretty=format:'%B' | grep -iE 'claude|anthropic|ai-(generated|assist)'` → no match (CLAUDE.md commit hygiene satisfied).
- `git status --short` → empty (working tree clean).
- `git log -1 --name-only` shows exactly two files touched: `src/views/EmbeddedAgendaView.ts` and `src/views/EmbeddedCalendarView.ts`.
- The calendars case's `value.split(",")` is preserved at `src/views/EmbeddedAgendaView.ts:449` and `src/views/EmbeddedCalendarView.ts:281` (multi-line form, behavior identical to before).

## Spot-Check Note for Reviewers

To manually validate WR-02 closure in a sandbox vault, drop the following code blocks into a note and confirm rendering:

````markdown
```memochron-agenda
date: 2026-05-09T10:30
title: My Meeting: Q2 Review
days: 1
showPast: true
```
````

Expected behavior after this fix:
- The agenda's title renders as `My Meeting: Q2 Review` (full string, not truncated to `My Meeting`).
- The `date` parameter is parsed as the ISO datetime `2026-05-09T10:30` (full value, not truncated to `2026-05-09T10`).

Before the fix, both values were silently truncated at the second colon.

## Next Phase Readiness

- WR-02 is closed. The remaining REVIEW.md gaps (CR-01, IN-02, WR-01, WR-03, IN-01) are tracked as separate plans (01-03, 01-04, 01-05/01-06/01-07, 01-09, etc.) per the wave plan.
- No follow-up work introduced by this plan.

## Self-Check: PASSED

- [x] `src/views/EmbeddedAgendaView.ts` exists and contains the new `indexOf(":")` + `substring` parser body
- [x] `src/views/EmbeddedCalendarView.ts` exists and contains the new `indexOf(":")` + `substring` parser body
- [x] Commit `bac3d92` exists in `git log` and touches exactly the two intended files
- [x] TypeScript and esbuild production builds both exit 0
- [x] Commit message contains zero Claude/AI/Anthropic references

---
*Phase: 01-foundation*
*Plan: 08*
*Completed: 2026-05-09*
