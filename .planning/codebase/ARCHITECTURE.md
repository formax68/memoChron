<!-- refreshed: 2026-05-09 -->
# Architecture

**Analysis Date:** 2026-05-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Obsidian Plugin Host                         │
│                        `src/main.ts` (MemoChron)                    │
├──────────────┬──────────────────────┬───────────────────────────────┤
│  Sidebar     │  Markdown Code Block │  Settings UI                  │
│  CalendarView│  EmbeddedCalendarView│  SettingsTab                  │
│ `views/      │  EmbeddedAgendaView  │  `settings/SettingsTab.ts`    │
│  CalendarView│  `views/Embedded*.ts`│                               │
│  .ts`        │                      │                               │
└──────┬───────┴──────────┬───────────┴────────────┬──────────────────┘
       │                  │                         │
       ▼                  ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                │
│   CalendarService            NoteService          IcsImportService  │
│  `services/CalendarService`  `services/NoteService`  `services/     │
│   .ts`                       .ts`                    IcsImport      │
│                                                       Service.ts`   │
└──────┬────────────────────────────┬────────────────────────────────┘
       │                            │
       ▼                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Utilities                                    │
│  timezoneUtils.ts   pathUtils.ts   viewRenderers.ts   constants.ts  │
│  `src/utils/`                                                        │
└──────┬────────────────────────────┬────────────────────────────────┘
       │                            │
       ▼                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  External Services                    Obsidian Vault                 │
│  Remote iCal HTTP URLs                Markdown notes (.md)          │
│  Local ICS files                      data.json (settings)          │
│  Vault-relative ICS paths             calendar-cache.json           │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| MemoChron (Plugin) | Plugin lifecycle, service wiring, command registration, code block processors | `src/main.ts` |
| CalendarService | Fetch/parse/cache iCal data from remote URLs or local files | `src/services/CalendarService.ts` |
| NoteService | Create and locate Obsidian notes from calendar events using templates | `src/services/NoteService.ts` |
| IcsImportService | Parse a single-event ICS file for one-time import | `src/services/IcsImportService.ts` |
| CalendarView | Full sidebar view — month grid + day agenda, selection state, drag-resize | `src/views/CalendarView.ts` |
| EmbeddedCalendarView | Inline month grid rendered inside a `memochron-calendar` code block | `src/views/EmbeddedCalendarView.ts` |
| EmbeddedAgendaView | Inline agenda list rendered inside a `memochron-agenda` code block | `src/views/EmbeddedAgendaView.ts` |
| SettingsTab | Plugin settings UI (Obsidian `PluginSettingTab`), collapsible sections | `src/settings/SettingsTab.ts` |
| MemoChronSettings / types | TypeScript interfaces and DEFAULT_SETTINGS | `src/settings/types.ts` |
| viewRenderers | Pure rendering functions shared by sidebar and embedded views | `src/utils/viewRenderers.ts` |
| timezoneUtils | Windows→IANA timezone mapping, `convertIcalTimeToDate` using Luxon | `src/utils/timezoneUtils.ts` |
| pathUtils | Detect and normalize path types (HTTP URL, file URL, vault-relative, absolute) | `src/utils/pathUtils.ts` |
| constants | View type ID, default setting values, color palette, CUTYPE constants | `src/utils/constants.ts` |

## Pattern Overview

**Overall:** Layered plugin with a service layer beneath view components, using Obsidian's ItemView/MarkdownRenderChild APIs for UI and the Plugin base class as the composition root.

**Key Characteristics:**
- `MemoChron` (Plugin class) owns service instances and orchestrates wiring — it is the single composition root
- Views hold no business logic; they call service methods and delegate rendering to `viewRenderers.ts`
- Settings are a plain typed object (`MemoChronSettings`) persisted via Obsidian's `loadData`/`saveData`; no reactive store
- Embedded views (`EmbeddedCalendarView`, `EmbeddedAgendaView`) extend `MarkdownRenderChild` to integrate with Obsidian's note lifecycle
- CalendarService owns an in-memory cache and a persistent JSON cache written to the plugin folder

## Layers

**Plugin Entry (Composition Root):**
- Purpose: Bootstrap services, register views/commands/code-block processors, manage auto-refresh timer
- Location: `src/main.ts`
- Contains: `MemoChron extends Plugin`
- Depends on: All other layers
- Used by: Obsidian runtime

**View Layer:**
- Purpose: Render UI, handle user interactions (clicks, drag), delegate to services
- Location: `src/views/`
- Contains: `CalendarView`, `EmbeddedCalendarView`, `EmbeddedAgendaView`
- Depends on: Services, `viewRenderers`, `CalendarEvent` type
- Used by: Plugin entry (registered views and code block processors)

**Settings UI:**
- Purpose: Render the plugin's settings tab, write back to `plugin.settings`
- Location: `src/settings/SettingsTab.ts`
- Contains: `SettingsTab extends PluginSettingTab`
- Depends on: `MemoChronSettings` types, `CalendarSource`
- Used by: Plugin entry (`this.addSettingTab(...)`)

