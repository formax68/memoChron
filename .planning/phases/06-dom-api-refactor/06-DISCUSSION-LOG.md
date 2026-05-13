# Phase 6: DOM API Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 06-dom-api-refactor
**Areas discussed:** Setup-guide rich text (innerHTML)

---

## Gray-area selection

Four gray areas were presented to the user. The other three were not selected and were resolved at Claude's discretion in CONTEXT.md (see "Claude's Discretion" below).

| Area | Description | Selected for discussion |
|------|-------------|-------------------------|
| Dynamic event-color rendering | 3 sites (`viewRenderers:320`, `CalendarView:661, 670`) replace `dot.style.color = event.color`. Options: `setCssProps({ color })` vs `--event-color` CSS custom property vs other. | |
| Native color-picker overlay | 2× 13-line `style.*` clusters at `SettingsTab.ts:648-665` and `731-748`. Options: one shared CSS class, two separate classes, or replace with `Setting.addColorPicker()`. | |
| Hide-calendar display toggle | `updateCalendarVisibility()` uses `style.display = "none"|""` at 3 sites. Options: CSS class toggle, `el.show()/.hide()`, or CSS custom property modifier. | |
| Setup-guide rich text (innerHTML) | 5 sites at `SettingsTab.ts:1882-1922` write `<li>` content with embedded `<strong>` via innerHTML. Options: split `appendText` + `createEl("strong")`, tiny helper, drop bolding. | ✓ |

---

## Setup-guide rich text (innerHTML)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline `appendText` + `createEl("strong")` | Per site, 2-3 explicit lines. No abstraction, very easy to read. ~15 lines added across 5 sites. | ✓ |
| Tiny rich-text helper | `appendRichText(parent, segments)` helper (~10 lines) called once per site. DRY for the 5 repetitions, slightly more abstracted. | |
| Drop bolding entirely | 1 line per site. Removes visual emphasis on action targets in the setup guide — slight UX downgrade. | |

**User's choice:** Inline `appendText` + `createEl("strong", { text })` per segment.
**Notes:** The chosen "before/after" preview was committed verbatim as D-01 in CONTEXT.md. Same pattern applies to all 5 sites — 2 `gcalSteps` / `outlookSteps` lines plus 3 `mistakesList` lines. Bolding semantics preserved exactly; no helper, no abstraction. Rationale recorded in D-01: a helper would save no lines (10-line helper + 5×1-line callsites ≈ 5×3-line inline) and would be the only abstraction in an otherwise mechanical phase.

---

## Claude's Discretion

The three gray areas the user did NOT select were resolved by Claude in CONTEXT.md, with rationale tied to each decision:

- **Dynamic event-color rendering** (CONTEXT.md D-03, D-04, D-05) — chose `setCssProps({ ... })` directly. Rationale: it is the named DIR-03 alternative in success criterion #2; CSS custom-property indirection adds a CSS rule per dynamic value with no functional benefit. Inherits Phase 2 D-02 color-validation guarantee at the render site.
- **Native color-picker overlay** (CONTEXT.md D-06) — collapsed both 13-line clusters into one shared pair of CSS classes (`.memochron-custom-color-wrapper`, `.memochron-custom-color-input`). Rejected `Setting.addColorPicker()` replacement as a UX change outside the scorecard scope; deferred for future UX pass.
- **Hide-calendar display toggle** (CONTEXT.md D-10, D-11) — CSS class toggle (`.memochron-hidden { display: none; }` via `el.toggleClass("memochron-hidden", hideCalendar)`). Matches the existing sibling `agenda-only` pattern at the same call site. Rejected `el.show()/.hide()` because those Obsidian helpers set `display = "none"|""` directly, which the `obsidianmd/no-static-styles-assignment` rule still flags.

Additional planner discretion items recorded in CONTEXT.md → Claude's Discretion:
- Exact CSS class names (working names provided; planner may refine)
- `createEl("input", { type: "color" })` vs `{ attr: { type: "color" } })` form
- Whether the bulk DIR-03 commit splits per file
- Whether `setCssProps` uses per-call object literals or constants
- Exact `obsidianmd/ui/sentence-case` resolution per flagged string (lowercase vs narrowly-scoped disable comment)

## Deferred Ideas

Recorded in CONTEXT.md `<deferred>`:
- Replace hand-rolled SVG color picker with `Setting.addColorPicker()` — UX change, not a scorecard requirement.
- CSS custom-property indirection for dynamic colors — rejected at D-03; revisit if future phases need pseudo-class access to event colors.
- `requestAnimationFrame` / `requestIdleCallback` debouncing of `handleDragMove` — covered by PERF-04, deferred to v2 perf milestone.
- Refactoring `CalendarView`'s per-event renderer to call into `viewRenderers.ts` (eliminate per-surface duplication) — useful follow-up but its own architectural change, out of scope.
- Phase 7/8 ESLint override blocks — Phase 6 deletes ONLY its own block.
