# Feature Landscape

**Domain:** Obsidian calendar/agenda plugin — stabilization milestone UX enhancements
**Researched:** 2026-05-09
**Scope:** ENH-01 through ENH-06 from PROJECT.md Active requirements only

---

## Context: What Already Exists

The codebase analysis (`.planning/codebase/`) reveals the current state relevant to each enhancement:

- `createDayElement()` in `CalendarView.ts` adds `.today` CSS class when `dateString === todayString`. CSS rule `.memochron-day.today .memochron-day-header` colors the day number with `var(--interactive-accent)` — text color only, no background or border ring.
- `.selected` class fills the entire day cell with `var(--interactive-accent)` background. When today is selected, the accent-colored text disappears into the accent background — today loses its visual identity.
- `NoteService.getExistingEventNote(event)` already exists and returns `TFile | null`. No UI consumes this today.
- `renderEventItem()` in `viewRenderers.ts` renders all agenda events identically regardless of note existence.
- `noteDateFormat` in settings supports `ISO`, `US`, `UK`, and `Long`. No `NL` variant.
- `getEventTemplateVariables()` in `NoteService.ts` has no `{{day}}` or `{{month}}` variables. `FolderTemplateVariables` has `DDDD` (full day name) and `MMMM` (full month name) — but these are folder-path variables only, not note-body template variables.
- Note creation ends with `app.vault.create()` followed by `app.workspace.getLeaf().openFile()`. No cursor placement occurs.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ENH-01: Today always visually distinct from selected | Standard in every calendar UI (Google, Apple, Fantastical, liam-cain Calendar plugin) | Low | CSS + one guard in CalendarView |
| ENH-02: "Note exists" signal on agenda event row | Reduces redundant note-creation attempts; users don't know what they've already captured | Low | `getExistingEventNote()` already exists; just needs a render path |
| ENH-04: DD-MM-YYYY date format | Expected by NL/European users; all other formats (ISO, US, UK) already present — the gap is visible and frustrating | Low | One formatter in `NoteService.formatDate()` |
| ENH-05: `{{day}}` / `{{month}}` template variables | `DDDD`/`MMMM` exist for folder templates but not note body templates; users who copy the pattern from folder docs hit a silent failure | Low | Add two keys to `EventTemplateVariables` in `NoteService` |
| ENH-06: Cursor lands at useful position after note creation | Every note-creation plugin positions the cursor; landing at line 0 inside frontmatter is universally regarded as a bug | Medium | Requires `editor.setCursor()` after `openFile()` resolves; `{{cursor}}` variable approach or "end of body" default |

---

## Differentiators

Features that provide polish beyond the baseline.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ENH-01: Today ring persists inside selected state | The accent-on-accent collision is jarring; showing a ring inside the filled cell is how Google Calendar and Apple Calendar handle it | Low | CSS only: `.today.selected` gets a `box-shadow` or `outline` ring |
| ENH-02: Distinct open-note vs create-note action in agenda | Icon swap on the row (e.g. `file-check-2` vs `file-plus-2` Lucide icons) makes the action affordance clear before clicking | Low | Use `setIcon()` available since Obsidian uses Lucide since 0.13.27 |
| ENH-03: Calendar grid dot for days with event-notes (toggleable) | Gives the grid a quick "coverage" scan; power users like knowing which events they've already captured | Medium | Depends on ENH-02's note-lookup logic; needs a settings toggle |
| ENH-06: `{{cursor}}` marker respected in the note template | Follows the Templater/core Templates established convention; allows per-template cursor control rather than a single global setting | Medium | Strip the `{{cursor}}` text from content, record its line/ch, call `editor.setCursor()` after file opens |

---

## Anti-Features

