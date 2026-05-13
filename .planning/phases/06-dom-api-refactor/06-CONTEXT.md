# Phase 6: DOM API Refactor - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Mechanical refactor of DOM construction across the view layer to satisfy three directory-scorecard findings (DIR-02, DIR-03, DIR-04) in one coordinated pass. Five files are in scope and only these five: `src/views/CalendarView.ts`, `src/views/EmbeddedCalendarView.ts`, `src/views/EmbeddedAgendaView.ts`, `src/settings/SettingsTab.ts`, `src/utils/viewRenderers.ts`. At phase end every `.innerHTML` / `.outerHTML` write is gone, every flagged `.style.<prop> =` assignment is replaced with a CSS class or `setCssProps`, every `document.createElement` is replaced with `createEl` / `createDiv` / `createSpan` (SVG `createElementNS` calls stay — they are not flagged), the Phase-5 ESLint overrides for these rules are deleted, `npm run lint` still passes, and the rendered output is visually identical to v1.14.0.

- **DIR-02** — no `.innerHTML` / `.outerHTML` write occurs anywhere in shipped code; every site is rewritten via `createEl({ cls, text, attr })`, `createDiv({ cls })`, `setText()`, or `createElementNS` for SVG.
- **DIR-03** — no `element.style.<property>` assignment for the 15 flagged properties (`border, color, cursor, display, fontSize, height, left, margin, marginTop, opacity, padding, position, textAlign, top, width`) occurs in shipped code; static values move to CSS classes, dynamic values use `setCssProps({ ... })`.
- **DIR-04** — every DOM-construction site in the five named files uses Obsidian's `createEl` / `createDiv` / `createSpan` helpers — no `document.createElement(...)` and no string-literal HTML.

Out of scope (Phase 7/8 territory): `as TFile` casts, floating promises, `MarkdownRenderChild` lifecycle return types, popout-window helpers (`activeDocument` / `activeWindow.setTimeout`), `console.*` calls, `any` types, unused vars. Phase 5's ESLint overrides for those rules stay until their owning phase. Phase 6 deletes ONLY the Phase-6 block in `eslint.config.mjs` (lines 66–82 plus the related `ui/sentence-case` block at 83–98).

Goal at end of phase: opening the sidebar calendar, switching month/week view, opening an embedded calendar code block, and opening the settings tab all render visually identically to v1.14.0 (no layout, color, or interactivity regressions); `git ls-files src/ | xargs grep -nE '\.(inner|outer)HTML\s*='`, the inline-style grep, and `grep -n 'document\.createElement'` all return zero matches across shipped code; `npm run lint` passes after the Phase-6 override block is removed.

</domain>

<decisions>
## Implementation Decisions

### Setup-guide rich-text replacement (DIR-02)

- **D-01:** **Inline `appendText` + `createEl("strong", { text })` per segment** at all 5 sites in `SettingsTab.ts:1882–1922`. No helper function, no abstraction — explicit two-or-three-line replacement per `<li>`. Concrete shape per site:
  ```ts
  // Before:
  gcalSteps.createEl("li").innerHTML =
    "Copy the <strong>Secret address in iCal format</strong>";

  // After:
  const li = gcalSteps.createEl("li");
  li.appendText("Copy the ");
  li.createEl("strong", { text: "Secret address in iCal format" });
  ```
  Same shape applies to the `outlookSteps` site (line 1899) and the three `mistakesList` sites (lines 1920–1922), with the prefix/bold/suffix segments matching each existing string. Bolding semantics preserved exactly — no visual change. Rationale: a helper would save no lines (10-line helper + 5×1-line callsites ≈ 5×3-line inline), is harder to read at the callsite, and would be the only piece of "abstraction" introduced by an otherwise mechanical phase.

- **D-02:** **`<strong>` is the only inline tag in these strings.** No `<em>`, no `<code>`, no `<a>` — the grep at scout time confirmed. If the planner discovers a stray inline tag during implementation, follow the same per-segment pattern (`createEl("em", { text })` etc.). Do NOT broaden into a generic rich-text helper for future-imagined cases.

### Dynamic-style strategy (DIR-03 — dynamic colors and dimensions)

