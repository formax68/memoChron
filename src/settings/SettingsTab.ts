import {
  App,
  PluginSettingTab,
  Setting,
  TextComponent,
  TextAreaComponent,
} from "obsidian";
import MemoChron from "../main";
import { CalendarSource } from "./types";

export class SettingsTab extends PluginSettingTab {
  private plugin: MemoChron;

  constructor(app: App, plugin: MemoChron) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "MemoChron Settings" });

    // Calendar Sources Section
    new Setting(containerEl)
      .setName("Calendar Sources")
      .setDesc("Add and manage your iCalendar URLs")
      .addButton((btn) =>
        btn.setButtonText("Add Calendar").onClick(async () => {
          this.plugin.settings.calendarUrls.push({
            url: "",
            name: "New Calendar",
            enabled: true,
            tags: [], // Initialize with empty tags array
          });
          await this.plugin.saveSettings();
          this.display();
        })
      );

    const calendarContainer = containerEl.createEl("div", {
      cls: "memochron-calendar-list",
    });

    this.plugin.settings.calendarUrls.forEach((source, index) => {
      const calendarSetting = new Setting(calendarContainer)
        .addText((text) =>
          text
            .setPlaceholder("Calendar URL")
            .setValue(source.url)
            .onChange(async (value) => {
              this.plugin.settings.calendarUrls[index].url = value;
              await this.plugin.saveSettings();
            })
        )
        .addText((text) =>
          text
            .setPlaceholder("Calendar name")
            .setValue(source.name)
            .onChange(async (value) => {
              this.plugin.settings.calendarUrls[index].name = value;
              await this.plugin.saveSettings();
            })
        )
        .addText((text) =>
          text
            .setPlaceholder("Tags (comma-separated)")
            .setValue(source.tags?.join(", ") || "")
            .onChange(async (value) => {
              this.plugin.settings.calendarUrls[index].tags = value
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0);
              await this.plugin.saveSettings();
            })
        )
        .addToggle((toggle) =>
          toggle.setValue(source.enabled).onChange(async (value) => {
            this.plugin.settings.calendarUrls[index].enabled = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshCalendarView();
          })
        )
        .addButton((btn) =>
          btn.setButtonText("Remove").onClick(async () => {
            this.plugin.settings.calendarUrls.splice(index, 1);
            await this.plugin.saveSettings();
            await this.plugin.refreshCalendarView();
            this.display();
          })
        );
    });

    // Note Creation Settings
    containerEl.createEl("h3", { text: "Note Settings" });

    // Template Path with suggestions
    const templateSetting = new Setting(containerEl)
      .setName("Template File")
      .setDesc("Path to the template file for new event notes");

    const templateInput = new TextComponent(templateSetting.controlEl);
    templateInput
      .setPlaceholder("templates/event-template.md")
      .setValue(this.plugin.settings.templatePath);

    const templateSuggestionContainer = templateSetting.controlEl.createDiv({
      cls: "suggestion-container",
    });
    templateSuggestionContainer.style.display = "none";

    this.setupPathSuggestions(
      templateInput,
      templateSuggestionContainer,
      async () => await this.plugin.noteService.getAllTemplatePaths(),
      async (value) => {
        this.plugin.settings.templatePath = value;
        await this.plugin.saveSettings();
      }
    );

    // Note Location with suggestions
    const locationSetting = new Setting(containerEl)
      .setName("Note Location")
      .setDesc("Where to save new event notes");

    const locationInput = new TextComponent(locationSetting.controlEl);
    locationInput
      .setPlaceholder("calendar-notes/")
      .setValue(this.plugin.settings.noteLocation);

    const locationSuggestionContainer = locationSetting.controlEl.createDiv({
      cls: "suggestion-container",
    });
    locationSuggestionContainer.style.display = "none";

    this.setupPathSuggestions(
      locationInput,
      locationSuggestionContainer,
      async () => await this.plugin.noteService.getAllFolders(),
      async (value) => {
        this.plugin.settings.noteLocation = value;
        await this.plugin.saveSettings();
      }
    );

    // Note Title Format
    new Setting(containerEl)
      .setName("Note Title Format")
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

    // Note Date Format
    new Setting(containerEl)
      .setName("Note Date Format")
      .setDesc("Choose how dates appear in event notes")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ISO", "ISO (YYYY-MM-DD)")
          .addOption("US", "US (MM/DD/YYYY)")
          .addOption("UK", "UK (DD/MM/YYYY)")
          .addOption("Long", "Long (Month DD, YYYY)")
          .setValue(this.plugin.settings.noteDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.noteDateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    // Default Frontmatter
    new Setting(containerEl)
      .setName("Default Frontmatter")
      .setDesc("YAML frontmatter to add at the top of each event note")
      .addTextArea((text) => {
        text
          .setPlaceholder("---\ntype: event\nstatus: scheduled\n---")
          .setValue(this.plugin.settings.defaultFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.defaultFrontmatter = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 50;
      });

    // Default Tags
    new Setting(containerEl)
      .setName("Default Tags")
      .setDesc("Default tags for all event notes (comma-separated)")
      .addText((text) =>
        text
          .setPlaceholder("event, meeting")
          .setValue(this.plugin.settings.defaultTags.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.defaultTags = value
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0);
            await this.plugin.saveSettings();
          })
      );

    // Calendar View Settings
    containerEl.createEl("h3", { text: "View Settings" });

    new Setting(containerEl)
      .setName("Default View")
      .setDesc("Choose the default calendar view")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("month", "Month")
          .addOption("week", "Week")
          .setValue(this.plugin.settings.defaultView)
          .onChange(async (value: "month" | "week") => {
            this.plugin.settings.defaultView = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshCalendarView();
          })
      );

    new Setting(containerEl)
      .setName("Refresh Interval")
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

  private setupPathSuggestions(
    input: TextComponent,
    suggestionContainer: HTMLElement,
    getSuggestions: () => Promise<string[]>,
    onSelect: (value: string) => Promise<void>
  ): void {
    input.inputEl.addEventListener("focus", async () => {
      const suggestions = await getSuggestions();
      this.showSuggestions(
        input,
        suggestionContainer,
        suggestions,
        input.getValue(),
        onSelect
      );
    });

    input.inputEl.addEventListener("input", async () => {
      const suggestions = await getSuggestions();
      this.showSuggestions(
        input,
        suggestionContainer,
        suggestions,
        input.getValue(),
        onSelect
      );
    });

    input.inputEl.addEventListener("blur", () => {
      // Small delay to allow clicking on suggestions
      setTimeout(() => {
        suggestionContainer.style.display = "none";
      }, 200);
    });
  }

  private showSuggestions(
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
      container.style.display = "none";
      return;
    }

    container.style.display = "block";
    const ul = container.createEl("ul", { cls: "suggestion-list" });

    matchingSuggestions.slice(0, 5).forEach((suggestion) => {
      const li = ul.createEl("li", { text: suggestion });
      li.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        input.setValue(suggestion);
        await onSelect(suggestion);
        container.style.display = "none";
      });
    });
  }
}
