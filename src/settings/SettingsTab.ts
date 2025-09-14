import {
  App,
  PluginSettingTab,
  Setting,
  TextComponent,
  TextAreaComponent,
  DropdownComponent,
  ButtonComponent,
  TFile,
  Notice,
  Modal,
  SuggestModal,
} from "obsidian";
import MemoChron from "../main";
import { CalendarSource, CalendarNotesSettings } from "./types";

export class SettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: MemoChron) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderCalendarSection();
    this.renderGeneralSection();
    this.renderDailyNotesSection();
    this.renderNotesSection();
  }

  private renderCalendarSection(): void {
    this.createHeading(
      "Calendar sources",
      "Add and manage your iCalendar URLs"
    );

    new Setting(this.containerEl).addButton((btn) =>
      btn.setButtonText("Add calendar").onClick(() => this.addNewCalendar())
    );

    const calendarContainer = this.containerEl.createEl("div", {
      cls: "memochron-calendar-list",
    });

    this.plugin.settings.calendarUrls.forEach((source, index) => {
      this.renderCalendarSource(calendarContainer, source, index);
    });
  }

  private renderGeneralSection(): void {
    this.renderFirstDayOfWeek();
    this.renderHideCalendar();
    this.renderEnableCalendarColors();
    this.renderRefreshInterval();
  }

  private renderNotesSection(): void {
    new Setting(this.containerEl).setName("Notes").setHeading();

    this.renderNoteLocation();
    this.renderFolderPathTemplate();
    this.renderNoteTitleFormat();
    this.renderNoteDateFormat();
    this.renderNoteTimeFormat();
    this.renderDefaultFrontmatter();
    this.renderNoteTemplate();
    this.renderAttendeeSettings();
    this.renderDefaultTags();
  }

  private renderDailyNotesSection(): void {
    new Setting(this.containerEl).setName("Daily notes").setHeading();

    this.renderShowDailyNoteInAgenda();
  }

  private createHeading(name: string, desc: string): void {
    new Setting(this.containerEl).setName(name).setDesc(desc);
  }

  private async addNewCalendar(): Promise<void> {
    const newCalendar: CalendarSource = {
      url: "",
      name: "New calendar",
      enabled: true,
      tags: [],
    };

    // Auto-assign color if colors are enabled
    if (this.plugin.settings.enableCalendarColors) {
      newCalendar.color = this.getNextAvailableColor();
    }

    this.plugin.settings.calendarUrls.push(newCalendar);
    await this.plugin.saveSettings();
    this.display();
  }

  private getNextAvailableColor(): string {
    // Generate a random hue for auto-assignment
    const usedColors = this.plugin.settings.calendarUrls.length;
    const hue = (usedColors * 137.5) % 360; // Golden angle for nice distribution
    return `hsl(${hue}, 70%, 50%)`;
  }

  private renderCalendarSource(
    container: HTMLElement,
    source: CalendarSource,
    index: number
  ): void {
    const setting = new Setting(container)
      .addText((text) => this.setupUrlInput(text, source, index))
      .addButton((btn) => this.setupFilePickerButton(btn, index))
      .addText((text) => this.setupNameInput(text, source, index))
      .addText((text) => this.setupTagsInput(text, source, index));

    // Inline color picker if colors are enabled
    if (this.plugin.settings.enableCalendarColors) {
      // Remove the button, add inline swatches
      const colorContainer = setting.controlEl.createDiv({
        cls: "memochron-inline-color-picker",
      });
      this.renderInlineColorPicker(colorContainer, source, index);
    }

    setting
      .addToggle((toggle) => this.setupEnabledToggle(toggle, source, index))
      .addButton((btn) => this.setupRemoveButton(btn, index));

    // Add calendar-specific notes settings
    this.renderCalendarNotesSettings(container, source, index);
  }

  private setupUrlInput(
    text: TextComponent,
    source: CalendarSource,
    index: number
  ): TextComponent {
    return text
      .setPlaceholder("Calendar URL or file path")
      .setValue(source.url)
      .onChange(async (value) => {
        this.plugin.settings.calendarUrls[index].url = value;
        await this.plugin.saveSettings();
      });
  }

  private setupFilePickerButton(
    btn: ButtonComponent,
    index: number
  ): ButtonComponent {
    return btn
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

        // Create a simple file picker modal
        const modal = new FilePickerModal(this.app, files, async (file) => {
          this.plugin.settings.calendarUrls[index].url = file.path;
          await this.plugin.saveSettings();
          this.display();
        });
        modal.open();
      });
  }

  private setupNameInput(
    text: TextComponent,
    source: CalendarSource,
    index: number
  ): TextComponent {
    return text
      .setPlaceholder("Calendar name")
      .setValue(source.name)
      .onChange(async (value) => {
        this.plugin.settings.calendarUrls[index].name = value;
        await this.plugin.saveSettings();
      });
  }

  private setupTagsInput(
    text: TextComponent,
    source: CalendarSource,
    index: number
  ): TextComponent {
    return text
      .setPlaceholder("Tags (comma-separated)")
      .setValue(source.tags?.join(", ") || "")
      .onChange(async (value) => {
        this.plugin.settings.calendarUrls[index].tags = this.parseTags(value);
        await this.plugin.saveSettings();
      });
  }

  private setupEnabledToggle(
    toggle: any,
    source: CalendarSource,
    index: number
  ): any {
    return toggle.setValue(source.enabled).onChange(async (value: boolean) => {
      this.plugin.settings.calendarUrls[index].enabled = value;
      await this.plugin.saveSettings();
      await this.plugin.refreshCalendarView();
    });
  }

  private setupRemoveButton(btn: any, index: number): any {
    return btn.setButtonText("Remove").onClick(async () => {
      this.plugin.settings.calendarUrls.splice(index, 1);
      await this.plugin.saveSettings();
      await this.plugin.refreshCalendarView();
      this.display();
    });
  }

  private renderCalendarNotesSettings(
    container: HTMLElement,
    source: CalendarSource,
    index: number
  ): void {
    const notesContainer = container.createDiv({
      cls: "memochron-calendar-notes-settings",
    });

    const hasCustomSettings = source.notesSettings?.useCustomSettings || false;
    const settingsButton = new Setting(notesContainer)
      .setName("Notes settings")
      .setDesc(
        hasCustomSettings
          ? "Custom notes settings enabled"
          : "Use default notes settings"
      )
      .addButton((btn) => {
        btn
          .setButtonText(
            hasCustomSettings
              ? "Edit custom settings"
              : "Configure custom settings"
          )
          .setIcon(hasCustomSettings ? "settings" : "gear")
          .onClick(() => {
            const modal = new CalendarNotesSettingsModal(
              this.app,
              this.plugin,
              source,
              index,
              () => this.display() // Refresh the main settings page
            );
            modal.open();
          });
      });

    // Add a small indicator if custom settings are enabled
    if (hasCustomSettings) {
      const indicator = settingsButton.descEl.createSpan({
        cls: "memochron-custom-settings-indicator",
        text: " ⚙️",
      });
    }
  }

  private renderInlineColorPicker(
    container: HTMLElement,
    source: CalendarSource,
    index: number
  ) {
    const baseColors = this.getObsidianBaseColors();
    const currentColor = source.color || this.getNextAvailableColor();

    // Render color swatches
    baseColors.forEach((color) => {
      const swatch = container.createDiv({
        cls: "memochron-inline-color-swatch",
      });
      const finalColor = color.cssVar
        ? getComputedStyle(document.documentElement)
            .getPropertyValue(color.cssVar)
            .trim() || color.fallback
        : color.fallback;
      swatch.style.backgroundColor = finalColor;
      if (finalColor === currentColor) {
        swatch.classList.add("selected");
      }
      swatch.addEventListener("click", async () => {
        this.plugin.settings.calendarUrls[index].color = finalColor;
        await this.plugin.saveSettings();
        this.plugin.updateCalendarColors();
        // Rerender to update selection
        container.empty();
        this.renderInlineColorPicker(container, source, index);
      });
    });

    // Custom color input
    const customLabel = container.createDiv({
      cls: "memochron-inline-color-custom-label",
    });
    const isCustom = !baseColors.some((c) => {
      const col = c.cssVar
        ? getComputedStyle(document.documentElement)
            .getPropertyValue(c.cssVar)
            .trim() || c.fallback
        : c.fallback;
      return col === currentColor;
    });
    if (isCustom) {
      // Show current color as a filled circle
      customLabel.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${currentColor}" stroke="#888" stroke-width="2"/></svg>`;
    } else {
      // Show + icon
      customLabel.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#888" stroke-width="2"/><text x="12" y="17" text-anchor="middle" font-size="16" fill="#888">+</text></svg>';
    }
    customLabel.style.position = "relative";
    customLabel.style.display = "inline-block";
    customLabel.style.width = "24px";
    customLabel.style.height = "24px";
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = this.colorToHex(currentColor);
    colorInput.className = "memochron-inline-color-input";
    colorInput.style.position = "absolute";
    colorInput.style.top = "0";
    colorInput.style.left = "0";
    colorInput.style.width = "24px";
    colorInput.style.height = "24px";
    colorInput.style.opacity = "0";
    colorInput.style.cursor = "pointer";
    colorInput.style.border = "none";
    colorInput.style.padding = "0";
    colorInput.style.margin = "0";
    customLabel.appendChild(colorInput);
    colorInput.addEventListener("change", async (e) => {
      const hex = (e.target as HTMLInputElement).value;
      this.plugin.settings.calendarUrls[index].color = hex;
      await this.plugin.saveSettings();
      this.plugin.updateCalendarColors();
      container.empty();
      this.renderInlineColorPicker(container, source, index);
    });
    // Highlight if current color is custom
    if (isCustom) {
      customLabel.classList.add("selected");
    }
  }

  private renderDailyNoteColorPicker(container: HTMLElement) {
    const baseColors = this.getObsidianBaseColors();
    const currentColor =
      this.plugin.settings.dailyNoteColor ||
      getComputedStyle(document.documentElement)
        .getPropertyValue("--interactive-accent")
        .trim() ||
      "#7c3aed";

    // Render color swatches
    baseColors.forEach((color) => {
      const swatch = container.createDiv({
        cls: "memochron-inline-color-swatch",
      });
      const finalColor = color.cssVar
        ? getComputedStyle(document.documentElement)
            .getPropertyValue(color.cssVar)
            .trim() || color.fallback
        : color.fallback;
      swatch.style.backgroundColor = finalColor;
      if (finalColor === currentColor) {
        swatch.classList.add("selected");
      }
      swatch.addEventListener("click", async () => {
        this.plugin.settings.dailyNoteColor = finalColor;
        await this.plugin.saveSettings();
        this.plugin.updateCalendarColors();
        // Rerender to update selection
        container.empty();
        this.renderDailyNoteColorPicker(container);
      });
    });

    // Custom color input
    const customLabel = container.createDiv({
      cls: "memochron-inline-color-custom-label",
    });
    const isCustom = !baseColors.some((c) => {
      const col = c.cssVar
        ? getComputedStyle(document.documentElement)
            .getPropertyValue(c.cssVar)
            .trim() || c.fallback
        : c.fallback;
      return col === currentColor;
    });
    if (isCustom) {
      // Show current color as a filled circle
      customLabel.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${currentColor}" stroke="#888" stroke-width="2"/></svg>`;
    } else {
      // Show + icon
      customLabel.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#888" stroke-width="2"/><text x="12" y="17" text-anchor="middle" font-size="16" fill="#888">+</text></svg>';
    }
    customLabel.style.position = "relative";
    customLabel.style.display = "inline-block";
    customLabel.style.width = "24px";
    customLabel.style.height = "24px";
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = this.colorToHex(currentColor);
    colorInput.className = "memochron-inline-color-input";
    colorInput.style.position = "absolute";
    colorInput.style.top = "0";
    colorInput.style.left = "0";
    colorInput.style.width = "24px";
    colorInput.style.height = "24px";
    colorInput.style.opacity = "0";
    colorInput.style.cursor = "pointer";
    colorInput.style.border = "none";
    colorInput.style.padding = "0";
    colorInput.style.margin = "0";
    customLabel.appendChild(colorInput);
    colorInput.addEventListener("change", async (e) => {
      const hex = (e.target as HTMLInputElement).value;
      this.plugin.settings.dailyNoteColor = hex;
      await this.plugin.saveSettings();
      this.plugin.updateCalendarColors();
      container.empty();
      this.renderDailyNoteColorPicker(container);
    });
    // Highlight if current color is custom
    if (isCustom) {
      customLabel.classList.add("selected");
    }
  }

  // Helper to convert color to hex for <input type="color">
  private colorToHex(color: string): string {
    // Accepts hex or hsl
    if (color.startsWith("#")) return color;
    const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/);
    if (hslMatch) {
      // Convert HSL to hex
      let h = parseInt(hslMatch[1]) / 360,
        s = parseInt(hslMatch[2]) / 100,
        l = parseInt(hslMatch[3]) / 100;
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }
      return (
        "#" +
        [r, g, b]
          .map((x) =>
            Math.round(x * 255)
              .toString(16)
              .padStart(2, "0")
          )
          .join("")
      );
    }
    // fallback
    return "#888888";
  }

  private getObsidianBaseColors() {
    return [
      // Obsidian theme accent
      { cssVar: "--interactive-accent", fallback: "#7c3aed" },
      // Good calendar colors that work with themes
      { cssVar: null, fallback: "#e74c3c" }, // Red
      { cssVar: null, fallback: "#e67e22" }, // Orange
      { cssVar: null, fallback: "#f1c40f" }, // Yellow
      { cssVar: null, fallback: "#2ecc71" }, // Green
      { cssVar: null, fallback: "#3498db" }, // Blue
      { cssVar: null, fallback: "#9b59b6" }, // Purple
      { cssVar: null, fallback: "#e91e63" }, // Pink
      { cssVar: "--text-muted", fallback: "#999999" }, // Theme muted
    ];
  }

  private renderFirstDayOfWeek(): void {
    const weekdays = [
      { value: "0", label: "Sunday" },
      { value: "1", label: "Monday" },
      { value: "2", label: "Tuesday" },
      { value: "3", label: "Wednesday" },
      { value: "4", label: "Thursday" },
      { value: "5", label: "Friday" },
      { value: "6", label: "Saturday" },
    ];

    new Setting(this.containerEl)
      .setName("First day of the week")
      .setDesc("Choose which day the week starts on")
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
  }

  private renderHideCalendar(): void {
    new Setting(this.containerEl)
      .setName("Hide calendar")
      .setDesc("Show only the agenda view without the month calendar grid")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hideCalendar)
          .onChange(async (value) => {
            this.plugin.settings.hideCalendar = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshCalendarView();
          })
      );
  }

  private renderShowDailyNoteInAgenda(): void {
    const dailyNoteSetting = new Setting(this.containerEl)
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
  }

  private renderEnableCalendarColors(): void {
    new Setting(this.containerEl)
      .setName("Enable calendar colors")
      .setDesc("Show calendars in different colors for easy identification")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCalendarColors)
          .onChange(async (value) => {
            this.plugin.settings.enableCalendarColors = value;

            // Auto-assign colors to existing calendars if enabling
            if (value) {
              this.plugin.settings.calendarUrls.forEach((source, index) => {
                if (!source.color) {
                  const hue = (index * 137.5) % 360;
                  source.color = `hsl(${hue}, 70%, 50%)`;
                }
              });

              // Set default daily note color if not set
              if (!this.plugin.settings.dailyNoteColor) {
                this.plugin.settings.dailyNoteColor =
                  getComputedStyle(document.documentElement)
                    .getPropertyValue("--interactive-accent")
                    .trim() || "#7c3aed";
              }
            }

            await this.plugin.saveSettings();
            this.plugin.updateCalendarColors(); // Update colors visually without fetching
            this.display(); // Refresh settings display to show/hide color pickers
          })
      );
  }

  private renderRefreshInterval(): void {
    new Setting(this.containerEl)
      .setName("Refresh interval")
      .setDesc("How often to refresh calendar data (in minutes)")
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

  private renderNoteLocation(): void {
    const locationSetting = new Setting(this.containerEl)
      .setName("Note location")
      .setDesc("Where to save new event notes");

    locationSetting.settingEl.addClass("memochron-setting-item-container");

    const locationInput = new TextComponent(locationSetting.controlEl);
    locationInput
      .setPlaceholder("calendar-notes/")
      .setValue(this.plugin.settings.noteLocation);

    const suggestionContainer = locationSetting.controlEl.createDiv({
      cls: "memochron-suggestion-container",
    });
    suggestionContainer.classList.remove("is-visible");

    this.setupPathSuggestions(
      locationInput,
      suggestionContainer,
      async () => await this.plugin.noteService.getAllFolders(),
      async (value) => {
        this.plugin.settings.noteLocation = value;
        await this.plugin.saveSettings();
      }
    );
  }

  private renderNoteTitleFormat(): void {
    new Setting(this.containerEl)
      .setName("Note title format")
      .setDesc(
        "Format for new note titles. Available variables: {{event_title}}, {{date}}, {{start_date}}, {{end_date}}, {{start_time}}, {{end_time}}, {{source}}, {{location}}, {{description}}"
      )
      .addText((text) =>
        text
          .setPlaceholder("{{event_title}} - {{start_date}}")
          .setValue(this.plugin.settings.noteTitleFormat)
          .onChange(async (value) => {
            this.plugin.settings.noteTitleFormat = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderNoteDateFormat(): void {
    const dateFormats = [
      { value: "ISO", label: "ISO (YYYY-MM-DD)" },
      { value: "US", label: "US (MM/DD/YYYY)" },
      { value: "UK", label: "UK (DD/MM/YYYY)" },
      { value: "Long", label: "Long (Month DD, YYYY)" },
    ];

    new Setting(this.containerEl)
      .setName("Note date format")
      .setDesc("Choose how dates appear in event notes")
      .addDropdown((dropdown) => {
        dateFormats.forEach(({ value, label }) => {
          dropdown.addOption(value, label);
        });

        dropdown
          .setValue(this.plugin.settings.noteDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.noteDateFormat = value;
            await this.plugin.saveSettings();
          });
      });
  }

  private renderNoteTimeFormat(): void {
    const timeFormats = [
      { value: "24h", label: "24-hour (13:30)" },
      { value: "12h", label: "12-hour (1:30 PM)" },
    ];

    new Setting(this.containerEl)
      .setName("Note time format")
      .setDesc("Choose how times appear in event notes and calendar view")
      .addDropdown((dropdown) => {
        timeFormats.forEach(({ value, label }) => {
          dropdown.addOption(value, label);
        });

        dropdown
          .setValue(this.plugin.settings.noteTimeFormat)
          .onChange(async (value) => {
            this.plugin.settings.noteTimeFormat = value as "12h" | "24h";
            await this.plugin.saveSettings();
            // Refresh the calendar view to show the new time format
            this.plugin.calendarView?.refreshEvents();
          });
      });
  }

  private renderDefaultFrontmatter(): void {
    new Setting(this.containerEl)
      .setName("Default frontmatter")
      .setDesc("YAML frontmatter to add at the top of each event note")
      .addTextArea((text) => {
        text
          .setPlaceholder("---\ntype: event\ndate: {{start_date}}\n---")
          .setValue(this.plugin.settings.defaultFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.defaultFrontmatter = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 50;
      });
  }

  private renderNoteTemplate(): void {
    new Setting(this.containerEl)
      .setName("Note template")
      .setDesc(
        "Template for the note content. Available variables: {{event_title}}, {{date}}, {{start_date}}, {{end_date}}, {{start_time}}, {{end_time}}, {{source}}, {{location}}, {{description}}, {{attendees}}, {{attendees_list}}, {{attendees_links}}, {{attendees_links_list}}, {{attendees_count}}"
      )
      .addTextArea((text) => {
        text
          .setValue(this.plugin.settings.noteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.noteTemplate = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 10;
        text.inputEl.cols = 50;
      });
  }

  private renderAttendeeSettings(): void {
    new Setting(this.containerEl)
      .setName("Create links for attendees")
      .setDesc(
        "Automatically create wiki links [[Name]] for event attendees. Obsidian will find the notes regardless of their folder location."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableAttendeeLinks)
          .onChange(async (value) => {
            this.plugin.settings.enableAttendeeLinks = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderFolderPathTemplate(): void {
    const templateSetting = new Setting(this.containerEl)
      .setName("Folder path template")
      .setDesc(
        "Organize notes in date-based subfolders. Leave empty to save all notes in the same folder."
      );

    templateSetting.descEl.createEl("br");
    templateSetting.descEl.createEl("small", {
      text: "Available variables: {YYYY}, {YY}, {MM}, {M}, {MMM}, {MMMM}, {DD}, {D}, {DDD}, {DDDD}, {Q}, {source}, {event_title}",
    });
    templateSetting.descEl.createEl("br");
    templateSetting.descEl.createEl("small", {
      text: "Examples: {YYYY}/{MM}, {YYYY}-{MMM}, {source}/{YYYY}/{MMM}",
    });

    templateSetting.addText((text) =>
      text
        .setPlaceholder("{YYYY}/{MMM}")
        .setValue(this.plugin.settings.folderPathTemplate)
        .onChange(async (value) => {
          this.plugin.settings.folderPathTemplate = value;
          await this.plugin.saveSettings();
        })
    );

    // Add preview container
    const previewContainer = templateSetting.controlEl.createDiv({
      cls: "memochron-template-preview",
    });
    this.updateTemplatePreview(
      previewContainer,
      this.plugin.settings.folderPathTemplate
    );

    // Update preview when input changes
    const textInput = templateSetting.controlEl.querySelector(
      "input"
    ) as HTMLInputElement;
    if (textInput) {
      textInput.addEventListener("input", () => {
        this.updateTemplatePreview(previewContainer, textInput.value);
      });
    }
  }

  private updateTemplatePreview(
    container: HTMLElement,
    template: string
  ): void {
    container.empty();

    if (!template.trim()) {
      container.createEl("small", {
        text: "Preview: Notes will be saved directly in the note location folder",
        cls: "memochron-preview-text",
      });
      return;
    }

    // Create a sample date for preview
    const sampleDate = new Date();
    const sampleEvent = {
      title: "Sample Meeting",
      start: sampleDate,
      end: sampleDate,
      source: "Work Calendar",
    };

    try {
      const previewPath = this.generatePreviewPath(template, sampleEvent);
      container.createEl("small", {
        text: `Preview: ${previewPath}/`,
        cls: "memochron-preview-text",
      });
    } catch (error) {
      container.createEl("small", {
        text: "Invalid template format",
        cls: "memochron-preview-error",
      });
    }
  }

  private generatePreviewPath(template: string, event: any): string {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthAbbreviations = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayAbbreviations = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const date = event.start;
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const dayOfWeek = date.getDay();
    const quarter = Math.floor(month / 3) + 1;

    const variables = {
      YYYY: year.toString(),
      YY: year.toString().slice(-2),
      MM: (month + 1).toString().padStart(2, "0"),
      M: (month + 1).toString(),
      MMM: monthAbbreviations[month],
      MMMM: monthNames[month],
      DD: day.toString().padStart(2, "0"),
      D: day.toString(),
      DDD: dayAbbreviations[dayOfWeek],
      DDDD: dayNames[dayOfWeek],
      Q: quarter.toString(),
      source: event.source.replace(/[\\/:*?"<>|]/g, "-"),
      event_title: event.title.replace(/[\\/:*?"<>|]/g, "-"),
    };

    return Object.entries(variables).reduce((result, [key, value]) => {
      const pattern = new RegExp(`\\{${key}\\}`, "g");
      return result.replace(pattern, value);
    }, template);
  }

  private renderDefaultTags(): void {
    new Setting(this.containerEl)
      .setName("Default tags")
      .setDesc("Default tags for all event notes (comma-separated)")
      .addText((text) =>
        text
          .setPlaceholder("event, meeting")
          .setValue(this.plugin.settings.defaultTags.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.defaultTags = this.parseTags(value);
            await this.plugin.saveSettings();
          })
      );
  }

  private parseTags(value: string): string[] {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  private setupPathSuggestions(
    input: TextComponent,
    suggestionContainer: HTMLElement,
    getSuggestions: () => Promise<string[]>,
    onSelect: (value: string) => Promise<void>
  ): void {
    const showSuggestions = async () => {
      const suggestions = await getSuggestions();
      this.displaySuggestions(
        input,
        suggestionContainer,
        suggestions,
        input.getValue(),
        onSelect
      );
    };

    input.inputEl.addEventListener("focus", showSuggestions);
    input.inputEl.addEventListener("input", showSuggestions);

    input.inputEl.addEventListener("blur", () => {
      setTimeout(() => {
        // Check if container still exists before manipulating
        if (suggestionContainer && suggestionContainer.parentNode) {
          suggestionContainer.classList.remove("is-visible");
        }
      }, 200);
    });
  }

  private displaySuggestions(
    input: TextComponent,
    container: HTMLElement,
    allSuggestions: string[],
    query: string,
    onSelect: (value: string) => Promise<void>
  ): void {
    container.empty();

    const matchingSuggestions = allSuggestions.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    );

    if (matchingSuggestions.length === 0) {
      container.classList.remove("is-visible");
      return;
    }

    container.classList.add("is-visible");
    const ul = container.createEl("ul", { cls: "memochron-suggestion-list" });

    matchingSuggestions.slice(0, 5).forEach((suggestion) => {
      const li = ul.createEl("li", { text: suggestion });
      li.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        input.setValue(suggestion);
        await onSelect(suggestion);
        container.classList.remove("is-visible");
      });
    });
  }
}

// Simple file picker modal for ICS files
class FilePickerModal extends SuggestModal<TFile> {
  constructor(
    app: App,
    private files: TFile[],
    private onChoose: (file: TFile) => void
  ) {
    super(app);
  }

  getSuggestions(query: string): TFile[] {
    return this.files.filter((file) =>
      file.path.toLowerCase().includes(query.toLowerCase())
    );
  }

  renderSuggestion(file: TFile, el: HTMLElement) {
    el.createEl("div", { text: file.path });
    el.createEl("small", {
      text: `Modified: ${new Date(file.stat.mtime).toLocaleDateString()}`,
      cls: "memochron-file-picker-date",
    });
  }

  onChooseSuggestion(file: TFile) {
    this.onChoose(file);
  }
}

// Calendar-specific notes settings modal
class CalendarNotesSettingsModal extends Modal {
  private source: CalendarSource;
  private index: number;
  private plugin: MemoChron;
  private onSettingsChange?: () => void;
  private eventListeners: Array<{
    element: HTMLElement;
    event: string;
    handler: EventListener;
  }> = [];

  constructor(
    app: App,
    plugin: MemoChron,
    source: CalendarSource,
    index: number,
    onSettingsChange?: () => void
  ) {
    super(app);
    this.plugin = plugin;
    this.source = source;
    this.index = index;
    this.onSettingsChange = onSettingsChange;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // Refresh custom settings if needed
    this.refreshCustomSettingsIfNeeded();

    contentEl.createEl("h2", {
      text: `Notes Settings for "${this.source.name}"`,
    });

    // Toggle for using custom settings
    new Setting(contentEl)
      .setName("Use custom notes settings")
      .setDesc("Override default notes settings for this calendar")
      .addToggle((toggle) => {
        const currentSettings = this.source.notesSettings || {
          useCustomSettings: false,
        };
        toggle
          .setValue(currentSettings.useCustomSettings)
          .onChange(async (value) => {
            if (!this.source.notesSettings) {
              this.source.notesSettings = { useCustomSettings: value };
            } else {
              this.source.notesSettings.useCustomSettings = value;
            }

            // If enabling custom settings, copy default values
            if (value) {
              this.copyDefaultSettingsToCustom();
            }

            await this.plugin.saveSettings();
            this.onOpen(); // Refresh the modal
            // Refresh the main settings page to update the description
            if (this.onSettingsChange) {
              this.onSettingsChange();
            }
          });
      });

    const currentSettings = this.source.notesSettings || {
      useCustomSettings: false,
    };
    if (currentSettings.useCustomSettings) {
      this.renderCustomSettings(contentEl);
    }
  }

  private renderCustomSettings(container: HTMLElement) {
    const currentSettings = this.source.notesSettings;
    if (!currentSettings) {
      console.error("Custom settings not found when rendering custom settings");
      return;
    }

    // Note location
    const locationSetting = new Setting(container)
      .setName("Note location")
      .setDesc(
        "Where to save notes for this calendar (leave empty to use default)"
      );

    locationSetting.settingEl.addClass("memochron-setting-item-container");

    const locationInput = new TextComponent(locationSetting.controlEl);
    locationInput
      .setPlaceholder(this.plugin.settings.noteLocation)
      .setValue(currentSettings.noteLocation || "");

    const suggestionContainer = locationSetting.controlEl.createDiv({
      cls: "memochron-suggestion-container",
    });
    suggestionContainer.classList.remove("is-visible");

    this.setupPathSuggestions(
      locationInput,
      suggestionContainer,
      async () => await this.plugin.noteService.getAllFolders(),
      async (value: string) => {
        currentSettings.noteLocation = value || undefined;
        await this.plugin.saveSettings();
      }
    );

    // Note title format
    new Setting(container)
      .setName("Note title format")
      .setDesc("Title format for this calendar (leave empty to use default)")
      .addText((text) =>
        text
          .setPlaceholder(this.plugin.settings.noteTitleFormat)
          .setValue(currentSettings.noteTitleFormat || "")
          .onChange(async (value) => {
            currentSettings.noteTitleFormat = value || undefined;
            await this.plugin.saveSettings();
          })
      );

    // Note date format
    const dateFormats = [
      { value: "ISO", label: "ISO (YYYY-MM-DD)" },
      { value: "US", label: "US (MM/DD/YYYY)" },
      { value: "UK", label: "UK (DD/MM/YYYY)" },
      { value: "Long", label: "Long (Month DD, YYYY)" },
    ];

    new Setting(container)
      .setName("Note date format")
      .setDesc("Date format for this calendar")
      .addDropdown((dropdown) => {
        dropdown.addOption(
          "",
          `Default (${this.plugin.settings.noteDateFormat})`
        );
        dateFormats.forEach(({ value, label }) => {
          dropdown.addOption(value, label);
        });
        dropdown
          .setValue(currentSettings.noteDateFormat || "")
          .onChange(async (value) => {
            currentSettings.noteDateFormat = value || undefined;
            await this.plugin.saveSettings();
          });
      });

    // Note time format
    new Setting(container)
      .setName("Note time format")
      .setDesc("Time format for this calendar")
      .addDropdown((dropdown) => {
        dropdown.addOption(
          "",
          `Default (${this.plugin.settings.noteTimeFormat})`
        );
        dropdown.addOption("12h", "12-hour (1:30 PM)");
        dropdown.addOption("24h", "24-hour (13:30)");
        dropdown
          .setValue(currentSettings.noteTimeFormat || "")
          .onChange(async (value) => {
            currentSettings.noteTimeFormat =
              (value as "12h" | "24h") || undefined;
            await this.plugin.saveSettings();
          });
      });

    // Default frontmatter
    new Setting(container)
      .setName("Default frontmatter")
      .setDesc(
        "YAML frontmatter for this calendar (leave empty to use default)"
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(this.plugin.settings.defaultFrontmatter)
          .setValue(currentSettings.defaultFrontmatter || "")
          .onChange(async (value) => {
            currentSettings.defaultFrontmatter = value || undefined;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 50;
      });

    // Default tags
    new Setting(container)
      .setName("Default tags")
      .setDesc("Default tags for this calendar (leave empty to use default)")
      .addText((text) =>
        text
          .setPlaceholder(this.plugin.settings.defaultTags.join(", "))
          .setValue((currentSettings.defaultTags || []).join(", "))
          .onChange(async (value) => {
            currentSettings.defaultTags = value
              ? this.parseTags(value)
              : undefined;
            await this.plugin.saveSettings();
          })
      );

    // Note template
    new Setting(container)
      .setName("Note template")
      .setDesc("Template for this calendar (leave empty to use default)")
      .addTextArea((text) => {
        text
          .setPlaceholder(this.plugin.settings.noteTemplate)
          .setValue(currentSettings.noteTemplate || "")
          .onChange(async (value) => {
            currentSettings.noteTemplate = value || undefined;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 10;
        text.inputEl.cols = 50;
      });

    // Folder path template
    new Setting(container)
      .setName("Folder path template")
      .setDesc(
        "Folder organization for this calendar (leave empty to use default)"
      )
      .addText((text) =>
        text
          .setPlaceholder(
            this.plugin.settings.folderPathTemplate || "No template"
          )
          .setValue(currentSettings.folderPathTemplate || "")
          .onChange(async (value) => {
            currentSettings.folderPathTemplate = value || undefined;
            await this.plugin.saveSettings();
          })
      );

    // Enable attendee links
    new Setting(container)
      .setName("Create links for attendees")
      .setDesc("Create wiki links for attendees in this calendar")
      .addToggle((toggle) => {
        const defaultValue = this.plugin.settings.enableAttendeeLinks;
        toggle
          .setValue(currentSettings.enableAttendeeLinks ?? defaultValue)
          .onChange(async (value) => {
            currentSettings.enableAttendeeLinks = value;
            await this.plugin.saveSettings();
          });
      });
  }

  private parseTags(value: string): string[] {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  private copyDefaultSettingsToCustom(): void {
    if (!this.source.notesSettings) {
      this.source.notesSettings = { useCustomSettings: true };
    }

    // Copy all default settings to custom settings
    this.source.notesSettings.noteLocation = this.plugin.settings.noteLocation;
    this.source.notesSettings.noteTitleFormat =
      this.plugin.settings.noteTitleFormat;
    this.source.notesSettings.noteDateFormat =
      this.plugin.settings.noteDateFormat;
    this.source.notesSettings.noteTimeFormat =
      this.plugin.settings.noteTimeFormat;
    this.source.notesSettings.defaultFrontmatter =
      this.plugin.settings.defaultFrontmatter;
    this.source.notesSettings.defaultTags = [
      ...(this.plugin.settings.defaultTags || []),
    ];
    this.source.notesSettings.noteTemplate = this.plugin.settings.noteTemplate;
    this.source.notesSettings.folderPathTemplate =
      this.plugin.settings.folderPathTemplate;
    this.source.notesSettings.enableAttendeeLinks =
      this.plugin.settings.enableAttendeeLinks;
  }

  private refreshCustomSettingsIfNeeded(): void {
    if (!this.source.notesSettings?.useCustomSettings) {
      return;
    }

    // Check if any custom settings are undefined/null and refresh them from defaults
    const needsRefresh =
      !this.source.notesSettings.noteLocation ||
      !this.source.notesSettings.noteTitleFormat ||
      !this.source.notesSettings.noteDateFormat ||
      !this.source.notesSettings.noteTimeFormat ||
      !this.source.notesSettings.defaultFrontmatter ||
      !this.source.notesSettings.defaultTags ||
      !this.source.notesSettings.noteTemplate ||
      this.source.notesSettings.folderPathTemplate === undefined ||
      this.source.notesSettings.enableAttendeeLinks === undefined;

    if (needsRefresh) {
      console.log("Refreshing custom settings with current defaults");
      this.copyDefaultSettingsToCustom();
    }
  }

  private setupPathSuggestions(
    input: TextComponent,
    suggestionContainer: HTMLElement,
    getSuggestions: () => Promise<string[]>,
    onSelect: (value: string) => Promise<void>
  ): void {
    const showSuggestions = async () => {
      const suggestions = await getSuggestions();
      this.displaySuggestions(
        input,
        suggestionContainer,
        suggestions,
        input.getValue(),
        onSelect
      );
    };

    input.inputEl.addEventListener("focus", showSuggestions);
    input.inputEl.addEventListener("input", showSuggestions);

    input.inputEl.addEventListener("blur", () => {
      setTimeout(() => {
        // Check if container still exists before manipulating
        if (suggestionContainer && suggestionContainer.parentNode) {
          suggestionContainer.classList.remove("is-visible");
        }
      }, 200);
    });
  }

  private displaySuggestions(
    input: TextComponent,
    container: HTMLElement,
    allSuggestions: string[],
    query: string,
    onSelect: (value: string) => Promise<void>
  ): void {
    container.empty();

    const matchingSuggestions = allSuggestions.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    );

    if (matchingSuggestions.length === 0) {
      container.classList.remove("is-visible");
      return;
    }

    container.classList.add("is-visible");
    const ul = container.createEl("ul", { cls: "memochron-suggestion-list" });

    matchingSuggestions.slice(0, 5).forEach((suggestion) => {
      const li = ul.createEl("li", { text: suggestion });
      li.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        input.setValue(suggestion);
        await onSelect(suggestion);
        container.classList.remove("is-visible");
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    this.cleanupEventListeners();
    contentEl.empty();
  }

  private addEventListener(
    element: HTMLElement,
    event: string,
    handler: EventListener
  ) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  private cleanupEventListeners() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
}
