import { DateTime } from "luxon";
import { Time } from "ical.js";

// Single source of truth for timezone mappings
// Comprehensive mapping of Windows/Exchange timezone names to IANA timezone identifiers
export const TIMEZONE_MAP: Record<string, string> = {
  // North America
  "Pacific Standard Time": "America/Los_Angeles",
  "Mountain Standard Time": "America/Denver",
  "Central Standard Time": "America/Chicago",
  "Eastern Standard Time": "America/New_York",
  "US Eastern Standard Time": "America/Indianapolis",
  "US Mountain Standard Time": "America/Phoenix",
  "Hawaii-Aleutian Standard Time": "Pacific/Honolulu",
  "Alaskan Standard Time": "America/Anchorage",
  "Atlantic Standard Time": "America/Halifax",
  "Canada Central Standard Time": "America/Regina",
  "Central America Standard Time": "America/Guatemala",
  "Mexico Standard Time": "America/Mexico_City",
  "US Central Standard Time": "America/Chicago",

  // South America
  "SA Eastern Standard Time": "America/Cayenne",
  "SA Pacific Standard Time": "America/Bogota",
  "SA Western Standard Time": "America/La_Paz",
  "E. South America Standard Time": "America/Sao_Paulo",
  "Central Brazilian Standard Time": "America/Cuiaba",
  "Argentina Standard Time": "America/Buenos_Aires",
  "Venezuela Standard Time": "America/Caracas",
  "Pacific SA Standard Time": "America/Santiago",

  // Europe
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Warsaw",
  "Romance Standard Time": "Europe/Paris",
  "Central European Standard Time": "Europe/Budapest",
  "E. Europe Standard Time": "Europe/Chisinau",
  "GTB Standard Time": "Europe/Athens",
  "FLE Standard Time": "Europe/Helsinki",
  "Russian Standard Time": "Europe/Moscow",
  "Belarus Standard Time": "Europe/Minsk",
  "Turkey Standard Time": "Europe/Istanbul",
  "Kaliningrad Standard Time": "Europe/Kaliningrad",

  // Africa
  "South Africa Standard Time": "Africa/Johannesburg",
  "W. Central Africa Standard Time": "Africa/Lagos",
  "Egypt Standard Time": "Africa/Cairo",
  "Libya Standard Time": "Africa/Tripoli",
  "Morocco Standard Time": "Africa/Casablanca",

  // Asia
  "Middle East Standard Time": "Asia/Beirut",
  "Iran Standard Time": "Asia/Tehran",
  "Arabian Standard Time": "Asia/Dubai",
  "Afghanistan Standard Time": "Asia/Kabul",
  "West Asia Standard Time": "Asia/Tashkent",
  "India Standard Time": "Asia/Kolkata",
  "Sri Lanka Standard Time": "Asia/Colombo",
  "Nepal Standard Time": "Asia/Kathmandu",
  "Central Asia Standard Time": "Asia/Almaty",
  "Bangladesh Standard Time": "Asia/Dhaka",
  "Myanmar Standard Time": "Asia/Rangoon",
  "SE Asia Standard Time": "Asia/Bangkok",
  "N. Central Asia Standard Time": "Asia/Novosibirsk",
  "China Standard Time": "Asia/Shanghai",
  "North Asia Standard Time": "Asia/Krasnoyarsk",
  "Singapore Standard Time": "Asia/Singapore",
  "W. Australia Standard Time": "Australia/Perth",
  "Taipei Standard Time": "Asia/Taipei",
  "Ulaanbaatar Standard Time": "Asia/Ulaanbaatar",
  "North Asia East Standard Time": "Asia/Irkutsk",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "Cen. Australia Standard Time": "Australia/Adelaide",
  "AUS Central Standard Time": "Australia/Darwin",
  "E. Australia Standard Time": "Australia/Brisbane",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "West Pacific Standard Time": "Pacific/Port_Moresby",
  "Tasmania Standard Time": "Australia/Hobart",
  "Vladivostok Standard Time": "Asia/Vladivostok",

  // Pacific
  "Central Pacific Standard Time": "Pacific/Guadalcanal",
  "New Zealand Standard Time": "Pacific/Auckland",
  "Fiji Standard Time": "Pacific/Fiji",
  "Tonga Standard Time": "Pacific/Tongatapu",

  // UTC and special cases
  UTC: "UTC",
  "Coordinated Universal Time": "UTC",
  "tzone://Microsoft/Utc": "UTC",
  // Intentionally do not map "Customized Time Zone" so that VTIMEZONE rules
  // embedded in the ICS are honored by ical.js for such custom tzids

  // Common UTC offset formats
  "(UTC+02:00) Athens, Bucharest": "Europe/Athens",
  "(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna": "Europe/Berlin",
  "(UTC+00:00) Dublin, Edinburgh, Lisbon, London": "Europe/London",
  "(UTC-05:00) Eastern Time (US & Canada)": "America/New_York",
  "(UTC-06:00) Central Time (US & Canada)": "America/Chicago",
  "(UTC-07:00) Mountain Time (US & Canada)": "America/Denver",
  "(UTC-08:00) Pacific Time (US & Canada)": "America/Los_Angeles",
};

