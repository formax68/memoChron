# MemoChron

## What This Is

MemoChron is an Obsidian plugin that integrates public iCalendar (`.ics`) feeds into the vault — rendering a month/week calendar grid and a daily agenda, and turning calendar events into linkable notes. It's for Obsidian users who want their external calendars (Google, iCloud, work calendars, etc.) visible and actionable from inside their vault.

## Core Value

Show the user's calendar inside Obsidian and let them turn any event into a structured note in one click — reliably, across desktop and mobile.

## Current Milestone: v1.15 Directory Compliance

**Goal:** Close every finding on the Obsidian community-plugin Review scorecard (lift the badge from "Risks" → "Excellent") and install lint/doc guardrails so the same rules cannot lapse on future work.

**Target features:**
- Console-logging cleanup at flagged sites + codebase audit for the same pattern
- Eliminate `innerHTML` / `outerHTML` writes; adopt `createEl` / `createDiv` / `setText` everywhere
- Replace `element.style.*` inline styles with CSS classes / `setCssProps`
- Remove the view-in-`registerView` memory-leak pattern (`plugin.calendarView = view`)
- Popout-window compatibility (`activeDocument`, `activeWindow.setTimeout()`)
- `instanceof TFile` narrowing instead of `as TFile` casts
- Promise hygiene (no floating promises; no `Promise`-returning methods on `void`-typed interfaces)
- TypeScript hygiene (no `any`, fix nullish-on-lhs of `??`, lexical decls in `case`, unnecessary escape chars)
- Unused vars/imports cleanup (~21 named symbols flagged by the scorecard)
- Manifest description punctuation
- GitHub release artifact attestation (workflow change)
- Lint guardrails (`.eslintrc` with Obsidian plugin rules + CI hook) and updated `CLAUDE.md` / `.planning/codebase/` conventions to prevent regression
- Fix `BUG-07`: toggling the plugin in Obsidian Settings closes the Settings modal

## Requirements

### Validated

<!-- Existing capabilities shipped through v1.14.0. Locked unless explicit re-discussion. -->

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
- ✓ **`CalendarService` cache-expiry reads live `refreshInterval`** — v1.14.0 / Phase 1 (TD-01)
- ✓ **`NoteService` reads live plugin settings via getter** — v1.14.0 / Phase 1 (TD-02)
- ✓ **`onunload` cancels tracked timers and detaches leaves** — v1.14.0 / Phase 1 (TD-03)
- ✓ **`CalendarView` drag listeners cleaned up on view close** — v1.14.0 / Phase 1 (TD-04)
- ✓ **Dead code removed (`calculateEndDate`, `DEFAULT_TEMPLATE_PATH`, `TEMPLATE_VARIABLES`, unused imports)** — v1.14.0 / Phase 1 (CLEAN-01)
- ✓ **Load-time + render-time defense against malicious color strings in `data.json`** — v1.14.0 / Phase 2 (SEC-01, `colorValidation.ts` + `buildColorSwatch` via `createElementNS`)
- ✓ **Meaningful error messages in every catch block** — v1.14.0 / Phase 2 (SEC-02, `errors.ts errorMessage()` helper, 18 catch sites normalized)
- ✓ **`getStartOfWeek` correctness verified for all `firstDayOfWeek` values (0–6)** — v1.14.0 / Phase 2 (BUG-05, 49-cell trace recorded)
- ✓ **Concurrent-fetch deduplication via shared in-flight Promise** — v1.14.0 / Phase 2 (BUG-06, `fetchInFlight` field on `CalendarService`)
- ✓ **Daily-note filename parses to the local calendar day in non-UTC timezones** — v1.14.0 / Phase 3 (BUG-01, `parseLocalDate` helper in `viewRenderers.ts` with month/day range guard)
- ✓ **`navigate(delta)` synchronous render path decoupled from network fetch** — v1.14.0 / Phase 3 (BUG-02, `maybeBackgroundRefresh` fire-and-forget helper on `CalendarView`)
- ✓ **`goToToday()` unconditional recenter; view-mode preserved across drag-resize** — v1.14.0 / Phase 3 (BUG-03, `isSameMonth` short-circuit removed)
- ✓ **`29-01-2026` parses to 29 January 2026 under DD-MM-YYYY; BUG-04 closure documented in source** — v1.14.0 / Phase 3 (BUG-04, greppable closure comment at `viewRenderers.ts` `formats` array)
- ✓ **Persistent today-vs-selected indicator on calendar grid** — v1.14.0 / Phase 4 (ENH-01)
- ✓ **Note-exists icon in agenda; toggleable corner marker on calendar grid** — v1.14.0 / Phase 4 (ENH-02 + ENH-03)
- ✓ **`DD-MM-YYYY` (NL/EU) date-format option for note titles** — v1.14.0 / Phase 4 (ENH-04)
- ✓ **`{{day}}` and `{{month}}` template variables emit named day/month** — v1.14.0 / Phase 4 (ENH-05)
- ✓ **`{{cursor}}` template marker places editor cursor after note open** — v1.14.0 / Phase 4 (ENH-06)

### Active

<!-- v1.15 Directory Compliance milestone — close Obsidian community-plugin scorecard findings + add guardrails. -->

