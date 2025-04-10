// src/settings/types.ts

export interface CalendarSource {
  url: string;
  name: string;
  enabled: boolean;
}

export interface MemoChronSettings {
  calendarUrls: CalendarSource[];
  templatePath: string;
  noteLocation: string;
  noteTitleFormat: string;
  refreshInterval: number;
  defaultView: "month" | "week";
  noteDateFormat: string;
}

export const DEFAULT_SETTINGS: MemoChronSettings = {
  calendarUrls: [],
  templatePath: "",
  noteLocation: "/",
  noteTitleFormat: "{{date}} - {{event_title}}",
  refreshInterval: 30,
  defaultView: "month",
  noteDateFormat: "ISO", // Default to ISO format
};
