---
phase: 01-foundation
verified: 2026-05-09T22:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "4/4 must-haves verified (1 with warning — CR-01)"
  gaps_closed:
    - "CR-01: setTimeout handle previously passed to Plugin.registerInterval (which calls clearInterval at unload) is now owned by MemoChron.backgroundRefreshTimer and cancelled with window.clearTimeout in onunload. The setTimeout/clearInterval API mismatch that drove the iOS WKWebView risk is gone."
    - "IN-02: CalendarView's 50ms startup setTimeout previously passed to View.registerInterval is now stored on CalendarView.startupTimer and cancelled with window.clearTimeout in onClose. Same root cause as CR-01, view-scoped fix."
    - "WR-01: Redundant Plugin.registerInterval wrap in setupAutoRefresh removed. setInterval ID now lives only on this.refreshTimer; clearRefreshTimer is invoked from both saveSettings/setupAutoRefresh reset path and onunload."
    - "WR-02: Code-block parsers in EmbeddedCalendarView.ts and EmbeddedAgendaView.ts now split on the first colon only (indexOf + substring) so values with embedded colons (titles, ISO datetimes) survive verbatim."
    - "WR-03: obsidian-daily-notes-interface is now a static top-of-file import in EmbeddedCalendarView.ts, matching the sibling EmbeddedAgendaView.ts. The dynamic await import inside handleDailyNoteClick is gone."
    - "IN-01: CalendarView.handleDragMoveBound and handleDragEndBound declared types now reflect deferred initialization (((e: MouseEvent) => void) | undefined = undefined). The compound onClose guard narrows the union for removeEventListener; non-null assertions at handleDragStart/handleDragEnd call sites are sound because createUI runs synchronously before any drag entry point."
  gaps_remaining: []
  regressions: []
---

# Phase 01: Foundation Verification Report (Re-verified)

**Phase Goal:** Plugin does not leak resources on unload, does not crash on iOS from untracked timers or drag listeners, and reads live settings in both services — with dead code removed to reduce noise for all subsequent phases.
**Verified:** 2026-05-09T22:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 01-06..01-10 closed CR-01, IN-01, IN-02, WR-01, WR-02, WR-03 from 01-REVIEW.md)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Changing refreshInterval in settings takes effect for the next cache-expiry check without reloading Obsidian | VERIFIED | `CalendarService.needsRefresh()` reads `this.plugin.settings.refreshInterval * 60 * 1000` live (`src/services/CalendarService.ts:202`). Constructor is single-arg `constructor(private plugin: MemoChron) {}` (line 40). Stale `refreshMinutes` field absent (`grep refreshMinutes src/services/CalendarService.ts` returns no output). |
| 2 | Disabling MemoChron plugin on iOS (fast enable/disable) does not produce a crash from untracked timers or detached-callback access | VERIFIED | The previous VERIFICATION's iOS-specific concern was rooted in CR-01: setTimeout handles being passed to `Plugin.registerInterval`, which internally calls `clearInterval` at unload. On WKWebView the `setTimeout` and `setInterval` ID pools are not guaranteed to be shared, so `clearInterval(setTimeout-id)` could silently no-op. **That mismatch no longer exists at any call site.** Plugin-owned 100ms background-refresh timer is held on `MemoChron.backgroundRefreshTimer` (`src/main.ts:17`) and cancelled with `window.clearTimeout` in `clearBackgroundRefreshTimer` (line 207), invoked from `onunload` (line 95). View-owned 50ms startup timer is held on `CalendarView.startupTimer` (line 33) and cancelled with `window.clearTimeout` in `onClose` (line 60). Drag-listener teardown via `onClose` (lines 53-58) is preserved. `detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` in `onunload` (line 93) deterministically fires `CalendarView.onClose()` on plugin disable. The setTimeout/clearInterval API mismatch is observably absent — `grep registerInterval src/services/CalendarService.ts src/main.ts src/views/CalendarView.ts` returns only doc-comment hits, zero call sites. |
| 3 | Dragging the calendar pane to resize it and then immediately closing the sidebar does not leave orphaned mousemove/mouseup listeners on window | VERIFIED | `private isDragging = false` field at `src/views/CalendarView.ts:32`. Set true in `handleDragStart` (line 1070); cleared in `handleDragEnd` (line 1098, first statement of method). `protected async onClose(): Promise<void>` override (lines 53-63) removes both window listeners inside compound guard `if (this.isDragging && this.handleDragMoveBound && this.handleDragEndBound)` (line 54). Does NOT call `handleDragEnd` (D-09 honored — `awk` body inspection of onClose returns 0 matches for `handleDragEnd(`). The drag-handler binding fields are now correctly typed `((e: MouseEvent) => void) \| undefined = undefined` (lines 30-31), so strictNullChecks holds at the removeEventListener sites without assertions. |
| 4 | The codebase contains no reference to `calculateEndDate`, `DEFAULT_TEMPLATE_PATH`, `TEMPLATE_VARIABLES`, the unused `App`/`TFile` imports, or the dead `renderAgendaList` import in embedded views | VERIFIED | `grep -rn "calculateEndDate\|DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/` — no output. `grep -nE "\bApp\b" src/views/EmbeddedCalendarView.ts` — no output. `grep -nE "\bTFile\b\|renderAgendaList" src/views/EmbeddedAgendaView.ts` — no output. `renderAgendaList` function intact at `src/utils/viewRenderers.ts:81` (D-11 preserved). |

