# Phase 6: DOM API Refactor - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 8 (5 .ts in scope + styles.css + eslint.config.mjs + 1 new UAT doc)
**Analogs found:** 8 / 8

Phase 6 is a mechanical refactor; every violation site has at least one in-file analog already using the target idiom. No "no analog found" cases. The strongest evidence is that `createEl({ cls, text })`, `createDiv({ cls })`, `createSpan({ cls })`, `classList.toggle(name, force)`, `createEl("input", { type })`, and the `.memochron-*` CSS class namespace are all established patterns in the same files being modified.

## File Classification

| Modified / New File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/settings/SettingsTab.ts` | view (settings UI) | request-response (DOM construction) | self (rest of file) — `createEl("li", { text })` usage, `classList.toggle(name, force)`, `createEl("input", { type: "checkbox" })` | exact |
| `src/views/CalendarView.ts` | view (sidebar) | request-response (DOM construction + drag-resize) | self (rest of file) — `createEl("div", { cls })`, existing `agenda-only` class toggle | exact |
| `src/utils/viewRenderers.ts` | utility (pure renderer) | transform (events → DOM) | self — sibling `CalendarView.ts:670` per-event dot site (same color logic) | exact |
| `src/views/EmbeddedCalendarView.ts` | view (markdown render child) | request-response | `viewRenderers.ts` (renderers it already calls) | exact (no violations to fix; re-scan only) |
| `src/views/EmbeddedAgendaView.ts` | view (markdown render child) | request-response | `viewRenderers.ts` (renderers it already calls) | exact (no DIR-02/03/04-flagged violations; `style.setProperty("--event-color", ...)` is custom-property write, outside DIR-03's banned list) |
| `styles.css` | stylesheet | static config | existing `.memochron-error-message`, `.memochron-help-btn`, `.memochron-inline-color-*` classes | exact |
| `eslint.config.mjs` | config | static config | self — Phase 5/7/8 override blocks (identical structure) | exact |
| `.planning/phases/06-dom-api-refactor/06-HUMAN-UAT.md` | docs | n/a | Phase 5's HUMAN-UAT.md (D-15 cites the Phase 5 pattern as the template) | exact |

---

## Pattern Assignments

### Commit 1 — `src/settings/SettingsTab.ts` setup-guide innerHTML rewrite (DIR-02, D-01)

**Sites:** lines 1882, 1899, 1920, 1921, 1922

**Analog (in-file):** `SettingsTab.ts:1885-1886` already demonstrates the exact "prefix text + bolded run + suffix text" pattern using `createEl` + `appendText`:

```typescript
// SettingsTab.ts:1885-1886 (existing, clean)
gcalNote.createEl("strong", { text: "Correct URL looks like: " });
gcalNote.createEl("code", { text: "https://calendar.google.com/calendar/ical/.../basic.ics" });
```

And `SettingsTab.ts:1878-1881` (existing, clean) — plain-text `<li>` items use the option-bag `text` form:

```typescript
gcalSteps.createEl("li", { text: "Open Google Calendar in your browser" });
gcalSteps.createEl("li", { text: "Click the gear icon (⚙️) → Settings" });
```

**Target rewrite shape** (per D-01, applied per-site, no helper):

```typescript
// Before (line 1882):
gcalSteps.createEl("li").innerHTML =
  "Copy the <strong>Secret address in iCal format</strong>";

