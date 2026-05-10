---
phase: 01-foundation
plan: 10
subsystem: ui
tags: [types, type-safety, strict-null-checks, calendar-view, lifecycle, follow-up, code-review-gap]

requires:
  - phase: 01-foundation
    provides: "Plan 01-04 — isDragging field, onClose override, D-09 invariant"
  - phase: 01-foundation
    provides: "Plan 01-06 — startupTimer cleanup block in onClose"
provides:
  - "handleDragMoveBound and handleDragEndBound typed `((e: MouseEvent) => void) | undefined` with explicit `= undefined` initializers"
  - "Compound onClose guard `this.isDragging && this.handleDragMoveBound && this.handleDragEndBound` so strictNullChecks is satisfied at the removeEventListener call sites"
  - "Non-null assertions at the four addEventListener/removeEventListener sites in handleDragStart and handleDragEnd, which only run after createUI"
affects: [calendar-view, lifecycle, future-refactors-touching-drag-handlers]

tech-stack:
  added: []
  patterns:
    - "Explicit-undefined typing for fields whose initialization is deferred to a lifecycle method"
    - "Compound conditional narrowing in cleanup paths so strictNullChecks accepts removeEventListener arguments"
    - "Non-null assertion at call sites where a lifecycle precondition guarantees the field is bound"

key-files:
  created: []
  modified:
    - src/views/CalendarView.ts

key-decisions:
  - "Option A from REVIEW.md: declared type reflects runtime reality (`| undefined`) rather than relying on the runtime guard alone"
  - "Use compound `&&` narrowing inside onClose (no `!` assertion there) — TypeScript narrows the union to the function form, no assertion needed"
  - "Use `!` non-null assertion at the four addEventListener/removeEventListener sites in handleDragStart/handleDragEnd because those methods only execute after createUI binds the resize-handle mousedown listener"
  - "D-09 preserved verbatim: the body inside the onClose guard is unchanged — only the conditional widens"

patterns-established:
  - "Defer-initialized fields should be typed `T | undefined` and explicitly initialized to `undefined` so strictNullChecks catches pre-init access"
  - "When removeEventListener appears in cleanup paths under strictNullChecks, narrow the handler-field union via compound boolean conditional rather than non-null asserting in the cleanup site"

requirements-completed: [IN-01-FIX]

duration: 3min
completed: 2026-05-10
---

# Phase 01 Plan 10: IN-01 Type-Safety Gap Closure Summary

**Drag-handler binding fields in CalendarView typed `| undefined` with explicit initializers; compound onClose guard satisfies strictNullChecks; D-09 invariant preserved.**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-05-10T04:13:05Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Closed IN-01 from `01-REVIEW.md` — `handleDragMoveBound` / `handleDragEndBound` declared types now reflect runtime reality (deferred initialization in `createUI()`)
- TypeScript `strictNullChecks` will now catch any future code path that accesses these fields before `createUI()` runs
- Compound onClose guard wires the new typing to satisfy `removeEventListener`'s function-only signature without weakening the cleanup logic
- D-09 invariant preserved: onClose still does NOT call `handleDragEnd`; the body inside the guard remains exactly the two `removeEventListener` calls plus `this.isDragging = false`
- Plan 01-06's `startupTimer` cleanup block in onClose left untouched

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Widen drag-handler binding types and commit IN-01 fix atomically** — `8eb4fce` (fix)
   - Single atomic commit per plan output spec — Task 1 produces the file edit, Task 2 commits it

## Files Created/Modified

- `src/views/CalendarView.ts` — three precise edits:
  - Lines 30-31 (field declarations): widened to `((e: MouseEvent) => void) | undefined = undefined`
  - Line 54 (onClose guard): widened to `if (this.isDragging && this.handleDragMoveBound && this.handleDragEndBound)`
  - Lines 1075-1076 (handleDragStart) and 1100-1101 (handleDragEnd): added `!` non-null assertions on the four addEventListener/removeEventListener handler arguments