Features to deliberately avoid in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-open the note in a new pane after creation | Already occurs via `app.workspace.getLeaf().openFile()` — adding forced pane splits is pane-management opinion that half the user base will hate | Keep current single-leaf behavior; cursor position is the only change needed |
| Animate today indicator (pulse, glow) | Obsidian plugins with animated indicators are frequently cited as distracting; Obsidian's own design is static | Static ring/border only |
| Note-status icon on the calendar grid day cells (not just agenda) | Grid cells are tiny (2rem min-height); a status icon at that scale is illegible noise — this is covered by ENH-03's dot indicator instead | Dot indicator on grid (ENH-03); icon only in the agenda list (ENH-02) |
| Automatic `DD-MM-YYYY` detection from system locale | Locale detection is fragile across platforms and Obsidian mobile; explicit user opt-in is the right model | Explicit `NL` selector in the date format dropdown alongside ISO/US/UK/Long |
| `{{day}}` and `{{month}}` in folder path template (duplicating `DDDD`/`MMMM`) | `FolderTemplateVariables` already has `DDDD`/`MMMM`; adding aliases introduces ambiguity | Only add `{{day}}`/`{{month}}` to note body/frontmatter templates (`EventTemplateVariables`); document that folder paths use `{DDDD}`/`{MMMM}` |
| ENH-03 enabled by default | A new dot type on a calendar grid is a visual change existing users did not opt into | Default: off. Opt-in toggle in settings |
| Locale-aware day/month names for ENH-05 | Full i18n is explicitly Out of Scope; always emit English names (`Monday`, `January`) | Hard-code English arrays (same approach as `FolderTemplateVariables.DDDD`/`MMMM` — already English only) |
| `{{cursor}}` support in frontmatter | A cursor marker in YAML frontmatter breaks the YAML structure before the plugin strips it | Only honor `{{cursor}}` in the note body (after frontmatter delimiter). If placed in frontmatter, strip it silently without repositioning. |

---

## Feature Dependencies

```
ENH-02 (agenda note indicator)
  → requires: NoteService.getExistingEventNote() — already exists
  → feeds: ENH-03 (grid dot uses same existence check)

ENH-03 (grid dot for event-notes)
  → requires: ENH-02's note-existence lookup pattern
  → requires: new settings toggle in MemoChronSettings
  → CalendarView.addDayEventIndicator() must call getExistingEventNote() per event

ENH-05 ({{day}} / {{month}} variables)
  → requires: additions to EventTemplateVariables interface
  → requires: additions to getEventTemplateVariables() in NoteService
  → feeds: ENH-06 may reference them in the template near {{cursor}}

ENH-06 (cursor placement)
  → requires: note creation flow in NoteService.createEventNote() + CalendarView click handler
  → requires: workspace.activeEditor.editor.setCursor() after openFile() resolves
  → optional dependency: {{cursor}} marker in noteTemplate (can also fall back to "end of body")
```

---

## Concrete UX Specifications

### ENH-01: Persistent Today Indicator

**Problem:** `.today` adds accent-colored text. `.selected` replaces the entire background with accent color. When today is selected, the text color rule is overridden and today looks identical to any other selected day.

**Table stakes spec:**
- `.memochron-day.today` always shows a visible treatment independent of selection state
- The treatment must survive the `.selected` background fill

**Recommended approach (CSS only, no JS change):**
```css
/* Today: accent-colored number */
.memochron-day.today .memochron-day-header {
  color: var(--interactive-accent);
  font-weight: 700;
}

/* Today + selected: ring inside the filled cell */
.memochron-day.today.selected {
  box-shadow: inset 0 0 0 2px var(--background-primary);
  /* creates a 2px inset gap that reads as a ring on the accent fill */
}

/* Keep the number readable when both today and selected */
.memochron-day.today.selected .memochron-day-header {
  color: var(--text-on-accent);
  font-weight: 700;
}
```

**Differentiator:** The `box-shadow: inset` ring is exactly the pattern Google Calendar uses for today-when-selected. It is theme-safe because `var(--background-primary)` creates contrast against any accent color.

