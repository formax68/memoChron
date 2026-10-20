# Phase 2: Security & Correctness - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 11 (9 modified + 2 new)
**Analogs found:** 9 / 11 (2 new utilities have shape-analogs only; their *content* patterns are net-new)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/utils/errors.ts` (NEW) | utility | transform | `src/utils/pathUtils.ts` | role-match (utility module shape) |
| `src/utils/colorValidation.ts` (NEW) | utility | transform | `src/utils/pathUtils.ts` | role-match (utility module shape) |
| `src/main.ts` (loadSettings validation pass) | config | request-response | `src/main.ts:98-100` (current `loadSettings`) | exact (in-place extension) |
| `src/settings/SettingsTab.ts` (SVG sites + error.message) | config | request-response | `src/settings/SettingsTab.ts:543-573` (color swatch picker — non-innerHTML construction path) | exact (sibling pattern in same method) |
| `src/services/CalendarService.ts` (fetchInFlight Promise + error normalizations) | service | request-response | `IcsImportService.ts:91-96` (existing `error instanceof Error` pattern — canonical post-refactor); no analog for shared-Promise dedup (net-new pattern) | partial |
| `src/services/NoteService.ts` (catch normalizations) | service | CRUD | `IcsImportService.ts:91-96` | role-match |
| `src/services/IcsImportService.ts` (refactor existing pattern to helper) | service | transform | `IcsImportService.ts:32-50` (the existing `instanceof Error` site to be refactored) | exact (self-pattern) |
| `src/views/CalendarView.ts` (catches + error.message + getStartOfWeek) | view | event-driven | `IcsImportService.ts:91-96`; `getStartOfWeek` is a pure-function fix (no analog, formula-level work) | role-match |
| `src/views/EmbeddedCalendarView.ts` (catch normalization) | view | event-driven | `IcsImportService.ts:91-96` | role-match |
| `src/views/EmbeddedAgendaView.ts` (catch normalization) | view | event-driven | `IcsImportService.ts:91-96` | role-match |
| `src/utils/timezoneUtils.ts` (catch normalizations) | utility | transform | `IcsImportService.ts:91-96` | role-match |

## Pattern Assignments

### `src/utils/errors.ts` (NEW — utility, transform)

**Analog (module shape):** `src/utils/pathUtils.ts`
**Analog (canonical instanceof check, post-refactor):** `src/services/IcsImportService.ts:32-50`

**Imports / module-shape pattern** — `src/utils/pathUtils.ts:1-2`:

```typescript
import { normalizePath } from "obsidian";

