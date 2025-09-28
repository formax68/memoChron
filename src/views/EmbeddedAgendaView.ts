import { MarkdownRenderChild, Notice, TFile } from "obsidian";
import MemoChron from "../main";
import {
  renderAgendaList,
  parseDate,
  RenderOptions,
} from "../utils/viewRenderers";
import {
  createDailyNote,
  getDailyNote,
  getAllDailyNotes,
  appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";

export interface AgendaCodeBlockParams {
  date?: string;
  days?: number;
  showPast?: boolean;
  showDailyNote?: boolean;
}

export class EmbeddedAgendaView extends MarkdownRenderChild {
  private startDate: Date;
  private days: number;
  private container: HTMLElement;

  constructor(
    containerEl: HTMLElement,
    private plugin: MemoChron,
    private params: AgendaCodeBlockParams,
    private context?: { filename?: string }
  ) {
    super(containerEl);
    this.container = containerEl;
    this.initializeParams();
  }

  private initializeParams() {
    // Parse date
    if (this.params.date) {
      const parsedDate = parseDate(this.params.date, this.context);
      if (parsedDate) {
        this.startDate = parsedDate;
      } else {
        this.startDate = new Date();
      }
    } else {
      this.startDate = new Date();
    }

    // Parse days (default to 1 for single day view)
    this.days = this.params.days || 1;
    if (this.days < 1) this.days = 1;
    if (this.days > 30) this.days = 30; // Reasonable limit
  }

  async onload() {
    await this.render();
  }

  private async render() {
    this.container.empty();
    this.container.addClass("memochron-embedded");
    this.container.addClass("memochron-embedded-agenda");

    // Create header
    const header = this.container.createEl("div", {
      cls: "memochron-embedded-header",
    });

    let headerText: string;
    if (this.days === 1) {
      headerText = this.startDate.toLocaleDateString("default", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } else {
      const endDate = new Date(this.startDate);
      endDate.setDate(endDate.getDate() + this.days - 1);
      headerText = `${this.startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    }

    header.createEl("h3", {
      cls: "memochron-embedded-title",
      text: headerText,
    });

    // Fetch events
    await this.plugin.calendarService.fetchCalendars(
      this.plugin.settings.calendarUrls
    );

    // Create agenda container
    const agendaContainer = this.container.createEl("div", {
      cls: "memochron-agenda memochron-embedded-content",
    });

    // Collect all events for the date range
    const allEvents = [];
    for (let i = 0; i < this.days; i++) {
      const currentDate = new Date(this.startDate);
      currentDate.setDate(this.startDate.getDate() + i);
      const dayEvents =
        this.plugin.calendarService.getEventsForDate(currentDate);
      allEvents.push(...dayEvents.map((e) => ({ ...e, date: currentDate })));
    }

    if (allEvents.length === 0 && !this.params.showDailyNote) {
      agendaContainer.createEl("p", {
        cls: "memochron-no-events",
        text: "No events scheduled",
      });
      return;
    }

    // Render events grouped by day
    const options: RenderOptions = {
      enableColors: this.plugin.settings.enableCalendarColors,
      timeFormat: this.plugin.settings.noteTimeFormat,
      showDailyNote:
        this.params.showDailyNote !== undefined
          ? this.params.showDailyNote
          : this.plugin.settings.showDailyNoteInAgenda,
      dailyNoteColor: this.plugin.settings.dailyNoteColor,
    };

    // Render agenda with click handlers
    const list = agendaContainer.createEl("div", {
      cls: "memochron-agenda-list",
    });
    const now = new Date();

    for (let i = 0; i < this.days; i++) {
      const currentDate = new Date(this.startDate);
      currentDate.setDate(this.startDate.getDate() + i);

      if (this.days > 1) {
        // Add date header for multi-day view
        list.createEl("h4", {
          cls: "memochron-agenda-date-header",
          text: currentDate.toLocaleDateString("default", {
            weekday: "long",
            month: "long",
            day: "numeric",
          }),
        });
      }

      const dayEvents =
        this.plugin.calendarService.getEventsForDate(currentDate);

      // Add daily note entry if enabled
      if (options.showDailyNote) {
        this.renderDailyNoteEntry(list, currentDate, options);
      }

      if (dayEvents.length === 0 && !options.showDailyNote) {
        list.createEl("p", {
          cls: "memochron-no-events",
          text: "No events scheduled",
        });
      } else {
        dayEvents.forEach((event) => {
          this.renderEventItem(list, event, now, options);
        });
      }
    }
  }

  private renderDailyNoteEntry(
    list: HTMLElement,
    date: Date,
    options: RenderOptions
  ) {
    const dailyNoteEl = list.createEl("div", {
      cls: "memochron-agenda-event memochron-daily-note",
    });

    if (options.enableColors) {
      dailyNoteEl.addClass("with-color");
      const dailyNoteColor =
        options.dailyNoteColor ||
        getComputedStyle(document.documentElement)
          .getPropertyValue("--interactive-accent")
          .trim() ||
        "#7c3aed";
      dailyNoteEl.style.setProperty("--event-color", dailyNoteColor);
    }

    dailyNoteEl.createEl("div", {
      cls: "memochron-event-title",
      text: "Daily Note",
    });

    dailyNoteEl.createEl("div", {
      cls: "memochron-event-location",
      text: "📝 Open daily note",
    });

    // Add click handler
    dailyNoteEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.handleDailyNoteClick(date);
    });
  }

  private renderEventItem(
    list: HTMLElement,
    event: any,
    now: Date,
    options: RenderOptions
  ) {
    const eventEl = list.createEl("div", { cls: "memochron-agenda-event" });

    if (event.end < now && !this.params.showPast) {
      eventEl.addClass("past-event");
    }

    if (options.enableColors && event.color) {
      eventEl.addClass("with-color");
      eventEl.style.setProperty("--event-color", event.color);
    }

    // Time
    if (event.isAllDay) {
      eventEl.createEl("div", {
        cls: "memochron-event-time all-day",
        text: "All day",
      });
    } else {
      const timeFormat: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        hour12: options.timeFormat === "12h",
      };

      eventEl.createEl("div", {
        cls: "memochron-event-time",
        text: `${event.start.toLocaleTimeString(
          [],
          timeFormat
        )} - ${event.end.toLocaleTimeString([], timeFormat)}`,
      });
    }

    // Title
    eventEl.createEl("div", {
      cls: "memochron-event-title",
      text: event.title,
    });

    // Location
    if (event.location) {
      const icon = this.getLocationIcon(event.location);
      eventEl.createEl("div", {
        cls: "memochron-event-location",
        text: `${icon} ${event.location}`,
      });
    }

    // Add click handler
    eventEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.handleEventClick(event);
    });
  }

  private getLocationIcon(location: string): string {
    if (/^(https?:\/\/|www\.)/.test(location)) return "🔗";
    if (/zoom|meet\.|teams|webex/i.test(location)) return "💻";
    return "📍";
  }

  private async handleDailyNoteClick(date: Date) {
    try {
      if (!appHasDailyNotesPluginLoaded()) {
        new Notice(
          "Daily Notes core plugin is not enabled. Please enable it in Settings > Core plugins."
        );
        return;
      }

      const moment = (window as any).moment;
      if (!moment) {
        new Notice("Moment.js is not available");
        return;
      }

      const momentDate = moment(date);
      const allDailyNotes = getAllDailyNotes();
      let dailyNote = getDailyNote(momentDate, allDailyNotes);

      if (!dailyNote) {
        dailyNote = await createDailyNote(momentDate);
      }

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

  private async handleEventClick(event: any) {
    if (!this.plugin.settings.noteLocation) {
      new Notice("Please set a note location in settings first");
      return;
    }

    let file = this.plugin.noteService.getExistingEventNote(event);

    if (!file) {
      file = await this.plugin.noteService.createEventNote(event);
      if (!file) {
        new Notice("Failed to create note");
        return;
      }
      new Notice(`Created new note: ${file.basename}`);
    } else {
      new Notice(`Opened existing note: ${file.basename}`);
    }

    const leaf = this.plugin.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
  }
}

export function parseAgendaCodeBlock(source: string): AgendaCodeBlockParams {
  const params: AgendaCodeBlockParams = {};
  const lines = source.trim().split("\n");

  for (const line of lines) {
    const [key, value] = line.split(":").map((s) => s.trim());

    // Skip lines without colons or empty keys
    if (!key || value === undefined) {
      continue;
    }

    switch (key.toLowerCase()) {
      case "date":
        params.date = value;
        break;
      case "days":
        params.days = parseInt(value);
        if (isNaN(params.days)) params.days = 1;
        break;
      case "showpast":
      case "show-past":
        params.showPast = value.toLowerCase() === "true";
        break;
      case "showdailynote":
      case "show-daily-note":
        params.showDailyNote = value.toLowerCase() === "true";
        break;
    }
  }

  return params;
}
