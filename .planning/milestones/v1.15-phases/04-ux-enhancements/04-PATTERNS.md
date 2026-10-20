# Phase 4: UX Enhancements - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 8 (1 CSS, 1 types, 1 utils renderer, 2 views, 1 embedded calendar, 1 embedded agenda, 1 settings, 1 service)
**Analogs found:** 8 / 8 — every file changed in Phase 4 already has a direct in-repo analog. No analog gaps.

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `styles.css` | config (theme) | n/a | `.memochron-day.selected` block at `styles.css:146-159` and `.memochron-day.today .memochron-day-header` at `styles.css:161-164` | exact (same selector family) |
| `src/settings/types.ts` | model (types + DEFAULT_SETTINGS) | request-response (Obsidian load/save) | `showDailyNoteInAgenda: boolean` field at `src/settings/types.ts:56` + `DEFAULT_SETTINGS:91` | exact |
| `src/utils/viewRenderers.ts` (RenderOptions + renderEventItem + addEventIndicators) | utility (pure renderer) | request-response (called per render) | Existing `RenderOptions` interface at lines 6-12; existing `renderEventItem` location block at lines 209-215; existing `addEventIndicators` dot loop at lines 281-317 | exact |
| `src/views/CalendarView.ts` (agenda row icon + grid corner-square + showEventDetails re-render + setCursor) | component (sidebar view) | event-driven (click handlers) | Existing `renderEventLocation` at lines 874-883 (trailing-element pattern); existing `addDayEventIndicator` dots at lines 629-694 (corner-element pattern); existing `showEventDetails` at lines 915-940 (create-then-open flow) | exact |
| `src/views/EmbeddedCalendarView.ts` (pass `hasNote` through RenderOptions) | component (embedded view) | request-response | Existing `RenderOptions` construction at lines 142-147 | exact |
| `src/views/EmbeddedAgendaView.ts` (icon append in renderEventItem) | component (embedded view) | request-response | Existing `renderEventItem` location section at lines 327-334 | exact |
| `src/settings/SettingsTab.ts` (new toggle + relabel UK dropdown) | component (settings UI) | request-response (onChange → saveSettings) | Existing `renderNoteDateFormat` dropdown at lines 937-962; existing toggle pattern at lines 127-138 (showWeekNumbers) and 820-841 (showDailyNoteInAgenda); per-calendar dropdown at 1585-1611 | exact |
| `src/services/NoteService.ts` (add day/month vars + extract {{cursor}} helper + return cursor side-channel) | service (note generation) | request-response | Existing `EventTemplateVariables` interface at lines 7-27; existing `getEventTemplateVariables` at lines 218-252; existing `applyTemplateVariables` at lines 254-272; existing `FolderTemplateVariables` day/month names at lines 462-471 | exact (day/month tables already exist for folder paths) |

---

## Pattern Assignments

### `styles.css` — ENH-01 today indicator (controller-less pure CSS)

**Analog:** `styles.css:146-164` — selected/today selectors already use `var(--interactive-accent)`.

**Existing reference (lines 146-164):**
```css
.memochron-day.selected {
  background-color: var(--interactive-accent);
}

/* Important: Always ensure text is visible on selected days */
.memochron-day.selected .memochron-day-header {
  color: var(--text-on-accent) !important;
  font-weight: 600;
}

.memochron-day.selected .memochron-event-dot {
  opacity: 0.8;
  /* Slight contrast on accent background */
}

.memochron-day.today .memochron-day-header {
  color: var(--interactive-accent);
  font-weight: 700;
}
```

**Pattern to copy:**
- Add a sibling `.memochron-day.today { box-shadow: inset 0 0 0 2px var(--interactive-accent); }` rule alongside line 161-164. Inset shadow paints inside the cell border so it shows over BOTH the default background AND the `var(--interactive-accent)` background of `.selected`.
- Continue using `var(--interactive-accent)` (no new color setting, no theme fork) — matches D-03.

**Grid corner-square (ENH-03) — analog:** `.memochron-event-dot.colored` block at `styles.css:197-200`.