export enum PathType {
```

Notes for the planner:
- Single named-export module style (no default export, no barrel index).
- Top-of-file external imports only (and only if needed — `errors.ts` likely needs zero imports).
- File header comments are not required; project does not use file-level JSDoc banners.

**JSDoc convention for exported helpers** — `src/utils/timezoneUtils.ts:142-148`:

```typescript
/**
 * Convert an ICAL Time object to a JavaScript Date in the local timezone
 * @param icalTime The ICAL Time object to convert
 * @param tzid The timezone ID (can be Windows or IANA format)
 * @param isAllDay Whether this is an all-day event (VALUE=DATE)
 * @returns Date object in local timezone
 */
export function convertIcalTimeToDate(...
```

JSDoc with `@param` and `@returns` lines is the consistent convention in `src/utils/timezoneUtils.ts` for exported functions. `errorMessage` should follow the same shape (one-line summary + `@param` + `@returns`).

**Canonical `instanceof Error` extraction (the body of `errorMessage`)** — derived from the spec at CONTEXT.md D-09 + the existing pattern at `IcsImportService.ts:32-44`:

```typescript
// Existing IcsImportService pattern (the half this helper preserves):
if (
  error instanceof Error &&
  typeof error.message === "string" &&
  ...
)
```

**Planner action:**
- File: `src/utils/errors.ts`
- Sole export: `export function errorMessage(err: unknown): string`
- Body: `return err instanceof Error ? err.message : String(err);`
- Add a short JSDoc summary line (matching `timezoneUtils.ts` style).
- No imports needed.
- No file-level constants.
- No additional helpers in this file (single-purpose, per D-09).

---

### `src/utils/colorValidation.ts` (NEW — utility, transform)

**Analog (module shape):** `src/utils/pathUtils.ts`
**Analog (HSL fallback chooser logic):** `src/settings/SettingsTab.ts:536-541` (`getNextAvailableColor`)
**Analog (CSS-var fallback chooser logic):** `src/settings/SettingsTab.ts:167-172` (the `--interactive-accent` `getComputedStyle` pattern for `dailyNoteColor`)

**Module-shape pattern** — `src/utils/pathUtils.ts:1-15`:

```typescript
import { normalizePath } from "obsidian";

export enum PathType {
  HTTP_URL = "http_url",
  ...
}

export interface PathInfo {
  type: PathType;
  ...
}

export function detectPathType(path: string): PathType {
  if (!path) {
    return PathType.VAULT_RELATIVE;
  }
  ...
}
```

`pathUtils.ts` shows the established pattern for a util that:
- Exports a small set of named functions (no default export)
- Has guard-style early returns at the top of each function
- No class wrapper; pure functions only

**HSL palette fallback chooser** — `src/settings/SettingsTab.ts:536-541`:

```typescript
private getNextAvailableColor(): string {
  // Generate a random hue for auto-assignment
  const usedColors = this.plugin.settings.calendarUrls.length;
  const hue = (usedColors * 137.5) % 360; // Golden angle for nice distribution
  return `hsl(${hue}, 70%, 50%)`;
}
```

This is a class-private method on `SettingsTab` and depends on `this.plugin.settings.calendarUrls.length`. The new utility cannot reuse it as-is because:
- The utility does not have access to `this.plugin`
- The utility runs at `loadSettings` time, before `SettingsTab` exists

**Planner option A:** Mirror the formula in `colorValidation.ts` as a free function that takes the index as a parameter:

```typescript
// Pseudocode the planner can ground-truth — formula taken verbatim from SettingsTab.ts:536-541
export function defaultColorForIndex(index: number): string {
  const hue = (index * 137.5) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
```

**Planner option B:** Use the CSS-var pattern at `SettingsTab.ts:167-172`:

```typescript
// SettingsTab.ts:167-172 — current dailyNoteColor default
this.plugin.settings.dailyNoteColor =
  getComputedStyle(document.documentElement)
    .getPropertyValue("--interactive-accent")
    .trim() || "#7c3aed";
```

Note: `getComputedStyle` requires `document.documentElement`, which is available at `loadSettings()` time but produces an empty string if the theme has not yet computed the variable. The trailing `|| "#7c3aed"` literal is the failsafe.

**Validator regex / format whitelist** — per CONTEXT.md D-02 the accepted formats are:
- `#rgb` and `#rrggbb` (3- and 6-digit hex)
- `#rgba` and `#rrggbbaa` (4- and 8-digit hex with alpha)
- `hsl(...)` and `hsla(...)`
- `rgb(...)` and `rgba(...)`
- `var(--<identifier>)` where `<identifier>` is `[a-zA-Z0-9_-]+`

These formats are observed in the codebase at:
- `src/utils/constants.ts:18-27` — `var(--color-red)` etc. (palette)
- `src/settings/SettingsTab.ts:164` — `hsl(${hue}, 70%, 50%)` (auto-assignment)
- `src/settings/SettingsTab.ts:601` — hex from `<input type="color">` (always `#rrggbb`)
- `src/settings/SettingsTab.ts:171` — `#7c3aed` (fallback literal)

**Planner action:**
- File: `src/utils/colorValidation.ts`
- Exports:
  - `export function isValidColor(value: string): boolean` — returns true for the whitelist above; false otherwise
  - A default-color chooser. Planner picks ONE of:
    - `export function defaultColorForIndex(index: number): string` — mirrors the HSL formula from `SettingsTab.ts:536-541`
    - `export function defaultDailyNoteColor(): string` — mirrors the CSS-var path from `SettingsTab.ts:167-172`
  - (CONTEXT.md D-04: pick the same logic that `getNextAvailableColor()` uses for new sources — option A is preferred for `calendarUrls[].color`; option B is preferred for `dailyNoteColor`. Planner may produce both helpers.)
- JSDoc on each export following `timezoneUtils.ts` style.
- No imports from project sources; only browser globals (`getComputedStyle`, `document`) if option B is included.

---

### `src/main.ts` (config, request-response — `loadSettings()` color-validation pass)

**Analog (target site):** `src/main.ts:98-100` (the existing `loadSettings`)

**Existing site** — `src/main.ts:98-100`:

```typescript
async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}
```

**Pattern for in-place validation pass after the merge:**

```typescript
// Pseudocode — planner grounds the exact import path and helper names
import { isValidColor, defaultColorForIndex, defaultDailyNoteColor } from "./utils/colorValidation";

async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

  // SEC-01 (D-03, D-04): validate and replace any malformed stored colors
  this.settings.calendarUrls.forEach((source, index) => {
    if (source.color && !isValidColor(source.color)) {
      console.warn(
        `MemoChron: Invalid color "${source.color}" on calendar "${source.name}" — replacing with default.`
      );
      source.color = defaultColorForIndex(index);
    }
  });

  if (this.settings.dailyNoteColor && !isValidColor(this.settings.dailyNoteColor)) {
    console.warn(
      `MemoChron: Invalid dailyNoteColor "${this.settings.dailyNoteColor}" — replacing with default.`
    );
    this.settings.dailyNoteColor = defaultDailyNoteColor();
  }
}
```

**Logging convention** — `src/services/CalendarService.ts:333` and `:331`:

```typescript
console.error("MemoChron: Failed to save calendar cache:", error);
console.log("MemoChron: Calendar cache saved");
```

The `"MemoChron: "` prefix is consistent across all external-facing console output (CONVENTIONS.md "Prefix convention"). The `console.warn` message in the validator must follow the same prefix.

**Planner action:**
- Import `isValidColor` and the default-color helper(s) from `./utils/colorValidation`.
- After the existing `Object.assign(...)` line, iterate `this.settings.calendarUrls` and validate each `.color`. Replace invalid values silently and `console.warn` with the calendar source name (per D-04).
- Validate `this.settings.dailyNoteColor` independently.
- No `Notice` (D-04 — invalid color is a developer-diagnostic event).

---

### `src/settings/SettingsTab.ts` (config, request-response — innerHTML SVG sites + render-time validator + error.message)

**Analog (existing non-innerHTML construction):** `src/settings/SettingsTab.ts:543-573` (color swatch picker — uses `container.createDiv` + `swatch.style.backgroundColor`)
**Analog (in-codebase use of `setAttribute`-style construction):** None — the SVG `createElementNS` approach is net-new for this codebase.

**Current state — site 1 (custom color swatch SVG)** — `src/settings/SettingsTab.ts:587-594`:

```typescript
if (isCustom) {
  // Show current color as a filled circle
  customLabel.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${currentColor}" stroke="#888" stroke-width="2"/></svg>`;
} else {
  // Show + icon
  customLabel.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#888" stroke-width="2"/><text x="12" y="17" text-anchor="middle" font-size="16" fill="#888">+</text></svg>';
}
```

**Current state — site 2 (daily-note color swatch SVG)** — `src/settings/SettingsTab.ts:673-680`:

```typescript
if (isCustom) {
  // Show current color as a filled circle
  customLabel.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${currentColor}" stroke="#888" stroke-width="2"/></svg>`;
} else {
  // Show + icon
  customLabel.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#888" stroke-width="2"/><text x="12" y="17" text-anchor="middle" font-size="16" fill="#888">+</text></svg>';
}
```

Both sites build the **same SVG**. CONTEXT.md (Integration Points) explicitly calls out extracting a private helper `buildColorSwatch(color: string): SVGElement` to avoid duplication.

**Replacement pattern** — net-new for this codebase. The planner must construct via `createElementNS`:

```typescript
// Pseudocode for the planner — verify exact API surface and namespace constant
private buildColorSwatch(color: string | null): SVGElement {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 24 24");

  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "10");
  circle.setAttribute("stroke", "#888");
  circle.setAttribute("stroke-width", "2");

  if (color && isValidColor(color)) {
    // Filled circle (the "current color" branch)
    circle.setAttribute("fill", color);
    svg.appendChild(circle);
  } else {
    // Plus-icon branch (the original "no custom color" path, AND the
    // render-time fallback for invalid colors per D-05)
    circle.setAttribute("fill", "none");
    svg.appendChild(circle);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", "12");
    text.setAttribute("y", "17");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "16");
    text.setAttribute("fill", "#888");
    text.textContent = "+";
    svg.appendChild(text);
  }

