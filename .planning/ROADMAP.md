# Roadmap: MemoChron — Stabilization Milestone

## Overview

This milestone takes MemoChron from its stable v1.13.1 base to a clean, submission-ready state. Four phases progress from invisible-but-critical internal hygiene (lifecycle correctness, mobile crash prevention) through security hardening, through date-parsing correctness, to user-visible UX enhancements that depend on that corrected date foundation. Each phase leaves the plugin in a releasable state.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Lifecycle hygiene, settings propagation, and dead-code removal — no user-visible change; eliminates mobile crash risk
- [ ] **Phase 2: Security & Correctness** - Color validation hardened at load time, consistent error handling, and three standalone bugs fixed
- [ ] **Phase 3: Date Parsing & Navigation Bugs** - BUG-01 keystone date-fix plus related navigation, concurrency, and format-verification bugs
- [ ] **Phase 4: UX Enhancements** - Today indicator, note-exists markers, NL date format, named template variables, and cursor placement — all built on the stable Phase 3 base

## Phase Details

### Phase 1: Foundation
**Goal**: Plugin does not leak resources on unload, does not crash on iOS from untracked timers or drag listeners, and reads live settings in both services — with dead code removed to reduce noise for all subsequent phases
**Depends on**: Nothing (first phase)
**Requirements**: TD-01, TD-02, TD-03, TD-04, CLEAN-01
**Success Criteria** (what must be TRUE):
  1. Changing the refresh interval in settings takes effect for the next cache-expiry check without reloading Obsidian
  2. Disabling the MemoChron plugin on iOS (via fast enable/disable cycle) does not produce an "undefined is not an object" crash
  3. Dragging the calendar pane to resize it and then immediately closing the sidebar does not leave orphaned `mousemove`/`mouseup` listeners on `window`
  4. The codebase contains no reference to `calculateEndDate`, `DEFAULT_TEMPLATE_PATH`, `TEMPLATE_VARIABLES`, the unused `App`/`TFile` imports, or the dead `renderAgendaList` import in embedded views
**Plans**: 10 plans (5 original + 5 code-review gap closures)
Plans:
- [x] 01-01-PLAN.md — TD-01: drop CalendarService refreshMinutes; read live refresh interval
- [x] 01-02-PLAN.md — TD-02: NoteService reads live plugin settings via getter; constructor takes (plugin) only
- [x] 01-03-PLAN.md — TD-03: wrap setupAutoRefresh / scheduleBackgroundRefresh / onOpen timers in registerInterval; add detachLeavesOfType to onunload
- [x] 01-04-PLAN.md — TD-04: CalendarView isDragging flag and View.onClose override that removes orphan window drag listeners
- [x] 01-05-PLAN.md — CLEAN-01: remove calculateEndDate, DEFAULT_TEMPLATE_PATH, TEMPLATE_VARIABLES, and unused App/TFile/renderAgendaList imports
- [x] 01-06-PLAN.md — CR-01 + IN-02: own setTimeout handles for plugin-level 100ms + view-level 50ms timers; clear with window.clearTimeout
- [x] 01-07-PLAN.md — WR-01: drop redundant registerInterval wrap in setupAutoRefresh (no more accumulating stale interval IDs)
- [x] 01-08-PLAN.md — WR-02: split code-block params on first colon (preserves titles/datetimes with embedded colons)
- [x] 01-09-PLAN.md — WR-03: static import for obsidian-daily-notes-interface in EmbeddedCalendarView (matches sibling pattern)
- [x] 01-10-PLAN.md — IN-01: type CalendarView drag-handler bindings as ((e: MouseEvent) =&gt; void) | undefined

### Phase 2: Security & Correctness
**Goal**: Plugin loads cleanly even with corrupted or malicious color values in saved settings, every catch block emits a meaningful message, and the three small standalone bugs that do not depend on BUG-01 are resolved
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, BUG-05, BUG-06
**Success Criteria** (what must be TRUE):
  1. Loading a vault whose `data.json` contains a crafted color string (e.g. `"><script>alert(1)</script>`) does not inject markup — the value is replaced with the default color at `loadSettings` time
  2. SVG color swatches in the settings tab are constructed via `createElementNS` — no template-literal injection path exists at render time
  3. Every visible error in the plugin (failed fetch, failed note creation, failed cache read) shows a specific message rather than `[object Object]` or `undefined`
  4. The `getStartOfWeek` function returns the correct week-start date for every `firstDayOfWeek` value (0–6), including Saturday-start (firstDayOfWeek = 6)
  5. A second background-refresh triggered while a fetch is in flight does not produce a double-render or duplicate event list
**Plans**: 5 (5 complete — 02-01 through 02-05)
**UI hint**: yes
**Status**: Complete (2026-05-11)

### Phase 3: Date Parsing & Navigation Bugs
**Goal**: Daily-note filenames in non-UTC timezones map to the correct local calendar day, month/week navigation feels immediate, the drag-resize view-mode sync is correct, and the BUG-04 date-parsing edge case is confirmed closed — clearing the prerequisite for all Phase 4 enhancements
**Depends on**: Phase 2
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. A daily note named `2026-01-15.md` in a vault used in Montreal (UTC-5) shows events for January 15 — not January 14
  2. Clicking the next-month or next-week arrow feels instantaneous; there is no perceptible delay between the click and the calendar re-rendering
  3. After dragging the calendar pane from month-height to week-height, the view-mode dropdown reads "Week" and the Today button scrolls to the current week — not the current month
  4. The input `29-01-2026` parses to 29 January 2026 (not 20 January 2029) under the post-#58 format handling — confirmed and documented
**Plans**: 3 plans
Plans:
- [ ] 03-01-PLAN.md — BUG-01: parseDateFromFilename — convert six format branches to local-day numeric Date constructor
- [ ] 03-02-PLAN.md — BUG-02 + BUG-03: decouple navigate() and goToToday() from fetch; add maybeBackgroundRefresh helper
- [ ] 03-03-PLAN.md — BUG-04: closure comment + remove unreachable duplicate regex; create 03-HUMAN-UAT.md
**UI hint**: yes

### Phase 4: UX Enhancements
**Goal**: Users see today clearly distinguished from the selected day, can tell which events already have notes without opening them, can use NL date format for note titles, can use named day/month variables in templates, and can place the editor cursor precisely after note creation
**Depends on**: Phase 3
**Requirements**: ENH-01, ENH-02, ENH-03, ENH-04, ENH-05, ENH-06
**Success Criteria** (what must be TRUE):
  1. Today's cell on the calendar grid shows a distinct ring or border even when a different day is selected — both highlights are visible simultaneously
  2. Events in the agenda that already have an associated note show a file-check icon; events without a note show a file-plus icon
  3. An optional "note-exists dot" on the calendar grid can be toggled on in settings; it is off by default and does not appear on grid cells for existing users until enabled
  4. The settings date-format dropdown includes "DD-MM-YYYY (NL/EU)" and selecting it produces note titles like `15-01-2026` for a January 15 event
  5. A note template containing `{{day}}` and `{{month}}` produces `Monday` and `January` (or the correct English weekday/month name) — not a number
  6. A note template containing `{{cursor}}` places the editor cursor at that position after the note opens — the marker text itself does not appear in the saved note
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 10/10 | Complete | 2026-05-10 |
| 2. Security & Correctness | 5/5 | Complete | 2026-05-11 |
| 3. Date Parsing & Navigation Bugs | 0/3 | Planned | - |
| 4. UX Enhancements | 0/TBD | Not started | - |