**Existing reference (lines 176-208):**
```css
.memochron-event-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--text-muted);
  margin-bottom: 1px;
}

.memochron-event-dots-container {
  display: flex;
  gap: 3px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 4px;
  min-height: 8px;
}

.memochron-event-dot.colored {
  background-color: currentColor;
  margin-bottom: 0;
}
```

**Pattern to copy:** Define `.memochron-note-indicator` (or planner-chosen class name) with `width`/`height` ≈ 5-6px, `background-color: var(--interactive-accent)`, `border-radius: 1px` (square, NOT 50% — explicit visual contrast vs the round event dots per D-05), `position: absolute` in a `top: 2px; right: 2px;` corner. The `.memochron-day` parent will need `position: relative;` (verify it already is from existing styling; if not, add to the existing rule).

**Agenda icon spacing — analog:** `.memochron-event-location` at `styles.css:607` and `.memochron-agenda-event` at `styles.css:342-360`.

---

### `src/settings/types.ts` — new `showNoteIndicatorOnGrid` field

**Analog:** `showDailyNoteInAgenda: boolean` at line 56 + DEFAULT_SETTINGS line 91.

**Imports pattern** — no change (still imports from `../utils/constants`).

**Field add pattern (existing reference lines 53-58):**
```typescript
hideCalendar: boolean;
folderPathTemplate: string; // Template for organizing notes in date-based subfolders
enableCalendarColors: boolean; // Global toggle for calendar colors feature
showDailyNoteInAgenda: boolean; // Show daily note as an entry in the agenda
dailyNoteColor?: string; // Color for daily note entry when calendar colors are enabled
enableAttendeeLinks: boolean; // Create wiki links for attendees
```

**Pattern to copy:** Add `showNoteIndicatorOnGrid: boolean;` to the `MemoChronSettings` interface alongside `showDailyNoteInAgenda` (sibling concern: grid display toggle). Add `showNoteIndicatorOnGrid: false,` to `DEFAULT_SETTINGS` (line 91 area), matching the `// Disabled by default` comment style at line 91.

No new constant needed in `src/utils/constants.ts` (per D-05, default literal `false` inline is sufficient — `showDailyNoteInAgenda` also uses inline `false`).

---

### `src/utils/viewRenderers.ts` — RenderOptions + trailing icon + corner-square

**Analog (RenderOptions extension):** Existing interface at lines 6-12.

**Existing reference (lines 6-12):**
```typescript
export interface RenderOptions {
  enableColors?: boolean;
  firstDayOfWeek?: number;
  timeFormat?: "12h" | "24h";
  showDailyNote?: boolean;
  dailyNoteColor?: string;
}
```

**Pattern to copy:** Add two optional fields:
```typescript
export interface RenderOptions {
  enableColors?: boolean;
  firstDayOfWeek?: number;
  timeFormat?: "12h" | "24h";
  showDailyNote?: boolean;
  dailyNoteColor?: string;
  hasNote?: (event: CalendarEvent) => boolean;     // ENH-02 + ENH-03
  showNoteIndicatorOnGrid?: boolean;               // ENH-03
}
```

Callback shape (D-06 first option) is preferred over a `Map<string, boolean>` because `CalendarEvent` has no stable identity key across renders (timezone-converted recurrences regenerate); the callback wraps `plugin.noteService.getExistingEventNote(event) !== null` which IS cheap and synchronous per code_context.

**Analog (trailing icon append in agenda):** Existing `renderEventItem` location section, lines 208-215.

**Existing reference (lines 162-216, focused on lines 208-215):**
```typescript
  // Location
  if (event.location) {
    const icon = getLocationIcon(event.location);
    eventEl.createEl("div", {
      cls: "memochron-event-location",
      text: `${icon} ${event.location}`,
    });
  }
}
```