- **D-03:** **`setCssProps({ ... })` is the chosen replacement for every dynamic `.style.<prop> =` site.** It is Obsidian's documented, type-safe substitute for direct `style.setProperty` calls, and it is the named alternative in DIR-03's success criterion #2. No CSS custom-property indirection layer (no `--event-color` → `color: var(--event-color)`) — the indirection adds a CSS rule per dynamic value without functional benefit and complicates the diff.
- **D-04:** Three concrete dynamic-color sites: `src/utils/viewRenderers.ts:320`, `src/views/CalendarView.ts:661`, `src/views/CalendarView.ts:670`. Rewrite each as `el.setCssProps({ color: event.color })` (or `dailyNoteColor` at line 661). Color string already passes `isValidColor` upstream (Phase 2 D-02 + load-time validation in `colorValidation.ts`) — no new validation needed at the render site.
- **D-05:** Three concrete dynamic-height sites in `CalendarView.ts`: line 202 (initial apply of `calendarHeight` setting), line 1184 (`handleDragMove` hot loop during drag), line 1227 (`snapToCurrentViewMode` final snap). Rewrite each as `this.calendar.setCssProps({ height: \`${px}px\` })`. `setCssProps` resolves to `setProperty` under the hood — wall-clock cost during a drag is identical to direct `.style.height =`. No throttling/RAF change in this phase.

### Static-style consolidation (DIR-03 — CSS class extraction)

- **D-06:** **The two duplicated 13-line color-input overlay clusters (`SettingsTab.ts:646–665` and `729–748`) collapse into one shared pair of CSS classes:**
  - `.memochron-custom-color-wrapper` → `position: relative; display: inline-block; width: 24px; height: 24px;`
  - `.memochron-custom-color-input` → `position: absolute; top: 0; left: 0; width: 24px; height: 24px; opacity: 0; cursor: pointer; border: none; padding: 0; margin: 0;`

  Apply both at both call sites. Net effect: ~26 lines of inline style → ~10 lines of CSS in one place. The hand-rolled SVG color spectrum + native `<input type="color">` UX is preserved exactly; **no replacement with `Setting.addColorPicker()`** (that is a UX change and would be a separate, opt-in refactor).
- **D-07:** **Error-message styling (3+3 inline-style lines at `SettingsTab.ts:303–306` and `889–892`):** one shared class `.memochron-settings-error` → `color: var(--text-error, #c92424); font-size: 0.9em; margin-top: 0.5em;`. The `--text-error` fallback is preserved exactly. Same class applies at both error sites (URL-validation error and calendar-name error).
- **D-08:** **Help-button styling (`SettingsTab.ts:317–318`):** add to the existing button via class — `.memochron-settings-help-button` → `margin-top: 0.5em; font-size: 0.85em;`. Trivial.
- **D-09:** **Doc-link + button-container spacing (`SettingsTab.ts:1926, 1935–1936`):** two classes — `.memochron-setup-guide-doc-link { margin-top: 1em; }` and `.memochron-setup-guide-button-container { margin-top: 1.5em; text-align: right; }`. Static layout values; CSS is the natural home.

### Display-toggle migration (DIR-03 — `display` is in the banned list)

- **D-10:** **`updateCalendarVisibility` (`CalendarView.ts:980–1000`) uses a CSS class toggle** — match the existing sibling pattern at the same call site (`this.agenda.classList.add("agenda-only")` / `.remove("agenda-only")`). Add `.memochron-hidden { display: none; }` (top-level utility class, plugin-scoped); apply via `el.toggleClass("memochron-hidden", this.plugin.settings.hideCalendar)` on `this.calendar`, `this.resizeHandle`, and the `controls` element. The `agenda-only` class on `this.agenda` stays — it carries different semantics (layout reflow, not visibility) and is unrelated to DIR-03.
- **D-11:** **No `el.show()` / `el.hide()` Obsidian helpers.** Although Obsidian's HTMLElement extension provides them, they set `display = "none"` and `display = ""` directly — which `obsidianmd/no-static-styles-assignment` would still flag. The CSS class route is the only DIR-03-compliant option that doesn't reintroduce inline-style writes downstream.

### `document.createElement` elimination (DIR-04)