// After:
const gcalStep5 = gcalSteps.createEl("li");
gcalStep5.appendText("Copy the ");
gcalStep5.createEl("strong", { text: "Secret address in iCal format" });
```

**Per-site segment table** (planner uses this as the exact rewrite spec):

| Line | Prefix text | Bold text | Suffix text |
|------|-------------|-----------|-------------|
| 1882 | `"Copy the "` | `"Secret address in iCal format"` | — |
| 1899 | `"Copy the "` | `"ICS link"` | `" (not the HTML link)"` |
| 1920 | — | `"Using the public link"` | `" - This opens a webpage, not calendar data"` |
| 1921 | — | `"Using the embed link"` | `" - This is for embedding in websites"` |
| 1922 | — | `"Missing the .ics extension"` | `" - The URL should end with .ics"` |

**Local-variable naming:** the existing pattern uses descriptive locals (`gcalNote`, `outlookSteps`, `mistakesList`). Per-site `<li>` variables in the rewrites should follow the same descriptive pattern (`gcalStep5`, `outlookStep5`, `mistakeItem1`, etc.) — concise, kept narrowly scoped, since the LI is used only for the next 2 lines.

---

### Commit 2 — `src/settings/SettingsTab.ts` `document.createElement` rewrite (DIR-04, D-12)

**Sites:** lines 652, 735 — both create `<input type="color">` then immediately apply 10 inline styles.

**Analog (in-file):** `SettingsTab.ts:1080` already demonstrates the exact target form with `type` as a top-level option:

```typescript
// SettingsTab.ts:1080 (existing, clean)
const checkbox = labelEl.createEl("input", { type: "checkbox" });
```

This resolves Claude's-Discretion item in CONTEXT D-12 (`createEl("input", { type: ... })` vs `{ attr: { type: ... } }`): the in-file dominant form is the top-level `type:` option. Use that.

**Target rewrite shape** (line 652; line 735 is identical structurally):

```typescript
// Before (line 652-655):
const colorInput = document.createElement("input");
colorInput.type = "color";
colorInput.value = this.colorToHex(currentColor);
colorInput.className = "memochron-inline-color-input";

// After (Commit 2 — DIR-04 only; inline-style cleanup in Commit 3):
const colorInput = customLabel.createEl("input", {
  type: "color",
  cls: "memochron-inline-color-input",
});
colorInput.value = this.colorToHex(currentColor);
```

Notes for planner:
- `customLabel.createEl(...)` returns an element already appended to `customLabel`, so the `customLabel.appendChild(colorInput)` call at lines 666 / 749 becomes redundant and is removed.
- `.className = "memochron-inline-color-input"` folds into the `cls` option (matches surrounding `createEl({ cls })` usage throughout `SettingsTab.ts`).
- The Commit-2 diff leaves the 10 inline-style lines (656-665 / 739-748) in place — they go away in Commit 3. This keeps the two commits independently reviewable and bisectable.

**SVG sites NOT to touch:** `SettingsTab.ts:563, 568, 586` use `document.createElementNS(SVG_NS, ...)` — these are DIR-04-compliant per the explicit `no-restricted-syntax` selector in `eslint.config.mjs:53-61` which matches only `createElement`, not `createElementNS`. Per CONTEXT D-12 / specifics line 181, leave them alone.

---

### Commit 3 — Inline-style → CSS class / `setCssProps` bulk migration (DIR-03, D-03 through D-10)

This is the largest commit. Five files are touched. Below, each violation cluster is mapped to its analog and target rewrite.

#### 3a. Dynamic colors (D-03, D-04) — 3 sites

**Sites:**
- `src/utils/viewRenderers.ts:320` → `dot.style.color = event.color;`
- `src/views/CalendarView.ts:661` → `dailyNoteDot.style.color = dailyNoteColor;`
- `src/views/CalendarView.ts:670` → `dot.style.color = event.color;`

**Analog:** None of these have an existing `setCssProps` analog in the codebase (per CONTEXT code_context: "No `setCssProps` in codebase today"). The analog is the Obsidian API itself, documented in CONTEXT external_refs. The shape is a one-liner substitute.

**Target rewrite shape** (uniform across all 3 sites):

```typescript
// Before:
dot.style.color = event.color;