**Score:** 4/4 truths verified. The previous WARNING on Truth 2 is now resolved at the code level: the API mismatch driving the residual iOS concern has been eliminated by plan 01-06.

### Why the previous CR-01 human-verification gate is now resolvable from code

The prior VERIFICATION marked Truth 2 as `VERIFIED with WARNING` and routed it to human verification because static analysis could confirm the *presence* of `registerInterval`/`detachLeavesOfType`/`onClose` mechanisms but could NOT rule out the runtime API-pool mismatch on WKWebView. The mismatch was: `clearInterval(setTimeout-id)`, where the spec does not require the two ID pools to share a namespace.

Plan 01-06 changed the cleanup approach from "register the setTimeout handle with an Obsidian helper that internally calls clearInterval" to "own the setTimeout handle on the owning Component and cancel it with the matching `window.clearTimeout`".

After plan 01-06:

- `CalendarService.scheduleBackgroundRefresh` no longer calls `this.plugin.registerInterval(window.setTimeout(...))`. It now calls `this.plugin.setBackgroundRefreshTimer(callback, 100)` (`src/services/CalendarService.ts:189-192`). The setter stores the handle on `MemoChron.backgroundRefreshTimer` and cancels it with `window.clearTimeout` (`src/main.ts:195-210`), invoked from `onunload` (line 95).
- `CalendarView.onOpen` no longer calls `this.registerInterval(window.setTimeout(...))`. It now stores the handle on `this.startupTimer` (`src/views/CalendarView.ts:77`) and cancels it with `window.clearTimeout` in `onClose` (line 60).

Because every `window.setTimeout(...)` in the three target files is now paired with a matching `window.clearTimeout(...)` cancellation in the corresponding teardown method, the API mismatch is **mechanically absent** — verifiable from grep alone, no runtime test needed:

```
grep -nE "window\.setTimeout|window\.setInterval" src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts
src/main.ts:174:    this.refreshTimer = window.setInterval(           # paired with clearInterval at line 182
src/main.ts:199:    this.backgroundRefreshTimer = window.setTimeout(  # paired with clearTimeout at lines 197, 207
src/views/CalendarView.ts:77: this.startupTimer = window.setTimeout( # paired with clearTimeout at line 60
```

