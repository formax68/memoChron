// src/services/CalendarService.ts

import { requestUrl } from "obsidian";
import { Component, Event as ICalEvent, parse, Time } from "ical.js";
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

    // Lazy load: Only fetch if it's been longer than refresh interval since last fetch
    if (
      this.events.length > 0 &&
      now - this.lastFetch < this.refreshMinutes * 60 * 1000
    ) {
      return this.events;
    }

    const enabledSources = sources.filter((source) => source.enabled);

    // Lazy load: Fetch only when sources are enabled
    if (enabledSources.length === 0) {
      console.warn("No enabled calendar sources to fetch.");
      return [];
    }

    const fetchPromises = enabledSources.map((source) =>
      this.fetchCalendar(source)
    );

    try {
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
      });

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

      for (const vevent of vevents) {
        const event = new ICalEvent(vevent);

        if (vevent.hasProperty("rrule")) {
          const iterator = event.iterator();
          let next: Time | null;

          while ((next = iterator.next())) {
            const occurEnd = next.clone();
            const duration = event.duration;
            occurEnd.addDuration(duration);

            if (
              next.toJSDate() <= periodEnd &&
              occurEnd.toJSDate() >= periodStart
            ) {
              events.push({
                id: `${event.uid}-${next.toUnixTime()}`,
                title: event.summary,
                start: next.toJSDate(),
                end: occurEnd.toJSDate(),
                description: event.description,
                location: event.location,
                source: source.name,
              });
            }

            if (next.toJSDate() > periodEnd) {
              break;
            }
          }
        } else {
          events.push({
            id: event.uid,
            title: event.summary,
            start: event.startDate.toJSDate(),
            end: event.endDate.toJSDate(),
            description: event.description,
            location: event.location,
            source: source.name,
          });
        }
      }

      return events;
    } catch (error) {
      console.error(`Error fetching calendar ${source.name}:`, error);
      return [];
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
