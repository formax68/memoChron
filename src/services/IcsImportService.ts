import { Component, Event as ICalEvent, parse, Time } from "ical.js";
import { CalendarEvent } from "./CalendarService";
import { DateTime } from "luxon";

export class IcsImportService {
  // Copy the full timezone map from CalendarService
  private static readonly TIMEZONE_MAP: Record<string, string> = {
    "Pacific Standard Time": "America/Los_Angeles",
    "Mountain Standard Time": "America/Denver",
    "Central Standard Time": "America/Chicago",
    "Eastern Standard Time": "America/New_York",
    "US Eastern Standard Time": "America/Indianapolis",
    "US Mountain Standard Time": "America/Phoenix",
    "Hawaii-Aleutian Standard Time": "Pacific/Honolulu",
    "Alaskan Standard Time": "America/Anchorage",
    "Atlantic Standard Time": "America/Halifax",
    "GMT Standard Time": "Europe/London",
    "W. Europe Standard Time": "Europe/Berlin",
    "Romance Standard Time": "Europe/Paris",
    "Central European Standard Time": "Europe/Budapest",
    "E. Europe Standard Time": "Europe/Bucharest",
    "GTB Standard Time": "Europe/Athens",
    "Russian Standard Time": "Europe/Moscow",
    "Singapore Standard Time": "Asia/Singapore",
    "China Standard Time": "Asia/Shanghai",
    "Tokyo Standard Time": "Asia/Tokyo",
    "Korea Standard Time": "Asia/Seoul",
    "India Standard Time": "Asia/Kolkata",
    UTC: "UTC",
    "Coordinated Universal Time": "UTC",
  };
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

      // Convert dates properly using the timezone - use Time objects directly
      const startDate = this.convertIcalTimeToDate(event.startDate, tzid);
      const endDate = this.convertIcalTimeToDate(event.endDate, tzid);

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

  private static convertIcalTimeToDate(icalTime: Time, tzid: string | null): Date {
    // Use the same logic as CalendarService.convertIcalTimeToDate
    const year = icalTime.year;
    const month = icalTime.month;
    const day = icalTime.day;
    const hour = icalTime.hour;
    const minute = icalTime.minute;
    const second = icalTime.second;

    // If no timezone specified, create date in local timezone
    if (!tzid) {
      return new Date(year, month - 1, day, hour, minute, second);
    }

    // Map Windows timezone names to IANA timezone identifiers
    const zone = this.TIMEZONE_MAP[tzid] || tzid;
    
    try {
      // Create a DateTime object in the specified timezone
      const dt = DateTime.fromObject(
        { year, month, day, hour, minute, second },
        { zone }
      );

      if (!dt.isValid) {
        console.warn(`Invalid timezone conversion for zone: ${zone}, falling back to local time`);
        return new Date(year, month - 1, day, hour, minute, second);
      }

      // Convert to local timezone
      return dt.toLocal().toJSDate();
    } catch (error) {
      console.error("Failed to convert ICAL time:", error, { icalTime, tzid });
      // Fallback to simple date creation
      return new Date(year, month - 1, day, hour, minute, second);
    }
  }
}