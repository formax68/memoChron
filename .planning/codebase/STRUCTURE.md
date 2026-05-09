# Codebase Structure

**Analysis Date:** 2026-05-09

## Directory Layout

```
memoChron/                        # Repo root
├── src/                          # All TypeScript source
│   ├── main.ts                   # Plugin entry point (MemoChron class)
│   ├── services/                 # Business logic services
│   │   ├── CalendarService.ts    # iCal fetch, parse, cache
│   │   ├── NoteService.ts        # Note creation from events
│   │   └── IcsImportService.ts   # Single-event ICS import
│   ├── views/                    # Obsidian view components
│   │   ├── CalendarView.ts       # Sidebar ItemView (calendar + agenda)
│   │   ├── EmbeddedCalendarView.ts  # Code block calendar renderer
│   │   └── EmbeddedAgendaView.ts    # Code block agenda renderer
│   ├── settings/                 # Settings types and UI
│   │   ├── types.ts              # MemoChronSettings, CalendarSource interfaces + DEFAULT_SETTINGS
│   │   └── SettingsTab.ts        # PluginSettingTab implementation
│   ├── utils/                    # Shared helpers (no UI state)
│   │   ├── constants.ts          # View type ID, default values, color palette, CUTYPE constants
│   │   ├── pathUtils.ts          # Path type detection and normalization
│   │   ├── timezoneUtils.ts      # Windows→IANA timezone map, ical.js→Date conversion via Luxon
│   │   └── viewRenderers.ts      # Pure rendering functions for calendar grid and agenda list
│   └── types/
│       └── ical.d.ts             # TypeScript declarations for ical.js
├── main.js                       # Compiled output (Obsidian loads this)
├── styles.css                    # All plugin CSS
├── manifest.json                 # Obsidian plugin manifest (id, name, version)
├── package.json                  # npm dependencies and scripts
├── tsconfig.json                 # TypeScript compiler config
├── esbuild.config.mjs            # Build/bundle configuration
├── version-bump.mjs              # Version update script
├── versions.json                 # Obsidian min-version compatibility map
├── data.json                     # Persisted plugin settings (runtime, gitignored)
├── .planning/
│   └── codebase/                 # GSD codebase map documents
├── .github/
│   └── workflows/                # CI/CD (GitHub Actions)
├── docs/
│   └── plans/                    # Planning documents
├── screenshots/                  # README screenshots
└── node_modules/                 # Dependencies (gitignored)
```

## Directory Purposes

**`src/`:**
- Purpose: All TypeScript source files; the only directory that should be edited
- Contains: Plugin entry point, services, views, settings, utils, type declarations
- Key files: `src/main.ts` (plugin class), `src/settings/types.ts` (all type definitions)

**`src/services/`:**
- Purpose: Business logic with no direct UI rendering
- Contains: Data fetching, parsing, caching, note file operations
- Key files: `src/services/CalendarService.ts` (928 lines, most complex service)

**`src/views/`:**
- Purpose: Obsidian UI components — one sidebar view, two code block renderers
- Contains: Classes extending `ItemView` or `MarkdownRenderChild`
- Key files: `src/views/CalendarView.ts` (1111 lines, largest view)

**`src/settings/`:**
- Purpose: Plugin configuration — types and settings UI
- Contains: Shared interfaces used across all layers, the Obsidian settings tab
- Key files: `src/settings/types.ts` (source of truth for all settings shapes)

**`src/utils/`:**
- Purpose: Stateless helpers shared by services and views
- Contains: Pure functions, constants, rendering logic without component state
- Key files: `src/utils/viewRenderers.ts` (477 lines, shared grid/agenda rendering)

