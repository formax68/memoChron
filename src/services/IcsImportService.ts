import { Component, Event as ICalEvent, parse } from "ical.js";
import { CalendarEvent } from "./CalendarService";
import { DateTime } from "luxon";

export class IcsImportService {
  /**
   * Parse ICS file content and validate it contains exactly one event
   * @throws Error if the file contains no events or multiple events
   */
  static parseSingleEvent(icsContent: string): CalendarEvent {
    try {
      const jcalData = parse(icsContent);
      const comp = new Component(jcalData);
      const vevents = comp.getAllSubcomponents("vevent");

      if (vevents.length === 0) {
        throw new Error("No events found in the ICS file");
      }

      if (vevents.length > 1) {
        throw new Error("Multiple events found. Only single event ICS files are supported for drag and drop");
      }

      const vevent = vevents[0];
      const event = new ICalEvent(vevent);
      
      // Extract timezone if present
      const dtstart = vevent.getFirstProperty("dtstart");
      const tzid = dtstart ? dtstart.getParameter("tzid") : null;

      // Convert dates properly using the timezone
      const startDate = this.convertEventDate(event.startDate, tzid);
      const endDate = this.convertEventDate(event.endDate, tzid);

      return {
        id: event.uid || `imported-${Date.now()}`,
        title: event.summary || "Untitled Event",
        start: startDate,
        end: endDate,
        description: event.description,
        location: event.location,
        source: "Imported"
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to parse ICS file");
    }
  }

  private static convertEventDate(icalTime: any, tzid: string | null): Date {
    // Use the same timezone conversion logic as CalendarService
    const year = icalTime.year;
    const month = icalTime.month;
    const day = icalTime.day;
    const hour = icalTime.hour;
    const minute = icalTime.minute;
    const second = icalTime.second;

    if (!tzid) {
      return new Date(year, month - 1, day, hour, minute, second);
    }

    // Map common Windows timezone names to IANA
    const TIMEZONE_MAP: Record<string, string> = {
      "Pacific Standard Time": "America/Los_Angeles",
      "Mountain Standard Time": "America/Denver",
      "Central Standard Time": "America/Chicago",
      "Eastern Standard Time": "America/New_York",
      "India Standard Time": "Asia/Kolkata",
      // Add more as needed
    };

    const zone = TIMEZONE_MAP[tzid] || tzid;
    
    try {
      const dt = DateTime.fromObject(
        { year, month, day, hour, minute, second },
        { zone }
      );

      if (!dt.isValid) {
        return new Date(year, month - 1, day, hour, minute, second);
      }

      return dt.toLocal().toJSDate();
    } catch {
      return new Date(year, month - 1, day, hour, minute, second);
    }
  }
}