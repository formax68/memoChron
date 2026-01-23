import { MarkdownRenderChild, Notice, App } from "obsidian";
import MemoChron from "../main";
import {
  renderCalendarGrid,
  parseMonthYear,
  parseDate,
  RenderOptions,
} from "../utils/viewRenderers";
import { CalendarEvent } from "../services/CalendarService";

export interface CalendarCodeBlockParams {
  month?: string;
  year?: string;
  showDots?: boolean;
  title?: string;
  calendars?: string[];  // Filter to specific calendars
}

export class EmbeddedCalendarView extends MarkdownRenderChild {
  private currentDate: Date;
  private container: HTMLElement;
  private calendarNames?: string[];

  constructor(
    containerEl: HTMLElement,
    private plugin: MemoChron,
    private params: CalendarCodeBlockParams,
    private context?: { filename?: string }
  ) {
    super(containerEl);
    this.container = containerEl;
    this.initializeDate();
    this.calendarNames = this.params.calendars;
  }

  private initializeDate() {
    // Handle dynamic properties
    if (this.params.month === "this.file.name" && this.context?.filename) {
      const parsedDate = parseDate(this.params.month, this.context);
      if (parsedDate) {
        this.currentDate = new Date(
          parsedDate.getFullYear(),
          parsedDate.getMonth(),
          1
        );
        return;
      }
    }

    // Parse month/year from params
    if (this.params.month) {
      const parsedDate = parseMonthYear(this.params.month);
      if (parsedDate) {
        this.currentDate = parsedDate;
        return;
      }
    }

    // Fallback to separate year/month params (only if month is a simple number)
    if (this.params.year && this.params.month) {
      // Only try numeric parsing if month is a simple number (1-12)
      const monthNum = parseInt(this.params.month);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        const year = parseInt(this.params.year);
        if (!isNaN(year)) {
          this.currentDate = new Date(year, monthNum - 1, 1); // Month is 0-indexed
          return;
        }
      }
    }

    // Default to current month
    this.currentDate = new Date();
  }

  async onload() {
    await this.render();
  }

  private async render() {
    this.container.empty();
    this.container.addClass("memochron-embedded");
    this.container.addClass("memochron-embedded-calendar");

    // Create header
    const header = this.container.createEl("div", {
      cls: "memochron-embedded-header",
    });

    const title = header.createEl("h3", {
      cls: "memochron-embedded-title",
      text:
        this.params.title ||
        this.currentDate.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
    });

    // Create navigation
    const nav = header.createEl("div", {
      cls: "memochron-embedded-nav",
    });

    const prevButton = nav.createEl("span", {
      cls: "memochron-nav-link",
      text: "<",
    });
    prevButton.addEventListener("click", () => this.navigate(-1));

    const todayButton = nav.createEl("span", {
      cls: "memochron-nav-link",
      text: "Today",
    });
    todayButton.addEventListener("click", () => this.goToToday());

    const nextButton = nav.createEl("span", {
      cls: "memochron-nav-link",
      text: ">",
    });
    nextButton.addEventListener("click", () => this.navigate(1));

    // Create calendar container
    const calendarContainer = this.container.createEl("div", {
      cls: "memochron-calendar",
    });

    // Fetch events
    await this.plugin.calendarService.fetchCalendars(
      this.plugin.settings.calendarUrls
    );
    const events = this.plugin.calendarService.getAllEventsForEmbed(this.calendarNames);

    // Render calendar grid
    const options: RenderOptions = {
      enableColors: this.plugin.settings.enableCalendarColors,
      firstDayOfWeek: this.plugin.settings.firstDayOfWeek,
      showDailyNote: this.plugin.settings.showDailyNoteInAgenda,
      dailyNoteColor: this.plugin.settings.dailyNoteColor,
    };

    renderCalendarGrid(
      calendarContainer,
      this.currentDate,
      events,
      options,
      (date) => this.handleDateClick(date),
      (date) => this.handleDateDoubleClick(date)
    );
  }

  private async navigate(delta: number) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    await this.render();
  }

  private async goToToday() {
    this.currentDate = new Date();
    await this.render();
  }

  private async handleDateClick(date: Date) {
    // Show agenda for the clicked date in a notice
    const events = this.plugin.calendarService.getEventsForEmbed(date, this.calendarNames);

    if (events.length === 0) {
      new Notice(`No events on ${date.toLocaleDateString()}`);
      return;
    }

    const eventList = events
      .map((e) => {
        const time = e.isAllDay
          ? "All day"
          : `${e.start.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}`;
        return `• ${time}: ${e.title}`;
      })
      .join("\n");

    new Notice(`Events on ${date.toLocaleDateString()}:\n${eventList}`, 5000);
  }

  private async handleDateDoubleClick(date: Date) {
    // Open the daily note for the double-clicked date
    await this.handleDailyNoteClick(date);
  }

  private async handleDailyNoteClick(date: Date) {
    try {
      // Import the daily notes interface functions
      const {
        createDailyNote,
        getDailyNote,
        getAllDailyNotes,
        appHasDailyNotesPluginLoaded,
      } = await import("obsidian-daily-notes-interface");

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
        const leaf = this.plugin.app.workspace.getLeaf("tab");
        await leaf.openFile(dailyNote);
      }
    } catch (error) {
      console.error("Failed to handle daily note:", error);
      new Notice(
        "Failed to open daily note. Make sure Daily Notes plugin is enabled and configured."
      );
    }
  }
}

export function parseCalendarCodeBlock(
  source: string
): CalendarCodeBlockParams {
  const params: CalendarCodeBlockParams = {};
  const lines = source.trim().split("\n");

  for (const line of lines) {
    const [key, value] = line.split(":").map((s) => s.trim());

    // Skip lines without colons or empty keys
    if (!key || value === undefined) {
      continue;
    }

    switch (key.toLowerCase()) {
      case "month":
        params.month = value;
        break;
      case "year":
        params.year = value;
        break;
      case "showdots":
      case "show-dots":
        params.showDots = value.toLowerCase() === "true";
        break;
      case "title":
        params.title = value;
        break;
      case "calendars":
        // Parse comma-separated calendar names, trim whitespace
        params.calendars = value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        break;
    }
  }

  return params;
}
