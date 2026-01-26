import {
  Component,
  Event as ICalEvent,
  parse,
  Property,
  TimezoneService,
} from "ical.js";
import { CalendarEvent } from "./CalendarService";
import { convertIcalTimeToDate } from "../utils/timezoneUtils";

export class IcsImportService {
  /**
   * Parse ICS file content and validate it contains exactly one event
   * @throws Error if the file contains no events or multiple events
   */
  static parseSingleEvent(
    icsContent: string,
    filteredCuTypes?: string[],
    filteredAttendees?: string[]
  ): CalendarEvent {
    try {
      const jcalData = parse(icsContent);
      const comp = new Component(jcalData);

      // Register any VTIMEZONE components so ical.js can apply their rules
      const vtimezones = comp.getAllSubcomponents("vtimezone");
      vtimezones.forEach((tz) => {
        try {
          TimezoneService.register(tz);
        } catch (error) {
          // Only ignore errors if timezone is already registered; log others as warnings
          if (
            error instanceof Error &&
            typeof error.message === "string" &&
            (
              error.message.includes("already registered") ||
              error.message.includes("already exists")
            )
          ) {
            console.debug(
              "Timezone registration skipped (may already exist):",
              error.message
            );
          } else {
            console.warn(
              "Unexpected error during timezone registration:",
              error
            );
          }
        }
      });

      const vevents = comp.getAllSubcomponents("vevent");

      if (vevents.length === 0) {
        throw new Error("No events found in the ICS file");
      }

      if (vevents.length > 1) {
        throw new Error(
          "Multiple events found. Only single event ICS files are supported for drag and drop"
        );
      }

      const vevent = vevents[0];
      const event = new ICalEvent(vevent);

      // Extract timezone if present
      const dtstart = vevent.getFirstProperty("dtstart");
      const tzid = dtstart ? dtstart.getParameter("tzid") : null;

      // Check if it's an all-day event
      const isAllDay = IcsImportService.isAllDayEvent(vevent);

      // Convert dates properly using the timezone - use Time objects directly
      const startDate = convertIcalTimeToDate(event.startDate, tzid, isAllDay);
      const endDate = convertIcalTimeToDate(event.endDate, tzid, isAllDay);

      return {
        id: event.uid || `imported-${Date.now()}`,
        title: event.summary || "Untitled Event",
        start: startDate,
        end: endDate,
        isAllDay: isAllDay,
        description: event.description,
        location: event.location,
        attendees: IcsImportService.extractAttendees(vevent, filteredCuTypes, filteredAttendees),
        source: "Imported",
        sourceId: "imported", // Special source ID for imported events
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to parse ICS file");
    }
  }

  private static isAllDayEvent(vevent: Component): boolean {
    const dtstart = vevent.getFirstProperty("dtstart");
    if (!dtstart) return false;

    // Check if the property has a VALUE=DATE parameter
    const valueParam = dtstart.getParameter("value");
    if (valueParam === "DATE") return true;

    // Also check if the type is 'date' in the jCal representation
    // This handles cases where ical.js represents date-only values differently
    const jcal = (dtstart as any).jCal;
    if (jcal && jcal[2] === "date") return true;

    return false;
  }

  private static extractAttendees(
    vevent: Component,
    filteredCuTypes?: string[],
    filteredAttendees?: string[]
  ): string[] {
    const attendees: string[] = [];

    // Use default if not provided
    const cuTypeFilter = filteredCuTypes || ["INDIVIDUAL", ""];
    const attendeeFilter = filteredAttendees || [];

    if (!vevent.hasProperty("attendee")) {
      return attendees;
    }

    const attendeeProps = vevent.getAllProperties("attendee");

    for (const prop of attendeeProps) {
      const value = prop.getFirstValue();
      const cn = prop.getParameter("cn"); // Common Name parameter
      const cutype = prop.getParameter("cutype"); // CUTYPE parameter

      // Normalize CUTYPE: undefined/null/empty treated as "" (unspecified)
      // RFC 5545: CUTYPE is case-insensitive, normalize to uppercase
      const normalizedCuType = (cutype || "").toUpperCase();

      // Filter based on CUTYPE - skip if not in allowed list
      if (!cuTypeFilter.includes(normalizedCuType)) {
        continue;
      }

      // Extract name or email
      if (cn) {
        // Filter out attendees whose CN matches the filtered list (case-insensitive)
        if (attendeeFilter.includes(cn.toLowerCase())) {
          continue;
        }
        attendees.push(cn);
      } else if (value) {
        // Extract email from mailto: format
        const email = value.replace(/^mailto:/i, "");
        attendees.push(email);
      }
    }

    return attendees;
  }
}