**Pattern to copy:** After the `if (event.location)` block (immediately before the function's closing `}`), append a trailing icon element. Note: this file currently does NOT import `setIcon` — add `setIcon` to the existing `from "obsidian"` import at line 3.

```typescript
  // Note-exists indicator (ENH-02 — always-on)
  if (options.hasNote) {
    const iconEl = eventEl.createEl("div", {
      cls: "memochron-event-note-indicator",
    });
    setIcon(iconEl, options.hasNote(event) ? "file-check" : "file-plus");
  }
```

`setIcon` lucide names `file-check` / `file-plus` are named verbatim by ROADMAP success criterion #2 (code_context Reusable Assets).

**Analog (corner-square in grid):** Existing `addEventIndicators` at lines 281-317.

**Existing reference (lines 281-300):**
```typescript
function addEventIndicators(
  dayEl: HTMLElement,
  events: CalendarEvent[],
  options: RenderOptions
) {
  dayEl.addClass("has-events");

  const dotsContainer = dayEl.createEl("div", {
    cls: "memochron-event-dots-container",
  });
  ...
}
```

**Pattern to copy:** At the top of `addEventIndicators` (or after the existing dot rendering — planner picks; before is simpler because order of children doesn't matter for `position: absolute`):
```typescript
// ENH-03: grid-level note-exists indicator (off by default)
if (
  options.showNoteIndicatorOnGrid &&
  options.hasNote &&
  events.some((e) => options.hasNote!(e))
) {
  dayEl.createEl("div", { cls: "memochron-note-indicator" });
}
```

Render path is already gated by `options` — same flow as `enableColors` at line 292 and `showDailyNote` at line 110. Live-settings (Phase 1 D-03) is satisfied: callers pass `this.plugin.settings.showNoteIndicatorOnGrid` fresh on every render.

---

### `src/views/CalendarView.ts` — sidebar mirrors + showEventDetails branching

**Existing import line 1:**
```typescript
import { ItemView, WorkspaceLeaf, Notice, TFile, DropdownComponent, setIcon, Menu, MenuItem } from "obsidian";
```

`setIcon` is already imported (used at lines 235, 291). **`MarkdownView` needs to be added** — grep confirmed zero existing imports in repo. Add it here for ENH-06.

**Analog (agenda row trailing icon):** Existing `renderEventLocation` at lines 874-883 mirrors the same trailing-block pattern used in `viewRenderers.ts`.

**Existing reference (lines 827-844):**
```typescript
private renderEventItem(list: HTMLElement, event: CalendarEvent, now: Date) {
  const eventEl = list.createEl("div", { cls: "memochron-agenda-event" });

  if (event.end < now) {
    eventEl.addClass("past-event");
  }

  // Add colored left border if colors are enabled
  if (this.plugin.settings.enableCalendarColors && event.color) {
    eventEl.addClass("with-color");
    eventEl.style.setProperty("--event-color", event.color);
  }

  this.renderEventTime(eventEl, event);
  this.renderEventTitle(eventEl, event);
  this.renderEventLocation(eventEl, event);
  this.addEventClickHandler(eventEl, event);
}
```

**Pattern to copy:** Add a sibling private method `renderEventNoteIndicator(eventEl, event)` and call it after `renderEventLocation` (line 842) and before `addEventClickHandler`. Body mirrors the `viewRenderers.ts` snippet but reads live settings directly:
```typescript
private renderEventNoteIndicator(eventEl: HTMLElement, event: CalendarEvent) {
  const iconEl = eventEl.createEl("div", { cls: "memochron-event-note-indicator" });
  const hasNote = this.plugin.noteService.getExistingEventNote(event) !== null;
  setIcon(iconEl, hasNote ? "file-check" : "file-plus");
}
```

**Analog (grid corner-square):** Existing `addDayEventIndicator` at lines 629-694 (especially the dot container creation pattern at 645-648).

**Pattern to copy:** Inside `addDayEventIndicator`, after the existing `if (events.length > 0 || hasDailyNote)` block, add a parallel guarded block:
```typescript
// ENH-03: grid note-exists indicator
if (
  this.plugin.settings.showNoteIndicatorOnGrid &&
  events.some((e) => this.plugin.noteService.getExistingEventNote(e) !== null)
) {
  dayEl.createEl("div", { cls: "memochron-note-indicator" });
}
```

Live-settings read consistent with line 636 (`this.plugin.settings.enableCalendarColors`) — Phase 1 D-03 established this pattern.

**Analog (post-create re-render + setCursor):** Existing `showEventDetails` at lines 915-940 — the `isNewNote` branch at line 922 is the gate (D-07 + D-14).

**Existing reference (lines 915-940):**
```typescript
private async showEventDetails(event: CalendarEvent) {
  if (!this.plugin.settings.noteLocation) {
    new Notice("Please set a note location in settings first");
    return;
  }

  let file = this.plugin.noteService.getExistingEventNote(event);
  const isNewNote = !file;

  if (!file) {
    file = await this.plugin.noteService.createEventNote(event);
    if (!file) {
      throw new Error("Failed to create note");
    }
    new Notice(`Created new note: ${file.basename}`);
  } else {
    new Notice(`Opened existing note: ${file.basename}`);
  }

  const leaf = this.app.workspace.getLeaf("tab");
  if (leaf) {
    await leaf.openFile(file);
  } else {
    new Notice("Could not open the note in a new tab");
  }
}
```

**Pattern to copy (D-07 + D-14 + D-15 combined):**
1. Change `createEventNote` return shape to `Promise<{ file: TFile; cursor: { line: number; ch: number } | null }>` (D-12). Update the call site:
   ```typescript
   let file: TFile | null = this.plugin.noteService.getExistingEventNote(event);
   const isNewNote = !file;
   let cursorPos: { line: number; ch: number } | null = null;

   if (!file) {
     const created = await this.plugin.noteService.createEventNote(event);
     file = created.file;
     cursorPos = created.cursor;
     if (!file) throw new Error("Failed to create note");
     new Notice(`Created new note: ${file.basename}`);
   } else {
     new Notice(`Opened existing note: ${file.basename}`);
   }

   const leaf = this.app.workspace.getLeaf("tab");
   if (leaf) {
     await leaf.openFile(file);

     // ENH-06: cursor placement (new-note branch only — D-14)
     if (isNewNote && cursorPos) {
       requestAnimationFrame(() => {
         const view = this.app.workspace.getActiveViewOfType(MarkdownView);
         if (view?.editor) {
           view.editor.setCursor(cursorPos!);
           view.editor.focus();
         }
       });
     }

     // ENH-02 + ENH-03 (D-07): re-render so the new note's icon and grid-dot appear
     if (isNewNote) {
       this.renderCalendar();
       const dateToShow = this.selectedDate || new Date();
       void this.showDayAgenda(dateToShow);
     }
   } else {
     new Notice("Could not open the note in a new tab");
   }
   ```

2. Use `requestAnimationFrame` (NOT `setTimeout`) per D-15 and per CLAUDE.md TODO #6 (PERF-04 explicit). No retry loop on `view?.editor === undefined` — abort silently per D-15.

3. Numeric/local-day Date construction is NOT needed here — the cursor placement uses `(line, ch)` integers, not dates.

**Error handling pattern (existing reference lines 903-913):**
```typescript
eventEl.addEventListener("click", async (e) => {
  e.stopPropagation();
  try {
    await this.showEventDetails(event);
  } catch (error) {
    console.error("Failed to create note:", errorMessage(error));
    new Notice("Failed to create note. Check the console for details.");
  }
});
```
The outer try/catch already wraps `showEventDetails`. The new re-render + setCursor code adds NO new throws — `requestAnimationFrame` callback executes outside the try/catch by design, and the silent-abort on `view?.editor === undefined` is the only failure mode (no exception possible).

---

### `src/views/EmbeddedCalendarView.ts` — pass `hasNote` through

**Analog:** Existing `options` construction at lines 142-147.

**Existing reference (lines 142-147):**
```typescript
const options: RenderOptions = {
  enableColors: this.plugin.settings.enableCalendarColors,
  firstDayOfWeek: this.plugin.settings.firstDayOfWeek,
  showDailyNote: this.plugin.settings.showDailyNoteInAgenda,
  dailyNoteColor: this.plugin.settings.dailyNoteColor,
};
```

**Pattern to copy:** Add two fields:
```typescript
const options: RenderOptions = {
  enableColors: this.plugin.settings.enableCalendarColors,
  firstDayOfWeek: this.plugin.settings.firstDayOfWeek,
  showDailyNote: this.plugin.settings.showDailyNoteInAgenda,
  dailyNoteColor: this.plugin.settings.dailyNoteColor,
  hasNote: (event) => this.plugin.noteService.getExistingEventNote(event) !== null,
  showNoteIndicatorOnGrid: this.plugin.settings.showNoteIndicatorOnGrid,
};
```

No other changes — `renderCalendarGrid` already consumes `options` and passes it to `addEventIndicators`.

---

### `src/views/EmbeddedAgendaView.ts` — icon in renderEventItem

**Analog:** Existing `renderEventItem` at lines 282-341 — particularly the location block at lines 327-334.

**Existing reference (lines 327-334):**
```typescript
// Location
if (event.location) {
  const icon = this.getLocationIcon(event.location);
  eventEl.createEl("div", {
    cls: "memochron-event-location",
    text: `${icon} ${event.location}`,
  });
}
```

**Pattern to copy:** Add `setIcon` to the obsidian import on line 1, then append after the location block (before `addEventListener("click", ...)`):
```typescript
// ENH-02: note-exists indicator (always-on)
if (options.hasNote) {
  const iconEl = eventEl.createEl("div", { cls: "memochron-event-note-indicator" });
  setIcon(iconEl, options.hasNote(event) ? "file-check" : "file-plus");
}
```

Also pass `hasNote` into the options object at line 184 (mirroring the `EmbeddedCalendarView` change):
```typescript
const options: RenderOptions = {
  enableColors: this.plugin.settings.enableCalendarColors,
  timeFormat: this.plugin.settings.noteTimeFormat,
  showDailyNote: ...,
  dailyNoteColor: this.plugin.settings.dailyNoteColor,
  hasNote: (event) => this.plugin.noteService.getExistingEventNote(event) !== null,
};
```

---

### `src/settings/SettingsTab.ts` — new toggle + relabel dropdown

**Analog (toggle):** `showDailyNoteInAgenda` setting at lines 820-841 — toggle + onChange + saveSettings + refresh pattern.

**Existing reference (lines 820-841):**
```typescript
const dailyNoteSetting = new Setting(container)
  .setName("Show daily note in agenda")
  .setDesc("Display the daily note as an entry in the agenda view");

// Add color picker first if calendar colors are enabled
if (this.plugin.settings.enableCalendarColors) {
  const colorContainer = dailyNoteSetting.controlEl.createDiv({
    cls: "memochron-inline-color-picker",
  });
  this.renderDailyNoteColorPicker(colorContainer);
}

// Then add the toggle
dailyNoteSetting.addToggle((toggle) =>
  toggle
    .setValue(this.plugin.settings.showDailyNoteInAgenda)
    .onChange(async (value) => {
      this.plugin.settings.showDailyNoteInAgenda = value;
      await this.plugin.saveSettings();
      await this.plugin.refreshCalendarView();
    })
);
```

**Pattern to copy** (place in the same calendar-display section, near `showDailyNoteInAgenda`):
```typescript
new Setting(container)
  .setName("Show note indicator on calendar grid")
  .setDesc("Mark days that contain at least one event with a note")
  .addToggle((toggle) =>
    toggle
      .setValue(this.plugin.settings.showNoteIndicatorOnGrid)
      .onChange(async (value) => {
        this.plugin.settings.showNoteIndicatorOnGrid = value;
        await this.plugin.saveSettings();
        await this.plugin.refreshCalendarView();
      })
  );
```

`refreshCalendarView()` already calls `renderCalendar()` and `showDayAgenda()` per `CalendarView.ts:101-118` — settles the grid indicator immediately.

**Analog (UK dropdown relabel):** Existing `renderNoteDateFormat` at lines 937-962 and per-calendar mirror at lines 1585-1611.

**Existing reference (lines 937-941, mirrored at 1585-1589):**
```typescript
const dateFormats = [
  { value: "ISO", label: "ISO (YYYY-MM-DD)" },
  { value: "US", label: "US (MM-DD-YYYY)" },
  { value: "UK", label: "UK (DD-MM-YYYY)" },
  { value: "Long", label: "Long (Month DD, YYYY)" },
];
```

**Pattern to copy (D-08):** Relabel the `"UK"` entry in BOTH arrays (lines 941 + 1588). **Persisted `value: "UK"` MUST remain unchanged** — the formatter at `NoteService.ts:340-347` keys on `"UK"`, and existing user settings depend on this string. Only the label changes:
```typescript
{ value: "UK", label: "UK/EU (DD-MM-YYYY)" },
```

No migration logic; no `versions.json` change; no new value enum.

**Help text update (ENH-05):** The dropdown for `noteTitleFormat` at line 922-925 currently lists variables. The `.setDesc(...)` string needs `{{day}}, {{month}}` added to the variable list. Same edit potentially applies to per-calendar mirror. For `noteTemplate` (textarea) the help text is in a separate location — planner identifies whether `noteTemplate` has its own help-text Setting to update (no exact line reference provided in CONTEXT; planner picks).

---

### `src/services/NoteService.ts` — day/month variables + {{cursor}} helper

**Analog (EventTemplateVariables extension):** Lines 7-27.

**Existing reference (lines 7-27):**
```typescript
interface EventTemplateVariables {
  event_title: string;
  date: string;
  "date-iso": string;
  start_date: string;
  "start_date-iso": string;
  end_date: string;
  "end_date-iso": string;
  start_time: string;
  end_time: string;
  source: string;
  location: string;
  locationText: string;
  description: string;
  attendees: string;
  attendees_list: string;
  attendees_links: string;
  attendees_links_list: string;
  attendees_links_yaml: string;
  attendees_count: string;
}
```

**Pattern to copy (D-10):** Add two fields:
```typescript
interface EventTemplateVariables {
  ...
  day: string;     // "Monday" — toLocaleDateString("en-US", { weekday: "long" })
  month: string;   // "January" — toLocaleDateString("en-US", { month: "long" })
  ...
}
```

**Analog (population in getEventTemplateVariables):** Lines 218-252.

**Existing reference (lines 218-252):**
```typescript
private getEventTemplateVariables(event: CalendarEvent): EventTemplateVariables {
  const dateStr = this.formatDate(event.start, event.source);
  ...
  return {
    event_title: event.title,
    date: dateStr,
    ...
    attendees_count: attendeesList.length.toString(),
  };
}
```

**Pattern to copy (D-09 + D-11):**
```typescript
return {
  event_title: event.title,
  date: dateStr,
  ...
  day: event.start.toLocaleDateString("en-US", { weekday: "long" }),
  month: event.start.toLocaleDateString("en-US", { month: "long" }),
  attendees_count: attendeesList.length.toString(),
};
```

Hard-coded `"en-US"` matches ROADMAP success criterion #5 and D-09. No fallback to system locale (would break the "correct English" guarantee). Note: the parallel `FolderTemplateVariables.DDDD`/`MMMM` at lines 462-471 use static arrays — for `EventTemplateVariables` the inline `toLocaleDateString` is simpler and avoids duplication (`formatDate` at lines 323-358 already uses the same API).

**Filename safety:** Values `"Monday"`/`"January"` contain only `[A-Za-z]`. The existing `sanitizeFileName` at line 507 (`replace(/[\\/:*?"<>|]/g, "-")`) is a no-op on these strings — D-10 explicitly notes no extra sanitization needed.

---

### `src/services/NoteService.ts` — `{{cursor}}` marker handling

**Analog (template substitution flow):** `generateNoteContent` at lines 155-174 + `applyTemplateVariables` at 254-272.

**Existing reference (lines 155-174):**
```typescript
private generateNoteContent(event: CalendarEvent): string {
  try {
    const variables = this.getEventTemplateVariables(event);
    const frontmatter = this.generateFrontmatter(event, variables);
    const calendarSettings = this.getCalendarNotesSettings(event.source);
    const noteTemplate =
      calendarSettings.noteTemplate ?? this.settings.noteTemplate;
    const content = this.applyTemplateVariables(noteTemplate, variables);

    return `${frontmatter}\n${content}`;
  } catch (error) {
    console.error("Error generating note content:", errorMessage(error));
    // Fallback to basic content
    return `# ${event.title}\n\n...`;
  }
}
```

**Existing reference (createEventNote, lines 62-79):**
```typescript
async createEventNote(event: CalendarEvent): Promise<TFile> {
  const filePath = this.buildFilePath(event);

  try {
    await this.ensureParentFolder(filePath);

    const existingFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (existingFile instanceof TFile) {
      return existingFile;
    }

    const content = this.generateNoteContent(event);
    return await this.plugin.app.vault.create(filePath, content);
  } catch (error) {
    console.error("Error creating note:", errorMessage(error));
    throw error;
  }
}
```

**Pattern to copy (D-12 + D-13 + safe-marker contract):**

1. Change `generateNoteContent` return shape to `{ content: string; cursor: { line: number; ch: number } | null }`. Or — cleaner — extract the marker-handling into a sibling private helper `extractCursorMarker(content: string, frontmatter: string): { content: string; cursor: ... }` and let `generateNoteContent` itself stay focused on substitution. (Planner picks — D-12's text "or a sibling helper called by it" green-lights either.)

2. Change `createEventNote` return shape to `Promise<{ file: TFile; cursor: { line: number; ch: number } | null }>`:
```typescript
async createEventNote(event: CalendarEvent): Promise<{ file: TFile; cursor: { line: number; ch: number } | null }> {
  const filePath = this.buildFilePath(event);
  try {
    await this.ensureParentFolder(filePath);

    const existingFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (existingFile instanceof TFile) {
      return { file: existingFile, cursor: null };  // existing — no marker honoring (D-14)
    }

    const { content, cursor } = this.generateNoteContent(event);  // new return shape
    const file = await this.plugin.app.vault.create(filePath, content);
    return { file, cursor };
  } catch (error) {
    console.error("Error creating note:", errorMessage(error));
    throw error;
  }
}
```

3. Marker extraction helper (D-13):
```typescript
/**
 * Locate the first {{cursor}} marker AFTER the frontmatter closing `---`,
 * record its (line, ch) position in the post-strip content, and remove
 * EVERY occurrence of the marker from the returned content.
 *
 * Per D-13: if no marker exists after the frontmatter, returns cursor=null
 * (editor opens at default position; do NOT auto-position to end of file).
 * Per D-12: strip-all happens unconditionally — frontmatter `{{cursor}}`
 * occurrences also removed; success criterion #6 ("marker text does not
 * appear in saved note") satisfied even if cursor placement fails.
 */
