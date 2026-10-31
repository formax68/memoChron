---
phase: 06-dom-api-refactor
date: 2026-05-14
status: complete
---

# Phase 6 — Human UAT Evidence

This file is the verification-of-record for Phase 6 (DOM API Refactor), consistent with Phases 1-5 practice. It captures the acceptance evidence for ROADMAP Phase 6 success criterion #5 (visual parity with v1.14.0 baseline) and closes the DIR-02 / DIR-03 / DIR-04 visual-acceptance leg.

Per CONTEXT D-15, no PNG screenshots are committed; the walkthrough is live and the evidence is text inline.

---

## Pre-Conditions

- Plans 01-04 of Phase 6 are merged.
- `npm run lint` exits 0 (recorded in 06-04-SUMMARY.md).
- All three DIR-02/DIR-03/DIR-04 success-criterion greps return zero matches (recorded in 06-04-SUMMARY.md).
- Freshly built `main.js` + `manifest.json` + `styles.css` installed in the reviewer's test vault.
- Obsidian version: confirmed by reviewer at UAT execution time
- Comparison baseline: v1.14.0 release (reviewer recalls or refers to the v1.14.0 binary for side-by-side check)

---

## UAT Step 1 — Sidebar Calendar

**Verifies:** D-04 dynamic-color path through `setCssProps`; D-05 height application; today / selected-day indicators; month/week view switching; ROADMAP success criterion #5 for the sidebar surface.

**Steps:**
1. Open the sidebar calendar view (left-side ribbon icon or `Cmd/Ctrl+P → MemoChron: Open calendar view`).
2. Confirm the month grid renders with event dots in source colors (each calendar source's configured color appears on its events).
3. Navigate one month forward (arrow button); navigate back. Confirm transitions are instantaneous (no flicker, no layout reflow regression vs v1.14.0).
4. Toggle to week view by dragging the resize handle DOWN; toggle back to month view by dragging UP. Confirm the height transition is smooth and the grid layout adapts cleanly.
5. Confirm today's date has the v1.14.0 today-indicator styling (border / background per `.memochron-today` rule — unchanged in Phase 6).
6. Confirm the selected day has the v1.14.0 selected-day styling (highlight per `.memochron-selected` rule — unchanged in Phase 6).
7. Confirm event dots in the agenda below the grid also render in source colors (verifies the `viewRenderers.ts:320` `setCssProps` rewrite).

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 2 — Embedded Views

**Verifies:** `EmbeddedCalendarView` and `EmbeddedAgendaView` render unchanged (PATTERNS confirmed these views had zero direct violations; Phase 6 changes them only via shared `viewRenderers.ts` and shared CSS classes).

**Steps:**
1. Open or create a note containing a `memochron-calendar` code block (fenced with ` ```memochron-calendar ` ... ` ``` `) with default params.
2. Confirm the embedded calendar renders as a month grid with event dots in source colors, identical to v1.14.0.
3. In the same note (or a sibling), embed a `memochron-agenda` code block.
4. Confirm the embedded agenda renders the day's events with per-source color indicators (verifies the `style.setProperty("--event-color", ...)` writes at `EmbeddedAgendaView.ts:263, 297` — left INTENTIONALLY UNCHANGED in Phase 6 per PATTERNS 3h, since CSS custom-property writes are not in DIR-03's banned list).
5. Click an event in the embedded agenda; confirm it opens / creates the linked note correctly.

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 3 — Settings Tab

**Verifies:** D-01 setup-guide rewrites (bolded action text); D-06 custom color picker overlay; D-07/D-08/D-09 inline-style deletions for error message + help button + doc-link + button-container.

