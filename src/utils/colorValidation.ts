// Module-private whitelist regex for CSS color values produced by this codebase.
// Accepted formats (anchored start to end):
//   - Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
//   - hsl(...) and hsla(...) — function args cannot contain ( ) < or >
//   - rgb(...) and rgba(...) — function args cannot contain ( ) < or >
//   - var(--<identifier>) where <identifier> matches [a-zA-Z0-9_-]+
//
// The hex alternation #[0-9a-fA-F]{3}([0-9a-fA-F]([0-9a-fA-F]{2}([0-9a-fA-F]{2})?)?)?
// matches exactly 3, 4, 6, or 8 hex digits after #; it deliberately does NOT match 5 or 7.
//
// The leading ^ and trailing $ anchors are critical — without them a crafted value like
// "#abc<script>" would match the hex prefix and slip through.
const VALID_COLOR_REGEX =
  /^(#[0-9a-fA-F]{3}([0-9a-fA-F]([0-9a-fA-F]{2}([0-9a-fA-F]{2})?)?)?|hsla?\([^()<>]*\)|rgba?\([^()<>]*\)|var\(--[a-zA-Z0-9_-]+\))$/;

/**
 * Validate a CSS color string against a whitelist of formats produced by this codebase.
 * Accepts hex (#rgb/#rgba/#rrggbb/#rrggbbaa), hsl/hsla(...), rgb/rgba(...), and var(--name).
 * Anchored to start/end and rejects any markup-breaking characters inside function args.
 * @param value The color string to validate
 * @returns true if the value matches an allowed format, false otherwise
 */
export function isValidColor(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }
  return VALID_COLOR_REGEX.test(value);
}

/**
 * Compute a deterministic default color for a calendar source at the given index.
 * Mirrors getNextAvailableColor() in SettingsTab — golden-angle hue distribution.
 * @param index Zero-based index of the calendar source
 * @returns CSS color string in hsl(...) format
 */
export function defaultColorForIndex(index: number): string {
  const hue = (index * 137.5) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Compute the default dailyNoteColor — Obsidian theme accent color, with hex fallback.
 * @returns CSS color string from --interactive-accent CSS var, or "#7c3aed" if unavailable
 */
export function defaultDailyNoteColor(): string {
  const accent = getComputedStyle(activeDocument.documentElement)
    .getPropertyValue("--interactive-accent")
    .trim();
  return accent || "#7c3aed";
}