private extractCursorMarker(
  fullContent: string
): { content: string; cursor: { line: number; ch: number } | null } {
  const MARKER = "{{cursor}}";
  // Find the second --- line (closing frontmatter delimiter).
  const lines = fullContent.split("\n");
  let bodyStart = 0; // line index where body begins (after closing ---)
  let delimitersSeen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === NoteService.FRONTMATTER_DELIMITER) {
      delimitersSeen++;
      if (delimitersSeen === 2) {
        bodyStart = i + 1;
        break;
      }
    }
  }

  // Search for first marker in body lines; record (line, ch) BEFORE strip.
  let cursor: { line: number; ch: number } | null = null;
  for (let i = bodyStart; i < lines.length; i++) {
    const ch = lines[i].indexOf(MARKER);
    if (ch !== -1) {
      cursor = { line: i, ch };
      break;
    }
  }

  // Strip ALL occurrences from ALL lines (including frontmatter — D-12).
  const stripped = fullContent.split(MARKER).join("");
  return { content: stripped, cursor };
}
```

Important: the recorded `(line, ch)` position is from BEFORE the strip pass, so the marker's removed characters do not shift the cursor target. Because the marker is removed in-place at index `ch`, that same `ch` value points to the character immediately after the original marker — exactly where the user wants the cursor.

4. Updated `generateNoteContent` (or wrap it):
```typescript
private generateNoteContent(event: CalendarEvent): { content: string; cursor: { line: number; ch: number } | null } {
  try {
    const variables = this.getEventTemplateVariables(event);
    const frontmatter = this.generateFrontmatter(event, variables);
    const calendarSettings = this.getCalendarNotesSettings(event.source);
    const noteTemplate =
      calendarSettings.noteTemplate ?? this.settings.noteTemplate;
    const body = this.applyTemplateVariables(noteTemplate, variables);
    const combined = `${frontmatter}\n${body}`;
    return this.extractCursorMarker(combined);
  } catch (error) {
    console.error("Error generating note content:", errorMessage(error));
    return {
      content: `# ${event.title}\n\n**Date:** ${event.start.toLocaleDateString()}\n**Source:** ${event.source}\n\n${event.description || ""}`,
      cursor: null,
    };
  }
}
```

**Error handling pattern** — same `errorMessage(error)` from `src/utils/errors.ts` already used in this file (lines 76, 128, 166, 269, 291, 417). No new error helper needed.

---

## Shared Patterns

### setIcon + lucide naming (ENH-02)
**Source:** `src/views/CalendarView.ts:1` (import) and lines 235, 291 (usage).
**Apply to:** `src/utils/viewRenderers.ts`, `src/views/EmbeddedAgendaView.ts`, `src/views/CalendarView.ts` (new `renderEventNoteIndicator`).
**Pattern:**
```typescript
import { setIcon } from "obsidian";
// ...
setIcon(buttonOrIconEl, "lucide-icon-name");
```
Lucide names `file-check` and `file-plus` are named verbatim by ROADMAP success criterion #2 — do NOT substitute different icon names.

### Live-settings reads (Phase 1 D-03)
**Source:** Throughout views — e.g. `CalendarView.ts:636` (`this.plugin.settings.enableCalendarColors`), `viewRenderers.ts` via `options` passed fresh per render.
**Apply to:** All new ENH-02/ENH-03 read sites — `this.plugin.settings.showNoteIndicatorOnGrid` is read on every `renderCalendar()`, never cached in a field.

### CSS-var theming
**Source:** `styles.css:146-164` uses `var(--interactive-accent)` and `var(--text-on-accent)`.
**Apply to:** New `.memochron-day.today` box-shadow rule (ENH-01) and `.memochron-note-indicator` background (ENH-03). Do not introduce hex literals or new color settings (D-03).

### Toggle + saveSettings + refreshCalendarView pattern
**Source:** `src/settings/SettingsTab.ts:127-138` (showWeekNumbers), `:820-841` (showDailyNoteInAgenda).
**Apply to:** New `showNoteIndicatorOnGrid` toggle.
**Pattern:**
```typescript
new Setting(container)
  .setName("…")
  .setDesc("…")
  .addToggle((toggle) =>
    toggle
      .setValue(this.plugin.settings.FIELD)
      .onChange(async (value) => {
        this.plugin.settings.FIELD = value;
        await this.plugin.saveSettings();
        await this.plugin.refreshCalendarView();
      })
  );
