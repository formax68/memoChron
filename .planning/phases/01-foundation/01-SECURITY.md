---
phase: 01
slug: foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-10
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase scope: TD-01..TD-04 (lifecycle/services refactor), CLEAN-01 (dead-code), and review-gap follow-ups CR-01, IN-01, IN-02, WR-01, WR-02, WR-03. Pure internal refactor and lifecycle hygiene — no new network, auth, or persistence boundaries introduced.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| (none new) | Phase 1 introduces no new trust boundaries. The pre-existing boundary at `requestUrl()` (CalendarService remote fetches) and the user-supplied iCal URL surface are unchanged. The plugin-lifecycle teardown boundary is narrowed (Obsidian-managed cleanup augmented with explicit owned-handle `clearTimeout`/`clearInterval` calls). | None new — existing iCal payload remains the only externally-sourced data. |
| Plugin lifecycle / runtime host (narrowed) | iOS WKWebView and Android WebView do not guarantee shared `setTimeout`/`setInterval` ID pools. Phase 1 mitigates by owning every one-shot timer handle on a Component (plugin or view) and calling `window.clearTimeout` in the matching teardown method. | Timer handles are local primitives; no data crosses. |
| User markdown content → code-block parser (correctness improved) | `parseAgendaCodeBlock` and `parseCalendarCodeBlock` previously truncated values containing colons. After WR-02 the parsers split on the first colon only. Trust surface is unchanged (still arbitrary user-supplied strings); correctness was improved. | Plaintext config strings from the user's own vault. |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | CalendarService.needsRefresh live read of `this.plugin.settings.refreshInterval` | accept | Numeric setting validated implicitly by settings UI; multiplication `* 60 * 1000` is safe for any positive integer. ASVS L1 N/A. | closed |
| T-01-02 | DoS | `refreshInterval = 0` short-circuits cache-expiry to "always expired" | accept | Pre-existing behavior identical to prior code path; no regression. Settings-validation hardening is out of scope for Phase 1. | closed |
| T-01-03 | Information Disclosure | N/A — no data leaves plugin | N/A | Auto-close (no attack surface). | closed |
| T-01-04 | Repudiation/Spoofing/Elevation | N/A — no identity/auth boundary | N/A | Auto-close (no attack surface). | closed |
| T-02-01 | Tampering | NoteService getter reads `this.plugin.settings` live | accept | Single-line accessor with zero overhead; `plugin.settings` already mutated in-place by `saveSettings()`. ASVS L1 N/A. | closed |
| T-02-02 | Information Disclosure | NoteService accesses `this.plugin.app.vault` (was `this.app.vault`) | accept | Identical access surface — only the dereference path changed. Standard Obsidian-vault interaction pattern. | closed |
| T-02-03 | DoS/Spoofing/Repudiation/Elevation | N/A | N/A | Auto-close (no attack surface). | closed |
| T-02-04 | Tampering (TS strict-null) | `this.plugin.settings` could in principle be null at construction time | accept | `loadSettings()` runs in `onload` BEFORE `initializeServices()`. TS strictNullChecks already validates the access. | closed |
| T-03-01 | DoS | Detached timer callbacks firing into torn-down view (iOS rapid disable/enable crash) | mitigate | `detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` present in `src/main.ts:93` (onunload). `registerInterval` wrap was added in Plan 01-03 and later refined in Plan 01-06/01-07. | closed |
| T-03-02 | Tampering | Settings reset path: `saveSettings()` calls `clearInterval(this.refreshTimer)` then recreates | accept | Dual-handle pattern preserved. `clearRefreshTimer()` continues to null-guard. `private refreshTimer: number \| null = null` at `src/main.ts:16`. | closed |
| T-03-03 | InfoDisc/Spoof/Repud/Elev | N/A | N/A | Auto-close. | closed |
| T-03-04 | Tampering (Assumption A1) | `detachLeavesOfType` synchrony assumption | accept | Documented Obsidian semantic. If proven wrong post-merge, fallback is a one-line reorder; no security implication either way. | closed |
| T-04-01 | DoS | Orphaned mousemove/mouseup window listeners firing into torn-down view | mitigate | `protected async onClose(): Promise<void>` at `src/views/CalendarView.ts:53` removes both listeners under compound guard at line 54. Plan 01-06 added sibling startupTimer cleanup; Plan 01-10 widened the guard for strictNullChecks. | closed |
| T-04-02 | Tampering | Calling `handleDragEnd` from `onClose` would race teardown via saveSettings → refreshCalendarView | mitigate | D-09 honored — `grep "this.handleDragEnd("` in onClose body returns NO match. Only listener removal remains inside the guard at `src/views/CalendarView.ts:53-58`. | closed |
| T-04-03 | InfoDisc/Spoof/Repud/Elev | N/A | N/A | Auto-close. | closed |
| T-04-04 | Tampering (signature mismatch) | Wrong `onClose` signature would silently fail to override | mitigate | Signature `protected async onClose(): Promise<void>` confirmed at `src/views/CalendarView.ts:53`. | closed |
| T-05-01 | Tampering | Accidentally removing the renderAgendaList FUNCTION instead of just the import | mitigate | `export function renderAgendaList` present at `src/utils/viewRenderers.ts:81`. D-11 honored. | closed |
| T-05-02 | Tampering | Accidentally removing OTHER constants from `constants.ts` (e.g., MEMOCHRON_VIEW_TYPE) | mitigate | `MEMOCHRON_VIEW_TYPE = "memochron-calendar"` preserved at `src/utils/constants.ts:2`. | closed |
| T-05-03 | Tampering | Accidentally removing the `Time` import from CalendarService.ts | mitigate | `import { Component, Event as ICalEvent, parse, Time } from "ical.js"` preserved at `src/services/CalendarService.ts:2`. | closed |
| T-05-04 | InfoDisc/Spoof/Repud/Elev/DoS | N/A | N/A | Auto-close — pure dead-code removal. | closed |
| T-06-01 | DoS/Tampering | CalendarService 100ms one-shot timer firing post-teardown on iOS WKWebView (wrong-API mismatch: clearInterval applied to a setTimeout handle) | mitigate | Plugin owns handle: `private backgroundRefreshTimer: number \| null = null` at `src/main.ts:17`; setter `setBackgroundRefreshTimer(callback, delayMs): void` at `src/main.ts:195`; helper `clearBackgroundRefreshTimer()` at `src/main.ts:205`; called in onunload at `src/main.ts:95`. CalendarService delegates: `this.plugin.setBackgroundRefreshTimer(...)` at `src/services/CalendarService.ts:189`. The wrong-API call is gone — `grep "registerInterval(window.setTimeout" src/services/CalendarService.ts` returns NO match. | closed |
| T-06-02 | DoS/Tampering | CalendarView 50ms startup timer firing post-leaf-close on iOS WKWebView | mitigate | View owns handle: `private startupTimer: number \| null = null` at `src/views/CalendarView.ts:33`; cleared via `window.clearTimeout(this.startupTimer)` at `src/views/CalendarView.ts:60` inside onClose sibling block. | closed |
| T-06-03 | Tampering | Regression of D-09 (calling handleDragEnd from onClose) while editing the conditional | mitigate | startupTimer cleanup is a SIBLING step (lines 59-62), not a replacement. Original 2 `window.removeEventListener` calls preserved (count: 2 each for mousemove and mouseup across handleDragEnd + onClose). No `this.handleDragEnd(` invocation present in onClose body. | closed |
| T-06-04 | InfoDisc/Spoof/Repud/Elev | N/A | N/A | Auto-close. | closed |
| T-07-01 | DoS | Long-running plugin instance with many settings saves accumulating stale numeric IDs in Plugin's internal registerInterval array | mitigate | `grep "this.registerInterval(" src/main.ts` returns NO match. The redundant wrap was dropped in Plan 01-07. | closed |
| T-07-02 | Tampering | Accidentally removing the onunload `clearRefreshTimer()` call | mitigate | `grep -c "this.clearRefreshTimer()" src/main.ts` returns 2 (setupAutoRefresh + onunload). Both call sites preserved. | closed |
| T-07-03 | Tampering | Accidentally removing the refreshTimer field declaration | mitigate | `private refreshTimer: number \| null = null` preserved at `src/main.ts:16`. | closed |
| T-07-04 | InfoDisc/Spoof/Repud/Elev | N/A | N/A | Auto-close. | closed |
| T-08-01 | InfoDisc/Tampering | Truncated user input silently rendering an incomplete title or wrong date | mitigate | Broken `line.split(":").map` is gone in both files. `line.indexOf(":")` + substring path is present at `src/views/EmbeddedAgendaView.ts:415` and `src/views/EmbeddedCalendarView.ts:250`. | closed |
| T-08-02 | Tampering | Accidentally breaking the calendars-case `value.split(",")` (a different, correct split) | mitigate | `value.split(",")` preserved (multi-line form) in `src/views/EmbeddedAgendaView.ts:449`. | closed |
| T-08-03 | DoS | Malformed input (e.g., line with only `:`) producing empty-key entry | mitigate | `if (!key) continue;` empty-key guard preserved in both files (`src/views/EmbeddedAgendaView.ts:423`, `src/views/EmbeddedCalendarView.ts:258`). | closed |
| T-08-04 | Spoof/Repud/Elev | N/A | N/A | Auto-close. | closed |
| T-09-01 | Tampering | Accidentally importing wrong names or wrong module path | mitigate | All four functions imported from `"obsidian-daily-notes-interface"` at top of `src/views/EmbeddedCalendarView.ts:9-14`: `createDailyNote`, `getDailyNote`, `getAllDailyNotes`, `appHasDailyNotesPluginLoaded`. | closed |
| T-09-02 | Tampering | Accidentally leaving the dynamic `await import` in place after adding the static import | mitigate | `await import("obsidian-daily-notes-interface")` removed. Package-name string appears EXACTLY once in `src/views/EmbeddedCalendarView.ts` (the static import at line 14). | closed |
| T-09-03 | InfoDisc/DoS/Spoof/Repud/Elev | N/A | N/A | Auto-close. | closed |
| T-10-01 | Tampering / latent crash | Future code path that touches handleDragMoveBound or handleDragEndBound before createUI() runs | mitigate | Field types widened to `((e: MouseEvent) => void) \| undefined = undefined` at `src/views/CalendarView.ts:30-31`. Compound onClose guard at line 54 narrows the union. tsc -noEmit -skipLibCheck exits 0. | closed |
| T-10-02 | Tampering | Accidentally regressing D-09 while editing the conditional | mitigate | Body inside compound guard at `src/views/CalendarView.ts:54-58` contains exactly the two removeEventListener calls + `isDragging = false`. No `this.handleDragEnd(` call in onClose. | closed |
| T-10-03 | Tampering | Non-null assertions in handleDragStart/handleDragEnd masking a real bug if lifecycle changes | accept | Methods are only callable after `createUI()` has run (drag handlers are bound to the resize-handle's mousedown event by createUI). Documented invariant. | closed |
| T-10-04 | InfoDisc/Spoof/Repud/Elev/DoS | N/A | N/A | Auto-close. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Summary:** 38/38 closed. mitigate=20 (verified by grep), accept=8 (logged below), N/A=10 (auto-closed).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-01 | `refreshInterval` is a numeric setting validated implicitly by the existing settings UI; the multiplication `refreshInterval * 60 * 1000` is safe for any positive integer the settings tab accepts. ASVS L1 does not require additional validation. | gsd-security-auditor | 2026-05-10 |
| AR-01-02 | T-01-02 | Setting `refreshInterval = 0` or negative would cause cache-expiry to short-circuit to "always expired". This is pre-existing behavior — the prior `refreshMinutes * 60 * 1000` form had the same characteristic. No regression introduced by the live-read refactor. Settings-validation hardening is out of scope for Phase 1. | gsd-security-auditor | 2026-05-10 |
| AR-02-01 | T-02-01 | NoteService `private get settings()` getter is a single-line accessor with zero runtime overhead. `plugin.settings` is mutated in-place by `saveSettings()`; the getter just exposes the live reference. Standard JS getter idiom. ASVS L1 not applicable. | gsd-security-auditor | 2026-05-10 |
| AR-02-02 | T-02-02 | NoteService access to `this.plugin.app.vault` is identical in surface to the prior `this.app.vault` access — only the dereference path changed. The same vault data is already accessed elsewhere in the plugin. No new attack surface. | gsd-security-auditor | 2026-05-10 |
| AR-02-04 | T-02-04 | `loadSettings()` runs in `onload()` BEFORE `initializeServices()` is called — verified in `src/main.ts`. `plugin.settings` is non-null by the time NoteService is constructed. TypeScript strictNullChecks already validates the access. | gsd-security-auditor | 2026-05-10 |
| AR-03-02 | T-03-02 | Dual-handle pattern (manual `refreshTimer` field + matching cleanup paths) is preserved. `clearRefreshTimer()` null-guards. The `saveSettings()` reset path (cancel-and-recreate) continues to work as before. No regression to existing reset behavior. | gsd-security-auditor | 2026-05-10 |
| AR-03-04 | T-03-04 | `detachLeavesOfType` synchrony is a documented Obsidian semantic (View.onClose fires before detachLeavesOfType returns). Listed as LOW-risk assumption in 01-RESEARCH.md. If proven wrong post-merge, the fallback is a single-line reorder; no security implication either way. | gsd-security-auditor | 2026-05-10 |
| AR-10-03 | T-10-03 | Non-null assertions (`this.handleDragMoveBound!`, `this.handleDragEndBound!`) at the four addEventListener/removeEventListener sites in `handleDragStart` (lines 1075-1076) and `handleDragEnd` (lines 1100-1101) of `src/views/CalendarView.ts` are sound because both methods only run after `createUI()` has bound the drag handlers. The compound conditional in `onClose` provides defense in depth for the narrow lifecycle window. If a future refactor breaks the createUI-first invariant, the regression is the lifecycle change itself, not the assertion. | gsd-security-auditor | 2026-05-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. Every SUMMARY's "Threat Flags" / "Threat Surface Scan" section reports "None — no new attack surface". All implementation flags map to threats already declared in the plan-time register.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-10 | 38 | 38 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-10
