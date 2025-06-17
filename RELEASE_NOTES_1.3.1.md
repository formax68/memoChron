# Release Notes - v1.3.1

## 🎨 New Features

### Visual Calendar Color Picker
- **Custom Colors for Each Calendar**: Visually distinguish between different calendar sources with customizable colors
- **Interactive Color Picker**: 
  - Click the color button in settings to open a visual color picker
  - Choose from 12 carefully selected preset colors optimized for calendars
  - Use the color spectrum for custom color selection
  - Adjust brightness with the dedicated lightness bar
  - Enter precise hex values for exact color matching
- **Instant Updates**: Colors update immediately without requiring a calendar refresh
- **Smart UI Integration**:
  - Colors appear as dots in the calendar month view
  - Colored left borders in the agenda view for easy identification
  - Responsive design works perfectly on both desktop and mobile

## 🐛 Bug Fixes

### All-Day Event Handling
- Fixed an issue where all-day events would incorrectly span into the next day
- All-day events now properly display within their correct date boundaries
- Improved timezone handling for all-day events across different calendar sources

## 🔧 Technical Improvements

- Optimized color updates to work without network calls
- Enhanced CSS variable resolution in modal contexts
- Improved performance with visual-only updates for color changes
- Better memory management in the calendar service

## 📝 Notes

This release focuses on improving the visual organization of multiple calendar sources while fixing a long-standing issue with all-day event display. The color picker provides an intuitive way to manage calendar aesthetics without sacrificing performance.