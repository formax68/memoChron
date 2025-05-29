# Release Notes - Version 1.2.1

## Bug Fixes

### Timezone Handling
- Fixed incorrect timezone conversion for calendar events with explicit timezones
- Events with timezones like "India Standard Time" now display correctly in local time
- Improved handling of recurrence exceptions with timezone information

### Technical Details
- Added `convertIcalTimeToDate()` method for proper ICAL Time object interpretation
- Updated Time type definitions to include date/time component properties
- Fixed timezone conversion in recurrence exception processing

This release ensures that all calendar events display at the correct time regardless of their source timezone.