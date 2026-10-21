import { DateTime } from "luxon";

export interface EventDateVariables {
  week: string;
  dd: string;
  d: string;
  year: string;
  weekyear: string;
}

/**
 * Derive the week/day/year template variables for an event start date.
 * All values come from local-time accessors, never from the UTC ISO string.
 * - week: ISO 8601 week number (Monday start, week containing the first Thursday), unpadded
 * - dd: zero-padded day of month
 * - d: unpadded day of month
 * - year: four-digit calendar year (not the ISO week-year)
 * - weekyear: ISO 8601 week-numbering year, the year `week` belongs to. Use
 *   `{{weekyear}}-W{{week}}` for an ISO week label; `{{year}}-W{{week}}` is
 *   wrong near New Year (2027-01-01 is week 53 of 2026, not of 2027).
 * @param date The event start date
 * @returns The five date variables as strings
 */
export function getEventDateVariables(date: Date): EventDateVariables {
  const day = date.getDate().toString();
  const dt = DateTime.fromJSDate(date);
  return {
    week: dt.weekNumber.toString(),
    dd: day.padStart(2, "0"),
    d: day,
    year: date.getFullYear().toString(),
    weekyear: dt.weekYear.toString(),
  };
}