```

### errorMessage(err) in catch blocks
**Source:** `src/utils/errors.ts:8-10`.
**Apply to:** Any new try/catch in NoteService or CalendarView additions. Already in use at `NoteService.ts:76,128,166,269,291,417` and `CalendarView.ts:344,820,909`.

### Numeric local-day Date construction (Phase 3 D-01/D-02)
**Source:** `viewRenderers.ts:439-455` (parseLocalDate).
**Apply to:** NOT needed in this phase — Phase 4 does not touch date-string parsing paths. Cursor positions are integer (line, ch), and template `{{day}}/{{month}}` use `toLocaleDateString` on an already-existing `Date` object (`event.start`), not from a string.

### Per-surface duplication (code_context "Established Patterns")
**Source:** `CalendarView.ts:596-694` (sidebar `renderDay`/`addDayEventIndicator`) vs `viewRenderers.ts:236-317` (`createDayElement`/`addEventIndicators`).
**Apply to:** ENH-02 + ENH-03 require touching BOTH locations. Embedded views go through `viewRenderers.ts`; sidebar goes through its own private methods. Diff review during planning per code_context.

---

## No Analog Found

None. Every Phase 4 file modification has a clean in-repo analog (verified by reading all referenced files).

---

## Metadata

**Analog search scope:**
- `src/utils/viewRenderers.ts` (full file, 521 lines — single read)
- `src/services/NoteService.ts` (full file, 555 lines — single read)
- `src/views/CalendarView.ts` (lines 1-80, 200-350, 580-940 — non-overlapping targeted reads)
- `src/views/EmbeddedCalendarView.ts` (full file, 289 lines — single read)
- `src/views/EmbeddedAgendaView.ts` (lines 1-220, 220-380 — non-overlapping targeted reads)
- `src/settings/types.ts` (full file, 97 lines — single read)
- `src/settings/SettingsTab.ts` (lines 120-170, 820-880, 920-990, 1570-1620 — targeted reads)
- `src/utils/errors.ts` (full file, 10 lines)
- `styles.css` (lines 130-220 — targeted read)

**Files scanned:** 9 source files.

**Pattern extraction date:** 2026-05-12
