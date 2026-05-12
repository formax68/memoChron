---
phase: 03-date-parsing-navigation-bugs
verified: 2026-05-12T10:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "BUG-01 runtime: daily-note filename in non-UTC timezone selects the correct local day"
    expected: "In America/New_York (UTC-5), clicking 2026-01-15.md in the file explorer highlights January 15 in the calendar grid — not January 14"
    why_human: "Timezone-dependent runtime behavior; the code path is correct but the fix can only be confirmed by running Obsidian with TZ=America/New_York"
  - test: "BUG-02 runtime: navigation arrows repaint instantly"
    expected: "Clicking next-month/next-week ten times rapidly shows immediate grid repaint with no perceptible pause; DevTools network panel shows at most one fetch, not ten"
    why_human: "Responsiveness is a perceptual UX criterion; static analysis confirms no await on hot path but perceived latency requires live Obsidian testing"
  - test: "BUG-03 runtime: Today button recenters across all view modes after drag-resize"
    expected: "After drag-resize to 1-week mode and navigating away, clicking Today shows today's week; view-mode dropdown still reads Week"
    why_human: "Drag-resize interaction and Today-button recentering require live Obsidian with a resizable calendar pane; cannot be verified programmatically"
---

# Phase 3: Date Parsing & Navigation Bugs Verification Report

**Phase Goal:** Daily-note filenames in non-UTC timezones map to the correct local calendar day, month/week navigation feels immediate, the drag-resize view-mode sync is correct, and the BUG-04 date-parsing edge case is confirmed closed — clearing the prerequisite for all Phase 4 enhancements
**Verified:** 2026-05-12T10:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A daily note named `2026-01-15.md` in a vault used in Montreal (UTC-5) shows events for January 15 — not January 14 | ? HUMAN NEEDED | `parseDateFromFilename` verified to use numeric constructor via `parseLocalDate(year, month-1, day)` in all 6 branches. Node REPL smoke test in SUMMARY confirmed `getDate()===15` under `TZ=America/New_York`. Runtime Obsidian confirmation required. |
| 2 | Clicking next-month or next-week arrow feels instantaneous; no perceptible delay | ? HUMAN NEEDED | `navigate(delta)` is synchronous (`: void`), calls `renderCurrentRange()` then `maybeBackgroundRefresh()` — no await on hot path. Runtime perceptual confirmation required. |
| 3 | After drag-resize from month-height to week-height, view-mode dropdown reads "Week" and Today scrolls to current week | ? HUMAN NEEDED | `goToToday()` unconditionally sets `this.currentDate = today`; `isSameMonth` short-circuit removed; `viewMode` not modified; `showViewMenu` reads live `viewMode` via `setChecked`. Runtime drag-resize test required. |
| 4 | `29-01-2026` parses to 29 January 2026 (not 20 January 2029) — confirmed and documented | ✓ VERIFIED | `parseLocalDate` range guard prevents JS Date month overflow; dual-parse returns January 29, 2026 for DD-MM-YYYY branch; BUG-04 comment with `#56`, `#58`, `BUG-01`, and `29-01-2026 → 2026-01-29 local` exists in `viewRenderers.ts:441`; Node REPL confirmed. |

