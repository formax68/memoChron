// src/services/CalendarService.ts

import { requestUrl, Platform } from "obsidian";
import { Component, Event as ICalEvent, parse, Time } from "ical.js";
import { DateTime } from "luxon";
import { CalendarSource } from "../settings/types";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  source: string;
}

export class CalendarService {
  private events: CalendarEvent[] = [];
  private refreshMinutes: number;
  private lastFetch: number = 0;

  constructor(refreshMinutes: number) {
    this.refreshMinutes = refreshMinutes;
  }

  async fetchCalendars(sources: CalendarSource[]): Promise<CalendarEvent[]> {
    const now = Date.now();
    const enabledSources = sources.filter((source) => source.enabled);

    // Log platform info on initial fetch
    if (this.events.length === 0) {
      console.debug("MemoChron platform info:", {
        mobile: Platform.isMobile,
        electron: Platform.isDesktop,
        networkAvailable: navigator.onLine,
      });
    }

    // First check if we have any enabled sources
    if (enabledSources.length === 0) {
      this.events = [];
      console.warn("No enabled calendar sources to fetch.");
      return [];
    }

    // Force a refresh if the number of enabled calendars changed
    const needsRefresh =
      this.events.length === 0 || // No events yet
      now - this.lastFetch >= this.refreshMinutes * 60 * 1000 || // Cache expired
      this.events.some(
        (event) =>
          !enabledSources.find((source) => source.name === event.source)
      ) || // Has events from now-disabled calendars
      enabledSources.some(
        (source) => !this.events.find((event) => event.source === source.name)
      ); // Has newly enabled calendars

    if (!needsRefresh) {
      return this.events;
    }

    try {
      const fetchPromises = enabledSources.map((source) =>
        this.fetchCalendar(source)
      );
      const results = await Promise.all(fetchPromises);
      this.events = results.flat();
      this.lastFetch = now;
      return this.events;
    } catch (error) {
      console.error("Error fetching calendars:", error);
      throw error;
    }
  }

