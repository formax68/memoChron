# Settings Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign MemoChron settings page with collapsible sections, collapsed calendar items, and logical grouping matching Obsidian's native style.

**Architecture:** Refactor SettingsTab.ts to use a reusable collapsible section pattern. Calendar items become expandable rows. Settings reorganized into three sections: Calendars (with display settings), Notes, and Advanced.

**Tech Stack:** TypeScript, Obsidian API (Setting, PluginSettingTab), CSS

---

## Task 1: Add Collapsible Section CSS

**Files:**
- Modify: `styles.css` (append to end)

**Step 1: Add collapsible section styles**

Add to end of `styles.css`:

```css
/* Collapsible Settings Sections */
.memochron-collapsible-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: var(--size-4-2) 0;
  border-left: 3px solid var(--interactive-accent);
  padding-left: var(--size-4-3);
  margin-left: calc(-1 * var(--size-4-3));
  transition: background-color 0.15s ease;
}

.memochron-collapsible-header:hover {
  background-color: var(--background-modifier-hover);
}

.memochron-collapsible-header .setting-item-name {
  flex: 1;
}

.memochron-collapsible-chevron {
  color: var(--text-muted);
  font-size: 0.8em;
  margin-right: var(--size-4-2);
  transition: transform 0.2s ease;
}

.memochron-collapsible-chevron.collapsed {
  transform: rotate(-90deg);
}

.memochron-collapsible-content {
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.2s ease;
}

.memochron-collapsible-content.collapsed {
  max-height: 0;
  opacity: 0;
}

.memochron-collapsible-content.expanded {
  max-height: none;
  opacity: 1;
}

/* Sub-group labels */
.memochron-subgroup-label {
  font-size: 0.85em;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: var(--size-4-4);
  margin-bottom: var(--size-4-2);
  padding-bottom: var(--size-4-1);
  border-bottom: 1px solid var(--background-modifier-border);
}

.memochron-subgroup-label:first-child {
  margin-top: 0;
}

/* Section separator */
.memochron-section-separator {
  border: none;
  border-top: 1px solid var(--background-modifier-border);
  margin: var(--size-4-4) 0;
}
```

**Step 2: Verify CSS is valid**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add styles.css
git commit -m "Add collapsible section CSS styles"
```

---

## Task 2: Add Collapsible Calendar Item CSS

**Files:**
- Modify: `styles.css` (append after Task 1 additions)

**Step 1: Add calendar item collapse styles**

Append to `styles.css`:

```css
/* Collapsible Calendar Items */
.memochron-calendar-item {
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  margin-bottom: var(--size-4-2);
  overflow: hidden;
}

.memochron-calendar-item.disabled {
  opacity: 0.6;
}

.memochron-calendar-header {
  display: flex;
  align-items: center;
  padding: var(--size-4-2) var(--size-4-3);
  cursor: pointer;
  background: var(--background-secondary);
  gap: var(--size-4-2);
  transition: background-color 0.15s ease;
}

.memochron-calendar-header:hover {
  background: var(--background-modifier-hover);
}