/**
 * Normalize timezone names to handle various formats and edge cases
 * @param tzid The timezone identifier to normalize
 * @returns Normalized timezone identifier
 */
function normalizeTimezone(tzid: string): string {
  if (!tzid) return "UTC";
  
  // Trim whitespace and handle empty strings
  const cleaned = tzid.trim();
  if (!cleaned) return "UTC";
  
  // Handle Microsoft special timezone format
  if (cleaned.startsWith("tzone://Microsoft/")) {
    const extracted = cleaned.replace("tzone://Microsoft/", "");
    if (extracted.toLowerCase() === "utc") return "UTC";
  }
  
  // Handle UTC offset formats like "(UTC+02:00) Athens, Bucharest"
  const utcOffsetMatch = cleaned.match(/^\(UTC[+-]\d{2}:\d{2}\)\s*(.+)$/);
  if (utcOffsetMatch) {
    // Return the full string as key since we have specific mappings for these
    return cleaned;
  }
  
  // Handle other special cases
  if (cleaned.toLowerCase() === "customized time zone") {
    return "Customized Time Zone";
  }
  
  return cleaned;
}

/**
 * Convert an ICAL Time object to a JavaScript Date in the local timezone
 * @param icalTime The ICAL Time object to convert
 * @param tzid The timezone ID (can be Windows or IANA format)
 * @param isAllDay Whether this is an all-day event (VALUE=DATE)
 * @returns Date object in local timezone
 */
export function convertIcalTimeToDate(icalTime: Time, tzid: string | null, isAllDay: boolean = false): Date {
  // Get the time components from the ICAL Time object
  const year = icalTime.year;
  const month = icalTime.month;
  const day = icalTime.day;
  const hour = icalTime.hour;
  const minute = icalTime.minute;
  const second = icalTime.second;

  // All-day events should be treated as timezone-agnostic
  // They represent a date in local time, not a specific moment in time
  if (isAllDay) {
    // For all-day events, ignore timezone and create date in local time
    // This ensures the event stays on the correct day regardless of timezone
    return new Date(year, month - 1, day, 0, 0, 0);
  }

  // If no timezone specified, let ical.js handle the conversion
  // This preserves the original behavior while fixing UTC times
  if (!tzid) {
    // Use ical.js's built-in toJSDate() which handles UTC times correctly
    // This is safer than manual construction as it respects the original format
    try {
      return icalTime.toJSDate();
    } catch (error) {
      console.warn("Failed to use ical.js toJSDate(), falling back to manual construction:", error);
      // Fallback to original behavior for floating times
      return new Date(year, month - 1, day, hour, minute, second);
    }
  }

  // Map Windows timezone names to IANA timezone identifiers
  const normalizedTzid = normalizeTimezone(tzid);
  const mappedZone = TIMEZONE_MAP[normalizedTzid];
  const zone = mappedZone || normalizedTzid;
  
  try {
    // If tzid is not in our map (custom/unknown) but ical.js has timezone
    // context (via VTIMEZONE), defer to ical.js conversion to respect rules
    if (!mappedZone && (icalTime as any).zone) {
      return icalTime.toJSDate();
    }

    // Create a DateTime object in the specified timezone
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute, second },
      { zone }
    );

    if (!dt.isValid) {
      console.warn(`Invalid timezone conversion for zone: ${normalizedTzid} (mapped to ${zone}), falling back to local time`);
      return new Date(year, month - 1, day, hour, minute, second);
    }

    // Convert to local timezone
    return dt.toLocal().toJSDate();
  } catch (error) {
    console.error("Failed to convert ICAL time:", error, { icalTime, tzid: normalizedTzid, mappedZone: zone });
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
  const normalizedTzid = normalizeTimezone(tzid);
  const zone = TIMEZONE_MAP[normalizedTzid] || normalizedTzid;

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
    console.warn(`Invalid timezone conversion for zone: ${normalizedTzid} (mapped to ${zone}), using original date`);
    return date;
  }

  // Convert to local timezone
  return dt.toLocal().toJSDate();
}

/**
 * Check if a timezone is mapped in our timezone map
 * @param tzid The timezone identifier to check
 * @returns True if the timezone is mapped, false otherwise
 */
export function isTimezoneMappped(tzid: string): boolean {
  if (!tzid) return false;
  const normalizedTzid = normalizeTimezone(tzid);
  return normalizedTzid in TIMEZONE_MAP;
}

/**
 * Get the mapped IANA timezone for a given timezone identifier
 * @param tzid The timezone identifier
 * @returns The mapped IANA timezone or the original tzid if not mapped
 */
export function getMappedTimezone(tzid: string): string {
  if (!tzid) return "UTC";
  const normalizedTzid = normalizeTimezone(tzid);
  return TIMEZONE_MAP[normalizedTzid] || normalizedTzid;
}