**Steps:**
1. Open `Settings → Community plugins → MemoChron` (or `MemoChron` directly in the Settings sidebar).
2. Expand the "Add a calendar" / per-calendar configuration section. For an existing calendar source, click the color swatch. The 24×24 custom color overlay should open the native OS color picker on click.
3. Pick a non-default color and confirm it applies — the swatch updates, the calendar grid event dots update to the new color (verifies D-06 collapse of the duplicated overlay clusters into shared CSS classes).
4. Enter an invalid URL (e.g., `not-a-url`) in the add-calendar URL field and trigger validation. Confirm the error message renders in red with proper spacing — matches v1.14.0 (verifies D-07 deletion of inline styles; `.memochron-error-message` class still applies with the `--text-error, #c92424` fallback).
5. Enter an invalid refresh interval (e.g., `-1` or `0`) and trigger validation; confirm the same error rendering.
6. Click any inline "help" / "?" button next to a settings field. Confirm the help button has correct margin/font-size (verifies D-08 augmentation of `.memochron-help-btn`).
7. Open the "iCal URL setup guide" modal (or expandable section, depending on UI location). Verify the 5 `<li>` lines render with bolded action text exactly as v1.14.0:
    - "Copy the **Secret address in iCal format**" (Google)
    - "Copy the **ICS link** (not the HTML link)" (Outlook)
    - "**Using the public link** - This opens a webpage, not calendar data" (mistakes)
    - "**Using the embed link** - This is for embedding in websites" (mistakes)
    - "**Missing the .ics extension** - The URL should end with .ics" (mistakes)
   Confirm the doc-link near the bottom has correct margin spacing (verifies D-09 `.memochron-help-doc-link` augmentation) and the button container at the bottom is right-aligned with correct margin (verifies D-09 new `.memochron-help-buttons` rule).

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 4 — Hide-Calendar Toggle

**Verifies:** D-10 / D-11 class-toggle migration in `updateCalendarVisibility` via `.memochron-hidden`.

**Steps:**
1. In MemoChron settings, enable "Hide calendar" toggle.
2. Confirm in the sidebar calendar view: the month grid hides, the resize handle hides, the controls (month/year/today buttons) hide. The agenda remains visible (agenda-only layout reflow per the `agenda-only` class which is unchanged in semantics).
3. Disable "Hide calendar".
4. Confirm all three (grid, resize handle, controls) reappear and the agenda returns to its non-agenda-only layout.
5. Toggle the setting back and forth 2-3 times to confirm no flicker, no layout glitch, and no console errors.

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 5 — No Layout Regressions at Sidebar Widths

**Verifies:** ROADMAP success criterion #5 across the common sidebar widths.

**Steps:**
1. Resize the left or right sidebar to approximately 350px width. Confirm the calendar grid + agenda layout has no overflow, no clipped content, no obviously broken alignment (visual eyeball check). Compare mentally against v1.14.0 if possible.
2. Resize to approximately 400px width. Same check.
3. Resize to the Obsidian default sidebar width. Same check.
4. Briefly check the embedded calendar + agenda renderings inside a note at the standard editor width.

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 6 (optional) — Mobile sanity check

**Verifies:** `isDesktopOnly: false` manifest flag still holds — the new CSS classes don't break mobile WebView rendering. Per CONTEXT specifics line 185, this is OPTIONAL — if the reviewer doesn't have a mobile vault set up, the recommended note is "desktop-only visual check; mobile audit deferred to v1.16 if regression reported."

**Steps (if performed):**
1. Install the built plugin in a mobile Obsidian vault.
2. Open the calendar sidebar. Confirm grid + agenda render without overflow.
3. Test the custom color picker overlay on mobile — note any deviation.

**Result:** [x] Skipped — desktop-only visual check; mobile audit deferred to v1.16 if regression reported
**Notes:** Skipped per CONTEXT specifics: optional step, reviewer did not have a mobile vault set up for this UAT pass.

---

## Overall Acceptance

ROADMAP Phase 6 success criterion #5 status: [x] PASS

All 5 mandatory UAT steps passed against the freshly built v1.15.0-beta plugin. No deviation observed vs the v1.14.0 baseline across sidebar calendar, embedded views, settings tab, hide-calendar toggle, or sidebar widths (350px / 400px / default). Phase 6 is complete; Phase 7 may begin.

---

*Phase: 06-dom-api-refactor*
*UAT executed: 2026-05-14*
*Reviewer: formax68 (mike@efstratiadis.me)*
