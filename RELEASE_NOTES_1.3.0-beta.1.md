# Beta Release 1.3.0-beta.1

This beta release introduces local file support and drag & drop functionality for MemoChron.

## New Features

### 📁 Local ICS File Support
- Use ICS files stored in your Obsidian vault or local file system as calendar sources
- Support for multiple path formats:
  - Vault-relative paths: `calendars/work.ics`
  - Absolute paths: `/Users/username/calendar.ics` or `C:\Users\username\calendar.ics`
  - File URLs: `file:///path/to/calendar.ics`
- File picker button in settings for easy ICS file selection from vault
- Same refresh and caching behavior as remote calendars

### 🎯 Drag & Drop Import
- Drag single-event ICS files directly onto the agenda view
- Creates notes instantly without adding events to calendar sources
- Perfect for quick note creation from meeting invites
- Visual feedback during drag operation
- Clear error messages for multi-event files

### 🌍 Improved Timezone Handling
- Refactored timezone conversion for better accuracy
- Single source of truth for timezone mappings
- Consistent timezone handling across all import methods
- Better support for Windows timezone names

## Bug Fixes
- Fixed timezone conversion for recurrence exceptions
- Fixed Windows path detection for file URLs
- Improved error handling for invalid file paths

## Testing Instructions

1. Install via BRAT plugin (see README for instructions)
2. Test local ICS files:
   - Add a local ICS file as a calendar source
   - Use the file picker to select ICS files from your vault
   - Try different path formats
3. Test drag & drop:
   - Export a single event from your calendar as ICS
   - Drag it onto the agenda view
   - Verify note is created with correct details
4. Verify timezone handling with events from different timezones

## Known Limitations
- Local files are not automatically watched for changes
- Drag & drop only supports single-event ICS files
- File picker only shows ICS files already in your vault

## Feedback
Please report any issues with "beta" in the title on GitHub.