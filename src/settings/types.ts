// src/settings/types.ts

import {
  DEFAULT_CALENDAR_URLS,
  DEFAULT_REFRESH_INTERVAL,
  DEFAULT_NOTE_LOCATION,
  DEFAULT_NOTE_TITLE_FORMAT,
  DEFAULT_NOTE_DATE_FORMAT,
  DEFAULT_FRONTMATTER,
  DEFAULT_TAGS,
  DEFAULT_FIRST_DAY_OF_WEEK
} from "../utils/constants";

export interface CalendarSource {
  url: string;
  name: string;
  enabled: boolean;
  tags: string[];
}

export interface MemoChronSettings {
  calendarUrls: CalendarSource[];
  noteLocation: string;
  noteTitleFormat: string;
  refreshInterval: number;
  noteDateFormat: string;
  defaultFrontmatter: string;
  defaultTags: string[];
  noteTemplate: string;
  firstDayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  hideCalendar: boolean;
}

export const DEFAULT_SETTINGS: MemoChronSettings = {
  calendarUrls: [],
  noteLocation: DEFAULT_NOTE_LOCATION,
  noteTitleFormat: DEFAULT_NOTE_TITLE_FORMAT,
  refreshInterval: DEFAULT_REFRESH_INTERVAL,
  noteDateFormat: DEFAULT_NOTE_DATE_FORMAT,
  defaultFrontmatter: DEFAULT_FRONTMATTER,
  defaultTags: DEFAULT_TAGS,
  noteTemplate: `# {{event_title}}

## 📝 Event Details
📅 {{date}}
⏰ {{start_time}} - {{end_time}}
📆 {{source}}
{{location}}

## 📋 Description
{{description}}

## 📝 Notes
`,
  firstDayOfWeek: DEFAULT_FIRST_DAY_OF_WEEK,
  hideCalendar: false,
};
