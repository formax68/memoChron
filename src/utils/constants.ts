// View constants
export const MEMOCHRON_VIEW_TYPE = "memochron-calendar";

// Default settings
export const DEFAULT_CALENDAR_URLS: string[] = [];
export const DEFAULT_TEMPLATE_PATH: string = 'templates/defaultTemplate.md';
export const DEFAULT_REFRESH_INTERVAL: number = 30; // in minutes
export const DEFAULT_VIEW: 'monthly' | 'weekly' = 'monthly';
export const DEFAULT_NOTE_LOCATION: string = '/';
export const DEFAULT_NOTE_TITLE_FORMAT: string = '{{start_date}} - {{event_title}}';
export const DEFAULT_NOTE_DATE_FORMAT: string = 'ISO';
export const DEFAULT_FRONTMATTER: string = '---\ntype: event\ndate: {{start_date}}\n---';
export const DEFAULT_TAGS: string[] = ['event', 'meeting'];
export const DEFAULT_FIRST_DAY_OF_WEEK: number = 1; // Monday

export const TEMPLATE_VARIABLES = {
    TITLE: '{{title}}',
    START_TIME: '{{startTime}}',
    END_TIME: '{{endTime}}',
    DATE: '{{date}}',
    DESCRIPTION: '{{description}}',
    LOCATION: '{{location}}',
};

// Color palette for auto-assigning calendar colors
// Using CSS variables that work well with Obsidian themes
export const CALENDAR_COLOR_PALETTE = [
    'var(--color-red)',
    'var(--color-blue)',
    'var(--color-green)',
    'var(--color-purple)',
    'var(--color-orange)',
    'var(--color-yellow)',
    'var(--color-pink)',
    'var(--color-cyan)',
];