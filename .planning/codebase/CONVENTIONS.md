# Coding Conventions

**Analysis Date:** 2026-05-09

## Naming Patterns

**Files:**
- PascalCase for classes and views: `CalendarService.ts`, `CalendarView.ts`, `SettingsTab.ts`
- PascalCase for interface/type definition files: `types.ts` (in `src/settings/`)
- camelCase for utility files: `pathUtils.ts`, `timezoneUtils.ts`, `viewRenderers.ts`
- SCREAMING_SNAKE_CASE for type declaration files used as ambient types: `ical.d.ts`
- All source files use `.ts` extension

**Classes:**
- PascalCase for all class names: `CalendarService`, `NoteService`, `MemoChron`, `SettingsTab`, `IcsImportService`

**Functions/Methods:**
- camelCase for all methods and functions: `fetchCalendars`, `getEventsForDate`, `renderCalendarGrid`
- Private helper methods are named descriptively with verb prefixes: `buildFilePath`, `generateNoteContent`, `ensureParentFolder`, `collectRecurrenceExceptions`
- Boolean methods use `is`/`has`/`should`/`check` prefixes: `isAllDayEvent`, `hasSourceMismatch`, `shouldSkipEvent`, `isSameDate`, `checkDailyNoteForDate`, `isRemoteUrl`, `isLocalPath`
- Async methods that return nothing meaningful use `void` or omit return type: `async onload()`, `async onunload()`

**Variables:**
- camelCase for local variables and parameters: `enabledSources`, `fetchPromises`, `cacheExpired`
- Destructured parameters prefer names matching the field: `{ periodStart, periodEnd }`

**Constants:**
- Module-level constants use SCREAMING_SNAKE_CASE: `MEMOCHRON_VIEW_TYPE`, `DEFAULT_REFRESH_INTERVAL`, `DEFAULT_NOTE_LOCATION`
- Class-level static readonly constants use SCREAMING_SNAKE_CASE: `NoteService.FRONTMATTER_DELIMITER`, `NoteService.TEAMS_SEPARATOR`, `NoteService.LOCATION_EMOJIS`
- Color palette arrays follow the same SCREAMING_SNAKE_CASE: `CALENDAR_COLOR_PALETTE`

**Types/Interfaces:**
- PascalCase for interfaces: `CalendarEvent`, `CalendarSource`, `MemoChronSettings`, `PathInfo`, `RenderOptions`
- PascalCase for enums: `PathType`
- PascalCase for type aliases: `CalendarViewMode`
- Interfaces for internal-only data structures are non-exported: `CacheData`, `DateElements`, `EventTemplateVariables`
- Exported interfaces representing public API data are in `src/settings/types.ts` or defined alongside their owning class

**Command IDs:**
- kebab-case for Obsidian command IDs: `"force-refresh-calendars"`, `"go-to-today"`, `"toggle-calendar"`

## Code Style

**Formatting:**
- No Prettier or dedicated formatter config detected (no `.prettierrc`, `biome.json`)
- TypeScript compiler enforces style via `tsconfig.json`
- Double quotes for strings in imports: `import { Plugin } from "obsidian"`
- Template literals used for string interpolation: `` `${source.name}` ``
- Trailing commas on multi-line object/array literals (consistent across all files)
- 2-space indentation throughout

**Linting:**
- `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` are devDependencies (version 5.29.0)
- No `.eslintrc` or `eslint.config.*` file present — linting rules are not actively enforced via config file
- TypeScript strict options enabled in `tsconfig.json`: `noImplicitAny: true`, `strictNullChecks: true`

## Import Organization

**Order (observed in practice):**
1. Obsidian API imports: `import { Plugin, Notice, TFile } from "obsidian"`
2. Third-party library imports: `import { Component, Event as ICalEvent, parse, Time } from "ical.js"` / `import { DateTime } from "luxon"`
3. Internal settings/types: `import { CalendarSource } from "../settings/types"`
4. Internal main plugin: `import MemoChron from "../main"`
5. Internal utilities (grouped): `import { getPathInfo, isLocalPath } from "../utils/pathUtils"`

No barrel/index files are used. Each module is imported directly by path.

**Path style:** All internal imports use relative paths: `"../services/CalendarService"`, `"./utils/constants"`, `"../settings/types"`

**Path Aliases:** None — `tsconfig.json` sets `baseUrl: "."` but no `paths` aliases are configured.

## Access Modifiers

Private methods are the dominant pattern. Public/protected are used only on lifecycle methods and intentionally exposed API:

```typescript
// Private for all internal helpers
private buildFilePath(event: CalendarEvent): string { ... }
private async ensureParentFolder(filePath: string): Promise<void> { ... }

// Public (no modifier) for Obsidian lifecycle and plugin API
async onload() { ... }
async saveSettings() { ... }
async refreshCalendarView(forceRefresh = false) { ... }

// Private static readonly for class-level constants
private static readonly FRONTMATTER_DELIMITER = "---";

// Static methods for pure utility classes (IcsImportService uses all-static pattern)
static parseSingleEvent(icsContent: string, ...): CalendarEvent { ... }
```

## Error Handling

**Pattern:** `try/catch` with `console.error` + optional `Notice` for user-facing errors. All 27 try blocks have corresponding catch blocks.

