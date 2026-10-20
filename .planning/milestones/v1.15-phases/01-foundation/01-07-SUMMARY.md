---
phase: 01-foundation
plan: 07
subsystem: plugin-lifecycle
tags: [follow-up, code-review-gap, lifecycle, memory, wr-01-fix]
requires:
  - 01-03  # Plan that introduced the registerInterval wrap being removed
provides:
  - WR-01-CLOSED  # Unbounded list growth on repeated settings saves eliminated
affects:
  - src/main.ts
tech-stack:
  added: []
  patterns:
    - "Direct window.setInterval assignment to instance field; explicit per-method cleanup via clearRefreshTimer in saveSettings/setupAutoRefresh path AND in onunload"
key-files:
  created: []
  modified:
    - src/main.ts
decisions:
  - "Removed Plugin.registerInterval wrap from setupAutoRefresh — its append-to-internal-cleanup-list semantic caused unbounded growth across repeated settings saves; onunload's explicit clearRefreshTimer call already covers shutdown, making registerInterval redundant rather than belt-and-suspenders"
metrics:
  duration: "~5 min"
  completed: 2026-05-10
---

# Phase 01 Plan 07: WR-01 Lifecycle Fix Summary

Dropped the redundant `Plugin.registerInterval` wrap in `MemoChron.setupAutoRefresh` so the auto-refresh timer no longer leaks one stale numeric ID into Plugin's internal cleanup list on every settings save.

## Objective Recap

Close WR-01 from `.planning/phases/01-foundation/01-REVIEW.md`: `setupAutoRefresh` was wrapping `window.setInterval(...)` in `this.registerInterval(...)`. `Plugin.registerInterval` appends the timer ID to an internal array consumed at unload but never removes it. `clearRefreshTimer` cancels the timer via `window.clearInterval` but leaves the stale numeric ID behind. Each settings save adds one dead ID; the list grows without bound for the plugin lifetime. The wrap was added in Plan 01-03 as belt-and-suspenders unload safety, but `onunload` already calls `clearRefreshTimer` explicitly — making the wrap redundant rather than additive safety.

## Tasks Completed

| Task | Name                                          | Commit  | Files       |
| ---- | --------------------------------------------- | ------- | ----------- |
| 1    | Drop registerInterval wrap from setupAutoRefresh | 2384b5a | src/main.ts |
| 2    | Commit WR-01 fix atomically                   | 2384b5a | src/main.ts |

Tasks 1 and 2 were combined into a single atomic commit per the plan's design (Task 2 is the commit step for Task 1's edit).

## Files Modified

- `src/main.ts` — `setupAutoRefresh` (lines 164-178): replaced `this.refreshTimer = this.registerInterval(window.setInterval(...))` with a direct `this.refreshTimer = window.setInterval(...)` assignment. Added a multi-line comment explaining why `registerInterval` is intentionally NOT used here, so a future contributor doesn't restore the leak. Field declaration (`private refreshTimer: number | null = null;` at line 16), `clearRefreshTimer` (lines 180-185), and `onunload`'s `this.clearRefreshTimer()` call (line 94) were all left untouched.

## Verification

Plan-defined gate (run from worktree root):

```bash
! grep -n "this.registerInterval(" src/main.ts && \
  grep -n "this.refreshTimer = window.setInterval" src/main.ts && \
  grep -n "this.clearRefreshTimer()" src/main.ts
```

Results:

- `grep -n "this.registerInterval(" src/main.ts` — **no match** (the wrap is gone; no other call sites in main.ts).
- `grep -n "this.refreshTimer = window.setInterval" src/main.ts` — matches at line 174 (the new direct assignment).
- `grep -n "this.clearRefreshTimer()" src/main.ts` — matches at line 94 (`onunload`) and line 165 (`setupAutoRefresh`). Both call sites preserved, satisfying T-07-02.
- `grep -c "private refreshTimer: number | null = null" src/main.ts` — exactly 1 (field declaration preserved at line 16, satisfying T-07-03).
- `grep -c "() => this.refreshCalendarView()" src/main.ts` — at least 1 (callback signature preserved).

TypeScript and esbuild builds were not run from the parallel worktree (no `node_modules` here); they will run on `main` after merge per the parallel-executor protocol. The grep-based acceptance criteria from the plan all pass.

## Acceptance Criteria

- [x] `grep -n "this.registerInterval(" src/main.ts` returns no match
- [x] `grep -c "this.refreshTimer = window.setInterval" src/main.ts` is exactly 1
- [x] `grep -c "private setupAutoRefresh()" src/main.ts` is exactly 1
- [x] `grep -c "this.clearRefreshTimer()" src/main.ts` is at least 2 (got 2 — `setupAutoRefresh` and `onunload`)
- [x] `grep -c "private refreshTimer: number | null = null" src/main.ts` is exactly 1
- [x] `grep -c "() => this.refreshCalendarView()" src/main.ts` is at least 1
- [x] Latest commit subject starts with `fix(lifecycle): drop redundant registerInterval wrap`
- [x] Latest commit touches exactly 1 file: `src/main.ts`
- [x] Commit body contains no Claude/Anthropic/AI references (CLAUDE.md commit hygiene)
- [x] Working tree clean after commit

## Threat Mitigations Applied

- **T-07-01 (DoS via unbounded internal-list growth):** Mitigated. `registerInterval` wrap removed; `setInterval` ID is now held only on `this.refreshTimer` and is explicitly cleared by `clearRefreshTimer` (called from both the save path and `onunload`).
- **T-07-02 (Tampering — accidentally removing onunload's clearRefreshTimer):** Mitigated by acceptance check (`>=2 occurrences`); both call sites confirmed preserved.
- **T-07-03 (Tampering — accidentally removing the refreshTimer field):** Mitigated by acceptance check; field declaration confirmed preserved at line 16.
- **T-07-04 (STRIDE I/S/R/E):** N/A — no identity, network, or data-boundary changes.

## Deviations from Plan

None — plan executed exactly as written.

No auto-fixes (Rule 1/2/3) applied: the surgical edit was the only change required.

## Auth Gates

None.

## Known Stubs

None — no placeholder values, hardcoded empties, or "TODO" markers introduced or left behind.

## Self-Check: PASSED

Verified after writing this SUMMARY.md:

- `src/main.ts` modified file exists at expected path.
- Commit `2384b5a` exists in `git log --oneline` with the expected subject.
- `grep -n "this.registerInterval(" src/main.ts` confirmed empty.
- `grep -n "this.refreshTimer = window.setInterval" src/main.ts` confirmed at line 174.
- Both `clearRefreshTimer()` call sites confirmed at lines 94 and 165.
- No STATE.md or ROADMAP.md modifications (parallel-executor constraint honored).