## New Field Declarations

```typescript
private handleDragMoveBound: ((e: MouseEvent) => void) | undefined = undefined;
private handleDragEndBound: ((e: MouseEvent) => void) | undefined = undefined;
```

## New Compound Guard in onClose

```typescript
protected async onClose(): Promise<void> {
  if (this.isDragging && this.handleDragMoveBound && this.handleDragEndBound) {
    window.removeEventListener("mousemove", this.handleDragMoveBound);
    window.removeEventListener("mouseup", this.handleDragEndBound);
    this.isDragging = false;
  }
  if (this.startupTimer !== null) {
    window.clearTimeout(this.startupTimer);
    this.startupTimer = null;
  }
}
```

## D-09 Preservation Confirmation

- The body inside the guard contains exactly the two `removeEventListener` calls and `this.isDragging = false`
- onClose does NOT call `handleDragEnd` — D-09 honored verbatim
- Only the conditional widened (added two `&&` clauses); no statement added or removed inside the block
- The sibling `startupTimer` cleanup block (introduced by plan 01-06) is left fully intact

## strictNullChecks Confirmation

- The verify step's `node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck` and `node esbuild.config.mjs production` are run on main after merge per the parallel-execution policy (the worktree has no `node_modules`)
- All grep-based acceptance criteria from the plan pass exactly (counts: 1, 1, 1, 2, 2, 1, 1, 1)
- The compound guard inside onClose narrows `this.handleDragMoveBound` and `this.handleDragEndBound` from `((e: MouseEvent) => void) | undefined` to `(e: MouseEvent) => void` inside the block, which is what `removeEventListener` requires
- The `!` non-null assertions in `handleDragStart` and `handleDragEnd` are sound because both methods are only reachable after `createUI()` has assigned the bindings (createUI binds the mousedown listener on the resize-handle, and that listener is the only entry point into `handleDragStart`)
- The assignments in `createUI` are unchanged — they're valid against the new union type without modification

## Decisions Made

- Option A (REVIEW.md) — declared type reflects runtime reality with `| undefined`, not a non-null assertion at the field site
- Inside onClose: compound `&&` narrowing (no `!`) — narrowing is the right tool when a runtime check is already required
- At handleDragStart / handleDragEnd: `!` non-null assertion — the lifecycle invariant guarantees the bindings are present, and an assertion keeps the call sites visually quiet vs. wrapping each in a redundant guard

## Deviations from Plan

None — plan executed exactly as written. The two task blocks were collapsed into one commit per the plan's output spec ("One file modified. One atomic commit.").

## Issues Encountered

None.

## User Setup Required

None — pure type-safety hardening, no external configuration.

## Next Phase Readiness

- IN-01 closed; the only remaining items from `01-REVIEW.md` for this phase's gap-closure track are tracked in plans 01-07 (CR-01), 01-08 (IN-02), 01-09 (WR-01..03), and 01-10 itself (IN-01, this plan)
- Future refactors that touch `CalendarView`'s drag lifecycle now have a compile-time safety net via `strictNullChecks`
- D-09 still load-bearing for any future onClose change

## Self-Check: PASSED

Verified items:
- File `src/views/CalendarView.ts` exists and contains all three required edits (verified via grep counts: 1, 1, 1, 2, 2, 1, 1, 1 — exactly matching acceptance criteria)
- Commit `8eb4fce` exists in `git log` and touches exactly `src/views/CalendarView.ts`
- Commit message subject matches `fix(types): allow undefined for CalendarView drag-handler bindings`
- Commit message contains no Claude/Anthropic/AI references (verified via case-insensitive grep)
- onClose body inside the new guard is unchanged: two `removeEventListener` calls and `this.isDragging = false` — no `handleDragEnd` call (D-09 preserved)
- `startupTimer` cleanup block (plan 01-06) preserved intact
- Working tree clean

---
*Phase: 01-foundation*
*Plan: 10*
*Completed: 2026-05-10*
