import { Plugin } from "obsidian";
import { CalendarService } from "./services/CalendarService";
import { NoteService } from "./services/NoteService";
import { CalendarView } from "./views/CalendarView";
import { SettingsTab } from "./settings/SettingsTab";
import { MemoChronSettings, DEFAULT_SETTINGS } from "./settings/types";
import { MEMOCHRON_VIEW_TYPE } from "./utils/constants";
import { getDefaultCalendarColor } from "./utils/colorUtils";

export default class MemoChron extends Plugin {
  settings: MemoChronSettings;
  calendarService: CalendarService;
  noteService: NoteService;
  calendarView: CalendarView;
  private refreshTimer: number | null = null;

  async onload() {
    await this.loadSettings();
    this.initializeServices();
    this.registerViews();
    this.registerCommands();
    this.addSettingTab(new SettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });

    this.setupAutoRefresh();
  }

  private initializeServices() {
    this.calendarService = new CalendarService(
      this,
      this.settings.refreshInterval
    );
    this.noteService = new NoteService(this.app, this.settings);
  }

  private registerViews() {
    this.registerView(
      MEMOCHRON_VIEW_TYPE,
      (leaf) => (this.calendarView = new CalendarView(leaf, this))
    );
  }

  private registerCommands() {
    this.addCommand({
      id: "force-refresh-calendars",
      name: "Force refresh calendars",
      callback: () => this.refreshCalendarView(true),
    });

    this.addCommand({
      id: "go-to-today",
      name: "Go to today",
      callback: () => this.goToToday(),
    });

    this.addCommand({
      id: "toggle-calendar",
      name: "Toggle calendar visibility",
      callback: () => this.toggleCalendar(),
    });
  }

  onunload() {
    this.clearRefreshTimer();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.migrateCalendarColors();
  }

  private migrateCalendarColors() {
    // No longer automatically assign colors - this is now opt-in
    // Remove this migration in future versions once users have had time to upgrade
    this.settings.calendarUrls.forEach((source) => {
      // If the source has a color but no useColor flag, assume they were using colors before
      if (source.color && source.useColor === undefined) {
        source.useColor = true;
      }
    });
  }

  private getDefaultCalendarColor(index: number): string {
    return getDefaultCalendarColor(index);
  }

  async saveSettings() {
    await this.saveData(this.settings);

    if (this.calendarService) {
      this.setupAutoRefresh();
    }
    
    await this.refreshCalendarView();
  }

  private async activateView() {
    const existingLeaves = this.app.workspace.getLeavesOfType(MEMOCHRON_VIEW_TYPE);

    if (existingLeaves.length === 0) {
      await this.createCalendarView();
    }

    await this.refreshCalendarView();
  }

  private async createCalendarView() {
    const leaf = this.getOrCreateLeaf();
    
    if (leaf) {
      await leaf.setViewState({
        type: MEMOCHRON_VIEW_TYPE,
        active: true,
      });
    }
  }

  private getOrCreateLeaf() {
    const rightLeaf = this.app.workspace.getRightLeaf(false);
    return rightLeaf || this.app.workspace.getLeaf("split", "vertical");
  }

  async refreshCalendarView(forceRefresh = false) {
    if (this.calendarView) {
      await this.calendarView.refreshEvents(forceRefresh);
    }
  }

  private async goToToday() {
    if (this.calendarView) {
      await this.calendarView.goToToday();
    }
  }

  private async toggleCalendar() {
    this.settings.hideCalendar = !this.settings.hideCalendar;
    await this.saveSettings();
    if (this.calendarView) {
      this.calendarView.toggleCalendarVisibility();
    }
  }

  private setupAutoRefresh() {
    this.clearRefreshTimer();
    
    const intervalMs = this.settings.refreshInterval * 60 * 1000;
    this.refreshTimer = window.setInterval(
      () => this.refreshCalendarView(),
      intervalMs
    );
  }

  private clearRefreshTimer() {
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
