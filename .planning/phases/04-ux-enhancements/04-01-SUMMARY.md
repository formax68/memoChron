---
phase: 04-ux-enhancements
plan: "01"
subsystem: styles
tags: [css, today-indicator, ux]
dependency_graph:
  requires: []
  provides: [persistent-today-ring]
  affects: [styles.css]
tech_stack:
  added: []
  patterns: [css-inset-box-shadow, obsidian-css-variables]
key_files:
  created: []
  modified:
    - styles.css
decisions:
  - D-01: inset box-shadow on .memochron-day.today; 2px; var(--interactive-accent)
  - D-02: CSS-only change; createDayElement already applies .today on both surfaces
  - D-03: ring color hard-coded to var(--interactive-accent); no new setting; no theme fork
metrics:
  duration: "35s"
  completed: "2026-05-12"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 4 Plan 1: ENH-01 Persistent Today Indicator Summary

**One-liner:** Inset accent ring via `box-shadow: inset 0 0 0 2px var(--interactive-accent)` on `.memochron-day.today` — today cell stays visually distinct even when also `.selected`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add inset accent-ring CSS rule on `.memochron-day.today` | e160cef | styles.css |

## What Was Built

A single CSS rule was added to `styles.css` at line 162, immediately before the existing `.memochron-day.today .memochron-day-header` rule (now at line 166).

**Exact rule added:**

```css
/* ENH-01: persistent today indicator — inset ring survives the .selected accent background */
.memochron-day.today {
  box-shadow: inset 0 0 0 2px var(--interactive-accent);
}
```

**Placement context:**
- New rule: `styles.css:161-164` (comment at 161, selector at 162, declaration at 163, closing brace at 164)
- Existing `.memochron-day.today .memochron-day-header` rule: now at `styles.css:166-169`
- Sits between `.memochron-day.selected .memochron-event-dot` (lines 156-159) and the header-text rule

**Why inset works:** The inset box-shadow paints inside the cell border, on top of whatever background color exists — including the `var(--interactive-accent)` fill applied by `.memochron-day.selected`. A non-inset shadow would paint outside the border and be clipped by the grid container. Both today ring and selected fill are now independently visible.

**No TypeScript changes:** `createDayElement` in `src/utils/viewRenderers.ts:236-253` already applies the `.today` class on both the sidebar grid and embedded grid surfaces, so the single CSS rule flows through to both surfaces without code changes.

## Build Results

- `npm run build` exit code: **0**
- esbuild warnings: **none**
- CSS is shipped as-is alongside `main.js` and `manifest.json`; the new rule requires no bundling

## Verification Results

All acceptance criteria pass:

| Check | Result |
|-------|--------|
| `grep -c 'box-shadow: inset 0 0 0 2px var(--interactive-accent)' styles.css` | 1 |
| `grep -cE '^\.memochron-day\.today\s*\{' styles.css` | 1 |
| `.memochron-day.today .memochron-day-header` rule unchanged | pass |
| `.memochron-day.selected` rule unchanged | pass |
| No hex color literal in new rule | pass |
| No TypeScript files modified | pass |
| Commit contains `ENH-01` and `#55` | pass |
| Commit contains no `Claude` or `AI` reference | pass |

## Visual Smoke Check Notes

(Manual; to be confirmed during Obsidian UAT)

- **(a) Today unselected:** The today cell shows a 2px inset accent ring on all four inner edges, while the day-header number is also accent-colored and bold — two simultaneous cues.
- **(b) Today selected:** The entire cell background fills with accent color (`var(--interactive-accent)`), AND the inset accent ring is still visible on all four inner edges. Both indicators show simultaneously. The header number flips to `var(--text-on-accent)` per the existing `.selected .memochron-day-header` rule.
- **(c) Different day selected:** The selected day shows the accent background; today still shows only the inset ring. The ring does not move to the selected day.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — this plan only adds a CSS rule using static literal values and an existing Obsidian theme CSS variable. No new user-input surface, no new DOM construction, no new data flow.

## Self-Check: PASSED

- styles.css modified: FOUND
- Commit e160cef exists: FOUND
- No TypeScript files changed: CONFIRMED (git diff HEAD~1 HEAD shows only styles.css)
