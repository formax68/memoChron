---
phase: 02-security-correctness
verified: 2026-05-11T06:43:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Load Obsidian with a vault whose .obsidian/plugins/memochron/data.json contains a calendarUrls entry whose color is the literal string \"><script>alert(1)</script>"
    expected: "Plugin loads without an alert firing; the loaded settings show the calendar with a fallback hsl(...) color; console.warn contains 'MemoChron: Invalid color' diagnostic"
    why_human: "Real end-to-end test requires running Obsidian against a crafted data.json — static analysis confirms the load-time validator code path runs, but observing the absence of script execution requires a live runtime"
  - test: "With the settings tab open, programmatically set settings.calendarUrls[0].color to \">\\\"<svg/onload=alert(1)>\" via DevTools and re-render the swatch"
    expected: "Swatch falls back to plus-icon (isValidColor rejects the value); no script executes; no markup leaks into the DOM"
    why_human: "Render-time defensive guard verification requires interacting with the live settings UI"
  - test: "Visual regression: open Obsidian settings, expand each calendar source's color section and the daily-note color section"
    expected: "Color swatches render visually identical to pre-Phase-2 implementation (same circle dimensions, same plus icon for unset colors, same fill for set colors)"
    why_human: "createElementNS migration is structurally correct but visual parity requires human inspection"
  - test: "Drop a malformed (non-Error throwable) into the calendar fetch path or ICS-import drop handler"
    expected: "User-facing Notice reads a meaningful stringified message — never 'undefined' or '[object Object]'"
    why_human: "Real-world non-Error throwables from network/ical.js paths can only be observed at runtime; static analysis confirms errorMessage() wraps every catch but not the actual UX feel"
  - test: "Trigger two near-simultaneous fetches: click Force Refresh while the auto-refresh timer fires (or invoke fetchCalendars twice from DevTools without awaiting)"
    expected: "Only one network round-trip; both callers receive the same CalendarEvent[]; no duplicate events appear in the agenda; no double-render of the calendar grid"
    why_human: "Race verification requires runtime observation; static analysis confirms the fetchInFlight promise dedup logic is correctly structured"
deferred_concerns: # Known plan-acknowledged scope exclusions surfaced by review
  - concern: "CR-01 — Five innerHTML = '<strong>...' literals remain in CalendarUrlHelpModal at SettingsTab.ts:1863, 1880, 1901-1903"
    decision: "Out of scope per plan 02-02 D-07 (deferred to FRAG-04). The strings contain static <strong> tags with no user-controlled interpolation; no exploitation path. Roadmap SC #2 is scoped to SVG color swatches, not all innerHTML in SettingsTab.ts."
    risk: "Low — pattern hygiene only; if a future refactor interpolates user input into these literals, the lint cannot warn"
  - concern: "CR-02 — fetchInFlight guard ignores forceRefresh; user clicking Force Refresh during an in-flight non-force fetch receives the non-force result"
    decision: "Out of scope per plan 02-05 D-14 (force-refresh-during-fetch UX nuance explicitly deferred). Roadmap SC #5 is scoped to 'no double-render or duplicate event list', which the shared-Promise approach satisfies."
    risk: "Medium — user-visible UX degradation if real users complain. Reviewer flagged as a near-miss the phase should consider. Recommend tracking as a follow-up; not a phase-2 blocker per D-14."
  - concern: "WR-01 — fetchInFlight does not cover the cache-loading window (isLoadingCache)"
    decision: "Pre-existing condition; not a regression introduced by Phase 2. SC #5 'no double-render or duplicate event list' is satisfied for the actual fetch path the shared promise covers"
    risk: "Low — narrow race between cache-load and fetch; rare in practice"
  - concern: "WR-02 — firstDayOfWeek lacks bounds-checking in loadSettings"
    decision: "Pre-existing condition; SC #4 is scoped to firstDayOfWeek 0..6 which is what the settings dropdown produces. Tampered data.json with invalid firstDayOfWeek not in the phase scope"
    risk: "Low — consistent with the SEC-01 threat model, but not explicitly required by phase 2"
---

# Phase 2: Security & Correctness Verification Report

