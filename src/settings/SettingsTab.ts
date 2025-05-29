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
import { CalendarSource } from "./types";

export class SettingsTab extends PluginSettingTab {
  constructor(
    app: App, 
    private plugin: MemoChron
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderCalendarSection();
    this.renderGeneralSection();
    this.renderNotesSection();
  }

  private renderCalendarSection(): void {
    this.createHeading("Calendar sources", "Add and manage your iCalendar URLs");
    
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
    this.renderRefreshInterval();
  }

  private renderNotesSection(): void {
    new Setting(this.containerEl).setName("Notes").setHeading();
    
    this.renderNoteLocation();
    this.renderNoteTitleFormat();
    this.renderNoteDateFormat();
    this.renderDefaultFrontmatter();
    this.renderNoteTemplate();
    this.renderDefaultTags();
  }

  private createHeading(name: string, desc: string): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc);
  }

  private async addNewCalendar(): Promise<void> {
    this.plugin.settings.calendarUrls.push({
      url: "",
      name: "New calendar",
      enabled: true,
      tags: [],
    });
    await this.plugin.saveSettings();
    this.display();
  }

  private renderCalendarSource(
    container: HTMLElement, 
    source: CalendarSource, 
    index: number
  ): void {
    new Setting(container)
      .addText((text) => this.setupUrlInput(text, source, index))
      .addButton((btn) => this.setupFilePickerButton(btn, index))
      .addText((text) => this.setupNameInput(text, source, index))
      .addText((text) => this.setupTagsInput(text, source, index))
      .addToggle((toggle) => this.setupEnabledToggle(toggle, source, index))
      .addButton((btn) => this.setupRemoveButton(btn, index));
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
        const files = this.app.vault.getFiles().filter(f => f.extension === "ics");
        
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
        "Format for new note titles. Available variables: {{event_title}}, {{date}}, {{source}}"
      )
      .addText((text) =>
        text
          .setPlaceholder("{{event_title}} - {{date}}")
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

  private renderDefaultFrontmatter(): void {
    new Setting(this.containerEl)
      .setName("Default frontmatter")
      .setDesc("YAML frontmatter to add at the top of each event note")
      .addTextArea((text) => {
        text
          .setPlaceholder("---\ntype: event\ndate: {{date}}\n---")
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
        "Template for the note content. Available variables: {{event_title}}, {{date}}, {{start_time}}, {{end_time}}, {{source}}, {{location}}, {{description}}"
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
    return this.files.filter(file =>
      file.path.toLowerCase().includes(query.toLowerCase())
    );
  }

  renderSuggestion(file: TFile, el: HTMLElement) {
    el.createEl("div", { text: file.path });
    el.createEl("small", { 
      text: `Modified: ${new Date(file.stat.mtime).toLocaleDateString()}`,
      cls: "memochron-file-picker-date"
    });
  }

  onChooseSuggestion(file: TFile) {
    this.onChoose(file);
  }
}