**Score:** 4/4 truths have correct code implementation. Truths 1-3 need runtime confirmation (human_needed per Step 9 decision tree).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/viewRenderers.ts` | `parseDateFromFilename` with local-day Date construction in all six format branches | ✓ VERIFIED | `parseLocalDate` helper at line 423 uses `new Date(year, month - 1, day)` with range guard. All 6 branches use it. Zero string-form Date constructions inside `parseDateFromFilename`. `new Date(input)` fallback in `parseDate` (line 410) preserved per D-03. |
| `src/utils/viewRenderers.ts` | Five-entry formats array and BUG-04 closure comment | ✓ VERIFIED | `formats` array has exactly 5 entries (down from 6). Comment at line 441 names `#56`, `#58`, `BUG-01`, and `29-01-2026 → 2026-01-29 local`. |
| `src/views/CalendarView.ts` | Synchronous `navigate(delta)` + `maybeBackgroundRefresh` helper + synchronous `goToToday()` | ✓ VERIFIED | `navigate` at line 340: `private navigate(delta: number): void`, calls `renderCurrentRange()` and `maybeBackgroundRefresh()`. `goToToday` at line 357: `goToToday(): void`, always sets `currentDate = today`, no `viewMode` mutation. `maybeBackgroundRefresh` at line 314: fire-and-forget with `void` prefix, `.catch` uses `errorMessage(error)`. |
| `.planning/phases/03-date-parsing-navigation-bugs/03-HUMAN-UAT.md` | Human verification artifact covering all four Phase 3 ROADMAP success criteria | ✓ VERIFIED | File exists with `status: partial`, four numbered tests (BUG-01 through BUG-04), all `result: [pending]`, `total: 4`, `pending: 4`. Matches Phase 1/2 template shape. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `viewRenderers.ts parseDateFromFilename` | JS Date local-day construction | `parseLocalDate` helper (numeric constructor) | ✓ WIRED | `parseLocalDate` called at lines 456, 461, 466, 474, 476, 486 — all 6 format branches |
| `CalendarView.ts navigate` | In-memory event cache | `renderCurrentRange()` synchronous render | ✓ WIRED | Line 350: `this.renderCurrentRange()` called before `maybeBackgroundRefresh()` |
| `CalendarView.ts goToToday` | Synchronous render path | `this.currentDate = today; this.renderCalendar(); this.selectDate(today)` | ✓ WIRED | Lines 364, 372-373; no async, no `isSameMonth` guard |
| `CalendarView.ts maybeBackgroundRefresh` | `CalendarService.fetchCalendars` dedup gate | `void this.plugin.calendarService.fetchCalendars(..., false)` | ✓ WIRED | Line 320-321; `.catch` uses `errorMessage(error)` with `"MemoChron: background refresh failed:"` prefix |
| `viewRenderers.ts` BUG-04 comment | Issue tracker (#56, #58, BUG-01) | Greppable single-line comment | ✓ WIRED | Line 441: comment contains `#56`, `#58`, `BUG-01`, `29-01-2026 → 2026-01-29 local` |

### Data-Flow Trace (Level 4)

Not applicable — this phase fixes date parsing logic and control flow. No new data sources or rendering pipelines introduced.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| BUG-04: `29-01-2026.md` parses to January 29, 2026 | Node inline eval of `parseDateFromFilename` logic | `2026-1-29`, PASS: true | ✓ PASS |
| `parseDateFromFilename` has zero string-form Date constructions | `awk '/^function parseDateFromFilename/,/^\}/' src/utils/viewRenderers.ts \| grep 'new Date("' \| wc -l` | `0` | ✓ PASS |
| `formats` array has exactly 5 entries | `awk '/const formats = \[/,/\];/' src/utils/viewRenderers.ts \| grep -cE '^\s+/\('` | `5` | ✓ PASS |
| `navigate` is not async | `grep -c 'private async navigate' src/views/CalendarView.ts` | `0` | ✓ PASS |
| `goToToday` is not async | `grep -c 'async goToToday' src/views/CalendarView.ts` | `0` | ✓ PASS |
| `isSameMonth` helper removed | `grep -c 'isSameMonth' src/views/CalendarView.ts` | `1` (comment only, no method declaration) | ✓ PASS |
| `refreshEvents` preserved for explicit callers | `grep -c 'async refreshEvents(forceRefresh = false)' src/views/CalendarView.ts` | `1` | ✓ PASS |
| `layout-change` still calls `refreshEvents` | `grep -n 'layout-change' src/views/CalendarView.ts` | Line 304, calls `refreshEvents` | ✓ PASS |
| `tsc -noEmit` exits 0 | `npx tsc -noEmit 2>&1` | Clean (no output) | ✓ PASS |
| `npm run build` exits 0 | `npm run build 2>&1` | Clean build | ✓ PASS |

### Probe Execution

No probe scripts declared or found for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BUG-01 | 03-01-PLAN.md | Daily-note filename parsed to correct local calendar day (not UTC midnight) | ✓ SATISFIED | `parseLocalDate` helper uses numeric Date constructor; all 6 branches converted; REPL smoke test passed under TZ=America/New_York; commit `df66516` |
| BUG-02 | 03-02-PLAN.md | Month/week navigation arrows feel responsive | ✓ SATISFIED (code) | `navigate(delta)` synchronous, renders from cache, background fetch deduped via `fetchInFlight`; commit `a5a3d25`. Runtime UX verification: human_needed |
| BUG-03 | 03-02-PLAN.md | After drag-resize, dropdown reflects current mode and Today navigates to correct week | ✓ SATISFIED (code) | `goToToday()` unconditionally recenters; `isSameMonth` short-circuit removed; `showViewMenu` reads live `viewMode` via `setChecked`; commit `e024320`. Runtime verification: human_needed |
| BUG-04 | 03-03-PLAN.md | `29-01-2026` parses to 29 January 2026 — confirmed and documented | ✓ SATISFIED | Range guard in `parseLocalDate` prevents month overflow; BUG-04 closure comment with greppable references; commits `39286a4` + `025685d` |

All four requirements explicitly mapped to Phase 3 in REQUIREMENTS.md traceability table are covered by the three plans and verified above.

**No orphaned requirements:** REQUIREMENTS.md maps BUG-01, BUG-02, BUG-03, BUG-04 to Phase 3. All four are claimed by plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TBD/FIXME/XXX markers found in any of the three modified files (`viewRenderers.ts`, `CalendarView.ts`, `main.ts`) |

### Human Verification Required

#### 1. BUG-01 Runtime: Timezone-correct daily note selection

**Test:** In Obsidian running in a timezone west of UTC (e.g. `America/New_York`, UTC-5), locate or create a daily note named `2026-01-15.md`. Click it in the file explorer. Observe the MemoChron calendar and agenda pane.
**Expected:** The calendar grid highlights January 15, 2026; the agenda pane shows events for January 15 — not January 14. Repeat with `2026-06-15.md` (DST boundary) and confirm June 15 is selected.
**Why human:** Timezone-dependent runtime behavior. The code path is verified correct via static analysis and Node REPL smoke test, but the regression only manifests in a live Obsidian session running in a non-UTC timezone.

#### 2. BUG-02 Runtime: Navigation arrow responsiveness

**Test:** With at least one iCal source configured and the calendar pane in month-mode, open Obsidian DevTools (Ctrl+Shift+I / Cmd+Option+I). Click the next-month arrow ten times in rapid succession. Watch the calendar grid repaint and the network panel.
**Expected:** Each click repaints the grid immediately with no spinner or perceptible pause. The network panel shows at most one outbound calendar fetch (not ten) — confirming the Phase 2 `fetchInFlight` dedup is collapsing concurrent triggers. Repeat in 1-week mode.
**Why human:** Responsiveness is a perceptual UX criterion. Static analysis confirms the synchronous render path (no `await` on the hot path), but perceived latency requires a live Obsidian test on the target hardware.

#### 3. BUG-03 Runtime: Today button recentering after drag-resize

**Test:** Open the calendar pane in month-mode. Drag the resize handle upward until the calendar collapses to 1-week mode (the view-mode dropdown should read "Week"). Click the next-week arrow several times until today is not visible. Click the Today button.
**Expected:** The calendar repaints with today's week visible; today's cell is selected; the view-mode dropdown still reads "Week" (mode did not change). Repeat in 2-week mode.
**Why human:** The drag-resize interaction and Today-button recentering require a resizable calendar pane in a live Obsidian instance. The code fixes are verified correct (unconditional `currentDate = today`, no `isSameMonth` guard, `viewMode` unchanged), but the behavior cannot be demonstrated programmatically.

### Gaps Summary

No blockers found. All four Phase 3 requirements (BUG-01 through BUG-04) have correct code implementations verified via static analysis and Node spot-checks. Three of the four ROADMAP success criteria (SC-1, SC-2, SC-3) involve runtime/UX behavior that requires live Obsidian testing — these are documented in the `03-HUMAN-UAT.md` artifact and in the human verification section above. SC-4 (BUG-04 date parsing) is fully verifiable statically and confirmed.

The phase is complete from a code-correctness standpoint. Status is `human_needed` because the ROADMAP success criteria for SC-1 through SC-3 cannot be confirmed without running Obsidian in the target timezone configurations.

---

_Verified: 2026-05-12T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
