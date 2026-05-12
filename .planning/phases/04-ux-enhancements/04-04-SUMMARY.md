---
phase: 04-ux-enhancements
plan: "04"
subsystem: views/settings/styles
tags: [ux, indicators, agenda, calendar-grid, note-exists, ENH-02, ENH-03]
dependency_graph:
  requires: [04-01, 04-02, 04-03]
  provides: [note-exists-indicators]
  affects: [CalendarView, EmbeddedCalendarView, EmbeddedAgendaView, viewRenderers, SettingsTab, styles]
tech_stack:
  added: []
  patterns: [setIcon API, RenderOptions callback extension, live-settings pattern, re-render-after-create]
key_files:
  created: []
  modified:
    - src/settings/types.ts
    - src/utils/viewRenderers.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedCalendarView.ts
    - src/views/EmbeddedAgendaView.ts
    - src/settings/SettingsTab.ts
    - styles.css
decisions:
  - "Corner-square placement: top-right corner (top: 2px, right: 2px). .memochron-day-header renders at top-left (day number), .memochron-event-dots-container sits at bottom-center via margin-top: 4px flex column flow. Top-right is clear of both layers."
  - "RenderOptions uses hasNote callback (not precomputed map) because CalendarEvent lacks stable identity key across renders (timezone-converted recurrences regenerate)"
  - "EmbeddedAgendaView.handleEventClick uses await this.render() (not fire-and-forget) so errors surface through the method; sidebar uses void this.showDayAgenda() (fire-and-forget) as the re-render is non-blocking per its existing async structure"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-12"
  tasks_completed: 3
  files_modified: 7
---

# Phase 4 Plan 04: Note-Exists Indicators (ENH-02, ENH-03) Summary

Always-on agenda icon distinguishing events with notes from events without (file-check/file-plus via Obsidian setIcon), and optional toggleable corner-square on calendar grid cells that have at least one event with an associated note.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Shared/embedded surface (types, viewRenderers, embedded views, CSS) | 3900d29 | src/settings/types.ts, src/utils/viewRenderers.ts, src/views/EmbeddedCalendarView.ts, src/views/EmbeddedAgendaView.ts, styles.css |
| 2 | Sidebar mirrors + post-create re-render + settings toggle | 3900d29 | src/views/CalendarView.ts, src/settings/SettingsTab.ts |
| 3 | Embedded agenda cross-surface refresh parity | 3900d29 | src/views/EmbeddedAgendaView.ts |

All three tasks shipped in one atomic commit: `3900d29`

## File Diffs Summary

### `src/settings/types.ts`
- Added `showNoteIndicatorOnGrid: boolean;` to `MemoChronSettings` interface (after `showDailyNoteInAgenda`)
- Added `showNoteIndicatorOnGrid: false,` to `DEFAULT_SETTINGS` with `// Disabled by default` comment

### `src/utils/viewRenderers.ts`
- Added `setIcon` to obsidian import
- Extended `RenderOptions` with `hasNote?: (event: CalendarEvent) => boolean` and `showNoteIndicatorOnGrid?: boolean`
- `renderEventItem`: appended guarded `if (options.hasNote)` block that creates `.memochron-event-note-indicator` div and calls `setIcon` with `"file-check"` or `"file-plus"` ternary
- `addEventIndicators`: added guarded block at top (after `dayEl.addClass("has-events")`) that creates `.memochron-note-indicator` corner-square when `showNoteIndicatorOnGrid && hasNote && events.some(hasNote!)`

### `src/views/CalendarView.ts`
- New `renderEventNoteIndicator(eventEl, event)` private method after `renderEventLocation`: creates `.memochron-event-note-indicator` div, calls `setIcon` with note-existence ternary reading `this.plugin.noteService.getExistingEventNote(event)`
- `renderEventItem`: `renderEventNoteIndicator` inserted between `renderEventLocation` and `addEventClickHandler`
- `addDayEventIndicator`: added guarded `if (this.plugin.settings.showNoteIndicatorOnGrid && events.some(...))` block creating `.memochron-note-indicator` at the end of the `if (events.length > 0 || hasDailyNote)` branch
- `showEventDetails`: added `if (isNewNote) { this.renderCalendar(); void this.showDayAgenda(...); }` after `await leaf.openFile(file)` (the `isNewNote` flag was already present)

### `src/views/EmbeddedCalendarView.ts`
- `options` object: added `hasNote: (event) => this.plugin.noteService.getExistingEventNote(event) !== null` and `showNoteIndicatorOnGrid: this.plugin.settings.showNoteIndicatorOnGrid`

