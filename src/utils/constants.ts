// View constants
export const MEMOCHRON_VIEW_TYPE = "memochron-calendar";

// Default settings
export const DEFAULT_REFRESH_INTERVAL: number = 30; // in minutes
export const DEFAULT_NOTE_LOCATION: string = "/";
export const DEFAULT_NOTE_TITLE_FORMAT: string = "{{date}} - {{event_title}}";
export const DEFAULT_NOTE_DATE_FORMAT: string = "ISO";
export const DEFAULT_FRONTMATTER: string =
  "---\ntype: event\ndate: {{date}}\n---";
export const DEFAULT_TAGS: string[] = ["event", "meeting"];
export const DEFAULT_FIRST_DAY_OF_WEEK: number = 1; // Monday

// Window sizing constants for event loading
export const INITIAL_PAST_DAYS = 30;
export const INITIAL_FUTURE_DAYS = 60;
export const EXTEND_WINDOW_DAYS = 30;

// Scroll and UI constants
export const SCROLL_THRESHOLD = 200;
export const INTERSECTION_THRESHOLD = 0.3;
export const TRANSITION_DURATION = 300;
export const SCROLL_DEBOUNCE_DELAY = 100;
export const DATE_BOUNDARY_THRESHOLD_HOURS = 12;

// Settings UI constants
export const TEXTAREA_ROWS_SMALL = 4;
export const TEXTAREA_ROWS_LARGE = 10;
export const TEXTAREA_COLS = 50;
export const MAX_SUGGESTIONS = 5;
export const SUGGESTION_HIDE_DELAY = 200;
