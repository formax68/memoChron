---
phase: 01-foundation
verified: 2026-05-09T17:10:00Z
status: human_needed
score: 4/4 must-haves verified (1 with warning — CR-01)
overrides_applied: 0
human_verification:
  - test: "iOS rapid enable/disable — residual setTimeout vs clearInterval mismatch"
    expected: "Disabling then immediately re-enabling MemoChron on an actual iOS device (or Obsidian mobile) does not produce an 'undefined is not an object' or similar crash in the background-refresh path"
    why_human: "CR-01 (REVIEW.md): CalendarService.scheduleBackgroundRefresh passes a setTimeout ID to Plugin.registerInterval, which internally calls clearInterval on plugin unload. On WKWebView (iOS) the setTimeout and setInterval ID pools are not guaranteed to be shared, so clearInterval may silently fail to cancel the 100ms one-shot timer. Static code inspection can confirm the mechanism is present but cannot confirm it is effective on mobile. A real-device test is required to falsify the residual risk."
---

# Phase 01: Foundation Verification Report

**Phase Goal:** Plugin does not leak resources on unload, does not crash on iOS from untracked timers or drag listeners, and reads live settings in both services — with dead code removed to reduce noise for all subsequent phases.
**Verified:** 2026-05-09T17:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Changing refreshInterval in settings takes effect for the next cache-expiry check without reloading Obsidian | ✓ VERIFIED | `CalendarService.needsRefresh()` reads `this.plugin.settings.refreshInterval * 60 * 1000` live (CalendarService.ts:197). Constructor is single-arg `(plugin: MemoChron)` (line 40). `refreshMinutes` field is gone — grep returns no matches. |
| 2 | Disabling MemoChron plugin on iOS (fast enable/disable) does not produce crash — verified by code: registerInterval registrations, detachLeavesOfType on unload, drag-listener teardown | ⚠ VERIFIED with WARNING | All three mechanisms ARE present in code: `this.plugin.registerInterval(window.setTimeout(...))` in CalendarService.ts:185; `detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` in main.ts:92; `onClose()` override in CalendarView.ts:52-58. However CR-01 (code review): `registerInterval` internally calls `clearInterval` on unload, but the registered ID is a `setTimeout` ID — on iOS WKWebView `clearInterval` on a setTimeout ID is implementation-defined and may silently fail. The mechanism is present but its mobile effectiveness requires human verification. See Human Verification section. |
| 3 | Dragging the calendar pane to resize it and then immediately closing the sidebar does not leave orphaned mousemove/mouseup listeners on window | ✓ VERIFIED | `private isDragging = false` field at CalendarView.ts:32. `this.isDragging = true` in handleDragStart (line 1062). `this.isDragging = false` as first statement of handleDragEnd (line 1090). `protected async onClose(): Promise<void>` override (lines 52-58) removes both `mousemove` and `mouseup` window listeners inside `if (this.isDragging)` guard. Does NOT call handleDragEnd (D-09 honored — grep returns 0). Both listeners appear in both handleDragEnd and onClose (2 occurrences each confirmed by grep). |
| 4 | The codebase contains no reference to `calculateEndDate`, `DEFAULT_TEMPLATE_PATH`, `TEMPLATE_VARIABLES`, the unused `App`/`TFile` imports, or the dead `renderAgendaList` import in embedded views | ✓ VERIFIED | `grep -rn "calculateEndDate\|DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/` — no output. `grep -nE "\bApp\b" EmbeddedCalendarView.ts` — no output. `grep -nE "\bTFile\b\|renderAgendaList" EmbeddedAgendaView.ts` — no output. `renderAgendaList` function intact in viewRenderers.ts:81 (D-11 honored). |

