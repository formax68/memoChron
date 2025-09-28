# MemoChron Embedded Views Test

This document demonstrates the new dataview-like functionality for MemoChron, allowing you to embed calendar and agenda views directly in your notes.

## Calendar View Examples

### Current Month Calendar
Display the current month:

```memochron-calendar
```

### Specific Month Calendar
Display a specific month using different formats:

```memochron-calendar
month: 2025-02
```

```memochron-calendar
month: March 2025
```

### Navigation
The embedded calendar views include navigation buttons to browse between months and a "Today" button to return to the current month.

## Agenda View Examples

### Today's Agenda
Show today's events:

```memochron-agenda
date: today
```

### Specific Date Agenda
Show events for a specific date:

```memochron-agenda
date: 2025-01-15
```

### Multiple Days Agenda
Show events for multiple days:

```memochron-agenda
date: today
days: 7
```

### Tomorrow's Agenda
Show tomorrow's events:

```memochron-agenda
date: tomorrow
```

### Dynamic File-based Date
Use the current file's name as the date (useful for daily notes):

```memochron-agenda
date: this.file.name
```

```memochron-calendar
month: this.file.name
```

### Week View with Daily Notes
Show a week of events including daily notes:

```memochron-agenda
date: today
days: 7
show-daily-note: true
```

## Features

1. **Calendar View**:
   - Month grid display with event indicators
   - Navigation between months
   - Click on dates to see event details
   - Supports color-coded calendars (if enabled in settings)
   - Shows daily note indicators

2. **Agenda View**:
   - List view of events
   - Single or multi-day display
   - Shows event times, titles, and locations
   - Optional daily note entries
   - Click events to open/create notes

3. **Supported Date Formats**:
   - `today`, `tomorrow`, `yesterday`
   - `YYYY-MM-DD` (e.g., 2025-01-15)
   - `YYYY-MM` or `YYYY/MM` for months
   - `Month Year` (e.g., January 2025)
   - `this.file.name` - extracts date from current filename

4. **Supported Filename Formats** (when using `this.file.name`):
   - `YYYY-MM-DD` (e.g., 2025-01-15.md)
   - `YYYY_MM_DD` (e.g., 2025_01_15.md)
   - `YYYY.MM.DD` (e.g., 2025.01.15.md)
   - `DD-MM-YYYY` (e.g., 15-01-2025.md)
   - `MM-DD-YYYY` (e.g., 01-15-2025.md)
   - `YYYYMMDD` (e.g., 20250115.md)

## Usage in Notes

You can embed these views anywhere in your notes to:
- Track project timelines
- Display weekly schedules
- Show upcoming events in meeting notes
- Create custom dashboards
- Plan monthly goals

The embedded views automatically sync with your configured calendar sources and respect your MemoChron settings for colors, time formats, and other preferences.