.memochron-calendar-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.memochron-calendar-name {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.memochron-calendar-header .checkbox-container {
  flex-shrink: 0;
}

.memochron-calendar-header .memochron-collapsible-chevron {
  margin-right: 0;
}

.memochron-calendar-details {
  padding: var(--size-4-3);
  background: var(--background-primary);
  border-top: 1px solid var(--background-modifier-border);
}

.memochron-calendar-details.collapsed {
  display: none;
}

.memochron-calendar-details .setting-item {
  border: none;
  padding: var(--size-4-2) 0;
}

.memochron-calendar-details .setting-item:last-child {
  padding-bottom: 0;
}

/* Visibility toggles row */
.memochron-visibility-row {
  display: flex;
  gap: var(--size-4-4);
  align-items: center;
  flex-wrap: wrap;
}

.memochron-visibility-row label {
  display: flex;
  align-items: center;
  gap: var(--size-4-1);
  font-size: 0.9em;
  cursor: pointer;
}

/* Remove button styling */
.memochron-remove-btn {
  color: var(--text-muted);
  margin-top: var(--size-4-2);
}

.memochron-remove-btn:hover {
  color: var(--text-error);
}
```

**Step 2: Verify CSS is valid**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add styles.css
git commit -m "Add collapsible calendar item CSS styles"
```

---

## Task 3: Add Compact Checkbox List CSS

**Files:**
- Modify: `styles.css` (append after Task 2 additions)

**Step 1: Add checkbox list styles for CUTYPE filtering**

Append to `styles.css`:

```css
/* Compact checkbox list for Advanced section */
.memochron-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: var(--size-4-1);
  margin-top: var(--size-4-2);
}

.memochron-checkbox-item {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
  padding: var(--size-4-1) 0;
}

.memochron-checkbox-item label {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
  cursor: pointer;
  font-size: 0.9em;
}

.memochron-checkbox-item .checkbox-label-main {
  color: var(--text-normal);
}

.memochron-checkbox-item .checkbox-label-desc {
  color: var(--text-muted);
  font-size: 0.85em;
}

/* Remove old calendar list box styling */
.memochron-calendar-list {
  border: none;
  padding: 0;
  margin: var(--size-4-3) 0;
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add styles.css
git commit -m "Add compact checkbox list CSS and remove old calendar list box"
```

---

## Task 4: Create Collapsible Section Helper

**Files:**
- Modify: `src/settings/SettingsTab.ts`

**Step 1: Add collapsed state tracking and helper method**

Add after the class declaration (around line 18), add a private property:

```typescript
export class SettingsTab extends PluginSettingTab {
  private collapsedSections: Map<string, boolean> = new Map();
  private collapsedCalendars: Map<number, boolean> = new Map();

  constructor(app: App, private plugin: MemoChron) {
```

**Step 2: Add the renderCollapsibleSection helper method**

Add after the `display()` method (after line 30):

```typescript
  private renderCollapsibleSection(
    name: string,
    renderContent: (container: HTMLElement) => void,
    defaultCollapsed: boolean = false
  ): void {
    const isCollapsed = this.collapsedSections.get(name) ?? defaultCollapsed;

    // Header
    const headerEl = this.containerEl.createDiv({
      cls: "memochron-collapsible-header",
    });

    const chevron = headerEl.createSpan({
      cls: `memochron-collapsible-chevron ${isCollapsed ? "collapsed" : ""}`,
      text: "▼",
    });

    headerEl.createSpan({
      cls: "setting-item-name",
      text: name,
    });

    // Content container
    const contentEl = this.containerEl.createDiv({
      cls: `memochron-collapsible-content ${isCollapsed ? "collapsed" : "expanded"}`,
    });

    // Render the section content
    renderContent(contentEl);

    // Toggle handler
    headerEl.addEventListener("click", () => {
      const nowCollapsed = !this.collapsedSections.get(name) ?? !defaultCollapsed;
      this.collapsedSections.set(name, nowCollapsed);

      chevron.classList.toggle("collapsed", nowCollapsed);
      contentEl.classList.toggle("collapsed", nowCollapsed);
      contentEl.classList.toggle("expanded", !nowCollapsed);
    });
  }
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds (helper not yet used)

**Step 4: Commit**

```bash
git add src/settings/SettingsTab.ts
git commit -m "Add collapsible section helper method"
```

---

## Task 5: Add Sub-group Label Helper

**Files:**
- Modify: `src/settings/SettingsTab.ts`

**Step 1: Add helper for sub-group labels**

Add after `renderCollapsibleSection`:

```typescript
  private renderSubgroupLabel(container: HTMLElement, label: string): void {
    container.createDiv({
      cls: "memochron-subgroup-label",
      text: label,
    });
  }

  private renderSeparator(container: HTMLElement): void {
    container.createEl("hr", { cls: "memochron-section-separator" });
  }
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/settings/SettingsTab.ts
git commit -m "Add sub-group label and separator helpers"
```

---

## Task 6: Refactor display() to Use New Structure

**Files:**
- Modify: `src/settings/SettingsTab.ts`

**Step 1: Replace the display() method**

Replace the existing `display()` method (lines 22-30) with:

```typescript
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderCollapsibleSection("Calendars", (container) => {
      this.renderCalendarsSection(container);
    }, false);

    this.renderCollapsibleSection("Notes", (container) => {
      this.renderNotesSection(container);
    }, false);

    this.renderCollapsibleSection("Advanced", (container) => {
      this.renderAdvancedSection(container);
    }, true);
  }
