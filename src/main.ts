import { Plugin, Platform, Notice } from "obsidian";
import { CalendarService } from "./services/CalendarService";
import { NoteService } from "./services/NoteService";
import { CalendarView } from "./views/CalendarView";
import { SettingsTab } from "./settings/SettingsTab";
import { MemoChronSettings, DEFAULT_SETTINGS } from "./settings/types";
import { MEMOCHRON_VIEW_TYPE } from "./utils/constants";

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
    this.calendarService = new CalendarService(
      this,
      this.settings.refreshInterval
    );
    this.noteService = new NoteService(this.app, this.settings);

    // Register calendar view
    this.registerView(
      MEMOCHRON_VIEW_TYPE,
      (leaf) => (this.calendarView = new CalendarView(leaf, this))
    );

    // Add settings tab
    this.addSettingTab(new SettingsTab(this.app, this));

    // Register commands
    this.addCommand({
      id: "force-refresh-calendars",
      name: "Force refresh calendars",
      callback: async () => {
        await this.refreshCalendarView(true);
        // Notice is now handled by the CalendarService
      },
    });

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
    // Refresh calendar view after settings change (e.g., calendar added)
    await this.refreshCalendarView();
  }

  private async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(MEMOCHRON_VIEW_TYPE);

    if (leaves.length === 0) {
      // Always try to create the view in the right sidebar, even on mobile
      let leaf = this.app.workspace.getRightLeaf(false);

      if (!leaf) {
        // If right sidebar isn't available, create it
        leaf = this.app.workspace.getLeaf("split", "vertical");
      }

      if (leaf) {
        await leaf.setViewState({
          type: MEMOCHRON_VIEW_TYPE,
          active: true,
        });
      }
    }

    // Initial calendar data fetch
    await this.refreshCalendarView();
  }

  async refreshCalendarView(forceRefresh = false) {
    if (this.calendarView) {
      await this.calendarView.refreshEvents(forceRefresh);
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
