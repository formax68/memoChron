---
phase: 04-ux-enhancements
verified: 2026-05-12T00:00:00Z
status: gaps_found
score: 4/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Today's cell shows a distinct ring or border even when a different day is selected — both highlights are visible simultaneously"
    status: failed
    reason: "The ENH-01 ring uses `box-shadow: inset 0 0 0 2px var(--interactive-accent)` and the selected-state background also uses `var(--interactive-accent)`. When today is the selected day both colors are identical and the ring has zero contrast — it disappears. No `.memochron-day.today.selected` override rule exists. The smoke-test claim in 04-01-SUMMARY.md ('ring is still visible on all four inner edges' when selected) is factually incorrect given the CSS color math."
    artifacts:
      - path: "styles.css"
        issue: "Lines 146-148 and 162-164: `.memochron-day.selected { background-color: var(--interactive-accent) }` and `.memochron-day.today { box-shadow: inset 0 0 0 2px var(--interactive-accent) }` use identical CSS variable values. No combined `.memochron-day.today.selected` rule overrides the ring color."
    missing:
      - "Add `.memochron-day.today.selected { box-shadow: inset 0 0 0 2px var(--text-on-accent); }` immediately after the `.memochron-day.today` rule, so the ring switches to a contrasting color when today is also selected. Alternatively use `var(--text-normal)` for a single rule that contrasts both states."

  - truth: "Events in the agenda that already have an associated note show a file-check icon; events without a note show a file-plus icon"
    status: failed
    reason: "The icon rendering code is present (setIcon with file-check/file-plus on all three surfaces), but the CSS layout is broken: `.memochron-event-note-indicator { margin-left: auto }` has no effect because the parent `.memochron-agenda-event` is `display: block`, not a flex container. `margin-left: auto` on an `inline-flex` child in a block formatting context resolves to 0 — the icon renders on its own line below the location row rather than at the trailing end of the event row. WR-01 from the code review is confirmed."
    artifacts:
      - path: "styles.css"
        issue: "Line 359: `.memochron-agenda-event { display: block (implicit) }` — not a flex container. Line 630-636: `.memochron-event-note-indicator { display: inline-flex; margin-left: auto }` — auto margin has no trailing-end effect without a flex parent."
    missing:
      - "Add `display: flex; flex-wrap: wrap; align-items: center; gap: var(--size-4-1);` to `.memochron-agenda-event` so `margin-left: auto` on `.memochron-event-note-indicator` pushes it to the trailing end. Verify `.memochron-agenda-event.with-color::before` colored border still renders correctly with flex layout."
      - "Alternative: replace `margin-left: auto` with `position: absolute; top: 50%; right: var(--size-4-2); transform: translateY(-50%);` on `.memochron-event-note-indicator` — `.memochron-agenda-event` already has `position: relative`."
---

# Phase 4: UX Enhancements Verification Report