```

**Step 2: Verify build fails**

Run: `npm run build`
Expected: Build fails - `renderCalendarsSection` and `renderAdvancedSection` don't exist yet

**Step 3: Add stub methods to make it compile**

Add temporary stubs:

```typescript
  private renderCalendarsSection(container: HTMLElement): void {
    // TODO: Implement in next task
    new Setting(container).setName("Coming soon...");
  }

  private renderAdvancedSection(container: HTMLElement): void {
    // TODO: Implement in later task
    new Setting(container).setName("Coming soon...");
  }
```

**Step 4: Update renderNotesSection signature**

Find `private renderNotesSection(): void {` and change to:

```typescript
  private renderNotesSection(container: HTMLElement): void {
```

Then update all `this.containerEl` references inside it to use `container` instead.

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/settings/SettingsTab.ts
git commit -m "Refactor display() to use collapsible sections"
```

---

## Task 7: Implement Calendars Section - Display Settings

**Files:**
- Modify: `src/settings/SettingsTab.ts`

**Step 1: Replace renderCalendarsSection stub**

Replace the stub with:

```typescript
  private renderCalendarsSection(container: HTMLElement): void {
    // Display sub-group
    this.renderSubgroupLabel(container, "Display");

    // First day of week
    const weekdays = [
      { value: "0", label: "Sunday" },
      { value: "1", label: "Monday" },
      { value: "2", label: "Tuesday" },
      { value: "3", label: "Wednesday" },
      { value: "4", label: "Thursday" },
      { value: "5", label: "Friday" },
      { value: "6", label: "Saturday" },
    ];

    new Setting(container)
      .setName("First day of week")
      .setDesc("Which day the calendar week starts on")
      .addDropdown((dropdown) => {
        weekdays.forEach(({ value, label }) => {
          dropdown.addOption(value, label);
        });
        dropdown
          .setValue(String(this.plugin.settings.firstDayOfWeek))
          .onChange(async (value) => {
            this.plugin.settings.firstDayOfWeek = parseInt(value);
            await this.plugin.saveSettings();
            await this.plugin.refreshCalendarView();
          });
      });

    new Setting(container)
      .setName("Hide calendar grid")
      .setDesc("Show only the agenda view without the month calendar")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hideCalendar)
          .onChange(async (value) => {
            this.plugin.settings.hideCalendar = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshCalendarView();
          })
      );

    new Setting(container)
      .setName("Enable calendar colors")
      .setDesc("Color-code calendars for easy identification")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCalendarColors)
          .onChange(async (value) => {
            this.plugin.settings.enableCalendarColors = value;
            if (value) {
              this.plugin.settings.calendarUrls.forEach((source, index) => {
                if (!source.color) {
                  const hue = (index * 137.5) % 360;
                  source.color = `hsl(${hue}, 70%, 50%)`;
                }
              });
              if (!this.plugin.settings.dailyNoteColor) {
                this.plugin.settings.dailyNoteColor =
                  getComputedStyle(document.documentElement)
                    .getPropertyValue("--interactive-accent")
                    .trim() || "#7c3aed";
              }
            }
            await this.plugin.saveSettings();
            this.plugin.updateCalendarColors();
            this.display();
          })
      );

    // Separator before calendar list
    this.renderSeparator(container);

    // Calendar list section
    this.renderCalendarList(container);
  }
```

**Step 2: Add renderCalendarList stub**

```typescript
  private renderCalendarList(container: HTMLElement): void {
    // Add calendar button
    new Setting(container)
      .addButton((btn) =>
        btn
          .setButtonText("Add calendar")
          .setCta()
          .onClick(() => this.addNewCalendar())
      );

    // Calendar items container
    const listContainer = container.createDiv({
      cls: "memochron-calendar-list",
    });

    this.plugin.settings.calendarUrls.forEach((source, index) => {
      this.renderCalendarItem(listContainer, source, index);
    });
  }

  private renderCalendarItem(
    container: HTMLElement,
    source: CalendarSource,
    index: number
  ): void {
    // TODO: Implement collapsible calendar item in next task
    new Setting(container).setName(source.name);
  }
```

**Step 3: Remove old methods**

Delete these methods (they're replaced by the new structure):
- `renderCalendarSection` (the old one)
- `renderGeneralSection`
- `renderFirstDayOfWeek`
- `renderHideCalendar`
- `renderEnableCalendarColors`

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/settings/SettingsTab.ts
git commit -m "Implement Calendars section with display settings"
```

---

## Task 8: Implement Collapsible Calendar Items

**Files:**
- Modify: `src/settings/SettingsTab.ts`

**Step 1: Replace renderCalendarItem with full implementation**

Replace the stub with:

```typescript
  private renderCalendarItem(
    container: HTMLElement,
    source: CalendarSource,
    index: number
  ): void {
    const isCollapsed = this.collapsedCalendars.get(index) ?? true;

    const itemEl = container.createDiv({
      cls: `memochron-calendar-item ${source.enabled ? "" : "disabled"}`,
    });

    // Header row (always visible)
    const headerEl = itemEl.createDiv({ cls: "memochron-calendar-header" });

    // Color dot (if colors enabled)
    if (this.plugin.settings.enableCalendarColors && source.color) {
      const colorDot = headerEl.createDiv({ cls: "memochron-calendar-color-dot" });
      colorDot.style.backgroundColor = source.color;
    }

    // Calendar name
    headerEl.createSpan({
      cls: "memochron-calendar-name",
      text: source.name || "Unnamed calendar",
    });

    // Enabled toggle (stop propagation to prevent collapse toggle)
    const toggleContainer = headerEl.createDiv();
    const toggleEl = toggleContainer.createEl("input", { type: "checkbox" });
    toggleEl.checked = source.enabled;
    toggleEl.classList.add("checkbox-container");
    toggleEl.addEventListener("click", (e) => e.stopPropagation());
    toggleEl.addEventListener("change", async () => {
      this.plugin.settings.calendarUrls[index].enabled = toggleEl.checked;
      await this.plugin.saveSettings();
      await this.plugin.refreshCalendarView();
      itemEl.classList.toggle("disabled", !toggleEl.checked);
    });

    // Chevron
    const chevron = headerEl.createSpan({
      cls: `memochron-collapsible-chevron ${isCollapsed ? "collapsed" : ""}`,
      text: "▼",
    });

    // Details section (collapsible)
    const detailsEl = itemEl.createDiv({
      cls: `memochron-calendar-details ${isCollapsed ? "collapsed" : ""}`,
    });

    this.renderCalendarDetails(detailsEl, source, index);

    // Header click toggles collapse
    headerEl.addEventListener("click", () => {
      const nowCollapsed = !this.collapsedCalendars.get(index) ?? false;
      this.collapsedCalendars.set(index, nowCollapsed);
      chevron.classList.toggle("collapsed", nowCollapsed);
      detailsEl.classList.toggle("collapsed", nowCollapsed);
    });
  }
```

**Step 2: Add renderCalendarDetails method**

```typescript
  private renderCalendarDetails(
    container: HTMLElement,
    source: CalendarSource,
    index: number
  ): void {
    // URL input
    new Setting(container)
      .setName("URL or file path")
      .addText((text) =>
        text
          .setPlaceholder("https://... or path/to/file.ics")
          .setValue(source.url)
          .onChange(async (value) => {
            this.plugin.settings.calendarUrls[index].url = value;
            await this.plugin.saveSettings();
          })
      )
      .addButton((btn) =>
        btn
          .setIcon("folder-open")
          .setTooltip("Choose ICS file from vault")
          .onClick(async () => {
            const files = this.app.vault
              .getFiles()
              .filter((f) => f.extension === "ics");
            if (files.length === 0) {
              new Notice("No ICS files found in vault");
              return;
            }
            const modal = new FilePickerModal(this.app, files, async (file) => {
              this.plugin.settings.calendarUrls[index].url = file.path;
              await this.plugin.saveSettings();
              this.display();
            });
            modal.open();
          })
      );

    // Name input
    new Setting(container)
      .setName("Display name")
      .addText((text) =>
        text
          .setPlaceholder("Calendar name")
          .setValue(source.name)
          .onChange(async (value) => {
            this.plugin.settings.calendarUrls[index].name = value;
            await this.plugin.saveSettings();
          })
      );

    // Tags input
    new Setting(container)
      .setName("Tags")
      .setDesc("Comma-separated tags for event notes")
      .addText((text) =>
        text
          .setPlaceholder("work, meetings")
          .setValue(source.tags?.join(", ") || "")
          .onChange(async (value) => {
            this.plugin.settings.calendarUrls[index].tags = this.parseTags(value);
            await this.plugin.saveSettings();
          })
      );

    // Visibility toggles
    if (source.enabled) {
      const visibilitySetting = new Setting(container).setName("Visibility");

      const visibilityRow = visibilitySetting.controlEl.createDiv({
        cls: "memochron-visibility-row",
      });

      // Sidebar toggle
      const sidebarLabel = visibilityRow.createEl("label");
      const sidebarCheck = sidebarLabel.createEl("input", { type: "checkbox" });
      sidebarCheck.checked = source.showInWidget !== false;
      sidebarLabel.createSpan({ text: " Show in sidebar" });
      sidebarCheck.addEventListener("change", async () => {
        this.plugin.settings.calendarUrls[index].showInWidget = sidebarCheck.checked;
        await this.plugin.saveSettings();
        await this.plugin.refreshCalendarView();
      });

      // Embeds toggle
      const embedsLabel = visibilityRow.createEl("label");
      const embedsCheck = embedsLabel.createEl("input", { type: "checkbox" });
      embedsCheck.checked = source.showInEmbeds !== false;
      embedsLabel.createSpan({ text: " Show in embeds" });
      embedsCheck.addEventListener("change", async () => {
        this.plugin.settings.calendarUrls[index].showInEmbeds = embedsCheck.checked;
        await this.plugin.saveSettings();
      });
    }

    // Color picker (if colors enabled)
    if (this.plugin.settings.enableCalendarColors) {
      const colorSetting = new Setting(container).setName("Color");
      const colorContainer = colorSetting.controlEl.createDiv({
        cls: "memochron-inline-color-picker",
      });
      this.renderInlineColorPicker(colorContainer, source, index);
    }

    // Notes settings
    const hasCustomSettings = source.notesSettings?.useCustomSettings || false;
    new Setting(container)
      .setName("Note settings")
      .setDesc(hasCustomSettings ? "Using custom settings" : "Using defaults")
      .addDropdown((dropdown) => {
        dropdown.addOption("default", "Use defaults");
        dropdown.addOption("custom", "Custom...");
        dropdown
          .setValue(hasCustomSettings ? "custom" : "default")
          .onChange(async (value) => {
            if (value === "custom") {
              const modal = new CalendarNotesSettingsModal(
                this.app,
                this.plugin,
                source,
                index,
                () => this.display()
              );
              modal.open();
            } else {
              if (source.notesSettings) {
                source.notesSettings.useCustomSettings = false;
              }
              await this.plugin.saveSettings();
              this.display();
            }
          });
      });

    // Remove button
    new Setting(container)
      .addButton((btn) =>
        btn
          .setButtonText("Remove calendar")
          .setClass("memochron-remove-btn")
          .onClick(async () => {
            this.plugin.settings.calendarUrls.splice(index, 1);
            await this.plugin.saveSettings();
            await this.plugin.refreshCalendarView();
            this.display();
          })
      );
  }
```

**Step 3: Update addNewCalendar to expand new items**

Find the `addNewCalendar` method and update it to mark new calendars as expanded:

```typescript
  private async addNewCalendar(): Promise<void> {
    const newCalendar: CalendarSource = {
      url: "",
      name: "New calendar",
      enabled: true,
      tags: [],
    };

    if (this.plugin.settings.enableCalendarColors) {
      newCalendar.color = this.getNextAvailableColor();
    }

    this.plugin.settings.calendarUrls.push(newCalendar);

    // Mark the new calendar as expanded
    const newIndex = this.plugin.settings.calendarUrls.length - 1;
    this.collapsedCalendars.set(newIndex, false);

    await this.plugin.saveSettings();
    this.display();
  }
```

**Step 4: Remove old renderCalendarSource method**

Delete the old `renderCalendarSource` method and related setup methods:
- `renderCalendarSource`
- `setupUrlInput`
- `setupNameInput`
- `setupTagsInput`
- `setupEnabledToggle`
- `setupRemoveButton`
- `setupFilePickerButton`
- `renderCalendarNotesSettings`

Keep these methods (still needed):
- `renderInlineColorPicker`
- `getObsidianBaseColors`
- `colorToHex`
- `getNextAvailableColor`
- `parseTags`

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/settings/SettingsTab.ts
git commit -m "Implement collapsible calendar items"
```

---

## Task 9: Refactor Notes Section with Sub-groups

**Files:**
- Modify: `src/settings/SettingsTab.ts`

**Step 1: Rewrite renderNotesSection**

Replace the existing `renderNotesSection` method with:

```typescript
  private renderNotesSection(container: HTMLElement): void {
    // Location sub-group
    this.renderSubgroupLabel(container, "Location");
    this.renderNoteLocation(container);
    this.renderFolderPathTemplate(container);

    // Naming sub-group
    this.renderSubgroupLabel(container, "Naming");
    this.renderNoteTitleFormat(container);
    this.renderNoteDateFormat(container);
    this.renderNoteTimeFormat(container);

    // Content sub-group
    this.renderSubgroupLabel(container, "Content");
    this.renderDefaultFrontmatter(container);
    this.renderNoteTemplate(container);
    this.renderDefaultTags(container);

    // Daily Notes sub-group
    this.renderSubgroupLabel(container, "Daily Notes");
    this.renderShowDailyNoteInAgenda(container);

    // Attendees sub-group
    this.renderSubgroupLabel(container, "Attendees");
    this.renderAttendeeSettings(container);

    // Link to Advanced for filtering
    new Setting(container)
      .setDesc("Configure attendee type filtering in the Advanced section below.");
  }
```

**Step 2: Update all render methods to accept container parameter**

Update each of these methods to take a `container: HTMLElement` parameter and use it instead of `this.containerEl`:

- `renderNoteLocation(container: HTMLElement)`
- `renderFolderPathTemplate(container: HTMLElement)`
- `renderNoteTitleFormat(container: HTMLElement)`
- `renderNoteDateFormat(container: HTMLElement)`
- `renderNoteTimeFormat(container: HTMLElement)`
- `renderDefaultFrontmatter(container: HTMLElement)`
- `renderNoteTemplate(container: HTMLElement)`
- `renderDefaultTags(container: HTMLElement)`
- `renderShowDailyNoteInAgenda(container: HTMLElement)`
- `renderAttendeeSettings(container: HTMLElement)`

For each method, change:
- `new Setting(this.containerEl)` → `new Setting(container)`
- `this.containerEl.createEl(...)` → `container.createEl(...)`
- `this.containerEl.createDiv(...)` → `container.createDiv(...)`

**Step 3: Remove renderDailyNotesSection**

Delete the old `renderDailyNotesSection` method (its content moved to Notes section).

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/settings/SettingsTab.ts
git commit -m "Refactor Notes section with sub-groups"
```

---

## Task 10: Implement Advanced Section

**Files:**
- Modify: `src/settings/SettingsTab.ts`

**Step 1: Replace renderAdvancedSection stub**

```typescript
  private renderAdvancedSection(container: HTMLElement): void {
    // Performance sub-group
    this.renderSubgroupLabel(container, "Performance");
    this.renderRefreshInterval(container);

    // Attendee Filtering sub-group
    this.renderSubgroupLabel(container, "Attendee Filtering");
    this.renderAttendeeFiltering(container);
  }
```

**Step 2: Update renderRefreshInterval to accept container**

```typescript
  private renderRefreshInterval(container: HTMLElement): void {
    new Setting(container)
      .setName("Refresh interval")
      .setDesc("Minutes between calendar data refreshes")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.refreshInterval))
          .onChange(async (value) => {
            const interval = parseInt(value);
            if (!isNaN(interval) && interval > 0) {
              this.plugin.settings.refreshInterval = interval;
              await this.plugin.saveSettings();
            }
          })
      );
  }
