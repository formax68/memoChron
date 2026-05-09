# Codebase Concerns

**Analysis Date:** 2026-05-09

---

## Tech Debt

**CalendarService.refreshMinutes is stale after settings change:**
- Issue: `CalendarService` receives `refreshMinutes` once at construction (`src/main.ts:36`) and stores it as a private field (`src/services/CalendarService.ts:40`). When the user changes `refreshInterval` in settings, `setupAutoRefresh()` resets the window interval correctly, but `CalendarService.needsRefresh()` still uses the old `this.refreshMinutes` value for its internal cache-expiry check (`src/services/CalendarService.ts:195`). The service is never re-instantiated, so the internal cache logic and the timer diverge.
- Files: `src/main.ts`, `src/services/CalendarService.ts`
- Impact: After a settings change to the refresh interval, the cache expiry check inside `CalendarService` uses the old interval until Obsidian is reloaded.
- Fix approach: Pass `this.plugin.settings.refreshInterval` dynamically in `needsRefresh()` instead of reading a stale constructor argument, or expose a `setRefreshInterval()` method that `saveSettings()` calls.

**NoteService holds a stale settings reference:**
- Issue: `NoteService` is constructed with a direct reference to `this.settings` at plugin load (`src/main.ts:38`). The `MemoChronSettings` object is later replaced entirely by `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` on each `loadSettings()` call, but the service is never re-constructed and the reference passed at construction remains the one from plugin load.
- Files: `src/main.ts`, `src/services/NoteService.ts`
- Impact: Note paths, templates, date formats, and tag settings are read correctly only because `saveSettings` does not call `loadSettings` again (it reuses the existing mutated settings object). However, this is a fragile dependency — any future refactor calling `loadSettings` after initial load would silently break note generation.
- Fix approach: Pass `() => this.settings` as a getter, or pass the plugin instance directly so `NoteService` always reads the live settings object.

**`calculateEndDate` private method is dead code:**
- Issue: `CalendarService.calculateEndDate()` (`src/services/CalendarService.ts:758`) is a private method that is never called anywhere in the class. The functionality it provides is inlined at the call sites.
- Files: `src/services/CalendarService.ts`
- Impact: Minimal — dead code increases maintenance surface.
- Fix approach: Remove the unused method.

**`renderAgendaList` exported from `viewRenderers.ts` but not used:**
- Issue: `EmbeddedAgendaView.ts` imports `renderAgendaList` from `src/utils/viewRenderers.ts` (line 4) but never calls it. The view renders its agenda inline instead. `TFile` is also imported but unused in the same file.
- Files: `src/views/EmbeddedAgendaView.ts`, `src/utils/viewRenderers.ts`
- Impact: Dead import causes confusion about the intended rendering path. The `renderAgendaList` utility in `viewRenderers.ts` provides a parallel implementation that does NOT attach click handlers (the `renderDailyNoteEntry` in viewRenderers.ts has the comment "Click handler should be added by the caller if needed"), making it a footgun if it is ever accidentally used.
- Fix approach: Remove the unused imports. If `renderAgendaList` is genuinely not needed, mark it for removal or add a clear `@deprecated` comment.

**`App` imported but unused in `EmbeddedCalendarView`:**
- Issue: `src/views/EmbeddedCalendarView.ts` line 1 imports `App` from `obsidian` but never references it.
- Files: `src/views/EmbeddedCalendarView.ts`
- Impact: Minor — unused import.
- Fix approach: Remove the unused import.

**`DEFAULT_TEMPLATE_PATH` and `TEMPLATE_VARIABLES` constants are unused:**
- Issue: `src/utils/constants.ts` defines `DEFAULT_TEMPLATE_PATH` and the `TEMPLATE_VARIABLES` map (`src/utils/constants.ts:6,17`). Neither is imported or used anywhere in the codebase.
- Files: `src/utils/constants.ts`
- Impact: Misleads developers into thinking a template-file system exists when it does not.
- Fix approach: Remove or annotate as planned/future work.