- **D-12:** **Two sites in `SettingsTab.ts:652, 735`** both create a native `<input type="color">`. Rewrite as:
  ```ts
  const colorInput = customLabel.createEl("input", { type: "color" });
  ```
  (Or with `attr: { type: "color" }` if `type` is not recognized as a top-level option — planner confirms which form `createEl`'s overload supports at planning time; either works.) The `document.createElementNS(SVG_NS, "svg" | "circle" | "text")` calls at lines 563, 568, 586 stay — `createElementNS` is the correct API for SVG and is NOT flagged by DIR-04's rule.

### ESLint override removal (success criterion #4)

- **D-13:** **Two override blocks in `eslint.config.mjs` get deleted as the final code commit of the phase:**
  - The Phase-6 block at lines 66–82 (`files: ["src/settings/SettingsTab.ts", "src/views/CalendarView.ts"]` disabling `@microsoft/sdl/no-inner-html`, `no-unsanitized/property`, `no-unsanitized/method`, `obsidianmd/no-static-styles-assignment`, and `no-restricted-syntax`).
  - The companion `obsidianmd/ui/sentence-case` block at lines 83–98 — Phase 5 explicitly comments "Phase 6 will normalise copy when the DOM-API refactor touches these files." Honor that commitment: review the flagged strings during implementation and either lowercase them or — if the proper-noun argument holds (e.g., "MemoChron", "Google Calendar", "iCal") — add narrowly-scoped `// eslint-disable-next-line obsidianmd/ui/sentence-case` comments at each truly-proper-noun call site rather than re-disabling the rule wholesale. The override block does NOT survive the phase.

  After deletion, `npm run lint` MUST pass cleanly. Run the full lint as part of the commit's verification.

### Visual identity verification (success criterion #5)

- **D-14:** **HUMAN-UAT.md is the verification artifact** — consistent with Phases 1–5 and Phase 5 D-13 (no test suite this milestone). Mandatory UAT steps:
  1. **Sidebar calendar:** open the calendar view, navigate one month forward and back, toggle month-view → week-view via drag-resize, confirm event dots render in source-coloured pairs (verifies D-04 dynamic-color path), confirm today / selected-day indicators look exactly as in v1.14.0.
  2. **Embedded views:** open a note containing a `memochron-calendar` code block and a `memochron-agenda` code block, confirm rendering matches v1.14.0.
  3. **Settings tab:** open settings, expand "Add a calendar" flow, verify the custom color picker overlay (the 24×24 hidden-input pattern) opens correctly on click and applies the chosen color (verifies D-06 CSS-class replacement). Open the "iCal URL setup guide" section and confirm the 5 `<li>` lines render with bolded action text exactly as before (verifies D-01).
  4. **Hide-calendar toggle:** enable "Hide calendar" in settings, confirm the calendar, resize handle, and controls all hide; disable, confirm all reappear (verifies D-10 class-toggle migration).
  5. **No layout regressions** at standard sidebar widths (350px, 400px, default) — visual eyeball check sufficient.
- **D-15:** **No before/after screenshot artifacts committed under `.planning/phases/06-*/`.** The visual-identity check is performed live during UAT; storing PNG baselines invites bitrot. Reviewer-facing UAT walk-through covers the requirement.

### Commit granularity and ordering

- **D-16:** **Five atomic commits, requirement-then-cleanup ordered.** Sequence and naming pattern (planner finalizes exact subject lines per `CLAUDE.md` commit-message hygiene — no Claude/AI refs):
  1. `refactor(settings): replace setup-guide innerHTML with createEl + appendText (DIR-02)`
  2. `refactor(settings): replace document.createElement with createEl for color input (DIR-04)`
  3. `refactor(views): replace inline styles with CSS classes and setCssProps (DIR-03)` — the bulk commit; touches all 5 files plus `styles.css`
  4. `chore(lint): remove Phase 6 ESLint overrides (DIR-02/03/04 acceptance)` — deletes the override blocks; running `npm run lint` is part of the commit's local verification
  5. `docs(06): record Phase 6 human UAT` — adds `06-HUMAN-UAT.md` with the D-14 walk-through

  This ordering keeps the per-requirement diffs small enough to review individually, leaves the big DIR-03 commit as a single focused change, and isolates the lint-override removal as its own greppable commit (which is also the commit that the Phase 7/8 ESLint cleanups will mirror).

### Claude's Discretion

- **Exact CSS class names** — `.memochron-custom-color-wrapper`, `.memochron-settings-error`, etc. are working names. Planner may refine to match existing naming patterns in `styles.css` (the prefix is `memochron-*` per convention; the suffix is the planner's call as long as it doesn't collide).
- **`createEl("input", { type: "color" })` vs `createEl("input", { attr: { type: "color" } })`** — both forms compile against Obsidian's typings; planner picks whichever the rest of the codebase already prefers (a grep at planning time will reveal the dominant form).
- **Whether the bulk DIR-03 commit splits per file** — if the diff is large enough to make review painful, planner may split DIR-03 across two commits (e.g., SettingsTab in one, the four view-layer files in another). Default is single commit.
- **Whether `setCssProps` needs a per-call object literal or can reuse a constant** for the repeated `{ color: ... }` and `{ height: ... }` shapes — planner's call; per-call literals are fine.
- **Exact wording of the `obsidianmd/ui/sentence-case` resolution** — either lowercase the flagged strings (preferred for non-proper-noun copy) or add narrowly-scoped `eslint-disable-next-line` comments with rationale (acceptable for "MemoChron", "Google Calendar", "Outlook", "iCal" — these are proper nouns / product names and forcing lowercase is wrong). Planner reviews each flagged site at implementation time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project artifacts
- `.planning/ROADMAP.md` — Phase 6 entry; 5 success criteria; explicit lock that the Phase-5 ESLint overrides for DIR-02/03/04 are removed by phase end; manual UAT requirement for visual parity with v1.14.0
- `.planning/REQUIREMENTS.md` — DIR-02 (innerHTML/outerHTML rewrite), DIR-03 (15-property inline-style ban), DIR-04 (createEl/createDiv/createSpan exclusivity in the 5 named files); Out of Scope confirms test-suite and accessibility are not in this phase
- `.planning/PROJECT.md` — milestone framing; "Install lint/CI guardrails alongside the fixes" Key Decision; current scorecard reads "Risks (1/4 red)"
- `.planning/STATE.md` — v1.15 active; Phase 5 complete; "DIR-02, DIR-03, DIR-04 travel together in Phase 06 because they touch the same files" recorded as a Recent Decision

### Codebase intel
- `.planning/codebase/STRUCTURE.md` — source layout; locations to add new CSS classes (`styles.css`) and the 5 files in scope
- `.planning/codebase/CONVENTIONS.md` — CSS classes use the `memochron-*` prefix; `setIcon` + lucide naming is the established icon convention; per-surface duplication between `CalendarView` and `viewRenderers` is acknowledged

### Prior phase context (decisions carried forward)
- `.planning/phases/02-security-correctness/02-CONTEXT.md` — D-02 / `colorValidation.ts isValidColor`: every color string written to DOM is validated upstream. Phase 6's `setCssProps({ color: event.color })` inherits this guarantee; no new validation at the render site.
- `.planning/phases/04-ux-enhancements/04-CONTEXT.md` — D-04 / D-06: `setIcon` + `RenderOptions` are the cross-surface seam. Phase 6 does NOT extend `RenderOptions` — it only changes the API used to apply styles, not the data flowing through the seam.
- `.planning/phases/05-guardrails-trivial-fixes/05-CONTEXT.md` — D-04 lists the ESLint override blocks Phase 6 must remove; D-13 sets the UAT-only verification pattern that Phase 6 reuses for its own visual-parity acceptance.

### Repository files Phase 6 will touch
- `src/views/CalendarView.ts` — 8 violation sites (3 dynamic color, 3 dynamic height, 3 display-toggle)
- `src/views/EmbeddedCalendarView.ts` — in-scope per ROADMAP wording; current grep shows zero direct violations but planner re-scans during implementation in case of indirect calls via shared renderers
- `src/views/EmbeddedAgendaView.ts` — in-scope per ROADMAP wording; current grep shows zero direct violations; planner re-scans
- `src/settings/SettingsTab.ts` — bulk of the violations: 5 `innerHTML` sites, 2 `document.createElement` sites, ~35 inline-style sites split across color-picker overlay (×2 clusters), error-message styling (×2), help-button (×1), doc-link + button-container (×2)
- `src/utils/viewRenderers.ts` — 1 dynamic-color site at line 320
- `styles.css` — additive only; new classes per D-06 / D-07 / D-08 / D-09 / D-10
- `eslint.config.mjs` — delete the Phase-6 override blocks (lines 66–82 plus 83–98) per D-13
- `.planning/phases/06-dom-api-refactor/06-HUMAN-UAT.md` — new file per D-14

### Project rules
- `CLAUDE.md` — Obsidian plugin best practices ("Use Obsidian's provided APIs instead of direct DOM manipulation"); CSS-variable theming; mobile compatibility (`isDesktopOnly: false` — verify CSS classes work on mobile WebView); commit-message hygiene (NO Claude / AI references in commits or release notes)

### External docs (researcher MUST consult at planning time)
- Obsidian Plugin API docs — `createEl` / `createDiv` / `createSpan` / `setText` / `setCssProps` / `toggleClass` signatures and option-bag shape (`{ cls, text, attr, type, ... }`)
- `eslint-plugin-obsidianmd` rule docs — `no-static-styles-assignment` exact rule definition (which property names trigger and which exemptions exist); `ui/sentence-case` rule for the planner's decision on copy normalization vs disable
- `@microsoft/sdl/no-inner-html` and `no-unsanitized/property` rule docs — confirm `setText` and `createEl({ text })` are the canonical safe alternatives (they are, but document the basis)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`createEl` is already heavily used across `SettingsTab.ts`** (50+ existing call sites) — Phase 6 extends the established pattern; no new infrastructure needed. Examples: `container.createEl("hr", { cls: "memochron-section-separator" })`, `labelEl.createEl("input", { type: "checkbox" })` — the latter is the exact pattern Phase 6 follows for the color-input rewrite.
- **`.memochron-*` CSS class namespace is well-established** (40+ existing classes in `styles.css`). New classes per D-06–D-10 slot in naturally; no namespace conflict.
- **Existing sibling class-toggle pattern in `updateCalendarVisibility`** — `this.agenda.classList.add("agenda-only")` / `.remove("agenda-only")` already exists at the same call site Phase 6 modifies. D-10 mirrors this exact pattern with a new utility class. Zero pattern divergence.
- **SVG `createElementNS` at `SettingsTab.ts:563, 568, 586`** is already DIR-04-compliant (SVG namespace, not flagged). The two `document.createElement("input")` sites at 652 / 735 are the only DIR-04 misses in the file.
- **Phase-2 `colorValidation.ts isValidColor` + load-time validation** (`buildColorSwatch` via `createElementNS`) — guarantees `event.color` is a sanitized string by the time it reaches `viewRenderers.ts:320` / `CalendarView.ts:661, 670`. `setCssProps({ color })` inherits this guarantee; no double-validation.

### Established Patterns

- **Per-surface duplication is real** — `CalendarView` has its own per-event renderer (~line 670) that mirrors the shared `viewRenderers.ts:320` logic. Both get the `setCssProps` rewrite — planner ensures the two paths stay in sync.
- **CSS-variable theming** — existing classes consume `var(--interactive-accent)`, `var(--text-on-accent)`, `var(--text-error)`. New classes per D-07 / D-08 reuse the same pattern.
- **`type` as a top-level `createEl` option** is the existing pattern: `labelEl.createEl("input", { type: "checkbox" })` (SettingsTab.ts:1080). D-12 reuses it: `createEl("input", { type: "color" })`.
- **No `setCssProps` in codebase today** — Phase 6 introduces it. Single-call adoption across ~6 dynamic sites; not a sweeping pattern change, just a documented one-liner substitute for `style.X =`.

### Integration Points

- **`styles.css`** — the integration site for every CSS class introduced by D-06–D-10. Class additions are append-only; no existing rule is modified or moved. Planner groups new classes in logical sections (e.g., a "Settings overlays" section for the color-input pair, a "Utilities" section for `.memochron-hidden`).
- **`CalendarView.updateCalendarVisibility`** (`src/views/CalendarView.ts:980–1000`) — single function-scoped change site for D-10. The `controls` element is fetched via `containerEl.querySelector(".memochron-controls")` — the class toggle continues to work against the same element reference.
- **`CalendarView.handleDragMove` / `snapToCurrentViewMode`** (`src/views/CalendarView.ts:1180–1227`) — `setCssProps({ height: ... })` substitutes for `style.height = ...` with no surrounding refactor. The drag-resize hot loop and the `recalculateViewModeFromHeight` branch are unchanged in shape.
- **`SettingsTab.ts:646–665` and `729–748`** — two near-identical color-input overlay clusters. D-06 collapses both into the same two-class pair; planner reviews diff to confirm both call sites end up structurally identical post-refactor.

</code_context>

<specifics>
## Specific Ideas

- **`setCssProps` is the named DIR-03 alternative.** Success criterion #2 explicitly cites it. Do not invent CSS custom-property indirection layers (e.g., `--event-color`) where a single `setCssProps({ color })` call satisfies the rule and reads cleanly at the call site.
- **`createElementNS` is allowed.** The DIR-04 rule and the project's `no-restricted-syntax` selector both pattern-match `document.createElement` specifically (`callee.property.name='createElement'`). The 3 SVG sites in `SettingsTab.ts` (lines 563, 568, 586) are correct as-is. Do NOT rewrite them.
- **Bolding stays in the setup guide.** D-01 explicitly preserves `<strong>` semantics via `createEl("strong", { text })`. The user picked this approach over the "drop bolding" option specifically to keep the visual emphasis on action targets ("Secret address in iCal format", "ICS link", "Using the public link", "Using the embed link", "Missing the .ics extension").
- **The `ui/sentence-case` resolution is in scope.** Phase 5 explicitly deferred it to Phase 6 ("Phase 6 will normalise copy when the DOM-API refactor touches these files"). The Phase-6 commit that deletes the override block MUST address every flagged string — either lowercase, or narrowly-scoped `eslint-disable-next-line` with proper-noun rationale. Wholesale re-disabling the rule across the 6 files (the current state) is not an option.
- **`el.toggleClass(name, force)` is the cleanest D-10 form** — Obsidian's HTMLElement extension provides it as a single-call alternative to the `if (cond) el.addClass else el.removeClass` pair. Verify it accepts the second `force` argument in current Obsidian versions; if not, fall back to `classList.toggle(name, force)`.
- **Mobile-WebView CSS verification is part of UAT.** `manifest.json` `isDesktopOnly: false` — the new CSS classes (especially `.memochron-custom-color-wrapper` with `position: absolute` overlay) must render correctly on mobile. Planner adds a one-line mobile UAT step if reasonable; otherwise the reviewer notes "desktop-only visual check; mobile audit deferred to v1.16 if regression reported."

</specifics>

<deferred>
## Deferred Ideas

- **Replace the hand-rolled SVG color picker with `Setting.addColorPicker()`** — UX change, not a scorecard requirement. The current overlay (24×24 SVG swatch + hidden native `<input type="color">`) has a specific feel users may rely on; switching to Obsidian's built-in component is a separate decision, not a Phase-6 substitution. Revisit in a future UX pass.
- **CSS custom-property indirection for dynamic colors** (set `--event-color`, consume via class) — rejected at D-03 in favor of direct `setCssProps`. Worth re-considering if a future phase introduces per-source theming or hover-state color variants that need CSS pseudo-class access.
- **`requestAnimationFrame` / `requestIdleCallback` debouncing of `handleDragMove`** — the drag hot loop currently calls `setCssProps({ height })` on every `mousemove`. PERF-04 (deferred to v2 perf milestone in REQUIREMENTS.md) covers this; Phase 6 does NOT change the call frequency.
- **`Setting.addColorPicker` consolidation** (above) and **debouncing the drag** (above) are both perf/UX refactors gated to dedicated future milestones.
- **Audit `EmbeddedCalendarView` / `EmbeddedAgendaView` for inline-style writes added since the codebase map** — current grep shows zero violations there, but planner re-runs the violation greps as the first step of implementation. If new violations surface, fold them into the bulk DIR-03 commit (D-16 commit 3) rather than creating a new commit class.
- **Phase 7/8 ESLint overrides** — Phase 6 deletes ONLY the Phase-6 block. The Phase-7 and Phase-8 blocks (lifecycle/promise/cast rules; type-hygiene and unused-vars rules) stay until their owning phase ships.
- **Refactoring `CalendarView`'s per-event renderer to call into `viewRenderers.ts` (eliminate per-surface duplication)** — out of scope. A useful follow-up, but its own architectural change.

</deferred>

---

*Phase: 06-dom-api-refactor*
*Context gathered: 2026-05-13*
