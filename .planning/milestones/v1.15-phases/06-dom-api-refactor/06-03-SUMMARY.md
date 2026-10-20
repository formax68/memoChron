---
phase: 06-dom-api-refactor
plan: "03"
subsystem: views, settings, styles
tags: [dom-refactor, setCssProps, css-classes, toggleClass, DIR-03]
dependency_graph:
  requires: [DIR-02-closed, DIR-04-closed]
  provides: [DIR-03-closed]
  affects:
    - src/utils/viewRenderers.ts
    - src/views/CalendarView.ts
    - src/settings/SettingsTab.ts
    - styles.css
tech_stack:
  added: [setCssProps]
  patterns: [setCssProps for dynamic values, CSS class toggle for boolean visibility, CSS class extraction for static inline styles]
key_files:
  modified:
    - src/utils/viewRenderers.ts
    - src/views/CalendarView.ts
    - src/settings/SettingsTab.ts
    - styles.css
decisions:
  - "setCssProps({ color }) replaces all 3 dynamic color sites (D-03/D-04); no CSS custom-property indirection"
  - "setCssProps({ height }) replaces all 3 dynamic height sites in CalendarView.ts (D-05)"
  - "updateCalendarVisibility rewrites 6 style.display = lines to classList.toggle('memochron-hidden', hide) on 3 elements; agenda-only collapsed to single toggle call (D-10)"
  - "Color-input overlay geometry extracted to augmented .memochron-inline-color-custom-label rule (wrapper) + new .memochron-inline-color-input rule (input overlay); no new wrapper class introduced (D-06 pinned strategy)"
  - "Error-message/help-button/doc-link/button-container inline styles deleted; existing or new CSS rules carry the properties (D-07/D-08/D-09)"
  - "EmbeddedCalendarView and EmbeddedAgendaView have zero violations and are unchanged; style.setProperty('--event-color') writes in EmbeddedAgendaView.ts preserved (3h)"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-13"
  tasks_completed: 3
  files_modified: 4
---

# Phase 06 Plan 03: Inline-style → CSS classes and setCssProps bulk rewrite (DIR-03) Summary

Replaces all 51 flagged `.style.<property>` assignment sites across 3 source files with
API-compliant alternatives. The DIR-03 grep now returns zero matches across `src/`. One
git commit covers all 7 sub-cluster rewrites (3a–3g) plus all `styles.css` additions and
augmentations, per the single-commit default in D-16.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add CSS class definitions and augment existing rules in styles.css | 7cd13a8 | styles.css |
| 2 | Rewrite all 51 inline-style sites across the 5 source files | 7cd13a8 | src/utils/viewRenderers.ts, src/views/CalendarView.ts, src/settings/SettingsTab.ts |
| 3 | Commit the DIR-03 bulk rewrite | 7cd13a8 | (git commit only) |

## Before / After Violation Count

- **Before Plan 03:** 51 matches (`git ls-files src/ | xargs grep -nE '\.style\.(border|color|...) \s*='`)
  - 42 in `src/settings/SettingsTab.ts`
  - 8 in `src/views/CalendarView.ts`
  - 1 in `src/utils/viewRenderers.ts`
- **After Plan 03:** 0 matches — ROADMAP Phase 6 success criterion #2 satisfied

## Per-cluster Rewrite Summary

### 3a. Dynamic colors (3 sites)

Replaced `dot.style.color = X` with `dot.setCssProps({ color: X })` at all 3 sites:
- `src/utils/viewRenderers.ts:320` — per-event dot in shared calendar grid renderer
- `src/views/CalendarView.ts:661` — daily note dot (uses `dailyNoteColor`)
- `src/views/CalendarView.ts:670` — per-event dot in sidebar calendar renderer

`setCssProps` is the Obsidian-API-documented substitute per D-03. Color strings continue to
inherit the `isValidColor` upstream validation guarantee from Phase 2.

### 3b. Dynamic heights (3 sites)

Replaced `this.calendar.style.height = \`${px}px\`` with `this.calendar.setCssProps({ height: \`${px}px\` })` at:
- `CalendarView.ts:202` — initial apply of `calendarHeight` setting at view open
- `CalendarView.ts:1184` — drag hot loop in `handleDragMove`
- `CalendarView.ts:1227` — final snap in `snapToCurrentViewMode`

Wall-clock cost in the drag loop is unchanged (`setCssProps` resolves to `setProperty` per D-05).

### 3c. Color-input overlay clusters (2 sites, 28 lines deleted)