---

## Security Considerations

**`innerHTML` used with user-controlled color value:**
- Risk: `SettingsTab.ts` lines 589 and 675 inject a user-selected color string directly into `innerHTML` via template literal: `` customLabel.innerHTML = `<svg ... fill="${currentColor}" ...` ``. `currentColor` originates from `this.plugin.settings.calendarUrls[index].color`, which is set from an `<input type="color">` element but also persisted to disk and loaded back via `this.loadData()`. A maliciously crafted settings file (e.g., synced vault from an untrusted source) with a color value containing `">` could break out of the SVG attribute context.
- Files: `src/settings/SettingsTab.ts`
- Current mitigation: The color value comes from an `<input type="color">` in normal usage, which constrains the value to `#rrggbb` hex format. However, when loaded from persisted settings there is no sanitization.
- Recommendations: Validate that color values match `/^#[0-9a-fA-F]{6}$/` before writing to `innerHTML`, or use `document.createElementNS` to build the SVG programmatically.

**`innerHTML` used for static help-text HTML:**
- Risk: `SettingsTab.ts` lines 1817, 1834, 1855–1857 use `innerHTML` to set list item content with hard-coded HTML strings containing `<strong>` tags.
- Files: `src/settings/SettingsTab.ts`
- Current mitigation: These are static strings with no user input, so there is no runtime injection risk. However, using `innerHTML` for any purpose normalizes the pattern and may be flagged by Obsidian's plugin review team.
- Recommendations: Replace with `createEl("strong")` for the bold portions to avoid `innerHTML` entirely and adhere to Obsidian API conventions.

**Untyped `error` accesses in catch blocks:**
- Risk: Several catch blocks access `error.message` without first confirming `error instanceof Error` — e.g., `src/views/CalendarView.ts:939` (`error.message`), `src/services/CalendarService.ts:389,391,525`. In TypeScript strict mode and in JavaScript engines, thrown values can be non-Error objects (strings, numbers, etc.), making `.message` undefined.
- Files: `src/views/CalendarView.ts`, `src/services/CalendarService.ts`, `src/services/NoteService.ts`
- Current mitigation: Partial — `IcsImportService.ts` checks `error instanceof Error` before accessing `.message`.
- Recommendations: Adopt a consistent pattern such as `error instanceof Error ? error.message : String(error)` across all catch blocks.

---

## Performance Bottlenecks

**`scheduleBackgroundRefresh` uses a raw 100ms `setTimeout`:**
- Problem: `CalendarService.scheduleBackgroundRefresh()` (`src/services/CalendarService.ts:185`) calls `setTimeout(() => this.fetchCalendars(sources, true), 100)`. This is a magic number with no explanation, fires on every cold-cache load, and is not tracked so it cannot be cancelled.
- Files: `src/services/CalendarService.ts`
- Cause: The timeout is used to allow the UI to render before initiating a network fetch, but no reference is kept to cancel it during plugin unload.
- Improvement path: Store the timeout ID and cancel it in `onunload`, or use `requestIdleCallback` with a fallback; document the 100ms rationale.

**`CalendarView.onOpen` uses a raw 50ms `setTimeout`:**
- Problem: `src/views/CalendarView.ts:59` uses `setTimeout(..., 50)` to defer initial render until the DOM settles. The timeout is not tracked and cannot be cancelled on view close.
- Files: `src/views/CalendarView.ts`
- Cause: DOM measurement (`recalculateViewModeFromHeight`) requires the element to be laid out.
- Improvement path: Use `requestAnimationFrame` or `ResizeObserver` to detect when the DOM is ready, and register the timeout via `window.setTimeout` with cleanup.

