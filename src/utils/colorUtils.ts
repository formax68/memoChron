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
 * Get theme-aware colors by reading CSS variables if available
 * Falls back to default colors if theme variables are not available
 */
function getThemeColors(): string[] {
  const colors: string[] = [];
  
  // Try to get theme-defined accent colors
  const root = document.documentElement;
  const style = getComputedStyle(root);
  
  // Check for common theme color variables
  const themeVars = [
    '--color-accent',
    '--color-accent-1', 
    '--color-accent-2',
    '--interactive-accent',
    '--text-accent',
    '--color-blue',
    '--color-red',
    '--color-green',
    '--color-orange',
    '--color-purple',
    '--color-pink'
  ];
  
  for (const varName of themeVars) {
    const color = style.getPropertyValue(varName).trim();
    if (color && isValidHexColor(color)) {
      colors.push(color);
    } else if (color && color.startsWith('hsl(')) {
      // Convert HSL to hex if needed
      const hexColor = hslToHex(color);
      if (hexColor) colors.push(hexColor);
    }
  }
  
  // If we have some theme colors, use them, otherwise fall back to defaults
  return colors.length >= 3 ? colors : DEFAULT_CALENDAR_COLORS;
}

/**
 * Generate a theme-aware color for a calendar source based on its index
 * @param index The index of the calendar source
 * @returns A hex color string
 */
export function getThemeAwareCalendarColor(index: number): string {
  const themeColors = getThemeColors();
  return themeColors[index % themeColors.length];
}

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
 * Convert HSL color string to hex
 * @param hslString HSL color string like "hsl(210, 50%, 50%)"
 * @returns Hex color string or null if invalid
 */
function hslToHex(hslString: string): string | null {
  const hslMatch = hslString.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
  if (!hslMatch) return null;

  const h = parseInt(hslMatch[1]) / 360;
  const s = parseInt(hslMatch[2]) / 100;
  const l = parseInt(hslMatch[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 1/6) {
    r = c; g = x; b = 0;
  } else if (1/6 <= h && h < 2/6) {
    r = x; g = c; b = 0;
  } else if (2/6 <= h && h < 3/6) {
    r = 0; g = c; b = x;
  } else if (3/6 <= h && h < 4/6) {
    r = 0; g = x; b = c;
  } else if (4/6 <= h && h < 5/6) {
    r = x; g = 0; b = c;
  } else if (5/6 <= h && h < 1) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
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