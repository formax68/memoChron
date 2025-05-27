/**
 * Utility functions for formatting various data types
 */

/**
 * Format location text with appropriate emoji based on location type
 */
export function formatLocationText(location?: string): string {
  if (!location) {
    return "";
  }

  const isUrl =
    location.startsWith("http://") ||
    location.startsWith("https://") ||
    location.startsWith("www.");

  const isVirtual =
    location.toLowerCase().includes("zoom") ||
    location.toLowerCase().includes("meet.") ||
    location.toLowerCase().includes("teams") ||
    location.toLowerCase().includes("webex");

  const locationEmoji = isUrl ? "🔗" : isVirtual ? "💻" : "📍";
  return `${locationEmoji} ${location}`;
}

/**
 * Create a DOM element for displaying location
 */
export function createLocationElement(location: string): HTMLElement {
  const locationEl = document.createElement("div");
  locationEl.className = "memochron-event-location";
  locationEl.textContent = formatLocationText(location);
  return locationEl;
}

/**
 * Sanitize filename by replacing invalid characters
 */
export function sanitizeFileName(str: string): string {
  return str.replace(/[\\/:*?"<>|]/g, "-");
}

/**
 * Parse comma-separated tags string into array
 */
export function parseTagsString(tagsString: string): string[] {
  return tagsString
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}
