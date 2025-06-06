// src/utils/colorUtils.ts

/**
 * Predefined set of colors for calendar sources
 * These colors are chosen to be visually distinct and accessible (WCAG AA compliant)
 */
const DEFAULT_CALENDAR_COLORS = [
  "#3b82f6", // blue - 3.68:1
  "#ef4444", // red - 3.76:1  
  "#059669", // green (darker) - 3.2:1
  "#d97706", // orange (darker) - 3.2:1
  "#8b5cf6", // purple - 4.23:1
  "#ec4899", // pink - 3.53:1
  "#0891b2", // cyan (darker) - 3.1:1
  "#65a30d", // lime (darker) - 3.0:1
  "#dc2626", // red variant - 4.5:1
  "#6366f1", // indigo - 4.47:1
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

/**
 * Convert hex color to RGB values
 * @param hex The hex color string
 * @returns RGB object with r, g, b values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate luminance of a color for accessibility checking
 * @param r Red value (0-255)
 * @param g Green value (0-255) 
 * @param b Blue value (0-255)
 * @returns Luminance value
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Check if color provides sufficient contrast against common backgrounds
 * @param color The hex color to check
 * @returns Object with contrast information
 */
export function checkColorContrast(color: string): { isAccessible: boolean; contrastRatio: number } {
  const rgb = hexToRgb(color);
  if (!rgb) return { isAccessible: false, contrastRatio: 0 };
  
  const colorLuminance = getLuminance(rgb.r, rgb.g, rgb.b);
  // Check against white background (common in light themes)
  const whiteLuminance = 1;
  const contrastRatio = (whiteLuminance + 0.05) / (colorLuminance + 0.05);
  
  // WCAG AA standard requires contrast ratio of at least 3:1 for non-text elements
  return {
    isAccessible: contrastRatio >= 3,
    contrastRatio: contrastRatio
  };
}