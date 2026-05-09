# Phase 1: Foundation - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Internal hygiene only — no user-visible feature change. Five tightly-scoped requirements:

- **TD-01** — `CalendarService` cache-expiry reads live `refreshInterval` (no stale constructor copy)
- **TD-02** — `NoteService` reads live settings (no stale settings reference at construction)
- **TD-03** — All `setTimeout`/`setInterval` calls are tracked and cancelled on plugin unload / view close (no detached-callback firings)
- **TD-04** — `mousemove`/`mouseup` listeners on `window` from drag-resize are cleaned up if `CalendarView` is destroyed mid-drag
- **CLEAN-01** — Dead code removed: `CalendarService.calculateEndDate`, unused imports (`App` and `TFile` in `EmbeddedCalendarView`/`EmbeddedAgendaView`, `renderAgendaList` in `EmbeddedAgendaView`), unused constants (`DEFAULT_TEMPLATE_PATH`, `TEMPLATE_VARIABLES`)

Goal at end of phase: settings changes propagate live; iOS rapid disable/enable doesn't crash on a detached-callback access; mid-drag teardown leaves no orphan window listeners; dead code is gone.

</domain>

<decisions>
## Implementation Decisions

### Live-settings pattern (TD-01, TD-02)

- **D-01:** Both `CalendarService` and `NoteService` take `(plugin: MemoChron)` only as their constructor argument. `NoteService` no longer takes `app` separately — it reads `this.plugin.app` and `this.plugin.settings`.
- **D-02:** `CalendarService` drops the cached `private refreshMinutes` field. `needsRefresh()` reads `this.plugin.settings.refreshInterval` live.
- **D-03:** `NoteService` adds `private get settings(): MemoChronSettings { return this.plugin.settings; }` so all existing `this.settings.x` references resolve live with zero call-site churn.
- **D-04:** `main.ts` `initializeServices()` is updated to pass only `this` to both services. The `refreshInterval` argument to `new CalendarService(...)` is removed.

### Timeout & onunload (TD-03)

- **D-05:** Every `window.setTimeout`/`setInterval` is wrapped in `registerInterval(...)`:
  - `setupAutoRefresh` in `main.ts:168` wraps the existing `window.setInterval` in `this.registerInterval(...)`. The manual `refreshTimer` handle stays — it's needed to `clearInterval` on `saveSettings()` reset. `registerInterval` is belt-and-suspenders for unload.
  - `CalendarService.scheduleBackgroundRefresh` 100ms `setTimeout` is registered via `this.plugin.registerInterval(window.setTimeout(...))`.
  - `CalendarView.onOpen` 50ms `setTimeout` is registered via `this.registerInterval(window.setTimeout(...))` (CalendarView is a Component, so `registerInterval` is on its own instance).
- **D-06:** Timing values (50ms, 100ms) are NOT changed in this phase. PERF-04 (replace with `requestAnimationFrame` / `requestIdleCallback`) is deferred to a separate perf milestone.
- **D-07:** `onunload` calls `this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` so `CalendarView.onClose()` fires deterministically on plugin disable. `clearRefreshTimer()` continues to be called for symmetry. No `dispose()` API on services — `registerInterval` covers all timer cleanup.

### Drag teardown (TD-04)

- **D-08:** `CalendarView` adds `private isDragging = false`. `handleDragStart` sets it true; `handleDragEnd` sets it false.
- **D-09:** Override `CalendarView.onClose()` to detach the two `window` listeners (`mousemove`/`mouseup`) and clear `isDragging` if it's true. **Listener removal only** — do NOT call `handleDragEnd` itself, because that path runs `snapToCurrentViewMode()` → `saveSettings()` → `refreshCalendarView()`, which would race against the view teardown.

### Dead-code scope (CLEAN-01)

- **D-10:** Strict to the named symbols in success criterion #4: `calculateEndDate` (private method in `CalendarService`), `DEFAULT_TEMPLATE_PATH` and `TEMPLATE_VARIABLES` (constants in `src/utils/constants.ts`), unused `App`/`TFile` imports (in `EmbeddedCalendarView` and `EmbeddedAgendaView`), and the unused `renderAgendaList` import in embedded views.
- **D-11:** The `renderAgendaList` *function* in `src/utils/viewRenderers.ts` itself is left intact unless verified by grep to have zero remaining callers. Removing it is out-of-scope for this phase (success criterion only names the import, not the function).

### Claude's Discretion

- Commit granularity: planner decides (per-requirement atomic commits is the GSD default).
- Verification approach: code review of cleanup paths + manual exercise (no test suite is in scope this milestone).
- Whether to consolidate `CalendarService` and `NoteService` constructor changes into a single commit or split: planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project artifacts
- `.planning/ROADMAP.md` — Phase 1 entry, success criteria, requirement IDs
- `.planning/REQUIREMENTS.md` — TD-01..TD-04, CLEAN-01 acceptance language; out-of-scope list (PERF-04, FRAG-01..04, etc.)
- `.planning/PROJECT.md` — milestone framing, constraints, deferred items
- `.planning/STATE.md` — current phase position, blockers/concerns

