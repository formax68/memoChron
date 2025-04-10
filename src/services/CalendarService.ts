// src/services/CalendarService.ts

import { requestUrl } from "obsidian";
import { Component, Event as ICalEvent, parse } from "ical.js";
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
    // Only fetch if it's been longer than refresh interval since last fetch
    const now = Date.now();
    if (
      this.events.length > 0 &&
      now - this.lastFetch < this.refreshMinutes * 60 * 1000
    ) {
      return this.events;
    }

    const enabledSources = sources.filter((source) => source.enabled);
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

      return vevents.map((vevent: Component) => {
        const event = new ICalEvent(vevent);
        return {
          id: event.uid,
          title: event.summary,
          start: event.startDate.toJSDate(),
          end: event.endDate.toJSDate(),
          description: event.description,
          location: event.location,
          source: source.name,
        };
      });
    } catch (error) {
      console.error(`Error fetching calendar ${source.name}:`, error);
      return [];
    }
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    // Create a date string for comparison to avoid multiple Date object creations
    const targetDate = date.toDateString();

    return this.events
      .filter((event) => event.start.toDateString() === targetDate)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }
}
