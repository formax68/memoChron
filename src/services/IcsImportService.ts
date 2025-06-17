import { Component, Event as ICalEvent, parse } from "ical.js";
import { CalendarEvent } from "./CalendarService";
import { convertIcalTimeToDate } from "../utils/timezoneUtils";

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
        source: "Imported",
        sourceId: "imported" // Special source ID for imported events
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
}