**`src/types/`:**
- Purpose: Third-party type augmentations
- Contains: `ical.d.ts` — declarations for ical.js API not covered by its own types

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents consumed by planning and execution agents
- Generated: Yes (by `/gsd-map-codebase`)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/main.ts`: Plugin class `MemoChron extends Plugin` — `onload()` is the bootstrap
- `main.js`: Compiled output; Obsidian loads this (do not edit directly)

**Configuration:**
- `src/settings/types.ts`: All TypeScript interfaces for settings; `DEFAULT_SETTINGS` constant
- `src/utils/constants.ts`: View type string (`MEMOCHRON_VIEW_TYPE`), default values, color palette
- `manifest.json`: Plugin metadata; `version` must match release tag
- `tsconfig.json`: Compiler settings (target, module, strict)
- `esbuild.config.mjs`: Bundle config; outputs to `main.js`

**Core Logic:**
- `src/services/CalendarService.ts`: iCal fetch, ical.js parse, recurring event expansion, cache
- `src/services/NoteService.ts`: Template variable substitution, folder path building, vault writes
- `src/utils/timezoneUtils.ts`: Windows-to-IANA mapping (100+ entries), Luxon-based conversion
- `src/utils/pathUtils.ts`: PathType enum, path classification and normalization

**UI / Rendering:**
- `src/views/CalendarView.ts`: Sidebar view — month grid, day agenda, view modes, drag-resize
- `src/utils/viewRenderers.ts`: `renderCalendarGrid()` and `renderAgendaList()` — shared by sidebar and embedded views
- `styles.css`: All plugin CSS (uses Obsidian CSS variables for theme support)

**Testing:**
- No test files present (`*.test.ts`, `*.spec.ts` not found)
- Build verification: `npm run build`

## Naming Conventions

**Files:**
- PascalCase for TypeScript class files: `CalendarService.ts`, `CalendarView.ts`, `SettingsTab.ts`
- camelCase for utility/non-class files: `viewRenderers.ts`, `pathUtils.ts`, `timezoneUtils.ts`, `constants.ts`
- Lowercase with dots for config: `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`

**Directories:**
- Lowercase plural for groupings: `services/`, `views/`, `utils/`, `types/`
- Singular for settings: `settings/`

**Classes:**
- PascalCase: `CalendarService`, `NoteService`, `CalendarView`, `EmbeddedAgendaView`
- `Embedded` prefix for code-block rendered views: `EmbeddedCalendarView`, `EmbeddedAgendaView`

**Interfaces:**
- PascalCase: `CalendarEvent`, `CalendarSource`, `MemoChronSettings`, `CalendarNotesSettings`
- Verb+Noun for param/options interfaces: `CalendarCodeBlockParams`, `AgendaCodeBlockParams`, `RenderOptions`

**Constants:**
- SCREAMING_SNAKE_CASE for exported constants: `MEMOCHRON_VIEW_TYPE`, `DEFAULT_REFRESH_INTERVAL`, `CALENDAR_COLOR_PALETTE`

**CSS classes:**
- `memochron-` prefix on all plugin classes: `memochron-calendar-grid`, `memochron-day`, `memochron-weekday`, `memochron-embedded`

## Where to Add New Code

**New calendar data feature (fetching, parsing, caching):**
- Primary code: `src/services/CalendarService.ts`
- Shared types: `src/settings/types.ts` (if new fields on `CalendarSource`)
- Constants: `src/utils/constants.ts`

**New UI element in the sidebar view:**
- Primary code: `src/views/CalendarView.ts`
- Shared rendering: `src/utils/viewRenderers.ts` (if the element should also appear in embedded views)
- CSS: `styles.css`

**New embedded code block view:**
- Create `src/views/EmbeddedXxxView.ts` extending `MarkdownRenderChild`
- Register processor in `src/main.ts` inside `registerCodeBlockProcessors()`
- Add shared render function to `src/utils/viewRenderers.ts`

**New note creation feature:**
- Primary code: `src/services/NoteService.ts`
- Template variables: Add to `EventTemplateVariables` interface and `getEventTemplateVariables()` in `NoteService.ts`
- Folder variables: Add to `FolderTemplateVariables` and `getFolderTemplateVariables()` in `NoteService.ts`

**New settings field:**
1. Add field to `MemoChronSettings` interface in `src/settings/types.ts`
2. Add default value to `DEFAULT_SETTINGS` in `src/settings/types.ts`
3. Add UI control in `src/settings/SettingsTab.ts` inside the relevant `renderXxxSection()` method
4. Add per-calendar override to `CalendarNotesSettings` if the field should be overridable per calendar

**New utility/helper:**
- Pure date/timezone helpers: `src/utils/timezoneUtils.ts`
- Path classification: `src/utils/pathUtils.ts`
- New category of utility: create `src/utils/newUtilName.ts` (camelCase)

**New command:**
- Register in `registerCommands()` in `src/main.ts`
- ID: `kebab-case`; name: human-readable title

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents and codebase maps
- Generated: Partially (codebase maps are generated; phase plans may be hand-written)
- Committed: Yes

**`.github/workflows/`:**
- Purpose: GitHub Actions for CI/release automation
- Generated: No
- Committed: Yes

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (`npm install`)
- Committed: No (gitignored)

**`screenshots/`:**
- Purpose: Images used in README.md
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-05-09*