  private async fetchCalendar(
    source: CalendarSource
  ): Promise<CalendarEvent[]> {
    try {
      const response = await requestUrl({
        url: source.url,
        method: "GET",
        headers: {
          Accept: "text/calendar",
          "User-Agent": "MemoChron-ObsidianPlugin",
        },
        throw: false, // Don't throw on non-200 responses
      });

      if (response.status !== 200) {
        console.error(
          `Failed to fetch calendar ${source.name}: ${response.status} ${response.text}`
        );
        return [];
      }
      
      const jcalData = parse(response.text);
      const comp = new Component(jcalData);
      const vevents = comp.getAllSubcomponents("vevent");
      
      const events: CalendarEvent[] = [];

      // Optimize recurring event iteration
      const periodStart = new Date();
      periodStart.setMonth(periodStart.getMonth() - 1);
      periodStart.setHours(0, 0, 0, 0);

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 2);
      periodEnd.setHours(23, 59, 59, 999);

      // First, collect all recurrence exceptions (for handling rescheduled events)
      const recurrenceExceptions = new Map<string, ICalEvent>();
      
      // Find all events with RECURRENCE-ID (these are modified instances)
      for (const vevent of vevents) {
        if (vevent.hasProperty("recurrence-id")) {
          const event = new ICalEvent(vevent);
          const uid = event.uid;
          const recurrenceId = vevent.getFirstProperty("recurrence-id").getFirstValue();
          
          // Skip if cancelled
          if (vevent.hasProperty("status") && vevent.getFirstPropertyValue("status") === "CANCELLED") {
            continue;
          }
          
          // Create a unique key combining the UID and the recurrence date
          const recKey = `${uid}-${recurrenceId.toJSDate().toISOString().substring(0, 10)}`;
          recurrenceExceptions.set(recKey, event);
        }
      }
      
      // Now process all events
      for (const vevent of vevents) {
        // Skip if this event has a recurrence-id (we'll process these separately)
        if (vevent.hasProperty("recurrence-id")) {
          continue;
        }
        
        // Skip cancelled events
        if (vevent.hasProperty("status")) {
          const status = vevent.getFirstPropertyValue("status");
          if (status === "CANCELLED") {
            continue; // Skip this event
          }
        }
        
        const event = new ICalEvent(vevent);
        let startDate, endDate;
        
        // Extract timezone info if available
        let tzid = null;
        if (vevent.hasProperty("dtstart")) {
          const dtstart = vevent.getFirstProperty("dtstart");
          if (dtstart) {
            tzid = dtstart.getParameter("tzid");
          }
        }
        
        // Fix timezone issues using specific handling
        if (vevent.hasProperty("rrule")) {
          const iterator = event.iterator();
          let next: Time | null;
          
          // Get excluded dates (EXDATE) if any
          const excludedDates: Date[] = [];
          if (vevent.hasProperty("exdate")) {
            // Handle multiple EXDATE properties if they exist
            const exdateProps = vevent.getAllProperties("exdate");
            for (const exdateProp of exdateProps) {
              // Get the excluded dates
              const values = exdateProp.getValues();
              values.forEach((value: any) => {
                if (value && value.toJSDate) {
                  excludedDates.push(value.toJSDate());
                }
              });
            }
          }

          while ((next = iterator.next())) {
            const occurEnd = next.clone();
            const duration = event.duration;
            occurEnd.addDuration(duration);
            
            // Get the date of this occurrence
            const rawDate = next.toJSDate();
            
            // Convert to local timezone 
            startDate = this.convertTimezone(rawDate, tzid);
            endDate = this.convertTimezone(occurEnd.toJSDate(), tzid);
            
            // Skip this occurrence if it's in the excluded dates list
            const isExcluded = excludedDates.some(exDate => {
              // Compare year, month, and day to check if this date is excluded
              return exDate.getFullYear() === rawDate.getFullYear() &&
                     exDate.getMonth() === rawDate.getMonth() &&
                     exDate.getDate() === rawDate.getDate();
            });
            
            // Check if this occurrence has a rescheduled exception
            const dateStr = rawDate.toISOString().substring(0, 10);
            const recKey = `${event.uid}-${dateStr}`;
            const hasException = recurrenceExceptions.has(recKey);
            
            if (isExcluded || hasException) {
              // If there's an exception, we'll add it separately - skip the original
              if (hasException) {
                // Get the exception event
                const exceptionEvent = recurrenceExceptions.get(recKey);
                
                // Get timezone for the exception
                let exTzid = tzid; // Default to parent event timezone
                if (exceptionEvent && exceptionEvent.component.hasProperty("dtstart")) {
                  const exDtstart = exceptionEvent.component.getFirstProperty("dtstart");
                  if (exDtstart) {
                    const paramTzid = exDtstart.getParameter("tzid");
                    if (paramTzid) {
                      exTzid = paramTzid;
                    }
                  }
                }
                
                // Get start and end dates from the exception and convert to local timezone
                if (exceptionEvent) {
                  const exStartDate = this.convertTimezone(exceptionEvent.startDate.toJSDate(), exTzid);
                  const exEndDate = this.convertTimezone(exceptionEvent.endDate.toJSDate(), exTzid);
                  
                  // Add the exception to events if it's in our date range
                  if (exStartDate <= periodEnd && exEndDate >= periodStart) {
                    events.push({
                      id: `${event.uid}-${next.toUnixTime()}`,
                      title: exceptionEvent.summary,
                      start: exStartDate,
                      end: exEndDate,
                      description: exceptionEvent.description,
                      location: exceptionEvent.location,
                      source: source.name,
                    });
                  }
                }
              }
              
              continue; // Skip this original occurrence
            }

            if (
              startDate <= periodEnd &&
              endDate >= periodStart
            ) {
              events.push({
                id: `${event.uid}-${next.toUnixTime()}`,
                title: event.summary,
                start: startDate,
                end: endDate,
                description: event.description,
                location: event.location,
                source: source.name,
              });
            }

            if (startDate > periodEnd) {
              break;
            }
          }
        } else {
          // Get original dates from event
          const eventStartDate = event.startDate.toJSDate();
          const eventEndDate = event.endDate.toJSDate();
          
          // Convert to local dates with specific timezone handling
          startDate = this.convertTimezone(eventStartDate, tzid);
          endDate = this.convertTimezone(eventEndDate, tzid);
          
          // Create ID for the event
          const eventId = event.uid;
          
          events.push({
            id: eventId,
            title: event.summary,
            start: startDate,
            end: endDate,
            description: event.description,
            location: event.location,
            source: source.name,
          });
        }
      }
      
      return events;
    } catch (error) {
      console.error(`Error fetching calendar ${source.name}:`, error);
      console.debug("Platform info:", {
        mobile: Platform.isMobile,
        electron: Platform.isDesktop,
        networkAvailable: navigator.onLine,
      });
      return [];
    }
  }

  /**
   * Convert a date from a source timezone to local timezone using Luxon
   */
  private convertTimezone(date: Date, tzid: string | null): Date {
    try {
      if (!tzid) {
        // If no timezone provided, assume UTC
        return DateTime.fromJSDate(date, { zone: 'UTC' })
          .toLocal()
          .toJSDate();
      }
      
      // Map Microsoft Exchange timezone IDs to IANA timezone names
      // These are common Exchange timezone IDs that might appear in calendars
      const timezoneMap: Record<string, string> = {
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
        
        "UTC": "UTC",
        "Coordinated Universal Time": "UTC"
      };
      
      // Map the Microsoft timezone to IANA timezone
      const ianaZone = timezoneMap[tzid] || tzid;
      
      // Create a DateTime in the source timezone
      let dt = DateTime.fromJSDate(date);
      
      // Try to set the source timezone
      try {
        dt = dt.setZone(ianaZone, { keepLocalTime: true });
      } catch (e) {
        // If the timezone is invalid, use UTC as a fallback
        dt = dt.setZone("UTC", { keepLocalTime: true });
      }
      
      // Convert to local timezone
      return dt.toLocal().toJSDate();
    } catch (error) {
      console.error("Failed to convert timezone:", error);
      return date; // Fall back to original date
    }
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    // Create start and end of the target date for comparison
    const targetStartOfDay = new Date(date);
    targetStartOfDay.setHours(0, 0, 0, 0);

    const targetEndOfDay = new Date(date);
    targetEndOfDay.setHours(23, 59, 59, 999);

    return this.events
      .filter((event) => {
        // Check if event starts on this day
        const startsOnThisDay =
          event.start.toDateString() === date.toDateString();

        // Check if event ends on this day
        const endsOnThisDay = event.end.toDateString() === date.toDateString();

        // Check if event spans this day (starts before and ends after)
        const spansThisDay =
          event.start < targetEndOfDay && event.end > targetStartOfDay;

        return startsOnThisDay || endsOnThisDay || spansThisDay;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }
}