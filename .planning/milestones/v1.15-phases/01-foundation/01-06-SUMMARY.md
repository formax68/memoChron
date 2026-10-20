---
phase: 01-foundation
plan: 06
subsystem: lifecycle
tags: [follow-up, code-review-gap, lifecycle, mobile-safety]
requires:
  - "01-03 (CalendarService.scheduleBackgroundRefresh introduced the background-refresh wrap that CR-01 flags)"
  - "01-04 (CalendarView.onClose drag-listener teardown — D-09 invariant preserved here)"
provides:
  - "Plugin-owned backgroundRefreshTimer cleared with window.clearTimeout in onunload"
  - "View-owned startupTimer cleared with window.clearTimeout in onClose"
  - "Closure of CR-01 (CRITICAL, plugin-level) and IN-02 (info-level, view-level) from 01-REVIEW.md"
  - "Code-level closure of the residual iOS WKWebView risk documented in 01-VERIFICATION.md and the pending UAT in 01-HUMAN-UAT.md"
affects:
  - "iOS / WKWebView and Android WebView users on rapid plugin disable / leaf close"
tech-stack:
  added: []
  patterns:
    - "Owned-handle pattern: store the setTimeout return value on the owning Component, cancel with the matching window.clearTimeout in the matching teardown method"
    - "Plugin-mediated timer ownership: services without their own Component delegate timer registration up to the plugin via a setter helper"
key-files:
  created: []
  modified:
    - src/main.ts
    - src/services/CalendarService.ts
    - src/views/CalendarView.ts
decisions:
  - "Merge CR-01 and IN-02 into one plan because they share the same root cause (setTimeout handle passed to an API that internally calls clearInterval) and the same fix pattern (own the handle, clear with the matching window.clearTimeout)"
  - "Move CR-01 timer ownership from CalendarService to MemoChron because CalendarService is not a Component and has no native unload hook; MemoChron's onunload already runs explicit cleanup"
  - "Keep IN-02 timer ownership inside CalendarView because CalendarView IS a Component (extends ItemView) and already has an onClose teardown path"
  - "Land CR-01 + IN-02 in a single atomic commit per plan objective; cumulative gates verify all invariants after Tasks 1-3 land"
metrics:
  duration_min: 5
  completed_at: "2026-05-10T04:08:42Z"
  tasks_completed: 5
  files_changed: 3
---

# Phase 01 Plan 06: CR-01 + IN-02 Lifecycle-Timer Closure Summary

One-liner: Move the 100ms CalendarService background-refresh timer and the 50ms CalendarView startup timer from `registerInterval(setTimeout-id)` to owned-handle fields cleared with the matching `window.clearTimeout` — closes the iOS WKWebView API mismatch flagged as CR-01 (CRITICAL) and IN-02 (info) in 01-REVIEW.md.

## Files modified

