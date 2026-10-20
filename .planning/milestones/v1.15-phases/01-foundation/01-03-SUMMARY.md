---
phase: 01-foundation
plan: "03"
subsystem: lifecycle
tags: [lifecycle, timers, registerInterval, mobile-crash, ios]
dependency_graph:
  requires: [01-02]
  provides: [registered-timers-all-three-files, detachLeavesOfType-in-onunload]
  affects: [src/main.ts, src/services/CalendarService.ts, src/views/CalendarView.ts]
tech_stack:
  added: []
  patterns: [registerInterval-belt-and-suspenders, plugin-borrowed-registerInterval, detachLeavesOfType-deterministic-close]
key_files:
  modified:
    - src/main.ts
    - src/services/CalendarService.ts
    - src/views/CalendarView.ts
decisions:
  - "D-05: Every window.setInterval/setTimeout in the three target files is wrapped in registerInterval(...) so Obsidian auto-cancels on unload"
  - "D-06: Timing values (50ms, 100ms) are preserved unchanged — PERF-04 deferred"
  - "D-07: onunload calls detachLeavesOfType(MEMOCHRON_VIEW_TYPE) before clearRefreshTimer(); manual refreshTimer handle is preserved for saveSettings() reset path"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-09"
  tasks_completed: 4
  tasks_total: 4
---

# Phase 1 Plan 3: TD-03 Timer Registration via registerInterval Summary

**One-liner:** Every `window.setInterval`/`setTimeout` in `main.ts setupAutoRefresh`, `CalendarService.scheduleBackgroundRefresh`, and `CalendarView.onOpen` is now wrapped in `registerInterval(...)` so Obsidian auto-cancels all timers on plugin or view unload; `onunload` gains `detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` so `CalendarView.onClose()` fires deterministically on plugin disable — eliminating the iOS "undefined is not an object" crash on rapid enable/disable.

## What Was Done

Three files were modified as part of the TD-03 requirement. All changes land in a single atomic commit.

### Files Modified

**`src/main.ts`** — Two edits:
1. `setupAutoRefresh` (lines 162-172): wrapped `window.setInterval(...)` in `this.registerInterval(...)`. The numeric handle is preserved — `registerInterval(id: number): number` returns the same id — so `this.refreshTimer = this.registerInterval(window.setInterval(...))` is valid. The manual `refreshTimer` field is KEPT for the `saveSettings()` reset-and-recreate path.
2. `onunload` (lines 91-94): added `this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` before `this.clearRefreshTimer()`. This guarantees `CalendarView.onClose()` fires deterministically when the plugin is disabled (required by Plan 04 which will add an `onClose` drag-listener cleanup override).

**`src/services/CalendarService.ts`** — One edit:
- `scheduleBackgroundRefresh` (lines 180-189): wrapped bare `setTimeout(...)` in `this.plugin.registerInterval(window.setTimeout(...))`. `CalendarService` is a plain class (not a `Component`), so it borrows the plugin's registration scope via `this.plugin.registerInterval`. The 100ms timing value is preserved per D-06.

**`src/views/CalendarView.ts`** — One edit:
- `onOpen` (lines 58-69): wrapped bare `setTimeout(...)` in `this.registerInterval(window.setTimeout(...))`. `CalendarView` extends `ItemView` extends `View` extends `Component`, so `this.registerInterval` is on the view itself — auto-cancels on view close, not just plugin unload. The 50ms timing value and the arrow-function body are preserved verbatim.

## Commit

| Hash | Message | Files |
|------|---------|-------|
| `4ca5dc7` | `refactor(lifecycle): track and cancel timers via registerInterval` | `src/main.ts`, `src/services/CalendarService.ts`, `src/views/CalendarView.ts` |

## Verification Output

```
# Build
TypeScript -noEmit -skipLibCheck  →  exit 0
esbuild production bundle          →  exit 0

# Timer grep — all window.setTimeout/setInterval matches are inside registerInterval wraps
grep -nE "window\.setInterval|window\.setTimeout|^\s*setTimeout|^\s*setInterval" \
  src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts

src/main.ts:167:      window.setInterval(
src/services/CalendarService.ts:186:        window.setTimeout(() => this.fetchCalendars(sources, true), 100)
src/views/CalendarView.ts:60:        window.setTimeout(() => {

# Note: zero bare ^setTimeout( or ^setInterval( lines remain — every timer is inside a register* wrap

# detachLeavesOfType is in onunload (expect 1)
grep -cE "detachLeavesOfType\(MEMOCHRON_VIEW_TYPE\)" src/main.ts  →  1

# Manual refreshTimer handle preserved (expect 1)
grep -cE "this\.refreshTimer\s*=\s*this\.registerInterval" src/main.ts  →  1

# clearRefreshTimer private method preserved (expect 1)
grep -cE "private clearRefreshTimer" src/main.ts  →  1
```

## Manual refreshTimer Handle — Dual-Handle Pattern

The `refreshTimer` field is preserved alongside `registerInterval` — these serve distinct purposes:

- `registerInterval` → belt-and-suspenders: Obsidian auto-cancels on plugin unload even if `clearRefreshTimer()` were not called
- `this.refreshTimer = ...` → resettable-interval: `saveSettings()` calls `clearInterval(this.refreshTimer)` before recreating with a new rate; without this handle, changing the refresh rate would create duplicate concurrent timers

Both handles point to the same timer ID (because `registerInterval(id): number` returns the same id). Both are needed.

## SettingsTab.ts — Intentionally Untouched

Per RESEARCH.md Open Question Q1 (resolved), the two bare `setTimeout` calls in `SettingsTab.ts` (lines 1346 and 1747) are for suggestion-dropdown blur handling — very short-lived, not in TD-03 scope per REQUIREMENTS.md. They are NOT flagged as a TD-03 failure. Addressed in a future hygiene pass.

## Plan 04 Dependency Note

Plan 04 (TD-04) will add a `CalendarView.onClose()` override to remove `window` drag listeners mid-drag. That override relies on `detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` being in `onunload` to fire `onClose()` deterministically on plugin disable. This plan provides that prerequisite.

## Deviations from Plan

None — plan executed exactly as written. Three edits to three files, all acceptance criteria pass, single atomic commit with no Claude/AI references in the message.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Pure internal lifecycle hygiene using first-class Obsidian APIs (`registerInterval`, `detachLeavesOfType`). No new attack surface.

## Known Stubs

None — no hardcoded empty values or placeholder text introduced.

## Self-Check: PASSED

- `src/main.ts` modified and committed: FOUND
- `src/services/CalendarService.ts` modified and committed: FOUND
- `src/views/CalendarView.ts` modified and committed: FOUND
- Commit `4ca5dc7` exists: FOUND
- `grep -cE "this.refreshTimer = this.registerInterval" src/main.ts` = 1: VERIFIED
- `grep -cE "detachLeavesOfType(MEMOCHRON_VIEW_TYPE)" src/main.ts` = 1: VERIFIED
- `grep -cE "this.plugin.registerInterval" src/services/CalendarService.ts` = 1: VERIFIED
- `grep -cE "this.registerInterval(" src/views/CalendarView.ts` = 1: VERIFIED
- `grep -nE "^\s*setTimeout(" src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts` = (none): VERIFIED
- `grep -nE "^\s*setInterval(" src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts` = (none): VERIFIED
- TypeScript type-check exits 0: VERIFIED
- esbuild production bundle exits 0: VERIFIED
- Commit message contains no Claude/AI references: VERIFIED
