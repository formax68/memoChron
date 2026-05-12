---
phase: 04-ux-enhancements
verified: 2026-05-12T00:00:00Z
status: gaps_found
score: 5/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "Today's cell shows a distinct ring or border even when a different day is selected — both highlights are visible simultaneously (WR-02)"
    - "Events in the agenda that already have an associated note show a file-check icon; events without a note show a file-plus icon (WR-01)"
    - "Cursor placement targets the correct file after openFile (WR-03 promoted truth #6 from PARTIAL to VERIFIED)"
  gaps_remaining: []
  regressions:
    - "ENH-03 / truth #3 must be downgraded VERIFIED → FAILED: the grid corner-square uses var(--interactive-accent) and disappears when the day is also .selected (same zero-contrast bug class as WR-02 ring; previous verifier did not exercise the selected + has-note state combination). Surfaced by 04-REVIEW.md CR-01."
gaps:
  - truth: "Optional, toggleable calendar-grid marker (ENH-03) visibly marks days that contain at least one event with a note — including on the currently-selected day"
    status: failed
    reason: "styles.css:228 sets `.memochron-note-indicator { background-color: var(--interactive-accent) }`. styles.css:147 sets `.memochron-day.selected { background-color: var(--interactive-accent) }`. When a day with a note becomes the user's selected day, the corner-square dot has identical color to the cell background and is invisible — exactly the WR-02 bug class, applied to the note-indicator instead of the today-ring. The previous verifier validated truth #3 narrowly as 'off by default and toggleable' and did not exercise the selected-day state. ENH-03's requirement language is broader: it must visibly mark days containing notes, and the user's most-interrogated day is the one they have selected."
    artifacts:
      - path: "styles.css"
        issue: "Line 221-230: `.memochron-note-indicator` uses `background-color: var(--interactive-accent)` — same color as `.memochron-day.selected` background at line 147. No combined `.memochron-day.selected .memochron-note-indicator` override rule exists."
    missing:
      - "Add `.memochron-day.selected .memochron-note-indicator { background-color: var(--text-on-accent); }` immediately after the `.memochron-note-indicator` rule (around styles.css:230), so the corner-square switches to a contrasting color when its parent day is selected. Pattern matches the WR-02 resolution (Option A using --text-on-accent)."
overrides: []
---

# Phase 4: UX Enhancements Verification Report (Re-Verification)

**Phase Goal:** Users see today clearly distinguished from the selected day, can tell which events already have notes without opening them, can use NL date format for note titles, can use named day/month variables in templates, and can place the editor cursor precisely after note creation.
**Verified:** 2026-05-12T00:00:00Z
**Status:** gaps_found
**Re-verification:** Yes — after 04-06 gap-closure pass (commits 12e9f3b, af16a91, 31eb735)

---

## Re-Verification Summary

The 04-06 gap-closure plan successfully closed WR-01, WR-02, and WR-03. Truths #1, #2, and #6 from the previous verification all flip to VERIFIED. However, the post-gap-closure code review (04-REVIEW.md, commit 87730ff) surfaced **CR-01** — a new BLOCKER that is the exact analog of the WR-02 today-ring bug, applied to the ENH-03 corner-square indicator. The original verification did not exercise the selected-day state combination for the note-indicator; truth #3 must be downgraded.