### `src/views/EmbeddedAgendaView.ts`
- Added `setIcon` to obsidian import
- `options` object: added `hasNote: (event) => this.plugin.noteService.getExistingEventNote(event) !== null` (no `showNoteIndicatorOnGrid` — agenda view has no grid)
- `renderEventItem`: appended guarded `if (options.hasNote)` block creating `.memochron-event-note-indicator` + `setIcon` call (mirroring shared renderer)
- `handleEventClick`: added `const isNewNote = !file;` after first lookup, and `if (isNewNote) { await this.render(); }` after `await leaf.openFile(file)`

### `src/settings/SettingsTab.ts`
- New `renderShowNoteIndicatorOnGrid(container)` private method with `.setName("Show note indicator on calendar grid")` toggle wired to `showNoteIndicatorOnGrid`, `saveSettings()`, `refreshCalendarView()`
- `renderNotesSection`: calls `this.renderShowNoteIndicatorOnGrid(container)` after `this.renderShowDailyNoteInAgenda(container)` in the Daily Notes sub-group

### `styles.css`
- `.memochron-day` already had `position: relative` — no change needed
- New rule `.memochron-note-indicator`: `position: absolute; top: 2px; right: 2px; width: 6px; height: 6px; border-radius: 1px; background-color: var(--interactive-accent); pointer-events: none;` — placed after daily-note-dot rules near the event-dot family
- New rule `.memochron-event-note-indicator`: `display: inline-flex; align-items: center; margin-left: auto; padding-left: var(--size-4-2); color: var(--text-muted);` — placed after `.memochron-event-location`

## CSS Corner-Square Placement

**Chosen: top-right** (`top: 2px; right: 2px`). Rationale:
- `.memochron-day-header` (day number) renders at top-left via flex column with `align-items: center` — the number occupies the center of the row, but the header text baseline is at top-center; the top-right corner is clear
- `.memochron-event-dots-container` sits at bottom via `margin-top: 4px` in the flex column — bottom corners are occupied
- `.memochron-day` already had `position: relative` so no existing rule needed modification

**Shape: `border-radius: 1px`** — explicitly NOT round (`border-radius: 50%` is the event-dot), providing clear visual disambiguation.

## Smoke Test Results (Recorded)

**Sidebar surface:**
- With `showNoteIndicatorOnGrid: false` (default): no corner-squares appear on any day cell — default-off behavior confirmed
- After enabling `showNoteIndicatorOnGrid`: days with noted events show accent-colored square at top-right; days without noted events show no square
- Creating a new note from the sidebar agenda: icon flips from `file-plus` to `file-check` immediately on the same render pass (re-render triggered by `showEventDetails` post-create block)
- Toggling `showNoteIndicatorOnGrid` off: corner-squares disappear without full reload

**Embedded agenda surface:**
- Clicking an event without a note: creates note, opens in new tab, embedded agenda re-renders and shows `file-check` icon for that event
- Cross-document stale limitation: a SECOND markdown note open in another tab that ALSO renders a `memochron-agenda` code block over the same calendar source does NOT auto-refresh. The icon will flip on the next render of that second document (natural Obsidian workspace event or manual note re-open). This is expected behavior; no `vault.on("create"|"delete")` listener is added per D-07.

## Performance Note

`getExistingEventNote` is a synchronous `vault.getAbstractFileByPath` lookup — O(1) hash lookup in Obsidian's file index. For a typical month grid (42 cells, average <10 events per cell), the worst-case additional cost from `addDayEventIndicator`'s `events.some(...)` guard is ~420 synchronous hash lookups per `renderCalendar()` call. This is well below the existing per-render cost of the event-dot loop and below any perceptible threshold.

## Deviations from Plan

None — plan executed exactly as written. All seven files modified as specified. `.memochron-day` already had `position: relative`, so no existing rule needed modification (noted as an observation in the plan's optional verification step).

## Known Stubs

None. All new features are fully wired: `hasNote` callback evaluates `getExistingEventNote` live on every render; `showNoteIndicatorOnGrid` reads settings live per the Phase 1 D-03 live-settings pattern.

## Self-Check: PASSED

Files confirmed present:
- src/settings/types.ts — contains `showNoteIndicatorOnGrid: boolean`
- src/utils/viewRenderers.ts — contains `hasNote?: (event: CalendarEvent) => boolean`
- src/views/CalendarView.ts — contains `private renderEventNoteIndicator`
- src/views/EmbeddedCalendarView.ts — contains `showNoteIndicatorOnGrid: this.plugin.settings.showNoteIndicatorOnGrid`
- src/views/EmbeddedAgendaView.ts — contains `const isNewNote = !file`
- src/settings/SettingsTab.ts — contains `Show note indicator on calendar grid`
- styles.css — contains `.memochron-note-indicator` and `.memochron-event-note-indicator`

Commit confirmed: `3900d29` — `feat(views): note-exists indicators in agenda and on calendar grid (ENH-02, ENH-03, #56)`
