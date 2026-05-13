# Requirements: MemoChron — v1.15 Directory Compliance

**Defined:** 2026-05-13
**Core Value:** Show the user's calendar inside Obsidian and let them turn any event into a structured note in one click — reliably, across desktop and mobile.

## v1 Requirements

Requirements for the v1.15 Directory Compliance milestone. Closes the Obsidian community-plugin Review scorecard findings (currently "Risks" on v1.13.1) and installs lint/doc guardrails to prevent regression. Every requirement maps to a roadmap phase.

### Directory scorecard findings

- [ ] **DIR-01**: No `console.log` / `console.info` / `console.debug` / `console.warn` / `console.error` calls remain in shipped code at the four flagged sites (`CalendarService.ts:249, 282, 324` and `SettingsTab.ts:1720`); the codebase is audited for the same pattern and any remaining sites are either removed or gated behind a developer-only debug flag that is `false` by default
- [ ] **DIR-02**: No `.innerHTML` or `.outerHTML` write occurs anywhere in shipped code; every site is rewritten using `createEl({ cls, text, attr })`, `createDiv({ cls })`, `setText()`, or `createElementNS` for SVG
- [ ] **DIR-03**: No `element.style.<property>` assignment occurs in shipped code; every flagged property (`border, color, cursor, display, fontSize, height, left, margin, marginTop, opacity, padding, position, textAlign, top, width`) is replaced with a CSS class addition / removal or `setCssProps({ ... })` for dynamic values
- [ ] **DIR-04**: All DOM-construction sites in `CalendarView`, `EmbeddedCalendarView`, `EmbeddedAgendaView`, `SettingsTab`, and `viewRenderers` use the Obsidian `createEl` / `createDiv` / `createSpan` helpers exclusively — no `document.createElement(...)` and no string-literal HTML
- [ ] **DIR-05**: `registerView` callback constructs and returns the `CalendarView` instance directly; no `plugin.calendarView = view` assignment occurs inside the callback; the view is fetched lazily from the workspace when other components need it
- [ ] **DIR-06**: All `document` references that should reflect the active popout use `activeDocument`; all `setTimeout` / `setInterval` calls that fire in a view context use `activeWindow.setTimeout` / `activeWindow.setInterval` (or the workspace-aware equivalent)
- [ ] **DIR-07**: No `as TFile` cast occurs in shipped code; every site that consumes a `TAbstractFile` narrows via `instanceof TFile` first
- [ ] **DIR-08**: No floating promise occurs in shipped code; every `Promise`-returning call is either `await`ed, given an explicit `.catch` handler, or marked with the `void` operator. `EmbeddedCalendarView` and `EmbeddedAgendaView` lifecycle methods (`onload`, `onunload`) match the synchronous return type required by `MarkdownRenderChild`
- [ ] **DIR-09**: No `any` type appears in shipped source code (test fixtures and `.d.ts` shims excepted); `??` operators do not appear with a constant left-hand side; no lexical declarations appear inside `case` blocks without a block scope; no unnecessary escape characters remain in regular expression literals
- [ ] **DIR-10**: ESLint reports zero `@typescript-eslint/no-unused-vars` violations across the source tree (the 21 names flagged by the scorecard — `App`, `CalendarEvent`, `CalendarNotesSettings`, `controls`, `convertTimezone`, `date`, `DateElements`, `DEFAULT_CALENDAR_URLS`, `DropdownComponent`, `e`, `error`, `isNewNote`, `MemoChronSettings`, `Notice`, `plugin`, `Property`, `renderAgendaList`, `target`, `TextAreaComponent`, `TFile`, `title` — are all either deleted or genuinely used)
- [x] **DIR-11**: `manifest.json` `description` field ends with `.`, `!`, or `?`
- [ ] **DIR-12**: The GitHub release workflow that publishes `manifest.json`, `main.js`, and `styles.css` attaches a GitHub artifact attestation to every release asset

### Bugs

- [ ] **BUG-07**: Toggling the MemoChron plugin on/off from Obsidian's Community Plugins list does not close the Settings modal. If root cause is in MemoChron (e.g. `onunload` triggers a workspace event that detaches the active modal leaf), the fix preserves the modal. If root cause is in Obsidian core behavior, BUG-07 is closed with a written explanation and a regression-test note

### Documentation & guardrails

- [ ] **DOC-01**: A working ESLint configuration (`.eslintrc.json` or `eslint.config.js`) is installed and enforces — at minimum — `no-console`, `no-inner-html`, the Obsidian community linting rules (no inline styles, no `as TFile` cast, no view-in-`registerView`, popout-window helpers), `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-explicit-any`, and `@typescript-eslint/no-unused-vars`. `npm run lint` is a script in `package.json`. CI (`.github/workflows/`) runs lint on every push and PR. A failing lint blocks the build
- [ ] **DOC-02**: `CLAUDE.md` and `.planning/codebase/CONVENTIONS.md` (new or merged into existing codebase docs) carry a "Directory Compliance" do/don't section — one short rule per scorecard finding, each with a one-line rationale and a link to the relevant Obsidian docs page — so future plans land compliant by default

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

> `FRAG-04` (`innerHTML` → `createEl`) has been folded into v1.15 (DIR-02 / DIR-04).

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
| Replacing magic 50/100ms timeouts | Functional today; defer to perf milestone (not flagged by scorecard) |
| `window.moment` utility wrapper | Stable in practice; defer to fragility milestone (not flagged by scorecard) |
| `jCal[2]` → `VALUE=DATE` cleanup | Stable in practice; defer to fragility milestone (not flagged by scorecard) |
| `hasSourceMismatch` URL-canonical refactor | Edge-case-only; defer to fragility milestone |
| Cosmetic README / image / changelog overhauls | Not flagged by directory scorecard; defer to a marketing pass |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIR-01 | Phase 8 | Pending |
| DIR-02 | Phase 6 | Pending |
| DIR-03 | Phase 6 | Pending |
| DIR-04 | Phase 6 | Pending |
| DIR-05 | Phase 7 | Pending |
| DIR-06 | Phase 7 | Pending |
| DIR-07 | Phase 7 | Pending |
| DIR-08 | Phase 7 | Pending |
| DIR-09 | Phase 8 | Pending |
| DIR-10 | Phase 8 | Pending |
| DIR-11 | Phase 5 | Complete |
| DIR-12 | Phase 5 | Pending |
| BUG-07 | Phase 7 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-05-13*