```

**Step 3: Rewrite renderAttendeeFiltering with compact checkboxes**

```typescript
  private renderAttendeeFiltering(container: HTMLElement): void {
    container.createEl("p", {
      text: "Filter which attendee types appear in event notes. Most calendars only mark rooms and resources explicitly.",
      cls: "setting-item-description",
    });

    const cuTypeOptions = [
      { value: "INDIVIDUAL", label: "Individual", desc: "(people)" },
      { value: "", label: "Unspecified", desc: "(usually people)" },
      { value: "GROUP", label: "Group", desc: "(distribution lists)" },
      { value: "RESOURCE", label: "Resource", desc: "(equipment)" },
      { value: "ROOM", label: "Room", desc: "(meeting spaces)" },
      { value: "UNKNOWN", label: "Unknown", desc: "" },
    ];

    const listEl = container.createDiv({ cls: "memochron-checkbox-list" });

    cuTypeOptions.forEach(({ value, label, desc }) => {
      const itemEl = listEl.createDiv({ cls: "memochron-checkbox-item" });
      const labelEl = itemEl.createEl("label");

      const checkbox = labelEl.createEl("input", { type: "checkbox" });
      checkbox.checked = this.plugin.settings.filteredCuTypes.includes(value);

      labelEl.createSpan({ cls: "checkbox-label-main", text: label });
      if (desc) {
        labelEl.createSpan({ cls: "checkbox-label-desc", text: " " + desc });
      }

      checkbox.addEventListener("change", async () => {
        if (checkbox.checked) {
          if (!this.plugin.settings.filteredCuTypes.includes(value)) {
            this.plugin.settings.filteredCuTypes.push(value);
          }
        } else {
          this.plugin.settings.filteredCuTypes =
            this.plugin.settings.filteredCuTypes.filter(t => t !== value);
        }
        await this.plugin.saveSettings();
        this.plugin.calendarView?.refreshEvents();
      });
    });
  }
