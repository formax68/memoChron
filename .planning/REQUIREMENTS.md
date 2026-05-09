# Requirements: MemoChron — Stabilization Milestone

**Defined:** 2026-05-09
**Core Value:** Show the user's calendar inside Obsidian and let them turn any event into a structured note in one click — reliably, across desktop and mobile.

## v1 Requirements

Requirements for the stabilization milestone. Each maps to roadmap phases. All build on the existing v1.13.1 codebase.

### Bugs

- [ ] **BUG-01**: When an event date is parsed from a daily-note filename (`YYYY-MM-DD`), the resulting Date represents the user's local calendar day — not UTC midnight (fixes #59 for Montreal/Americas timezones)
- [ ] **BUG-02**: Month/week navigation arrows feel responsive — no perceptible lag during the typical interaction (#54)
- [ ] **BUG-03**: After manual drag-resize of the calendar pane between month and week sizes, the view-mode dropdown reflects the current actual mode and the Today button navigates to the correct week (#54)
- [ ] **BUG-04**: Verify the date-parsing bug from #56 (`29-01-2026` interpreted as `20/01/2029`) is resolved post-#58, or close it out with a regression test note
- [ ] **BUG-05**: `getStartOfWeek` returns the correct week-start for every value of `firstDayOfWeek` (0–6) — including the Saturday-start case currently broken
- [ ] **BUG-06**: A second background refresh started while a fetch is already in progress does not produce a duplicate full refresh

### Lifecycle and cleanup

- [ ] **TD-01**: `CalendarService` cache-expiry checks read the live `refreshInterval` from settings — no stale constructor copy
- [ ] **TD-02**: `NoteService` reads the live settings object via plugin reference or getter — no stale settings reference at construction
- [ ] **TD-03**: All `setTimeout` calls in `CalendarService.scheduleBackgroundRefresh` and `CalendarView.onOpen` are tracked and cancelled on plugin unload / view close — no detached-callback firings
- [ ] **TD-04**: `mousemove` / `mouseup` listeners attached to `window` during drag are cleaned up if `CalendarView` is destroyed mid-drag

### Security

- [ ] **SEC-01**: Calendar color values are validated against `/^#[0-9a-fA-F]{6}$/` before any HTML/SVG injection — both at `loadSettings` time and at render time. SVG construction switches to `createElementNS` so injection is structurally impossible.
- [ ] **SEC-02**: Every `catch (error)` block in services and views uses a consistent `error instanceof Error ? error.message : String(error)` pattern

### Cleanup

- [ ] **CLEAN-01**: Dead code removed: `CalendarService.calculateEndDate` (private, unused), unused imports (`App` and `TFile` in EmbeddedCalendarView/EmbeddedAgendaView, `renderAgendaList` in EmbeddedAgendaView), unused constants (`DEFAULT_TEMPLATE_PATH`, `TEMPLATE_VARIABLES`)

### UX Enhancements

- [ ] **ENH-01**: A persistent visual indicator on the calendar grid distinguishes today from the selected day — both states are visible simultaneously (#55)
- [ ] **ENH-02**: In the agenda / sidebar event list, events that already have an associated note display a distinct visual indicator (#56)
- [ ] **ENH-03**: An optional, user-toggleable indicator on the calendar grid marks days that contain at least one event with a note (off by default) (#56)
- [ ] **ENH-04**: Date format options for note titles include `DD-MM-YYYY` (NL/Dutch convention) (#56)
- [ ] **ENH-05**: Note templates support `{{day}}` and `{{month}}` variables that emit fully written names (e.g. `Monday`, `January`) (#56)
- [ ] **ENH-06**: Templates may include a `{{cursor}}` marker; after the note is created and opened, the editor cursor is placed at that marker's position (#56)

## v2 Requirements

Acknowledged and deferred. Tracked but not in this milestone.

### Calendar protocols

- **PROTO-01**: CalDAV protocol support for two-way / authenticated calendar feeds (#30)
- **PROTO-02**: Real-time / push-based Apple Calendar integration (#37)
- **PROTO-03**: Bulk / automated event import workflow (#38)

### Note feature requests deferred from #56

- **NOTE-01**: Locale customization — calendar weekday/month names and template variable output in non-English locales
- **NOTE-02**: Template-file support — point a setting at a Markdown template file used as the starting body for new event notes
- **NOTE-03**: Outlook/Exchange compatibility — make the Attendees field functional and fix Description-field handling for Outlook calendar feeds

### Quality

- **QA-01**: Unit and integration test suite — at minimum: `CalendarService.parseCalendarData`, `timezoneUtils.convertIcalTimeToDate`, `NoteService.buildFilePath`, `viewRenderers` rendering helpers
- **QA-02**: Accessibility — keyboard navigation across the calendar grid, ARIA roles/labels, focus management, screen-reader landmarks

### Performance

- **PERF-01**: Settings change debouncing — `saveSettings` does not trigger a calendar refresh on every keystroke
- **PERF-02**: Cache the enabled-source `Set<string>` derivation in `getEventsForWidget` / `getAllEventsForWidget` and invalidate on settings change
- **PERF-03**: Incremental `SettingsTab.display()` — cache the folder list and avoid full DOM teardown on each open
- **PERF-04**: Replace magic 50ms / 100ms `setTimeout` calls with `requestAnimationFrame` / `requestIdleCallback` and document the rationale

### Fragility / API hygiene

- **FRAG-01**: Wrap `(window as any).moment` in a single utility with absence detection at plugin load
- **FRAG-02**: Replace `(dtstart as any).jCal[2]` all-day detection with the RFC 5545 `VALUE=DATE` parameter check alone
- **FRAG-03**: Use `sourceId` (URL) as canonical identity in both `hasSourceMismatch` and `getEventsForWidget` filters; remove name-based comparison
- **FRAG-04**: Replace `innerHTML` for static help-text in `SettingsTab` with `createEl("strong", { text })` patterns

## Out of Scope

Explicitly excluded for this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| CalDAV protocol support (#30) | Substantial architectural change (auth, write paths, sync); deserves its own feature milestone |
| Real-time Apple Calendar (#37) | Needs OS-level integration outside the plugin sandbox; not a plugin concern |
| Auto/bulk event import (#38) | Defer; partial functionality already exists via `IcsImportService` |
| Locale customization (#56) | Full i18n is its own milestone |
| Template-file support (#56) | Bigger templating system; defer until other note-template improvements stabilize |
| Outlook/Exchange attendees (#56) | Needs real Outlook ICS samples to verify correctness |
| Test suite | Significant work, deserves a dedicated milestone |
| Accessibility (keyboard nav / ARIA) | Significant UX work, deserves a dedicated milestone |
| Settings tab incremental rendering | Non-critical perf — defer to perf milestone |
| Widget event-fetch Set caching | Non-critical perf — defer to perf milestone |
| Settings-change debouncing | Non-critical perf — defer to perf milestone |
| Replacing magic 50/100ms timeouts | Functional today; defer to perf milestone |
| `window.moment` utility wrapper | Stable in practice; defer to fragility milestone |
| `jCal[2]` → `VALUE=DATE` cleanup | Stable in practice; defer to fragility milestone |
| `hasSourceMismatch` URL-canonical refactor | Edge-case-only; defer to fragility milestone |
| Static-HTML `innerHTML` → `createEl` | Cosmetic Obsidian-convention nit; defer to fragility milestone |
| Auto-opening newly created event notes when not requested | Anti-feature flagged in research — would surprise users |
| Honoring `{{cursor}}` inside YAML frontmatter | Anti-feature flagged in research — would corrupt frontmatter |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TD-01 | Phase 1 | Pending |
| TD-02 | Phase 1 | Pending |
| TD-03 | Phase 1 | Pending |
| TD-04 | Phase 1 | Pending |
| CLEAN-01 | Phase 1 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| BUG-05 | Phase 2 | Pending |
| BUG-06 | Phase 2 | Pending |
| BUG-01 | Phase 3 | Pending |
| BUG-02 | Phase 3 | Pending |
| BUG-03 | Phase 3 | Pending |
| BUG-04 | Phase 3 | Pending |
| ENH-01 | Phase 4 | Pending |
| ENH-02 | Phase 4 | Pending |
| ENH-03 | Phase 4 | Pending |
| ENH-04 | Phase 4 | Pending |
| ENH-05 | Phase 4 | Pending |
| ENH-06 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-05-09 after roadmap creation*
