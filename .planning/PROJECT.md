# MemoChron

## What This Is

MemoChron is an Obsidian plugin that integrates public iCalendar (`.ics`) feeds into the vault — rendering a month/week calendar grid and a daily agenda, and turning calendar events into linkable notes. It's for Obsidian users who want their external calendars (Google, iCloud, work calendars, etc.) visible and actionable from inside their vault.

## Core Value

Show the user's calendar inside Obsidian and let them turn any event into a structured note in one click — reliably, across desktop and mobile.

## Current State

**Shipped:** v1.15 Directory Compliance (milestone closed 2026-10-31; plugin release `1.16.0` published 2026-10-31, including the IANA time zone fix from PRs #64/#65). All 15 requirements are validated across Phases 05–08.2. Every v1.13.1 scorecard finding is closed in source, and lint, CI and release guardrails now enforce the same rules. Details: `.planning/MILESTONES.md`.

## Next Milestone Goals

Not yet defined. Run `/gsd-new-milestone`. Candidates from carried-forward debt and Out of Scope:
- Re-submit to the Obsidian directory and confirm the scorecard badge moves from "Risks" to "Excellent" (deferred SC6 re-run)
- Docs cleanup: update `## Logging` in CONVENTIONS.md/CLAUDE.md to describe `debugLog` instead of raw `console.*`, and fix the attestation `@v2` → `@v3` reference
- A test-suite milestone (parser, timezone, file-path) or a feature milestone (CalDAV #30, bulk import #38, localization #56)

<details>
<summary>Previous milestone goal: v1.15 Directory Compliance (shipped 2026-10-31)</summary>

**Goal:** Close every finding on the Obsidian community-plugin Review scorecard (lift the badge from "Risks" to "Excellent") and install lint/doc guardrails so the same rules cannot lapse on future work. Target areas: console logging, `innerHTML`/`outerHTML`, inline styles, view-in-`registerView` leak, popout compatibility, `as TFile` casts, promise hygiene, TypeScript hygiene, unused vars, manifest punctuation, release attestation, lint/CI guardrails + conventions, and BUG-07.

</details>

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
- ✓ **DIR-01**: Console logging — 33 sites deleted; forensic logs routed through the silent `src/utils/debug.ts` helper (the only lint-exempt file) — v1.15 (Phases 8, 08.2)
- ✓ **DIR-02**: `innerHTML` / `outerHTML` writes replaced with `createEl` / `createDiv` / `setText` / DOM API at every site — v1.15 (Phase 6)
- ✓ **DIR-03**: `element.style.*` inline assignments replaced with CSS classes or `setCssProps` (custom properties for dynamic colors) — v1.15 (Phases 6, 08.1)
- ✓ **DIR-04**: All view DOM construction uses Obsidian's `createEl` / `createDiv` / `createSpan` helpers — v1.15 (Phase 6)
- ✓ **DIR-05**: `plugin.calendarView` field removed; `registerView` callback is a pure factory; `getCalendarView()` narrows via `instanceof CalendarView` — v1.15 (Phase 7)
- ✓ **DIR-06**: `activeDocument` for document reads in view code; `window.*` prefix on all timers (per amendment A2) — v1.15 (Phase 7)
- ✓ **DIR-07**: `instanceof TFile` narrowing replaces all 4 `as TFile` casts — v1.15 (Phase 7)
- ✓ **DIR-08**: Floating + misused promises classified (`void` / `.catch` / `await`); embedded views use sync `onload(): void` wrappers — v1.15 (Phase 7)
- ✓ **DIR-09**: TypeScript hygiene — 16 `any` sites closed, `no-case-declarations`, `no-useless-escape`, `??` audit clean; typed `moment` import — v1.15 (Phase 8)
- ✓ **DIR-10**: All 21 scorecard-named unused symbols deleted or genuinely consumed — v1.15 (Phase 8)
- ✓ **DIR-11**: `manifest.json` description ends with terminating punctuation — v1.15 (Phase 5)
- ✓ **DIR-12**: Release workflow attests `main.js`, `manifest.json`, `styles.css` (`attest-build-provenance@v3`, verified via `gh attestation verify`) — v1.15 (Phase 5)
- ✓ **BUG-07**: Closed Obsidian-side per `BUG-07-CLOSURE.md`; A1 mitigation removed the disable-direction modal close — v1.15 (Phase 7)
- ✓ **DOC-01**: ESLint enforces the scorecard rules; `npm run lint` fails on any warning or unauthorized inline bypass; CI lints every push/PR and tag releases stop at Lint before build/attest/publish — v1.15 (Phases 5, 08.2; live gate confirmed on 1.16.0-beta.1)
- ✓ **DOC-02**: `## Directory Compliance` do/don't rules in CONVENTIONS.md + CLAUDE.md pointer — v1.15 (Phase 8)
- ✓ **Hyphenated-tag prereleases and stable drafts** — v1.15 (Phase 08.1); Node 20.x/v4 actions, uncached `npm ci`, provenance attestation preserved

### Active

<!-- Next milestone not yet defined — populated by /gsd-new-milestone. -->

(None yet. See Next Milestone Goals.)

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
- TypeScript plugin, **current shipped version `1.16.0`** (`manifest.json` on main; betas carry their own bumped manifest on the tag only)
- ~7,100 lines of TypeScript in `src/`, ~1,300 lines in `styles.css`
- Built with esbuild → `main.js` (CJS), externalizes `obsidian`/Electron/CodeMirror
- Source layout: `src/main.ts`, `src/services/`, `src/views/`, `src/settings/`, `src/utils/`, `src/types/`
- Critical runtime deps: `ical.js`, `luxon`, `obsidian-daily-notes-interface`
- Guardrails (since v1.15): ESLint 9 flat config (`eslint.config.mjs`) with Obsidian rules, `--max-warnings=0` and a directive check. CI lints every push/PR, and the tag-triggered release runs Lint before Build, Attest and Release.
- No tests (by scope decision)

**Known issues / debt after v1.15:** `## Logging` docs still describe raw `console.*`. The release gate's failing-lint path has been tested locally but not live on GitHub. VALIDATION docs for 05/08.1 are still drafts. The scorecard has not been re-checked yet. The deferred items are listed in `MILESTONES.md`.

**Background for v1.15 (historical):** the Obsidian Review scorecard for v1.13.1 showed "Risks" (1/4), driven by guideline violations. v1.15 closed them in one pass and added lint/CI guardrails so they cannot regrow.

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
| **v1.15 Directory Compliance milestone** | Obsidian scorecard reads "Risks" on v1.13.1 — close every finding so the next directory re-check flips it to "Excellent" | ✓ Good — shipped 2026-10-31; scorecard re-check still pending |
| **Install lint/CI guardrails alongside the fixes** | Without `.eslintrc` enforcing the same rules, the violations will re-grow in any future feature milestone | ✓ Good — the audit found the gate was weak (B1/B2); 08.2 hardened it |
| **Fold previously-deferred FRAG-04 (`innerHTML` → `createEl`) into v1.15** | It is a directory scorecard finding (DIR-02 / DIR-04); cheaper to do in this pass than to keep deferring | ✓ Good |
| **Lint gate first, using phase-tagged overrides** | Rules are enforced while the rest of the milestone runs; each override names the phase that removes it | ✓ Good — every override was removed by Phase 8 |
| **BUG-07 closed Obsidian-side** | Enable-direction modal close is in Obsidian core and affects core plugins too | ✓ Good |
| **Release runs Lint before Build/Attest/Publish** | A tag must not ship code that fails lint (audit B1) | ✓ Good — confirmed live on 1.16.0-beta.1 |
| **Beta tags carry the bumped manifest; main stays stable** | Stops Obsidian offering betas to stable users | ✓ Good |
| **Single silent `debug.ts` helper is the only console exemption** | Keeps `no-console` fatal everywhere else (audit B2) | ✓ Good; Logging docs still need updating |

## Evolution

Phase 08.1 decisions (2026-10-30):
- Publish hyphenated beta/RC tags as non-draft prereleases; stable tags retain manual-publish drafts.
- Retain the existing Daily Note CSS hook and use custom properties for dynamic painting.
- Preserve the no-new-tests milestone constraint. Manual coverage was explicitly approved after all four UAT checks passed; automated behavioral coverage remains partial.

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
*Last updated: 2026-10-31 after v1.15 milestone*
