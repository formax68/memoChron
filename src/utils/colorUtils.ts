// src/utils/colorUtils.ts

/**
 * Predefined set of colors for calendar sources
 * These colors are chosen to be visually distinct and accessible
 */
const DEFAULT_CALENDAR_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // yellow
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];

/**
 * Generate a color for a calendar source based on its index
 * @param index The index of the calendar source
 * @returns A hex color string
 */
export function getDefaultCalendarColor(index: number): string {
  return DEFAULT_CALENDAR_COLORS[index % DEFAULT_CALENDAR_COLORS.length];
}

/**
 * Generate a color based on a string (calendar name)
 * This ensures consistent colors for the same calendar name
 * @param name The calendar name
 * @returns A hex color string
 */
export function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % DEFAULT_CALENDAR_COLORS.length;
  return DEFAULT_CALENDAR_COLORS[index];
}

/**
 * Check if a color is valid hex color
 * @param color The color string to validate
 * @returns true if valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}