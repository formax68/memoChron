# MemoChron

MemoChron is an Obsidian plugin that bridges the gap between personal knowledge management and time management.
It showcases a list of your calendar events. When you click on an event, it creates a note for this event.

> **🚧 Beta Features**: Features marked with **(Beta)** are available in the latest beta release. See [Beta Testing](#beta-testing) for installation instructions.

![Note](screenshots/note.png)

## Features

- 📅 **Calendar Integration**: Import and display events from public iCalendar (.ics) URLs
- 📁 **Local ICS File Support** **(Beta)**: Use ICS files stored in your vault or local file system
- 🎯 **Drag & Drop Import** **(Beta)**: Drag single-event ICS files onto the agenda to create notes instantly
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

MemoChron supports both remote calendar URLs and local ICS files.

#### Remote Calendars
1. Go to Settings > MemoChron
2. Click "Add Calendar"
3. Enter your public iCalendar (ICS) URL (e.g., `https://calendar.google.com/calendar/ical/...`)
4. Give your calendar a name and optional tags
5. Enable/disable calendars as needed

#### Local ICS Files
You can also use ICS files stored in your Obsidian vault or local file system:

1. Go to Settings > MemoChron
2. Click "Add Calendar"
3. Use one of these methods to specify your local file:
   - **File Picker (Recommended)**: 
     - Click the folder icon (📁) button next to the URL field
     - A search dialog will open showing all ICS files in your vault
     - Type to search/filter files by name
     - Click on the desired file to select it
     - The file path will be automatically filled in the URL field
     - Note: If no ICS files are found, you'll see a notification. Make sure to add ICS files to your vault first
   - **Vault Path**: Type a relative path like `calendars/work.ics`
   - **Absolute Path**: Use full paths like `/Users/username/calendar.ics` or `C:\Users\username\calendar.ics`
   - **File URL**: Use `file:///` URLs like `file:///Users/username/calendar.ics`
4. Give your calendar a name and optional tags
5. Enable/disable calendars as needed

**Note**: Local ICS files are read-only. To update events, you'll need to export a new ICS file from your calendar application and replace the existing file.

### Drag & Drop ICS Files (Beta)

You can quickly create notes from individual meeting invites by dragging ICS files:

1. **Export a single event** from your calendar application as an ICS file
2. **Drag the ICS file** onto the agenda view (bottom section) of MemoChron
3. **Drop** when you see the "Drop ICS file here to create a note" message
4. A note will be created immediately for that event

**Important**:
- Only **single-event** ICS files are supported
- Files with multiple events will show an error
- Drag & drop only works on the **agenda view**, not the calendar grid
- Events are **not** added to your calendar sources - only notes are created
- All timezones are properly handled and converted to your local time

**Use Cases**:
- Quick note creation from meeting invites
- Importing events from colleagues without calendar access
- Creating notes for one-off events without cluttering your calendar

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

- Remote calendars must be publicly accessible (no authentication support)
- No bi-directional sync (changes in notes don't update calendar events)
- Basic calendar views (monthly with agenda)
- Local ICS files are not automatically watched for changes (use manual refresh)

## Beta Testing

### Installing Beta Releases

To test beta features before they're officially released:

1. **Install BRAT** (Beta Reviewer's Auto-update Tool)
   - Go to Community Plugins in Obsidian
   - Search for "BRAT" and install it
   - Enable the BRAT plugin

2. **Add MemoChron Beta**
   - Open BRAT settings
   - Click "Add Beta Plugin"
   - Enter: `https://github.com/formax68/memoChron`
   - BRAT will automatically install the latest beta release

3. **Updates**
   - BRAT will automatically check for beta updates
   - You can manually update via BRAT settings

### Current Beta Features (v1.3.0-beta.1)

- **Local ICS File Support**: Use ICS files from your vault or file system as calendar sources
- **Drag & Drop Import**: Create notes instantly by dragging ICS files onto the agenda
- **Improved Timezone Handling**: Better support for various timezone formats

### Providing Feedback

Beta feedback is invaluable! Please report issues or suggestions:
- Create an issue on [GitHub](https://github.com/formax68/memoChron/issues)
- Mark it with "beta" in the title
- Include your Obsidian and plugin versions

## Support

If you encounter any issues or have suggestions, please visit my [GitHub repository](https://github.com/formax68/memoChron) and create an issue.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