**Service Layer:**
- Purpose: Business logic — iCal fetching/parsing, note creation/path-building, single-event ICS import
- Location: `src/services/`
- Contains: `CalendarService`, `NoteService`, `IcsImportService`
- Depends on: Utils (pathUtils, timezoneUtils), Obsidian vault/requestUrl APIs, ical.js, Luxon
- Used by: View layer and Plugin entry

**Utilities:**
- Purpose: Pure or stateless helpers — rendering functions, timezone mapping, path classification, shared constants
- Location: `src/utils/`
- Contains: `viewRenderers.ts`, `timezoneUtils.ts`, `pathUtils.ts`, `constants.ts`
- Depends on: Obsidian API (minimal), Luxon, ical.js
- Used by: Service layer and View layer

**Types / Settings definitions:**
- Purpose: Shared TypeScript interfaces and DEFAULT_SETTINGS object
- Location: `src/settings/types.ts`, `src/types/ical.d.ts`
- Contains: `MemoChronSettings`, `CalendarSource`, `CalendarNotesSettings`, ical.js type augmentations
- Depends on: Nothing (pure types)
- Used by: All layers

## Data Flow

### Calendar Fetch and Display

1. Plugin loads → `onload()` in `src/main.ts` calls `initializeServices()`, then `activateView()` after layout ready
2. `CalendarView.refreshEvents()` (`src/views/CalendarView.ts:81`) calls `CalendarService.fetchCalendars()`
3. `CalendarService.fetchCalendars()` (`src/services/CalendarService.ts:45`) checks in-memory cache → persistent JSON cache → performs HTTP or vault file fetch
4. Fetched ICS text is parsed via `ical.js` in `CalendarService.parseCalendarData()` (`src/services/CalendarService.ts:530`)
5. Recurring events expanded, exceptions applied, timezone conversion via `convertIcalTimeToDate()` in `src/utils/timezoneUtils.ts`
6. Resulting `CalendarEvent[]` stored in `CalendarService.events` and written to `calendar-cache.json`
7. `CalendarView.renderCalendar()` calls `renderCalendarGrid()` from `src/utils/viewRenderers.ts`
8. Selected date triggers `showDayAgenda()` → `renderAgendaList()` from `src/utils/viewRenderers.ts`

### Event Note Creation

1. User clicks an event in `CalendarView` or an embedded view
2. View calls `NoteService.createEventNote(event)` (`src/services/NoteService.ts:56`)
3. `buildFilePath()` resolves note location, title format, and folder template from per-calendar or global settings
4. `generateNoteContent()` applies `{{template_variables}}` to frontmatter and body templates
5. Obsidian vault API (`app.vault.create`) writes the markdown file
6. Obsidian opens the new file via `app.workspace.getLeaf()`

### Auto-Refresh Timer

1. `setupAutoRefresh()` (`src/main.ts:164`) sets `window.setInterval` based on `settings.refreshInterval` (minutes)
2. Timer fires → `refreshCalendarView()` → `CalendarService.fetchCalendars()` with `forceRefresh=false`
3. On settings save, timer is cleared and recreated with the new interval

### Embedded Code Block Rendering

1. Obsidian encounters ` ```memochron-calendar ``` ` or ` ```memochron-agenda ``` ` in a note
2. Registered processors in `src/main.ts:68-92` instantiate `EmbeddedCalendarView` or `EmbeddedAgendaView`
3. Embedded views call `CalendarService.getEventsForEmbed()` (respects `showInEmbeds` per-calendar flag)
4. Rendering delegates to `renderCalendarGrid()` / `renderAgendaList()` in `src/utils/viewRenderers.ts`

**State Management:**
- `CalendarService` holds the authoritative in-memory `CalendarEvent[]` array and `lastFetch` timestamp
- `MemoChron.settings` holds a single plain settings object; mutated on user save, persisted via Obsidian's `saveData()`
- `CalendarView` holds local UI state: `currentDate`, `selectedDate`, `viewMode`, `dailyNotes` Map
- No shared reactive store; embedded views pull data from `plugin.calendarService` on each render

## Key Abstractions

**CalendarEvent:**
- Purpose: Canonical event object with normalized dates (local JS Date), source metadata, color
- Examples: Defined in `src/services/CalendarService.ts:14-26`
- Pattern: Plain interface, produced by `CalendarService`, consumed by views and `NoteService`

**CalendarSource:**
- Purpose: One configured calendar — URL, name, enabled flag, color, per-calendar notes overrides
- Examples: `src/settings/types.ts:30-39`
- Pattern: Plain interface stored in `MemoChronSettings.calendarUrls[]`

**MemoChronSettings:**
- Purpose: All plugin configuration in a single flat object with nested `CalendarSource[]`
- Examples: `src/settings/types.ts:41-96`
- Pattern: Loaded/saved via Obsidian's `loadData`/`saveData`; `DEFAULT_SETTINGS` provides fallbacks