Net score movement: 4/6 → 5/6. Three gaps closed (WR-01, WR-02, WR-03) and one regression introduced into the verified-truth set (CR-01 invalidates truth #3). Phase goal is not yet fully achieved.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Today's cell shows a distinct ring or border even when today is also selected — both highlights visible simultaneously (SC#1 / ENH-01) | VERIFIED | `styles.css:162-164` accent ring for unselected today; `styles.css:166-169` new `.memochron-day.today.selected` rule overrides with `inset 0 0 0 2px var(--text-on-accent)` — ring stays visible against the accent background. Commit 12e9f3b. |
| 2 | Agenda events with notes show file-check icon; events without show file-plus icon (SC#2 / ENH-02) | VERIFIED | Icon rendering present on all three surfaces (`viewRenderers.ts:220-223`, `CalendarView.ts:894-897`, `EmbeddedAgendaView.ts:338-341`). `styles.css:635-643` now uses absolute positioning (`position: absolute; top: var(--size-4-2); right: var(--size-4-2)`) anchored to parent `.memochron-agenda-event` at `position: relative` (styles.css:370). Indicator renders at trailing top-right of each event row. Commit af16a91. |
| 3 | Note-exists dot on calendar grid is off by default, toggleable, AND visibly marks days containing notes (SC#3 / ENH-03) | FAILED | Default-off and toggle wiring confirmed (`types.ts:57,93`; `SettingsTab.ts:851-854`; render guards in `CalendarView.ts:694-700` and `viewRenderers.ts:297-300`). HOWEVER, `styles.css:228` uses `background-color: var(--interactive-accent)` which is identical to `.memochron-day.selected` background at `styles.css:147`. No combined-state override rule exists. The corner-square is invisible when its day cell is selected — the exact WR-02 bug class applied to the note-indicator. Surfaced by 04-REVIEW.md CR-01. |
| 4 | Settings date-format dropdown includes "DD-MM-YYYY (NL/EU)" and produces `15-01-2026` for Jan 15 event (SC#4 / ENH-04) | VERIFIED | `SettingsTab.ts:957,1604`: `{ value: "UK", label: "UK/EU (DD-MM-YYYY)" }` in both global and per-calendar dropdowns. `NoteService.formatDate` "UK" branch unchanged (`toLocaleDateString("en-GB", ...)` + `toFilenameSafeDate`). |
| 5 | `{{day}}` and `{{month}}` in template produce `Monday` and `January` — not a number (SC#5 / ENH-05) | VERIFIED | `NoteService.ts:18,20`: interface fields `day: string` / `month: string`. `NoteService.ts:286-287`: `event.start.toLocaleDateString("en-US", { weekday: "long" })` and `{ month: "long" }`. Flows through `applyTemplateVariables` to both body and title. Help text in `SettingsTab.ts:940,1026` lists both variables. |
| 6 | `{{cursor}}` places cursor at marker position after note opens — marker text absent from saved note; cursor lands on the just-opened file, not on a different tabbed file (SC#6 / ENH-06) | VERIFIED | Marker stripping unconditional via `extractCursorMarker` (`NoteService.ts:183`). Cursor placement uses `requestAnimationFrame` and now guards with `view.file?.path === file.path` (CalendarView.ts:965; EmbeddedAgendaView.ts:424). Wrong-file cursor write is impossible at the user-visible site. Commit 31eb735. |

**Score:** 5/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `styles.css` `.memochron-day.today` | Inset accent ring on today | VERIFIED | Line 162-164. |
| `styles.css` `.memochron-day.today.selected` | Override ring with --text-on-accent when today is also selected | VERIFIED | Line 167-169 (added by commit 12e9f3b). |
| `styles.css` `.memochron-event-note-indicator` | Trailing-end icon at top-right of agenda event row via absolute positioning | VERIFIED | Line 634-643: `position: absolute; top: var(--size-4-2); right: var(--size-4-2)`. No `margin-left: auto` (commit af16a91 removed it). |
| `styles.css` `.memochron-note-indicator` | Visible corner-square dot for ENH-03 in all relevant cell states | FAILED | Line 221-230: defines square with `var(--interactive-accent)` background. No `.selected .memochron-note-indicator` override — square is invisible when day is selected (CR-01). |
| `src/settings/types.ts` `showNoteIndicatorOnGrid` | Boolean field with `false` default | VERIFIED | Lines 57 and 93. |
| `src/utils/viewRenderers.ts` `RenderOptions` | `hasNote?` and `showNoteIndicatorOnGrid?` fields; trailing icon in `renderEventItem`; corner-square in `addEventIndicators` | VERIFIED | Lines 12-13, 220-222, 297-300. |
| `src/views/CalendarView.ts` rAF active-file guard | `view.file?.path === file.path` inside rAF callback in `showEventDetails` | VERIFIED | Line 965 (added by commit 31eb735). `MarkdownView` imported at line 1. |
| `src/views/EmbeddedAgendaView.ts` rAF active-file guard | `view.file?.path === file.path` inside rAF callback in `handleEventClick` | VERIFIED | Line 424 (added by commit 31eb735). `MarkdownView` imported at line 1. |
| `src/services/NoteService.ts` template variables | `day`/`month` on `EventTemplateVariables`; `extractCursorMarker` helper; `createEventNote` returns `{ file, cursor }` | VERIFIED | Lines 7-27 (interface), 183 (helper), 66 (return type), 286-287 (en-US locale calls). |
| `src/settings/SettingsTab.ts` | `showNoteIndicatorOnGrid` toggle; "UK/EU (DD-MM-YYYY)" label (×2); `{{day}}`/`{{month}}`/`{{cursor}}` in help text | VERIFIED | Lines 851-854, 957, 1604, 940, 1026. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `viewRenderers.ts createDayElement` | `styles.css .memochron-day.today` + `.memochron-day.today.selected` | `.today` class application; CSS specificity ordering | WIRED | Both rules present; ring contrast works for both unselected and selected states. |
| `viewRenderers.ts addEventIndicators` + `CalendarView.ts addDayEventIndicator` | `styles.css .memochron-note-indicator` | DOM `div.memochron-note-indicator` created when `showNoteIndicatorOnGrid && events.some(hasNote)` | PARTIAL | Code wiring correct; CSS color renders invisible against `.selected` background (CR-01). |
| `viewRenderers.ts renderEventItem` + `CalendarView.ts renderEventNoteIndicator` + `EmbeddedAgendaView.ts renderEventItem` | `setIcon('file-check'/'file-plus')` at top-right of `.memochron-agenda-event` row | `noteService.getExistingEventNote(event) !== null`; CSS absolute positioning | WIRED | All three surfaces render icon; absolute positioning anchors correctly to the `position: relative` parent. |
| `SettingsTab.ts` | `types.ts showNoteIndicatorOnGrid` | Toggle onChange writes setting + refreshCalendarView | WIRED | Lines 851-854 confirmed. |
| `NoteService.ts createEventNote` | `CalendarView.showEventDetails` and `EmbeddedAgendaView.handleEventClick` | `Promise<{ file: TFile; cursor: ... | null }>` return shape | WIRED | Both surfaces destructure correctly (CalendarView.ts:940-942, EmbeddedAgendaView.ts:402-404). |
| `CalendarView.showEventDetails` rAF | `MarkdownView.editor.setCursor` | `requestAnimationFrame` → `getActiveViewOfType(MarkdownView)` with `view.file?.path === file.path` guard | WIRED | Line 963-969. Guard prevents wrong-file cursor write. |
| `EmbeddedAgendaView.handleEventClick` rAF | `MarkdownView.editor.setCursor` | Same pattern via `this.plugin.app.workspace` | WIRED | Line 422-428. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `viewRenderers.ts renderEventItem` note icon | `options.hasNote(event)` | `noteService.getExistingEventNote(event) !== null` — synchronous vault lookup | Yes | FLOWING |
| `CalendarView.ts addDayEventIndicator` corner-square | `events.some(e => noteService.getExistingEventNote(e) !== null)` guarded by `settings.showNoteIndicatorOnGrid` | Live settings + live vault lookup | Yes | FLOWING (data correct; CSS rendering broken in selected state) |
| `NoteService.ts extractCursorMarker` | `cursor: { line, ch }` | Computed from post-frontmatter body content; `(line, ch)` of first `{{cursor}}` after closing `---` | Yes | FLOWING |
| `CalendarView.ts` + `EmbeddedAgendaView.ts` rAF cursor write | `pos` from `cursorPos` + `view.file?.path === file.path` guard | `createEventNote` return value piped via destructuring | Yes | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build green (TypeScript + esbuild) | `npm run build` | exit 0, no errors, no warnings | PASS |

Visual rendering checks (CSS contrast, icon layout, ring visibility) require running Obsidian and are routed to human verification — none required because all five gaps and one new gap are programmatically observable in the source.

---

## Probe Execution

No probe scripts declared for this phase.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ENH-01 | 04-01-PLAN.md | Persistent today indicator visible simultaneously with selected state | SATISFIED | Dual-rule design `.memochron-day.today` + `.memochron-day.today.selected` covers both states; commit 12e9f3b. |
| ENH-02 | 04-04-PLAN.md | Agenda events show file-check/file-plus icon based on note existence | SATISFIED | Icon code on all three surfaces; CSS absolute-positioning anchors icon to top-right of each row; commit af16a91. |
| ENH-03 | 04-04-PLAN.md | Optional toggleable grid note-indicator, off by default, marking days with notes | BLOCKED | Default-off + toggle wiring satisfied. Render code correct. CSS contrast fails on the selected-day branch (CR-01); indicator silently vanishes from the user's currently-selected day — the day they care about most. |
| ENH-04 | 04-02-PLAN.md | DD-MM-YYYY note title format discoverable to NL/EU users | SATISFIED | "UK/EU (DD-MM-YYYY)" label present in both dropdowns; persisted value "UK" unchanged; formatter logic untouched. |
| ENH-05 | 04-03-PLAN.md | `{{day}}` / `{{month}}` template variables produce English names | SATISFIED | `en-US` locale hard-coded; interface fields populated; help text updated. |
| ENH-06 | 04-05-PLAN.md | `{{cursor}}` places cursor at position; marker absent from saved note; lands on correct file | SATISFIED | Marker stripping unconditional. Cursor placement now guards `view.file?.path === file.path` (commit 31eb735). |

All six ENH-* requirement IDs from REQUIREMENTS.md are accounted for and present in PLAN frontmatter (04-01..04-06). ENH-03 is the only requirement that does not currently SATISFY.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `styles.css` | 221-230 + 146-148 | `var(--interactive-accent)` corner-square on `var(--interactive-accent)` background when `.selected .memochron-note-indicator` resolves — zero-contrast rendering | BLOCKER (CR-01) | ENH-03 / SC#3: corner-square invisible on selected day; "marks days that contain at least one event with a note" semantically broken for the user's current day. |
| `styles.css` | 11 | Dead CSS variable `--color-text-today: var(--interactive-accent)` declared on `:root` with zero usages | INFO (IN-01 from REVIEW) | None — declared but unused; cleanup item. |
| `src/views/CalendarView.ts` | 959-962 | Inner `const file = createdFile` shadowing the outer `let file` to satisfy strict-null narrowing inside the rAF closure | INFO (IN-02 from REVIEW) | None — behavior correct; minor readability nit. Same pattern duplicated in EmbeddedAgendaView.ts:418-421. |
| `src/views/EmbeddedAgendaView.ts` | 391-432 | `handleEventClick` does not wrap `createEventNote` in try/catch; rejection escapes as unhandled promise rejection (CalendarView has the equivalent guard) | WARNING (WR-01 from REVIEW) | Embedded surface lacks the user-feedback parity. Does not block any of the six SCs but is a divergence from `CalendarView.addEventClickHandler:918-925`. Out of scope for this verification pass; route to a future hardening plan. |
| `src/views/CalendarView.ts` + `src/views/EmbeddedAgendaView.ts` | rAF sites | rAF handle is not cancelled on view unload (IN-03/WR-02 from REVIEW). Active-file guard prevents wrong-file cursor write, so user-visible bug is impossible — but the callback still runs after unload. | WARNING | Does not affect SC#6 (the guard makes the wrong-file write impossible). Lifecycle hygiene concern only. |
| `src/utils/viewRenderers.ts` + `src/views/CalendarView.ts` | 164-224 + 835-853 | Per-surface duplication of `renderEventItem` extended by ENH-02 work — two near-identical agenda row renderers | INFO (IN-03 from REVIEW) | None — both surfaces are exercised by ENH-02; duplication is debt, not defect. |
| `src/utils/viewRenderers.ts` + `src/views/EmbeddedAgendaView.ts` vs `src/views/CalendarView.ts` | 220-223 / 338-341 vs 894-897 | Note icon rendering is gated on `options.hasNote` in shared/embedded paths but unconditional in CalendarView | INFO (IN-04 from REVIEW) | None today (all callers provide `hasNote`); latent risk if a future caller forgets. |

No debt-marker comments (TBD/FIXME/XXX) found in the modified files.

---

## Human Verification Required

None — the one blocker (CR-01) is programmatically observable from the codebase (CSS variable equality + missing combined-state override). The 04-REVIEW.md warnings WR-01 (embedded-agenda try/catch parity) and IN-03/WR-02 (rAF unload cleanup) are out of scope for the phase-goal verification — they do not block any of the six SCs.

---

## Gaps Summary

**One blocker prevents the phase goal from being fully achieved.**

### Gap 1 — ENH-03 / SC#3 / Truth #3: Note-indicator corner-square invisible on selected day (CR-01)

Root cause: `styles.css:221-230` defines the corner-square with `background-color: var(--interactive-accent)`. `styles.css:146-148` defines the selected-day cell with `background-color: var(--interactive-accent)`. Identical color; zero contrast; the square disappears whenever the day with a note is the user's current selected day.

This is the exact analog of WR-02 (today-ring contrast) that the 04-06 gap-closure plan just fixed. The previous verifier validated truth #3 narrowly as "off by default and toggleable" and did not exercise the selected + has-note state combination; truth #3 must be downgraded from VERIFIED to FAILED in this re-verification.

Practical user impact: a user who enables `showNoteIndicatorOnGrid` to glance-check which days have notes will see the indicator silently vanish on whichever day they are currently clicked into — defeating the feature's stated purpose ("marks days that contain at least one event with a note", REQUIREMENTS ENH-03). Today + selected + has-note is the worst case: the ring is now visible (post-WR-02), but the note-dot is not.

**Fix:** Add a combined-state override immediately after the existing `.memochron-note-indicator` rule (around styles.css:230):

```css
/* ENH-03: contrasting indicator when the day is also selected — survives the accent background */
.memochron-day.selected .memochron-note-indicator {
  background-color: var(--text-on-accent);
}
```

Pattern is identical to the WR-02 resolution (REVIEW.md CR-01 Fix block). Single-rule diff; no parent change; uses the same theme-aware `--text-on-accent` token that was vetted in 04-06.

### Non-blocking observations (do not affect phase goal)

- **REVIEW.md WR-01 (embedded-agenda try/catch parity):** `EmbeddedAgendaView.handleEventClick` (lines 391-432) does not wrap `createEventNote` in try/catch. CalendarView already does (lines 918-925). Surface divergence; out of scope for closing Phase 4 SCs but worth queuing.
- **REVIEW.md IN-03 / WR-02 (rAF unload cleanup):** Neither rAF call site cancels the pending frame on view unload. The active-file guard added by 04-06 makes the wrong-file cursor write impossible, so SC#6 is not at risk — but the callback still runs against the live `app.workspace` after unload. Pure lifecycle hygiene.
- **REVIEW.md IN-01 / IN-02 / IN-03 / IN-04 (code-quality smells):** Dead CSS variable, closure-shadow pattern, sidebar/shared duplication, optional-vs-unconditional `hasNote` gating. None block any SC.

---

_Verified: 2026-05-12T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Mode: re-verification after 04-06 gap closure_
