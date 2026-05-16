---
phase: 07-lifecycle-compatibility
date: 2026-05-15
status: complete
---

# Phase 7 — Human UAT Evidence

This file is the verification-of-record for Phase 7 (Lifecycle & Compatibility), consistent with Phases 1-6 practice. It captures the acceptance evidence for ROADMAP Phase 7 success criteria #5 (settings-modal persistence on plugin toggle / BUG-07) and #6 (popout-window rendering / DIR-06), and closes the DIR-05 / DIR-06 / DIR-07 / DIR-08 + BUG-07 manual-verification leg.

Per CONTEXT D-12, no PNG screenshots are committed; the walkthrough is live and the evidence is text inline.

---

## Pre-Conditions

- Plans 07-01 through 07-05 of Phase 7 are merged (see 07-0N-SUMMARY.md files).
- `npm run lint` exits 0 with Phase 7 override block deleted (recorded in 07-05-SUMMARY.md).
- `npx eslint --fix src/` is a no-op (recorded in 07-05-SUMMARY.md).
- All Phase 7 success-criterion greps return zero matches at HEAD (recorded in 07-01/02/03/04/05 SUMMARYs).
- Freshly built `main.js` + `manifest.json` + `styles.css` installed in the reviewer's test vault.
- Obsidian version: 1.12.7
- OS: macOS 26.4.1
- Comparison baseline: v1.14.0 release (post-Phase-6 baseline for sidebar parity check)

---

## UAT Step 1 — Popout Window Walkthrough

**Verifies:** DIR-06 / SC #6 — `activeDocument.documentElement` reads in popout window; `window.setTimeout` / `window.setInterval` timer scheduling correct under popout focus; drag-resize startup-timer behavior survives popout move.