```

**Step 4: Remove old renderRefreshInterval (without container param)**

Delete any duplicate method.

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/settings/SettingsTab.ts
git commit -m "Implement Advanced section with performance and filtering"
```

---

## Task 11: Clean Up Removed Methods and Unused Code

**Files:**
- Modify: `src/settings/SettingsTab.ts`

**Step 1: Remove the old visibility toggles CSS container code**

Search for `memochron-visibility-toggles` and remove any old code using it (the new implementation uses `memochron-visibility-row`).

**Step 2: Remove createHeading method**

Delete the `createHeading` method - no longer used.

**Step 3: Verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Test the settings page manually**

Open Obsidian with the plugin and verify:
- [ ] Three collapsible sections appear
- [ ] Calendars section has display settings at top
- [ ] Calendar items collapse/expand
- [ ] Notes section has sub-group labels
- [ ] Advanced section is collapsed by default
- [ ] All settings save correctly

**Step 5: Commit**

```bash
git add src/settings/SettingsTab.ts styles.css
git commit -m "Clean up unused methods and finalize settings redesign"
```

---

## Task 12: Final CSS Cleanup

**Files:**
- Modify: `styles.css`

**Step 1: Remove old settings CSS that's no longer needed**

Find and remove these old rules (around lines 571-661 in original):
- `.memochron-calendar-list .setting-item` rules that override item layout
- `.memochron-calendar-list .setting-item .setting-item-control` rules
- The old width rules for inputs

