---
phase: 06-dom-api-refactor
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - eslint.config.mjs
  - src/services/CalendarService.ts
  - src/settings/SettingsTab.ts
  - src/utils/viewRenderers.ts
  - src/views/CalendarView.ts
  - src/views/EmbeddedAgendaView.ts
  - src/views/EmbeddedCalendarView.ts
  - styles.css
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 6 successfully replaces all literal/static inline style writes with CSS classes
(`.memochron-hidden`, `.memochron-inline-color-input`, `.memochron-help-btn`,
`.memochron-help-doc-link`, `.memochron-help-buttons`) and migrates two `document.createElement`
sites to `createEl`. All `innerHTML` writes are gone; the previously rewritten setup-guide markup
in `CalendarUrlHelpModal` uses `createEl` + `appendText` correctly. The Phase 6 override block in
`eslint.config.mjs` was removed cleanly, and the resulting 41 `obsidianmd/ui/sentence-case`
suppressions are tightly scoped per-line with accurate rationales (proper nouns, acronyms, UI
labels). XSS surface is unchanged from prior phases: event-supplied strings (`event.title`,
`event.location`, `event.summary`) flow through `createEl({ text: … })` which uses `textContent`,
not innerHTML; calendar colors flow through the existing `isValidColor` whitelist at load time
before reaching `setCssProps`.

However, the refactor is **incompletely applied** in two ways that should be tightened:

1. Three sites still use `element.style.backgroundColor = …` and six sites still use
   `element.style.setProperty('--event-color', …)` — these are dynamic-value writes that escape
   the `obsidianmd/no-static-styles-assignment` literal-only check, so lint passes, but they
   contradict the phase's stated direction of "inline `.style.<property> =` writes → `setCssProps`".
   The same files already migrate `dot.style.color = event.color` to
   `dot.setCssProps({ color: event.color })`, so the inconsistency is internal to this phase's diff.
2. The `styles.css` rules `.memochron-controls.calendar-hidden` (lines 351, 1173) reference a class
   that no TS code applies anymore; this is pre-existing dead CSS that the visibility-toggle rewrite
   should have cleaned up while it was in the area.

A handful of minor quality issues (missing trailing newline, duplicated `getLocationIcon` /
`renderDailyNoteEntry` / `renderEventItem` logic across three files) are noted as Info.

## Warnings

### WR-01: Dynamic `style.backgroundColor` writes not migrated to `setCssProps`

