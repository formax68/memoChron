---
phase: 04-ux-enhancements
plan: 07
subsystem: ui-styles
tags:
  - css
  - gap-closure
  - enh-03
  - cr-01
  - verification-truth-3
dependency_graph:
  requires:
    - 04-01 (ENH-01 today-ring, defines the selected/accent color tokens this fix reuses)
    - 04-04 (ENH-03 base note-indicator rule and showNoteIndicatorOnGrid setting wiring)
    - 04-06 (WR-02 today-ring `--text-on-accent` pattern — structural analog this plan replicates)
  provides:
    - "styles.css contains `.memochron-day.selected .memochron-note-indicator { background-color: var(--text-on-accent); }` — combined-state override so the corner-square indicator stays visible when the day is also the user's selected day"
    - "Closes 04-REVIEW.md CR-01 (BLOCKER) and flips 04-VERIFICATION.md truth #3 from FAILED to VERIFIED"
  affects:
    - "Visual contrast of the optional ENH-03 corner-square on the calendar grid — only the cell that is BOTH .selected AND has a note-bearing event"
tech-stack:
  added: []
  patterns:
    - "Combined-state CSS override using descendant selector — child element re-colored to var(--text-on-accent) when parent carries .selected (analog of WR-02 multi-class selector form used for the today-ring)"
key-files:
  created:
    - .planning/phases/04-ux-enhancements/04-07-SUMMARY.md
  modified:
    - styles.css
decisions:
  - "Used the descendant-selector form (`.memochron-day.selected .memochron-note-indicator`) rather than a multi-class form. The indicator is a child element of the day cell, not a state class on the cell itself, so the descendant form is the natural pattern. Functionally equivalent to the WR-02 `.memochron-day.today.selected` multi-class fix for the today-ring."
  - "Re-colored to `var(--text-on-accent)` (the same theme-aware token used by WR-02 for the today-ring contrast fix) rather than introducing a new color variable or hex literal. Preserves D-03 (theme-aware color tokens) and D-05 (corner-square color decisions) from 04-CONTEXT.md."
  - "Left the base `.memochron-note-indicator` rule at styles.css:221-230 unchanged — it remains correct for the default (cell not selected) case, where the accent color reads cleanly against the default cell background."
  - "Left the `.memochron-day.selected` cell-background rule at styles.css:146-148 unchanged — the accent-colored selected-day cell is verified-clean appearance from earlier plans and is not the defect."
metrics:
  duration_minutes: 4
  completed: 2026-05-12
---

# Phase 04 Plan 07: ENH-03 / CR-01 Note-Indicator Selected-State Contrast Fix Summary

Single additive CSS rule that re-colors the ENH-03 corner-square note-indicator to `var(--text-on-accent)` when its parent day cell is `.selected`, so the indicator no longer silently disappears against the accent-colored selected-day background. Descendant-selector analog of the WR-02 today-ring fix from 04-06.

## Gap Closed

**CR-01 (BLOCKER) / VERIFICATION truth #3 / ENH-03 / ROADMAP success criterion #3**

The optional note-exists corner-square indicator (`div.memochron-note-indicator`, painted with `var(--interactive-accent)`) became invisible on the currently-selected day because `.memochron-day.selected` also paints its background with `var(--interactive-accent)`. Same color on indicator and on cell background = zero contrast = invisible indicator.

This is the same root cause as WR-02 (the today-ring, fixed in 04-06), applied to a different element. The fix is the same pattern: switch the painted color to `var(--text-on-accent)` for the combined `.selected` state.

After this plan, `/gsd-verify-phase 4` is expected to flip truth #3 from FAILED to VERIFIED and move the phase score from 5/6 to 6/6.

## Exact Diff

**File:** `styles.css`

**Insertion point:** Immediately after the closing `}` of the existing `.memochron-note-indicator` base rule (previously at line 230). The new rule occupies lines 232–235 (comment + selector + declaration + closing brace), and the pre-existing `/* Week View */` section is shifted from line 232 to line 237.

```diff
 /* ENH-03: corner-square indicator for day cells that have at least one event with a note */
 .memochron-note-indicator {
   position: absolute;
   top: 2px;
   right: 2px;
   width: 6px;
   height: 6px;
   border-radius: 1px;
   background-color: var(--interactive-accent);
   pointer-events: none;
 }

+/* ENH-03: contrasting indicator when the day is also selected — survives the accent background */
+.memochron-day.selected .memochron-note-indicator {
+  background-color: var(--text-on-accent);
+}
+
 /* Week View */
```

**Diff stat:** 1 file changed, 5 insertions(+), 0 deletions(-).

**Implementation commit:** `8279e60` — `fix(styles): contrasting note-indicator when day is also selected (CR-01)`.

## What Was NOT Touched

- `.memochron-note-indicator` base rule at styles.css:221-230 — unchanged, still paints `var(--interactive-accent)` for the default (non-selected) case.
- `.memochron-day.selected` cell-background rule at styles.css:146-148 — unchanged, accent-colored selected-day cell is verified-clean appearance.
- WR-02 today-ring rules at styles.css:161-169 — unchanged, the structural analog this fix mirrors.
- Render-path code (`src/utils/viewRenderers.ts:297-300` and `src/views/CalendarView.ts:694-700`) that creates the `div.memochron-note-indicator` element — verified correct, the bug was purely a CSS contrast defect.
- Any TypeScript source file under `src/` — zero TypeScript changes.
- Settings shape, defaults, or migration — no settings touched.
- Dependencies, build config — none touched.

