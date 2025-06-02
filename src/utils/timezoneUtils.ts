import { DateTime } from "luxon";
import { Time } from "ical.js";

// Single source of truth for timezone mappings
export const TIMEZONE_MAP: Record<string, string> = {
  "Pacific Standard Time": "America/Los_Angeles",
  "Mountain Standard Time": "America/Denver",
  "Central Standard Time": "America/Chicago",
  "Eastern Standard Time": "America/New_York",
  "US Eastern Standard Time": "America/Indianapolis",
  "US Mountain Standard Time": "America/Phoenix",
  "Hawaii-Aleutian Standard Time": "Pacific/Honolulu",
  "Alaskan Standard Time": "America/Anchorage",
  "Atlantic Standard Time": "America/Halifax",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "Central European Standard Time": "Europe/Budapest",
  "E. Europe Standard Time": "Europe/Bucharest",
  "GTB Standard Time": "Europe/Athens",
  "Russian Standard Time": "Europe/Moscow",
  "Singapore Standard Time": "Asia/Singapore",
  "China Standard Time": "Asia/Shanghai",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "India Standard Time": "Asia/Kolkata",
  UTC: "UTC",
  "Coordinated Universal Time": "UTC",
};

/**
 * Convert an ICAL Time object to a JavaScript Date in the local timezone
 * @param icalTime The ICAL Time object to convert
 * @param tzid The timezone ID (can be Windows or IANA format)
 * @returns Date object in local timezone
 */
export function convertIcalTimeToDate(icalTime: Time, tzid: string | null): Date {
  // Get the time components from the ICAL Time object
  const year = icalTime.year;
  const month = icalTime.month;
  const day = icalTime.day;
  const hour = icalTime.hour;
  const minute = icalTime.minute;
  const second = icalTime.second;

  // If no timezone specified, create date in local timezone
  if (!tzid) {
    return new Date(year, month - 1, day, hour, minute, second);
  }

  // Map Windows timezone names to IANA timezone identifiers
  const zone = TIMEZONE_MAP[tzid] || tzid;
  
  try {
    // Create a DateTime object in the specified timezone
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute, second },
      { zone }
    );

    if (!dt.isValid) {
      console.warn(`Invalid timezone conversion for zone: ${zone}, falling back to local time`);
      return new Date(year, month - 1, day, hour, minute, second);
    }

    // Convert to local timezone
    return dt.toLocal().toJSDate();
  } catch (error) {
    console.error("Failed to convert ICAL time:", error, { icalTime, tzid });
    // Fallback to simple date creation
    return new Date(year, month - 1, day, hour, minute, second);
  }
}

/**
 * Convert a regular Date object using timezone information
 * Used for legacy code or when we don't have ICAL Time objects
 */
export function convertTimezone(date: Date, tzid: string | null): Date {
  // If no timezone specified, assume the date is already in local time
  if (!tzid) {
    return date;
  }

  // Map Windows timezone names to IANA timezone identifiers
  const zone = TIMEZONE_MAP[tzid] || tzid;

  // The date from ical.js is parsed as if it were in UTC, but it's actually
  // in the timezone specified by tzid. We need to interpret it correctly.
  // First, get the date components as if they were in the target timezone
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();

  // Create a DateTime object in the specified timezone
  let dt = DateTime.fromObject(
    { year, month, day, hour, minute, second },
    { zone }
  );

  if (!dt.isValid) {
    console.warn(`Invalid timezone conversion for zone: ${zone}, using original date`);
    return date;
  }

  // Convert to local timezone
  return dt.toLocal().toJSDate();
}