**Step 2: Remove old visibility toggles CSS**

Find and remove the `.memochron-visibility-toggles` rules (around lines 961-996).

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Test visual appearance**

Verify the settings page looks clean without the old cramped styling.

**Step 5: Commit**

```bash
git add styles.css
git commit -m "Remove deprecated settings CSS"
```

---

## Task 13: Final Verification

**Step 1: Full build and type check**

Run: `npm run build`
Expected: Build succeeds

**Step 2: Manual testing checklist**

- [ ] Open settings page
- [ ] Calendars section expands/collapses
- [ ] Display settings (first day, hide calendar, colors) work
- [ ] Add calendar creates expanded item
- [ ] Calendar items expand/collapse individually
- [ ] All calendar fields save correctly
- [ ] Notes section expands/collapses
- [ ] All Notes sub-groups visible with labels
- [ ] All note settings save correctly
- [ ] Advanced section starts collapsed
- [ ] Refresh interval saves correctly
- [ ] Attendee filtering checkboxes work
- [ ] Mobile view still usable

**Step 3: Commit final state**

```bash
git add -A
git commit -m "Settings page redesign complete"
```

---

## Summary

**Files modified:**
- `src/settings/SettingsTab.ts` - Major refactor
- `styles.css` - New collapsible styles, cleanup old styles

**Key changes:**
1. Three collapsible main sections (Calendars, Notes, Advanced)
2. Calendar items collapse by default, show name + toggle
3. Display settings moved to top of Calendars section
4. Notes section organized with sub-group labels
5. CUTYPE filtering uses compact checkbox list in Advanced
6. Removed old cramped inline styling
