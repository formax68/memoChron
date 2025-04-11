import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { CalendarEvent } from "../services/CalendarService";
import MemoChron from "../main";

export class CalendarView extends ItemView {
  private plugin: MemoChron;
  private calendar: HTMLElement;
  private agenda: HTMLElement;
  private currentDate: Date;
  private selectedDate: Date | null = null;
  private currentMonthDays: Map<string, HTMLElement> = new Map();

  constructor(leaf: WorkspaceLeaf, plugin: MemoChron) {
    super(leaf);
    this.plugin = plugin;
    this.currentDate = new Date();
  }

  getViewType(): string {
    return "memochron-calendar";
  }

  getDisplayText(): string {
    return "MemoChron Calendar";
  }

  getIcon(): string {
    return "calendar-range";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    // Create navigation controls
    const controls = container.createEl("div", { cls: "memochron-controls" });
    const nav = controls.createEl("div", { cls: "memochron-nav" });

    // Title on the left
    const title = nav.createEl("span", { cls: "memochron-title" });

    // Navigation buttons grouped on the right
    const navButtons = nav.createEl("div", { cls: "memochron-nav-buttons" });
    const prevBtn = navButtons.createEl("button", { text: "<" });
    const todayBtn = navButtons.createEl("button", { text: "Today" });
    const nextBtn = navButtons.createEl("button", { text: ">" });

    prevBtn.onclick = () => this.navigate(-1);
    todayBtn.onclick = () => this.goToday();
    nextBtn.onclick = () => this.navigate(1);

    // Create calendar and agenda containers
    this.calendar = container.createEl("div", { cls: "memochron-calendar" });
    this.agenda = container.createEl("div", { cls: "memochron-agenda" });

    // Automatically select today's date and show events
    await this.goToday();
  }

  private async navigate(delta: number) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    await this.refreshEvents();
  }

  private async goToday() {
    const newDate = new Date();
    // Only update if we're not already on today's date
    if (
      this.currentDate.getMonth() !== newDate.getMonth() ||
      this.currentDate.getFullYear() !== newDate.getFullYear()
    ) {
      this.currentDate = newDate;
      await this.refreshEvents();
    }
    this.selectDate(newDate);
  }

  private async selectDate(date: Date) {
    if (this.selectedDate) {
      const prevKey = this.selectedDate.toDateString();
      const prevEl = this.currentMonthDays.get(prevKey);
      if (prevEl) {
        prevEl.removeClass("selected");
      }
    }

    this.selectedDate = date;
    const newKey = date.toDateString();
    const newEl = this.currentMonthDays.get(newKey);
    if (newEl) {
      newEl.addClass("selected");
    }

    await this.showDayAgenda(date);
  }

  async refreshEvents() {
    await this.plugin.calendarService.fetchCalendars(
      this.plugin.settings.calendarUrls
    );
    this.renderMonth();
    if (this.selectedDate) {
      this.showDayAgenda(this.selectedDate);
    }
  }

  private renderMonth() {
    this.calendar.empty();
    this.currentMonthDays.clear();

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Update title
    const titleEl = this.containerEl.querySelector(".memochron-title");
    if (titleEl) {
      titleEl.textContent = new Date(year, month).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
    }

    // Create calendar grid
    const grid = this.calendar.createEl("div", {
      cls: "memochron-calendar-grid",
    });

    // Add weekday headers
    const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    weekdays.forEach((day) => {
      grid.createEl("div", {
        cls: "memochron-weekday",
        text: day,
      });
    });

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Add empty cells for days before start of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      grid.createEl("div", { cls: "memochron-day empty" });
    }

    const today = new Date();
    const todayString = today.toDateString();

    // Add cells for each day
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toDateString();

      const dayEl = grid.createEl("div", {
        cls: "memochron-day",
      });

      // Store reference to the day element
      this.currentMonthDays.set(dateString, dayEl);

      // Add selected class if this is the selected date
      if (
        this.selectedDate &&
        dateString === this.selectedDate.toDateString()
      ) {
        dayEl.addClass("selected");
      }

      // Add today class if this is today
      if (dateString === todayString) {
        dayEl.addClass("today");
      }

      const dayHeader = dayEl.createEl("div", {
        cls: "memochron-day-header",
        text: String(day),
      });

      // Get events for this day
      const events = this.plugin.calendarService.getEventsForDate(date);

      if (events.length > 0) {
        dayEl.addClass("has-events");
        const dot = dayEl.createEl("div", {
          cls: "memochron-event-dot",
          text: "•",
        });
      }

      dayEl.onclick = () => this.selectDate(date);
    }
  }

  private async showDayAgenda(date: Date) {
    this.agenda.empty();

    const header = this.agenda.createEl("h3", {
      text: date.toLocaleDateString("default", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    });

    const events = this.plugin.calendarService.getEventsForDate(date);

    if (events.length === 0) {
      this.agenda.createEl("p", { text: "No events scheduled" });
      return;
    }

    const list = this.agenda.createEl("div", { cls: "memochron-agenda-list" });
    const now = new Date();

    events.forEach((event) => {
      const eventEl = list.createEl("div", { cls: "memochron-agenda-event" });

      // Add past-event class if the event has ended
      if (event.end < now) {
        eventEl.addClass("past-event");
      }

      eventEl.createEl("div", {
        cls: "memochron-event-time",
        text: `${event.start.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })} - ${event.end.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      });

      eventEl.createEl("div", {
        cls: "memochron-event-title",
        text: event.title,
      });

      if (event.location) {
        // Check if the location field likely contains a URL
        const isUrl =
          event.location.startsWith("http://") ||
          event.location.startsWith("https://") ||
          event.location.startsWith("www.");

        // Check if it's likely a virtual meeting link
        const isVirtual =
          event.location.toLowerCase().includes("zoom") ||
          event.location.toLowerCase().includes("meet.") ||
          event.location.toLowerCase().includes("teams") ||
          event.location.toLowerCase().includes("webex");

        const icon = isUrl ? "🔗" : isVirtual ? "💻" : "📍";

        eventEl.createEl("div", {
          cls: "memochron-event-location",
          text: `${icon} ${event.location}`,
        });
      }

      // Add clear click handler for event
      eventEl.addEventListener("click", async (e) => {
        e.stopPropagation(); // Prevent triggering the day click
        try {
          await this.showEventDetails(event);
        } catch (error) {
          console.error("Failed to create note:", error);
          new Notice("Failed to create note. Check the console for details.");
        }
      });
    });
  }

  private async showEventDetails(event: CalendarEvent) {
    try {
      // First ensure we have a note location set
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
    } catch (error) {
      console.error("Error showing event details:", error);
      throw error; // Re-throw to be handled by the caller
    }
  }
}