**Phase Goal:** Users see today clearly distinguished from the selected day, can tell which events already have notes without opening them, can use NL date format for note titles, can use named day/month variables in templates, and can place the editor cursor precisely after note creation.
**Verified:** 2026-05-12T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Today's cell shows a distinct ring or border even when today is also selected — both highlights visible simultaneously (SC#1 / ENH-01) | FAILED | `styles.css:162-164` ring uses `var(--interactive-accent)`; `styles.css:146-148` selected background uses same variable. No combined `.today.selected` rule. Ring is invisible in the dual-state case. |
| 2 | Agenda events with notes show file-check icon; events without show file-plus icon (SC#2 / ENH-02) | FAILED | Icon code is present and correct (`setIcon` with `file-check`/`file-plus` in all three render paths). CSS layout is broken: `.memochron-agenda-event` is `display: block`, so `margin-left: auto` on the indicator has no effect — icon renders below the row, not at trailing end. |
| 3 | "Note-exists dot" on calendar grid is off by default and toggleable (SC#3 / ENH-03) | VERIFIED | `src/settings/types.ts:93`: `showNoteIndicatorOnGrid: false`. Toggle in `SettingsTab.ts:849-854`. Grid indicator code in `CalendarView.ts:696-699` and `viewRenderers.ts:297-300`. |
| 4 | Settings date-format dropdown includes "DD-MM-YYYY (NL/EU)" and produces `15-01-2026` for Jan 15 event (SC#4 / ENH-04) | VERIFIED | `SettingsTab.ts:957` and `1604`: `{ value: "UK", label: "UK/EU (DD-MM-YYYY)" }`. Persisted value `"UK"` unchanged. `NoteService.formatDate` "UK" branch (`toLocaleDateString("en-GB", ...)` + `toFilenameSafeDate`) unchanged. |
| 5 | `{{day}}` and `{{month}}` in template produce `Monday` and `January` — not a number (SC#5 / ENH-05) | VERIFIED | `NoteService.ts:18,20`: interface fields. `NoteService.ts:286-287`: `event.start.toLocaleDateString("en-US", { weekday: "long" })` and `{ month: "long" }`. Both ride existing `applyTemplateVariables` path for body and title. |
| 6 | `{{cursor}}` places cursor at marker position after note opens — marker text absent from saved note (SC#6 / ENH-06) | PARTIAL | Marker stripping: VERIFIED unconditionally (`extractCursorMarker` strips all `{{cursor}}` before `vault.create`). Cursor placement: implemented but unreliable — `requestAnimationFrame` callback does not check `view.file?.path === file.path` (WR-03). On tab switch between `openFile` and rAF fire, cursor lands on wrong file. Both surfaces (`CalendarView.ts:961-967`, `EmbeddedAgendaView.ts:420-426`) have this gap. |

**Score:** 4/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `styles.css` | Inset ring on `.memochron-day.today`; corner-square on `.memochron-note-indicator`; icon spacing on `.memochron-event-note-indicator` | PARTIAL | Ring exists but invisible when today is selected (WR-02). Corner-square rule present and correct. Note-indicator CSS exists but parent not flex so icon layout is broken (WR-01). |
| `src/settings/types.ts` | `showNoteIndicatorOnGrid: boolean` with default `false` | VERIFIED | Lines 57 and 93 confirmed. |
| `src/utils/viewRenderers.ts` | Extended `RenderOptions` with `hasNote?` and `showNoteIndicatorOnGrid?`; trailing icon in `renderEventItem`; corner-square in `addEventIndicators` | VERIFIED | Lines 12-13 (RenderOptions fields), 220-222 (icon), 297-300 (corner-square). |
| `src/views/CalendarView.ts` | `renderEventNoteIndicator` method; re-renders after `createEventNote`; passes `hasNote`/`showNoteIndicatorOnGrid`; `MarkdownView` import; cursor placement after `openFile` | VERIFIED | All present. WR-03 gap in cursor placement is a correctness issue, not a missing artifact. |
| `src/views/EmbeddedCalendarView.ts` | Passes `hasNote` and `showNoteIndicatorOnGrid` through `RenderOptions` | VERIFIED | Lines 147-148 confirmed. |
| `src/views/EmbeddedAgendaView.ts` | Passes `hasNote`; re-renders after `createEventNote`; `MarkdownView` import; cursor placement | VERIFIED | All present. WR-03 applies here too. |
| `src/settings/SettingsTab.ts` | `showNoteIndicatorOnGrid` toggle; "UK/EU (DD-MM-YYYY)" label (×2); `{{day}}`, `{{month}}`, `{{cursor}}` in help text | VERIFIED | All confirmed. |
| `src/services/NoteService.ts` | `day`/`month` in `EventTemplateVariables`; `extractCursorMarker`; `createEventNote` returns `{ file, cursor }` | VERIFIED | All confirmed. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `viewRenderers.ts createDayElement` | `styles.css .memochron-day.today` | `.today` class applied | PARTIAL | Class application is correct; CSS rule exists but ring color equals background color when `.selected` — visual goal fails. |
| `viewRenderers.ts renderEventItem` | `setIcon('file-check'/'file-plus')` | `options.hasNote` callback | WIRED | Code confirmed at lines 220-222. Icon rendered correctly; display placement broken by CSS (WR-01). |
| `CalendarView renderEventNoteIndicator` | `setIcon('file-check'/'file-plus')` | `noteService.getExistingEventNote` | WIRED | Lines 894-896 confirmed. Same CSS display issue applies. |
| `SettingsTab.ts` | `types.ts showNoteIndicatorOnGrid` | Toggle onChange writes setting | WIRED | Lines 851-854 confirmed. |
| `NoteService.ts createEventNote` | `CalendarView showEventDetails` | `Promise<{ file, cursor }>` return shape | WIRED | `CalendarView.ts:936-942` destructures correctly. |
| `NoteService.ts createEventNote` | `EmbeddedAgendaView handleEventClick` | `Promise<{ file, cursor }>` return shape | WIRED | `EmbeddedAgendaView.ts:398-404` destructures correctly. |
| `CalendarView showEventDetails` | `MarkdownView.editor.setCursor` | `requestAnimationFrame` → `getActiveViewOfType` | PARTIAL | rAF fires correctly but no `view.file?.path === file.path` guard (WR-03). |
| `EmbeddedAgendaView handleEventClick` | `MarkdownView.editor.setCursor` | `requestAnimationFrame` → `getActiveViewOfType` | PARTIAL | Same WR-03 gap. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `viewRenderers.ts renderEventItem` note icon | `options.hasNote(event)` | `noteService.getExistingEventNote(event) !== null` — synchronous vault hash lookup | Yes | FLOWING (icon value is live; display placement broken by CSS) |
| `CalendarView addDayEventIndicator` corner-square | `events.some(e => noteService.getExistingEventNote(e) !== null)` guarded by `settings.showNoteIndicatorOnGrid` | Live settings + live vault lookup per render | Yes | FLOWING |
| `NoteService extractCursorMarker` | `cursor: { line, ch }` | Computed from template content before strip pass | Yes | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points without starting the Obsidian host application.

---

## Probe Execution

Step 7c: No probe scripts declared for this phase.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ENH-01 | 04-01-PLAN.md | Persistent today indicator visible simultaneously with selected state | BLOCKED | Ring exists in CSS but same color as selected background — invisible in dual state (WR-02) |
| ENH-02 | 04-04-PLAN.md | Agenda events show file-check/file-plus icon based on note existence | BLOCKED | Icon code correct; CSS parent layout prevents right-alignment — icon renders below row not at trailing end (WR-01) |
| ENH-03 | 04-04-PLAN.md | Optional toggleable grid note-indicator, off by default | SATISFIED | `showNoteIndicatorOnGrid: false` default; toggle wired; corner-square renders when enabled |
| ENH-04 | 04-02-PLAN.md | DD-MM-YYYY note title format discoverable to NL/EU users | SATISFIED | "UK/EU (DD-MM-YYYY)" label in both dropdowns; value "UK" unchanged |
| ENH-05 | 04-03-PLAN.md | `{{day}}` / `{{month}}` template variables produce English names | SATISFIED | `en-US` locale hard-coded; interface fields and return object populated |
| ENH-06 | 04-05-PLAN.md | `{{cursor}}` places cursor at position; marker absent from saved note | PARTIAL | Marker stripping is unconditional and correct. Cursor placement has active-file guard missing (WR-03) — can write cursor to wrong file on tab switch |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `styles.css:162-164` | `var(--interactive-accent)` ring on `var(--interactive-accent)` background — zero-contrast rendering | BLOCKER | ENH-01 / SC#1: ring invisible when today is selected; stated goal "both highlights visible simultaneously" not met |
| `styles.css:630-636` | `margin-left: auto` on child of `display: block` parent — auto margin resolves to 0 | BLOCKER | ENH-02 / SC#2: note-exists icon layout broken; icon renders below event row rather than at trailing end |
| `src/views/CalendarView.ts:961-967` | `requestAnimationFrame` cursor write without `view.file?.path === file.path` guard | WARNING | ENH-06 / SC#6 (partial): cursor may be written to wrong file on tab switch; non-deterministic corruption |
| `src/views/EmbeddedAgendaView.ts:420-426` | Same missing active-file guard | WARNING | Same ENH-06 correctness gap on embedded surface |

---

## Human Verification Required

None identified — all blockers and warnings are programmatically observable from the codebase.

---

## Gaps Summary

**2 blockers prevent the phase goal from being fully achieved.**

### Gap 1 — ENH-01 / SC#1: Today ring invisible when today is selected (WR-02)

Root cause: `styles.css` lines 162-164 use `var(--interactive-accent)` for the ring; lines 146-148 use the same variable for the selected background. No combined `.memochron-day.today.selected` rule exists to override the ring color with a contrasting value.

Fix: add to `styles.css` immediately after the `.memochron-day.today` rule:
```css
.memochron-day.today.selected {
  box-shadow: inset 0 0 0 2px var(--text-on-accent);
}
```

### Gap 2 — ENH-02 / SC#2: Note-exists icon CSS layout broken (WR-01)

Root cause: `.memochron-event-note-indicator` uses `margin-left: auto` to push the icon right, but `.memochron-agenda-event` is `display: block`, not flex. Auto margins have no push effect in a block formatting context.

Fix option A: Add flex layout to `.memochron-agenda-event`:
```css
.memochron-agenda-event {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--size-4-1);
}
```
Then verify the colored left-border `::before` pseudo-element and `overflow: hidden` still behave correctly.

Fix option B: Switch `.memochron-event-note-indicator` to absolute positioning:
```css
.memochron-event-note-indicator {
  position: absolute;
  top: 50%;
  right: var(--size-4-2);
  transform: translateY(-50%);
  color: var(--text-muted);
}
```
`.memochron-agenda-event` already has `position: relative` (line 365), so no parent change needed.

### Non-blocking warning: WR-03

ENH-06 cursor placement writes to whichever `MarkdownView` is active at rAF fire time, without confirming it is the file just opened. Adding `view.file?.path === file.path` guard in both `CalendarView.ts:962` and `EmbeddedAgendaView.ts:421` closes the gap. This does not block SC#6's mandatory claim ("marker text does not appear in saved note") but is a correctness defect in cursor targeting.

---

_Verified: 2026-05-12T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