## Verification

**Plan task 1 automated verify (POSIX-normalized for BSD awk on macOS — the literal command in the plan uses `\s*` which BSD awk does not support; semantically equivalent checks all pass):**

- `grep -c '\.memochron-day\.selected \.memochron-note-indicator' styles.css` → `1` (new selector appears exactly once).
- `awk '/\.memochron-day\.selected \.memochron-note-indicator[[:space:]]*\{/,/\}/' styles.css | grep -q 'background-color: var(--text-on-accent)'` → match (new rule contains the prescribed declaration).
- New rule line number (233) is strictly greater than base rule line number (221) — confirms insertion-after ordering.
- Base rule's `background-color: var(--interactive-accent)` declaration still present inside the bare `.memochron-note-indicator` block.
- WR-02 rules `.memochron-day.today.selected` and `.memochron-day.today {` still present.
- `git diff --name-only -- 'src/**/*.ts' 'src/**/*.tsx'` → empty (zero TypeScript files touched).
- `npm run build` → exit 0 (tsc -noEmit -skipLibCheck + esbuild production both green).

**Phase-level regression checks (from plan `<verification>` block):**

- ENH-01 today base rule (`.memochron-day.today {`) — count 1 (intact).
- WR-02 today.selected fix (`.memochron-day.today.selected`) — count 1 (intact).
- WR-01 embedded note-indicator (`.memochron-event-note-indicator`) — count 1 (intact).
- ENH-03 setting wiring (`showNoteIndicatorOnGrid` across `src/settings/types.ts` + `src/settings/SettingsTab.ts`) — count 4 (intact, expected ≥2).
- WR-03 active-file guard (`view.file?.path === file.path` across `src/views/CalendarView.ts` + `src/views/EmbeddedAgendaView.ts`) — count 2 (intact).
- ENH-06 marker-stripping (`extractCursorMarker` in `src/services/NoteService.ts`) — count 2 (intact, expected ≥1).

## Deviations from Plan

None — plan executed exactly as written. The plan's literal `<verify>` shell command failed only because BSD awk on macOS does not interpret `\s` as a whitespace metacharacter (it matches the literal character `s` instead). The semantically equivalent POSIX-compliant verification (using `[[:space:]]*` in awk regex) passes all acceptance criteria, and every individual acceptance criterion listed in `<acceptance_criteria>` was independently verified to hold. The CSS output is byte-identical to the prescribed insertion in the plan's `<interfaces>` and `<action>` blocks.

## Deferred Items (Intentional — Out of Scope)

All six 04-REVIEW.md non-blocking observations were intentionally deferred per 04-VERIFICATION.md "Non-blocking observations" scoping:

- **WR-01** — embedded-agenda `try/catch` parity in `EmbeddedAgendaView.handleEventClick` (surface divergence from `CalendarView.addEventClickHandler`; future hardening pass).
- **WR-02 / IN-03** — rAF unload cleanup companion to WR-03 (defense-in-depth; existing active-file guard already prevents the user-visible site).
- **IN-01** — dead `--color-text-today: var(--interactive-accent)` CSS variable (cleanup pass).
- **IN-02** — closure-shadow `createdFile` pattern in `CalendarView.ts:959-962` and `EmbeddedAgendaView.ts:418-421` (readability nit; behavior correct).
- **IN-03** — per-surface duplication of `renderEventItem` (debt from original ENH-02; both surfaces exercised).
- **IN-04** — optional vs unconditional `hasNote` gating (latent risk only; no current caller omits the parameter).

None overlap with this plan's single scope (the CR-01 CSS override).

## Structural Precedent

This fix is the descendant-selector analog of the WR-02 today-ring contrast fix shipped in plan 04-06, commit `12e9f3b`:

```css
/* WR-02 (04-06): multi-class form on the cell itself */
.memochron-day.today.selected {
  box-shadow: inset 0 0 0 2px var(--text-on-accent);
}

/* CR-01 (04-07): descendant form on a child element */
.memochron-day.selected .memochron-note-indicator {
  background-color: var(--text-on-accent);
}
```

Both apply the same conceptual rule: when the cell is `.selected`, switch the painted color from `var(--interactive-accent)` to `var(--text-on-accent)` so the element survives the accent-colored background. The multi-class form is used when the indicator is rendered AS part of the cell (today-ring is a `box-shadow` on the cell). The descendant form is used when the indicator is a child element of the cell (note-indicator is a child `div`).

## Next Steps

1. **Re-run verifier:** `/gsd-verify-phase 4`. Expected outcome:
   - Truth #3 (note-indicator visible on selected day): FAILED → VERIFIED.
   - Phase score: 5/6 → 6/6.
   - 04-REVIEW.md CR-01 status: BLOCKER → resolved.

2. **Phase close-out:** After verifier confirms 6/6, phase 04 is complete and ready for release packaging.

## Self-Check: PASSED

- `styles.css` contains the new rule at lines 232–235 — confirmed via Read tool inspection.
- Implementation commit `8279e60` exists on `worktree-agent-a90aaba6f22d1918f` — `git log --oneline` confirms.
- No TypeScript files modified — `git diff --name-only` against base confirms only `styles.css` is touched (prior to SUMMARY commit).
- `npm run build` exits 0 — verified twice (once during acceptance, once during decomposed verify).
- All six phase-level regression greps from `<verification>` return the expected counts.
- No untracked files, no unintended deletions.
- Commit message contains zero references to Claude or AI assistance (per CLAUDE.md project rule).