// After:
dot.setCssProps({ color: event.color });
```

Same shape for the `dailyNoteColor` site at line 661 (`dailyNoteDot.setCssProps({ color: dailyNoteColor })`).

**Validation guarantee** (per CONTEXT code_context bullet 4): `event.color` and `dailyNoteColor` are sanitized upstream by `colorValidation.ts isValidColor` (Phase 2 D-02) — no new render-site validation needed.

**Per-call object literal** (CONTEXT Claude's Discretion): the planner may use per-call literals `{ color: event.color }` or hoist a constant. Per-call literals are simpler and match the one-liner style; recommend per-call.

#### 3b. Dynamic heights (D-05) — 3 sites

**Sites:**
- `src/views/CalendarView.ts:202` → initial apply of saved `calendarHeight` setting
- `src/views/CalendarView.ts:1184` → drag hot loop in `handleDragMove`
- `src/views/CalendarView.ts:1227` → final snap in `snapToCurrentViewMode`

**Analog:** Same as 3a — `setCssProps` is the API; no in-file analog yet.

**Target rewrite shape** (uniform):

```typescript
// Before (line 202):
this.calendar.style.height = `${this.plugin.settings.calendarHeight}px`;

// After:
this.calendar.setCssProps({ height: `${this.plugin.settings.calendarHeight}px` });
```

Same shape at lines 1184 and 1227. Per CONTEXT D-05, `setCssProps` is `setProperty` under the hood — wall-clock cost in the drag hot loop is unchanged. PERF-04 (RAF/debounce) is explicitly deferred per CONTEXT deferred section.

#### 3c. Color-input overlay clusters (D-06) — 2 sites, ~26 lines deleted

**Sites:** `SettingsTab.ts:648-665` and `731-748` (near-identical).

**Analog (in-file CSS):** `styles.css:1186-1193` (`.memochron-inline-color-swatch`) and `1205-1208` (`.memochron-inline-color-custom-label`) already define 24×24 swatch geometry using static CSS. The new classes slot directly alongside them.

**Existing `customLabel` class:** `customLabel = container.createDiv({ cls: "memochron-inline-color-custom-label" })` at lines 631, 715. Per CONTEXT D-06, the existing class is preserved; a NEW wrapper class is added that bundles the 4 inline styles (position/display/width/height). Decision for planner: either (a) add the new wrapper class TO `customLabel` (making `memochron-inline-color-custom-label` already carry these props since its element role is the wrapper), or (b) introduce `.memochron-custom-color-wrapper` as a second class. CONTEXT D-06 suggests (b) with that name, but per CONTEXT Claude's Discretion line 102, the planner may consolidate by adding the styles to the existing `.memochron-inline-color-custom-label` rule in `styles.css` since that class is already the wrapper's identity. Either is acceptable; planner picks the cleaner diff.

**Target CSS additions** (per D-06):

```css
/* styles.css — append in the "Inline color picker styles" section near line 1212 */

.memochron-custom-color-wrapper {
  position: relative;
  display: inline-block;
  width: 24px;
  height: 24px;
}

.memochron-inline-color-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
  margin: 0;
}
```

**Target call-site rewrite** (both sites — 652 and 735):

```typescript
// Before (lines 648-665, abbreviated):
customLabel.style.position = "relative";
customLabel.style.display = "inline-block";
customLabel.style.width = "24px";
customLabel.style.height = "24px";
const colorInput = document.createElement("input");   // Commit 2 already replaced
colorInput.type = "color";
// ... 10 more inline styles ...

