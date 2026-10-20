import { DateTime } from "luxon";

export interface EventDateVariables {
  week: string;
  dd: string;
  d: string;
  year: string;
}

/**
 * Derive the week/day/year template variables for an event start date.
 * All values come from local-time accessors, never from the UTC ISO string.
 * - week: ISO 8601 week number (Monday start, week containing the first Thursday), unpadded
 * - dd: zero-padded day of month
 * - d: unpadded day of month
 * - year: four-digit calendar year (not the ISO week-year)
 * @param date The event start date
 * @returns The four date variables as strings
 */
export function getEventDateVariables(date: Date): EventDateVariables {
  const day = date.getDate().toString();
  return {
    week: DateTime.fromJSDate(date).weekNumber.toString(),
    dd: day.padStart(2, "0"),
    d: day,
    year: date.getFullYear().toString(),
  };
}