**Service layer errors:**
- `CalendarService`: catch at per-calendar and per-fetch level; shows `Notice` for actionable errors (403, 404, CORS, network), logs to console for internal errors
- `NoteService`: catch at method level, uses `console.error` only (no `Notice` to user) — identified gap in CLAUDE.md
- `IcsImportService`: throws `Error` with descriptive messages for caller to handle

**View layer errors:**
- Catches service errors and shows `Notice` for user feedback
- Falls back to safe state (returns `[]`, returns existing file, etc.)

**Error communication pattern:**
```typescript
try {
  // ... operation
} catch (error) {
  console.error("MemoChron: Descriptive message:", error);
  new Notice("MemoChron: User-friendly message.");
  return safeDefault;
}
```

**Throwing errors:** Used only for unrecoverable setup failures or invalid preconditions:
```typescript
throw new Error("Note location is not configured");
throw new Error(`Unsupported calendar path type: ${source.url}`);
throw new Error("No events found in the ICS file");
```

## Logging

**Framework:** Raw browser `console` API (no logging library)

**Levels and usage:**
- `console.error(...)`: Unexpected failures, caught exceptions — prefixed with `"MemoChron: "` or descriptive context
- `console.warn(...)`: Non-critical unexpected states, invalid data
- `console.log(...)`: Significant lifecycle events (background refresh started, cache saved)
- `console.debug(...)`: Low-priority diagnostic info (timezone registration skipped)

**Prefix convention:** External-facing messages prefix with `"MemoChron: "`:
```typescript
console.log("MemoChron: Background refresh started");
console.error("MemoChron: Failed to save calendar cache:", error);
```

## Comments

**When to Comment:**
- Inline `//` comments explain non-obvious logic and edge cases, particularly around timezone handling and iCalendar spec compliance
- Block `/* */` comments are not used
- JSDoc (`/** ... */`) is used selectively on exported utility functions in `src/utils/timezoneUtils.ts` and `src/services/IcsImportService.ts`

**JSDoc usage:**
```typescript
/**
 * Convert an ICAL Time object to a JavaScript Date in the local timezone
 * @param icalTime The ICAL Time object to convert
 * @param tzid The timezone ID (can be Windows or IANA format)
 * @param isAllDay Whether this is an all-day event (VALUE=DATE)
 * @returns Date object in local timezone
 */
export function convertIcalTimeToDate(icalTime: Time, tzid: string | null, isAllDay: boolean = false): Date
```

JSDoc is **not** consistently applied to class methods — it appears mainly on standalone utility functions. Do not assume all public methods have JSDoc.

**Section comments:** Used in `src/settings/SettingsTab.ts` and `src/utils/constants.ts` to label groups:
```typescript
// View constants
// Default settings
// Color palette for auto-assigning calendar colors
// RFC 5545 CUTYPE values
```

## Function Design

**Size:** Helper methods are small and focused. Large classes (`SettingsTab.ts` at 1882 lines, `CalendarView.ts` at 1111 lines) compensate by decomposing into many small private methods.

**Parameters:** Methods prefer taking typed objects over many positional arguments. Data classes like `CalendarEvent`, `CalendarSource`, and `PathInfo` are passed as single parameters.

**Default parameters:**
```typescript
async fetchCalendars(sources: CalendarSource[], forceRefresh = false): Promise<CalendarEvent[]>
async refreshCalendarView(forceRefresh = false)
function renderCalendarGrid(container, currentDate, events, options: RenderOptions = {}, onDateClick?, onDateDoubleClick?)
```

**Return Values:**
- Methods returning collections default to `[]` on error (never `null`)
- Methods returning single objects may return `null` for "not found" states
- Async methods that modify state return `Promise<void>` (or implicitly)
- Pure query methods return typed values: `CalendarEvent[]`, `string`, `boolean`

## Module Design

**Exports:**
- Each file exports only what external consumers need
- Main plugin class uses `export default`: `export default class MemoChron extends Plugin`
- Services, views, and settings classes use named exports: `export class CalendarService`
- Types and interfaces use named exports: `export interface CalendarEvent`
- Constants use named exports: `export const MEMOCHRON_VIEW_TYPE = "memochron-calendar"`

**Barrel Files:** Not used. No `index.ts` files exist anywhere in the codebase.

**Type definition files:** `src/types/ical.d.ts` provides ambient type declarations for the `ical.js` library, which lacks bundled TypeScript types.

## TypeScript Usage

**Strict mode:** `noImplicitAny: true` and `strictNullChecks: true` are enabled.

**`any` usage:** Intentional and limited:
- In type guard functions: `private isValidCache(cache: any): cache is CacheData`
- For accessing untyped internal ical.js structures: `(dtstart as any).jCal`
- For accessing Obsidian's global moment: `(window as any).moment`
- In ambient type declarations where the library's API is untyped

**Enums:** Used in `src/utils/pathUtils.ts` for `PathType`:
```typescript
export enum PathType {
  HTTP_URL = "http_url",
  FILE_URL = "file_url",
  VAULT_RELATIVE = "vault_relative",
  ABSOLUTE_PATH = "absolute_path",
}
```

**Union types:** Used for constrained string/number values:
```typescript
type CalendarViewMode = 'month' | 1 | 2 | 3 | 4 | 5;
noteTimeFormat: "12h" | "24h";
```

---

*Convention analysis: 2026-05-09*