// After (post Commit 2 + 3 combined):
customLabel.addClass("memochron-custom-color-wrapper");
const colorInput = customLabel.createEl("input", {
  type: "color",
  cls: "memochron-inline-color-input",
});
colorInput.value = this.colorToHex(currentColor);
```

**`addClass` vs second-class-in-createDiv:** `customLabel` is already created with `cls: "memochron-inline-color-custom-label"` at line 631/715. Adding the wrapper class post-creation via `addClass` is the lower-diff option. The existing `customLabel.classList.add("selected")` pattern at lines 677 / 759 demonstrates `addClass`-style usage in the same function.

#### 3d. Error-message styling (D-07) — 2 sites

**Sites:** `SettingsTab.ts:304-306` (URL validation) and `889-892` (refresh-interval validation).

**Crucial finding:** The class `.memochron-error-message` ALREADY EXISTS in `styles.css:1292-1296`:

```css
/* styles.css:1291-1296 (existing) */
.memochron-error-message {
  color: var(--text-error);
  font-size: 0.9em;
  margin-top: var(--size-4-2);
}
```

And both error sites ALREADY apply it via `cls: "memochron-error-message"` (lines 302, 887). The 3 inline-style lines per site are pure duplication — they reapply what the class already does (with a slightly different `--text-error` fallback form and a hardcoded `0.5em` instead of `var(--size-4-2)`).

**Target action:** **DELETE the inline-style lines outright** (lines 304-306 and 890-892). No CSS additions needed.

**Discrepancy to resolve in the CSS** (planner decides):
- Existing class uses `color: var(--text-error)` (no fallback).
- Inline style uses `var(--text-error, #c92424)` (with hex fallback).
- CONTEXT D-07 explicitly says "The `--text-error` fallback is preserved exactly."
- **Recommended:** update the existing `.memochron-error-message` rule to `color: var(--text-error, #c92424)` to preserve the fallback per D-07. Single-line CSS change.

Similarly:
- Existing class uses `margin-top: var(--size-4-2)`.
- Inline style uses `margin-top: 0.5em`.
- These are visually equivalent in default Obsidian themes (`--size-4-2` ≈ 8px ≈ 0.5em at default font size), but to preserve "visually identical to v1.14.0" per CONTEXT D-14, planner may either accept the var (negligible drift) or hardcode `0.5em` (exact parity). Recommend keeping the var for consistency with the rest of `styles.css`.

#### 3e. Help-button styling (D-08) — 1 site

**Sites:** `SettingsTab.ts:317-318`.

**Existing class:** `.memochron-help-btn` exists at `styles.css:1215-1227` and is already applied at line 315 (`cls: "memochron-help-btn"`). The 2 inline styles at 317-318 (`marginTop: "0.5em"`, `fontSize: "0.85em"`) add extra properties not in the existing rule.

**Target action:** Append the two extra properties to the existing `.memochron-help-btn` rule in `styles.css`:

```css
/* styles.css:1215 — augment existing rule */
.memochron-help-btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: var(--radius-s);
  padding: var(--size-4-1) var(--size-4-2);
  cursor: pointer;
  transition: background-color 0.15s ease;
  margin-top: 0.5em;        /* NEW per D-08 */
  font-size: 0.85em;        /* NEW per D-08 */
}
```

**Risk:** these properties apply to ALL `.memochron-help-btn` instances, not only the inline error-help button. Currently there is only one such instance (the post-error-message help button at line 313-318). If future code adds another help button, the `margin-top` may not be wanted. CONTEXT D-08 calls this "Trivial." Planner accepts the augmentation; if uncomfortable, introduce a more specific class `.memochron-settings-help-button` per CONTEXT's working-name suggestion and apply it via a second class. Either works; the lower-diff option is augmenting the existing rule.

Then delete lines 317-318.

#### 3f. Doc-link + button-container spacing (D-09) — 2 sites

**Sites:** `SettingsTab.ts:1926` (`docLink.style.marginTop = "1em"`) and `1935-1936` (`buttonContainer.style.marginTop = "1.5em"`, `textAlign = "right"`).

**Existing classes:** `docLink` already has `cls: "memochron-help-doc-link"` (line 1925); `buttonContainer` already has `cls: "memochron-help-buttons"` (line 1934). The existing `.memochron-help-doc-link` rule at `styles.css:1279-1281` only sets `text-align: center` — note this conflicts with the inline override which is for the OUTER container, not the link itself. Re-reading:

- Line 1925 creates `docLink` div with class `memochron-help-doc-link` → applies inline `margin-top: 1em`.
- The `.memochron-help-doc-link` CSS rule already sets `text-align: center` for that div — fine.

Add `margin-top: 1em` to the existing `.memochron-help-doc-link` rule at `styles.css:1279-1281`. Delete line 1926.

For `buttonContainer`:
- Class `memochron-help-buttons` does NOT exist in `styles.css` (verified via grep).
- Need to either add a NEW rule for `.memochron-help-buttons` (with `margin-top: 1.5em; text-align: right;`) OR use the working name CONTEXT D-09 suggests (`.memochron-setup-guide-button-container`). The existing class is already applied at line 1934, so adding a rule for it is the lower-diff option.

Recommended:

```css
/* styles.css — append after .memochron-help-doc-link block (~line 1290) */
.memochron-help-buttons {
  margin-top: 1.5em;
  text-align: right;
}
```

Delete lines 1935-1936.

#### 3g. Display-toggle migration (D-10, D-11) — `updateCalendarVisibility`

**Site:** `CalendarView.ts:980-1000` — currently flips `style.display` between `"none"` and `""` for three elements (`this.calendar`, `this.resizeHandle`, `controls`) and ALSO already does `this.agenda.classList.add/remove("agenda-only")`.

**Analog (in-file):** The function ITSELF demonstrates the target pattern on the `this.agenda` element (lines 991, 998):

```typescript
// CalendarView.ts:991, 998 (existing, clean)
this.agenda.classList.add("agenda-only");
// ...
this.agenda.classList.remove("agenda-only");
```

Plus `SettingsTab.ts:244` (existing, clean) shows the single-call `classList.toggle(name, force)` form:

```typescript
// SettingsTab.ts:244 (existing, clean)
itemEl.classList.toggle("disabled", !value);
```

Per CONTEXT specifics line 184, Obsidian's `el.toggleClass(name, force)` is the cleanest target form (if supported in current Obsidian typings); `classList.toggle(name, force)` is the in-codebase-proven fallback.

**Target rewrite shape:**

```typescript
// Before (lines 985-999):
if (this.plugin.settings.hideCalendar) {
  this.calendar.style.display = "none";
  if (this.resizeHandle) this.resizeHandle.style.display = "none";
  if (controls) {
    controls.style.display = "none";
  }
  this.agenda.classList.add("agenda-only");
} else {
  this.calendar.style.display = "";
  if (this.resizeHandle) this.resizeHandle.style.display = "";
  if (controls) {
    controls.style.display = "";
  }
  this.agenda.classList.remove("agenda-only");
}

// After (collapsed via toggleClass with force argument):
const hide = this.plugin.settings.hideCalendar;
this.calendar.toggleClass("memochron-hidden", hide);
this.resizeHandle?.toggleClass("memochron-hidden", hide);
controls?.toggleClass("memochron-hidden", hide);
this.agenda.toggleClass("agenda-only", hide);
```

(If `toggleClass` second-arg is not in current `@types/obsidian`, fall back to `this.calendar.classList.toggle("memochron-hidden", hide)` per the `SettingsTab.ts:244` analog.)

**CSS addition:**

```css
/* styles.css — append in a "Utilities" section at the bottom */
.memochron-hidden {
  display: none;
}
```

Per CONTEXT D-11, no `el.show()` / `el.hide()` — they set `display = "none"` / `""` directly and would re-trigger the lint rule. CSS-class toggle is the only DIR-03-compliant route.

**Note on `agenda-only`:** Per CONTEXT D-10, the `agenda-only` class on `this.agenda` carries different semantics (layout reflow, not visibility) and stays as-is.

---

### Commit 4 — `eslint.config.mjs` override-block deletion (D-13)

**Sites:** `eslint.config.mjs:65-82` (Phase-6 DIR-02/03/04 block) and `83-98` (sentence-case block).

**Analog (in-file):** The structurally identical Phase-7 block (lines 100-126) and Phase-8 blocks (132-151, 152-168) — same `tseslint.config(...)` array element shape. Phase 6 removes its two blocks; the Phase-7/8 blocks stay until their owning phases.

**Target action:** Delete lines 65-98 (the Phase-6 + sentence-case blocks plus the comment header at line 65-69). Run `npm run lint` after deletion to confirm zero new violations.

**Sentence-case flagged strings:** Per CONTEXT D-13 and Claude's Discretion line 106, every flagged string is reviewed at implementation time. Inventory (from grep):

| Line | String | Recommended resolution |
|------|--------|------------------------|
| 314 | `"How do I get the correct URL?"` | lowercase → `"How do I get the correct URL?"` is already proper sentence case (only "How" capitalized at start, "URL" is acronym) — likely passes; verify against rule |
| 1061 | `"Filter which attendee types appear in event notes. Most calendars only mark rooms and resources explicitly."` | passes sentence case (only sentence starts capitalized) |
| 1127 | `"Available variables: {YYYY}, ..."` | passes |
| 1131 | `"Examples: {YYYY}/{MM}, ..."` | passes |
| 1172 | `"Preview: Notes will be saved directly in the note location folder"` | `"Preview: notes will be saved..."` — lowercase second `N` (after colon, not a new sentence). Planner verifies the rule's exact behavior here |
| 1195 | `"Invalid template format"` | passes |
| 1871 | `"How to Get the Correct Calendar URL"` | **title case → sentence case:** `"How to get the correct calendar URL"` — H1 in modal |
| 1875 | `"Google Calendar"` | proper noun (product name) — `// eslint-disable-next-line obsidianmd/ui/sentence-case` with rationale `// proper noun: Google Calendar` |
| 1885 | `"Correct URL looks like: "` | passes (URL is acronym) |
| 1892 | `"Outlook / Microsoft 365"` | proper noun — disable-next-line with rationale |
| 1898 | `"Under \"Publish a calendar\", select your calendar and permissions"` | passes; "Publish a calendar" is a UI button label in Outlook (proper noun within a quoted string — likely OK as-is, verify) |
| 1905 | `"Apple iCloud Calendar"` | proper noun — disable-next-line |
| 1910 | `"Check \"Public Calendar\" to make it shareable"` | quoted UI label; verify rule behavior on quoted phrases |
| 1917 | `"Common Mistakes"` | **title case → sentence case:** `"Common mistakes"` |
| 1928 | `"View full documentation on GitHub"` | proper noun (GitHub) — likely passes since the leading "View" starts the sentence; verify |

The planner enumerates the **actual** lint output at implementation time (running `npx eslint src/settings/SettingsTab.ts` after deleting the override block reveals the precise flagged sites). The table above is a starting-point inventory based on the grep; the lint output is authoritative.

---

### Commit 5 — `.planning/phases/06-dom-api-refactor/06-HUMAN-UAT.md` (D-14, D-15)

**Analog:** Phase 5's HUMAN-UAT.md (cited in CONTEXT canonical_refs as the template for D-13's UAT-only verification pattern). Per CONTEXT D-15, no PNG screenshots are committed.

