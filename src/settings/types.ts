// src/settings/types.ts

export interface CalendarSource {
  url: string;
  name: string;
  enabled: boolean;
  tags: string[];
}

export interface MemoChronSettings {
  calendarUrls: CalendarSource[];
  templatePath: string;
  noteLocation: string;
  noteTitleFormat: string;
  refreshInterval: number;
  defaultView: "month" | "week";
  noteDateFormat: string;
  eventDetailsTemplate: string;
  defaultFrontmatter: string;
  defaultTags: string[];
}

export const DEFAULT_SETTINGS: MemoChronSettings = {
  calendarUrls: [],
  templatePath: "",
  noteLocation: "/",
  noteTitleFormat: "{{date}} - {{event_title}}",
  refreshInterval: 30,
  defaultView: "month",
  noteDateFormat: "ISO",
  eventDetailsTemplate: "- Date: {{date}}\n- Time: {{startTime}} - {{endTime}}\n- Calendar: {{source}}\n{{#if location}}- Location: {{location}}{{/if}}",
  defaultFrontmatter: "---\ntype: event\nstatus: scheduled\n---",
  defaultTags: ["event", "meeting"]
};
