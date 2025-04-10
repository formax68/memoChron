import { App, PluginSettingTab, Setting } from "obsidian";
import MemoChron from "../main";
import { CalendarSource } from "./types";

export class SettingsTab extends PluginSettingTab {
  plugin: MemoChron;

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

    new Setting(containerEl)
      .setName("Template File")
      .setDesc("Path to the template file for new event notes")
      .addText((text) =>
        text
          .setPlaceholder("templates/event-template.md")
          .setValue(this.plugin.settings.templatePath)
          .onChange(async (value) => {
            this.plugin.settings.templatePath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Note Location")
      .setDesc("Where to save new event notes")
      .addText((text) =>
        text
          .setPlaceholder("calendar-notes/")
          .setValue(this.plugin.settings.noteLocation)
          .onChange(async (value) => {
            this.plugin.settings.noteLocation = value;
            await this.plugin.saveSettings();
          })
      );

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
}
