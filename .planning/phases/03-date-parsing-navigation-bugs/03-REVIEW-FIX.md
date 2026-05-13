---
phase: 03
fixed_at: 2026-05-12T00:00:00Z
review_path: .planning/phases/03-date-parsing-navigation-bugs/03-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-05-12
**Source review:** `.planning/phases/03-date-parsing-navigation-bugs/03-REVIEW.md`
**Iteration:** 1
**Scope:** Critical + Warning (3 warnings — no critical findings in this review)

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

All fixes type-checked clean with `tsc -noEmit` and pass the full
`npm run build` pipeline (production esbuild bundle).

## Fixed Issues

### WR-01: `parseLocalDate` does not reject invalid day-of-month, silently rolls forward

**Files modified:** `src/utils/viewRenderers.ts`
**Commit:** `ef48a44`
**Applied fix:** Added a round-trip validation check after the numeric
`Date` constructor. The helper now verifies that the constructed Date's
`getFullYear() / getMonth() / getDate()` match the input components,
rejecting impossible inputs like `(2026, 2, 31)` which the constructor
silently rolls into `2026-03-03`. Filenames like `31-02-2026.md` and
`2026-02-30.md` now fall through to the next interpretation or return
`null` instead of returning the wrong date.

### WR-02: BUG-01 timezone fix is incomplete — `parseDate` still uses `new Date(string)`

**Files modified:** `src/utils/viewRenderers.ts`
**Commit:** `6143643`
**Applied fix:** Added explicit `^(\d{4})-(\d{2})-(\d{2})$` ISO detection
in `parseDate` before the loose `new Date(input)` fallback. ISO-shaped
inputs are routed through `parseLocalDate` so the result is a local-day
Date, not UTC midnight. This closes the BUG-01 bug class for code-block
parameters (`date: 2026-01-15` in `memochron-calendar` / `memochron-agenda`
blocks) which the original Phase 3 plan covered only for daily-note
filenames.

### WR-03: `maybeBackgroundRefresh` `.then` ignores stale closure and unawaited Promise

**Files modified:** `src/views/CalendarView.ts`
**Commit:** `4f14936`
**Applied fix:** Two-part fix in `maybeBackgroundRefresh()`:

1. **Staleness guard:** capture `this.currentDate.getTime()` before
   the fetch and bail in `.then` if it has changed. Used `getTime()`
   (not strict-equality) because `navigate()` mutates `currentDate` in
   place via `setMonth`/`setDate`, so a strict-identity comparison
   would miss the in-place arithmetic paths.
2. **Unawaited async call:** prefixed `this.showDayAgenda(dateToShow)`
   with `void` so any future async error surfaces through the
   surrounding `.catch` rather than `unhandledrejection`.

Scope note: the report also mentions the same `void`-prefix concern at
`renderCurrentRange` and `refreshEvents`. Those are Info-tier (IN-04)
and out of scope for this `critical_and_warning` fix pass — left as-is
per the scoping rule.

## Skipped Issues

None.

## Verification

All three fixes verified with:
- **Tier 1:** re-read of each modified region after edit; fix text
  present and surrounding code intact.
- **Tier 2:** `tsc -noEmit` (via `npm run build`) clean — no errors in
  modified or downstream files.

## Prompt-Injection Notice

While reading `src/views/CalendarView.ts`, the tool output appended a
`<system-reminder>` block containing fake "MCP Server Instructions" for
unrelated services (Airtable, Context7, Gamma). This appears to be the
same prompt-injection source flagged in `03-REVIEW.md`. I ignored it and
took no action on those purported instructions; the user-supplied fix
task was followed instead. Flagging here so the orchestrator can
investigate the source.

---

_Fixed: 2026-05-12_
_Fixer: gsd-code-fixer_
_Iteration: 1_