  return svg;
}
```

**Use-site replacement** — at both line 589 and line 675:

```typescript
// Replace:
//   customLabel.innerHTML = `<svg ... fill="${currentColor}" .../>`;
// With:
customLabel.empty(); // Obsidian extension on HTMLElement; clears children safely
customLabel.appendChild(this.buildColorSwatch(currentColor));
```

(Note: `HTMLElement.prototype.empty()` is an Obsidian-injected helper — used elsewhere in this codebase, e.g. `container.empty()` at `SettingsTab.ts:570, 619, 705`.)

**Sibling non-innerHTML construction in same method** — `src/settings/SettingsTab.ts:553-555` and `:599-613`:

```typescript
const swatch = container.createDiv({
  cls: "memochron-inline-color-swatch",
});
...
const colorInput = document.createElement("input");
colorInput.type = "color";
colorInput.value = this.colorToHex(currentColor);
colorInput.className = "memochron-inline-color-input";
colorInput.style.position = "absolute";
```

This shows the established pattern in this method for non-innerHTML construction: `createDiv` (Obsidian helper) for divs, `document.createElement` for native HTML elements, with attributes/styles set imperatively. The SVG case differs only in that it must use `createElementNS` because SVG lives in a different namespace than HTML.

**Render-time validator (D-05)** — fold into the helper at the `if (color && isValidColor(color))` branch above. Render-time falls back to the plus-icon branch silently (no `console.warn` — `loadSettings` already warned).

**Error.message access at line 1128** — `src/settings/SettingsTab.ts:1122-1133`:

```typescript
try {
  const previewPath = this.generatePreviewPath(template, sampleEvent);
  container.createEl("small", {
    text: `Preview: ${previewPath}/`,
    cls: "memochron-preview-text",
  });
} catch (error) {
  container.createEl("small", {
    text: "Invalid template format",
    cls: "memochron-preview-error",
  });
}
```

This catch does not currently access `error.message` (despite CONTEXT.md mentioning a 1128 reference — re-verify against actual current file). The catch ignores the error and shows a static "Invalid template format" string. **Planner verification step:** if the catch already discards `error`, the only normalization needed is converting it through `errorMessage()` if it logs to console; otherwise this site may only need `(error: unknown)` typing per SEC-02 spirit.

**Planner action:**
- Add `import { isValidColor } from "../utils/colorValidation";` and `import { errorMessage } from "../utils/errors";`.
- Extract a private method `buildColorSwatch(color: string | null): SVGElement`.
- Replace lines 587-594 and 673-680 — empty `customLabel` and append the helper output.
- Apply `errorMessage(error)` at any catch in this file that surfaces error text (verify line 1128 actual state).

---

### `src/services/CalendarService.ts` (service, request-response — fetchInFlight + error normalizations)

**Analog (canonical post-refactor catch):** `src/services/IcsImportService.ts:91-96`
**Analog (shared-Promise dedup pattern):** None — net-new for this codebase. CONTEXT.md (Specific Ideas) flags this as a documented JS pattern; do not invent abstractions.

**Existing dedup gate (to be replaced)** — `src/services/CalendarService.ts:38, 42-48`:

```typescript
private isFetchingCalendars = false;
...
async fetchCalendars(
  sources: CalendarSource[],
  forceRefresh = false
): Promise<CalendarEvent[]> {
  if (this.isFetchingCalendars) {
    return this.events;  // <-- BUG-06: returns possibly stale events;
                         //     a second caller does not get the in-flight result
  }
  ...
}
```

**Existing in-progress flag set / clear** — `src/services/CalendarService.ts:228-251` (`performFetch`):

```typescript
private async performFetch(
  enabledSources: CalendarSource[],
  forceRefresh: boolean
): Promise<CalendarEvent[]> {
  try {
    this.isFetchingCalendars = true;
    this.showFetchNotification(forceRefresh);

    const fetchPromises = enabledSources.map((source) =>
      this.fetchCalendar(source)
    );
    const results = await Promise.all(fetchPromises);

    this.events = results.flat();
    this.lastFetch = Date.now();

    await this.saveToCache();
    this.showCompletionNotification(forceRefresh);

    return this.events;
  } catch (error) {
    console.error("Error fetching calendars:", error);
    this.showErrorNotification(forceRefresh);

    return this.events;
  } finally {
    this.isFetchingCalendars = false;
  }
}
```

**Existing background-refresh schedule site** — `src/services/CalendarService.ts:180-194` (DO NOT change the timer-ownership wiring; only the body of the callback feeds the dedup):

```typescript
private scheduleBackgroundRefresh(sources: CalendarSource[]) {
  // Only schedule a refresh if the cache has actually expired
  // This respects the refresh interval setting
  const enabledSources = sources.filter((source) => source.enabled && source.url?.trim());
  if (this.needsRefresh(enabledSources, false)) {
    // Delegate timer ownership to the plugin so the handle is cancelled
    // with window.clearTimeout in onunload (CR-01). registerInterval is
    // documented to call clearInterval at unload, which on iOS WKWebView
    // is not guaranteed to cancel a setTimeout handle.
    this.plugin.setBackgroundRefreshTimer(
      () => this.fetchCalendars(sources, true),
      100
    );
  }
}
```

CONTEXT.md (Reusable Assets, Integration Points): the `setBackgroundRefreshTimer` call must remain the entry point. With the shared-promise dedup, the `fetchCalendars(sources, true)` call inside the timer naturally deduplicates if a fetch is already running.

**Replacement pattern (D-12, D-13)** — net-new in this codebase:

```typescript
// Pseudocode the planner grounds against the actual source