**PathInfo / PathType:**
- Purpose: Classify a calendar URL as HTTP, file://, vault-relative, or absolute filesystem path
- Examples: `src/utils/pathUtils.ts`
- Pattern: Enum + interface + pure functions; used by `CalendarService.fetchCalendarData()`

**RenderOptions:**
- Purpose: Options bag for shared rendering functions (colors, first day of week, time format)
- Examples: `src/utils/viewRenderers.ts:6-12`
- Pattern: Optional fields interface passed to `renderCalendarGrid()` and `renderAgendaList()`

## Entry Points

**Plugin Load:**
- Location: `src/main.ts` — `MemoChron.onload()`
- Triggers: Obsidian plugin loader on vault open
- Responsibilities: Settings load, service init, view registration, command registration, code block processor registration, sidebar view activation, auto-refresh setup

**Sidebar View:**
- Location: `src/views/CalendarView.ts` — `CalendarView.onOpen()`
- Triggers: Obsidian workspace when the registered view type `memochron-calendar` is activated
- Responsibilities: UI creation, initial event fetch, daily notes load, calendar render

**Code Block Processors:**
- Location: `src/main.ts:68-92`
- Triggers: Obsidian note renderer when a fenced code block with `memochron-calendar` or `memochron-agenda` language is encountered
- Responsibilities: Parse code block params, instantiate `EmbeddedCalendarView` or `EmbeddedAgendaView`

**Settings Tab:**
- Location: `src/settings/SettingsTab.ts` — `SettingsTab.display()`
- Triggers: User opens plugin settings in Obsidian
- Responsibilities: Render all settings UI; calls `plugin.saveSettings()` on changes

## Architectural Constraints

- **Threading:** Single-threaded (Obsidian/Electron main thread). Async I/O via Obsidian's `requestUrl` and vault adapter. No Web Workers.
- **Global state:** `CalendarService.events` and `CalendarService.lastFetch` are instance-level but accessed globally through `plugin.calendarService` (singleton held on the Plugin class). `CalendarView` instance held on `plugin.calendarView`.
- **Circular imports:** `CalendarService` imports from `src/main.ts` (plugin reference for settings/vault access). `NoteService` takes `App` and `MemoChronSettings` directly to avoid circular dependency with the plugin class.
- **Auto-refresh timer:** Implemented with `window.setInterval` (not `this.registerInterval`), stored as `plugin.refreshTimer`. `clearRefreshTimer()` is called in `onunload()` but services are not fully torn down.
- **Cache location:** Written to `{vault}/.obsidian/plugins/memochron/calendar-cache.json` via `vault.adapter`.

## Anti-Patterns

### Direct `window.setInterval` Instead of `this.registerInterval`

**What happens:** `src/main.ts:168` uses `window.setInterval` and manually tracks the handle in `this.refreshTimer`.
**Why it's wrong:** Bypasses Obsidian's plugin cleanup mechanism. If cleanup path has a bug the timer leaks.
**Do this instead:** Use `this.registerInterval(window.setInterval(...))` — Obsidian automatically clears it on unload.

### Direct `addEventListener` in Views

**What happens:** `CalendarView` and `SettingsTab` use raw `addEventListener` on DOM elements in several places.
**Why it's wrong:** Listeners are not tracked by Obsidian; if view is destroyed without cleanup, listeners may leak.
**Do this instead:** Use `this.registerDomEvent(element, event, handler)` which Obsidian cleans up automatically.

### CalendarService Holds Plugin Reference

**What happens:** `CalendarService` accepts the full `MemoChron` plugin instance (`src/services/CalendarService.ts:40`) and reads `plugin.settings` and `plugin.app` internally.
**Why it's wrong:** Creates tight coupling — service cannot be unit-tested without a full plugin instance mock. Also creates an indirect circular reference (plugin owns service, service owns plugin).
**Do this instead:** Pass only the needed dependencies (settings object, vault adapter) rather than the whole plugin.

## Error Handling

**Strategy:** Try/catch with `console.error` logging and optional `new Notice(...)` for user-visible errors. Silent fallbacks used extensively (e.g., cache read failure returns empty array; note path failure falls back to a safe default).

**Patterns:**
- Network failures per calendar source return `[]` and show a `Notice` (403, 404, CORS errors handled with specific messages)
- `NoteService` methods catch errors in `createEventNote` and `buildFilePath`, re-throw from `createEventNote`, fall back silently in `buildFilePath`
- Cache read failures are caught silently (`console.log`) in `loadFromCache`; fresh fetch is triggered instead
- Timezone conversion failures fall back to local date construction with a `console.warn`

## Cross-Cutting Concerns

**Logging:** `console.log/warn/error/debug` used directly throughout. No structured logging abstraction. Prefixed with "MemoChron:" in some places.
**Validation:** URL format validated in `pathUtils.ts`; ICS content validated by checking for `BEGIN:VCALENDAR` string before parsing. No input sanitization for event data before DOM rendering.
**Authentication:** None — only public iCal URLs and local files are supported. Outlook URLs receive special multi-attempt header handling in `CalendarService.fetchRemoteCalendar()`.

---

*Architecture analysis: 2026-05-09*
