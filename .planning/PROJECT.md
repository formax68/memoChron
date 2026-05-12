# MemoChron

## What This Is

MemoChron is an Obsidian plugin that integrates public iCalendar (`.ics`) feeds into the vault — rendering a month/week calendar grid and a daily agenda, and turning calendar events into linkable notes. It's for Obsidian users who want their external calendars (Google, iCloud, work calendars, etc.) visible and actionable from inside their vault.

## Core Value

Show the user's calendar inside Obsidian and let them turn any event into a structured note in one click — reliably, across desktop and mobile.

## Requirements

### Validated

<!-- Existing capabilities shipped through v1.13.1. Locked unless explicit re-discussion. -->

- ✓ **Public iCalendar URL fetching and parsing** — existing (`CalendarService` + `ical.js`)
- ✓ **Calendar grid view with month/week modes** — existing (`CalendarView`)
- ✓ **Agenda view with sticky date headers** — existing (`CalendarView` + `viewRenderers`)
- ✓ **Click-to-create event notes with frontmatter and template** — existing (`NoteService`)
- ✓ **Embedded calendar / agenda code-block views** — existing (`EmbeddedCalendarView`, `EmbeddedAgendaView`)
- ✓ **Multi-source calendars with per-source colors and toggles** — existing (settings + filter logic)
- ✓ **Recurrence rule expansion (RRULE, EXDATE, overrides)** — existing (ical.js)
- ✓ **Timezone conversion (Windows → IANA via luxon)** — existing (`timezoneUtils`)
- ✓ **Daily Notes integration via `obsidian-daily-notes-interface`** — existing
- ✓ **Settings tab with calendar URL management and per-source styling** — existing (`SettingsTab`)
- ✓ **One-time ICS file import** — existing (`IcsImportService`)
- ✓ **Auto-refresh on a configurable interval** — existing
- ✓ **Date formats for note titles incl. US/UK hyphenated dates** — existing (fix #58, commit f31cc5b)
- ✓ **URL validation guardrail for calendar URLs** — existing (commit 99d26a9)
- ✓ **BRAT-compatible pre-release flow for beta testing** — existing
- ✓ **Load-time + render-time defense against malicious color strings in `data.json`** — Phase 2 (SEC-01, `colorValidation.ts` + `buildColorSwatch` via `createElementNS`)
- ✓ **Meaningful error messages in every catch block** — Phase 2 (SEC-02, `errors.ts errorMessage()` helper, 18 catch sites normalized)
- ✓ **`getStartOfWeek` correctness verified for all `firstDayOfWeek` values (0–6)** — Phase 2 (BUG-05, 49-cell trace recorded)
- ✓ **Concurrent-fetch deduplication via shared in-flight Promise** — Phase 2 (BUG-06, `fetchInFlight` field on `CalendarService`)
- ✓ **Daily-note filename parses to the local calendar day in non-UTC timezones** — Phase 3 (BUG-01, `parseLocalDate` helper in `viewRenderers.ts` with month/day range guard)
- ✓ **`navigate(delta)` synchronous render path decoupled from network fetch** — Phase 3 (BUG-02, `maybeBackgroundRefresh` fire-and-forget helper on `CalendarView`)
- ✓ **`goToToday()` unconditional recenter; view-mode preserved across drag-resize** — Phase 3 (BUG-03, `isSameMonth` short-circuit removed)
- ✓ **`29-01-2026` parses to 29 January 2026 under DD-MM-YYYY; BUG-04 closure documented in source** — Phase 3 (BUG-04, greppable closure comment at `viewRenderers.ts` `formats` array)

### Active

<!-- Stabilization milestone — bug fixes, critical tech debt, small UX enhancements. -->

**Bug fixes (open GitHub issues + known bugs in CONCERNS.md):**
- [x] **BUG-01**: Fix off-by-one date when reading event date from filename in non-UTC timezones (#59) — Phase 3
- [x] **BUG-02**: Improve perceived performance of month/week navigation arrows (#54) — Phase 3
- [x] **BUG-03**: Sync the view-mode dropdown with manual drag-resize so the Today button navigates correctly (#54) — Phase 3
- [x] **BUG-04**: Verify the date-parsing bug from #56 (`29-01-2026` → `20/01/2029`) is resolved after fix #58, or close it out — Phase 3

**Lifecycle and cleanup tech debt:**
- [ ] **TD-01**: `CalendarService` cache-expiry uses live `refreshInterval` instead of a stale constructor copy
- [ ] **TD-02**: `NoteService` reads live settings via getter or plugin reference (no stale reference)
- [ ] **TD-03**: `onunload` cancels tracked timeouts (background-refresh, view-init) and disposes services/views cleanly
- [ ] **TD-04**: Drag listeners on `window` are cleaned up if `CalendarView` is destroyed mid-drag

**Security tech debt:** *(SEC-01 + SEC-02 closed in Phase 2 — see Validated)*

**Dead-code cleanup:**
- [ ] **CLEAN-01**: Remove unused private `calculateEndDate`, dead imports (`App`, `TFile`, `renderAgendaList`), and dead constants (`DEFAULT_TEMPLATE_PATH`, `TEMPLATE_VARIABLES`) — or annotate with explicit deprecation if intentional

**Small UX enhancements (open GitHub issues):**
- [ ] **ENH-01**: Persistent visual indicator for today on the calendar grid, distinct from the selected-day highlight (#55)
- [ ] **ENH-02**: Sidebar/agenda visual indicator for events that already have an associated note (#56)
- [ ] **ENH-03**: Optional, toggleable indicator on the calendar grid for days containing events with notes (#56)
- [ ] **ENH-04**: Add `DD-MM-YYYY` (NL) date format option for note titles (#56)
- [ ] **ENH-05**: Add `{{day}}` and `{{month}}` template variables that emit fully written names (e.g. `Monday`, `January`) (#56)
- [ ] **ENH-06**: Caret placement control in newly-created event notes (variable like `{{cursor}}` or a setting) (#56)

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- **CalDAV protocol support (#30)** — substantial architectural change (auth, write-paths, sync); deserves its own feature milestone
- **Real-time Apple Calendar integration (#37)** — needs OS-level integration outside the plugin sandbox; not a plugin concern
- **Auto/bulk event import (#38)** — `IcsImportService` already handles one-shot import; bulk/auto deferred to a dedicated import milestone
- **Locale customization for calendar/output (#56)** — full i18n is large; defer to a dedicated localization milestone
- **Template-file support (#56)** — bigger templating system; defer until other note-template improvements stabilize
- **Outlook/Exchange attendees + Description field fixes (#56)** — needs real Outlook ICS samples to verify; defer to a calendar-compatibility milestone
- **Test suite** — there are zero tests today; adding a meaningful suite is a separate milestone, not a side-quest of this stabilization pass
- **Accessibility (keyboard navigation, ARIA, focus management)** — significant UX work, deserves its own scoped milestone
- **Non-critical performance refactors** — settings-tab incremental rendering, widget event-fetch caching, replacing magic 50/100ms timeouts with `requestIdleCallback` / `requestAnimationFrame`, settings-change debouncing — defer to a perf milestone
- **Non-critical fragility refactors** — wrapping `window.moment` in a utility, replacing `jCal[2]` with `VALUE=DATE`, switching `hasSourceMismatch` to URL-based identity, replacing static-HTML `innerHTML` with `createEl` — stable in practice, defer

## Context

**Existing brownfield codebase** mapped on 2026-05-09 (`.planning/codebase/`):
- TypeScript 4.7.4 plugin, ~current version `1.13.1` (`manifest.json`)
- Built with esbuild → `main.js` (CJS), externalizes `obsidian`/Electron/CodeMirror
- Source layout: `src/main.ts`, `src/services/`, `src/views/`, `src/settings/`, `src/utils/`, `src/types/`
- Critical runtime deps: `ical.js`, `luxon`, `obsidian-daily-notes-interface`
- No tests; no `.eslintrc` despite eslint deps installed

**Why this milestone now:** the codebase has accumulated 18 documented concerns and 7 open GitHub issues, several of which overlap (e.g. dead `DEFAULT_TEMPLATE_PATH` constant vs. user requests for richer template support). The product is stable in normal use but has lifecycle bugs that surface when settings change at runtime, security smells that the Obsidian review team would flag at directory submission, and small UX gaps that hit users daily. A focused stabilization pass now sets up the next feature milestone (CalDAV / Apple / bulk import) on a clean base.

**Distribution model:** beta releases via GitHub pre-release + BRAT; production release tags are uploaded with `manifest.json`, `main.js`, `styles.css` as binary assets. `versions.json` maps plugin version → minimum Obsidian version. See `CLAUDE.md` for full release strategy.

## Constraints

- **Tech stack**: TypeScript / esbuild / Obsidian API / `ical.js` / `luxon` — established and not up for re-evaluation in this milestone
- **Compatibility**: Must run on Obsidian ≥ 1.8.9 desktop **and** mobile (`isDesktopOnly: false`)
- **Security**: No remote code execution; no user data sent to external services; all network requests go through Obsidian's `requestUrl()` for proper proxying
- **Release flow**: BRAT-compatible — version in `manifest.json` must match release tag exactly; `package.json` and `manifest.json` versions stay in sync via `version-bump.mjs`
- **Commit hygiene**: Per `CLAUDE.md`, commit messages and release notes must NOT reference Claude or AI assistance
- **No new tests this milestone**: deferred per scope decision (see Out of Scope)
- **No accessibility work this milestone**: deferred per scope decision (see Out of Scope)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stabilization milestone, not feature milestone | 18 mapped concerns + 7 open issues need triage; new features land on a shaky base otherwise | — Pending |
| "Critical only" tech debt slice (lifecycle + security + known bugs + dead code) | Bigger fragility/perf refactors are not user-blocking; addressing them risks scope sprawl | — Pending |
| Defer all big features (#30 CalDAV, #37 Apple, #38 bulk) | None block current users; each is a milestone-sized effort on its own | — Pending |
| Defer test suite to its own milestone | A meaningful suite (parser, timezone, file-path) is non-trivial and would dominate this milestone's time budget | — Pending |
| Defer accessibility work to its own milestone | Keyboard nav + ARIA across calendar grid is significant UX work, not a side-quest | — Pending |
| Cherry-pick #56 sub-items: indicators + dates + caret only | Locale, template-files, and Outlook attendees are each substantial sub-projects; the rest fit a stabilization milestone | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-12 after Phase 3 (Date Parsing & Navigation Bugs) completion*
