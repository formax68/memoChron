import { requestUrl, Platform, Notice, TFile } from "obsidian";
import { Component, Event as ICalEvent, parse, Time } from "ical.js";
import { CalendarSource } from "../settings/types";
import MemoChron from "../main";
import {
  getPathInfo,
  isLocalPath,
  isRemoteUrl,
  PathType,
  PathInfo,
} from "../utils/pathUtils";
import { convertIcalTimeToDate, convertTimezone } from "../utils/timezoneUtils";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  description?: string;
  location?: string;
  source: string;
  sourceId: string; // Unique identifier for the calendar source
  color?: string; // Color assigned to this event's calendar
}

interface CacheData {
  timestamp: number;
  sources: Array<{ url: string; name: string }>;
  events: CalendarEvent[];
}

export class CalendarService {
  private events: CalendarEvent[] = [];
  private lastFetch = 0;
  private isLoadingCache = false;
  private isFetchingCalendars = false;

  constructor(private plugin: MemoChron, private refreshMinutes: number) {}

  async fetchCalendars(
    sources: CalendarSource[],
    forceRefresh = false
  ): Promise<CalendarEvent[]> {
    if (this.isFetchingCalendars) {
      return this.events;
    }

    const enabledSources = sources.filter((source) => source.enabled);

    if (enabledSources.length === 0) {
      this.events = [];
      console.warn("No enabled calendar sources to fetch.");
      return [];
    }

    if (this.shouldLoadFromCache(forceRefresh)) {
      const cachedEvents = await this.loadFromCache();
      if (cachedEvents.length > 0) {
        this.scheduleBackgroundRefresh(sources);
        return this.events;
      }
    }

    if (!this.needsRefresh(enabledSources, forceRefresh)) {
      return this.events;
    }

    return this.performFetch(enabledSources, forceRefresh);
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    const targetStartOfDay = new Date(date);
    targetStartOfDay.setHours(0, 0, 0, 0);

    const targetEndOfDay = new Date(date);
    targetEndOfDay.setHours(23, 59, 59, 999);

    return this.events
      .filter((event) =>
        this.eventOccursOnDate(event, targetStartOfDay, targetEndOfDay)
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  getAllEvents(): CalendarEvent[] {
    return this.events;
  }

  private shouldLoadFromCache(forceRefresh: boolean): boolean {
    return this.events.length === 0 && !forceRefresh;
  }

  private scheduleBackgroundRefresh(sources: CalendarSource[]) {
    setTimeout(() => this.fetchCalendars(sources, true), 100);
  }

  private needsRefresh(
    enabledSources: CalendarSource[],
    forceRefresh: boolean
  ): boolean {
    const now = Date.now();
    const cacheExpired =
      now - this.lastFetch >= this.refreshMinutes * 60 * 1000;

    return (
      forceRefresh ||
      this.events.length === 0 ||
      cacheExpired ||
      this.hasSourceMismatch(enabledSources)
    );
  }

  private hasSourceMismatch(enabledSources: CalendarSource[]): boolean {
    const hasDisabledEvents = this.events.some(
      (event) => !enabledSources.find((source) => source.name === event.source)
    );

    const hasNewSources = enabledSources.some(
      (source) => !this.events.find((event) => event.source === source.name)
    );

    return hasDisabledEvents || hasNewSources;
  }

  private async performFetch(
    enabledSources: CalendarSource[],
    forceRefresh: boolean
  ): Promise<CalendarEvent[]> {
    try {
      this.isFetchingCalendars = true;
      this.showFetchNotification(forceRefresh);

      const fetchPromises = enabledSources.map((source) =>
        this.fetchCalendar(source)
      );
      const results = await Promise.all(fetchPromises);

      this.events = results.flat();
      this.lastFetch = Date.now();

      await this.saveToCache();
      this.showCompletionNotification(forceRefresh);

      return this.events;
    } catch (error) {
      console.error("Error fetching calendars:", error);
      this.showErrorNotification(forceRefresh);

      return this.events;
    } finally {
      this.isFetchingCalendars = false;
    }
  }

  private showFetchNotification(forceRefresh: boolean) {
    if (this.events.length > 0 && !forceRefresh) {
      console.log("MemoChron: Background refresh started");
    } else if (forceRefresh) {
      new Notice("MemoChron: Refreshing calendars...");
    }
  }

  private showCompletionNotification(forceRefresh: boolean) {
    if (forceRefresh) {
      new Notice(
        `MemoChron: Calendar refresh complete (${this.events.length} events)`
      );
    }
  }

  private showErrorNotification(forceRefresh: boolean) {
    if (forceRefresh) {
      new Notice(
        "MemoChron: Failed to refresh calendars. Check the console for details."
      );
    }
  }

  private async loadFromCache(): Promise<CalendarEvent[]> {
    if (this.isLoadingCache) return [];

    this.isLoadingCache = true;
    try {
      const cacheData = await this.readCacheFile();
      if (this.isValidCache(cacheData)) {
        this.restoreFromCache(cacheData);
        return cacheData.events;
      }
    } catch (error) {
      console.log("MemoChron: No cache found or cache invalid", error);
    } finally {
      this.isLoadingCache = false;
    }

    return [];
  }

  private async readCacheFile(): Promise<CacheData> {
    const cacheFile = await this.plugin.app.vault.adapter.read(
      `${this.plugin.app.vault.configDir}/plugins/memochron/calendar-cache.json`
    );
    return JSON.parse(cacheFile);
  }

  private isValidCache(cache: any): cache is CacheData {
    return (
      cache && cache.timestamp && cache.events && Array.isArray(cache.events)
    );
  }

  private restoreFromCache(cache: CacheData) {
    cache.events.forEach((event) => {
      event.start = new Date(event.start);
      event.end = new Date(event.end);
    });

    this.events = cache.events;
    this.lastFetch = cache.timestamp;
  }

  private async saveToCache(): Promise<void> {
    try {
      await this.ensureCacheDirectory();

      const cacheData: CacheData = {
        timestamp: this.lastFetch,
        sources: this.getEnabledSourcesForCache(),
        events: this.events,
      };

      await this.writeCacheFile(cacheData);
      console.log("MemoChron: Calendar cache saved");
    } catch (error) {
      console.error("MemoChron: Failed to save calendar cache:", error);
    }
  }

  private async ensureCacheDirectory() {
    const dirPath = `${this.plugin.app.vault.configDir}/plugins/memochron`;
    try {
      await this.plugin.app.vault.adapter.mkdir(dirPath);
    } catch {
      // Directory likely already exists
    }
  }

  private getEnabledSourcesForCache() {
    return this.plugin.settings.calendarUrls
      .filter((source) => source.enabled)
      .map((source) => ({ url: source.url, name: source.name }));
  }

  private async writeCacheFile(cacheData: CacheData) {
    await this.plugin.app.vault.adapter.write(
      `${this.plugin.app.vault.configDir}/plugins/memochron/calendar-cache.json`,
      JSON.stringify(cacheData)
    );
  }

  private async fetchCalendar(
    source: CalendarSource
  ): Promise<CalendarEvent[]> {
    try {
      const response = await this.fetchCalendarData(source);

      if (response.status !== 200) {
        console.error(
          `Failed to fetch calendar ${source.name}: ${response.status} ${
            response.text || "Unknown error"
          }`
        );
        return [];
      }

      return this.parseCalendarData(response.text, source);
    } catch (error) {
      console.error(`Error fetching calendar ${source.name}:`, error);
      this.logPlatformInfo();
      return [];
    }
  }

  private async fetchCalendarData(source: CalendarSource) {
    const pathInfo = getPathInfo(source.url);

    if (isRemoteUrl(pathInfo)) {
      return this.fetchRemoteCalendar(source.url);
    } else if (isLocalPath(pathInfo)) {
      return this.fetchLocalCalendar(pathInfo);
    }

    throw new Error(`Unsupported calendar path type: ${source.url}`);
  }

  private async fetchRemoteCalendar(url: string) {
    return requestUrl({
      url,
      method: "GET",
      headers: {
        Accept: "text/calendar",
        "User-Agent": "MemoChron-ObsidianPlugin",
      },
      throw: false,
    });
  }

  private async fetchLocalCalendar(pathInfo: PathInfo) {
    try {
      let content: string;

      if (pathInfo.type === PathType.VAULT_RELATIVE) {
        // Read from vault
        const file = this.plugin.app.vault.getAbstractFileByPath(
          pathInfo.normalizedPath
        );
        if (!file || !(file instanceof TFile)) {
          return {
            status: 404,
            text: `File not found: ${pathInfo.normalizedPath}`,
          };
        }
        content = await this.plugin.app.vault.read(file);
      } else {
        // Read from absolute path or file URL
        try {
          content = await this.plugin.app.vault.adapter.read(
            pathInfo.normalizedPath
          );
        } catch (error) {
          return {
            status: 404,
            text: `Cannot read file: ${pathInfo.normalizedPath}`,
          };
        }
      }

      return {
        status: 200,
        text: content,
      };
    } catch (error) {
      console.error("Error reading local calendar file:", error);
      return {
        status: 500,
        text: `Error reading file: ${error.message}`,
      };
    }
  }

  private parseCalendarData(
    data: string,
    source: CalendarSource
  ): CalendarEvent[] {
    const jcalData = parse(data);
    const comp = new Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    const events: CalendarEvent[] = [];
    const { periodStart, periodEnd } = this.getEventPeriod();
    const recurrenceExceptions = this.collectRecurrenceExceptions(vevents);

    for (const vevent of vevents) {
      if (this.shouldSkipEvent(vevent)) continue;

      const eventData = this.processEvent(
        vevent,
        source,
        recurrenceExceptions,
        periodStart,
        periodEnd
      );

      events.push(...eventData);
    }

    return events;
  }

  private getEventPeriod() {
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 2);
    periodEnd.setHours(23, 59, 59, 999);

    return { periodStart, periodEnd };
  }

  private collectRecurrenceExceptions(
    vevents: Component[]
  ): Map<string, ICalEvent> {
    const exceptions = new Map<string, ICalEvent>();

    for (const vevent of vevents) {
      if (!vevent.hasProperty("recurrence-id")) continue;

      if (this.isCancelledEvent(vevent)) continue;

      const event = new ICalEvent(vevent);
      const uid = event.uid;
      const recurrenceId = vevent
        .getFirstProperty("recurrence-id")
        .getFirstValue();
      const recKey = `${uid}-${recurrenceId
        .toJSDate()
        .toISOString()
        .substring(0, 10)}`;

      exceptions.set(recKey, event);
    }

    return exceptions;
  }

  private shouldSkipEvent(vevent: Component): boolean {
    return vevent.hasProperty("recurrence-id") || this.isCancelledEvent(vevent);
  }

  private isCancelledEvent(vevent: Component): boolean {
    return (
      vevent.hasProperty("status") &&
      vevent.getFirstPropertyValue("status") === "CANCELLED"
    );
  }

  private processEvent(
    vevent: Component,
    source: CalendarSource,
    recurrenceExceptions: Map<string, ICalEvent>,
    periodStart: Date,
    periodEnd: Date
  ): CalendarEvent[] {
    const event = new ICalEvent(vevent);
    const tzid = this.extractTimezone(vevent);

    if (vevent.hasProperty("rrule")) {
      return this.processRecurringEvent(
        event,
        vevent,
        source,
        tzid,
        recurrenceExceptions,
        periodStart,
        periodEnd
      );
    }

    return this.processSingleEvent(event, source, tzid);
  }

  private extractTimezone(vevent: Component): string | null {
    if (!vevent.hasProperty("dtstart")) return null;

    const dtstart = vevent.getFirstProperty("dtstart");
    return dtstart ? dtstart.getParameter("tzid") : null;
  }

  private processRecurringEvent(
    event: ICalEvent,
    vevent: Component,
    source: CalendarSource,
    tzid: string | null,
    recurrenceExceptions: Map<string, ICalEvent>,
    periodStart: Date,
    periodEnd: Date
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const excludedDates = this.getExcludedDates(vevent);
    const iterator = event.iterator();
    let next: Time | null;
    const isAllDay = this.isAllDayEvent(vevent);

    while ((next = iterator.next())) {
      const startDate = convertIcalTimeToDate(next, tzid, isAllDay);
      const endTime = next.clone();
      endTime.addDuration(event.duration);
      const endDate = convertIcalTimeToDate(endTime, tzid, isAllDay);

      // For all-day events, adjust the end date to be inclusive
      const adjustedEndDate = isAllDay
        ? new Date(endDate.getTime() - 1)
        : endDate;

      if (startDate > periodEnd) break;

      const dateStr = next.toJSDate().toISOString().substring(0, 10);
      const recKey = `${event.uid}-${dateStr}`;

      if (
        this.shouldSkipOccurrence(
          next.toJSDate(),
          excludedDates,
          recurrenceExceptions,
          recKey
        )
      ) {
        const exception = this.processException(
          recurrenceExceptions.get(recKey),
          source,
          tzid,
          periodStart,
          periodEnd
        );
        if (exception) events.push(exception);
        continue;
      }

      if (startDate <= periodEnd && adjustedEndDate >= periodStart) {
        events.push({
          id: `${event.uid}-${next.toUnixTime()}`,
          title: event.summary,
          start: startDate,
          end: adjustedEndDate,
          isAllDay: isAllDay,
          description: event.description,
          location: event.location,
          source: source.name,
          sourceId: source.url,
          color: source.color,
        });
      }
    }

    return events;
  }

  private processSingleEvent(
    event: ICalEvent,
    source: CalendarSource,
    tzid: string | null
  ): CalendarEvent[] {
    // For all-day events, adjust the end date to be inclusive
    const isAllDay = this.isAllDayEvent(event.component);
    const startDate = convertIcalTimeToDate(event.startDate, tzid, isAllDay);
    const endDate = convertIcalTimeToDate(event.endDate, tzid, isAllDay);
    const adjustedEndDate = isAllDay
      ? new Date(endDate.getTime() - 1)
      : endDate;

    return [
      {
        id: event.uid,
        title: event.summary,
        start: startDate,
        end: adjustedEndDate,
        isAllDay: isAllDay,
        description: event.description,
        location: event.location,
        source: source.name,
        sourceId: source.url,
        color: source.color,
      },
    ];
  }

  private getExcludedDates(vevent: Component): Date[] {
    const excludedDates: Date[] = [];

    if (!vevent.hasProperty("exdate")) return excludedDates;

    const exdateProps = vevent.getAllProperties("exdate");
    for (const exdateProp of exdateProps) {
      const values = exdateProp.getValues();
      values.forEach((value: any) => {
        if (value?.toJSDate) {
          excludedDates.push(value.toJSDate());
        }
      });
    }

    return excludedDates;
  }

  private calculateEndDate(start: Time, duration: any): Date {
    const end = start.clone();
    end.addDuration(duration);
    return end.toJSDate();
  }

  private shouldSkipOccurrence(
    date: Date,
    excludedDates: Date[],
    recurrenceExceptions: Map<string, ICalEvent>,
    recKey: string
  ): boolean {
    const isExcluded = excludedDates.some((exDate) =>
      this.isSameDate(exDate, date)
    );

    return isExcluded || recurrenceExceptions.has(recKey);
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private processException(
    exception: ICalEvent | undefined,
    source: CalendarSource,
    tzid: string | null,
    periodStart: Date,
    periodEnd: Date
  ): CalendarEvent | null {
    if (!exception) return null;

    // For all-day events, adjust the end date to be inclusive
    const isAllDay = this.isAllDayEvent(exception.component);
    const exTzid = this.extractExceptionTimezone(exception, tzid);
    const startDate = convertIcalTimeToDate(exception.startDate, exTzid, isAllDay);
    const endDate = convertIcalTimeToDate(exception.endDate, exTzid, isAllDay);
    const adjustedEndDate = isAllDay
      ? new Date(endDate.getTime() - 1)
      : endDate;

    if (startDate <= periodEnd && adjustedEndDate >= periodStart) {
      return {
        id: `${exception.uid}-${exception.startDate.toUnixTime()}`,
        title: exception.summary,
        start: startDate,
        end: adjustedEndDate,
        isAllDay: isAllDay,
        description: exception.description,
        location: exception.location,
        source: source.name,
        sourceId: source.url,
        color: source.color,
      };
    }

    return null;
  }

  private extractExceptionTimezone(
    exception: ICalEvent,
    defaultTzid: string | null
  ): string | null {
    if (!exception.component.hasProperty("dtstart")) return defaultTzid;

    const dtstart = exception.component.getFirstProperty("dtstart");
    const paramTzid = dtstart?.getParameter("tzid");

    return paramTzid || defaultTzid;
  }

  private eventOccursOnDate(
    event: CalendarEvent,
    targetStartOfDay: Date,
    targetEndOfDay: Date
  ): boolean {
    const startsOnThisDay = this.isSameDate(event.start, targetStartOfDay);
    const endsOnThisDay = this.isSameDate(event.end, targetStartOfDay);
    const spansThisDay =
      event.start < targetEndOfDay && event.end > targetStartOfDay;

    return startsOnThisDay || endsOnThisDay || spansThisDay;
  }

  private logPlatformInfo() {
    console.debug("Platform info:", {
      mobile: Platform.isMobile,
      electron: Platform.isDesktop,
      networkAvailable: navigator.onLine,
    });
  }

  private isAllDayEvent(vevent: Component): boolean {
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
