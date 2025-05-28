# MemoChron v1.2.0 Release Notes

## New Features

### 🎯 Go to Today Command
- Added a new command "Go to today" that quickly navigates to the current month and selects today's date
- Accessible via the command palette (Cmd/Ctrl+P)

### 👁️ Hide Calendar Option
- New setting to hide the calendar grid and show only the agenda view
- Toggle calendar visibility with the new "Toggle calendar visibility" command

### 📜 Independent Scrolling
- Calendar grid now stays fixed at the top while the agenda list scrolls independently
- Better user experience when viewing days with many events

## Improvements

### 🔧 Code Refactoring
- Complete refactoring of the entire codebase for better maintainability
- Improved separation of concerns across all modules
- Better error handling and type safety
- More consistent code patterns throughout

### 📱 UI/UX Enhancements
- Improved CSS organization with better theme support
- Enhanced mobile responsiveness
- Cleaner visual hierarchy

## Technical Improvements

- Simplified main plugin class structure
- Refactored CalendarService for better readability (557 lines → more modular approach)
- Cleaned up NoteService with better template handling
- Improved CalendarView with smaller, focused methods
- Enhanced SettingsTab organization

## Bug Fixes

- Fixed TypeScript compilation errors
- Improved error handling across services
- Better cleanup of resources