**Target content:** 5-step walkthrough per D-14:
1. Sidebar calendar (month/week view + dynamic colors + today/selected indicators)
2. Embedded views (`memochron-calendar` + `memochron-agenda` code blocks)
3. Settings tab (custom color picker overlay + setup-guide rendering)
4. Hide-calendar toggle (calendar + resize handle + controls hide/show)
5. No layout regressions at 350px / 400px / default sidebar widths

Plus one optional mobile-CSS check line per CONTEXT specifics line 185.

---

## Shared Patterns

### Pattern S-1: Obsidian `createEl` option-bag

**Source:** `SettingsTab.ts:1080` (input/checkbox), `SettingsTab.ts:1878-1881` (li with text), `SettingsTab.ts:1885-1886` (strong/code with text), `CalendarView.ts:198, 206, 666` (div with cls), `viewRenderers.ts:301, 315` (div with cls).

**Apply to:** Every DOM construction site in Phase 6 — Commit 1 (li/strong), Commit 2 (input type=color), Commit 3 (none directly, just style+class rewrites).

**Excerpt (canonical patterns observed across all five files):**

```typescript
// Plain text
parent.createEl("li", { text: "Open Google Calendar in your browser" });

// Text + class
parent.createEl("strong", { text: "Secret address in iCal format" });

// Class only
parent.createEl("div", { cls: "memochron-event-dot colored" });

// Class + type (input element)
labelEl.createEl("input", { type: "checkbox" });

// Class + multiple options
container.createEl("hr", { cls: "memochron-section-separator" });

// Anchor with href
docLink.createEl("a", {
  text: "View full documentation on GitHub",
  href: "https://github.com/formax68/memoChron#remote-calendars",
});
```