**State refresh trigger:** No new JS needed. `renderDay()` already sets both `.today` and `.selected` classes in one pass. The CSS handles compound state.

**What NOT to do:** Do not add a separate `<div>` ring element. Do not animate. Do not change the accent color itself.

---

### ENH-02: Agenda Note-Existence Indicator

**Problem:** Every event row looks identical whether or not a note exists. Users click to "create" a note that already exists, which silently opens it instead — confusing but not broken. Users cannot scan the agenda to see their capture coverage.

**Table stakes spec:**
- Each agenda event row shows a small icon indicating note state
- Two states: note exists / note does not exist
- Clicking the row opens the existing note or creates a new one (current behavior unchanged)

**Recommended approach:**
- In `renderEventItem()` in `viewRenderers.ts`, after rendering the title, call `plugin.noteService.getExistingEventNote(event)` (needs NoteService passed to renderAgendaList or accessed via plugin ref)
- If note exists: append a small icon element using `setIcon(el, 'file-check-2')` (Lucide, available in Obsidian ≥ 0.13.27, confirmed available)
- If no note: append `setIcon(el, 'file-plus-2')` or no icon at all (minimal approach)
- Icon goes inside the event element, right-aligned using `style="margin-left: auto"`

**Differentiator:** Using `file-check-2` vs `file-plus-2` makes the action semantic — "I have captured this" vs "I can capture this." Coloring the note-exists icon with `var(--color-green)` (Obsidian CSS variable) adds instant scanability.

**CSS for right-aligned status icon:**
```css
.memochron-agenda-event .memochron-note-status {
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.6;
  color: var(--text-muted);
}
.memochron-agenda-event .memochron-note-status.has-note {
  opacity: 1;
  color: var(--color-green, var(--interactive-accent));
}
```

**State refresh trigger:** Agenda is re-rendered on every `showDayAgenda()` call, which happens on date selection and on `refreshEvents()`. No additional refresh logic needed — note existence is checked live on each render.

**What NOT to do:** Do not add a separate "Open Note" button that duplicates the row click. Do not hide the icon behind a hover state — it must be visible without interaction so the scan works.

---

### ENH-03: Calendar Grid Dot for Days with Event-Notes (Toggleable)

**Problem:** The grid shows dots for days with events but gives no signal about capture coverage. A user cannot see at a glance which days' events they have already noted.

**Table stakes spec (if the toggle is on):**
- Days where at least one event has a corresponding note show an additional indicator
- Must be visually distinct from the existing event-presence dots

**Recommended approach:**
- New settings field: `showNoteIndicatorOnGrid: boolean` (default `false`)
- In `CalendarView.addDayEventIndicator()`, when the setting is on, iterate `events` for the date, call `plugin.noteService.getExistingEventNote(event)` for each, and if any returns non-null, add a `memochron-note-indicator` element to the dots container
- Use a small hollow circle (CSS `border: 1.5px solid currentColor; background: transparent`) rather than a filled dot — creates clear visual distinction from the filled event-presence dots
- Color: `var(--color-green, var(--interactive-accent))` when note exists

