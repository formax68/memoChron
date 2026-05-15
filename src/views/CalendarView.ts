import { ItemView, WorkspaceLeaf, Notice, TFile, DropdownComponent, setIcon, MarkdownView, Menu, MenuItem } from "obsidian";
import { CalendarEvent } from "../services/CalendarService";
import MemoChron from "../main";
import { MEMOCHRON_VIEW_TYPE } from "../utils/constants";
import { IcsImportService } from "../services/IcsImportService";
import { errorMessage } from "../utils/errors";
import {
  createDailyNote,
  getDailyNote,
  getAllDailyNotes,
  appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";

interface DateElements {
  [key: string]: HTMLElement;
}

type CalendarViewMode = 'month' | 1 | 2 | 3 | 4 | 5;

export class CalendarView extends ItemView {
  private calendar: HTMLElement;
  private agenda: HTMLElement;
  private currentDate: Date;
  private selectedDate: Date | null = null;
  private currentMonthDays: Map<string, HTMLElement> = new Map();
  private isViewEventsRegistered = false;
  private dailyNotes: Map<string, TFile> = new Map();
  private resizeHandle: HTMLElement;
  private dragStartY: number;
  private dragStartHeight: number;
  private handleDragMoveBound: ((e: MouseEvent) => void) | undefined = undefined;
  private handleDragEndBound: ((e: MouseEvent) => void) | undefined = undefined;
  private isDragging = false;
  private startupTimer: number | null = null;
  private viewMode: CalendarViewMode = 'month';

  constructor(leaf: WorkspaceLeaf, private plugin: MemoChron) {
    super(leaf);
    this.currentDate = new Date();
  }

  getViewType(): string {
    return MEMOCHRON_VIEW_TYPE;
  }

  getDisplayText(): string {
    // eslint-disable-next-line obsidianmd/ui/sentence-case -- proper noun: MemoChron
    return "MemoChron calendar";
  }

  getIcon(): string {
    return "calendar-range";
  }

  protected async onClose(): Promise<void> {
    if (this.isDragging && this.handleDragMoveBound && this.handleDragEndBound) {
      window.removeEventListener("mousemove", this.handleDragMoveBound);
      window.removeEventListener("mouseup", this.handleDragEndBound);
      this.isDragging = false;
    }
    if (this.startupTimer !== null) {
      window.clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
  }

  async onOpen() {
    this.createUI();
    this.registerViewEvents();
    this.loadDailyNotes();

    // If we have a saved height, we should try to determine the best view mode for it
    if (this.plugin.settings.calendarHeight && !this.plugin.settings.hideCalendar) {
      // Use efficient timeout to allow DOM to settle.
      // Owned-handle pattern (IN-02): View.registerInterval calls clearInterval
      // at unload — on iOS WKWebView clearInterval on a setTimeout ID is
      // implementation-defined. Store the handle, clear it with
      // window.clearTimeout in onClose.
      this.startupTimer = window.setTimeout(() => {
        this.startupTimer = null;
        const today = new Date();
        this.selectedDate = today;
        this.currentDate = today;
        // Render first to ensure we can measure row heights
        this.renderCalendar();
        this.recalculateViewModeFromHeight(this.plugin.settings.calendarHeight);
        void this.refreshEvents();
      }, 50);
    } else {
      await this.refreshEvents();
    }

    // If calendar is hidden, show today's agenda
    if (this.plugin.settings.hideCalendar) {
      this.selectedDate = new Date();
      await this.showDayAgenda(this.selectedDate);
    } else if (!this.plugin.settings.calendarHeight) {
      this.goToToday();
    }
  }

  async refreshEvents(forceRefresh = false) {
    await this.plugin.calendarService.fetchCalendars(
      this.plugin.settings.calendarUrls,
      forceRefresh
    );

    // Reload daily notes
    this.loadDailyNotes();

    this.renderCalendar();

    // Update calendar visibility based on current settings
    this.updateCalendarVisibility();

    // Always show agenda for selected date or today
    const dateToShow = this.selectedDate || new Date();
    void this.showDayAgenda(dateToShow);
  }

  updateColors() {
    // Update event colors in memory without fetching
    this.updateEventColors();

    // Re-render the calendar view with new colors
    this.renderCalendar();

    // Re-render the agenda with new colors
    const dateToShow = this.selectedDate || new Date();
    void this.showDayAgenda(dateToShow);
  }

  private loadDailyNotes() {
    // Clear existing daily notes
    this.dailyNotes.clear();

    // Check if daily notes plugin is loaded
    if (!appHasDailyNotesPluginLoaded()) {
      return;
    }

    try {
      // Get all daily notes
      const allDailyNotes = getAllDailyNotes();

      // Store them in our map with date as key
      Object.entries(allDailyNotes).forEach(([dateStr, file]) => {
        if (file instanceof TFile) {
          this.dailyNotes.set(dateStr, file);
        }
      });
    } catch (error) {
      console.error("Failed to load daily notes:", errorMessage(error));
    }
  }

  private checkDailyNoteForDate(date: Date): boolean {
    if (!appHasDailyNotesPluginLoaded()) {
      return false;
    }

    try {
      const moment = (window as any).moment;
      if (!moment) {
        return false;
      }

      const momentDate = moment(date);
      const allDailyNotes = getAllDailyNotes();
      const dailyNote = getDailyNote(momentDate, allDailyNotes);

      return dailyNote !== null;
    } catch (error) {
      console.error("Error checking daily note:", errorMessage(error));
      return false;
    }
  }

  private updateEventColors() {
    // Update colors for all cached events based on current settings
    const events = this.plugin.calendarService.getAllEvents();
    const calendarMap = new Map(
      this.plugin.settings.calendarUrls.map((source) => [source.url, source])
    );

    events.forEach((event) => {
      const calendar = calendarMap.get(event.sourceId);
      if (calendar) {
        event.color = this.plugin.settings.enableCalendarColors
          ? calendar.color
          : undefined;
      }
    });
  }

  private createUI() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    const controls = this.createControls(container);
    this.calendar = container.createEl("div", { cls: "memochron-calendar" });

    // Apply saved height
    if (this.plugin.settings.calendarHeight) {
      this.calendar.setCssProps({ height: `${this.plugin.settings.calendarHeight}px` });
    }

    // Create resize handle
    this.resizeHandle = container.createEl("div", {
      cls: "memochron-drag-handle",
    });
    this.resizeHandle.addEventListener("mousedown", (e) =>
      this.handleDragStart(e)
    );

    this.agenda = container.createEl("div", { cls: "memochron-agenda" });

    this.handleDragMoveBound = this.handleDragMove.bind(this);
    this.handleDragEndBound = this.handleDragEnd.bind(this);

    this.updateCalendarVisibility();
    this.setupDragAndDrop();
  }

  private createControls(container: HTMLElement): HTMLElement {
    const controls = container.createEl("div", { cls: "memochron-controls" });

    // Create navigation container
    const nav = controls.createEl("div", { cls: "memochron-nav" });

    nav.createEl("span", { cls: "memochron-title" });

    // View Options Button (Menu)
    const viewOptionsBtn = controls.createEl("div", {
      cls: "memochron-nav-link clickable-icon",
      attr: { "aria-label": "View options" }
    });
    setIcon(viewOptionsBtn, "layout-grid");

    viewOptionsBtn.onclick = (e: MouseEvent) => {
      this.showViewMenu(e, viewOptionsBtn);
    };

    const navButtons = nav.createEl("div", { cls: "memochron-nav-buttons" });
    this.createNavButton(navButtons, "chevron-left", () => this.navigate(-1), true);
    this.createNavButton(navButtons, "Today", () => this.goToToday(), false);
    this.createNavButton(navButtons, "chevron-right", () => this.navigate(1), true);

    return controls;
  }

  private showViewMenu(event: MouseEvent, target: HTMLElement) {
    const menu = new Menu();

    const addOption = (label: string, value: CalendarViewMode) => {
      menu.addItem((item: MenuItem) => {
        item
          .setTitle(label)
          .setChecked(this.viewMode === value)
          .onClick(async () => {
            if (this.viewMode !== value) {
              this.viewMode = value;
              await this.refreshEvents();
              await this.snapToCurrentViewMode();
            }
          });
      });
    };

    addOption("Month", "month");
    menu.addSeparator();
    addOption("1 Week", 1);
    addOption("2 Weeks", 2);
    addOption("3 Weeks", 3);
    addOption("4 Weeks", 4);
    addOption("5 Weeks", 5);

    menu.showAtMouseEvent(event);
  }


  private createNavButton(
    parent: HTMLElement,
    content: string,
    onClick: () => void,
    isIcon: boolean
  ) {
    const button = parent.createEl("div", {
      cls: "memochron-nav-link clickable-icon", // clickable-icon gives standard Obsidian icon behavior
      attr: { "aria-label": isIcon ? (content === "chevron-left" ? "Previous" : "Next") : content }
    });

    if (isIcon) {
      setIcon(button, content);
    } else {
      button.setText(content);
      button.addClass("text-button"); // Helper class for text buttons
    }

    button.onclick = onClick;
  }

  private registerViewEvents() {
    if (this.isViewEventsRegistered) return;

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (this.leaf.view === this) {
          void this.refreshEvents();
        }
      })
    );

    this.isViewEventsRegistered = true;
  }

  private maybeBackgroundRefresh(): void {
    // BUG-02 (D-05): fire-and-forget background fetch. fetchCalendars short-circuits
    // internally when needsRefresh() is false, and fetchInFlight (Phase 2 D-12)
    // dedups against the setupAutoRefresh interval timer. The `void` prefix marks
    // the Promise as intentionally unhandled at the call site; the .then/.catch
    // chain handles re-render and error logging.
    // WR-03: capture currentDate.getTime() (NOT identity) for the staleness
    // guard. navigate() mutates this.currentDate in place via setMonth/setDate,
    // so a strict-identity check would miss a navigate-while-fetching race.
    // Comparing the timestamp catches both the in-place mutation paths and
    // the goToToday replacement path.
    const targetTime = this.currentDate.getTime();
    void this.plugin.calendarService
      .fetchCalendars(this.plugin.settings.calendarUrls, false)
      .then(() => {
        // Bail if the user has navigated since this fetch started; the
        // newer navigation already rendered + kicked off its own background
        // refresh, and painting the older result on top would cause a
        // phantom revert flicker on slow networks.
        if (this.currentDate.getTime() !== targetTime) return;
        // Re-render so any newly-fetched events appear.
        this.loadDailyNotes();
        this.renderCalendar();
        const dateToShow = this.selectedDate || new Date();
        // WR-03: showDayAgenda is async; mark the inner call as
        // intentionally unawaited so a future async leaf surfaces errors
        // through the surrounding .catch rather than unhandledrejection.
        void this.showDayAgenda(dateToShow);
      })
      .catch((error) => {
        console.error("MemoChron: background refresh failed:", errorMessage(error));
      });
  }

  private renderCurrentRange(): void {
    this.renderCalendar();
    const dateToShow = this.selectedDate || new Date();
    void this.showDayAgenda(dateToShow);
  }

  private navigate(delta: number): void {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    } else {
      const weeks = this.viewMode as number;
      this.currentDate.setDate(this.currentDate.getDate() + (weeks * 7 * delta));
    }

    // BUG-02 (D-04): render synchronously from the in-memory event cache.
    // No await, no I/O, no perceptible delay between click and paint.
    this.renderCurrentRange();

    // BUG-02 (D-05): kick off a stale-cache background fetch through fetchCalendars,
    // which is deduped against the auto-refresh interval via fetchInFlight (Phase 2).
    this.maybeBackgroundRefresh();
  }

  goToToday(): void {
    const today = new Date();

    // BUG-03 (D-08): always recenter — symmetric with navigate(). The previous
    // isSameMonth short-circuit was incorrect for week-mode views, where today
    // often falls in the current month but a different week. Today should
    // recenter the view-mode's current range, not just re-select the day.
    this.currentDate = today;

    // BUG-03 (D-09): viewMode is intentionally NOT modified. A user in 2-week
    // mode stays in 2-week mode, recentered on today's week (renderWeekDays
    // recomputes via getStartOfWeek(this.currentDate)).

    // BUG-02/BUG-03 (D-06): same decoupled pattern as navigate() — render
    // synchronously from cached events; fire-and-forget a stale-cache fetch.
    this.renderCalendar();
    void this.selectDate(today);     // sets selectedDate, updates UI selection, runs showDayAgenda
    this.maybeBackgroundRefresh();
  }

  private async selectDate(date: Date) {
    this.updateSelectedDateUI(date);
    this.selectedDate = date;
    await this.showDayAgenda(date);
  }

  private updateSelectedDateUI(newDate: Date) {
    if (this.selectedDate) {
      const prevEl = this.currentMonthDays.get(
        this.selectedDate.toDateString()
      );
      prevEl?.removeClass("selected");
    }

    const newEl = this.currentMonthDays.get(newDate.toDateString());
    newEl?.addClass("selected");
  }

  private renderCalendar() {
    if (this.plugin.settings.hideCalendar) {
      return;
    }

    this.calendar.empty();
    this.currentMonthDays.clear();

    this.updateTitle();

    // Add class for styling if week numbers are enabled
    if (this.plugin.settings.showWeekNumbers) {
      this.calendar.addClass("show-week-numbers");
    } else {
      this.calendar.removeClass("show-week-numbers");
    }

    const grid = this.createCalendarGrid();
    this.renderWeekdayHeaders(grid);

    if (this.viewMode === 'month') {
      this.renderMonthDays(grid);
    } else {
      this.renderWeekDays(grid, this.viewMode);
    }
  }

  private renderWeekDays(grid: HTMLElement, weeks: number) {
    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const today = new Date().toDateString();
    const showWeekNumbers = this.plugin.settings.showWeekNumbers;

    for (let w = 0; w < weeks; w++) {
      const weekStartDate = new Date(startOfWeek);
      weekStartDate.setDate(weekStartDate.getDate() + (w * 7));

      if (showWeekNumbers) {
        this.renderWeekNumber(grid, weekStartDate);
      }

      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStartDate);
        date.setDate(date.getDate() + d);
        this.renderDay(grid, date, today);
      }
    }
  }

  /**
   * Compute the start-of-week date for the given date, given the user's
   * `firstDayOfWeek` setting (0 = Sunday ... 6 = Saturday).
   *
   * The formula `d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay` is
   * non-obvious but correct for all 49 (firstDay, day) cells. Verified by the
   * 49-cell trace at .planning/phases/02-security-correctness/02-04-SUMMARY.md
   * (BUG-05 — formula correct-but-non-obvious; see also CONCERNS.md "Known Bugs").
   *
   * Equivalent simpler form is `((day - firstDay + 7) % 7)`:
   *   diff = d.getDate() - ((day - firstDay + 7) % 7)
   * Kept the original formula to minimize diff; the simpler form would be a
   * pure-style refactor for a future cleanup pass.
   *
   * @param date Reference date (not mutated)
   * @returns Date object representing the start of the week containing `date`
   */
  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const firstDay = this.plugin.settings.firstDayOfWeek;
    const diff = d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay;
    return new Date(d.setDate(diff));
  }

  private updateTitle() {
    const titleEl = this.containerEl.querySelector(".memochron-title");
    if (titleEl) {
      titleEl.textContent = this.currentDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
    }
  }

  private createCalendarGrid(): HTMLElement {
    return this.calendar.createEl("div", {
      cls: "memochron-calendar-grid",
    });
  }

  private renderWeekdayHeaders(grid: HTMLElement) {
    if (this.plugin.settings.showWeekNumbers) {
      grid.createEl("div", {
        cls: "memochron-weekday week-number-header",
        text: "Wk",
      });
    }

    const weekdays = this.getReorderedWeekdays();
    weekdays.forEach((day) => {
      grid.createEl("div", {
        cls: "memochron-weekday",
        text: day,
      });
    });
  }

  private getReorderedWeekdays(): string[] {
    const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const firstDay = this.plugin.settings.firstDayOfWeek;
    return [...weekdays.slice(firstDay), ...weekdays.slice(0, firstDay)];
  }

  private renderMonthDays(grid: HTMLElement) {
    const { year, month } = this.getYearMonth();
    const { firstDayOffset, daysInMonth } = this.getMonthInfo(year, month);
    const showWeekNumbers = this.plugin.settings.showWeekNumbers;

    let currentDayOfWeek = 0;

    // Render first week number
    if (showWeekNumbers) {
      const firstDate = new Date(year, month, 1);
      this.renderWeekNumber(grid, firstDate);
    }

    this.renderEmptyDays(grid, firstDayOffset);
    currentDayOfWeek += firstDayOffset;

    const today = new Date().toDateString();

    for (let day = 1; day <= daysInMonth; day++) {
      if (currentDayOfWeek >= 7) {
        currentDayOfWeek = 0;
        if (showWeekNumbers) {
          const currentDate = new Date(year, month, day);
          this.renderWeekNumber(grid, currentDate);
        }
      }

      const date = new Date(year, month, day);
      this.renderDay(grid, date, today);
      currentDayOfWeek++;
    }
  }

  private renderWeekNumber(grid: HTMLElement, date: Date) {
    const moment = (window as any).moment;
    let weekNum = "?";

    if (moment) {
      weekNum = String(moment(date).week());
    }

    grid.createEl("div", {
      cls: "memochron-week-number",
      text: weekNum,
    });
  }

  private getYearMonth() {
    return {
      year: this.currentDate.getFullYear(),
      month: this.currentDate.getMonth(),
    };
  }

  private getMonthInfo(year: number, month: number) {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let firstDayOffset =
      firstDayOfMonth.getDay() - this.plugin.settings.firstDayOfWeek;
    if (firstDayOffset < 0) firstDayOffset += 7;

    return {
      firstDayOffset,
      daysInMonth: lastDayOfMonth.getDate(),
    };
  }

  private renderEmptyDays(grid: HTMLElement, count: number) {
    for (let i = 0; i < count; i++) {
      grid.createEl("div", { cls: "memochron-day empty" });
    }
  }


  private renderDay(grid: HTMLElement, date: Date, todayString: string) {
    const dateString = date.toDateString();
    const dayEl = this.createDayElement(grid, date, dateString === todayString);

    this.currentMonthDays.set(dateString, dayEl);

    if (this.selectedDate?.toDateString() === dateString) {
      dayEl.addClass("selected");
    }

    this.addDayEventIndicator(dayEl, date);
    this.addDayClickHandler(dayEl, date);
  }

  private createDayElement(
    grid: HTMLElement,
    date: Date,
    isToday: boolean
  ): HTMLElement {
    const dayEl = grid.createEl("div", { cls: "memochron-day" });

    if (isToday) {
      dayEl.addClass("today");
    }

    dayEl.createEl("div", {
      cls: "memochron-day-header",
      text: String(date.getDate()),
    });

    return dayEl;
  }

  private addDayEventIndicator(dayEl: HTMLElement, date: Date) {
    const events = this.plugin.calendarService.getEventsForWidget(date);
    const hasDailyNote = this.checkDailyNoteForDate(date);

    if (events.length > 0 || hasDailyNote) {
      dayEl.addClass("has-events");

      if (this.plugin.settings.enableCalendarColors) {
        // Group events by calendar source to show one dot per calendar
        const eventsBySource = new Map<string, CalendarEvent>();
        events.forEach((event) => {
          if (!eventsBySource.has(event.sourceId)) {
            eventsBySource.set(event.sourceId, event);
          }
        });

        // Create a container for dots
        const dotsContainer = dayEl.createEl("div", {
          cls: "memochron-event-dots-container",
        });

        // Add daily note dot first if it exists (show on calendar even if not shown in agenda)
        if (hasDailyNote && this.plugin.settings.showDailyNoteInAgenda) {
          const dailyNoteDot = dotsContainer.createEl("div", {
            cls: "memochron-event-dot daily-note-dot colored",
          });
          const dailyNoteColor =
            this.plugin.settings.dailyNoteColor ||
            getComputedStyle(activeDocument.documentElement)
              .getPropertyValue("--interactive-accent")
              .trim() ||
            "#7c3aed";
          dailyNoteDot.setCssProps({ color: dailyNoteColor });
        }

        // Add a colored dot for each calendar that has events
        eventsBySource.forEach((event) => {
          const dot = dotsContainer.createEl("div", {
            cls: "memochron-event-dot colored",
          });
          if (event.color) {
            dot.setCssProps({ color: event.color });
          }
        });
      } else {
        // Create container for multiple dots even when colors are disabled
        const dotsContainer = dayEl.createEl("div", {
          cls: "memochron-event-dots-container",
        });

        // Add daily note dot if exists (show on calendar even if not shown in agenda)
        if (hasDailyNote && this.plugin.settings.showDailyNoteInAgenda) {
          dotsContainer.createEl("div", {
            cls: "memochron-event-dot daily-note-dot",
          });
        }

        // Add event dot if there are events
        if (events.length > 0) {
          dotsContainer.createEl("div", {
            cls: "memochron-event-dot",
          });
        }
      }

      // Note indicator corner-square (ENH-03)
      if (
        this.plugin.settings.showNoteIndicatorOnGrid &&
        events.some((e) => this.plugin.noteService.getExistingEventNote(e) !== null)
      ) {
        dayEl.createEl("div", { cls: "memochron-note-indicator" });
      }
    }
  }

  private addDayClickHandler(dayEl: HTMLElement, date: Date) {
    dayEl.addEventListener("touchstart", () => { }, { passive: false });
    dayEl.addEventListener("click", () => { void this.selectDate(date); });
    dayEl.addEventListener("dblclick", () => { void this.handleDayDoubleClick(date); });
  }

  private async handleDayDoubleClick(date: Date) {
    // Open the daily note for the double-clicked date
    await this.handleDailyNoteClick(date);
  }

  private async showDayAgenda(date: Date) {
    this.agenda.empty();

    this.createAgendaHeader(date);

    const events = this.plugin.calendarService.getEventsForWidget(date);
    const hasEvents = events.length > 0;
    const showDailyNote = this.plugin.settings.showDailyNoteInAgenda;

    if (!hasEvents && !showDailyNote) {
      this.agenda.createEl("p", { text: "No events scheduled" });
      return;
    }

    const list = this.agenda.createEl("div", { cls: "memochron-agenda-list" });

    // Add daily note entry if enabled
    if (showDailyNote) {
      this.renderDailyNoteEntry(list, date);
    }

    // Add events
    if (hasEvents) {
      const now = new Date();
      events.forEach((event) => {
        this.renderEventItem(list, event, now);
      });
    }
  }

  private createAgendaHeader(date: Date) {
    this.agenda.createEl("h3", {
      text: date.toLocaleDateString("default", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    });
  }

  private renderDailyNoteEntry(list: HTMLElement, date: Date) {
    const dailyNoteEl = list.createEl("div", {
      cls: "memochron-agenda-event memochron-daily-note",
    });

    // Add a subtle accent color if calendar colors are enabled
    if (this.plugin.settings.enableCalendarColors) {
      dailyNoteEl.addClass("with-color");
      // Use the configured color or default to theme's accent color
      const dailyNoteColor =
        this.plugin.settings.dailyNoteColor ||
        getComputedStyle(activeDocument.documentElement)
          .getPropertyValue("--interactive-accent")
          .trim() ||
        "#7c3aed";
      dailyNoteEl.style.setProperty("--event-color", dailyNoteColor);
    }

    // Add title first
    dailyNoteEl.createEl("div", {
      cls: "memochron-event-title",
      // eslint-disable-next-line obsidianmd/ui/sentence-case -- proper noun: "Daily Note" refers to Obsidian's Daily Notes feature
      text: "Daily Note",
    });

    // Add icon below like a location
    dailyNoteEl.createEl("div", {
      cls: "memochron-event-location",
      text: "📝 Open daily note",
    });

    // Add click handler to open or create daily note
    dailyNoteEl.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.handleDailyNoteClick(date);
    });
  }

  private async handleDailyNoteClick(date: Date) {
    try {
      // Check if daily notes plugin is loaded
      if (!appHasDailyNotesPluginLoaded()) {
        new Notice(
          // eslint-disable-next-line obsidianmd/ui/sentence-case -- proper nouns: Daily Notes, Settings, Core plugins (Obsidian UI labels)
          "Daily Notes core plugin is not enabled. Please enable it in Settings > Core plugins."
        );
        return;
      }

      // Use moment for date handling (same as Obsidian's daily notes)
      const moment = (window as any).moment;
      if (!moment) {
        new Notice("Moment.js is not available");
        return;
      }

      const momentDate = moment(date);

      // Get all daily notes
      const allDailyNotes = getAllDailyNotes();

      // Check if daily note already exists
      let dailyNote = getDailyNote(momentDate, allDailyNotes);

      if (!dailyNote) {
        // Create the daily note if it doesn't exist
        dailyNote = await createDailyNote(momentDate);
      }

      // Open the daily note
      if (dailyNote instanceof TFile) {
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.openFile(dailyNote);
      }
    } catch (error) {
      console.error("Failed to handle daily note:", errorMessage(error));
      new Notice(
        // eslint-disable-next-line obsidianmd/ui/sentence-case -- proper noun: Daily Notes (Obsidian plugin name)
        "Failed to open daily note. Make sure Daily Notes plugin is enabled and configured."
      );
    }
  }

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
    this.renderEventNoteIndicator(eventEl, event);
    this.addEventClickHandler(eventEl, event);
  }

  private renderEventTime(eventEl: HTMLElement, event: CalendarEvent) {
    // Don't show times for all-day events
    if (event.isAllDay) {
      eventEl.createEl("div", {
        cls: "memochron-event-time all-day",
        text: "All day",
      });
    } else {
      const timeFormat: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        hour12: this.plugin.settings.noteTimeFormat === "12h",
      };

      eventEl.createEl("div", {
        cls: "memochron-event-time",
        text: `${event.start.toLocaleTimeString([], timeFormat)} - ${event.end.toLocaleTimeString([], timeFormat)}`,
      });
    }
  }

  private renderEventTitle(eventEl: HTMLElement, event: CalendarEvent) {
    eventEl.createEl("div", {
      cls: "memochron-event-title",
      text: event.title,
    });
  }

  private renderEventLocation(eventEl: HTMLElement, event: CalendarEvent) {
    if (!event.location) return;

    const icon = this.getLocationIcon(event.location);

    eventEl.createEl("div", {
      cls: "memochron-event-location",
      text: `${icon} ${event.location}`,
    });
  }

  private renderEventNoteIndicator(eventEl: HTMLElement, event: CalendarEvent): void {
    const iconEl = eventEl.createEl("div", { cls: "memochron-event-note-indicator" });
    setIcon(iconEl, this.plugin.noteService.getExistingEventNote(event) !== null ? "file-check" : "file-plus");
  }

  private getLocationIcon(location: string): string {
    if (this.isUrl(location)) return "🔗";
    if (this.isVirtualMeeting(location)) return "💻";
    return "📍";
  }

  private isUrl(location: string): boolean {
    return /^(https?:\/\/|www\.)/.test(location);
  }

  private isVirtualMeeting(location: string): boolean {
    const virtualKeywords = ["zoom", "meet.", "teams", "webex"];
    const lowerLocation = location.toLowerCase();
    return virtualKeywords.some((keyword) => lowerLocation.includes(keyword));
  }

  private addEventClickHandler(eventEl: HTMLElement, event: CalendarEvent) {
    eventEl.addEventListener("touchstart", () => { }, { passive: false });

    eventEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showEventDetails(event).catch((error) => {
        console.error("Failed to create note:", errorMessage(error));
        new Notice("Failed to create note. Check the console for details.");
      });
    });
  }

  private async showEventDetails(event: CalendarEvent) {
    if (!this.plugin.settings.noteLocation) {
      new Notice("Please set a note location in settings first");
      return;
    }

    let file = this.plugin.noteService.getExistingEventNote(event);
    const isNewNote = !file;
    let cursorPos: { line: number; ch: number } | null = null;

    if (!file) {
      const created = await this.plugin.noteService.createEventNote(event);
      file = created.file;
      cursorPos = created.cursor;
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

    if (isNewNote) {
      const createdFile = file;
      if (cursorPos !== null && createdFile) {
        const pos = cursorPos;
        const file = createdFile;
        window.requestAnimationFrame(() => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (view?.editor && view.file?.path === file.path) {
            view.editor.setCursor(pos);
            view.editor.focus();
          }
        });
      }
      this.renderCalendar();
      void this.showDayAgenda(this.selectedDate || new Date());
    }
  }

  toggleCalendarVisibility() {
    this.updateCalendarVisibility();
  }

  private updateCalendarVisibility() {
    const controls = this.containerEl.querySelector(
      ".memochron-controls"
    ) as HTMLElement;

    const hide = this.plugin.settings.hideCalendar;
    this.calendar.classList.toggle("memochron-hidden", hide);
    if (this.resizeHandle) this.resizeHandle.classList.toggle("memochron-hidden", hide);
    if (controls) controls.classList.toggle("memochron-hidden", hide);
    this.agenda.classList.toggle("agenda-only", hide);
  }

  private setupDragAndDrop() {
    if (!this.agenda) return;

    // Prevent default drag behavior
    this.agenda.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.agenda.addClass("drag-over");
    });

    this.agenda.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only remove class if we're leaving the agenda entirely
      if (e.target === this.agenda) {
        this.agenda.removeClass("drag-over");
      }
    });

    this.agenda.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.agenda.removeClass("drag-over");

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // Handle only the first file
      const file = files[0];

      // Check if it's an ICS file
      if (!file.name.endsWith(".ics")) {
        // eslint-disable-next-line obsidianmd/ui/sentence-case -- acronym: ICS (iCalendar format)
        new Notice("Please drop an ICS calendar file");
        return;
      }

      void this.handleIcsFileDrop(file);
    });
  }

  private async handleIcsFileDrop(file: File): Promise<void> {
    try {
      // Read the file content
      const content = await this.readFile(file);

      // Parse and validate single event
      const filteredAttendeesList = (this.plugin.settings.filteredAttendees || "")
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter((name) => name.length > 0);
      const event = IcsImportService.parseSingleEvent(
        content,
        this.plugin.settings.filteredCuTypes,
        filteredAttendeesList
      );

      // Create note from the event
      await this.createNoteFromImportedEvent(event);

      new Notice(`Note created for: ${event.title}`);
    } catch (error) {
      const message = errorMessage(error);
      console.error("Failed to import ICS file:", message);
      new Notice(`Failed to import: ${message}`);
    }
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };
      reader.readAsText(file);
    });
  }

  private async createNoteFromImportedEvent(event: CalendarEvent) {
    // Use the existing note creation logic
    await this.showEventDetails(event);
  }

  // --- Dynamic Resizing Methods ---

  private measureRowHeight(): number {
    const day = this.calendar.querySelector('.memochron-day');
    return day ? (day as HTMLElement).offsetHeight : 0;
  }

  private measureHeaderHeight(): number {
    // Header includes weekday headers + any padding/margins of the grid if relevant
    const header = this.calendar.querySelector('.memochron-weekday');
    return header ? (header as HTMLElement).offsetHeight : 0;
  }

  private measureTitleHeight(): number {
    // If title is part of the measured height we care about
    // But drag handle resizes this.calendar, which contains title inside? 
    // Wait, createUI says: calendar = container.createEl("div", { cls: "memochron-calendar" });
    // And renderCalendar empties this.calendar and adds title + grid.
    // So title is inside.
    const title = this.calendar.querySelector('.memochron-title'); // Assuming title is inside?
    // Actually renderCalendar calls updateTitle which finds .memochron-title in containerEl, NOT in this.calendar
    // Let's check createControls... nav has title. createControls is sibling to calendar.
    // So this.calendar ONLY contains the grid.
    // BUT renderCalendar implementation:
    // this.calendar.empty(); ... this.updateTitle(); ... const grid = this.createCalendarGrid();
    // updateTitle() looks for .memochron-title in containerEl.
    // So this.calendar effectively only contains the grid (and maybe padding).

    // Let's check CSS. .memochron-calendar has padding.
    return 0;
  }

  private calculateWeeksThatFit(totalHeight: number): number {
    // We need to account for calendar padding
    const style = getComputedStyle(this.calendar);
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;

    const availableHeight = totalHeight - paddingTop - paddingBottom;
    const headerHeight = this.measureHeaderHeight();
    const rowHeight = this.measureRowHeight();

    if (rowHeight === 0) return 4; // Fallback

    const availableForRows = availableHeight - headerHeight;
    // We can fit N rows
    const weeks = Math.floor(availableForRows / rowHeight);

    return Math.max(1, weeks);
  }

  private recalculateViewModeFromHeight(height: number) {
    if (height < 100) return; // Ignore too small

    // If we can't measure yet, assume default
    if (this.measureRowHeight() === 0) return;

    const weeksThatFit = this.calculateWeeksThatFit(height);

    // Determine how many weeks are needed for the full month view
    // A month can span 4, 5, or 6 weeks.
    // Let's approximate: if it fits 6 weeks, it fits a month.
    // Even 5 weeks often fits a month.

    // Logic: If user drags such that we can show N weeks...
    // If N >= weeks in current month, switch to month view.
    // Else switch to N weeks view.

    const { year, month } = this.getYearMonth();
    const { firstDayOffset, daysInMonth } = this.getMonthInfo(year, month);
    // Calculate exact weeks needed for THIS month
    const days = firstDayOffset + daysInMonth;
    const weeksNeededForMonth = Math.ceil(days / 7);

    if (weeksThatFit >= weeksNeededForMonth) {
      if (this.viewMode !== 'month') {
        this.viewMode = 'month';
        // We don't call render here, caller does
      }
    } else {
      const newMode = Math.min(5, Math.max(1, weeksThatFit)) as CalendarViewMode;
      if (this.viewMode !== newMode) {
        this.viewMode = newMode;
      }
    }
  }

  private handleDragStart(e: MouseEvent) {
    e.preventDefault();
    this.isDragging = true;
    this.dragStartY = e.clientY;
    this.dragStartHeight = this.calendar.offsetHeight;
    this.resizeHandle.addClass("dragging");

    window.addEventListener("mousemove", this.handleDragMoveBound!);
    window.addEventListener("mouseup", this.handleDragEndBound!);
  }

  private handleDragMove(e: MouseEvent) {
    const deltaY = e.clientY - this.dragStartY;
    const newHeight = Math.max(100, this.dragStartHeight + deltaY);
    this.calendar.setCssProps({ height: `${newHeight}px` });

    // Dynamic View Switching
    // We only trigger if height changed significantly enough or periodically
    // Simple approach: just recalculate. 
    // To avoid flickering, maybe debounce or only change if different

    const oldMode = this.viewMode;
    this.recalculateViewModeFromHeight(newHeight);

    if (this.viewMode !== oldMode) {
      this.renderCalendar();
    }
  }

  private async handleDragEnd(e: MouseEvent) {
    this.isDragging = false;
    this.resizeHandle.removeClass("dragging");
    window.removeEventListener("mousemove", this.handleDragMoveBound!);
    window.removeEventListener("mouseup", this.handleDragEndBound!);

    await this.snapToCurrentViewMode();
  }

  private async snapToCurrentViewMode() {
    // Snap to nearest valid row height
    const rowHeight = this.measureRowHeight();
    const headerHeight = this.measureHeaderHeight();
    const style = getComputedStyle(this.calendar);
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);

    let weeks: number;
    if (this.viewMode === 'month') {
      const { year, month } = this.getYearMonth();
      const { firstDayOffset, daysInMonth } = this.getMonthInfo(year, month);
      weeks = Math.ceil((firstDayOffset + daysInMonth) / 7);
    } else {
      weeks = this.viewMode;
    }

    const idealHeight = padding + headerHeight + (weeks * rowHeight);

    // Animate snap if desired, or just set
    this.calendar.setCssProps({ height: `${idealHeight}px` });

    // Save height setting
    this.plugin.settings.calendarHeight = idealHeight;
    await this.plugin.saveSettings();
  }

}