The top-level `type:` option is the in-file dominant form (`SettingsTab.ts:1080`); use it for `type: "color"` in Commit 2.

### Pattern S-2: `appendText` + segment-per-bold pattern

**Source:** Per D-01, this is a NEW pattern (no prior site uses `appendText` in the codebase — grep returns zero hits for `\.appendText(`). The shape is documented inline at CONTEXT D-01.

**Apply to:** All 5 setup-guide sites in Commit 1.

**Excerpt:**

```typescript
const li = parent.createEl("li");
li.appendText("Copy the ");
li.createEl("strong", { text: "Secret address in iCal format" });
// optional suffix:
// li.appendText(" (extra text)");
```

`appendText` is part of Obsidian's HTMLElement extension. Type signature: `appendText(text: string): void;`.

### Pattern S-3: `classList.toggle(name, force)` for boolean class state

**Source:** `SettingsTab.ts:79-81, 244, 267-268` (5 existing sites).

**Apply to:** Commit 3g (D-10) `updateCalendarVisibility` rewrite.

**Excerpt:**

```typescript
// SettingsTab.ts:244
itemEl.classList.toggle("disabled", !value);
```

Obsidian also provides `el.toggleClass(name, force)` (extension on HTMLElement). If supported by current typings, prefer it for the new D-10 sites; otherwise fall back to `classList.toggle` per the in-file analog.

