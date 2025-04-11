// src/settings/types.ts

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
}

export const DEFAULT_SETTINGS: MemoChronSettings = {
  calendarUrls: [],
  noteLocation: "/",
  noteTitleFormat: "{{date}} - {{event_title}}",
  refreshInterval: 30,
  noteDateFormat: "ISO",
  defaultFrontmatter: "---\ntype: event\ndate: {{date}}\n---",
  defaultTags: ["event", "meeting"],
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
};
