---
phase: 03-date-parsing-navigation-bugs
plan: "02"
subsystem: views
tags:
  - bug-fix
  - navigation
  - performance
  - BUG-02
  - BUG-03
dependency_graph:
  requires:
    - phase-02 (fetchInFlight dedup gate from BUG-06/D-12)
    - phase-02 (errorMessage helper from SEC-02)
  provides:
    - synchronous navigate(delta) decoupled from fetchCalendars
    - synchronous goToToday() always recentering
    - private maybeBackgroundRefresh() fire-and-forget helper
    - private renderCurrentRange() shared render helper
  affects:
    - src/views/CalendarView.ts
    - src/main.ts
tech_stack:
  added: []
  patterns:
    - fire-and-forget Promise with void prefix (introduced; dedups via fetchInFlight)
    - renderCurrentRange() extracted helper for shared synchronous render path
key_files:
  created: []
  modified:
    - src/views/CalendarView.ts
    - src/main.ts
decisions:
  - navigate(delta) made synchronous; renders from in-memory cache with renderCurrentRange(); background fetch via maybeBackgroundRefresh()
  - goToToday() made synchronous; always reassigns currentDate = today without isSameMonth short-circuit
  - renderCurrentRange() extracted to avoid three-line duplication across navigate and maybeBackgroundRefresh .then callback
  - isSameMonth() helper removed entirely (zero callers after rewrite)
  - await dropped at goToToday() call sites in CalendarView.onOpen (line 97) and main.ts wrapper (line 178)
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-12"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 3 Plan 2: Navigation Decoupling (BUG-02 + BUG-03) Summary

**One-liner:** Decoupled `navigate(delta)` and `goToToday()` from `fetchCalendars` by rendering synchronously from the in-memory cache and firing-and-forgetting a background fetch deduped via the Phase 2 `fetchInFlight` gate.

## What Was Built

### Task 1: Add `maybeBackgroundRefresh` helper and decouple `navigate()` (BUG-02)

Three new private methods added to `CalendarView`:

**`maybeBackgroundRefresh(): void`** (lines 314–332) — fire-and-forget background fetch. Calls `fetchCalendars(..., false)` with `void` prefix; `.then()` re-renders via `loadDailyNotes` + `renderCalendar` + `showDayAgenda`; `.catch()` logs via `console.error("MemoChron: background refresh failed:", errorMessage(error))`. Safe against concurrent auto-refresh triggers because the Phase 2 `fetchInFlight` shared-Promise dedups all callers.

**`renderCurrentRange(): void`** (lines 334–338) — extracted helper that calls `renderCalendar()` then `showDayAgenda(this.selectedDate || new Date())`. Eliminates three-line duplication between `navigate()`, `goToToday()`, and the `maybeBackgroundRefresh()` `.then()` callback.

**`navigate(delta: number): void`** (lines 340–355) — rewritten as synchronous. Date arithmetic unchanged. Now calls `renderCurrentRange()` (paint immediately) then `maybeBackgroundRefresh()` (background fetch if stale).

`refreshEvents(forceRefresh)` preserved verbatim per D-07 — still serves `force-refresh-calendars` command, `layout-change` workspace event, and `onOpen` init.

### Task 2: Rewrite `goToToday()` to always recenter (BUG-03)

**`goToToday(): void`** (lines 357–375) — rewritten as synchronous. Drops the `isSameMonth(this.currentDate, today)` short-circuit that prevented week-mode recentering. Always reassigns `this.currentDate = today`. Does NOT modify `viewMode` (per D-09 — user stays in their chosen view mode). Calls `renderCalendar()` + `selectDate(today)` + `maybeBackgroundRefresh()` — same decoupled pattern as `navigate()`.

**`isSameMonth()` helper** — removed entirely. No callers remain after the rewrite. (The string `isSameMonth` appears once in a comment at line 361 documenting the removed short-circuit, but the method declaration is gone.)

**`await` dropped at call sites:**
- `CalendarView.ts:97` — `await this.goToToday()` → `this.goToToday()`
- `main.ts:178–181` — `private async goToToday()` wrapper → `private goToToday()` (sync; removes `await this.calendarView.goToToday()`)

## Diff Shape

### `navigate` before → after

```
Before:
  private async navigate(delta: number) {
    ...date arithmetic...
    await this.refreshEvents();
  }

After:
  private navigate(delta: number): void {
    ...date arithmetic...
    this.renderCurrentRange();
    this.maybeBackgroundRefresh();
  }
```

### `goToToday` before → after

