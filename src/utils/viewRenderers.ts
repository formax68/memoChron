import { CalendarEvent } from "../services/CalendarService";
import { MemoChronSettings } from "../settings/types";
import { TFile, Notice, App, setIcon } from "obsidian";
import MemoChron from "../main";

export interface RenderOptions {
  enableColors?: boolean;
  firstDayOfWeek?: number;
  timeFormat?: "12h" | "24h";
  showDailyNote?: boolean;
  dailyNoteColor?: string;
  hasNote?: (event: CalendarEvent) => boolean; // ENH-02 + ENH-03: returns true if a note exists for the event
  showNoteIndicatorOnGrid?: boolean; // ENH-03: render the corner-square on day cells with at least one noted event
}

export function renderCalendarGrid(
  container: HTMLElement,
  currentDate: Date,
  events: CalendarEvent[],
  options: RenderOptions = {},
  onDateClick?: (date: Date) => void,
  onDateDoubleClick?: (date: Date) => void
): Map<string, HTMLElement> {
  const currentMonthDays = new Map<string, HTMLElement>();

  const grid = container.createEl("div", {
    cls: "memochron-calendar-grid",
  });

  // Render weekday headers
  const weekdays = getReorderedWeekdays(options.firstDayOfWeek || 0);
  weekdays.forEach((day) => {
    grid.createEl("div", {
      cls: "memochron-weekday",
      text: day,
    });
  });

  // Render month days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const { firstDayOffset, daysInMonth } = getMonthInfo(
    year,
    month,
    options.firstDayOfWeek || 0
  );

  // Empty days before month starts
  for (let i = 0; i < firstDayOffset; i++) {
    grid.createEl("div", { cls: "memochron-day empty" });
  }

  // Actual days
  const today = new Date().toDateString();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateString = date.toDateString();
    const dayEl = createDayElement(grid, date, dateString === today);

    currentMonthDays.set(dateString, dayEl);

    // Add event indicators
    const dayEvents = getEventsForDate(events, date);
    if (dayEvents.length > 0) {
      addEventIndicators(dayEl, dayEvents, options);
    }

    // Add click handler if provided
    if (onDateClick) {
      dayEl.addEventListener("click", () => onDateClick(date));
      dayEl.classList.add("clickable");
    }

    // Add double-click handler if provided
    if (onDateDoubleClick) {
      dayEl.addEventListener("dblclick", () => onDateDoubleClick(date));
    }
  }

  return currentMonthDays;
}