The iOS-specific runtime risk that required device verification was the API mismatch itself, not a question of whether `clearTimeout` works on WKWebView (it does — that's standard). With the mismatch removed, no device-only behavior remains under test for this phase's success criteria.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/CalendarService.ts` | Single-arg constructor + live refreshInterval read in needsRefresh | VERIFIED | `constructor(private plugin: MemoChron) {}` at line 40. `this.plugin.settings.refreshInterval` at line 202. `refreshMinutes` field absent. `scheduleBackgroundRefresh` calls `this.plugin.setBackgroundRefreshTimer(...)` at line 189 (no longer wraps via registerInterval). |
| `src/main.ts` | `new CalendarService(this)`, `detachLeavesOfType` in onunload, plugin-owned backgroundRefreshTimer with clearTimeout-based teardown | VERIFIED | Line 35: `new CalendarService(this)`. Lines 92-96: `onunload` calls `detachLeavesOfType`, `clearRefreshTimer`, `clearBackgroundRefreshTimer`. Line 17: `private backgroundRefreshTimer: number \| null = null`. Lines 195-203: `setBackgroundRefreshTimer` setter. Lines 205-210: `clearBackgroundRefreshTimer` helper using `window.clearTimeout`. Line 174: `this.refreshTimer = window.setInterval(...)` (no `registerInterval` wrap, per WR-01 fix). |
| `src/services/NoteService.ts` | Single-arg constructor, `private get settings()` getter, no `this.app` references | VERIFIED | Constructor `(private plugin: MemoChron)` at line 55. `private get settings(): MemoChronSettings` at line 57. All `this.app.*` references replaced with `this.plugin.app.*` (`grep "this.app" src/services/NoteService.ts` returns 0 matches; `grep "this.plugin.app" src/services/NoteService.ts` returns 6 matches). |
| `src/views/CalendarView.ts` | isDragging field, flag mutations in handlers, onClose() override (drag teardown + startupTimer cleanup), startupTimer field, drag-handler binding types correctly nullable | VERIFIED | `private isDragging = false` at line 32. `private startupTimer: number \| null = null` at line 33. `private handleDragMoveBound: ((e: MouseEvent) => void) \| undefined = undefined` at lines 30-31 (IN-01 fix). `protected async onClose(): Promise<void>` at line 53. Compound onClose guard at line 54. Listener removal inside guard (lines 55-56). `startupTimer` cleanup as sibling block (lines 59-62). 50ms setTimeout assigned to `this.startupTimer` at line 77, with the inner `this.startupTimer = null` at line 78 to allow safe re-scheduling from inside the callback. |
| `src/utils/constants.ts` | DEFAULT_TEMPLATE_PATH and TEMPLATE_VARIABLES removed | VERIFIED | `grep -rn "DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/` returns no matches. `MEMOCHRON_VIEW_TYPE` and other constants preserved. |
| `src/views/EmbeddedCalendarView.ts` | App import removed; static import for obsidian-daily-notes-interface; first-colon split parser | VERIFIED | `grep -nE "\bApp\b"` returns no matches. Lines 9-14: static import block for `createDailyNote`, `getDailyNote`, `getAllDailyNotes`, `appHasDailyNotesPluginLoaded` from `obsidian-daily-notes-interface`. `grep "await import(" src/views/EmbeddedCalendarView.ts` returns no output. `parseCalendarCodeBlock` at lines 241-287 uses `indexOf(":")` + `substring` (lines 250, 254-255). |
| `src/views/EmbeddedAgendaView.ts` | TFile and renderAgendaList imports removed; first-colon split parser | VERIFIED | `grep -nE "\bTFile\b\|renderAgendaList" src/views/EmbeddedAgendaView.ts` returns no matches. `parseAgendaCodeBlock` at lines 407-457 uses `indexOf(":")` + `substring` (lines 415, 419-420). |
| `src/utils/viewRenderers.ts` | renderAgendaList function INTACT (D-11) | VERIFIED | `export function renderAgendaList` at line 81. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CalendarService.ts:needsRefresh` | `this.plugin.settings.refreshInterval` | live property read | WIRED | Line 202 confirmed. |
| `main.ts:initializeServices` | `new CalendarService(this)` | single-arg construction | WIRED | Line 35 confirmed. |
| `main.ts:initializeServices` | `new NoteService(this)` | single-arg construction | WIRED | Line 36 confirmed. |
| `NoteService.ts` (settings access) | `this.plugin.settings` | private get settings() getter | WIRED | Getter at line 57 resolves all `this.settings.*` references. |
| `main.ts:setupAutoRefresh` | `this.refreshTimer = window.setInterval(...)` | direct field assignment + explicit clearRefreshTimer in saveSettings/onunload | WIRED | Line 174. WR-01 fix removed the redundant registerInterval wrap; cleanup via clearRefreshTimer at lines 165 (reset path) and 94 (onunload). |
| `main.ts:onunload` | `this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` | deterministic view-close trigger | WIRED | Line 93 confirmed. |
| `CalendarService.ts:scheduleBackgroundRefresh` | `this.plugin.setBackgroundRefreshTimer(callback, 100)` | plugin-owned setTimeout handle | WIRED | Lines 189-192 confirmed. CR-01 fix: setter at `main.ts:195-203` stores handle on `MemoChron.backgroundRefreshTimer` and pre-clears any existing handle with `window.clearTimeout` before re-scheduling. |
| `main.ts:onunload` | `this.clearBackgroundRefreshTimer()` | plugin-owned clearTimeout-based teardown | WIRED | Line 95 → helper at 205-210 → `window.clearTimeout(this.backgroundRefreshTimer)`. |
| `CalendarView.ts:onOpen` | `this.startupTimer = window.setTimeout(...)` | view-owned setTimeout handle | WIRED | Line 77. IN-02 fix: handle nulled inside callback (line 78) and explicitly cancelled via `window.clearTimeout(this.startupTimer)` in onClose (line 60). |
| `CalendarView.ts:handleDragStart` | `this.isDragging = true` | drag-state flag set | WIRED | Line 1070. |
| `CalendarView.ts:handleDragEnd` | `this.isDragging = false` | drag-state flag clear (first statement) | WIRED | Line 1098. |
| `CalendarView.ts:onClose` | `window.removeEventListener(...)` | View.onClose teardown via detachLeavesOfType | WIRED | Lines 55-56 inside compound guard at line 54. Does NOT call handleDragEnd (D-09 honored). |
| `EmbeddedCalendarView.ts:handleDailyNoteClick` | `createDailyNote`, `getDailyNote`, `getAllDailyNotes`, `appHasDailyNotesPluginLoaded` | static module imports | WIRED | Static import block at lines 9-14. Dynamic `await import(...)` removed (WR-03 fix). |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces no components that render dynamic data. All changes are lifecycle, cleanup, type-safety, and parser-correctness refactors.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript type-check | `node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck` | exit 0 | PASS |
| esbuild production bundle | `node esbuild.config.mjs production` | exit 0 | PASS |
| No stale `refreshMinutes` reference | `grep -c "refreshMinutes" src/services/CalendarService.ts` | 0 | PASS |
| Live refreshInterval read | `grep -c "this.plugin.settings.refreshInterval" src/services/CalendarService.ts` | 1 | PASS |
| No bare setTimeout/setInterval (every timer prefixed `window.`) | `grep -nE "^\s*setTimeout\(\|^\s*setInterval\(" src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts` | no output | PASS |
| No registerInterval call sites in target files | `grep -E "this\.registerInterval\(\|this\.plugin\.registerInterval\(" src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts` | no output | PASS |
| Plugin-owned background timer wired | `grep -c "setBackgroundRefreshTimer" src/services/CalendarService.ts` | 1 | PASS |
| Plugin-side setter + cleanup helpers exist | `grep -cE "setBackgroundRefreshTimer\\|clearBackgroundRefreshTimer" src/main.ts` | ≥3 | PASS |
| `window.clearTimeout` used for one-shot timers | `grep -c "window.clearTimeout" src/main.ts src/views/CalendarView.ts` | ≥3 (3 in main.ts incl. doc, 1 in CalendarView.ts) | PASS |
| detachLeavesOfType in onunload | `grep -c "detachLeavesOfType(MEMOCHRON_VIEW_TYPE)" src/main.ts` | 1 | PASS |
| isDragging field present | `grep -c "private isDragging = false" src/views/CalendarView.ts` | 1 | PASS |
| onClose override signature | `grep -c "protected async onClose(): Promise<void>" src/views/CalendarView.ts` | 1 | PASS |
| Drag-handler binding nullable typing | `grep -c "((e: MouseEvent) => void) \| undefined = undefined" src/views/CalendarView.ts` | 2 | PASS |
| First-colon split in both parsers | `grep -c 'line.indexOf(":")' src/views/EmbeddedAgendaView.ts src/views/EmbeddedCalendarView.ts` | 2 (one per file) | PASS |
| Static import for daily-notes-interface in EmbeddedCalendarView | `grep -c 'from "obsidian-daily-notes-interface"' src/views/EmbeddedCalendarView.ts` | 1 | PASS |
| No dynamic await import in embedded views | `grep -c "await import(" src/views/EmbeddedCalendarView.ts src/views/EmbeddedAgendaView.ts` | 0 | PASS |
| Dead code fully absent | `grep -rn "calculateEndDate\|DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/` | no output | PASS |
| renderAgendaList function intact | `grep -c "export function renderAgendaList" src/utils/viewRenderers.ts` | 1 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| TD-01 | 01-01 | CalendarService cache-expiry reads live refreshInterval | SATISFIED | `needsRefresh()` reads `this.plugin.settings.refreshInterval`; `refreshMinutes` field removed; CalendarService single-arg constructor. |
| TD-02 | 01-02 | NoteService reads live settings via plugin reference | SATISFIED | Single-arg constructor, `private get settings()` getter, all `this.app` replaced with `this.plugin.app`. |
| TD-03 | 01-03 (and refined by 01-06, 01-07) | All setTimeout/setInterval tracked and cancelled on unload/view close | SATISFIED | Plan 01-03 introduced registerInterval wrappers and detachLeavesOfType. Plans 01-06 and 01-07 refined the design: one-shot setTimeout handles are now plugin/view-owned and cancelled with the matching `window.clearTimeout`; the recurring `setInterval` is held on `this.refreshTimer` and explicitly cleared from save/onunload paths. Detach-on-unload preserved. The CR-01/IN-02/WR-01 risks introduced by the original wrapping pattern are closed. |
| TD-04 | 01-04 (and IN-01 fix in 01-10) | mousemove/mouseup window listeners cleaned up on mid-drag CalendarView close | SATISFIED | `isDragging` flag + `onClose` override removes both window listeners inside compound guard; D-09 honored (no `handleDragEnd` call from onClose). Drag-handler binding fields now correctly typed for strictNullChecks (IN-01 fix). |
| CLEAN-01 | 01-05 | Dead code removed (calculateEndDate, DEFAULT_TEMPLATE_PATH, TEMPLATE_VARIABLES, unused imports) | SATISFIED | All five symbols absent from `src/`; renderAgendaList function intact per D-11. |

All five phase requirements are satisfied. No orphaned requirements found — all five are mapped to plans and verified in the codebase. The follow-up plans 01-06..01-10 closed the six findings from the prior code review without expanding scope outside the original phase requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/views/EmbeddedCalendarView.ts` | 15 | Unused `CalendarEvent` import | Info | Pre-existing, not introduced by remediation. esbuild tree-shakes type-only imports so there is no bundle-size impact. Surfaced as IN-01 in the latest 01-REVIEW.md (re-review). The prior phase review missed it. Does NOT block phase completion — phase success criteria do not name this import. Suggested fix is a one-line removal and can be picked up by a later cleanup pass. |

The previously flagged anti-patterns in this report (CR-01 and IN-02 setTimeout/clearInterval mismatch; WR-01 registerInterval list growth) are no longer present — see "Re-verification metadata" gaps_closed.

### Human Verification Required

None — the prior CR-01 human-verification gate is closed at the code level. See "Why the previous CR-01 human-verification gate is now resolvable from code" above.

### Gaps Summary

No blocking gaps. All four observable truths are verified at the code level. All five phase requirements are satisfied. The previous WARNING that drove `human_needed` status (CR-01 setTimeout/clearInterval mismatch on iOS WKWebView) has been mechanically eliminated by plan 01-06 — every `window.setTimeout(...)` in the three target files now has a matching `window.clearTimeout(...)` in the corresponding teardown path. Builds (TypeScript and esbuild production) pass. Status promotes from `human_needed` to `passed`.

The single remaining code-review finding (`CalendarEvent` unused import in `EmbeddedCalendarView.ts:15`) is Info-severity, pre-existing, non-functional, and outside this phase's success criteria. It does not block phase closure.

---

_Verified: 2026-05-09T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
