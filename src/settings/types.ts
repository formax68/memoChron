// src/settings/types.ts

import {
  DEFAULT_CALENDAR_URLS,
  DEFAULT_REFRESH_INTERVAL,
  DEFAULT_NOTE_LOCATION,
  DEFAULT_NOTE_TITLE_FORMAT,
  DEFAULT_NOTE_DATE_FORMAT,
  DEFAULT_NOTE_TIME_FORMAT,
  DEFAULT_FRONTMATTER,
  DEFAULT_TAGS,
  DEFAULT_FIRST_DAY_OF_WEEK,
} from "../utils/constants";

export interface CalendarNotesSettings {
  useCustomSettings: boolean; // Whether this calendar uses custom notes settings
  noteLocation?: string; // Override default note location
  noteTitleFormat?: string; // Override default title format
  noteDateFormat?: string; // Override default date format
  noteTimeFormat?: "12h" | "24h"; // Override default time format
  defaultFrontmatter?: string; // Override default frontmatter
  defaultTags?: string[]; // Override default tags
  noteTemplate?: string; // Override default template
  folderPathTemplate?: string; // Override default folder path template
  enableAttendeeLinks?: boolean; // Override default attendee links setting
}

export interface CalendarSource {
  url: string;
  name: string;
  enabled: boolean;
  tags: string[];
  color?: string; // Optional color for this calendar
  notesSettings?: CalendarNotesSettings; // Optional custom notes settings
}

export interface MemoChronSettings {
  calendarUrls: CalendarSource[];
  noteLocation: string;
  noteTitleFormat: string;
  refreshInterval: number;
  noteDateFormat: string;
  noteTimeFormat: "12h" | "24h";
  defaultFrontmatter: string;
  defaultTags: string[];
  noteTemplate: string;
  firstDayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  hideCalendar: boolean;
  folderPathTemplate: string; // Template for organizing notes in date-based subfolders
  enableCalendarColors: boolean; // Global toggle for calendar colors feature
  showDailyNoteInAgenda: boolean; // Show daily note as an entry in the agenda
  dailyNoteColor?: string; // Color for daily note entry when calendar colors are enabled
  enableAttendeeLinks: boolean; // Create wiki links for attendees
}

export const DEFAULT_SETTINGS: MemoChronSettings = {
  calendarUrls: [],
  noteLocation: DEFAULT_NOTE_LOCATION,
  noteTitleFormat: DEFAULT_NOTE_TITLE_FORMAT,
  refreshInterval: DEFAULT_REFRESH_INTERVAL,
  noteDateFormat: DEFAULT_NOTE_DATE_FORMAT,
  noteTimeFormat: DEFAULT_NOTE_TIME_FORMAT,
  defaultFrontmatter: DEFAULT_FRONTMATTER,
  defaultTags: DEFAULT_TAGS,
  noteTemplate: `# {{event_title}}

## 📝 Event Details
📅 {{start_date}}
⏰ {{start_time}} - {{end_time}}
📆 {{source}}
{{location}}

## 📋 Description
{{description}}

## 📝 Notes
`,
  firstDayOfWeek: DEFAULT_FIRST_DAY_OF_WEEK,
  hideCalendar: false,
  folderPathTemplate: "", // Empty by default for backwards compatibility
  enableCalendarColors: false, // Disabled by default
  showDailyNoteInAgenda: false, // Disabled by default
  enableAttendeeLinks: false, // Disabled by default
};