export function renderAgendaList(
  container: HTMLElement,
  date: Date,
  events: CalendarEvent[],
  plugin: MemoChron,
  options: RenderOptions = {},
  days: number = 1
) {
  const list = container.createEl("div", { cls: "memochron-agenda-list" });

  for (let i = 0; i < days; i++) {
    const currentDate = new Date(date);
    currentDate.setDate(date.getDate() + i);

    if (days > 1) {
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

    const dayEvents = getEventsForDate(events, currentDate);

    // Add daily note entry if enabled
    if (options.showDailyNote) {
      renderDailyNoteEntry(list, currentDate, plugin, options);
    }

    if (dayEvents.length === 0 && !options.showDailyNote) {
      list.createEl("p", {
        cls: "memochron-no-events",
        text: "No events scheduled",
      });
    } else {
      const now = new Date();
      dayEvents.forEach((event) => {
        renderEventItem(list, event, now, plugin, options);
      });
    }
  }
}

function renderDailyNoteEntry(
  list: HTMLElement,
  date: Date,
  plugin: MemoChron,
  options: RenderOptions
) {
  const dailyNoteEl = list.createEl("div", {
    cls: "memochron-agenda-event memochron-daily-note",
  });

  if (options.enableColors) {
    dailyNoteEl.addClass("with-color");
    const dailyNoteColor =
      options.dailyNoteColor ||
      getComputedStyle(activeDocument.documentElement)
        .getPropertyValue("--interactive-accent")
        .trim() ||
      "#7c3aed";
    dailyNoteEl.style.setProperty("--event-color", dailyNoteColor);
  }

  dailyNoteEl.createEl("div", {
    cls: "memochron-event-title",
    // eslint-disable-next-line obsidianmd/ui/sentence-case -- proper noun: "Daily Note" refers to Obsidian's Daily Notes feature
    text: "Daily Note",
  });

  dailyNoteEl.createEl("div", {
    cls: "memochron-event-location",
    text: "📝 Open daily note",
  });

  // Note: Click handler should be added by the caller if needed
}

function renderEventItem(
  list: HTMLElement,
  event: CalendarEvent,
  now: Date,
  plugin: MemoChron,
  options: RenderOptions
) {
  const eventEl = list.createEl("div", { cls: "memochron-agenda-event" });

  if (event.end < now) {
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
    const icon = getLocationIcon(event.location);
    eventEl.createEl("div", {
      cls: "memochron-event-location",
      text: `${icon} ${event.location}`,
    });
  }

  // Note-exists indicator (ENH-02)
  if (options.hasNote) {
    const iconEl = eventEl.createEl("div", { cls: "memochron-event-note-indicator" });
    setIcon(iconEl, options.hasNote(event) ? "file-check" : "file-plus");
  }
}

function getReorderedWeekdays(firstDay: number): string[] {
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return [...weekdays.slice(firstDay), ...weekdays.slice(0, firstDay)];
}

function getMonthInfo(year: number, month: number, firstDayOfWeek: number) {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let firstDayOffset = firstDayOfMonth.getDay() - firstDayOfWeek;
  if (firstDayOffset < 0) firstDayOffset += 7;

  return {
    firstDayOffset,
    daysInMonth: lastDayOfMonth.getDate(),
  };
}

function createDayElement(
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

function getEventsForDate(
  events: CalendarEvent[],
  date: Date
): CalendarEvent[] {
  const targetStartOfDay = new Date(date);
  targetStartOfDay.setHours(0, 0, 0, 0);

  const targetEndOfDay = new Date(date);
  targetEndOfDay.setHours(23, 59, 59, 999);

  return events
    .filter((event) =>
      eventOccursOnDate(event, targetStartOfDay, targetEndOfDay)
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function eventOccursOnDate(
  event: CalendarEvent,
  startOfDay: Date,
  endOfDay: Date
): boolean {
  // Check if event overlaps with the day
  return event.start <= endOfDay && event.end >= startOfDay;
}

function addEventIndicators(
  dayEl: HTMLElement,
  events: CalendarEvent[],
  options: RenderOptions
) {
  dayEl.addClass("has-events");

  // Note indicator corner-square (ENH-03)
  if (options.showNoteIndicatorOnGrid && options.hasNote && events.some((e) => options.hasNote!(e))) {
    dayEl.createEl("div", { cls: "memochron-note-indicator" });
  }

  const dotsContainer = dayEl.createEl("div", {
    cls: "memochron-event-dots-container",
  });

  if (options.enableColors) {
    // Group events by source for colored dots
    const eventsBySource = new Map<string, CalendarEvent>();
    events.forEach((event) => {
      if (!eventsBySource.has(event.sourceId)) {
        eventsBySource.set(event.sourceId, event);
      }
    });

    eventsBySource.forEach((event) => {
      const dot = dotsContainer.createEl("div", {
        cls: "memochron-event-dot colored",
        text: "•",
      });
      if (event.color) {
        dot.setCssProps({ color: event.color });
      }
    });
  } else {
    // Single dot when colors disabled
    dotsContainer.createEl("div", {
      cls: "memochron-event-dot",
      text: "•",
    });
  }
}

function getLocationIcon(location: string): string {
  if (/^(https?:\/\/|www\.)/.test(location)) return "🔗";
  if (/zoom|meet\.|teams|webex/i.test(location)) return "💻";
  return "📍";
}

export function parseMonthYear(input: string): Date | null {
  // Support formats: "2025-01", "2025/01", "January 2025", "Jan 2025"
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const monthAbbr = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  // Try YYYY-MM or YYYY/MM format
  const numericMatch = input.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (numericMatch) {
    const year = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]) - 1; // Month is 0-indexed
    if (month >= 0 && month < 12) {
      return new Date(year, month, 1);
    }
  }

  // Try "Month Year" or "Mon Year" format
  const textMatch = input.toLowerCase().match(/^(\w+)\s+(\d{4})$/);
  if (textMatch) {
    const monthText = textMatch[1];
    const year = parseInt(textMatch[2]);

    let month = monthNames.indexOf(monthText);
    if (month === -1) {
      month = monthAbbr.indexOf(monthText.substring(0, 3));
    }

    if (month !== -1) {
      return new Date(year, month, 1);
    }
  }

  return null;
}

export function parseDate(
  input: string,
  context?: { filename?: string }
): Date | null {
  // Handle dynamic properties
  if (input === "this.file.name" && context?.filename) {
    return parseDateFromFilename(context.filename);
  }

  // Support special keywords
  if (input.toLowerCase() === "today") {
    return new Date();
  }
  if (input.toLowerCase() === "tomorrow") {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  }
  if (input.toLowerCase() === "yesterday") {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }

  // WR-02 (BUG-01 follow-through): detect YYYY-MM-DD explicitly and route
  // through parseLocalDate so the result lands on the correct local calendar
  // day. `new Date("YYYY-MM-DD")` is UTC midnight, which back-shifts to the
  // previous day in any timezone west of UTC — the same bug class BUG-01
  // closes for daily-note filenames, here closed for code-block parameters
  // (`date: 2026-01-15` in memochron-calendar / memochron-agenda blocks).
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const local = parseLocalDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3])
    );
    if (local) return local;
  }

  // Try standard date formats (fallback; YYYY-MM-DD handled above).
  const date = new Date(input);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
}