**Phase Goal:** Plugin loads cleanly even with corrupted or malicious color values in saved settings, every catch block emits a meaningful message, and the three small standalone bugs that do not depend on BUG-01 are resolved
**Verified:** 2026-05-11T06:43:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap SC) | Status | Evidence |
|---|--------------------|--------|----------|
| 1 | Loading a vault whose `data.json` contains a crafted color string does not inject markup — value replaced with default color at `loadSettings` time | VERIFIED | `src/main.ts:104-127` runs `isValidColor()` against each `calendarUrls[].color` and `dailyNoteColor`; invalid values replaced with `defaultColorForIndex(i)` / `defaultDailyNoteColor()`; `console.warn` emitted with offending value. `src/utils/colorValidation.ts:13-14` regex anchored `^...$`, hex `{3,4,6,8}` digits only, `hsl/rgb/var` branches reject `<>` markup-breaking chars. Node REPL spot-check confirms `isValidColor("\"><script>alert(1)</script>")` returns `false` (11/11 test inputs match expected) |
| 2 | SVG color swatches in settings tab constructed via `createElementNS` — no template-literal injection path at render time | VERIFIED | `src/settings/SettingsTab.ts:557-593` `buildColorSwatch()` uses `document.createElementNS("http://www.w3.org/2000/svg", "svg" \| "circle" \| "text")` + `setAttribute()` for every attribute including fill. Both swatch call sites (lines 643, 726) use `customLabel.appendChild(this.buildColorSwatch(...))`. `grep -c 'customLabel.innerHTML' src/settings/SettingsTab.ts` returns 0 — no remaining innerHTML injection sinks for swatches. Render-time defensive `isValidColor()` guard at line 571. NOTE: five non-swatch innerHTML literals remain in CalendarUrlHelpModal (static <strong> content, no user input, scoped to SC #2 boundary — see CR-01 in deferred_concerns) |
| 3 | Every visible error shows a specific message rather than `[object Object]` or `undefined` | VERIFIED | `src/utils/errors.ts:8-10` `errorMessage(err: unknown): string` returns `err instanceof Error ? err.message : String(err)`. Every in-scope catch block routes through the helper: `CalendarService.ts` (5 sites: 255, 299, 343, 402, 540) including unsafe `error.message` accesses at the former 396, 398, 532 rewritten to `message.includes(...)`. `NoteService.ts` (6 sites at 75, 127, 165, 268, 290, 416; `catch (error: any)` removed). `CalendarView.ts` (5 sites including the user-visible Notice at 977 `new Notice(\`Failed to import: ${message}\`)`). `IcsImportService.ts` (sites 31, 83). `EmbeddedCalendarView.ts:234`, `EmbeddedAgendaView.ts:377`, `timezoneUtils.ts` (sites 178, 199, 223 — diagnostic context object preserved). Final scan `grep -nE 'error\.message' src/services/CalendarService.ts src/services/NoteService.ts src/services/IcsImportService.ts src/views/CalendarView.ts src/views/EmbeddedCalendarView.ts src/views/EmbeddedAgendaView.ts src/utils/timezoneUtils.ts` returns zero unsafe matches |
| 4 | `getStartOfWeek` returns the correct week-start for every `firstDayOfWeek` 0–6, including Saturday-start | VERIFIED | `src/views/CalendarView.ts:425-431` preserves the formula `d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay`. Node REPL independent re-trace of all 49 (firstDayOfWeek, getDay()) cells using reference dates 2026-05-10..16: 49/49 ✓. Specific must_have edge cases re-verified: `firstDay=6, ref=Sat 5/16/2026` → returns Sat 5/16 ✓ (same day, not a week earlier); `firstDay=0, ref=Sun 5/10/2026` → returns Sun 5/10 ✓ (same date when Sunday IS the week start). JSDoc above function references BUG-05 and the 02-04-SUMMARY.md trace. REQUIREMENTS.md's claim of "currently broken for Saturday-start" was traced and DISPROVEN — formula was correct-but-non-obvious; CONCERNS.md analysis confirmed by verifier |
| 5 | A second background-refresh while a fetch is in flight does not produce a double-render or duplicate event list | VERIFIED | `src/services/CalendarService.ts:41` `private fetchInFlight: Promise<CalendarEvent[]> \| null = null` replaces the boolean `isFetchingCalendars` (zero remaining references confirmed via `grep -c "isFetchingCalendars"`). Entry guard at lines 51-53 returns the in-flight promise (not stale `this.events`) for concurrent callers. Assignment at lines 80-82 wraps `performFetch(...)` in `.finally(() => { this.fetchInFlight = null; })` to clear after settlement. `performFetch` at lines 236-263 no longer toggles any flag; old `finally` block removed. `scheduleBackgroundRefresh` body (lines 192-206) UNCHANGED — Phase 1 CR-01 `setBackgroundRefreshTimer` wiring preserved. Race trace: caller A starts fetch → fetchInFlight set; caller B (e.g. timer) calls fetchCalendars → guard returns A's promise → both receive same events; `.finally` clears fetchInFlight; caller C after gets fresh fetch. NOTE: forceRefresh-during-in-flight scenario (CR-02) is plan-acknowledged out-of-scope per D-14 — SC #5 is satisfied for the "double-render or duplicate event list" intent |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/colorValidation.ts` | NEW file exporting `isValidColor`, `defaultColorForIndex`, `defaultDailyNoteColor` | VERIFIED | 51 lines; module-private `VALID_COLOR_REGEX` (anchored ^...$); three named exports as specified; no imports (browser globals); JSDoc on each export; Node REPL spot-check 11/11 inputs return expected booleans |
| `src/utils/errors.ts` | NEW file exporting `errorMessage(err: unknown): string` | VERIFIED | 11 lines; single export; body `return err instanceof Error ? err.message : String(err);` matches D-09 spec exactly; no imports; JSDoc present |
| `src/main.ts` | `loadSettings` validates colors at load time | VERIFIED | Imports lines 10-14 add the three colorValidation symbols; `loadSettings()` at 103-128 preserves the original `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` line verbatim and appends validation pass over `calendarUrls.forEach()` + `dailyNoteColor` check; both paths replace invalid values via helper defaults and `console.warn` with `MemoChron:` prefix; no `Notice` introduced |
| `src/settings/SettingsTab.ts` | `buildColorSwatch` helper + both swatch sites use it | VERIFIED | Import line 17 `import { isValidColor } from "../utils/colorValidation"`; private `buildColorSwatch(color: string \| null): SVGElement` at 557-593 uses `createElementNS` + `setAttribute` + `textContent`; sites at 643 and 726 both call `customLabel.appendChild(this.buildColorSwatch(isCustom ? currentColor : null))`; zero `customLabel.innerHTML = "<svg"` matches remain; FRAG-04 deferred static-help-text `innerHTML` sites at 1863, 1880, 1901-1903 intentionally preserved per D-07 (see CR-01 in deferred_concerns) |
| `src/services/CalendarService.ts` | `fetchInFlight` Promise dedup + all non-discarded catches normalized | VERIFIED | `isFetchingCalendars` gone (0 references); `fetchInFlight: Promise<CalendarEvent[]> \| null` at line 41; entry guard 51-53; assignment 80-82 wraps `.finally(clear)`; all 5 non-discarded catches use `errorMessage(error)` (sites 255, 299, 343, 402, 540); unsafe `error.message` accesses rewritten via `const message = errorMessage(error)` extraction in the per-source catch (CORS detection branch now `message.includes('CORS')`) and the local-file outer catch; out-of-scope catches at 350-354 (parameter-less mkdir) and 528-533 (inner adapter.read, discards error) preserved verbatim per D-08 |
| `src/services/NoteService.ts` | All 6 catch blocks normalized; `error: any` removed | VERIFIED | Import line 5; 6 catch sites at 75, 127, 165, 268, 290, 416 all route through `errorMessage(error)`; `catch (error: any)` at site 416 refactored to plain `catch (error)` with `errorMessage(error).includes("already exists")` (the optional `?.` chain is gone since helper always returns string) |
| `src/services/IcsImportService.ts` | Bespoke `instanceof` checks consolidated, re-throw preserved | VERIFIED | Import line 10; site 31-44 consolidates `error instanceof Error && typeof error.message === "string" && (... includes ...)` into `const message = errorMessage(error); if (message.includes(...))`; site 83-88 PRESERVES the `if (error instanceof Error) throw error;` re-throw branch verbatim; fallback enriched with `throw new Error(\`Failed to parse ICS file: ${errorMessage(error)}\`)` |
| `src/views/CalendarView.ts` | All 5 catch blocks normalized; unsafe Notice fixed; getStartOfWeek documented | VERIFIED | Import line 6; 5 catch sites at 149, 170, 770, 859, 974 all normalized; site 974-978 (ICS-import drop handler) extracts `const message = errorMessage(error)` and uses `new Notice(\`Failed to import: ${message}\`)` — the formerly unsafe `error.message` interpolation is gone; `getStartOfWeek` at 425-431 has JSDoc block referencing BUG-05 and the 02-04-SUMMARY.md trace |
| `src/views/EmbeddedCalendarView.ts` | Catch at ~233 normalized | VERIFIED | Import line 16; site at 233-234 routes through `errorMessage(error)` |
| `src/views/EmbeddedAgendaView.ts` | Catch at ~376 normalized | VERIFIED | Import line 14; site at 376-377 routes through `errorMessage(error)` |
| `src/utils/timezoneUtils.ts` | All 3 catch blocks normalized; diagnostic context preserved | VERIFIED | Import line 3 (sibling `./errors` path); sites 178, 199 (warn paths), 223 (error path with `errorMessage(error)` as 2nd arg AND diagnostic-context object `{icalTime, tzid, mappedZone, zoneUsed}` PRESERVED as 3rd arg to `console.error`) |
| `.planning/phases/02-security-correctness/02-04-SUMMARY.md` | 49-cell trace table for `getStartOfWeek` | VERIFIED | Verifier independently re-traced all 49 cells via Node REPL and confirmed 49/49 ✓ — formula was correct-but-non-obvious per CONCERNS.md analysis; REQUIREMENTS.md's claim of "currently broken for Saturday-start" was disproven by the trace |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/main.ts` | `src/utils/colorValidation.ts` | `import { isValidColor, defaultColorForIndex, defaultDailyNoteColor } from "./utils/colorValidation"` | WIRED | Import lines 10-14 present; all three symbols used in loadSettings (lines 110-127) |
| `src/main.ts loadSettings` | `settings.calendarUrls[].color` | iterate + replace + console.warn | WIRED | Pattern `isValidColor(source.color)` at line 111 with replacement via `defaultColorForIndex(index)` at 115 and `console.warn` at 112-114; same pattern at 119-127 for `dailyNoteColor` |
| `src/settings/SettingsTab.ts buildColorSwatch` | `src/utils/colorValidation.ts isValidColor` | render-time guard | WIRED | Import line 17; usage at line 571 `if (color && isValidColor(color))` decides branch |
| `src/settings/SettingsTab.ts` | `buildColorSwatch` | `customLabel.appendChild(this.buildColorSwatch(...))` at both swatch sites | WIRED | Lines 643 and 726 both invoke; `customLabel.empty()` at 642 and 725 clears prior content; zero remaining `customLabel.innerHTML` |
| `src/services/CalendarService.ts fetchCalendars` | `this.fetchInFlight` | `if (this.fetchInFlight) return this.fetchInFlight` | WIRED | Lines 51-53 match the pattern exactly |
| `src/services/CalendarService.ts fetchCalendars` | `this.performFetch(...).finally(...)` | `this.fetchInFlight = ...` | WIRED | Lines 80-82 match pattern exactly with `.finally(() => { this.fetchInFlight = null; })` |
| `src/services/CalendarService.ts scheduleBackgroundRefresh` | `setBackgroundRefreshTimer` | timer-ownership pattern from Phase 1 CR-01 | WIRED | Lines 201-204 unchanged from Phase 1 implementation; `setBackgroundRefreshTimer` callback `() => this.fetchCalendars(sources, true)` will naturally hit the new entry guard for concurrent calls |
| Services/views/utils | `src/utils/errors.ts` | `import { errorMessage } from "../utils/errors"` (or `./errors` for siblings) | WIRED | 8 files import `errorMessage`: CalendarService, NoteService, IcsImportService, CalendarView, EmbeddedCalendarView, EmbeddedAgendaView (relative `../utils/errors`); timezoneUtils (sibling `./errors`) |
| CalendarView.ts catch blocks | `errorMessage` | `errorMessage(error)` at each catch site | WIRED | 5 catch sites verified; the ICS-import Notice at line 977 now uses `${message}` interpolation, not `${error.message}` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `colorValidation.isValidColor` | `value: string \| null \| undefined` | Caller-supplied; settings.color or render-time prop | N/A (pure function) | FLOWING — REPL trace confirms expected behavior for valid/invalid inputs |
| `errors.errorMessage` | `err: unknown` | Caller-supplied; caught Error or any thrown value | N/A (pure function) | FLOWING — handles both Error instances and arbitrary throwables |
| `main.loadSettings` color validation | `source.color` / `dailyNoteColor` | `this.loadData()` (disk) merged onto `DEFAULT_SETTINGS` | Real settings data | FLOWING — Object.assign produces real settings, forEach iterates, isValidColor decides replacement |
| `SettingsTab.buildColorSwatch` | `color` argument | `isCustom ? currentColor : null` where currentColor sourced from `settings.calendarUrls[i].color` / `settings.dailyNoteColor` | Real settings data | FLOWING — call sites pass live settings values, helper renders accordingly |
| `CalendarService.fetchCalendars` | `fetchInFlight` Promise | `this.performFetch(...)` invocation | Real fetch promise | FLOWING — promise resolves to live CalendarEvent[] from Promise.all of fetchCalendar(source) calls |
| `CalendarView.getStartOfWeek` | `firstDayOfWeek` setting | `this.plugin.settings.firstDayOfWeek` | Real settings data | FLOWING — formula consumes live setting, returns Date for grid rendering at line 388 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `isValidColor` whitelist behavior | Node REPL test 11 inputs against the actual regex from colorValidation.ts | 11/11 pass (#abc/#aabbcc/#aabbccdd/hsl/rgba/var all true; `\"><script>...`/`#abcde`/`hsl(0,0,0)<script>`/empty/null all false) | PASS |
| `getStartOfWeek` 49-cell correctness | Node REPL re-trace formula against all 7 firstDayOfWeek × 7 reference dates (2026-05-10..16) | 49/49 ✓ | PASS |
| `getStartOfWeek` Saturday-start preservation | `firstDay=6, ref=Sat 5/16/2026` | Returns Sat 5/16 (same date, not earlier) | PASS |
| `getStartOfWeek` Sunday-start same-day | `firstDay=0, ref=Sun 5/10/2026` | Returns Sun 5/10 (same date) | PASS |
| TypeScript type-check / build | `npx tsc -noEmit` / `npm run build` | Environment error: `Cannot find module '../lib/tsc.js'` — local tsc binary broken in node_modules; SUMMARY files for plans 02-01 through 02-05 all claim tsc and build passed at execution time | SKIP — toolchain unavailable in verifier environment |
| `error.message` audit across in-scope files | `grep -nE 'error\.message' src/services/{CalendarService,NoteService,IcsImportService}.ts src/views/{CalendarView,EmbeddedCalendarView,EmbeddedAgendaView}.ts src/utils/timezoneUtils.ts` | Zero matches | PASS |
| `customLabel.innerHTML` purge audit | `grep -c 'customLabel.innerHTML' src/settings/SettingsTab.ts` | 0 | PASS |
| `isFetchingCalendars` purge audit | `grep -c 'isFetchingCalendars' src/services/CalendarService.ts` | 0 | PASS |
| `fetchInFlight` reference count | `grep -c 'fetchInFlight' src/services/CalendarService.ts` | 6 (1 field decl + 1 entry guard + 1 return + 1 assignment + 1 .finally clear + 1 final return) — exceeds ≥4 acceptance criterion | PASS |
| Cross-file `errorMessage` adoption | `grep -l 'errorMessage' src/**/*.ts` | 8 files import + use the helper (CalendarService, NoteService, IcsImportService, CalendarView, EmbeddedCalendarView, EmbeddedAgendaView, timezoneUtils, errors.ts itself) | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SEC-01 | 02-01, 02-02 | Color values validated against regex before HTML/SVG injection; both load-time and render-time; `createElementNS` for SVG | SATISFIED | Load-time: main.ts:103-127. Render-time defensive: SettingsTab.ts:571. SVG construction: SettingsTab.ts:557-593 with createElementNS + setAttribute. Note: implementation uses wider whitelist than REQUIREMENTS.md's literal `/^#[0-9a-fA-F]{6}$/` — deliberate D-02 decision to support the codebase's existing color formats (hsl/rgba/var). Intent ("no markup injection path") satisfied |
| SEC-02 | 02-03, 02-04, 02-05 | Every `catch (error)` in services and views uses consistent `error instanceof Error ? error.message : String(error)` pattern | SATISFIED | Centralized in `src/utils/errors.ts:8-10`; adopted by 8 files; in-scope catches normalized; out-of-scope catches (parameter-less / discarded `error`) preserved per D-08 spirit. SettingsTab.ts:1174 (catch discards error to static text) and :1343 (parameter-less) confirmed unchanged |
| BUG-05 | 02-04 | `getStartOfWeek` correct for all firstDayOfWeek 0..6 including Saturday-start | SATISFIED | 49-cell Node REPL re-trace confirms 49/49 ✓; Saturday-start edge case (firstDay=6, ref=Sat) returns same Saturday; Sunday-start (firstDay=0, ref=Sun) returns same Sunday. REQUIREMENTS.md's "currently broken" claim was traced and disproven; CONCERNS.md analysis (formula is correct-but-non-obvious) confirmed. JSDoc above function references BUG-05 |
| BUG-06 | 02-05 | Second background refresh while fetch in progress does not produce duplicate full refresh | SATISFIED | `isFetchingCalendars` boolean replaced with `fetchInFlight: Promise<CalendarEvent[]> \| null`; entry guard returns in-flight promise (not stale events); `.finally` cleanup ensures next caller starts fresh. Race-trace logically sound: concurrent callers receive the same promise's events. Note: CR-02 (forceRefresh-during-in-flight) is a plan-acknowledged out-of-scope UX nuance per D-14 — does not affect SC #5 "no double-render or duplicate event list" |

**Orphan check:** No requirements mapped to Phase 2 in REQUIREMENTS.md are missing from plan frontmatter. Phase 2 = {SEC-01, SEC-02, BUG-05, BUG-06} = exactly the IDs declared across plans 02-01 through 02-05.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/settings/SettingsTab.ts` | 1863, 1880, 1901-1903 | `createEl("li").innerHTML = "<strong>...</strong>"` — 5 sites in CalendarUrlHelpModal | Info | Static literal `<strong>` tags with no user input; no exploitation path. Reviewer (CR-01) flagged as pattern hygiene against codebase-wide "no innerHTML" goal. Plan 02-02 D-07 explicitly defers these as FRAG-04. Scope: phase SC #2 limited to SVG color swatches |
| `src/services/CalendarService.ts` | 51-53 | `fetchInFlight` guard checks before inspecting `forceRefresh` | Warning | Reviewer (CR-02) flagged: user clicking Force Refresh during in-flight non-force fetch gets the non-force result. Plan 02-05 D-14 explicitly accepts this as out-of-scope follow-up. SC #5 is "no double-render or duplicate event list" — satisfied |
| `src/services/CalendarService.ts` | 12 | `convertTimezone` imported but unused | Info | Reviewer (IN-01). Dead-code residual, not regressed by Phase 2; deferred |
| `src/services/CalendarService.ts` | 289-306 | `loadFromCache` catches any error (including JSON parse) as `console.log` "No cache found" | Info | Reviewer (WR-04). Catch normalized via errorMessage in this phase; the swallow severity is pre-existing. Phase scope does not require error-class differentiation |
| `src/views/CalendarView.ts` | 209, 648-650, 729, 853, 855, 923, 929, 938, 1094-1095 | Direct `addEventListener` instead of `this.registerDomEvent` | Info | Pre-existing CLAUDE.md TODO; explicitly out of scope per Phase 1 deferral. Not regressed by Phase 2 |
| `src/views/CalendarView.ts` | 428 | `firstDayOfWeek` read from settings without bounds-check | Info | Reviewer (WR-02). A tampered `data.json` with `firstDayOfWeek=NaN` or `>6` would produce Invalid Date. Consistent with SEC-01 threat model but not explicitly required by SC #4 (which is scoped to 0..6) |
| `src/services/NoteService.ts` | 205, 208 | Hardcoded `3` instead of `FRONTMATTER_DELIMITER.length` | Info | Reviewer (IN-02). Minor; not regressed by Phase 2 |
| `src/settings/SettingsTab.ts` | 1182 | `event: any` parameter | Info | Reviewer (IN-03). Minor type hygiene; not regressed by Phase 2 |

No BLOCKER anti-patterns found.

### Human Verification Required

See `human_verification` block in frontmatter for structured list. Summary:

1. **End-to-end XSS prevention test** — Load Obsidian with a `data.json` containing a crafted color string; observe no script execution and console.warn fires. Static analysis confirms code paths; runtime confirms behavior.
2. **Render-time defensive guard test** — Programmatically inject a malformed color into settings via DevTools and observe swatch falls back to plus-icon.
3. **Visual regression on color swatches** — Confirm `createElementNS` migration produces visually identical swatches to the pre-Phase-2 `innerHTML` implementation.
4. **Error message UX test** — Verify a non-Error throwable in a real fetch path produces a meaningful Notice (not "undefined" / "[object Object]").
5. **Race verification** — Trigger two near-simultaneous fetches and confirm only one network round-trip, no duplicate events, no double-render.

These tests CANNOT be verified programmatically — they require running the plugin against Obsidian.

### Deferred Concerns Summary

The code review (02-REVIEW.md) flagged 2 BLOCKER findings (CR-01, CR-02). Both are plan-acknowledged out-of-scope deferrals:

- **CR-01** (5 innerHTML literals in CalendarUrlHelpModal): scoped out by plan 02-02 D-07 → FRAG-04 (deferred milestone). Static content, no user input, no exploitation path. Roadmap SC #2 is explicitly scoped to SVG color swatches, not the entire file.
- **CR-02** (forceRefresh ignored when fetchInFlight is set): scoped out by plan 02-05 D-14 (force-refresh-during-fetch UX nuance is a documented follow-up). Roadmap SC #5 is scoped to "no double-render or duplicate event list" — the shared-Promise approach satisfies that intent. The user-clicks-Force-Refresh-during-auto-refresh scenario is a separate UX concern.

These deferrals are documented in CONTEXT.md decisions, captured in plan frontmatter scope boundaries, and surfaced here for human review. They do not constitute gaps blocking phase goal achievement — they constitute known accepted scope exclusions. If the developer disagrees with the D-07 / D-14 dispositions, they should be re-raised as new requirements for a follow-up phase, not as Phase 2 blockers.

### Gaps Summary

No gaps blocking goal achievement.

All 5 ROADMAP success criteria are observably true in the codebase:
1. Load-time color validator runs over `calendarUrls[].color` and `dailyNoteColor`, replaces invalid via deterministic defaults, `console.warn` emits diagnostics.
2. SVG swatches render via `createElementNS` + `setAttribute`; render-time `isValidColor` defensive guard; zero `customLabel.innerHTML` injection sinks remain.
3. `errorMessage(err)` helper adopted in 8 files; every in-scope catch normalized; user-visible Notices interpolate the stringified message, not raw `error.message`.
4. `getStartOfWeek` independently re-traced against all 49 (firstDayOfWeek, getDay()) cells — formula correct; documentation references the trace.
5. Boolean fetch guard replaced with shared-Promise dedup; concurrent callers receive the same promise; `.finally` clears for the next fetch; Phase 1 timer-ownership wiring preserved.

Plan-acknowledged deferrals (CR-01 FRAG-04, CR-02 D-14) are NOT gaps — they are documented out-of-scope items. The phase goal is achieved; status is `human_needed` because the goal-confirmation tests (XSS injection attempt, race trigger, UX of error Notices, visual regression) cannot be performed by static analysis alone.

---

_Verified: 2026-05-11T06:43:00Z_
_Verifier: Claude (gsd-verifier)_
