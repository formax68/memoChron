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

## Directory Compliance

Every rule below maps to a finding from the Obsidian community-plugin directory scorecard
report on v1.13.1. Closing all of them was the goal of milestone v1.15. Rules are grouped
by cluster, not by individual DIR-NN finding. ESLint enforces each rule via
`eslint.config.mjs`; intentional, single-site exceptions use a per-line
`eslint-disable-next-line <rule> -- <reason>` comment.

### DOM API

Closes scorecard findings **DIR-02** (`innerHTML`/`outerHTML`), **DIR-03** (inline
`element.style.*`), **DIR-04** (`document.createElement` and string-literal HTML).

**Don't:** Use `element.innerHTML = "<div>...</div>"` or `element.outerHTML`.
**Do:** Use `createDiv({ cls, text })` or `createEl("div", { cls, text, attr })`; for
        nested children, chain `parent.createEl(...)` returns; for inline rich-text use
        `appendText("...")` plus `createEl("strong", { text: "..." })`.
**Why:** Bypasses Obsidian's sanitization and breaks the obsidianmd/no-inner-html
         rule + `@microsoft/sdl/no-inner-html`.
**Docs:** https://docs.obsidian.md/Plugins/User+interface/HTML+elements

**Don't:** Write `element.style.border = "1px solid red"` or any other static `.style.*`
          assignment.
**Do:** Add a CSS class to `styles.css` and toggle it via `el.toggleClass("memochron-...",
        condition)`. For dynamic values, use `el.setCssProps({ color: event.color })`.
**Why:** Bypasses Obsidian theming and breaks the
         `obsidianmd/no-static-styles-assignment` rule.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/no-static-styles-assignment.md

**Don't:** Call `document.createElement("input")` or `new HTMLInputElement()`.
**Do:** Call `parent.createEl("input", { type: "color" })` or
        `parent.createDiv({ cls })`. SVG construction stays on
        `createElementNS("http://www.w3.org/2000/svg", ...)`.
**Why:** Bypasses Obsidian's element extension (`.createEl`, `.empty`, `.setText`,
         `.setCssProps`) and breaks the `obsidianmd/prefer-create-el` rule.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/prefer-create-el.md

### Lifecycle & Compatibility

Closes scorecard findings **DIR-05** (no view refs in plugin), **DIR-06**
(`activeDocument` + `window.*` timers), **DIR-07** (`instanceof TFile` over
`as TFile`), **DIR-08** (no floating promises; sync `MarkdownRenderChild` lifecycle).

**Don't:** Assign a view instance to a plugin field inside `registerView`'s callback
          (e.g., `plugin.calendarView = view`).
**Do:** Have `registerView` construct and return the view as a pure factory; consumers
        fetch the view lazily via
        `app.workspace.getLeavesOfType(...)[0]?.view` plus an `instanceof` guard.
**Why:** Holding a reference inside the callback creates a memory leak when leaves are
         detached/re-created; flagged by `obsidianmd/no-view-references-in-plugin`.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/no-view-references-in-plugin.md

**Don't:** Read `document.documentElement` or call `setTimeout(...)` / `setInterval(...)`
          bare in view code.
**Do:** Use `activeDocument` for DOM reads (popout-window-safe); prefix timers with
        `window.` (`window.setTimeout`, `window.setInterval`, `window.requestAnimationFrame`).
**Why:** `activeDocument` follows popout windows; the bare timer globals don't bind
         correctly in popouts. Note the asymmetry — `activeDocument` for DOM,
         `window.*` for timers — both rules auto-fix in opposite directions.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/prefer-active-doc.md
         and https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/prefer-window-timers.md

**Don't:** Cast `file as TFile` after `app.vault.getAbstractFileByPath(...)`.
**Do:** Narrow via `if (file instanceof TFile) { ... }`.
**Why:** A path can resolve to a `TFolder` or `null`; the cast is unsafe and breaks
         `obsidianmd/no-tfile-tfolder-cast`.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/no-tfile-tfolder-cast.md

**Don't:** Leave a `Promise`-returning call without `await`, `.catch`, or `void`. Don't
          declare `async onload()` on a `MarkdownRenderChild` subclass.
**Do:** Use `void promise` for fire-and-forget; `.catch(error => new Notice(errorMessage(error)))`
        for user-visible failures; `await` when sequencing matters. For
        `MarkdownRenderChild`, write `onload(): void { void this.initialize(); }` with
        the async work in an inner helper.
**Why:** Floating promises silently swallow errors; the async lifecycle violates
         `MarkdownRenderChild`'s sync return-type contract.
**Docs:** https://typescript-eslint.io/rules/no-floating-promises/

### Type Hygiene