**Directory scorecard findings (Obsidian Review):**
- [ ] **DIR-01**: Console logging — flagged sites in `CalendarService.ts` (~3) and `SettingsTab.ts` (~1) removed or gated; full codebase audit completed
- [ ] **DIR-02**: `innerHTML` / `outerHTML` writes replaced with `createEl` / `createDiv` / `setText` / DOM API at every site
- [ ] **DIR-03**: `element.style.*` inline assignments (border, color, cursor, display, fontSize, height, left, margin, marginTop, opacity, padding, position, textAlign, top, width) replaced with CSS classes or `setCssProps`
- [ ] **DIR-04**: String-literal element-creation patterns replaced with the Obsidian `createEl({ cls, text })` / `createDiv({ cls })` helpers across views (calendar grid, agenda, settings, embedded views)
- [ ] **DIR-05**: View memory-leak fixed — `plugin.calendarView = view` removed from inside `registerView`; the view is constructed and returned directly
- [ ] **DIR-06**: Popout-window compatibility — `document` → `activeDocument`, `setTimeout()` → `activeWindow.setTimeout()` (or `this.app.workspace.activeWindow.setTimeout` per Obsidian API)
- [ ] **DIR-07**: `instanceof TFile` narrowing replaces all `as TFile` casts
- [ ] **DIR-08**: Promise hygiene — no floating promises; methods overriding `MarkdownRenderChild` lifecycle return the declared type; `.catch` / `void` annotations at fire-and-forget sites
- [ ] **DIR-09**: TypeScript hygiene — eliminate `any`, fix nullish-on-lhs of `??`, lexical declarations in `case` blocks, unnecessary escape characters
- [ ] **DIR-10**: Unused vars/imports cleaned up (~21 named symbols flagged by ESLint via the directory scorecard)
- [ ] **DIR-11**: `manifest.json` `description` ends with terminating punctuation (`.`, `!`, or `?`)
- [ ] **DIR-12**: GitHub release workflow attaches artifact attestation to `manifest.json`, `main.js`, `styles.css`

**Bug fixes (open issues from this milestone):**
- [ ] **BUG-07**: Toggling MemoChron on/off from Obsidian's Community Plugins list does not close the Settings modal — root-cause investigation followed by minimal fix, or, if Obsidian-side, documented closure

**Documentation & guardrails:**
- [ ] **DOC-01**: `.eslintrc` (or `eslint.config.js`) installed and wired with rules matching the directory scorecard (no `innerHTML`, no inline styles, no `console.log`, no `as TFile`, no `Promise`-returning `MarkdownRenderChild` overrides, no floating promises, no `any`); `npm run lint` script added; CI runs lint
- [ ] **DOC-02**: `CLAUDE.md` and `.planning/codebase/CONVENTIONS.md` updated with the directory-compliance rules (do/don't list with one-line rationale per rule) so future plans land compliant by default

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
- **Remaining fragility refactors not covered by v1.15** — wrapping `window.moment` in a utility, replacing `jCal[2]` with `VALUE=DATE`, switching `hasSourceMismatch` to URL-based identity — stable in practice, defer (note: `innerHTML` → `createEl` is now in-scope as DIR-02 / DIR-04)

## Context

**Existing brownfield codebase** mapped on 2026-05-09 (`.planning/codebase/`):
- TypeScript 4.7.4 plugin, **current shipped version `1.14.0`** (`manifest.json`)
- Built with esbuild → `main.js` (CJS), externalizes `obsidian`/Electron/CodeMirror
- Source layout: `src/main.ts`, `src/services/`, `src/views/`, `src/settings/`, `src/utils/`, `src/types/`
- Critical runtime deps: `ical.js`, `luxon`, `obsidian-daily-notes-interface`
- No tests; no `.eslintrc` despite eslint devDependencies installed (v1.15 fixes this)

**Why this milestone now:** the **Obsidian community-plugin Review scorecard** for v1.13.1 currently shows **"Risks" (1/4 red)** — driven by a long list of guideline violations (console logging, `innerHTML`, inline styles, `as TFile` casts, view-in-`registerView` memory leak, missing popout-window helpers, floating promises, `any` usage, missing release attestation). None are blockers, but together they keep the badge red, which is a passive disincentive for new users browsing the directory. The v1.14.0 release also has not been re-checked by the directory yet, so this is the right moment to land everything in one compliance pass before re-submission. Critically, **without lint/CI guardrails the same issues will re-grow** — so the milestone explicitly includes installing those guardrails.

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
| Stabilization milestone, not feature milestone | 18 mapped concerns + 7 open issues need triage; new features land on a shaky base otherwise | Shipped as v1.14.0 (2026-05-12) |
| "Critical only" tech debt slice (lifecycle + security + known bugs + dead code) | Bigger fragility/perf refactors are not user-blocking; addressing them risks scope sprawl | Shipped as v1.14.0 |
| Defer all big features (#30 CalDAV, #37 Apple, #38 bulk) | None block current users; each is a milestone-sized effort on its own | Still deferred |
| Defer test suite to its own milestone | A meaningful suite (parser, timezone, file-path) is non-trivial and would dominate this milestone's time budget | Still deferred |
| Defer accessibility work to its own milestone | Keyboard nav + ARIA across calendar grid is significant UX work, not a side-quest | Still deferred |
| Cherry-pick #56 sub-items: indicators + dates + caret only | Locale, template-files, and Outlook attendees are each substantial sub-projects; the rest fit a stabilization milestone | Shipped as v1.14.0 |
| **v1.15 Directory Compliance milestone** | Obsidian scorecard reads "Risks" on v1.13.1 — close every finding so the next directory re-check flips it to "Excellent" | — Pending |
| **Install lint/CI guardrails alongside the fixes** | Without `.eslintrc` enforcing the same rules, the violations will re-grow in any future feature milestone | — Pending |
| **Fold previously-deferred FRAG-04 (`innerHTML` → `createEl`) into v1.15** | It is a directory scorecard finding (DIR-02 / DIR-04); cheaper to do in this pass than to keep deferring | — Pending |

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
*Last updated: 2026-05-13 — v1.15 Directory Compliance milestone started; v1.14.0 (Stabilization) shipped 2026-05-12*
