---
status: partial
phase: 02-security-correctness
source: [02-VERIFICATION.md]
started: 2026-05-11T06:43:00Z
updated: 2026-05-11T06:43:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Crafted-color injection rejected at load time

expected: Load Obsidian with a vault whose `.obsidian/plugins/memochron/data.json` contains a `calendarUrls` entry whose color is the literal string `"><script>alert(1)</script>`. Plugin loads without an alert firing; the loaded settings show the calendar with a fallback `hsl(...)` color; console.warn contains `MemoChron: Invalid color` diagnostic.
result: [pending]

### 2. Render-time defensive guard against DevTools-injected malformed color

expected: With the settings tab open, programmatically set `settings.calendarUrls[0].color` to `">"<svg/onload=alert(1)>` via DevTools and re-render the swatch. Swatch falls back to the plus-icon (isValidColor rejects the value); no script executes; no markup leaks into the DOM.
result: [pending]

### 3. Visual regression — color swatches via createElementNS

expected: Open Obsidian settings, expand each calendar source's color section and the daily-note color section. Color swatches render visually identical to pre-Phase-2 implementation (same circle dimensions, same plus icon for unset colors, same fill for set colors).
result: [pending]

### 4. Non-Error throwable produces meaningful Notice text

expected: Drop a malformed (non-Error throwable) into the calendar fetch path or ICS-import drop handler. User-facing Notice reads a meaningful stringified message — never `undefined` or `[object Object]`.
result: [pending]

### 5. Concurrent-fetch race produces no double-render

expected: Trigger two near-simultaneous fetches — click Force Refresh while the auto-refresh timer fires (or invoke `fetchCalendars` twice from DevTools without awaiting). Only one network round-trip; both callers receive the same `CalendarEvent[]`; no duplicate events appear in the agenda; no double-render of the calendar grid.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
