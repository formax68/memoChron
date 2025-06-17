# MemoChron 
![GitHub all releases](https://img.shields.io/github/downloads/formax68/memoChron/total?color=573E7A&logo=github&style=for-the-badge)
![GitHub manifest version](https://img.shields.io/github/manifest-json/v/formax68/memoChron?color=573E7A&logo=github&style=for-the-badge)
![GitHub Repo stars](https://img.shields.io/github/stars/formax68/memoChron?color=573E7A&logo=github&style=for-the-badge)

MemoChron is an Obsidian plugin that bridges the gap between personal knowledge management and time management.
It showcases a list of your calendar events. When you click on an event, it creates a note for this event.

![Note](screenshots/note.png)

## Features

- 📅 **Calendar Integration**: Import and display events from public iCalendar (.ics) URLs
- 📁 **Local ICS File Support**: Use ICS files stored in your vault or local file system
- 🎯 **Drag & Drop Import**: Drag single-event ICS files onto the agenda to create notes instantly
- 📂 **Smart Folder Organization**: Automatically organize notes into date-based subfolders with customizable templates
- 👀 **Visual Calendar**: View your schedule in a clean, native-looking calendar interface in Obsidian's sidebar
- 📋 **Daily Agenda View**: See a detailed list of events for any selected day
- ✨ **Automatic Note Creation**: Create notes for events with customizable templates
- 🔄 **Auto-Refresh**: Keep your calendar data up to date with configurable refresh intervals
- 🎨 **Customizable**: Configure note templates, locations, and naming conventions
- 🌈 **Calendar Colors**: Visually distinguish between different calendar sources with an advanced color picker

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

### Drag & Drop ICS Files

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
- `{DD}` - 2-digit day (06)
- `{D}` - 1-digit day (6)
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
- **Enable Calendar Colors**: Toggle color differentiation for calendar sources
  - When enabled, each calendar gets a customizable color
  - Colors appear as dots in the calendar view and left borders in the agenda view
  - Click the color button to open an advanced visual color picker featuring:
    - Enhanced color spectrum for intuitive and accurate selection
    - Improved lightness bar for precise brightness control
    - Hex input for exact color values
    - Carefully selected base color presets optimized for calendar use
    - Instant color updates without requiring calendar refresh

## Current Limitations

- Remote calendars must be publicly accessible (no authentication support)
- No bi-directional sync (changes in notes don't update calendar events)
- Basic calendar views (monthly with agenda)
- Local ICS files are not automatically watched for changes (use manual refresh)

## What's New in v1.4.0

### 🎨 Visual Calendar Color Picker

- **Custom Colors**: Assign unique colors to each calendar source for better visual organization
- **Interactive Picker**: Choose from 12 preset colors or create custom colors with the visual spectrum selector
- **Instant Updates**: Colors update immediately without requiring a calendar refresh
- **Smart Integration**: Colors appear as dots in calendar view and borders in agenda view

### 🐛 Bug Fixes

- Fixed all-day events incorrectly spanning into the next day
- Improved timezone handling for all-day events

## What's New in v1.3.0

### 🎉 New Features

- **Local ICS File Support**: Import calendar events from ICS files stored in your vault or local file system
- **Smart Folder Organization**: Automatically organize event notes into date-based subfolders using customizable templates
- **Drag & Drop Import**: Create notes instantly by dragging single-event ICS files onto the agenda
- **Enhanced Timezone Handling**: Improved support for various timezone formats, including better UTC handling

### 📂 Folder Organization Templates

Organize your event notes automatically with powerful template variables:
- Date-based organization: `{YYYY}/{MM}`, `{YYYY}/{MMM}`, `{YYYY}/Q{Q}`
- Source-based organization: `{source}/{YYYY}/{MMM}`
- Custom combinations: `{MMM} {YYYY}`, `{YYYY}-{MM}`, and more

### 📁 Local ICS Support

Now supports multiple ways to add local calendar sources:
- Vault-relative paths with file picker
- Absolute file system paths
- File:// URLs
- Automatic file validation and error handling

## Support

If you encounter any issues or have suggestions, please visit my [GitHub repository](https://github.com/formax68/memoChron) and create an issue.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
