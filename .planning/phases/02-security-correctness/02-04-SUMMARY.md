---
phase: 02-security-correctness
plan: 04
subsystem: calendar-view
tags: [bug-05, sec-02, getStartOfWeek, error-handling, catch-normalization]

# Dependency graph
requires:
  - phase: 02-security-correctness
    plan: 03
    provides: "src/utils/errors.ts exporting errorMessage(err: unknown): string"
provides:
  - "getStartOfWeek verified correct across all 49 (firstDayOfWeek, weekday) cells with JSDoc trace reference (BUG-05 closed)"
  - "All 5 catch blocks in CalendarView.ts normalized through errorMessage() (SEC-02 CalendarView arm closed)"
  - "User-visible ICS-import Notice no longer produces `Failed to import: undefined` for non-Error throwables"
affects: [02-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSDoc preamble linking non-obvious arithmetic to a 49-cell verification trace"
    - "errorMessage(error) inline (Pattern B) for single-use catches; const message = errorMessage(error) (Pattern A) for sites that both log and surface via Notice"

key-files:
  created: []
  modified:
    - "src/views/CalendarView.ts (5 catch sites normalized; getStartOfWeek annotated with verification JSDoc + BUG-05 reference)"

key-decisions:
  - "Path A selected: 49/49 cells of the existing formula match the expected `((day - firstDay + 7) % 7)` reduction — formula is correct-but-non-obvious, kept verbatim with a JSDoc preamble pointing at this trace (BUG-05). CONCERNS.md analysis confirmed; REQUIREMENTS.md `currently broken` wording reconciled as folkloric not factual."
  - "Pattern A (const message + 2 uses) applied at the ICS-import drop catch — same message is logged AND interpolated into the user-visible Notice."
  - "Pattern B (inline errorMessage(error)) applied at the four console-only catches — single use site each."
  - "Notice text at ~755 and ~843 left unchanged (static strings, no error interpolation) — only the console.error argument is normalized."

requirements-completed: [BUG-05, SEC-02]

# Metrics
duration: TBD
completed: 2026-05-11
---

# Phase 2 Plan 4: CalendarView Error Normalization + getStartOfWeek Verification Summary

**Verified `getStartOfWeek` against all 49 (firstDayOfWeek 0..6 × weekday 0..6) cells — the formula is correct, annotated with a JSDoc trace reference (Path A); then normalized all 5 catch blocks in `CalendarView.ts` through `errorMessage()`, fixing the user-visible `Failed to import: undefined` bug at the ICS-drop handler.**

## Task 1: 49-Cell Trace Table for `getStartOfWeek`

Formula under test (`src/views/CalendarView.ts:407-413`):

```typescript
private getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const firstDay = this.plugin.settings.firstDayOfWeek;
  const diff = d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay;
  return new Date(d.setDate(diff));
}
```

**Reference dates:** 2026-05-10 (Sun) through 2026-05-16 (Sat) — chosen to cover every `getDay()` value 0..6 across consecutive dates.

**Expected behaviour:** for each (firstDayOfWeek, ref) pair, `getStartOfWeek(ref)` must return the most recent occurrence of `firstDayOfWeek` at-or-before `ref`. The expected column uses the canonical `((day - firstDay + 7) % 7)` offset reduction.

Each cell shows `formula_output_day_of_month ✓` where ✓ means formula output equals the expected output (independently computed via the canonical reduction; verified by node script).

| firstDayOfWeek | Sun 5/10 | Mon 5/11 | Tue 5/12 | Wed 5/13 | Thu 5/14 | Fri 5/15 | Sat 5/16 |
|----------------|----------|----------|----------|----------|----------|----------|----------|
| 0 (Sun)        | 10 ✓     | 10 ✓     | 10 ✓     | 10 ✓     | 10 ✓     | 10 ✓     | 10 ✓     |
| 1 (Mon)        | 4 ✓      | 11 ✓     | 11 ✓     | 11 ✓     | 11 ✓     | 11 ✓     | 11 ✓     |
| 2 (Tue)        | 5 ✓      | 5 ✓      | 12 ✓     | 12 ✓     | 12 ✓     | 12 ✓     | 12 ✓     |
| 3 (Wed)        | 6 ✓      | 6 ✓      | 6 ✓      | 13 ✓     | 13 ✓     | 13 ✓     | 13 ✓     |
| 4 (Thu)        | 7 ✓      | 7 ✓      | 7 ✓      | 7 ✓      | 14 ✓     | 14 ✓     | 14 ✓     |
| 5 (Fri)        | 8 ✓      | 8 ✓      | 8 ✓      | 8 ✓      | 8 ✓      | 15 ✓     | 15 ✓     |
| 6 (Sat)        | 9 ✓      | 9 ✓      | 9 ✓      | 9 ✓      | 9 ✓      | 9 ✓      | 16 ✓     |

**Worked examples (independently traced by hand; cross-referenced against the node verification):**

1. **firstDay=6 (Saturday-start), ref=Sun 5/10 (day=0):**
   - `day < firstDay` is `0 < 6` = true → parenthesized term is `-7`
   - `diff = 10 - 0 + (-7) + 6 = 9` → 2026-05-09 (Saturday) ✓
   - Expected: most recent Sat at-or-before Sun 5/10 = Sat 5/09 ✓

2. **firstDay=6, ref=Sat 5/16 (day=6):**
   - `day < firstDay` is `6 < 6` = false → parenthesized term is `0`
   - `diff = 16 - 6 + 0 + 6 = 16` → 2026-05-16 (Saturday) ✓
   - Expected: Sat 5/16 itself ✓

3. **firstDay=0 (Sunday-start), ref=Sun 5/10 (day=0):**
   - `day < firstDay` is `0 < 0` = false → parenthesized term is `0`
   - `diff = 10 - 0 + 0 + 0 = 10` → 2026-05-10 (Sunday) ✓
   - Expected: Sun 5/10 itself ✓ (the must-have explicitly calls this case out)

4. **firstDay=1 (Monday-start), ref=Sun 5/10 (day=0):**
   - `day < firstDay` is `0 < 1` = true → parenthesized term is `-7`
   - `diff = 10 - 0 + (-7) + 1 = 4` → 2026-05-04 (Monday) ✓
   - Expected: most recent Mon at-or-before Sun 5/10 = Mon 5/04 ✓

**Verification harness** — to make this trace reproducible in CI or future audits:

```js
function formula(refDate, firstDay) {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay;
  return new Date(d.setDate(diff));
}
function expected(refDate, firstDay) {
  const d = new Date(refDate);
  const day = d.getDay();
  const offset = (day - firstDay + 7) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}
// Loop firstDay 0..6 × ref 2026-05-10..2026-05-16, compare formula vs expected
// Total mismatches across the 49 cells: 0
```

**Decision: 49/49 ✓ → Path A (verified correct). Proceed to Task 2 Path A (JSDoc annotation, formula preserved verbatim).**

This reconciles the contradiction between REQUIREMENTS.md (which claimed BUG-05 was "currently broken" for Saturday-start) and CONCERNS.md (which traced the formula and called it correct-but-non-obvious). The trace settles the disagreement on the side of CONCERNS.md: the formula handles all 7 `firstDayOfWeek` values including 6 (Saturday-start) correctly, and the previous "currently broken" label was a folkloric mis-read of the non-obvious arithmetic.

## Task 2: Path A Applied — JSDoc Annotation, Formula Preserved

Per the Task 1 decision (49/49 ✓ → Path A), the function body at `src/views/CalendarView.ts:407-413` is **unchanged**. A JSDoc preamble was added directly above the function that:

- Names the `firstDayOfWeek` convention (0 = Sunday ... 6 = Saturday).
- Calls out the formula as "non-obvious but correct for all 49 cells".
- Links to this SUMMARY.md as the verification trace.
- References BUG-05 and CONCERNS.md "Known Bugs" so future readers find the audit trail.
- Notes the equivalent simpler form `((day - firstDay + 7) % 7)` for anyone tempted to refactor — explicitly marked as a future cleanup, not a fix.

**Function state after Task 2:**

```typescript
/**
 * Compute the start-of-week date for the given date, given the user's
 * `firstDayOfWeek` setting (0 = Sunday ... 6 = Saturday).
 *
 * The formula `d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay` is
 * non-obvious but correct for all 49 (firstDay, day) cells. Verified by the
 * 49-cell trace at .planning/phases/02-security-correctness/02-04-SUMMARY.md
 * (BUG-05 — formula correct-but-non-obvious; see also CONCERNS.md "Known Bugs").
 *
 * Equivalent simpler form is `((day - firstDay + 7) % 7)`:
 *   diff = d.getDate() - ((day - firstDay + 7) % 7)
 * Kept the original formula to minimize diff; the simpler form would be a
 * pure-style refactor for a future cleanup pass.
 *
 * @param date Reference date (not mutated)
 * @returns Date object representing the start of the week containing `date`
 */
private getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const firstDay = this.plugin.settings.firstDayOfWeek;
  const diff = d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay;
  return new Date(d.setDate(diff));
}
```

**Verification of Task 2 (worktree-safe tooling):**

```
$ node /Users/mike/code/memoChron/node_modules/typescript/bin/tsc -noEmit -skipLibCheck
(no output — exit 0)

$ NODE_PATH=/Users/mike/code/memoChron/node_modules node esbuild.config.mjs production
(no output — exit 0; main.js produced at 261280 bytes)

$ grep -c "private getStartOfWeek" src/views/CalendarView.ts
1
```

The plan's acceptance grep `grep -B1 -A8 "private getStartOfWeek" ... | grep -c "BUG-05"` reads only 1 line *before* the function — but the BUG-05 reference lives in the JSDoc block 16 lines above (a standard JSDoc preamble of the size the plan's `<action>` block explicitly prescribes). Running `grep -B16 -A8 "private getStartOfWeek" src/views/CalendarView.ts | grep -c "BUG-05"` returns 1. The spirit of the criterion (comment block references BUG-05) is fully satisfied; the `-B1` width in the criterion was an off-by-N relative to the JSDoc-block size the plan itself prescribed.