**Performance note:** `getExistingEventNote()` calls `app.vault.getAbstractFileByPath()` which is synchronous and in-memory (Obsidian's vault index). Safe to call in a tight render loop for a month-grid's ~30 days × avg events-per-day. No network or disk I/O.

**Settings placement:** Under the existing "Calendar Grid" or "Appearance" section in `SettingsTab.ts`. Toggle label: "Show note indicator on calendar days."

**Dependency:** Shares the same note-existence lookup pattern as ENH-02. Extract to a helper `hasEventNote(event, noteService): boolean` to avoid code duplication across `renderEventItem` and `addDayEventIndicator`.

**What NOT to do:** Do not enable this by default. Do not show a count badge (too complex for a dot-based indicator system). Do not make it a different color per calendar source — color is already overloaded by the event-source dots.

---

### ENH-04: DD-MM-YYYY (NL) Date Format

**Problem:** The Netherlands (and most of continental Europe) uses DD-MM-YYYY. All other supported formats are present. NL users report incorrect date parsing when using the UK format as a proxy (the regex in `parseDateFromFilename` ambiguously handles `DD-MM-YYYY` vs `MM-DD-YYYY`).

**Table stakes spec:**
- New format option `NL` in the `noteDateFormat` dropdown
- Output: `DD-MM-YYYY` with hyphens (e.g. `09-05-2026`), filename-safe

**Recommended approach (NoteService.formatDate):**
```typescript
NL: () => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return `${day}-${month}-${year}`;
},
```

**Note on parsing:** BUG-01 (off-by-one date from filename) mentions the ambiguous `DD-MM-YYYY`/`MM-DD-YYYY` regex in `parseDateFromFilename()`. When NL format is active, the note filename will be `DD-MM-YYYY`. If `parseDateFromFilename` is called on such a filename, the existing ambiguous regex can produce wrong results. This is a known issue (BUG-04 area) — the ENH-04 implementation note should flag that `parseDateFromFilename` needs a disambiguation fix when NL format is in use, but that fix belongs to the BUG-01/BUG-04 work item, not ENH-04 itself.

**Settings placement:** Add `NL` to the `noteDateFormat` dropdown alongside `ISO`, `US`, `UK`, `Long` in `SettingsTab.ts`. Display label: `DD-MM-YYYY (NL/EU)`.

**What NOT to do:** Do not use `toLocaleDateString('nl-NL')` — locale strings produce locale-dependent separators (`.` in formal Dutch, `-` or `/` informally). Hard-code the hyphen for filename safety, consistent with the existing `toFilenameSafeDate()` approach.

---

### ENH-05: `{{day}}` and `{{month}}` Template Variables

**Problem:** Users want to write note templates like `## Meeting on {{day}}, {{month}} {{date}}` — e.g. "Meeting on Monday, January 09-05-2026." The folder-path system has `{DDDD}` and `{MMMM}` but these are not available in note body/frontmatter templates.

**Table stakes spec:**
- `{{day}}` → full English weekday name (e.g. `Monday`, `Tuesday`)
- `{{month}}` → full English month name (e.g. `January`, `February`)
- Both resolved from `event.start`
- Both available in frontmatter template AND note body template (same `EventTemplateVariables` interface)

**Recommended approach (NoteService.getEventTemplateVariables):**

Add to `EventTemplateVariables` interface:
```typescript
day: string;    // "Monday"
month: string;  // "January"
```

Add to the returned object in `getEventTemplateVariables()`:
```typescript
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
// ...
day: dayNames[event.start.getDay()],
month: monthNames[event.start.getMonth()],
```

The arrays are identical to those already present in `getFolderTemplateVariables()` — extract to a shared private constant or helper to avoid duplication.

**What NOT to do:** Do not locale-adapt these — always English. Do not add abbreviated variants (`{{dayShort}}`, `{{monthShort}}`) in this milestone — scope creep; they can follow later. Do not rename or alias the existing folder-path `{DDDD}`/`{MMMM}` — leave them as-is.

---

### ENH-06: Caret Placement in Newly-Created Event Notes

**Problem:** After note creation, `openFile()` opens the file but places the cursor at line 0 (inside the frontmatter). The user must manually navigate past the frontmatter to start writing. This is universally perceived as poor UX for a note-creation flow.

**Table stakes spec (minimum viable):**
- After note creation, cursor lands at the first editable position in the note body (after the closing `---` frontmatter delimiter)
- No user configuration needed for the minimum spec — "after frontmatter" is always correct

**Differentiator spec (recommended):**
- Honor `{{cursor}}` in the note body template
- Strip `{{cursor}}` from the content before writing the file
- Record its line number and character offset
- After `openFile()` resolves, call `editor.setCursor({ line, ch })` on the active editor

**Implementation notes:**
1. In `NoteService.generateNoteContent()`, before returning the final content string, scan for `{{cursor}}` in the body portion (after the second `---`). If found, record its position as `{ line: N, ch: 0 }` and strip the marker from the string. Return both the content and the cursor hint.
2. Change `createEventNote()` return type to `{ file: TFile, cursorHint?: EditorPosition }` — or add an optional second return. Alternatively, store the hint on the `NoteService` instance briefly.
3. In `CalendarView`'s event click handler (and embedded view handlers), after `openFile()` resolves, access the editor: `this.app.workspace.activeEditor?.editor` and call `.setCursor(cursorHint)` if the hint is present; otherwise use `editor.setCursor(editor.lastLine())` as the fallback (positions cursor at end of note body).

**Obsidian API used:** `Editor.setCursor(pos: EditorPosition)` where `EditorPosition = { line: number, ch: number }`. This is a stable, documented Obsidian API (confirmed in docs.obsidian.md reference).

**Timing concern:** `openFile()` returns a Promise but the editor may not be fully initialized synchronously after it resolves. A `requestAnimationFrame` or a brief `setTimeout(0)` after `await leaf.openFile(file)` is the established community pattern for safely calling `editor.setCursor()`.

**What NOT to do:** Do not honor `{{cursor}}` inside YAML frontmatter — strip it silently if found there without repositioning. Do not implement a global "cursor position" setting (e.g. "beginning of body" / "end of body" dropdown) in this milestone — the `{{cursor}}` variable gives per-template control which is strictly more flexible. Do not auto-open the note in a split/new pane — maintain existing single-leaf behavior.

---

## MVP Recommendation for This Milestone

All six ENH items are small. In priority order:

1. **ENH-01** (today indicator) — CSS-only, zero risk, high daily visibility
2. **ENH-04** (DD-MM-YYYY) — one formatter, one settings entry
3. **ENH-05** (`{{day}}` / `{{month}}`) — two array entries, follows existing pattern exactly
4. **ENH-02** (agenda note indicator) — requires NoteService access in viewRenderers; low complexity
5. **ENH-06** (cursor placement) — requires the most implementation care (timing, `{{cursor}}` strip + record)
6. **ENH-03** (grid note dot) — depends on ENH-02's note-lookup; implement after ENH-02

Defer nothing — all fit the stabilization milestone scope. ENH-03 blocks on ENH-02 only.

---

## Sources

- liam-cain obsidian-calendar-plugin GitHub: https://github.com/liamcain/obsidian-calendar-plugin — `.today` CSS class confirmation, dot indicator patterns
- obsidian-calendar-ui library (liam-cain): https://github.com/liamcain/obsidian-calendar-ui — IDayMetadata / CSS class approach for daily note existence
- Obsidian developer docs, setCursor: https://docs.obsidian.md/Reference/TypeScript+API/Editor/setCursor — stable API confirmation
- Obsidian forum: {{cursor}} template variable request: https://forum.obsidian.md/t/cursor-template-variable/100278 — established user expectation for `{{cursor}}` convention
- Obsidian forum: cursor placement in Templates plugin: https://forum.obsidian.md/t/cursor-placement-in-templates-plugin-preferably-also-for-daily-notes-template/7206 — Templater uses `tp.file.cursor()`, core Templates has no support
- Wikipedia: Date and time notation in the Netherlands: https://en.wikipedia.org/wiki/Date_and_time_notation_in_the_Netherlands — DD-MM-YYYY as official NL standard
- Lucide icons (file-check-2, file-plus-2, file-pen): https://lucide.dev/icons/file-check-2 and https://lucide.dev/icons/file-plus-2 — icon availability confirmed
- eleken.co calendar UI patterns: https://www.eleken.co/blog-posts/calendar-ui — today vs selected visual hierarchy conventions