Deleted 4 `customLabel.style.*` lines and 10 `colorInput.style.*` lines per site in
`renderInlineColorPicker` and `renderDailyNoteColorPicker`. The wrapper geometry
(`position: relative; display: inline-block; width: 24px; height: 24px`) was added to the
EXISTING `.memochron-inline-color-custom-label` rule — no new wrapper class was introduced
(pinned CSS strategy per plan checker feedback). The overlay geometry was added as a new
`.memochron-inline-color-input` rule. Both classes were already applied to the respective
elements from Plan 02, so no call-site class additions are needed.

### 3d. Error-message styling (2 sites, 6 lines deleted)

Deleted 3 inline-style lines per site (`errorEl.style.color`, `.fontSize`, `.marginTop`) at
`SettingsTab.ts:304-306` and `SettingsTab.ts:890-892`. The `.memochron-error-message` class was
already applied at both sites and already carried all three properties. The existing CSS rule was
augmented to use `color: var(--text-error, #c92424)` (hex fallback preserved per D-07).

### 3e. Help-button styling (1 site, 2 lines deleted)

Deleted `helpBtn.style.marginTop = "0.5em"` and `helpBtn.style.fontSize = "0.85em"` at
`SettingsTab.ts:317-318`. The `.memochron-help-btn` rule was augmented with both properties.

### 3f. Doc-link + button-container spacing (1 site with 3 lines, all deleted)

Deleted `docLink.style.marginTop = "1em"` at `SettingsTab.ts:1937` (after Plan 03's line
renumbering). The `.memochron-help-doc-link` rule was augmented with `margin-top: 1em`.
Deleted `buttonContainer.style.marginTop = "1.5em"` and `buttonContainer.style.textAlign = "right"`
at `SettingsTab.ts:1946-1947`. A new `.memochron-help-buttons` rule (`margin-top: 1.5em;
text-align: right;`) was added since the class already existed in the element's `cls:` option
but had no CSS definition.

### 3g. Display-toggle migration in `updateCalendarVisibility`

Replaced the 6-line if/else block (writing `style.display = "none"` / `""` on 3 elements)
with 4 `classList.toggle(name, force)` calls:

```typescript
const hide = this.plugin.settings.hideCalendar;
this.calendar.classList.toggle("memochron-hidden", hide);
if (this.resizeHandle) this.resizeHandle.classList.toggle("memochron-hidden", hide);
if (controls) controls.classList.toggle("memochron-hidden", hide);
this.agenda.classList.toggle("agenda-only", hide);
```

The `this.agenda` line collapses the prior `classList.add("agenda-only")` /
`classList.remove("agenda-only")` pair into one `toggle(name, force)` call — same semantics,
cleaner shape per D-10. The `agenda-only` class carries layout-reflow semantics distinct from
visibility, so it was NOT replaced with `.memochron-hidden`.

### 3h. EmbeddedAgendaView CSS custom-property writes (UNCHANGED)

The 2 `style.setProperty("--event-color", ...)` writes in `EmbeddedAgendaView.ts` at lines 263
and 297 were deliberately left untouched. CSS custom-property writes are not in DIR-03's banned
15-property list and are correct as-is.

## styles.css Additions and Augmentations

| Rule | Change | Rationale |
|------|--------|-----------|
| `.memochron-inline-color-custom-label` | Augmented: added `position: relative; display: inline-block; width: 24px; height: 24px` | Wrapper geometry for color picker overlay (3c pinned strategy) |
| `.memochron-inline-color-input` | New rule: 10 overlay properties (`position: absolute; top/left: 0; width/height: 24px; opacity: 0; cursor: pointer; border: none; padding/margin: 0`) | Input overlay geometry (3c) |
| `.memochron-help-btn` | Augmented: added `margin-top: 0.5em; font-size: 0.85em` | Preserve visual after inline-style deletion (3e/D-08) |
| `.memochron-help-doc-link` | Augmented: added `margin-top: 1em` | Preserve spacing after inline-style deletion (3f/D-09) |
| `.memochron-help-buttons` | New rule: `margin-top: 1.5em; text-align: right` | Class already applied in TS but had no CSS definition (3f/D-09) |
| `.memochron-error-message` | Augmented: `color: var(--text-error)` → `color: var(--text-error, #c92424)` | Preserve hex fallback per D-07 |
| `.memochron-hidden` | New utility class: `display: none` | CSS-class toggle for `updateCalendarVisibility` (3g/D-10) |

