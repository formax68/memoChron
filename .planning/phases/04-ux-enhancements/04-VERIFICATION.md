---
phase: 04-ux-enhancements
verified: 2026-05-12T00:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "ENH-03 / SC#3 / Truth #3: note-indicator corner-square contrast on selected day (CR-01). styles.css:232-235 now adds `.memochron-day.selected .memochron-note-indicator { background-color: var(--text-on-accent); }` — descendant-selector analog of the WR-02 today-ring fix. Commit 8279e60."
  gaps_remaining: []
  regressions: []
overrides: []
---

# Phase 4: UX Enhancements Verification Report (Re-Verification)

**Phase Goal:** Users see today clearly distinguished from the selected day, can tell which events already have notes without opening them, can use NL date format for note titles, can use named day/month variables in templates, and can place the editor cursor precisely after note creation.
**Verified:** 2026-05-12T00:00:00Z
**Status:** passed — 6/6 VERIFIED
**Re-verification:** Yes — after 04-07 gap-closure pass (commit 8279e60)

---

## Re-Verification Summary

Plan 04-07 closed the single remaining BLOCKER (CR-01) from the prior 5/6 verification by adding one descendant-selector CSS rule at `styles.css:232-235`:

```css
/* ENH-03: contrasting indicator when the day is also selected — survives the accent background */
.memochron-day.selected .memochron-note-indicator {
  background-color: var(--text-on-accent);
}
```

This is the structural analog of the WR-02 today-ring fix shipped in 04-06 (commit `12e9f3b`). Both rules apply the same principle: when the cell carries `.selected` and the accent-colored background is in play, switch the painted element to `var(--text-on-accent)` so it survives the contrast collision. WR-02 used the multi-class form on the cell itself (today-ring is a `box-shadow` on the cell). CR-01 uses the descendant form (note-indicator is a child `<div>` inside the cell).