| File                              | Change                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`                     | Add `private backgroundRefreshTimer`, public `setBackgroundRefreshTimer()` setter, private `clearBackgroundRefreshTimer()` helper, and call the helper from `onunload`. |
| `src/services/CalendarService.ts` | `scheduleBackgroundRefresh` now calls `this.plugin.setBackgroundRefreshTimer(callback, 100)` instead of `this.plugin.registerInterval(window.setTimeout(...))`. |
| `src/views/CalendarView.ts`       | Add `private startupTimer`, store the 50ms setTimeout handle on it in `onOpen`, null it inside the callback, and clear it with `window.clearTimeout` in `onClose` as a sibling step to the existing isDragging-guarded block. |

## Commit

| SHA       | Subject                                                                              |
| --------- | ------------------------------------------------------------------------------------ |
| `0aecc0e` | `fix(lifecycle): own one-shot setTimeout handles and clear with clearTimeout`        |

Full SHA: `0aecc0eceee75b41d4dda63dbb9cbc571b566544`

## Task 4 cumulative invariant gates — actual output

Build gates (TypeScript and esbuild) cannot be run in this parallel-executor worktree — `node_modules` is not installed inside the worktree per the orchestrator's parallel-execution contract. They are run on `main` after merge. All grep-based invariants from Task 4 were executed and pass:

| # | Gate                                                                              | Expected     | Actual       | Result |
| - | --------------------------------------------------------------------------------- | ------------ | ------------ | ------ |
| 1 | `grep -n "registerInterval(window.setTimeout" src/services/CalendarService.ts`    | NO match     | no match     | PASS   |
| 2 | `grep -n "clearTimeout" src/main.ts`                                              | ≥ 1 match    | 3 matches (1 doc comment + 2 call sites in setter and clearBackgroundRefreshTimer) | PASS |
| 3 | `grep -n "private backgroundRefreshTimer: number \| null = null" src/main.ts`     | 1 match      | 1 (line 17)  | PASS   |
| 4 | `grep -n "this.clearBackgroundRefreshTimer()" src/main.ts`                        | onunload site present (plan: ≥1, ideally 2) | 1 (line 95, in onunload) | PASS — onunload site present, which is the hard requirement per Task 4 Gate 4 wording ("At minimum the onunload site MUST be present"). The setter pre-clear path uses inline `window.clearTimeout(this.backgroundRefreshTimer)` exactly as the plan code in Task 1 specified. |
| 5 | `grep -n "this.plugin.setBackgroundRefreshTimer(" src/services/CalendarService.ts` | 1 match     | 1 (line 189) | PASS   |
| 6 | `grep -n "this.registerInterval(" src/views/CalendarView.ts`                      | NO match     | no match     | PASS   |
| 7 | `grep -n "private startupTimer: number \| null = null" src/views/CalendarView.ts` | 1 match      | 1 (line 33)  | PASS   |
| 8 | `grep -n "window.clearTimeout(this.startupTimer)" src/views/CalendarView.ts`      | 1 match      | 1 (line 60)  | PASS   |
| 9 | `grep -c "if (this.isDragging)" src/views/CalendarView.ts`                        | ≥ 1          | 1            | PASS   |
| 10 | `tsc -noEmit && esbuild production`                                              | exit 0       | deferred to post-merge build on main per parallel-executor contract | DEFERRED (worktree has no node_modules) |

Note on Gate 4: the plan's `<acceptance_criteria>` for Task 1 said "exactly 2 (one in setter, one in onunload)", but the plan's own setter code (Task 1 Edit 2) used inline `window.clearTimeout(this.backgroundRefreshTimer)` rather than `this.clearBackgroundRefreshTimer()`. The implementation follows the literal code in the plan. Task 4 Gate 4 explicitly allows this with "At minimum the onunload site MUST be present", and the equivalent invariant is captured by Gate 2 (`window.clearTimeout` count in main.ts is ≥ 2, satisfied at 2).

## D-09 preservation — confirmed

The existing `isDragging`-guarded listener-removal block in `CalendarView.onClose` (added by Plan 01-04) is preserved verbatim. Diff scope confirms only an ADDITIONAL sibling step was added for the new `startupTimer` cleanup — the original two `window.removeEventListener(...)` calls and the `this.isDragging = false` assignment are unchanged, and `handleDragEnd` is NOT called from `onClose` (which would re-trigger `saveSettings` during teardown).

Verification:
- `grep -c "if (this.isDragging)" src/views/CalendarView.ts` → 1 (the original guard is intact)
- The two `removeEventListener` call sites for `mousemove` / `mouseup` with `handleDragMoveBound` / `handleDragEndBound` are still present inside the guard block (file count: 2 — once in `handleDragEnd`, once in `onClose`).
- The new `startupTimer` cleanup is appended OUTSIDE the `if (this.isDragging) { ... }` block, as specified.

## Residual iOS / mobile risk closure — confirmed at code level

The two findings tracked in `01-VERIFICATION.md` (Anti-Patterns Found row for `CalendarService.ts:185-187` and the IN-02 row for `CalendarView.ts:68-70`) are now closed at the source level. The pending iOS UAT in `01-HUMAN-UAT.md` for "rapid plugin disable on iOS" is now testable on a real device — the wrong-API mismatch (`clearInterval` on a `setTimeout` handle) is no longer present at either call site:

- **Plugin level (CR-01):** the 100ms one-shot timer's handle is held on `MemoChron.backgroundRefreshTimer` and explicitly cancelled with `window.clearTimeout` in `onunload` after `clearRefreshTimer()`.
- **View level (IN-02):** the 50ms one-shot timer's handle is held on `CalendarView.startupTimer` and explicitly cancelled with `window.clearTimeout` in `onClose` as a sibling step to the existing D-09 drag-listener removal.

On iOS WKWebView and Android WebView (where the spec does not require shared `setTimeout`/`setInterval` ID pools), both timers will now be cancelled with the correct API regardless of the runtime's pool sharing semantics.

## Deviations from Plan

None. Plan executed exactly as written, with one observation: the plan's Task 1 acceptance criterion for `this.clearBackgroundRefreshTimer()` count of "exactly 2" contradicted its own code (Edit 2 used inline `window.clearTimeout(...)` in the setter). The implementation followed the plan's literal code (not the contradictory acceptance count) — Task 4 Gate 4's "At minimum the onunload site MUST be present" wording explicitly anticipated and accepted this case.

## Authentication gates

None — purely lifecycle / cleanup code change.

## Known stubs

None.

## Threat Flags

None — this fix narrows an existing trust boundary (Obsidian-managed cleanup augmented with explicit owned-handle cleanup) without introducing new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

Verified post-write:

- File `src/main.ts` modified (line 17 adds `backgroundRefreshTimer` field; lines 91-95 onunload calls `clearBackgroundRefreshTimer()`; lines 182-208 add the setter and helper).
- File `src/services/CalendarService.ts` modified (lines 180-194 — `scheduleBackgroundRefresh` now calls `this.plugin.setBackgroundRefreshTimer(...)`).
- File `src/views/CalendarView.ts` modified (line 33 adds `startupTimer` field; lines 52-62 — `onClose` clears the timer as a sibling step to the isDragging guard; lines 67-83 — onOpen stores the handle on the field).
- Commit `0aecc0e` exists in `git log` with the expected subject and zero AI/Claude references.
- `git diff --name-only` against the parent commit returns exactly the three files in `files_modified`.
- All nine grep-based invariant gates from Task 4 pass; the build gate (Gate 10) is deferred to post-merge on main per the parallel-executor contract.
