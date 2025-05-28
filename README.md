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

### Importing ICS Files

You can import ICS files by dragging and dropping them onto the agenda view:

1. Drag an ICS file onto the agenda area
2. A local calendar called "Imported Calendar" will be created automatically
3. For single-event ICS files:
   - The event is added to the local calendar
   - A note is automatically created for the event
4. For multi-event ICS files:
   - All events are added to the local calendar
   - Notes can be created by clicking individual events

Local calendars appear in your calendar list and can be toggled on/off like regular calendars.

### Customizing Templates

In the plugin settings, you can customize:

- Note location in your vault
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

## Configuration

### Settings

- **Calendar Sources**: Add, remove, or toggle calendars
- **First Day of the Week**: Choose which day the calendar week starts on
- **Hide Calendar**: Show only the agenda view without the month calendar grid
- **Refresh Interval**: Set how often calendar data updates
- **Note Location**: Set the default folder for event notes
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
