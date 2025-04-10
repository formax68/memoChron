import { Plugin } from "obsidian";
import { CalendarService } from "./services/CalendarService";
import { NoteService } from "./services/NoteService";
import { CalendarView } from "./views/CalendarView";
import { SettingsTab } from "./settings/SettingsTab";
import { MemoChronSettings, DEFAULT_SETTINGS } from "./settings/types";

export default class MemoChron extends Plugin {
  settings: MemoChronSettings;
  calendarService: CalendarService;
  noteService: NoteService;
  calendarView: CalendarView;
  private refreshTimer: number;

  async onload() {
    // Load settings
    await this.loadSettings();

    // Initialize services
    this.calendarService = new CalendarService(this.settings.refreshInterval);
    this.noteService = new NoteService(this.app, this.settings);

    // Register calendar view
    this.registerView(
      "memochron-calendar",
      (leaf) => (this.calendarView = new CalendarView(leaf, this))
    );

    // Add settings tab
    this.addSettingTab(new SettingsTab(this.app, this));

    // Add calendar view to right sidebar
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });

    // Set up auto-refresh
    this.setupAutoRefresh();
  }

  onunload() {
    // Clear refresh timer
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);

    // Update refresh interval if it changed
    if (this.calendarService) {
      this.setupAutoRefresh();
    }
  }

  private async activateView() {
    const leaves = this.app.workspace.getLeavesOfType("memochron-calendar");

    if (leaves.length === 0) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: "memochron-calendar",
          active: true,
        });
      }
    }

    // Initial calendar data fetch
    await this.refreshCalendarView();
  }

  async refreshCalendarView() {
    if (this.calendarView) {
      await this.calendarView.refreshEvents();
    }
  }

  private setupAutoRefresh() {
    // Clear existing timer if any
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
    }

    // Set up new refresh timer
    this.refreshTimer = window.setInterval(
      () => this.refreshCalendarView(),
      this.settings.refreshInterval * 60 * 1000 // Convert minutes to milliseconds
    );
  }
}
