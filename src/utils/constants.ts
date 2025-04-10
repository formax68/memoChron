export const DEFAULT_CALENDAR_URLS: string[] = [];
export const DEFAULT_TEMPLATE_PATH: string = 'templates/defaultTemplate.md';
export const CALENDAR_REFRESH_INTERVAL: number = 15; // in minutes
export const DEFAULT_VIEW: 'monthly' | 'weekly' = 'monthly';

export const TEMPLATE_VARIABLES = {
    TITLE: '{{title}}',
    START_TIME: '{{startTime}}',
    END_TIME: '{{endTime}}',
    DATE: '{{date}}',
    DESCRIPTION: '{{description}}',
    LOCATION: '{{location}}',
};