import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { CalendarEvent } from "../services/CalendarService";
import MemoChron from "../main";
import { MEMOCHRON_VIEW_TYPE } from "../utils/constants";

interface DateElements {
  [key: string]: HTMLElement;
}

export class CalendarView extends ItemView {
  private calendar: HTMLElement;
  private agenda: HTMLElement;
  private currentDate: Date;
  private selectedDate: Date | null = null;
  private currentMonthDays: Map<string, HTMLElement> = new Map();
  private isViewEventsRegistered = false;

  constructor(
    leaf: WorkspaceLeaf, 
    private plugin: MemoChron
  ) {
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
    await this.refreshEvents();
    await this.goToToday();
  }

  async refreshEvents(forceRefresh = false) {
    await this.plugin.calendarService.fetchCalendars(
      this.plugin.settings.calendarUrls,
      forceRefresh
    );
    this.renderMonth();
    if (this.selectedDate) {
      this.showDayAgenda(this.selectedDate);
    }
  }

  private createUI() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    const controls = this.createControls(container);
    this.calendar = container.createEl("div", { cls: "memochron-calendar" });
    this.agenda = container.createEl("div", { cls: "memochron-agenda" });
  }

  private createControls(container: HTMLElement): HTMLElement {
    const controls = container.createEl("div", { cls: "memochron-controls" });
    const nav = controls.createEl("div", { cls: "memochron-nav" });

    nav.createEl("span", { cls: "memochron-title" });

    const navButtons = nav.createEl("div", { cls: "memochron-nav-buttons" });
    this.createNavButton(navButtons, "<", () => this.navigate(-1));
    this.createNavButton(navButtons, "Today", () => this.goToToday());
    this.createNavButton(navButtons, ">", () => this.navigate(1));

    return controls;
  }

  private createNavButton(
    parent: HTMLElement, 
    text: string, 
    onClick: () => void
  ) {
    const button = parent.createEl("span", {
      text,
      cls: "memochron-nav-link",
    });
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
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
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
      const prevEl = this.currentMonthDays.get(this.selectedDate.toDateString());
      prevEl?.removeClass("selected");
    }

    const newEl = this.currentMonthDays.get(newDate.toDateString());
    newEl?.addClass("selected");
  }

  private renderMonth() {
    this.calendar.empty();
    this.currentMonthDays.clear();

    this.updateTitle();
    const grid = this.createCalendarGrid();
    this.renderWeekdayHeaders(grid);
    this.renderMonthDays(grid);
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

    this.renderEmptyDays(grid, firstDayOffset);
    this.renderDays(grid, year, month, daysInMonth);
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
    
    let firstDayOffset = firstDayOfMonth.getDay() - this.plugin.settings.firstDayOfWeek;
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

  private renderDays(
    grid: HTMLElement, 
    year: number, 
    month: number, 
    daysInMonth: number
  ) {
    const today = new Date().toDateString();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      this.renderDay(grid, date, today);
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
    const events = this.plugin.calendarService.getEventsForDate(date);
    
    if (events.length > 0) {
      dayEl.addClass("has-events");
      dayEl.createEl("div", {
        cls: "memochron-event-dot",
        text: "•",
      });
    }
  }

  private addDayClickHandler(dayEl: HTMLElement, date: Date) {
    dayEl.addEventListener("touchstart", () => {}, { passive: false });
    dayEl.addEventListener("click", () => this.selectDate(date));
  }

  private async showDayAgenda(date: Date) {
    this.agenda.empty();
    
    this.createAgendaHeader(date);
    
    const events = this.plugin.calendarService.getEventsForDate(date);
    
    if (events.length === 0) {
      this.agenda.createEl("p", { text: "No events scheduled" });
      return;
    }

    this.renderEventsList(events);
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

  private renderEventsList(events: CalendarEvent[]) {
    const list = this.agenda.createEl("div", { cls: "memochron-agenda-list" });
    const now = new Date();

    events.forEach((event) => {
      this.renderEventItem(list, event, now);
    });
  }

  private renderEventItem(
    list: HTMLElement, 
    event: CalendarEvent, 
    now: Date
  ) {
    const eventEl = list.createEl("div", { cls: "memochron-agenda-event" });
    
    if (event.end < now) {
      eventEl.addClass("past-event");
    }

    this.renderEventTime(eventEl, event);
    this.renderEventTitle(eventEl, event);
    this.renderEventLocation(eventEl, event);
    this.addEventClickHandler(eventEl, event);
  }

  private renderEventTime(eventEl: HTMLElement, event: CalendarEvent) {
    const timeFormat = { hour: "2-digit", minute: "2-digit" } as const;
    
    eventEl.createEl("div", {
      cls: "memochron-event-time",
      text: `${event.start.toLocaleTimeString([], timeFormat)} - ${event.end.toLocaleTimeString([], timeFormat)}`,
    });
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
    return virtualKeywords.some(keyword => lowerLocation.includes(keyword));
  }

  private addEventClickHandler(eventEl: HTMLElement, event: CalendarEvent) {
    eventEl.addEventListener("touchstart", () => {}, { passive: false });
    
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

    const file = await this.plugin.noteService.createEventNote(event);
    if (!file) {
      throw new Error("Failed to create or update note");
    }

    const leaf = this.app.workspace.getLeaf("tab");
    if (leaf) {
      await leaf.openFile(file);
    } else {
      new Notice("Could not open the note in a new tab");
    }
  }
}