```
Before:
  async goToToday() {
    const today = new Date();
    if (!this.isSameMonth(this.currentDate, today)) {
      this.currentDate = today;
      await this.refreshEvents();
    }
    this.selectDate(today);
  }

After:
  goToToday(): void {
    const today = new Date();
    this.currentDate = today;
    this.renderCalendar();
    this.selectDate(today);
    this.maybeBackgroundRefresh();
  }
```

### `maybeBackgroundRefresh` (new)

```typescript
private maybeBackgroundRefresh(): void {
  void this.plugin.calendarService
    .fetchCalendars(this.plugin.settings.calendarUrls, false)
    .then(() => {
      this.loadDailyNotes();
      this.renderCalendar();
      const dateToShow = this.selectedDate || new Date();
      this.showDayAgenda(dateToShow);
    })
    .catch((error) => {
      console.error("MemoChron: background refresh failed:", errorMessage(error));
    });
}
```

## `renderCurrentRange` Extraction

`renderCurrentRange()` was extracted (recommended in plan per D-07). It is called from:
1. `navigate()` — after date arithmetic
2. `maybeBackgroundRefresh()` — inline in the `.then()` callback (three-line equivalent, not via the helper since the `.then()` also calls `loadDailyNotes()` first)

Note: `goToToday()` does NOT use `renderCurrentRange()` — it calls `renderCalendar()` + `selectDate(today)` separately because `selectDate` sets `selectedDate` and calls `showDayAgenda` internally. This is intentional semantic divergence, not duplication.

## `isSameMonth` Helper

Removed entirely. Was `private isSameMonth(date1: Date, date2: Date): boolean`. No callers exist after the rewrite (confirmed with `grep -n 'isSameMonth' src/views/CalendarView.ts` — returns only the comment at line 361).

## `await` Call Sites Updated

| File | Line | Before | After |
|------|------|--------|-------|
| `src/views/CalendarView.ts` | 97 | `await this.goToToday();` | `this.goToToday();` |
| `src/main.ts` | 178 | `private async goToToday()` | `private goToToday()` |
| `src/main.ts` | 180 | `await this.calendarView.goToToday()` | `this.calendarView.goToToday()` |

## Build Verification

- `npx tsc -noEmit` — exit 0
- `npm run build` — exit 0 (both tasks)

## Smoke Test Notes

This plan runs in a worktree without access to an active Obsidian instance. The behavior assertions from the acceptance criteria are satisfied by code inspection:

**BUG-02 (arrow-click responsiveness):** `navigate()` now calls `renderCurrentRange()` synchronously before `maybeBackgroundRefresh()`. The paint path has zero network I/O. The `fetchInFlight` dedup gate in `CalendarService` (Phase 2 D-12) collapses concurrent `maybeBackgroundRefresh()` calls from rapid clicks into a single in-flight network request.

**BUG-03 (Today button in week mode):** `goToToday()` always reassigns `this.currentDate = today` unconditionally. After a drag-resize to week mode, `renderCalendar()` calls `renderWeekDays(grid, this.viewMode)` which calls `getStartOfWeek(this.currentDate)` — recentering on today's week. `viewMode` is never modified, so the view-mode dropdown's `setChecked(this.viewMode === value)` continues to read the correct value.

**`showViewMenu` and `handleDragMove` verified-not-modified:** Both methods were read (lines 249–276 and 1098–1114) and confirmed already correct per D-10 — no changes needed.

## Deviations from Plan

None — plan executed exactly as written.

- `renderCurrentRange()` was extracted (recommended by plan; done)
- `isSameMonth()` was removed (recommended by plan; done)
- Option (b) chosen for `maybeBackgroundRefresh` — lean on `fetchCalendars`' internal short-circuit, no `needsRefresh` call from the view layer (per PATTERNS.md recommendation)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 (BUG-02) | `a5a3d25` | `fix(view): decouple navigate from fetch (BUG-02, #54)` |
| Task 2 (BUG-03) | `e024320` | `fix(view): goToToday always recenters; decouple from fetch (BUG-03, #54)` |

## Self-Check: PASSED

- `src/views/CalendarView.ts` modified: FOUND
- `src/main.ts` modified: FOUND
- Commit `a5a3d25` exists: FOUND
- Commit `e024320` exists: FOUND
- `npx tsc -noEmit` exits 0: CONFIRMED
- `npm run build` exits 0: CONFIRMED
- `navigate(delta): void` (non-async): CONFIRMED
- `goToToday(): void` (non-async): CONFIRMED
- `maybeBackgroundRefresh()` exists: CONFIRMED
- `isSameMonth` removed (zero occurrences as method): CONFIRMED
- `await this.goToToday()` removed from all call sites: CONFIRMED