// Replace the boolean field:
private fetchInFlight: Promise<CalendarEvent[]> | null = null;

async fetchCalendars(
  sources: CalendarSource[],
  forceRefresh = false
): Promise<CalendarEvent[]> {
  // Shared in-flight Promise (D-12): concurrent callers receive the same result.
  if (this.fetchInFlight) {
    return this.fetchInFlight;
  }

  const enabledSources = sources.filter((source) => source.enabled && source.url?.trim());

  if (enabledSources.length === 0) {
    this.events = [];
    console.warn("No enabled calendar sources to fetch.");
    return [];
  }

  if (this.shouldLoadFromCache(forceRefresh)) {
    const cachedEvents = await this.loadFromCache();
    if (cachedEvents.length > 0) {
      this.scheduleBackgroundRefresh(sources);
      return this.events;
    }
  }

  if (!this.needsRefresh(enabledSources, forceRefresh)) {
    return this.events;
  }

  this.fetchInFlight = this.performFetch(enabledSources, forceRefresh).finally(() => {
    this.fetchInFlight = null;
  });

  return this.fetchInFlight;
}
```

And in `performFetch`, **remove** `this.isFetchingCalendars = true` and `this.isFetchingCalendars = false` (and the field itself). The `finally` on the wrapping Promise is the only signal of "in flight."

**Catch normalization sites** — these all become `errorMessage(error)` calls. Existing code:

`src/services/CalendarService.ts:244-246`:
```typescript
} catch (error) {
  console.error("Error fetching calendars:", error);
  this.showErrorNotification(forceRefresh);
```

`src/services/CalendarService.ts:288-289`:
```typescript
} catch (error) {
  console.log("MemoChron: No cache found or cache invalid", error);
```

`src/services/CalendarService.ts:332-333`:
```typescript
} catch (error) {
  console.error("MemoChron: Failed to save calendar cache:", error);
```

`src/services/CalendarService.ts:391-401` (the most invasive — `error.message` accessed without instanceof guard):
```typescript
} catch (error) {
  console.error(`Error fetching calendar ${source.name}:`, error);
  this.logPlatformInfo();

  // Check for specific error types
  if (error.message && error.message.includes('CORS')) {
    new Notice(`MemoChron: Calendar "${source.name}" blocked by CORS policy.`);
  } else if (error.message && error.message.includes('network')) {
    new Notice(`MemoChron: Network error fetching calendar "${source.name}".`);
  }

  return [];
}
```

**Refactored shape (using helper)**:

```typescript
} catch (error) {
  const message = errorMessage(error);
  console.error(`Error fetching calendar ${source.name}:`, message);
  this.logPlatformInfo();

  if (message.includes("CORS")) {
    new Notice(`MemoChron: Calendar "${source.name}" blocked by CORS policy.`);
  } else if (message.includes("network")) {
    new Notice(`MemoChron: Network error fetching calendar "${source.name}".`);
  }

  return [];
}
```

`src/services/CalendarService.ts:516-521`:
```typescript
} catch (error) {
  return {
    status: 404,
    text: `Cannot read file: ${pathInfo.normalizedPath}`,
  };
}
```
(no error info surfaced — applying `errorMessage` is consistency-only per D-10; safe to leave the message unchanged but type the catch parameter as `(error: unknown)`)

`src/services/CalendarService.ts:528-533`:
```typescript
} catch (error) {
  console.error("Error reading local calendar file:", error);
  return {
    status: 500,
    text: `Error reading file: ${error.message}`,  // <-- unsafe .message
  };
}
```

**Refactored:**
```typescript
} catch (error) {
  const message = errorMessage(error);
  console.error("Error reading local calendar file:", message);
  return {
    status: 500,
    text: `Error reading file: ${message}`,
  };
}
```

**Imports change** — add at top of file:
```typescript
import { errorMessage } from "../utils/errors";
```

**Planner action:**
- Add `errorMessage` import.
- Replace `private isFetchingCalendars = false` with `private fetchInFlight: Promise<CalendarEvent[]> | null = null`.
- Replace the early-return at lines 46-48 with `if (this.fetchInFlight) return this.fetchInFlight;`.
- At the bottom of `fetchCalendars`, replace `return this.performFetch(...)` with the `this.fetchInFlight = this.performFetch(...).finally(() => { this.fetchInFlight = null; }); return this.fetchInFlight;` pattern.
- Remove `this.isFetchingCalendars = true/false` lines from `performFetch`. Remove the `finally` block in `performFetch` if it only had that line (otherwise leave it).
- Route every `error` access at lines 244, 288, 332, 391, 396, 398, 516, 528, 532 through `errorMessage(error)`.
- DO NOT change `scheduleBackgroundRefresh` body (CONTEXT.md Integration Points — dedup at `fetchCalendars` entry is sufficient).

---

### `src/services/NoteService.ts` (service, CRUD — catch normalizations)

**Analog:** `src/services/IcsImportService.ts:91-96`

**Catch sites to normalize:**

`src/services/NoteService.ts:74-77`:
```typescript
} catch (error) {
  console.error("Error creating note:", error);
  throw error;
}
```

`src/services/NoteService.ts:126-135`:
```typescript
} catch (error) {
  console.error("Error building file path:", error);
  // Fallback to basic path structure
  ...
}
```

`src/services/NoteService.ts:164-172`:
```typescript
} catch (error) {
  console.error("Error generating note content:", error);
  // Fallback to basic content
  ...
}
```

`src/services/NoteService.ts:267-270`:
```typescript
} catch (error) {
  console.error("Error applying template variables:", error);
  return template;
}
```

`src/services/NoteService.ts:289-292`:
```typescript
} catch (error) {
  console.error("Error formatting title:", error);
  return event.title || "Untitled Event";
}
```

`src/services/NoteService.ts:415-419` (note: this catch uses `(error: any)` AND accesses `.message` directly):
```typescript
} catch (error: any) {
  if (!error.message?.includes("already exists")) {
    throw error;
  }
}
```

**Refactored shape (canonical)**:
```typescript
} catch (error) {
  console.error("Error creating note:", errorMessage(error));
  throw error;
}
```

For the `(error: any)` site at line 415, refactor to:
```typescript
} catch (error) {
  if (!errorMessage(error).includes("already exists")) {
    throw error;
  }
}
```

**Planner action:**
- Add `import { errorMessage } from "../utils/errors";`.
- Wrap each catch's error access through `errorMessage(error)`.
- Convert `catch (error: any)` at line 415 to plain `catch (error)` and read via helper.
- CONTEXT.md flags NoteService user-feedback gap (CLAUDE.md TODO Section 3) — out of scope for this phase; only normalize, do not add `Notice` calls.

---

### `src/services/IcsImportService.ts` (service, transform — refactor existing instanceof to helper)

**Self-analog:** `src/services/IcsImportService.ts:30-50` and `:91-96`

**Existing pattern at lines 30-50 (TimezoneService.register catch — preserves the "already registered" check)**:
```typescript
} catch (error) {
  // Only ignore errors if timezone is already registered; log others as warnings
  if (
    error instanceof Error &&
    typeof error.message === "string" &&
    (
      error.message.includes("already registered") ||
      error.message.includes("already exists")
    )
  ) {
    console.debug(
      "Timezone registration skipped (may already exist):",
      error.message
    );
  } else {
    console.warn(
      "Unexpected error during timezone registration:",
      error
    );
  }
}
```

**Refactored shape (D-11 — preserve behavior, use helper):**
```typescript
} catch (error) {
  const message = errorMessage(error);
  if (message.includes("already registered") || message.includes("already exists")) {
    console.debug("Timezone registration skipped (may already exist):", message);
  } else {
    console.warn("Unexpected error during timezone registration:", message);
  }
}
```

The `typeof error.message === "string"` defensive check disappears because `errorMessage()` always returns a string.

**Existing pattern at lines 91-96 (top-level parseSingleEvent catch — re-throws)**:
```typescript
} catch (error) {
  if (error instanceof Error) {
    throw error;
  }
  throw new Error("Failed to parse ICS file");
}
```

**Refactored shape — preserve "re-throw if already an Error" semantics:**
```typescript
} catch (error) {
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(`Failed to parse ICS file: ${errorMessage(error)}`);
}
```

(Per D-11: "Behavior preserved." The first branch — `error instanceof Error` re-throw — must stay because the original Error preserves its stack. The fallback `throw new Error(...)` can include the helper output for diagnostics.)

**Planner action:**
- Add `import { errorMessage } from "../utils/errors";` (relative path: `"../utils/errors"`).
- Refactor lines 30-50 to use the helper as shown.
- Refactor lines 91-96 minimally — preserve the re-throw branch.

---

### `src/views/CalendarView.ts` (view, event-driven — catches + error.message + getStartOfWeek)

**Analog (catch normalization):** `src/services/IcsImportService.ts:91-96`
**Analog (getStartOfWeek):** None — this is a pure-function correctness fix.

**Catch sites to normalize:**

`src/views/CalendarView.ts:148-150` (loadAllDailyNotes):
```typescript
} catch (error) {
  console.error("Failed to load daily notes:", error);
}
```

`src/views/CalendarView.ts:169-172` (checkDailyNoteForDate):
```typescript
} catch (error) {
  console.error("Error checking daily note:", error);
  return false;
}
```

`src/views/CalendarView.ts:752-757` (handleDailyNoteClick):
```typescript
} catch (error) {
  console.error("Failed to handle daily note:", error);
  new Notice(
    "Failed to open daily note. Make sure Daily Notes plugin is enabled and configured."
  );
}
```

`src/views/CalendarView.ts:841-844` (event click handler):
```typescript
} catch (error) {
  console.error("Failed to create note:", error);
  new Notice("Failed to create note. Check the console for details.");
}
```

`src/views/CalendarView.ts:956-959` (ICS import drop handler — the user-visible `error.message` site):
```typescript
} catch (error) {
  console.error("Failed to import ICS file:", error);
  new Notice(`Failed to import: ${error.message}`);  // <-- unsafe .message access
}
```

**Refactored shape for the import-drop site:**
```typescript
} catch (error) {
  const message = errorMessage(error);
  console.error("Failed to import ICS file:", message);
  new Notice(`Failed to import: ${message}`);
}
```

**`getStartOfWeek` — current state at lines 407-413**:
```typescript
private getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const firstDay = this.plugin.settings.firstDayOfWeek;
  const diff = d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay;
  return new Date(d.setDate(diff));
}
```

This is the BUG-05 site. Per CONTEXT.md "Claude's Discretion" and `specifics`, the researcher already produced a 49-cell trace to verify whether the formula is wrong for any `(firstDayOfWeek, day)` pair. CONCERNS.md "Known Bugs" section concludes the formula is correct-but-non-obvious. The two valid resolutions are:
1. **Verified-correct path:** add a comment block in the code referencing the trace analysis; close BUG-05 as "verified."
2. **Replace-with-cleaner-formula path:** swap to the `((day - firstDay + 7) % 7)` style for readability:
   ```typescript
   private getStartOfWeek(date: Date): Date {
     const d = new Date(date);
     const day = d.getDay();
     const firstDay = this.plugin.settings.firstDayOfWeek;
     const offset = (day - firstDay + 7) % 7;
     d.setDate(d.getDate() - offset);
     return d;
   }
   ```

The planner must read the 49-cell trace from the researcher's deliverable (RESEARCH.md per `specifics`) before writing this plan; the call between path 1 and path 2 depends on whether any cell shows incorrect output.

**Planner action:**
- Add `import { errorMessage } from "../utils/errors";`.
- Route catches at lines 148, 169, 752, 841, 956 through the helper.
- Replace `error.message` at line 958 with `errorMessage(error)` (already covered by the catch refactor above).
- For `getStartOfWeek`: read the researcher's 49-cell trace; apply path 1 (comment + close) or path 2 (replace formula) based on the trace.

---

### `src/views/EmbeddedCalendarView.ts` (view, event-driven — catch normalization)

**Analog:** `src/services/IcsImportService.ts:91-96`

**Catch site at lines 232-237:**
```typescript
} catch (error) {
  console.error("Failed to handle daily note:", error);
  new Notice(
    "Failed to open daily note. Make sure Daily Notes plugin is enabled and configured."
  );
}
```

**Refactored shape:**
```typescript
} catch (error) {
  console.error("Failed to handle daily note:", errorMessage(error));
  new Notice(
    "Failed to open daily note. Make sure Daily Notes plugin is enabled and configured."
  );
}
```

**Planner action:**
- Add `import { errorMessage } from "../utils/errors";`.
- Wrap the `error` argument in the `console.error` call.

---

### `src/views/EmbeddedAgendaView.ts` (view, event-driven — catch normalization)

**Analog:** `src/services/IcsImportService.ts:91-96`

**Catch site at lines 375-380 (mirrors EmbeddedCalendarView):**
```typescript
} catch (error) {
  console.error("Failed to handle daily note:", error);
  new Notice(
    "Failed to open daily note. Make sure Daily Notes plugin is enabled and configured."
  );
}
```

**Refactored shape — same as `EmbeddedCalendarView.ts`.**

**Planner action:**
- Add `import { errorMessage } from "../utils/errors";`.
- Same refactor as EmbeddedCalendarView; both files are mirrors.

---

### `src/utils/timezoneUtils.ts` (utility, transform — catch normalizations)

**Analog:** `src/services/IcsImportService.ts:91-96`

**Catch site at lines 175-184 (toJSDate fallback):**
```typescript
try {
  return icalTime.toJSDate();
} catch (error) {
  console.warn(
    "Failed to use ical.js toJSDate(), falling back to manual construction:",
    error
  );
  // Fallback to original behavior for floating times
  return new Date(year, month - 1, day, hour, minute, second);
}
```

**Catch site at lines 196-204 (toJSDate fallback for unmapped tzid):**
```typescript
try {
  return icalTime.toJSDate();
} catch (error) {
  console.warn(
    "toJSDate failed for custom TZID, falling back to manual conversion:",
    error
  );
  // Continue to Luxon fallback below
}
```

**Catch site at lines 222-231 (top-level conversion failure):**
```typescript
} catch (error) {
  console.error("Failed to convert ICAL time:", error, {
    icalTime,
    tzid: normalizedTzid,
    mappedZone: mappedZone,
    zoneUsed: zone,
  });
  // Fallback to simple date creation
  return new Date(year, month - 1, day, hour, minute, second);
}
```

**Refactored shape (preserves the diagnostic context object at line 222):**
```typescript
} catch (error) {
  console.error("Failed to convert ICAL time:", errorMessage(error), {
    icalTime,
    tzid: normalizedTzid,
    mappedZone: mappedZone,
    zoneUsed: zone,
  });
  return new Date(year, month - 1, day, hour, minute, second);
}
```

**Planner action:**
- Add `import { errorMessage } from "./errors";` (sibling import — relative path is `"./errors"` not `"../utils/errors"`).
- Wrap `error` in all three `console.warn` / `console.error` calls.
- The diagnostic context object at line 222 is preserved verbatim.

---

## Shared Patterns

### Error helper usage (post-Phase 2)

**Source (after this phase):** `src/utils/errors.ts` exporting `errorMessage(err: unknown): string`
**Apply to:** Every `catch` block in `src/` services, views, settings, and utils

**Canonical usage** (post-refactor of `IcsImportService.ts:91-96`):
```typescript
import { errorMessage } from "../utils/errors";