### Pattern S-4: `.memochron-*` CSS class convention

**Source:** `styles.css` — 40+ existing classes; full list at `styles.css:27-1296`. Prefix is invariant.

**Apply to:** Every new class introduced in Commit 3 — `.memochron-hidden`, optionally `.memochron-custom-color-wrapper` (or merge into `.memochron-inline-color-custom-label`), augmentations to `.memochron-error-message` / `.memochron-help-btn` / `.memochron-help-doc-link` / `.memochron-help-buttons`.

**Excerpt:**

```css
/* styles.css:1186 (existing) — illustrative naming and grouping */
.memochron-inline-color-swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-s);
  cursor: pointer;
  border: 2px solid var(--background-modifier-border);
  transition: transform 0.15s ease, border-color 0.15s ease;
}
```

CSS custom-property variables (`var(--text-error)`, `var(--size-4-2)`, `var(--interactive-accent)`, `var(--text-on-accent)`, `var(--background-modifier-border)`, `var(--radius-s)`) are the preferred values for theming consistency. Per CONTEXT D-07, the `--text-error` fallback (`var(--text-error, #c92424)`) is preserved when the existing rule is updated.

### Pattern S-5: `el.addClass()` for post-creation class addition

**Source:** `SettingsTab.ts:677, 759` — existing in the SAME function being modified by D-06:

```typescript
// SettingsTab.ts:677 (existing, clean)
customLabel.classList.add("selected");
```