**File:** `src/settings/SettingsTab.ts:225`, `src/settings/SettingsTab.ts:616`, `src/settings/SettingsTab.ts:685`
**Issue:** Three sites still set `swatch.style.backgroundColor = finalColor` /
`colorDot.style.backgroundColor = source.color`. These escape the
`obsidianmd/no-static-styles-assignment` rule because the right-hand side is a variable, not a
literal — so lint is green by accident, not by design. The phase intent (DIR-03: "replace inline
`.style.<property> =` writes with `setCssProps`") implies these should also be migrated for
consistency with `dot.setCssProps({ color: event.color })` (viewRenderers.ts:321,
CalendarView.ts:662, CalendarView.ts:671) which the same phase did migrate. Future contributors
copying these patterns will produce inconsistent code, and a stricter version of the rule
(or a manual obsidianmd review) will flag them in a later phase as new debt.

**Fix:** Migrate to `setCssProps` and document that the lint rule does not catch dynamic writes:

```ts
// src/settings/SettingsTab.ts:225
colorDot.setCssProps({ "background-color": source.color });

// src/settings/SettingsTab.ts:616 and :685
swatch.setCssProps({ "background-color": finalColor });
```

Note: `setCssProps` accepts kebab-case keys for CSS properties. The
`isValidColor` whitelist already runs on `source.color` at load time, and `finalColor` is sourced
from a `getObsidianBaseColors()` hard-coded array or `getComputedStyle(...).getPropertyValue(...)`,
so no new sanitization is required.

### WR-02: Dynamic `style.setProperty('--event-color', …)` writes not migrated

**File:** `src/utils/viewRenderers.ts:148`, `src/utils/viewRenderers.ts:180`,
`src/views/EmbeddedAgendaView.ts:263`, `src/views/EmbeddedAgendaView.ts:298`,
`src/views/CalendarView.ts:771`, `src/views/CalendarView.ts:849`
**Issue:** Six sites still call `element.style.setProperty("--event-color", color)`. Same
literal-vs-variable loophole as WR-01 — lint is silent because the second argument is a variable,
but this is exactly the pattern the phase scope ("inline `.style.<property> =` writes") was meant
to retire. The neighbouring `dot.setCssProps({ color: event.color })` migration in the same files
makes the inconsistency stark.

**Fix:** Use `setCssProps` with the CSS custom property as the key:

```ts
// CalendarView.ts:771 and EmbeddedAgendaView.ts:263 and viewRenderers.ts:148
dailyNoteEl.setCssProps({ "--event-color": dailyNoteColor });

// CalendarView.ts:849 and EmbeddedAgendaView.ts:298 and viewRenderers.ts:180
eventEl.setCssProps({ "--event-color": event.color });
```

The `obsidianmd/no-static-styles-assignment` rule explicitly permits `setCssProps` calls whose
keys start with `--`, so this stays clean.

### WR-03: Stale `.memochron-controls.calendar-hidden` CSS rules left behind

**File:** `styles.css:351-353`, `styles.css:1173-1176`
**Issue:** Two CSS selectors target `.memochron-controls.calendar-hidden`, a class that no TS
source applies. (`git log -S "calendar-hidden" -- src/` shows it was removed in `cb6d42e` before
Phase 6 even started, but the Phase 6 visibility-toggle rewrite at
`CalendarView.updateCalendarVisibility` was the natural moment to delete the orphan rules.) The
new visibility flow uses `.memochron-hidden { display: none }` on the entire `.memochron-controls`
block, so the dead rules contribute no styling — but they confuse readers, will surface in any
future "unused selector" audit, and prevent us from spotting the equivalent live rule should one
go missing.

**Fix:** Delete the two stale blocks:

```css
/* DELETE styles.css:351-353 */
.memochron-controls.calendar-hidden {
  display: none;
}

/* DELETE styles.css:1173-1176 */
.memochron-controls.calendar-hidden .memochron-nav {
  justify-content: flex-start;
}
```

If the second rule's `justify-content: flex-start` behaviour is intentionally part of the
hide-calendar UX (it was, before `cb6d42e`), reapply it under `.memochron-controls.memochron-hidden`
or fold it into the existing nav layout. This needs a glance — but given `.memochron-hidden` sets
`display: none` on the whole controls block, the nav inside it is already invisible, so the rule is
truly dead.

### WR-04: `styles.css` missing trailing newline

**File:** `styles.css:1326`
**Issue:** The Phase 6 diff shows `\ No newline at end of file` at the end of `styles.css`. Many
editors, version-control hooks, and POSIX tooling treat a missing trailing newline as a minor
defect (e.g., `cat` concatenation glues lines together, `git diff` produces noisy "no newline"
warnings on the next edit). The file had a trailing newline before this phase; the new
`.memochron-hidden` block at the end stripped it.

**Fix:** Append a single `\n` to the end of `styles.css`. One-line change.

## Info

### IN-01: Duplicated rendering logic across three files

**File:** `src/utils/viewRenderers.ts`, `src/views/CalendarView.ts:756-901`,
`src/views/EmbeddedAgendaView.ts:246-355`
**Issue:** `renderDailyNoteEntry`, `renderEventItem`, and `getLocationIcon` are implemented
independently in `viewRenderers.ts` (intended as the shared helper), in `CalendarView`, and in
`EmbeddedAgendaView`. The phase touched the daily-note text label ("Daily Note") in all three
copies and added matching `eslint-disable` comments in all three. This works for now, but every
future visual change has to be made three times and any divergence (e.g.,
`renderDailyNoteEntry` in viewRenderers.ts does NOT attach a click handler — see comment at
line 162 — while CalendarView.ts:788 and EmbeddedAgendaView.ts:278 do) is a fault line for bugs.

**Fix:** Out of scope for this phase, but the natural cleanup is to make `renderEventItem` and
`renderDailyNoteEntry` in `viewRenderers.ts` accept a click-handler callback and have the two
views call the shared functions. Track as a refactor follow-up.

### IN-02: `dailyNoteColor` from `getComputedStyle` not validated

**File:** `src/views/CalendarView.ts:660`, `src/views/CalendarView.ts:766`,
`src/views/EmbeddedAgendaView.ts:259`, `src/utils/viewRenderers.ts:144`,
`src/settings/SettingsTab.ts:170`, `src/settings/SettingsTab.ts:671`
**Issue:** Six sites compute
`getComputedStyle(document.documentElement).getPropertyValue("--interactive-accent").trim()`
and feed it directly into `setCssProps` / `style.setProperty` without running it through
`isValidColor`. The result is sourced from the active Obsidian theme, so the practical risk is
zero, but the pattern is inconsistent with `colorValidation.ts` which validates every other color
source (data.json, swatch arrays, defaults). A misbehaving custom theme could in theory set
`--interactive-accent` to a value that breaks the layout (CSS would refuse most attacks; the
practical harm is at most a missing color).

**Fix:** Wrap the lookup in a helper that validates and falls back to `#7c3aed`:

```ts
import { isValidColor } from "../utils/colorValidation";

function resolveAccentColor(fallback = "#7c3aed"): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--interactive-accent")
    .trim();
  return isValidColor(raw) ? raw : fallback;
}
```

Defer to a follow-up; this is pre-existing behaviour, not new in Phase 6.

### IN-03: `eslint-disable` comment on `setDesc` mid-call is fragile

**File:** `src/settings/SettingsTab.ts:514-515`
**Issue:**

```ts
new Setting(container)
  // eslint-disable-next-line obsidianmd/ui/sentence-case -- proper noun: "Advanced" is a labeled settings section
  .setDesc("Configure attendee type filtering in the Advanced section below.");
```

The `eslint-disable-next-line` is attached to the `.setDesc(...)` method call, which works today.
If any future contributor inserts a `.setName(...)` call between `new Setting(container)` and
`.setDesc(...)`, the disable would shift onto the inserted line and miss `.setDesc`. The
inline-comment-on-string-arg form (used elsewhere in the file, e.g. line 1014–1016) is more
robust because the disable sits adjacent to the literal that violates the rule.

**Fix (optional):** Move the comment onto the same line as the string literal:

```ts
new Setting(container).setDesc(
  // eslint-disable-next-line obsidianmd/ui/sentence-case -- proper noun: "Advanced" is a labeled settings section
  "Configure attendee type filtering in the Advanced section below."
);
```

### IN-04: Placeholder copy capitalization shifts may surprise users

**File:** `src/settings/SettingsTab.ts:379` (`"Work, meetings"`),
`src/settings/SettingsTab.ts:888` (`"Calendar-notes/"`),
`src/settings/SettingsTab.ts:1246` (`"Event, meeting"`)
**Issue:** Three text-input placeholders were re-capitalized from lowercase
(`"work, meetings"`, `"calendar-notes/"`, `"event, meeting"`) to sentence case to satisfy
`obsidianmd/ui/sentence-case`. Placeholders are not user-visible UI labels in the sentence-case
sense — they're suggested user input. The Obsidian Plugin Review Guidelines do treat placeholders
as UI text, so the rule is technically correct, but folder paths like `Calendar-notes/` and tag
suggestions like `Event` may confuse users who expect lowercase filesystem conventions / lowercase
Obsidian tags. Recommend confirming with an Obsidian Plugin Reviewer that placeholder
capitalization is intended scope before merging.

**Fix:** No action required if reviewers confirm the rule's intent. If pushback comes, suppress
these three lines with `eslint-disable-next-line obsidianmd/ui/sentence-case -- placeholder
representing user-typed value, not UI label`.

### IN-05: `obsidianmd/no-static-styles-assignment` rule has a known limitation worth pinning

**File:** `eslint.config.mjs` (no code change required)
**Issue:** Per the rule source at
`node_modules/eslint-plugin-obsidianmd/dist/lib/rules/noStaticStylesAssignment.js`, the rule:

- Only flags `element.style.X = Y` when `Y` is a literal
- Only flags `element.style.setProperty('a', 'b')` when both arguments are literals
- Only flags `element.setCssProps({ key: 'b' })` when `key` is a string-literal property key
  (not identifier shorthand and not starting with `--`)

This means `dot.setCssProps({ color: event.color })` (identifier key `color`) actually slips
through the `setCssProps` non-custom-property check — the rule only catches `{ "color": "red" }`
and similar literal-key forms. The code stays compliant, but if a future contributor switches to
quoted keys, lint may suddenly fail. Worth a single comment in CLAUDE.md or PATTERNS.md noting
the limitation so reviewers know to expect dynamic-value escapes.

**Fix:** Not a code change — documentation in `.planning/phases/06-dom-api-refactor/06-PATTERNS.md`
or `CLAUDE.md`'s anti-pattern section that the rule does not catch:
- Dynamic-value `style.X = variable`
- Dynamic-value `style.setProperty('--var', variable)`
- Identifier-key `setCssProps({ key: value })` with non-custom properties

so reviewers don't read green lint as a clean DOM-API state.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