### Codebase intel
- `.planning/codebase/CONCERNS.md` — flagged issues with file/line references and suggested fix approaches; the source of TD-01..TD-04 as concerns
- `.planning/codebase/ARCHITECTURE.md` — composition pattern, anti-patterns section calling out `window.setInterval` vs `registerInterval` and direct `addEventListener` usage
- `.planning/codebase/CONVENTIONS.md` — error-handling patterns, naming conventions, access modifiers

### Project rules
- `CLAUDE.md` — Obsidian plugin best practices; `registerInterval` / `registerDomEvent` guidance; commit message hygiene (NO Claude/AI references in commits or release notes); BRAT release flow; mobile compatibility requirement (`isDesktopOnly: false`)

### Source files this phase will touch
- `src/main.ts` — service construction, `setupAutoRefresh`, `onunload`
- `src/services/CalendarService.ts` — constructor signature, `refreshMinutes` field removal, `needsRefresh`, `scheduleBackgroundRefresh`, `calculateEndDate` removal
- `src/services/NoteService.ts` — constructor signature, `settings` getter, `app` access via plugin
- `src/views/CalendarView.ts` — `onOpen` 50ms setTimeout wrap, `handleDragStart`/`handleDragEnd` `isDragging` flag, new `onClose` override
- `src/views/EmbeddedCalendarView.ts` — remove unused `App` import (and `TFile` if unused there)
- `src/views/EmbeddedAgendaView.ts` — remove unused `TFile` and `renderAgendaList` imports
- `src/utils/constants.ts` — remove `DEFAULT_TEMPLATE_PATH`, `TEMPLATE_VARIABLES`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Obsidian `registerInterval`** — already available on `Plugin` (used nowhere currently) and on `Component`/`ItemView` (via `CalendarView` inheritance). Accepts any `setInterval`/`setTimeout` numeric handle.
- **Obsidian `detachLeavesOfType`** — available on `this.app.workspace`. Clean way to force `CalendarView.onClose` from `onunload`.
- **Existing `clearRefreshTimer()` in `main.ts:174`** — already null-guards and clears the manual `refreshTimer` handle. Keep as-is.
- **Existing `handleDragMoveBound`/`handleDragEndBound` properties** — already bound function references; `removeEventListener` calls work in `onClose` with the same handles.

### Established Patterns
- **Composition root** — `MemoChron` (Plugin class) owns service instances. After this phase, both services hold a back-reference to the plugin (CalendarService already does; NoteService will after D-01). ARCHITECTURE.md flags this as an anti-pattern (FRAG concern), but the fragility refactor is explicitly deferred.
- **Manual handle for resettable timer** — `setupAutoRefresh` clears and recreates on save. This pattern is preserved (D-05); `registerInterval` augments rather than replaces it.
- **Service-to-plugin coupling** — already present for CalendarService; NoteService joining is consistent.

### Integration Points
- `main.ts initializeServices()` (line 33) — single call site for service construction; both new constructor signatures land here.
- `main.ts onunload()` (line 94) — single point of teardown; gains `detachLeavesOfType` call.
- `CalendarView.onOpen()` line 59 — 50ms setTimeout site.
- `CalendarService.scheduleBackgroundRefresh()` line 185 — 100ms setTimeout site; needs plugin reference (already has it via `this.plugin`).
- `CalendarView.handleDragStart`/`handleDragEnd` lines 1049–1083 — drag attach/detach sites.

</code_context>

<specifics>
## Specific Ideas

- The `refreshInterval` constructor argument to `CalendarService` is removed in this phase — not preserved for backward compatibility. There is no public consumer outside `main.ts`.
- The `NoteService` constructor changes from `(app: App, settings: MemoChronSettings)` to `(plugin: MemoChron)`. No transitional shim — `main.ts` is the only call site.
- `onClose` listener removal in CalendarView is deliberately a subset of `handleDragEnd`'s logic. The shared bit (just the two `removeEventListener` calls) could be extracted into a private helper called by both, or left inline — planner decides based on the resulting diff size.

</specifics>

<deferred>
## Deferred Ideas

- **PERF-04** — Replacing the 50/100ms timeouts with `requestAnimationFrame` / `requestIdleCallback`. Stays in v2 perf milestone.
- **FRAG-03** — `hasSourceMismatch` URL-canonical refactor (currently compares by name). Out of scope.
- **`renderAgendaList` function removal in `viewRenderers.ts`** — only the *import* in embedded views is in scope. Verifying zero callers and deleting the function itself can happen in a later cleanup pass.
- **`addEventListener` → `registerDomEvent` audit** outside drag handlers (CONCERNS notes other sites in `CalendarView` and `SettingsTab`). Not in TD-04 scope.
- **`CalendarService` decoupling from plugin** — fragility concern flagged by ARCHITECTURE.md but explicitly deferred per milestone constraints.

</deferred>

---

*Phase: 1-foundation*
*Context gathered: 2026-05-09*