(Note: the codebase uses both `classList.add` and `addClass` — Obsidian's `addClass` is the more common form across views. `CalendarView.ts:1175` shows `this.resizeHandle.addClass("dragging")`.)

**Apply to:** Commit 3c (D-06) for adding `.memochron-custom-color-wrapper` to the existing `customLabel` element.

### Pattern S-6: Existing `agenda-only` class as the proof-of-concept for D-10

**Source:** `CalendarView.ts:991, 998` (in the function Phase 6 modifies) and the corresponding CSS rule for `agenda-only` (search `styles.css` for `.agenda-only` or `agenda-only` selector — exists in the `.memochron-agenda` section).

**Apply to:** Validate planner's confidence that the class-toggle pattern works in the same call site. The D-10 rewrite literally extends the existing sibling pattern from one element (`this.agenda`) to three more (`this.calendar`, `this.resizeHandle`, `controls`).

---

## No Analog Found

None. Every Phase 6 rewrite has an in-file or in-repo analog already demonstrating the target idiom.

Two technical patterns are NEW to the codebase but are documented Obsidian APIs cited in CONTEXT:

- **`setCssProps({ ... })`** — first introduced by Phase 6 across the 6 dynamic-style sites in D-04 / D-05. Documented in Obsidian Plugin API (CONTEXT external_refs line 144).
- **`appendText(string)`** — first introduced by Phase 6 in the 5 D-01 setup-guide rewrites. Documented in Obsidian HTMLElement extension.

Both are one-liner substitutions; no architectural footprint. Per CONTEXT code_context line 165: "Single-call adoption across ~6 dynamic sites; not a sweeping pattern change, just a documented one-liner substitute for `style.X =`."

---

## Metadata

**Analog search scope:** `src/views/`, `src/settings/`, `src/utils/`, `styles.css`, `eslint.config.mjs`.

**Files scanned (read at least once during pattern extraction):**
- `src/views/CalendarView.ts` — lines 195-215, 650-685, 975-1000, 1175-1234 (targeted reads of all violation regions + surrounding context)
- `src/views/EmbeddedCalendarView.ts` — confirmed clean via grep (no innerHTML / outerHTML / document.createElement / 15-prop inline-style writes)
- `src/views/EmbeddedAgendaView.ts` — confirmed clean via grep; two `style.setProperty("--event-color", ...)` writes are custom-property writes, NOT in DIR-03's banned 15-property list
- `src/settings/SettingsTab.ts` — lines 70-83, 240-250, 290-330, 555-600, 640-760, 875-900, 1075-1090, 1855-1947 (targeted reads of all violation regions + surrounding context including SVG createElementNS sites)
- `src/utils/viewRenderers.ts` — lines 300-330
- `styles.css` — lines 1175-1296 (color picker, help button, help modal, error message sections), grep across full file for class inventory
- `eslint.config.mjs` — full file (177 lines, single read)

**Greps executed:**
- `grep -nE '\.(inner|outer)HTML\s*=' ...` — 5 hits in `SettingsTab.ts`
- `grep -n 'document\.createElement\b' ...` — 2 hits in `SettingsTab.ts` (+ 3 createElementNS sites not flagged)
- `grep -nE '\.style\.(border|color|cursor|display|fontSize|height|left|margin|marginTop|opacity|padding|position|textAlign|top|width)\s*=' ...` — 51 hits total: 8 in `CalendarView.ts`, 1 in `viewRenderers.ts`, 42 in `SettingsTab.ts`
- `grep -n 'toggleClass\|classList\.toggle\|setCssProps' src/ -r` — 6 hits (all `classList.toggle`); zero `setCssProps`; zero `el.toggleClass`
- `grep -nE '^\.memochron-[a-z-]+\s*\{' styles.css` — 40+ existing classes, full `.memochron-*` namespace inventoried
- `grep -nE 'text:\s*"[A-Z]' src/settings/SettingsTab.ts` — 25 candidate sentence-case sites for D-13 review

**Pattern extraction date:** 2026-05-13