**Heavy `calendarUrls` iteration on every widget event fetch:**
- Problem: `CalendarService.getEventsForWidget()` and `getAllEventsForWidget()` (`src/services/CalendarService.ts:96–117`) both reconstruct a `Set<string>` from `this.plugin.settings.calendarUrls` on every call. In the agenda rendering loop for multi-day embedded views, this is called multiple times per render cycle.
- Files: `src/services/CalendarService.ts`
- Cause: No caching of the derived set between calls.
- Improvement path: Cache the enabled source ID set and invalidate it when settings change.

**Large `SettingsTab.ts` (1,882 lines) rebuilt entirely on each `display()` call:**
- Problem: The entire settings UI is torn down and reconstructed every time `display()` is called. This includes multiple asynchronous folder-listing operations (`getAllFolders()`).
- Files: `src/settings/SettingsTab.ts`
- Cause: Obsidian's standard lifecycle calls `display()` each time the settings tab is opened, but the tab holds no incremental state.
- Improvement path: Cache the folder list between opens; break the tab into smaller sub-components.

---

## Fragile Areas

**`(window as any).moment` global access for week numbers and daily notes:**
- Files: `src/views/CalendarView.ts` (lines 140, 469, 709), `src/views/EmbeddedAgendaView.ts` (line 358), `src/views/EmbeddedCalendarView.ts` (line 210)
- Why fragile: All five call sites access `moment` via `(window as any).moment`, which is an undocumented Obsidian internal. If Obsidian removes or namespaces this global in a future release, week-number display and all daily-note interactions will silently fail. The failure mode at line 469 is graceful ("?") but at lines 140 and 709 an absent `moment` aborts the daily-note flow with a `Notice`.
- Safe modification: Wrap access in a shared utility function with a fallback, and detect absence at plugin load rather than at runtime per-callsite.

**`CalendarView` attaches `window` event listeners in `handleDragStart` without guaranteed cleanup:**
- Files: `src/views/CalendarView.ts` (lines 1055–1056)
- Why fragile: `handleDragStart` adds `mousemove` and `mouseup` listeners to `window`. These are removed in `handleDragEnd`, but if the view is destroyed (e.g., Obsidian layout change) while a drag is in progress, the listeners will never be cleaned up, causing memory leaks and potential null-reference errors on future events.
- Safe modification: Register the window listeners through `this.registerDomEvent` if possible, or override `onClose()` in `CalendarView` to remove them defensively.

**`hasSourceMismatch` detects source changes by `event.source` (name), not by `sourceId` (URL):**
- Files: `src/services/CalendarService.ts` (lines 206–215)
- Why fragile: `hasDisabledEvents` checks whether any event's `source` (calendar name string) has no matching `enabledSources.find(s => s.name === event.source)`. If a user renames a calendar in settings, all existing cached events will appear as from an "unknown source," triggering a full refresh. Conversely, `sourceId` is set to `source.url`, so filtering in `getEventsForWidget` uses the URL, but mismatch detection uses the name — the two identifiers are inconsistent.
- Safe modification: Use `sourceId` (URL) consistently as the canonical identity throughout the service. Confirm `hasSourceMismatch` also compares by URL.

**`onunload()` in `main.ts` only clears the timer, does not clean up services or views:**
- Files: `src/main.ts` (lines 94–96)
- Why fragile: `onunload` calls `clearRefreshTimer()` but does not null out `calendarService`, `noteService`, or `calendarView`. Any background refresh scheduled via `setTimeout` (from `scheduleBackgroundRefresh`) that fires after unload will call into a detached plugin instance. If `CalendarView` is still mounted when the plugin is disabled, event listeners on `agenda`, `resizeHandle`, and individual day elements remain attached.
- Safe modification: Cancel the background-refresh timeout in `onunload`. Call `calendarView.onClose()` explicitly if it is not automatically called by Obsidian's view lifecycle on plugin disable.