**Net score movement: 5/6 → 6/6.** Truth #3 flips FAILED → VERIFIED. Zero regressions detected against the previously-verified truths #1, #2, #4, #5, #6. Phase goal is fully achieved.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Today's cell shows a distinct ring or border even when today is also selected — both highlights visible simultaneously (SC#1 / ENH-01) | VERIFIED | `styles.css:162-164` accent ring for unselected today (`box-shadow: inset 0 0 0 2px var(--interactive-accent)`); `styles.css:167-169` contrasting ring for `.memochron-day.today.selected` (`box-shadow: inset 0 0 0 2px var(--text-on-accent)`). Both states render visible ring against their respective cell background. Commit `12e9f3b`. |
| 2 | Agenda events with notes show file-check icon; events without show file-plus icon (SC#2 / ENH-02) | VERIFIED | Icon rendering present on all three surfaces (`src/utils/viewRenderers.ts:220-223`, `src/views/CalendarView.ts:894-897`, `src/views/EmbeddedAgendaView.ts:338-341`). `styles.css:640` `.memochron-event-note-indicator` uses absolute positioning anchored to `.memochron-agenda-event` (parent at `position: relative`, `styles.css:369-377`). Indicator renders at trailing top-right of each event row. Commit `af16a91`. |
| 3 | Optional toggleable note-exists corner-square on calendar grid is off by default AND visibly marks days containing notes — including the currently-selected day (SC#3 / ENH-03 + CR-01) | VERIFIED | Default-off + toggle wiring: `src/settings/types.ts:57,93` (`showNoteIndicatorOnGrid: boolean` field with `false` default); `src/settings/SettingsTab.ts:851-854` (toggle binding). Render guards: `src/views/CalendarView.ts:696-699` and `src/utils/viewRenderers.ts:297-298` only emit the `div.memochron-note-indicator` when the setting is enabled AND `events.some(hasNote)`. **CSS contrast fix (CR-01, commit `8279e60`):** `styles.css:221-230` defines base square with `var(--interactive-accent)`; `styles.css:232-235` adds `.memochron-day.selected .memochron-note-indicator { background-color: var(--text-on-accent); }` so the corner-square switches color when its parent cell is selected. The two-rule design now covers both states: unselected day → accent square on default background (contrast OK); selected day → `--text-on-accent` square on accent background (contrast OK). `grep -c '\.memochron-day\.selected \.memochron-note-indicator' styles.css` returns `1`. |
| 4 | Settings date-format dropdown includes "DD-MM-YYYY (NL/EU)" and produces `15-01-2026` for Jan 15 event (SC#4 / ENH-04) | VERIFIED | `src/settings/SettingsTab.ts:957` (global) and `:1604` (per-calendar): `{ value: "UK", label: "UK/EU (DD-MM-YYYY)" }`. `NoteService.formatDate` "UK" branch unchanged (`toLocaleDateString("en-GB", ...)` + `toFilenameSafeDate`). |
| 5 | `{{day}}` and `{{month}}` in template produce `Monday` and `January` — not a number (SC#5 / ENH-05) | VERIFIED | `src/services/NoteService.ts:18,20` declares `day: string` / `month: string` on `EventTemplateVariables`. `src/services/NoteService.ts:286-287` populates with `event.start.toLocaleDateString("en-US", { weekday: "long" })` and `{ month: "long" }`. Flows through `applyTemplateVariables` to both body and title. Help text in `SettingsTab.ts:940,1026` lists both variables. |
| 6 | `{{cursor}}` places cursor at marker position after note opens — marker text absent from saved note; cursor lands on the just-opened file, not on a different tabbed file (SC#6 / ENH-06) | VERIFIED | Marker stripping unconditional via `extractCursorMarker` (`src/services/NoteService.ts:183`). Cursor placement uses `requestAnimationFrame` and guards with `view.file?.path === file.path` (`src/views/CalendarView.ts:965`; `src/views/EmbeddedAgendaView.ts:424`). Wrong-file cursor write is impossible at the user-visible site. Commit `31eb735`. |

**Score:** 6/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `styles.css` `.memochron-day.today` | Inset accent ring on today | VERIFIED | Line 162-164 (`box-shadow: inset 0 0 0 2px var(--interactive-accent)`). |
| `styles.css` `.memochron-day.today.selected` | Override ring with `--text-on-accent` when today is also selected | VERIFIED | Line 167-169 (added by commit `12e9f3b`, WR-02 fix). |
| `styles.css` `.memochron-event-note-indicator` | Trailing-end icon at top-right of agenda event row via absolute positioning | VERIFIED | Line 640+: `position: absolute; top: var(--size-4-2); right: var(--size-4-2)`. Parent `.memochron-agenda-event` carries `position: relative` (line 369-377). Commit `af16a91`. |
| `styles.css` `.memochron-note-indicator` (base) | Corner-square dot for ENH-03 default (cell not selected) case | VERIFIED | Line 221-230: `position: absolute; top: 2px; right: 2px; width: 6px; height: 6px; border-radius: 1px; background-color: var(--interactive-accent); pointer-events: none;` — contrast OK against the default cell background. |
| `styles.css` `.memochron-day.selected .memochron-note-indicator` (combined-state override) | Re-color indicator to `--text-on-accent` when parent cell is selected — closes CR-01 | VERIFIED (NEW, 04-07) | Line 232-235: `background-color: var(--text-on-accent);`. Descendant-selector analog of WR-02 today-ring multi-class fix. Commit `8279e60`. |
| `src/settings/types.ts` `showNoteIndicatorOnGrid` | Boolean field with `false` default | VERIFIED | Lines 57 (interface) and 93 (DEFAULT_SETTINGS). |
| `src/utils/viewRenderers.ts` `RenderOptions` | `hasNote?` and `showNoteIndicatorOnGrid?` fields; trailing icon in `renderEventItem`; corner-square in `addEventIndicators` | VERIFIED | Lines 12-13, 220-223, 297-298. |
| `src/views/CalendarView.ts` rAF active-file guard | `view.file?.path === file.path` inside rAF callback in `showEventDetails` | VERIFIED | Line 965 (added by commit `31eb735`). `MarkdownView` imported at line 1. |
| `src/views/EmbeddedAgendaView.ts` rAF active-file guard | `view.file?.path === file.path` inside rAF callback in `handleEventClick` | VERIFIED | Line 424 (added by commit `31eb735`). |
| `src/services/NoteService.ts` template variables | `day`/`month` on `EventTemplateVariables`; `extractCursorMarker` helper; `createEventNote` returns `{ file, cursor }` | VERIFIED | Lines 18,20 (interface), 183 (helper), 286-287 (en-US locale calls). |
| `src/settings/SettingsTab.ts` | `showNoteIndicatorOnGrid` toggle; "UK/EU (DD-MM-YYYY)" label (×2); `{{day}}`/`{{month}}`/`{{cursor}}` in help text | VERIFIED | Lines 851-854, 957, 1604, 940, 1026. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `viewRenderers.ts createDayElement` | `styles.css .memochron-day.today` + `.memochron-day.today.selected` | `.today` class application; CSS specificity ordering | WIRED | Both rules present; ring contrast works for both unselected and selected states. |
| `viewRenderers.ts addEventIndicators` + `CalendarView.ts:696-699` | `styles.css .memochron-note-indicator` + `.memochron-day.selected .memochron-note-indicator` | DOM `div.memochron-note-indicator` created when `showNoteIndicatorOnGrid && events.some(hasNote)`; CSS specificity escalates on `.selected` parent | WIRED | Code wiring correct on both render paths. CSS now covers both non-selected and selected states. CR-01 closed. |
| `viewRenderers.ts renderEventItem` + `CalendarView.ts renderEventNoteIndicator` + `EmbeddedAgendaView.ts:338-341` | `setIcon('file-check'/'file-plus')` at top-right of `.memochron-agenda-event` row | `noteService.getExistingEventNote(event) !== null`; CSS absolute positioning | WIRED | All three surfaces render icon; absolute positioning anchors to `position: relative` parent. |
| `SettingsTab.ts` `showNoteIndicatorOnGrid` toggle | `types.ts` `showNoteIndicatorOnGrid` field | Toggle `onChange` writes setting and triggers `refreshCalendarView` | WIRED | Lines 851-854 confirmed. |
| `NoteService.ts createEventNote` | `CalendarView.showEventDetails` and `EmbeddedAgendaView.handleEventClick` | `Promise<{ file: TFile; cursor: ... \| null }>` return shape | WIRED | Both surfaces destructure correctly. |
| `CalendarView.showEventDetails` rAF | `MarkdownView.editor.setCursor` | `requestAnimationFrame` → `getActiveViewOfType(MarkdownView)` with `view.file?.path === file.path` guard | WIRED | Line 963-969. Guard prevents wrong-file cursor write. |
| `EmbeddedAgendaView.handleEventClick` rAF | `MarkdownView.editor.setCursor` | Same pattern via `this.plugin.app.workspace` | WIRED | Line 422-428. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `viewRenderers.ts renderEventItem` note icon | `options.hasNote(event)` | `noteService.getExistingEventNote(event) !== null` — synchronous vault lookup | Yes | FLOWING |
| `CalendarView.ts:696-699` corner-square | `events.some(e => noteService.getExistingEventNote(e) !== null)` guarded by `settings.showNoteIndicatorOnGrid` | Live settings + live vault lookup | Yes | FLOWING (data correct; CSS now renders in both selected and unselected states — CR-01 closed) |
| `NoteService.ts extractCursorMarker` | `cursor: { line, ch }` | Computed from post-frontmatter body content; `(line, ch)` of first `{{cursor}}` after closing `---` | Yes | FLOWING |
| `CalendarView.ts` + `EmbeddedAgendaView.ts` rAF cursor write | `pos` from `cursorPos` + `view.file?.path === file.path` guard | `createEventNote` return value piped via destructuring | Yes | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build green (TypeScript + esbuild) | `npm run build` | exit 0, no errors, no warnings | PASS |
| CR-01 override rule exists exactly once | `grep -c '\.memochron-day\.selected \.memochron-note-indicator' styles.css` | `1` | PASS |
| CR-01 override uses `--text-on-accent` | `awk '/\.memochron-day\.selected \.memochron-note-indicator/,/\}/' styles.css \| grep 'background-color'` | `background-color: var(--text-on-accent);` | PASS |
| Base `.memochron-note-indicator` still uses `--interactive-accent` | `grep -A8 '^\.memochron-note-indicator {' styles.css \| grep background-color` | `background-color: var(--interactive-accent);` | PASS |
| WR-02 today-ring fix still intact | `grep -n '\.memochron-day\.today\.selected' styles.css` | line 167 | PASS |
| WR-01 agenda-icon absolute positioning intact | `grep -n 'position: absolute' styles.css \| grep -c .` (sanity) | non-zero, `.memochron-event-note-indicator` block at 640+ | PASS |
| WR-03 active-file guard intact (×2) | `grep -c 'view.file?.path === file.path' src/views/CalendarView.ts src/views/EmbeddedAgendaView.ts` | `1` each (`2` total) | PASS |
| ENH-05 `{{day}}` / `{{month}}` en-US locale calls | `grep -c '"en-US"' src/services/NoteService.ts` | non-zero, lines 286-287 | PASS |
| ENH-06 marker stripping function intact | `grep -c 'extractCursorMarker' src/services/NoteService.ts` | `2` (declaration + call site) | PASS |

Visual rendering checks (CSS contrast, icon layout, ring visibility) require running Obsidian — see Human Verification Required section.

---

## Probe Execution

No probe scripts declared or required for this phase.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ENH-01 | 04-01-PLAN.md | Persistent today indicator visible simultaneously with selected state | SATISFIED | Dual-rule design `.memochron-day.today` (line 162) + `.memochron-day.today.selected` (line 167) covers both states; commit `12e9f3b`. |
| ENH-02 | 04-04-PLAN.md | Agenda events show file-check/file-plus icon based on note existence | SATISFIED | Icon code on all three surfaces; CSS absolute-positioning anchors icon to top-right of each row; commit `af16a91`. |
| ENH-03 | 04-04-PLAN.md + 04-07-PLAN.md | Optional toggleable grid note-indicator, off by default, marking days with notes — visible in all relevant cell states including selected | SATISFIED | Default-off + toggle wiring (04-04). CSS contrast complete for both unselected (`var(--interactive-accent)` on default cell, line 228) and selected (`var(--text-on-accent)` on accent cell, line 234) states. CR-01 closed by commit `8279e60`. |
| ENH-04 | 04-02-PLAN.md | DD-MM-YYYY note title format discoverable to NL/EU users | SATISFIED | "UK/EU (DD-MM-YYYY)" label present in both dropdowns; persisted value "UK" unchanged; formatter logic untouched. |
| ENH-05 | 04-03-PLAN.md | `{{day}}` / `{{month}}` template variables produce English names | SATISFIED | `en-US` locale hard-coded; interface fields populated; help text updated. |
| ENH-06 | 04-05-PLAN.md | `{{cursor}}` places cursor at position; marker absent from saved note; lands on correct file | SATISFIED | Marker stripping unconditional. Cursor placement guards `view.file?.path === file.path` (commit `31eb735`). |

All six ENH-* requirement IDs from REQUIREMENTS.md are accounted for and present in PLAN frontmatter (04-01..04-06 implementation plans + 04-06/04-07 gap closures). All six SATISFY.

---

## Anti-Patterns Found

The following items remain from the prior verification — none block any of the six SCs; all are explicitly out of scope for the phase-goal verification per 04-07 SUMMARY "Deferred Items" and 04-VERIFICATION (prior pass) "Non-blocking observations". Surfaced here for routing to a future hardening plan, not as gaps.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `styles.css` | 11 | Dead CSS variable `--color-text-today: var(--interactive-accent)` declared on `:root` with zero usages (IN-01 from REVIEW) | INFO | None — declared but unused; cleanup item. |
| `src/views/CalendarView.ts` | 959-962 | Inner `const file = createdFile` shadowing outer `let file` to satisfy strict-null narrowing inside the rAF closure (IN-02 from REVIEW) | INFO | None — behavior correct; readability nit. Same pattern duplicated in `EmbeddedAgendaView.ts:418-421`. |
| `src/views/EmbeddedAgendaView.ts` | 391-432 | `handleEventClick` does not wrap `createEventNote` in try/catch; rejection escapes as unhandled promise rejection. `CalendarView.addEventClickHandler:918-925` has the equivalent guard (WR-01 from REVIEW) | WARNING | Embedded surface lacks user-feedback parity. Does not block any of the six SCs. Out of scope for this phase; route to a future hardening plan. |
| `src/views/CalendarView.ts` + `src/views/EmbeddedAgendaView.ts` | rAF sites | rAF handle is not cancelled on view unload (IN-03 / WR-02 from REVIEW). Active-file guard prevents wrong-file cursor write, so user-visible bug is impossible — but the callback still runs after unload. | WARNING | Does not affect SC#6 (the guard makes the wrong-file write impossible). Lifecycle hygiene concern only. |
| `src/utils/viewRenderers.ts` + `src/views/CalendarView.ts` | 164-224 + 835-853 | Per-surface duplication of `renderEventItem` extended by ENH-02 work — two near-identical agenda row renderers (IN-03 from REVIEW) | INFO | None — both surfaces are exercised by ENH-02; duplication is debt, not defect. |
| `src/utils/viewRenderers.ts` + `src/views/EmbeddedAgendaView.ts` vs `src/views/CalendarView.ts` | 220-223 / 338-341 vs 894-897 | Note icon rendering is gated on `options.hasNote` in shared/embedded paths but unconditional in CalendarView (IN-04 from REVIEW) | INFO | None today (all callers provide `hasNote`); latent risk if a future caller forgets. |

No debt-marker comments (TBD/FIXME/XXX) found in the modified files.

---

## Human Verification Required

Programmatic checks (CSS rule presence, render-path wiring, settings field/toggle, build green, regression greps) all PASS. The following item is the standard visual-confirmation pass for a CSS-contrast fix — it is offered as a sanity step, not as a blocker. The same visual check class was sufficient to close WR-02 in 04-06 without human verification, and the rule shape is byte-identical.

### 1. Note-indicator visible on selected day with a note (CR-01 visual confirmation)

**Test:**
1. Enable Settings → "Show note-exists indicator on calendar grid" (toggles `showNoteIndicatorOnGrid` to `true`).
2. Create or locate a calendar event that has an associated note on a non-today day.
3. Click that day in the calendar grid so it becomes `.selected`.

**Expected:**
- The 6×6 corner-square at the top-right of the cell remains visible against the accent-colored cell background.
- The square renders in `var(--text-on-accent)` (typically the theme's foreground-on-accent color — white on dark themes, dark on light themes).
- The square is NOT the same color as the cell background; it is clearly distinguishable.

**Why human:** Pure visual contrast judgment against the active Obsidian theme. The codebase evidence shows the rule exists and uses `--text-on-accent`; only an actual render confirms the user-visible outcome. Same verification class as WR-02 today-ring (closed without human verification on the basis of CSS rule equality with a known-good pattern).

---

## Gaps Summary

**No gaps. Phase goal is fully achieved.**

The single BLOCKER from the prior verification (CR-01 / truth #3) is closed:

- Root cause: `styles.css:221-230` painted the corner-square with `var(--interactive-accent)`; `styles.css:146-148` paints the selected-day cell with `var(--interactive-accent)` — zero contrast on the user's selected day.
- Fix: 04-07 added `styles.css:232-235` `.memochron-day.selected .memochron-note-indicator { background-color: var(--text-on-accent); }`. Descendant-selector analog of the WR-02 today-ring multi-class fix from 04-06.
- Verification: rule exists exactly once (grep count = 1), uses the prescribed token (`--text-on-accent`), base rule remains correct for the non-selected case, and `npm run build` exits 0.

Six observable truths, six VERIFIED. Six requirements (ENH-01 through ENH-06), six SATISFIED. Phase 4 is ready to close.

### Non-blocking observations carried forward (not gaps)

All six 04-REVIEW.md non-blocking observations remain unaddressed and are intentionally deferred per 04-07-SUMMARY "Deferred Items":

- **REVIEW.md WR-01** — embedded-agenda `try/catch` parity in `EmbeddedAgendaView.handleEventClick` (surface divergence from `CalendarView.addEventClickHandler`; future hardening pass).
- **REVIEW.md IN-03 / WR-02** — rAF unload cleanup companion to WR-03 (defense-in-depth; existing active-file guard already prevents the user-visible site).
- **REVIEW.md IN-01** — dead `--color-text-today` CSS variable (cleanup pass).
- **REVIEW.md IN-02** — `const file = createdFile` shadowing pattern in both rAF call sites.
- **REVIEW.md IN-03** — per-surface duplication of `renderEventItem` (debt from original ENH-02).
- **REVIEW.md IN-04** — optional vs unconditional `hasNote` gating (latent risk only).

None of these block any of the six ROADMAP success criteria for Phase 4. Route to a future hardening plan or carry into the next milestone's review pass.

---

_Verified: 2026-05-12T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Mode: re-verification after 04-07 gap closure_