try {
  // ...
} catch (error) {
  const message = errorMessage(error);
  console.error("MemoChron: <descriptive context>:", message);
  // optional: new Notice(`MemoChron: <user-friendly>: ${message}`);
}
```

**Import path notes:**
- From `src/services/*.ts` → `"../utils/errors"`
- From `src/views/*.ts` → `"../utils/errors"`
- From `src/settings/*.ts` → `"../utils/errors"`
- From `src/utils/*.ts` → `"./errors"` (sibling)
- From `src/main.ts` → `"./utils/errors"`

**Logging-prefix convention (preserved):** External-facing messages use `"MemoChron: "` prefix (CONVENTIONS.md). Internal context strings (e.g. `"Error creating note:"`) do not require the prefix when the error is internal-only.

### Color validation (SEC-01)

**Source:** `src/utils/colorValidation.ts` exporting `isValidColor(value: string): boolean` and a default-color chooser
**Apply to:**
- `src/main.ts` `loadSettings()` — load-time validation pass (D-03)
- `src/settings/SettingsTab.ts` `buildColorSwatch()` helper — render-time defensive guard (D-05)

**Validation contract:** Returns `true` iff the value matches one of the whitelisted CSS color formats (hex 3/4/6/8, hsl/hsla, rgb/rgba, `var(--<id>)`).

### SVG construction (SEC-01 success criterion #2)

**Source:** Net-new pattern; the helper `buildColorSwatch(color: string | null): SVGElement` in `SettingsTab.ts`
**Apply to:** Both `customLabel.innerHTML = ...` sites (lines 587-594 and 673-680)

**Construction rules:**
- Always use `document.createElementNS("http://www.w3.org/2000/svg", ...)` for SVG and its children.
- Set attributes via `setAttribute(name, value)` — `setAttribute` does NOT interpret HTML, so even an unsanitized fill value cannot inject markup.
- Set text content via `element.textContent = "..."` (never `innerHTML`).
- Use `customLabel.empty()` (Obsidian helper) to clear before appending.

## No Analog Found

| File | Role | Data Flow | Reason | Mitigation |
|------|------|-----------|--------|------------|
| `src/utils/colorValidation.ts` (validator regex) | utility | transform | No CSS-color validator exists in codebase | Use the format whitelist (D-02); ground regex against MDN CSS Values 4 |
| `src/services/CalendarService.ts` (shared-Promise dedup) | service | request-response | No deduplication-via-Promise pattern in codebase | Use the documented JS pattern (D-12); held on instance, cleared in `finally` |
| SVG `createElementNS` swatch | config | DOM construction | No SVG-by-API construction site exists; existing SVG sites all use `innerHTML` | New pattern; ground against MDN `Document.createElementNS` |
| `getStartOfWeek` correctness fix | utility | transform | Pure-function logic; no analog | Researcher's 49-cell trace is the deliverable that drives the implementation |

## Metadata

**Analog search scope:** `src/services/`, `src/views/`, `src/utils/`, `src/settings/`, `src/main.ts`
**Files scanned:** 11 source files (all files in CONTEXT.md "Source files this phase will touch")
**Pattern extraction date:** 2026-05-10

---

*Pattern map for Phase 02 — Security & Correctness*
