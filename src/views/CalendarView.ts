import { ItemView, WorkspaceLeaf, Notice, TFile, DropdownComponent, setIcon, Menu, MenuItem } from "obsidian";
import { CalendarEvent } from "../services/CalendarService";
import MemoChron from "../main";
import { MEMOCHRON_VIEW_TYPE } from "../utils/constants";
import { IcsImportService } from "../services/IcsImportService";
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
  private handleDragMoveBound: (e: MouseEvent) => void;
  private handleDragEndBound: (e: MouseEvent) => void;
  private viewMode: CalendarViewMode = 'month';

  constructor(leaf: WorkspaceLeaf, private plugin: MemoChron) {
    super(leaf);
    this.currentDate = new Date();
  }

  getViewType(): string {
    return MEMOCHRON_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "MemoChron calendar";
  }

  getIcon(): string {
    return "calendar-range";
  }

  async onOpen() {
    this.createUI();
    this.registerViewEvents();
    this.loadDailyNotes();
    await this.refreshEvents();

    // If calendar is hidden, show today's agenda
    if (this.plugin.settings.hideCalendar) {
      this.selectedDate = new Date();
      await this.showDayAgenda(this.selectedDate);
    } else {
      await this.goToToday();
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
    this.showDayAgenda(dateToShow);
  }

  updateColors() {
    // Update event colors in memory without fetching
    this.updateEventColors();

    // Re-render the calendar view with new colors
    this.renderCalendar();

    // Re-render the agenda with new colors
    const dateToShow = this.selectedDate || new Date();
    this.showDayAgenda(dateToShow);
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
        this.dailyNotes.set(dateStr, file as TFile);
      });
    } catch (error) {
      console.error("Failed to load daily notes:", error);
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
      console.error("Error checking daily note:", error);
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
      this.calendar.style.height = `${this.plugin.settings.calendarHeight} px`;
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
          this.refreshEvents();
        }
      })
    );

    this.isViewEventsRegistered = true;
  }

  private async navigate(delta: number) {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    } else {
      const weeks = this.viewMode as number;
      this.currentDate.setDate(this.currentDate.getDate() + (weeks * 7 * delta));
    }
    await this.refreshEvents();
  }

  async goToToday() {
    const today = new Date();

    if (!this.isSameMonth(this.currentDate, today)) {
      this.currentDate = today;
      await this.refreshEvents();
    }

    this.selectDate(today);
  }

  private isSameMonth(date1: Date, date2: Date): boolean {
    return (
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
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
      this.renderWeekDays(grid, this.viewMode as number);
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
        if (hasDailyNote) {
          const dailyNoteDot = dotsContainer.createEl("div", {
            cls: "memochron-event-dot daily-note-dot colored",
          });
          const dailyNoteColor =
            this.plugin.settings.dailyNoteColor ||
            getComputedStyle(document.documentElement)
              .getPropertyValue("--interactive-accent")
              .trim() ||
            "#7c3aed";
          dailyNoteDot.style.color = dailyNoteColor;
        }

        // Add a colored dot for each calendar that has events
        eventsBySource.forEach((event) => {
          const dot = dotsContainer.createEl("div", {
            cls: "memochron-event-dot colored",
          });
          if (event.color) {
            dot.style.color = event.color;
          }
        });
      } else {
        // Create container for multiple dots even when colors are disabled
        const dotsContainer = dayEl.createEl("div", {
          cls: "memochron-event-dots-container",
        });

        // Add daily note dot if exists (show on calendar even if not shown in agenda)
        if (hasDailyNote) {
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
    }
  }

  private addDayClickHandler(dayEl: HTMLElement, date: Date) {
    dayEl.addEventListener("touchstart", () => { }, { passive: false });
    dayEl.addEventListener("click", () => this.selectDate(date));
    dayEl.addEventListener("dblclick", () => this.handleDayDoubleClick(date));
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
        getComputedStyle(document.documentElement)
          .getPropertyValue("--interactive-accent")
          .trim() ||
        "#7c3aed";
      dailyNoteEl.style.setProperty("--event-color", dailyNoteColor);
    }

    // Add title first
    dailyNoteEl.createEl("div", {
      cls: "memochron-event-title",
      text: "Daily Note",
    });

    // Add icon below like a location
    dailyNoteEl.createEl("div", {
      cls: "memochron-event-location",
      text: "📝 Open daily note",
    });

    // Add click handler to open or create daily note
    dailyNoteEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.handleDailyNoteClick(date);
    });
  }

  private async handleDailyNoteClick(date: Date) {
    try {
      // Check if daily notes plugin is loaded
      if (!appHasDailyNotesPluginLoaded()) {
        new Notice(
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
      if (dailyNote) {
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.openFile(dailyNote);
      }
    } catch (error) {
      console.error("Failed to handle daily note:", error);
      new Notice(
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

    eventEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await this.showEventDetails(event);
      } catch (error) {
        console.error("Failed to create note:", error);
        new Notice("Failed to create note. Check the console for details.");
      }
    });
  }

  private async showEventDetails(event: CalendarEvent) {
    if (!this.plugin.settings.noteLocation) {
      new Notice("Please set a note location in settings first");
      return;
    }

    let file = this.plugin.noteService.getExistingEventNote(event);
    const isNewNote = !file;

    if (!file) {
      file = await this.plugin.noteService.createEventNote(event);
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
  }

  toggleCalendarVisibility() {
    this.updateCalendarVisibility();
  }

  private updateCalendarVisibility() {
    const controls = this.containerEl.querySelector(
      ".memochron-controls"
    ) as HTMLElement;

    if (this.plugin.settings.hideCalendar) {
      this.calendar.style.display = "none";
      if (this.resizeHandle) this.resizeHandle.style.display = "none";
      if (controls) {
        controls.style.display = "none";
      }
      this.agenda.classList.add("agenda-only");
    } else {
      this.calendar.style.display = "";
      if (this.resizeHandle) this.resizeHandle.style.display = "";
      if (controls) {
        controls.style.display = "";
      }
      this.agenda.classList.remove("agenda-only");
    }
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

    this.agenda.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.agenda.removeClass("drag-over");

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // Handle only the first file
      const file = files[0];

      // Check if it's an ICS file
      if (!file.name.endsWith(".ics")) {
        new Notice("Please drop an ICS calendar file");
        return;
      }

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
        console.error("Failed to import ICS file:", error);
        new Notice(`Failed to import: ${error.message}`);
      }
    });
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

  private handleDragStart(e: MouseEvent) {
    e.preventDefault();
    this.dragStartY = e.clientY;
    this.dragStartHeight = this.calendar.offsetHeight;
    this.resizeHandle.addClass("dragging");

    window.addEventListener("mousemove", this.handleDragMoveBound);
    window.addEventListener("mouseup", this.handleDragEndBound);
  }

  private handleDragMove(e: MouseEvent) {
    const deltaY = e.clientY - this.dragStartY;
    const newHeight = Math.max(100, this.dragStartHeight + deltaY); // Min height 100px
    this.calendar.style.height = `${newHeight}px`;
  }

  private async handleDragEnd(e: MouseEvent) {
    this.resizeHandle.removeClass("dragging");
    window.removeEventListener("mousemove", this.handleDragMoveBound);
    window.removeEventListener("mouseup", this.handleDragEndBound);

    // Save height setting
    this.plugin.settings.calendarHeight = this.calendar.offsetHeight;
    await this.plugin.saveSettings();
  }

}
