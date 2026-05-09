# External Integrations

**Analysis Date:** 2026-05-09

## APIs & External Services

**iCalendar Feeds (user-configured):**
- Any public iCalendar URL (HTTP/HTTPS) — fetched at a user-defined refresh interval (default 30 min)
  - SDK/Client: `obsidian`'s `requestUrl()` (wraps Electron's net module, bypasses browser CORS)
  - Auth: None — only public/unauthenticated calendar URLs are supported
  - Implementation: `src/services/CalendarService.ts` → `fetchRemoteCalendar()`

- **Microsoft Outlook / Office 365** (`outlook.office365.com`, `outlook.live.com`) — special multi-attempt fetch logic
  - First attempt: browser-like `User-Agent` header
  - Second attempt: no custom headers (Obsidian defaults)
  - Third attempt: `Accept: text/calendar` header
  - Implementation: `src/services/CalendarService.ts` → `fetchRemoteCalendar()` (lines 412–484)

- **Google Calendar, Apple Calendar, and other standard providers** — single standard request with `Accept: text/calendar` and `User-Agent: MemoChron-ObsidianPlugin`

**No other external APIs or third-party SaaS integrations exist.** There are no analytics, telemetry, authentication providers, payment processors, or cloud service SDKs.

## Data Storage

**Databases:**
- None. No database engine used.

**File Storage (Obsidian Vault — local filesystem):**
- Event notes written to user-configured vault folder via `this.app.vault.create()` — `src/services/NoteService.ts`
- Note location: configurable path within the vault (default `/`)

**Cache:**
- JSON file at `<vault>/.obsidian/plugins/memochron/calendar-cache.json`
- Written via `this.plugin.app.vault.adapter.write()` — `src/services/CalendarService.ts` → `saveToCache()`
- Cache stores: timestamp, source list, and serialized `CalendarEvent[]`
- Cache invalidation: time-based (refresh interval), source list mismatch, or force-refresh command

**Local ICS Files (user-configured):**
- Vault-relative paths (e.g., `calendars/work.ics`) — read via `this.plugin.app.vault.read(file)`
- Absolute filesystem paths — read via `this.plugin.app.vault.adapter.read(path)`
- `file://` URL format — decoded and read as absolute path
- Implementation: `src/services/CalendarService.ts` → `fetchLocalCalendar()` and `src/utils/pathUtils.ts`

**Plugin Settings:**
- Stored via Obsidian's `this.loadData()` / `this.saveData()` APIs (maps to `<vault>/.obsidian/plugins/memochron/data.json`)
- Implementation: `src/main.ts` → `loadSettings()` / `saveSettings()`

## Authentication & Identity

**Auth Provider:**
- None — plugin does not implement any authentication system
- All calendar sources must be publicly accessible URLs (no OAuth, no API keys, no credentials)

## Monitoring & Observability

**Error Tracking:**
- None — no external error tracking service (e.g., Sentry) integrated

**Logs:**
- `console.log` / `console.error` / `console.warn` / `console.debug` throughout
- User-facing notifications via Obsidian's `Notice` API for fetch errors, refresh status, and validation failures
- Key log sources: `src/services/CalendarService.ts`, `src/services/NoteService.ts`, `src/utils/timezoneUtils.ts`

## CI/CD & Deployment

**Hosting:**
- Obsidian Community Plugin directory (distribution)
- GitHub Releases for versioned assets (`main.js`, `manifest.json`, `styles.css`)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/release.yml`
  - Trigger: git tag push (`*`)
  - Node.js: 18.x
  - Steps: `npm install` → `npm run build` → `gh release create` (draft) with `main.js`, `manifest.json`, `styles.css`
  - Auth: `GITHUB_TOKEN` secret (GitHub-provided)
- `.github/workflows/claude-code-review.yml` and `.github/workflows/claude.yml` also present (AI-assisted review)

## Environment Configuration

**Required env vars:**
- None at runtime — plugin has no environment variables; all configuration is stored in Obsidian's plugin data system

**CI secrets:**
- `GITHUB_TOKEN` — used by `gh` CLI in release workflow to create GitHub releases

**Secrets location:**
- GitHub Actions secrets only; no `.env` files committed or required

## Webhooks & Callbacks

**Incoming:**
- None — no webhook endpoints

**Outgoing:**
- None — plugin only makes outbound HTTP GET requests to fetch iCalendar feeds; no webhook calls to external services

## Obsidian API Surface Used

The plugin relies heavily on the Obsidian plugin API (marked `external` in esbuild, provided by the host app):

| API | Usage | File |
|-----|-------|-------|
| `requestUrl()` | HTTP GET for remote `.ics` feeds | `src/services/CalendarService.ts` |
| `Plugin.loadData()` / `saveData()` | Settings persistence | `src/main.ts` |
| `app.vault.read()` / `create()` / `adapter.read()` / `adapter.write()` | File I/O for notes and cache | `src/services/NoteService.ts`, `src/services/CalendarService.ts` |
| `ItemView` / `WorkspaceLeaf` | Custom sidebar panel | `src/views/CalendarView.ts` |
| `MarkdownRenderChild` | Embedded code block views | `src/views/EmbeddedCalendarView.ts`, `src/views/EmbeddedAgendaView.ts` |
| `Notice` | User-facing toast notifications | Multiple files |
| `Platform` | Mobile/desktop detection | `src/services/CalendarService.ts` |
| `normalizePath` | Cross-platform vault path normalization | `src/utils/pathUtils.ts`, `src/services/NoteService.ts` |
| `TFile`, `TFolder` | Vault file/folder types | `src/services/NoteService.ts`, `src/services/CalendarService.ts` |
| `setIcon`, `Menu`, `MenuItem` | UI helpers | `src/views/CalendarView.ts` |
| `DropdownComponent` | Settings UI component | `src/views/CalendarView.ts` |

**Third-party Obsidian community library:**
- `obsidian-daily-notes-interface` ^0.9.4 — `getAllDailyNotes`, `getDailyNote`, `createDailyNote` — used in all three view files to integrate with Obsidian's Daily Notes core plugin

---

*Integration audit: 2026-05-09*