**Score:** 4/4 truths verified (Truth 2 carries a WARNING — see Human Verification section)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/CalendarService.ts` | Single-arg constructor + live refreshInterval read in needsRefresh | ✓ VERIFIED | `constructor(private plugin: MemoChron) {}` at line 40. `this.plugin.settings.refreshInterval` at line 197. `refreshMinutes` field absent. |
| `src/main.ts` | `new CalendarService(this)` and `detachLeavesOfType` in onunload | ✓ VERIFIED | Line 34: `new CalendarService(this)`. Lines 91-93: onunload calls detachLeavesOfType then clearRefreshTimer. `this.registerInterval(window.setInterval(...))` at line 166. |
| `src/services/NoteService.ts` | Single-arg constructor, `private get settings()` getter, no `this.app` references | ✓ VERIFIED | Constructor `(private plugin: MemoChron)` at line ~55. `private get settings(): MemoChronSettings` at line 57. All 6 `this.app` references replaced with `this.plugin.app` (6 matches confirmed). |
| `src/views/CalendarView.ts` | `isDragging` field, flag mutations in handlers, `onClose()` override, `registerInterval` wrap on 50ms timeout | ✓ VERIFIED | `private isDragging = false` at line 32. Flag set/cleared in drag handlers. `protected async onClose(): Promise<void>` at line 52. `this.registerInterval(window.setTimeout(...))` at line 68. |
| `src/utils/constants.ts` | `DEFAULT_TEMPLATE_PATH` and `TEMPLATE_VARIABLES` removed | ✓ VERIFIED | grep -rn returns no matches under src/. `MEMOCHRON_VIEW_TYPE` and all other constants preserved. |
| `src/views/EmbeddedCalendarView.ts` | `App` removed from obsidian import | ✓ VERIFIED | `grep -nE "\bApp\b"` returns no matches. Import line now reads `import { MarkdownRenderChild, Notice } from "obsidian"`. |
| `src/views/EmbeddedAgendaView.ts` | `TFile` and `renderAgendaList` imports removed | ✓ VERIFIED | Both greps return no matches. `parseDate` and `RenderOptions` imports preserved. |
| `src/utils/viewRenderers.ts` | `renderAgendaList` function INTACT (D-11) | ✓ VERIFIED | `export function renderAgendaList` at line 81. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CalendarService.ts:needsRefresh` | `this.plugin.settings.refreshInterval` | live property read | ✓ WIRED | Line 197 confirmed by grep |
| `main.ts:initializeServices` | `new CalendarService(this)` | single-arg construction | ✓ WIRED | Line 34 confirmed |
| `main.ts:initializeServices` | `new NoteService(this)` | single-arg construction | ✓ WIRED | Line 35 confirmed |
| `NoteService.ts` (settings access) | `this.plugin.settings` | `private get settings()` getter | ✓ WIRED | Getter at line 57 resolves all 14+ `this.settings.x` references |
| `main.ts:setupAutoRefresh` | `this.registerInterval(window.setInterval(...))` | Obsidian Component cleanup | ✓ WIRED | Lines 166-171 confirmed |
| `main.ts:onunload` | `this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` | deterministic view-close trigger | ✓ WIRED | Line 92 confirmed |
| `CalendarService.ts:scheduleBackgroundRefresh` | `this.plugin.registerInterval(window.setTimeout(...))` | plugin-borrowed registration scope | ✓ WIRED (WARNING) | Lines 185-187 confirmed. WARNING: registerInterval internally calls clearInterval at unload; passing a setTimeout ID is correct API intent but uses wrong cleanup verb on mobile (CR-01). |
| `CalendarView.ts:onOpen` | `this.registerInterval(window.setTimeout(...))` | Component self-registration | ✓ WIRED (WARNING) | Line 68 confirmed. Same clearInterval/setTimeout ID pool concern as CR-01 (lower risk, view-scoped — IN-02 in review). |
| `CalendarView.ts:handleDragStart` | `this.isDragging = true` | drag-state flag set | ✓ WIRED | Line 1062 confirmed |
| `CalendarView.ts:handleDragEnd` | `this.isDragging = false` | drag-state flag clear (first statement) | ✓ WIRED | Line 1090 confirmed |
| `CalendarView.ts:onClose` | `window.removeEventListener("mousemove"/"mouseup", ...)` | View.onClose teardown via detachLeavesOfType | ✓ WIRED | Lines 54-55 confirmed. guard is `if (this.isDragging)`. Does NOT call handleDragEnd (D-09 honored). |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces no components that render dynamic data. All changes are lifecycle and cleanup refactors.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript type-check | `node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck` | exit 0 | ✓ PASS |
| esbuild production bundle | `node esbuild.config.mjs production` | exit 0 | ✓ PASS |
| No `refreshMinutes` in CalendarService | `grep -c "refreshMinutes" src/services/CalendarService.ts` | 0 | ✓ PASS |
| Live refreshInterval read | `grep -c "this.plugin.settings.refreshInterval" src/services/CalendarService.ts` | 1 | ✓ PASS |
| No bare setTimeout/setInterval in target files | `grep -nE "^\s*setTimeout\(\|^\s*setInterval\(" src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts` | no output | ✓ PASS |
| detachLeavesOfType in onunload | `grep -c "detachLeavesOfType(MEMOCHRON_VIEW_TYPE)" src/main.ts` | 1 | ✓ PASS |
| isDragging flag | `grep -c "private isDragging = false" src/views/CalendarView.ts` | 1 | ✓ PASS |
| onClose override signature | `grep -c "protected async onClose(): Promise<void>" src/views/CalendarView.ts` | 1 | ✓ PASS |
| Dead code fully absent | `grep -rn "calculateEndDate\|DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/` | no output | ✓ PASS |
| renderAgendaList function intact | `grep -c "export function renderAgendaList" src/utils/viewRenderers.ts` | 1 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| TD-01 | 01-01 | CalendarService cache-expiry reads live refreshInterval | ✓ SATISFIED | needsRefresh() reads this.plugin.settings.refreshInterval; refreshMinutes field removed; CalendarService single-arg constructor |
| TD-02 | 01-02 | NoteService reads live settings via plugin reference | ✓ SATISFIED | Single-arg constructor, private get settings() getter, all this.app replaced with this.plugin.app |
| TD-03 | 01-03 | All setTimeout/setInterval tracked and cancelled on unload | ✓ SATISFIED (WARNING) | registerInterval wraps in place on all 3 timer sites; detachLeavesOfType fires view close. CR-01 warning: setTimeout ID passed to registerInterval uses clearInterval at unload — wrong cleanup API on mobile, but mechanism is present |
| TD-04 | 01-04 | mousemove/mouseup window listeners cleaned up on mid-drag CalendarView close | ✓ SATISFIED | isDragging flag + onClose override removes both window listeners inside isDragging guard |
| CLEAN-01 | 01-05 | Dead code removed (calculateEndDate, DEFAULT_TEMPLATE_PATH, TEMPLATE_VARIABLES, unused imports) | ✓ SATISFIED | All five symbols absent from src/; renderAgendaList function intact per D-11 |

