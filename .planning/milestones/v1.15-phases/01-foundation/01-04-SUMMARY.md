---
phase: 01-foundation
plan: "04"
subsystem: lifecycle
tags: [lifecycle, drag-handlers, view-onclose, mid-drag-teardown, ios]
dependency_graph:
  requires: [01-03]
  provides: [isDragging-flag, onClose-drag-listener-cleanup]
  affects: [src/views/CalendarView.ts]
tech_stack:
  added: []
  patterns: [View.onClose-override, isDragging-state-flag, listener-removal-only-teardown]
key_files:
  modified:
    - src/views/CalendarView.ts
decisions:
  - "D-08: CalendarView adds private isDragging = false; handleDragStart sets it true after e.preventDefault(); handleDragEnd sets it false as its first statement"
  - "D-09: CalendarView.onClose() removes the two window drag listeners inside an if (this.isDragging) guard — listener removal ONLY, does NOT call handleDragEnd to avoid saveSettings/refreshCalendarView race against view teardown"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 1 Plan 4: TD-04 Drag Listener Cleanup via onClose Override Summary

**One-liner:** `CalendarView` gains a `private isDragging = false` flag tracked through drag handlers and a `protected async onClose(): Promise<void>` override that removes the two `window` mousemove/mouseup listeners mid-drag — closing the iOS rapid disable/enable crash vector together with Plan 03's `detachLeavesOfType`.

## What Was Done

One file was modified as part of the TD-04 requirement. All changes land in a single atomic commit.

### Files Modified

**`src/views/CalendarView.ts`** — Three edits:

1. **Field declaration** (line 32): Added `private isDragging = false;` after `handleDragEndBound` in the private drag-fields block. The `= false` initializer satisfies strict-null-checks without a constructor assignment.

2. **`handleDragStart` flag set** (line 1062): Added `this.isDragging = true;` as the first statement after `e.preventDefault()`. Placement before `dragStartY` assignment ensures the flag reflects drag-in-progress state immediately.

3. **`handleDragEnd` flag clear** (line 1090): Added `this.isDragging = false;` as the absolute first statement of the method. First-statement placement ensures the flag is cleared even if `snapToCurrentViewMode()` subsequently throws — preventing stale state.

4. **`onClose` override** (lines 52-59): Added `protected async onClose(): Promise<void>` immediately after `getIcon()`, grouping it with other view-lifecycle methods. The override removes both window listeners and clears the flag inside an `if (this.isDragging)` guard — only runs cleanup if a drag was in progress at teardown time.

## Commit

| Hash | Message | Files |
|------|---------|-------|
| `66c79d3` | `refactor(view): clean up window drag listeners on mid-drag close` | `src/views/CalendarView.ts` |

## Verification Output

```
# Build
TypeScript -noEmit -skipLibCheck  →  exit 0
esbuild production bundle          →  exit 0

# isDragging field (expect exactly 1 declaration)
grep -cE "private isDragging\s*=\s*false" src/views/CalendarView.ts  →  1

# Flag set in handleDragStart (expect exactly 1)
grep -cE "this\.isDragging\s*=\s*true" src/views/CalendarView.ts  →  1

# Flag clear in handleDragEnd (expect exactly 1; field init doesn't count as this.isDragging = false)
grep -cE "this\.isDragging\s*=\s*false" src/views/CalendarView.ts  →  1

# onClose override signature (expect exactly 1)
grep -cE "protected async onClose\(\): Promise<void>" src/views/CalendarView.ts  →  1

# Listener removal in both handleDragEnd AND onClose (expect 2 each)
grep -cE "window\.removeEventListener\(\"mousemove\", this\.handleDragMoveBound\)" src/views/CalendarView.ts  →  2
grep -cE "window\.removeEventListener\(\"mouseup\", this\.handleDragEndBound\)" src/views/CalendarView.ts  →  2
```

## Critical Constraint: onClose Does NOT Call handleDragEnd (D-09 Honored)

The `onClose` override performs listener removal only. It does NOT call `this.handleDragEnd(...)`.

Calling `handleDragEnd` from `onClose` would trigger:
`handleDragEnd` → `snapToCurrentViewMode()` → `this.plugin.saveSettings()` → `setupAutoRefresh() + refreshCalendarView()` → `this.calendarView.refreshEvents()` against a torn-down view

This race was explicitly documented in D-09 and RESEARCH.md Pattern 3. The acceptance criterion `awk '/protected async onClose/,/}/' ... | grep -c 'this.handleDragEnd('` returns 0 — confirmed.

## Plan 03 + Plan 04 Together Close the iOS Crash Vector

- **Plan 03** added `this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` to `onunload`, ensuring `CalendarView.onClose()` fires deterministically on plugin disable — not just on sidebar-close.
- **Plan 04** (this plan) implements what runs in `onClose`: the drag listener cleanup guarded by `isDragging`.

Without Plan 03's `detachLeavesOfType`, the new `onClose` override would only fire on sidebar-close, not on rapid enable/disable. Together, the two plans eliminate the "undefined is not an object" crash on iOS that occurs when a timer or window-listener callback fires into a destroyed view after plugin disable.

## Deviations from Plan

None — plan executed exactly as written. Three edits to one file (field declaration, two handler mutations, one new method), all acceptance criteria pass, single atomic commit with no Claude/AI references in the message.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Pure internal lifecycle hygiene using standard `window.removeEventListener` (already used in `handleDragEnd`). No new attack surface. T-04-01 and T-04-02 from the plan's threat register are mitigated.

## Known Stubs

None — no hardcoded empty values or placeholder text introduced.

## Self-Check: PASSED

- `src/views/CalendarView.ts` modified and committed: FOUND
- Commit `66c79d3` exists: FOUND
- `grep -cE "private isDragging\s*=\s*false" src/views/CalendarView.ts` = 1: VERIFIED
- `grep -cE "this\.isDragging\s*=\s*true" src/views/CalendarView.ts` = 1: VERIFIED
- `grep -cE "this\.isDragging\s*=\s*false" src/views/CalendarView.ts` = 1: VERIFIED
- `grep -cE "protected async onClose\(\): Promise<void>" src/views/CalendarView.ts` = 1: VERIFIED
- `grep -cE "window\.removeEventListener..." (mousemove)` = 2: VERIFIED
- `grep -cE "window\.removeEventListener..." (mouseup)` = 2: VERIFIED
- onClose does NOT call handleDragEnd: VERIFIED (grep returns 0)
- TypeScript type-check exits 0: VERIFIED
- esbuild production bundle exits 0: VERIFIED
- Commit message contains no Claude/AI references: VERIFIED