No `.memochron-custom-color-wrapper` rule was added (pinned CSS strategy, D-06).
All existing rules were preserved and augmented only.

## Verification Results

### DIR-03 canonical grep (zero required)

```
git ls-files src/ | xargs grep -nE '\.style\.(border|color|cursor|display|fontSize|height|left|margin|marginTop|opacity|padding|position|textAlign|top|width)\s*='
```

Result: **ZERO matches** — ROADMAP Phase 6 success criterion #2 satisfied.

### EmbeddedAgendaView custom-property writes preserved

```
grep -cE 'style\.setProperty\("--event-color"' src/views/EmbeddedAgendaView.ts
```

Result: **2** (lines 263, 297 — both unchanged).

### setCssProps presence

- `grep -c 'setCssProps' src/views/CalendarView.ts` → **5** (3 height + 2 color sites)
- `grep -c 'setCssProps' src/utils/viewRenderers.ts` → **1** (line 320)

### memochron-hidden presence

- `grep -c 'memochron-hidden' src/views/CalendarView.ts` → **3** (toggle calls on calendar, resizeHandle, controls)
- `grep -c 'this\.calendar\.style\.display' src/views/CalendarView.ts` → **0**

### No custom-color-wrapper anywhere

- `grep -c 'memochron-custom-color-wrapper' styles.css src/settings/SettingsTab.ts` → **0:0**

### npm run build

Exit 0 — clean TypeScript compilation and esbuild production bundle.

## Commit

- **Hash:** 7cd13a8
- **Subject:** `refactor(views): replace inline styles with CSS classes and setCssProps (DIR-03)`
- **Files in diff:** `styles.css`, `src/utils/viewRenderers.ts`, `src/views/CalendarView.ts`, `src/settings/SettingsTab.ts` (4 files; EmbeddedCalendarView and EmbeddedAgendaView unchanged — confirmed zero violations in both)
- **Stats:** 4 files changed, 42 insertions(+), 61 deletions(-)
- **Claude/AI references:** none — verified by grep

## Deviations from Plan

None — plan executed exactly as written. All 7 sub-clusters (3a–3g) rewritten per spec. The
pinned CSS strategy (augment `.memochron-inline-color-custom-label` instead of adding a new
wrapper class) was followed throughout. EmbeddedCalendarView and EmbeddedAgendaView had zero
violations and were left untouched, as expected from the PATTERNS mapping date scan.

## Known Stubs

None. All CSS properties moved to rules that are unconditionally applied.

## Threat Flags

No new security-relevant surface introduced. All changes are mechanical style-API substitutions
with no data-flow changes. `setCssProps` receives sanitized color/height strings from unchanged
upstream sources (Phase 2 `isValidColor` + bounded numeric heights). `.memochron-hidden` class
toggle is a pure visibility control — threat T-06-07 (information disclosure via DOM visibility
only) was pre-assessed as `accept` in the plan's STRIDE register.

## Hand-off to Plan 04

Plan 04 (ESLint override-block deletion) removes the Phase-6 block from `eslint.config.mjs`
(lines 66-82 disabling `@microsoft/sdl/no-inner-html`, `no-unsanitized/property`,
`no-unsanitized/method`, `obsidianmd/no-static-styles-assignment`, `no-restricted-syntax`) and
the companion `obsidianmd/ui/sentence-case` block (lines 83-98). After Plan 03, all three DIR
findings are closed in source — Plan 04 confirms closure by running `npm run lint` cleanly
after override removal.

## Self-Check: PASSED

- [x] `styles.css` contains `.memochron-hidden`, `.memochron-help-buttons`, `.memochron-inline-color-input` rules
- [x] `styles.css` augmentations applied to `.memochron-error-message`, `.memochron-help-btn`, `.memochron-help-doc-link`, `.memochron-inline-color-custom-label`
- [x] No `.memochron-custom-color-wrapper` in `styles.css` or `src/settings/SettingsTab.ts`
- [x] Zero `\.style\.(flagged)` matches across `src/` after commit
- [x] `EmbeddedAgendaView.ts` still has 2 `style.setProperty("--event-color")` writes
- [x] `grep -c 'setCssProps' src/views/CalendarView.ts` = 5
- [x] Commit `7cd13a8` exists in git log
- [x] Commit subject matches `refactor\((settings|views)\):.*DIR-03`
- [x] No Claude/AI/Co-Authored-By references in commit message
- [x] `npm run build` exits 0
- [x] ROADMAP Phase 6 success criterion #2 satisfied: zero `.style.<flagged>` matches across `src/`