Closes scorecard findings **DIR-01** (no `console.*` in shipped code), **DIR-09**
(no `any` in source, no `??` with constant LHS, no lexical decls in `case`, no
useless escapes), **DIR-10** (no unused vars / imports).

**Don't:** Leave `console.log`, `console.error`, `console.warn`, `console.info`, or
          `console.debug` in shipped code.
**Do:** Delete the call. If a forensic log is genuinely useful (cache debugging,
        fetch failure forensics), wrap it in a compile-time `const DEBUG = false`
        guard at the top of the file: `if (DEBUG) console.log(...)`. The constant
        tree-shakes out of production builds.
**Why:** Default off keeps the user's developer console clean; forensic logs are
        opt-in via a one-line code edit, not a setting.
**Docs:** https://eslint.org/docs/latest/rules/no-console

**Don't:** Use `: any` in source code (`src/**/*.ts`). Don't use `as any`.
**Do:** Use `unknown` for type-guard inputs and narrow inside the guard; use real
        domain types (`CalendarEvent`, `ical.Time`, etc.); for documented intentional
        escape hatches at single sites use
        `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`.
        Ambient `.d.ts` files are excluded by config.
**Why:** `any` defeats the type system. `unknown` forces narrowing at the use site;
         per-line disables document intent visibly. Global rule overrides hide intent.
**Docs:** https://typescript-eslint.io/rules/no-explicit-any/

**Don't:** Declare `let` or `const` directly inside a `case` block.
**Do:** Wrap the case body in a block scope: `case X: { const y = ...; }`.
**Why:** Variable declarations leak across cases without the block scope; flagged
         by `no-case-declarations`.
**Docs:** https://eslint.org/docs/latest/rules/no-case-declarations

**Don't:** Escape characters in regex character classes that don't need escaping
          (`/[-\/]/` — the `\/` is unnecessary inside `[…]`).
**Do:** Write the character literally: `/[-/]/`.
**Why:** Reduces visual noise; flagged by `no-useless-escape`.
**Docs:** https://eslint.org/docs/latest/rules/no-useless-escape

**Don't:** Use `??` with a constant left-hand side (`null ?? x`, `undefined ?? x`,
          `"" ?? x`). The result is always the right-hand side — the `??` is a no-op.
**Do:** Use the right-hand side directly: `x` (not `null ?? x`).
**Why:** Constant-LHS `??` is dead code; lint rules surface it as a logic bug.
**Docs:** https://eslint.org/docs/latest/rules/no-constant-binary-expression

**Don't:** Leave imports, variables, or catch bindings unused.
**Do:** Delete unused imports and variables. For catch blocks that don't consume the
        error, use `catch { ... }` (no binding). For catch blocks that consume the
        error, use `errorMessage(error)` from `src/utils/errors.ts`.
**Why:** Dead imports inflate bundle parsing; unused bindings hide intent. No
         `_-prefix` to mark intentionally unused — every flagged name is either
         deleted or genuinely consumed.
**Docs:** https://typescript-eslint.io/rules/no-unused-vars/

### Release & Docs

Closes scorecard findings **DIR-11** (`manifest.json` description punctuation),
**DIR-12** (release artifact attestation), and **DOC-01** (ESLint + CI lint gate).

**Don't:** Leave `manifest.json` `description` without terminating punctuation.
**Do:** End with `.`, `!`, or `?`.
**Why:** Obsidian directory scorecard checks the field shape; missing punctuation
         is flagged as a low-effort polish issue.
**Docs:** https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin

**Don't:** Publish a release without attached artifact attestation.
**Do:** Use `actions/attest-build-provenance@v2` after `npm run build` and before
        `gh release create`. Attest `main.js`, `manifest.json`, and `styles.css`.
**Why:** Attestation provides supply-chain provenance for downstream users; required
         by the directory scorecard's release-pipeline check.
**Docs:** https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions

**Don't:** Add new code without `npm run lint` passing.
**Do:** Keep `eslint.config.mjs` with the obsidianmd recommended preset + DOC-01's
        rule list. CI runs `npm run lint` on every push and PR (`.github/workflows/lint.yml`).
**Why:** The lint gate is the only thing keeping the rules in this section from
         re-growing on future feature work.
**Docs:** https://eslint.org/docs/latest/use/configure/rules

### Verifying compliance

```bash
npm run lint                                                          # zero errors
git ls-files src/ | xargs grep -nE '\.(inner|outer)HTML\s*='          # zero matches
git ls-files src/ | xargs grep -n 'document\.createElement'           # zero matches
git ls-files src/ | xargs grep -n 'as TFile'                          # zero matches
grep -rnE '\b(null|undefined|""|0|false)\s*\?\?' src/                 # zero matches
```