All 5 phase requirements (TD-01, TD-02, TD-03, TD-04, CLEAN-01) are satisfied. No orphaned requirements found — all 5 are mapped to plans and verified in the codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/services/CalendarService.ts` | 185-187 | `registerInterval(window.setTimeout(...))` — setTimeout ID passed to an API that calls clearInterval at unload | ⚠ Warning | On iOS WKWebView, clearInterval on a setTimeout ID may not cancel the timer. 100ms background refresh could fire post-teardown. Documented as CR-01 in REVIEW.md. Not a blocker for desktop; a known residual mobile risk. |
| `src/main.ts` | 163-171 | `registerInterval(window.setInterval(...))` with preserved manual refreshTimer — old cancelled IDs accumulate in Plugin's internal tracking list on each settings save | ⚠ Warning | No crash, no behavior regression. Memory growth only on repeated settings saves over the plugin lifetime. Documented as WR-01 in REVIEW.md. |
| `src/views/CalendarView.ts` | 68-70 | `registerInterval(window.setTimeout(...))` — same setTimeout/clearInterval ID pool concern (lower risk, view-scoped) | ℹ Info | Lower severity than CR-01 because view Component.unload() is called synchronously on leaf close. Documented as IN-02 in REVIEW.md. |

### Human Verification Required

#### 1. iOS Mobile: Background Refresh Timer Cancellation on Rapid Disable/Enable

**Test:** On an iOS device running Obsidian with MemoChron installed — or in Obsidian mobile — rapidly disable then re-enable the plugin (via Settings > Community Plugins) two or three times in quick succession. A calendar source must be configured and active (so scheduleBackgroundRefresh is called).

**Expected:** No "undefined is not an object" or similar crash in Obsidian's error overlay or the device console (Xcode console / Safari Web Inspector attached to Obsidian iOS app). No red error notice from the plugin.

**Why human:** CR-01 from REVIEW.md: `Plugin.registerInterval` internally stores the timer ID and calls `window.clearInterval(id)` when the plugin unloads. For the 100ms `setTimeout` in `scheduleBackgroundRefresh`, the registered ID is a `setTimeout` ID, not a `setInterval` ID. On Chromium/Electron (desktop) the two ID pools are shared so `clearInterval` on a `setTimeout` ID works. On WKWebView (iOS) the spec does not require shared pools — `clearInterval` may silently fail, leaving the 100ms timer live after plugin teardown. The callback then fires against a partially destroyed `CalendarService` instance. This risk cannot be confirmed or ruled out by static code inspection alone.

### Gaps Summary

No blocking gaps identified. All four required observable truths are verified at the code level. All five phase requirements (TD-01 through TD-04, CLEAN-01) are implemented and confirmed by grep and build.

One WARNING requires human follow-up: the CR-01 finding about `setTimeout` IDs passed to `registerInterval` (which uses `clearInterval` at unload) creates a residual iOS crash risk that static analysis cannot dismiss. This is why status is `human_needed` rather than `passed`. The code is correct in intent and correct on desktop; mobile effectiveness requires a real-device or simulator test.

---

_Verified: 2026-05-09T17:10:00Z_
_Verifier: Claude (gsd-verifier)_
