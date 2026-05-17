import { Plugin } from "obsidian";
import { CalendarService } from "./services/CalendarService";
import { NoteService } from "./services/NoteService";
import { CalendarView } from "./views/CalendarView";
import { SettingsTab } from "./settings/SettingsTab";
import { MemoChronSettings, DEFAULT_SETTINGS } from "./settings/types";
import { MEMOCHRON_VIEW_TYPE } from "./utils/constants";
import { EmbeddedCalendarView, parseCalendarCodeBlock } from "./views/EmbeddedCalendarView";
import { EmbeddedAgendaView, parseAgendaCodeBlock } from "./views/EmbeddedAgendaView";
import {
  isValidColor,
  defaultColorForIndex,
  defaultDailyNoteColor,
} from "./utils/colorValidation";

export default class MemoChron extends Plugin {
  settings: MemoChronSettings;
  calendarService: CalendarService;
  noteService: NoteService;
  private refreshTimer: number | null = null;
  private backgroundRefreshTimer: number | null = null;

  async onload() {
    await this.loadSettings();
    this.initializeServices();
    this.registerViews();
    this.registerCommands();
    this.registerCodeBlockProcessors();
    this.addSettingTab(new SettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      void this.activateView();
    });

    this.setupAutoRefresh();
  }

  private initializeServices() {
    this.calendarService = new CalendarService(this);
    this.noteService = new NoteService(this);
  }

  private registerViews() {
    this.registerView(
      MEMOCHRON_VIEW_TYPE,
      (leaf) => new CalendarView(leaf, this)
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

  private registerCodeBlockProcessors() {
    // Register calendar code block processor
    this.registerMarkdownCodeBlockProcessor(
      "memochron-calendar",
      (source, el, ctx) => {
        const params = parseCalendarCodeBlock(source);
        const filename = ctx.sourcePath ? ctx.sourcePath.split('/').pop() : undefined;
        const context = { filename };
        const calendarView = new EmbeddedCalendarView(el, this, params, context);
        ctx.addChild(calendarView);
      }
    );

    // Register agenda code block processor
    this.registerMarkdownCodeBlockProcessor(
      "memochron-agenda",
      (source, el, ctx) => {
        const params = parseAgendaCodeBlock(source);
        const filename = ctx.sourcePath ? ctx.sourcePath.split('/').pop() : undefined;
        const context = { filename };
        const agendaView = new EmbeddedAgendaView(el, this, params, context);
        ctx.addChild(agendaView);
      }
    );
  }

  onunload() {
    // Obsidian handles leaf cleanup automatically on disable/update; detaching here
    // would reset the user's leaf placement (per obsidianmd/detach-leaves rule + Plugin Guidelines).
    this.clearRefreshTimer();
    this.clearBackgroundRefreshTimer();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // SEC-01 (D-03, D-04): validate stored color values against the whitelist.
    // A maliciously crafted data.json can contain a color string designed to
    // break out of an SVG attribute context. Replace invalid values silently
    // (DIR-01: no console.warn — typical user can't act on it).
    this.settings.calendarUrls.forEach((source, index) => {
      if (source.color && !isValidColor(source.color)) {
        source.color = defaultColorForIndex(index);
      }
    });

    if (
      this.settings.dailyNoteColor &&
      !isValidColor(this.settings.dailyNoteColor)
    ) {
      this.settings.dailyNoteColor = defaultDailyNoteColor();
    }
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

  private getCalendarView(): CalendarView | null {
    const leaves = this.app.workspace.getLeavesOfType(MEMOCHRON_VIEW_TYPE);
    const view = leaves[0]?.view;
    return view instanceof CalendarView ? view : null;
  }

  async refreshCalendarView(forceRefresh = false) {
    const view = this.getCalendarView();
    if (!view) return;
    await view.refreshEvents(forceRefresh);
  }

  updateCalendarColors() {
    const view = this.getCalendarView();
    if (!view) return;
    view.updateColors();
  }

  private goToToday() {
    const view = this.getCalendarView();
    if (!view) return;
    view.goToToday();
  }

  async toggleCalendar() {
    this.settings.hideCalendar = !this.settings.hideCalendar;
    await this.saveSettings();
    const view = this.getCalendarView();
    if (!view) return;
    view.toggleCalendarVisibility();
  }

  private setupAutoRefresh() {
    this.clearRefreshTimer();

    const intervalMs = this.settings.refreshInterval * 60 * 1000;
    // Do NOT use registerInterval here. registerInterval appends the ID to
    // Plugin's internal cleanup list but never removes it — every settings
    // save would leak one stale numeric ID. onunload already calls
    // clearRefreshTimer (see line above), which covers shutdown. saveSettings
    // calls clearRefreshTimer + setupAutoRefresh together, which covers reset.
    // See WR-01 in 01-REVIEW.md.
    this.refreshTimer = window.setInterval(
      () => { void this.refreshCalendarView(); },
      intervalMs
    );
  }

  private clearRefreshTimer() {
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Owned by MemoChron so the one-shot timer can be cancelled with
   * window.clearTimeout in onunload. Plugin.registerInterval is NOT used
   * here because it calls clearInterval at unload, which is the wrong
   * cleanup API for a setTimeout handle on WKWebView (iOS) where the
   * setTimeout and setInterval ID pools are not guaranteed to be shared.
   * See CR-01.
   */
  setBackgroundRefreshTimer(callback: () => void, delayMs: number): void {
    if (this.backgroundRefreshTimer !== null) {
      window.clearTimeout(this.backgroundRefreshTimer);
    }
    this.backgroundRefreshTimer = window.setTimeout(() => {
      this.backgroundRefreshTimer = null;
      callback();
    }, delayMs);
  }

  private clearBackgroundRefreshTimer(): void {
    if (this.backgroundRefreshTimer !== null) {
      window.clearTimeout(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = null;
    }
  }
}