**Steps:**
1. Open the sidebar calendar view (left-side ribbon icon or `Cmd/Ctrl+P → MemoChron: Open calendar view`).
2. Right-click the calendar tab header → select "Move to new window". Obsidian opens a new browser-window-style popout containing the calendar view.
3. In the popout, confirm the calendar grid renders with the correct accent colors (event dots in each calendar source's color; today/selected day highlights match theme). Verifies `activeDocument.documentElement` follows the popout's `<html>` element for CSS-variable reads.
4. Click month-prev and month-next navigation arrows. Confirm transitions are instantaneous and the grid updates cleanly.
5. Drag the resize handle DOWN to switch to week-view; drag UP to switch back to month-view. Confirm the height transition is smooth (verifies the `window.setTimeout`-based startup timer survives the popout context).
6. Leave the popout open. Wait for one auto-refresh interval (per the user's configured refresh-interval setting, default is 5 minutes — for UAT, the reviewer may temporarily lower the interval to ~1 minute via MemoChron settings, then restore after the test). Confirm one auto-refresh fires (event data updates if changed; otherwise visually unchanged but no errors in the dev console). Verifies `window.setInterval` continues to fire under popout focus.
7. Close the popout. Confirm the calendar leaf returns to the main window or terminates cleanly.

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 2 — Daily-Note Open Paths

**Verifies:** DIR-07 — `instanceof TFile` narrowing across the 3 daily-note open surfaces (sidebar agenda, embedded calendar code block, embedded agenda code block).

**Steps:**
1. In the main sidebar calendar view, navigate to a date that has an existing daily note (or create one first via Obsidian's `Cmd/Ctrl+P → Daily notes: Open today's daily note`).
2. In the sidebar agenda for that date, click the daily-note entry (the "Daily Note" row with the accent-colored dot). Confirm the daily note opens in a new tab. Verifies the `instanceof TFile` narrow at `CalendarView.ts:828` (former cast site).
3. In a markdown note (or create a new one), insert a fenced code block tagged `memochron-calendar`. Confirm the embedded calendar renders. Navigate to the same daily-note date and click the date cell — the calendar's day-click handler should open the daily note. Verifies the `instanceof TFile` narrow at `EmbeddedCalendarView.ts:234` (former cast site).
4. In the same or another note, insert a fenced code block tagged `memochron-agenda`. Confirm the embedded agenda renders. Click the daily-note entry. Verifies the `instanceof TFile` narrow at `EmbeddedAgendaView.ts:383` (former cast site).
5. (Optional regression check) Click a non-daily-note event in any of the 3 surfaces. Confirm it opens / creates the event note correctly (`getAbstractFileByPath` + the existing `instanceof TFile` narrow at `NoteService.ts:73` — pre-existing Phase 2 analog).

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 3 — Settings-Modal Persistence on Plugin Toggle

**Verifies:** BUG-07 / SC #5 — amendment A1 (deletion of `detachLeavesOfType` from `onunload`) eliminates the plugin-side trigger for the modal-close path. Open question per RESEARCH §"Conflict 1": the forum bug report reproduces with **core** plugins too, suggesting an Obsidian-side bug. If the modal still closes here, that confirms Obsidian-side root cause.

**Steps:**
1. Open Obsidian Settings (`Cmd/Ctrl + ,` or settings cog).
2. Click "Community plugins" in the left navigation.
3. Locate MemoChron in the installed-plugins list.
4. Click the toggle to disable MemoChron.
5. **Observe:** does the Settings modal STAY OPEN, or does it CLOSE?
    - **STAYS OPEN** → BUG-07 is closed. Record Pass below; note in Notes that A1's deletion of `detachLeavesOfType` from `onunload` eliminated the modal-close trigger.
    - **CLOSES** → BUG-07 is Obsidian-side. Record Fail below; note in Notes the reproduction steps + Obsidian version + OS. Plan 07-07 will land `BUG-07-CLOSURE.md` with the closure rationale.
6. (If modal stayed open) Re-enable MemoChron. Confirm the Settings modal still stays open. The toggle should re-load MemoChron without closing the modal.
7. (If modal closed in step 5) Re-open Obsidian Settings → Community plugins → re-enable MemoChron. Observe whether the same modal-close happens on enable.

**Result:** [x] Fail (modal stays open on disable, but closes on re-enable — closure goes to plan 07-07)
**Notes:**
- Disable direction: Settings modal **STAYS OPEN** when MemoChron is toggled off. A1's deletion of `detachLeavesOfType` from `onunload` eliminated the modal-close trigger in this direction.
- Enable direction: Settings modal **CLOSES** when MemoChron is toggled back on. The plugin's `onload` is not the trigger plugins can avoid — this matches the Obsidian 1.12.2 forum-thread report (https://forum.obsidian.md/t/settings-modal-closes-when-disabling-a-plugins-actively-focused-view/111479) where the same close happens with core plugins too. Reproduction environment: Obsidian 1.12.7, macOS 26.4.1.
- Per CONTEXT D-12 step 3 + D-11 step 5, plan 07-07 lands `BUG-07-CLOSURE.md` capturing the Obsidian-side root cause with reproduction steps and forum-thread evidence.

---

## UAT Step 4 — Sidebar Parity vs v1.14.0

**Verifies:** No visual regression in the sidebar calendar grid or agenda after the `activeDocument` + `window.*` adoption and the floating-promise + lifecycle rewrites. Mirror Phase 6 D-15 (no screenshot baseline; live visual inspection).

**Steps:**
1. Side-by-side or memory-compare the sidebar calendar grid against the v1.14.0 baseline (the reviewer's prior install or recollection of the post-Phase-6 state):
    - Event dots in source colors render identically
    - Today indicator (border / background) renders identically
    - Selected-day highlight renders identically
    - Month-prev / month-next transitions instant; no flicker
    - Drag-resize between month-view and week-view works (no broken handle)
2. Confirm the agenda below the grid renders identically:
    - Per-source color indicators on events
    - Daily-note entry (if enabled in settings) renders in accent color
    - Past events visually de-emphasized
    - "No events scheduled" placeholder renders when applicable
3. Click an event in the agenda — confirm it opens / creates the linked note correctly (regression check on the promise-hygiene rewrites in `CalendarView.ts`).

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 5 — Embedded-View Parity

**Verifies:** D-10 — `EmbeddedCalendarView` and `EmbeddedAgendaView` `onload(): void` synchronous wrappers do not regress the rendering or interaction behavior. The async work (former `await this.render()`) is now wrapped in `void this.loadAndRender()` with internal `try/catch` + `Notice`.

**Steps:**
1. Open or create a note containing a `memochron-calendar` fenced code block with default params.
2. Confirm the embedded calendar renders as a month grid identical to the pre-Phase-7 baseline. (The `void this.loadAndRender()` chain should complete and render within the same observable timeframe — there is no synchronization difference for the user.)
3. In the same or sibling note, embed a `memochron-agenda` code block.
4. Confirm the embedded agenda renders the day's events. Click a daily-note entry — confirm it opens via the new `instanceof TFile` narrow.
5. (Negative test, optional) Temporarily corrupt the plugin's calendar URL (e.g., set an obviously invalid URL via settings), reload the note's code block. The new `try/catch` inside `loadAndRender()` should surface the error as a Notice (verifies the error path of the D-10 rewrite). Restore the valid URL after testing.

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 6 — Lint Clean

**Verifies:** Plan 07-05 deleted the Phase 7 override block; `npm run lint` exits 0 with the 8 Phase 7 rules now actively enforced.

**Steps:**
1. From the repository root, run `npm run lint`.
2. Confirm exit code is 0 (no errors, no warnings related to Phase 7 rules).
3. Run `grep -nE 'Phase 7\b' eslint.config.mjs` — confirm zero matches (override block deleted).
4. Run `npx eslint --fix src/` — confirm `git status -s` reports zero source-side diff (the rules are already satisfied; `--fix` is a no-op).

**Result:** [x] Pass (after one inline gap-closure commit)
**Notes:**
- Initial UAT run surfaced 3 `obsidianmd/prefer-active-doc` warnings at `SettingsTab.ts:567,572,590` (the `document.createElementNS` calls in `buildColorSwatch`). These were missed by plan 07-02's DIR-06 sweep — Phase 6 D-12 exempted SVG `createElementNS` from DIR-04's `createElement` ban, but Phase 7's `prefer-active-doc` rule still flags the bare `document.` prefix.
- Fix landed inline as commit `72275fc` — `refactor(settings): adopt activeDocument for buildColorSwatch SVG creation (DIR-06 gap)` — converting the 3 sites to `activeDocument.createElementNS`.
- After the fix: `npm run lint` exits 0 with **0 errors, 0 warnings**.
- `grep -nE 'Phase 7\b' eslint.config.mjs` returns zero matches (override block deleted by plan 07-05).
- `npx eslint --fix src/` is a no-op (working tree clean after the gap-closure commit).

---

## Overall Acceptance

ROADMAP Phase 7 success criterion #5 (BUG-07) status: [x] FAIL (closure note in plan 07-07)
ROADMAP Phase 7 success criterion #6 (popout-window) status: [x] PASS

SC #5 fail is routed to plan 07-07 (`BUG-07-CLOSURE.md`). The fail mode is partial: A1's `detachLeavesOfType` deletion successfully prevents the modal from closing on plugin disable, but a separate Obsidian-side `onload`-triggered modal-close path remains on plugin re-enable. The forum thread evidence (Obsidian 1.12.2, core plugins reproduce) confirms this is an Obsidian-side bug, not a MemoChron defect.

SC #6 passes outright: popout-window rendering works, navigation works, drag-resize works, auto-refresh fires under popout focus. Sidebar parity, embedded-view parity, and daily-note open paths also pass.

Phase 7 is complete pending plan 07-07's BUG-07-CLOSURE.md commit. Phase 8 (Type Hygiene & Conventions / DOC-02) may begin once 07-07 lands.

---

Mobile UAT footer per CONTEXT D-13: Desktop-only verification; mobile audit deferred to v1.16 if regression reported.

---

*Phase: 07-lifecycle-compatibility*
*UAT executed: 2026-05-15*
*Reviewer: formax68 (michalis.e@onenet.group)*