// Construct a local-day Date from 1-indexed year/month/day integers.
// Uses the numeric Date constructor (not the string form) so the result
// lands on the correct local calendar day regardless of the host timezone.
// `new Date("YYYY-MM-DD")` is UTC midnight and would return the previous
// day in any timezone west of UTC — this helper avoids that bug (BUG-01).
function parseLocalDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;
  // WR-01: reject overflow rollover (e.g. Feb 31 -> Mar 3). The numeric
  // Date constructor silently rolls invalid day-of-month forward into the
  // next month; verify the constructed Date round-trips to the input
  // components so impossible dates return null instead of a wrong date.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseDateFromFilename(filename: string): Date | null {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  // Try common daily note formats
  const formats = [
    // YYYY-MM-DD
    /(\d{4}-\d{2}-\d{2})/,
    // YYYY_MM_DD
    /(\d{4}_\d{2}_\d{2})/,
    // YYYY.MM.DD
    /(\d{4}\.\d{2}\.\d{2})/,
    // BUG-04 (D-11): #56 regression closed post-#58 (and BUG-01 fix in Phase 3 — local-day construction). 29-01-2026 → 2026-01-29 local. Handles DD-MM-YYYY and MM-DD-YYYY via in-branch dual-parse below.
    /(\d{2}-\d{2}-\d{4})/,
    // YYYYMMDD
    /(\d{8})/,
  ];

  for (const format of formats) {
    const match = nameWithoutExt.match(format);
    if (match) {
      const dateStr = match[1];

      // Handle different formats
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // YYYY-MM-DD
        const parts = dateStr.split("-");
        const date = parseLocalDate(Number(parts[0]), Number(parts[1]), Number(parts[2]));
        if (date) return date;
      } else if (/^\d{4}_\d{2}_\d{2}$/.test(dateStr)) {
        // YYYY_MM_DD
        const parts = dateStr.split("_");
        const date = parseLocalDate(Number(parts[0]), Number(parts[1]), Number(parts[2]));
        if (date) return date;
      } else if (/^\d{4}\.\d{2}\.\d{2}$/.test(dateStr)) {
        // YYYY.MM.DD
        const parts = dateStr.split(".");
        const date = parseLocalDate(Number(parts[0]), Number(parts[1]), Number(parts[2]));
        if (date) return date;
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        // DD-MM-YYYY or MM-DD-YYYY - try both interpretations
        // #56 regression closed post-#58 (and BUG-01 fix in Phase 3 — local-day construction). 29-01-2026 → 2026-01-29 local.
        const parts = dateStr.split("-");
        const year = Number(parts[2]);
        // DD-MM-YYYY interpretation: parts[1] is month, parts[0] is day
        const date1 = parseLocalDate(year, Number(parts[1]), Number(parts[0]));
        // MM-DD-YYYY interpretation: parts[0] is month, parts[1] is day
        const date2 = parseLocalDate(year, Number(parts[0]), Number(parts[1]));

        // Return the first valid date
        if (date1) return date1;
        if (date2) return date2;
      } else if (/^\d{8}$/.test(dateStr)) {
        // YYYYMMDD
        const year = Number(dateStr.substring(0, 4));
        const month = Number(dateStr.substring(4, 6));
        const day = Number(dateStr.substring(6, 8));
        const date = parseLocalDate(year, month, day);
        if (date) return date;
      }
    }
  }

  return null;
}
