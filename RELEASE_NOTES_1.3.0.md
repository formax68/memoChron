# MemoChron v1.3.0 Release Notes

## 🎉 New Features

### 📁 Local ICS File Support
- **Import from local files**: Use ICS files stored in your Obsidian vault or local file system as calendar sources
- **Multiple path formats supported**:
  - Vault-relative paths (e.g., `calendars/work.ics`)
  - Absolute file system paths (e.g., `/Users/username/calendar.ics`)
  - File:// URLs (e.g., `file:///Users/username/calendar.ics`)
- **File picker integration**: Use the built-in file picker to easily select ICS files from your vault
- **Automatic validation**: Proper error handling for missing or invalid files
- **Read-only support**: Local files are monitored but not modified by the plugin

### 📂 Smart Folder Organization
- **Customizable folder templates**: Automatically organize event notes into date-based subfolders
- **Rich template variables**:
  - Date formats: `{YYYY}`, `{YY}`, `{MM}`, `{M}`, `{MMM}`, `{MMMM}`, `{DD}`, `{D}`
  - Day formats: `{DDD}`, `{DDDD}`
  - Advanced: `{Q}` (quarter), `{source}` (calendar name), `{event_title}`
- **Live preview**: See exactly how your folder structure will look in the settings
- **Example templates**:
  - `{YYYY}/{MMM}` → `2025/Jun/`
  - `{source}/{YYYY}/{MMM}` → `Work Calendar/2025/Jun/`
  - `{YYYY}/Q{Q}` → `2025/Q2/`
- **Backwards compatible**: Leave template empty to use the existing flat folder structure

### 🎯 Drag & Drop Import
- **Instant note creation**: Drag single-event ICS files onto the agenda to create notes immediately
- **Meeting invite support**: Perfect for quickly creating notes from email meeting invites
- **Timezone handling**: All timezones are properly converted to your local time
- **Validation**: Only single-event ICS files are supported (multi-event files show helpful errors)

## 🔧 Improvements

### Enhanced Timezone Handling
- **Better UTC support**: Improved handling of UTC times using ical.js native methods
- **Windows timezone mapping**: Enhanced support for Windows timezone names
- **Fallback mechanisms**: Robust error handling for invalid timezone data
- **Consistent conversion**: All times are properly converted to local timezone

### User Experience
- **Improved settings UI**: Better organization and descriptions for new features
- **Error messaging**: More helpful error messages for common issues
- **File picker**: Intuitive file selection for local ICS files
- **Template preview**: Real-time preview of folder organization patterns

## 🐛 Bug Fixes
- Fixed UTC time handling for events without timezone information
- Improved error handling for malformed calendar data
- Better validation of user inputs in settings
- Resolved merge conflicts while preserving existing functionality

## 🔄 Migration Notes
- **Existing users**: All existing functionality remains unchanged
- **New folder template setting**: Default is empty (preserves current behavior)
- **Local ICS files**: New optional feature - existing remote calendars continue working as before
- **No breaking changes**: All current configurations and workflows are preserved

## 📋 Technical Details
- Added new utility modules for path and timezone handling
- Improved separation of concerns with dedicated service classes
- Enhanced TypeScript type safety
- Better error handling and user notifications
- Maintained backwards compatibility with existing installations

## 🚀 Getting Started with New Features

### To use local ICS files:
1. Go to Settings > MemoChron
2. Click "Add Calendar"
3. Use the file picker (📁) or enter a path manually
4. Name your calendar and enable it

### To organize notes in folders:
1. Go to Settings > MemoChron
2. Find "Folder path template"
3. Enter a template like `{YYYY}/{MMM}`
4. Watch the live preview
5. Save and create new notes to see the organization

### To use drag & drop:
1. Export a single event as ICS from your calendar app
2. Drag the file onto the agenda view in MemoChron
3. Drop when you see the "Drop ICS file here" message
4. Note is created instantly

---

**Full Changelog**: https://github.com/formax68/memoChron/compare/v1.2.2...v1.3.0