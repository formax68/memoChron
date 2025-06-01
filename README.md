# MemoChron

MemoChron is an Obsidian plugin that bridges the gap between personal knowledge management and time management.
It showcases a list of your calendar events. When you click on an event, it creates a note for this event.

![Note](screenshots/note.png)

## Features

- 📅 **Calendar Integration**: Import and display events from public iCalendar (.ics) URLs
- 👀 **Visual Calendar**: View your schedule in a clean, native-looking calendar interface in Obsidian's sidebar
- 📋 **Daily Agenda View**: See a detailed list of events for any selected day
- ✨ **Automatic Note Creation**: Create notes for events with customizable templates
- 🔄 **Auto-Refresh**: Keep your calendar data up to date with configurable refresh intervals
- 🎨 **Customizable**: Configure note templates, locations, and naming conventions

![settings](screenshots/settings.png)

## Installation

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "MemoChron"
4. Install the plugin and enable it

## Usage

### Adding Calendar Sources

1. Go to Settings > MemoChron
2. Click "Add Calendar"
3. Enter your public iCalendar (ICS) URL
4. Give your calendar a name and optional tags
5. Enable/disable calendars as needed

### Viewing Your Calendar

- The calendar will appear in the right sidebar by default
- Navigate between months using the arrows
- Click on any day to see the agenda for that day
- Hover over events to see more details

### Available Commands

- **Force refresh calendars**: Manually refresh all calendar data
- **Go to today**: Navigate to the current month and select today's date
- **Toggle calendar visibility**: Show/hide the month calendar grid (agenda-only mode)

### Creating Notes from Events

1. Click on any event in the calendar or agenda view
2. A new note will be created automatically using your template
3. The note will include event details like title, time, description, and location

### Customizing Templates

In the plugin settings, you can customize:

- Note location in your vault
- **Folder path template** for organizing notes in date-based subfolders
- Note title format
- Default template with variables like:
  - {{event_title}}
  - {{date}}
  - {{date-iso}} - The event date in YYYY-MM-DD format, regardless of the "Note date format" setting.
  - {{start_time}}
  - {{end_time}}
  - {{description}}
  - {{location}}
  - {{source}}

### Organizing Notes with Folder Templates

MemoChron supports flexible folder organization using customizable templates. You can organize your event notes into date-based subfolders automatically.

**Available Template Variables:**
- `{YYYY}` - 4-digit year (2025)
- `{YY}` - 2-digit year (25)
- `{MM}` - 2-digit month (06)
- `{M}` - 1-digit month (6)
- `{MMM}` - 3-letter month abbreviation (Jun)
- `{MMMM}` - Full month name (June)
- `{DD}` - 2-digit day (15)
- `{D}` - 1-digit day (15)
- `{DDD}` - 3-letter day abbreviation (Mon)
- `{DDDD}` - Full day name (Monday)
- `{Q}` - Quarter number (2)
- `{source}` - Calendar source name
- `{event_title}` - Event title (sanitized for file names)

**Example Templates:**
- `{YYYY}/{MMM}` → `2025/Jun/`
- `{YYYY}-{MM}` → `2025-06/`
- `{source}/{YYYY}/{MMM}` → `Work Calendar/2025/Jun/`
- `{YYYY}/Q{Q}` → `2025/Q2/`
- `{MMM} {YYYY}` → `Jun 2025/`

**How to Use:**
1. Go to Settings > MemoChron
2. Find the "Folder path template" setting
3. Enter your desired template pattern
4. Use the live preview to see how your template will look
5. Leave empty to save all notes in the same folder (default behavior)

## Configuration

### Settings

- **Calendar Sources**: Add, remove, or toggle calendars
- **First Day of the Week**: Choose which day the calendar week starts on
- **Hide Calendar**: Show only the agenda view without the month calendar grid
- **Refresh Interval**: Set how often calendar data updates
- **Note Location**: Set the default folder for event notes
- **Folder Path Template**: Organize notes in date-based subfolders with customizable patterns
- **Note Title Format**: Customize how note titles are generated
- **Template**: Customize the default note template
- **Tags**: Set default tags for event notes

## Current Limitations

- Only supports public iCalendar URLs (no authentication)
- No bi-directional sync (changes in notes don't update calendar events)
- Basic calendar views (monthly with agenda)

## Support

If you encounter any issues or have suggestions, please visit my [GitHub repository](https://github.com/formax68/memoChron) and create an issue.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