**`isAllDayEvent` uses `(dtstart as any).jCal` internal ical.js structure:**
- Files: `src/services/CalendarService.ts` (line 923), `src/services/IcsImportService.ts` (line 109)
- Why fragile: Both files cast the `dtstart` property to `any` and access `.jCal[2]` to detect date-only values. This relies on ical.js's internal jCal representation, which is not part of its public API and could change between library versions without a semver bump.
- Safe modification: Rely solely on the `VALUE=DATE` parameter check (the branch immediately above), which is the RFC 5545–compliant way to detect all-day events.

---

## Known Bugs

**`getStartOfWeek` produces incorrect results when `firstDayOfWeek` is 0 (Sunday) and the current day is Sunday:**
- Symptoms: When the week starts on Sunday and the current date is a Sunday, the formula `d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay` with `day = 0` and `firstDay = 0` evaluates to `d.getDate() + 0`, returning the same date — correct. However when `day = 0` and `firstDay > 0` the condition `day < firstDay` is `0 < firstDay` which is always true for any non-Sunday start, subtracting 7 to jump back a week. This is the correct behavior for those cases, but the logic is non-obvious and untested.
- Files: `src/views/CalendarView.ts` (lines 388–394)
- Trigger: Switch first day of week to Saturday (6) and navigate to a week containing a Saturday date.
- Workaround: None currently. The most common setting (Monday start) works correctly.

**Background refresh silent failure after concurrent fetch:**
- Symptoms: `fetchCalendars` guards against concurrent calls via `isFetchingCalendars` and returns the current (possibly empty or stale) event list if a fetch is in progress. The `scheduleBackgroundRefresh` call does not wait for the in-progress fetch and may schedule a second fetch that starts immediately after the guard, producing two sequential full refreshes.
- Files: `src/services/CalendarService.ts` (lines 46–48, 180–187)
- Trigger: Plugin load on a slow network where the initial fetch overlaps with the background refresh trigger.
- Workaround: The second fetch is short-circuited by `needsRefresh` returning false once `lastFetch` is updated.

---

## Test Coverage Gaps

**No unit or integration tests:**
- What's not tested: The entire codebase — `CalendarService` parsing logic, `NoteService` file-path generation, `timezoneUtils` conversions, and all view rendering — has zero automated tests.
- Files: All files under `src/`
- Risk: Recurrence rule edge cases (EXDATE, exception overrides), timezone conversions for non-IANA identifiers, and note template variable substitution can silently regress with no detection mechanism.
- Priority: High — `CalendarService.parseCalendarData`, `timezoneUtils.convertIcalTimeToDate`, and `NoteService.buildFilePath` are the highest-value candidates for unit tests.

**`viewRenderers.ts` shared rendering functions are untested:**
- What's not tested: `renderCalendarGrid` and `renderAgendaList` in `src/utils/viewRenderers.ts` — these are the shared rendering functions used by embedded views.
- Files: `src/utils/viewRenderers.ts`
- Risk: DOM rendering regressions in embedded calendar/agenda code blocks go undetected.
- Priority: Medium.

---

## Missing Critical Features

**No accessibility support (keyboard navigation, ARIA roles):**
- Problem: Calendar day cells, navigation buttons, and agenda event items are all plain `div` elements with click handlers. There are no `role`, `tabindex`, or `aria-*` attributes beyond `aria-label` on the two nav icon buttons.
- Blocks: Keyboard-only users and screen-reader users cannot interact with the plugin.
- Files: `src/views/CalendarView.ts`, `src/utils/viewRenderers.ts`, `src/views/EmbeddedCalendarView.ts`, `src/views/EmbeddedAgendaView.ts`

**No debouncing on settings changes that trigger calendar refreshes:**
- Problem: `saveSettings()` in `src/main.ts` immediately calls `refreshCalendarView()` on every save. Several settings UI inputs in `SettingsTab.ts` call `saveSettings()` on each keystroke (e.g., the calendar URL text input). This can trigger multiple concurrent network fetches during typing.
- Files: `src/main.ts`, `src/settings/SettingsTab.ts`
- Blocks: Users on metered or slow connections may experience excessive network usage while editing calendar settings.

---

*Concerns audit: 2026-05-09*
