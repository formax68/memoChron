# Pitfalls Research

**Domain:** Obsidian plugin stabilization — Obsidian API + ical.js + luxon + TypeScript
**Researched:** 2026-05-09
**Confidence:** HIGH (code-verified for MemoChron-specific pitfalls; MEDIUM for Obsidian API edge-cases sourced from official docs + forum)

---

## Critical Pitfalls

### Pitfall 1: `new Date("YYYY-MM-DD")` parses as UTC midnight, not local midnight

**What goes wrong:**
`parseDateFromFilename` in `viewRenderers.ts` (lines 444–447) calls `new Date(dateStr)` where `dateStr` is `"2026-01-15"`. Per the ECMAScript spec, a date-only ISO string is parsed as UTC midnight. In any timezone west of UTC (UTC-1 through UTC-12), that UTC midnight is the *previous calendar day* in local time. So `parseDateFromFilename("2026-01-15.md")` returns a `Date` whose `.getDate()` is `14` for a user in New York — the calendar renders the widget on the wrong day.

The same pattern appears in `parseDate` line 410: `const date = new Date(input)` — any ISO date-string fallback goes through UTC parsing.

**Why it happens:**
Developers expect `new Date("2026-01-15")` to behave like `new Date(2026, 0, 15)` (local noon). The JS spec deliberately treats ISO date-only strings as UTC, but ISO datetime strings (`"2026-01-15T00:00:00"`) use *local* time. This asymmetry is a long-standing spec quirk confirmed in MDN.

**How to avoid:**
Replace every `new Date(isoDateString)` that is meant to represent a local calendar date with the local-time constructor form:
```typescript
// Instead of: new Date("2026-01-15")
// Use: new Date(2026, 0, 15)  // month is 0-indexed
// Or use the ISO-with-time form to force local parse:
// new Date("2026-01-15T00:00:00")
```
In `parseDateFromFilename`, after extracting `year`, `month`, `day` integers, always call `new Date(year, month - 1, day)` — never `new Date(isoString)`.

**Warning signs:**
- BUG-01 symptom: embedded calendar shows the selected day's events on the day *before* the filename date for users in UTC-N timezones
- No visible error — `Date.getTime()` returns a valid value; only `.toDateString()` gives the wrong day
- Works correctly on machines set to UTC (CI, developer in London) but fails for users in the Americas

**Requirement:** BUG-01
**Blocks:** YES — do not implement ENH-05 (`{{day}}` / `{{month}}` variables) or ENH-02 (has-note indicator) until this is confirmed fixed; both depend on correct local-date resolution.

---

### Pitfall 2: `getStartOfWeek` produces wrong results for Saturday first-day with a date already on Saturday

**What goes wrong:**
The formula in `CalendarView.getStartOfWeek` (line 392):
```typescript
const diff = d.getDate() - day + (day < firstDay ? -7 : 0) + firstDay;
```
When `firstDayOfWeek = 6` (Saturday) and the current date is itself a Saturday (`day = 6`): `day < firstDay` is `6 < 6 = false`, so `diff = d.getDate() - 6 + 0 + 6 = d.getDate()` — correct. But when `firstDayOfWeek = 6` and the current date is a Sunday (`day = 0`): `0 < 6 = true`, so `-7` is applied, jumping back to the *previous* Saturday — also correct. The real failure is when `firstDayOfWeek = 6` and date is any day Mon–Fri: `day < firstDay` is `true` for Mon(1)–Fri(5), so all of them jump back 7 days, landing on the *previous* Saturday instead of the *current* week's Saturday. A user who opens MemoChron on a Wednesday with Saturday-start sees last week's Saturday as the week start.

**Why it happens:**
The formula was designed with Sunday-start (0) and Monday-start (1) in mind. For those values it works because `0` and `1` are the smallest valid non-negative day values. Saturday (6) is the edge case where nearly the entire week has `day < firstDay`.

**How to avoid:**
Use the normalized modular form, which handles all first-day values without special cases:
```typescript
private getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const firstDay = this.plugin.settings.firstDayOfWeek; // 0–6
  const day = d.getDay(); // 0 = Sun
  // Offset of current day from week start, in [0, 6]
  const offset = ((day - firstDay) + 7) % 7;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}
```
This formula is correct for all `firstDay` values without conditionals.

**Warning signs:**
- BUG-05 symptom: week-view rows show wrong dates; today's date lands in the wrong week
- Only triggered when user explicitly sets first day to Saturday in settings — the default Monday start masks this bug

**Requirement:** BUG-05
**Blocks:** YES — bad week-start produces wrong event groupings and Today navigation misbehavior on top of BUG-03

---

### Pitfall 3: Live settings reference pattern breaks if `loadSettings` is ever called after initial load

**What goes wrong:**
`NoteService` is constructed with `this.settings` at plugin load (`main.ts:38`). `loadSettings` uses `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())`, which creates a *new object* and assigns it to `this.settings`. The service holds a reference to the old object. Today this is benign only because `saveSettings` mutates the existing `this.settings` object in-place rather than replacing it. The moment any refactor adds a second `loadSettings()` call (e.g., responding to vault sync, or hot-reload in dev mode), `NoteService` silently reads stale date formats, templates, and note paths.

**Why it happens:**
Passing `this.settings` passes the object reference at that moment. TypeScript gives no warning when the plugin later reassigns `this.settings` to a different object.

**How to avoid:**
Pass a getter lambda so `NoteService` always reads the live settings object:
```typescript
// main.ts
this.noteService = new NoteService(this.app, () => this.settings);

// NoteService constructor
constructor(private app: App, private getSettings: () => MemoChronSettings) {}

// Usage inside NoteService — replace `this.settings` with `this.getSettings()`
const settings = this.getSettings();
```
Or simply pass `this` (the plugin instance) and access `plugin.settings` directly.

**Warning signs:**
- TD-02: no immediate symptom in v1.13.1 because `loadSettings` is only called once
- Silent failure: notes are created with wrong date format or in wrong folder after a settings-reload event that doesn't exist yet — impossible to reproduce in testing
- Warning sign during code review: any `const s = this.settings;` captured at construction time in a service

**Requirement:** TD-02
**Blocks:** NO — current behavior is safe; flag for the refactor PR

---

### Pitfall 4: `onunload` does not cancel the 100ms background-refresh `setTimeout`

**What goes wrong:**
`CalendarService.scheduleBackgroundRefresh` (line 185) fires `setTimeout(() => this.fetchCalendars(sources, true), 100)` with no stored ID. If the user disables the plugin within 100ms of a cold-cache load (uncommon but reproducible on slow devices), the callback fires after `onunload`, calling `this.plugin.settings` on a detached plugin instance. On desktop this produces a silent console error; on iOS the Obsidian app has crashed in similar scenarios with `undefined is not an object` when accessing a torn-down plugin's settings.

The 50ms `setTimeout` in `CalendarView.onOpen` (line 59) has the same issue: if the view is closed while the timer is pending, `recalculateViewModeFromHeight` runs on a detached DOM node.

**Why it happens:**
`setTimeout` IDs are discarded because the developer assumed the delay was too short to matter. This is true on a loaded desktop but false on a cold mobile start or under Obsidian's hot-reload cycle.

**How to avoid:**
```typescript
// CalendarService — store the ID:
private bgRefreshTimer: ReturnType<typeof window.setTimeout> | null = null;

scheduleBackgroundRefresh(sources: CalendarSource[]) {
  if (this.bgRefreshTimer !== null) window.clearTimeout(this.bgRefreshTimer);
  this.bgRefreshTimer = window.setTimeout(() => {
    this.bgRefreshTimer = null;
    this.fetchCalendars(sources, true);
  }, 100);
}

// Expose for plugin cleanup:
cancelPendingRefresh() {
  if (this.bgRefreshTimer !== null) {
    window.clearTimeout(this.bgRefreshTimer);
    this.bgRefreshTimer = null;
  }
}
```
In `main.ts onunload`, call `this.calendarService.cancelPendingRefresh()` before clearing the interval timer. For the `CalendarView` 50ms timer, store it and clear in `onClose()`.

**Warning signs:**
- TD-03: console error `Cannot read properties of undefined (reading 'calendarUrls')` after plugin disable
- On iOS: hard crash with no stack trace
- Reproducible: disable plugin immediately after opening Obsidian for the first time

**Requirement:** TD-03
**Blocks:** YES for mobile — crashes on iOS are user-visible; must be fixed before any beta release

---

### Pitfall 5: Drag resize listeners on `window` are never cleaned up on iOS

**What goes wrong:**
`CalendarView.handleDragStart` (line 1055) calls `window.addEventListener("mousemove", ...)` and `window.addEventListener("mouseup", ...)`. On iOS, `mousemove` and `mouseup` do not fire for touch interactions — the drag handle becomes non-functional, but more critically: if the view is destroyed while a drag is in progress (layout change, plugin reload), the `window` listeners remain attached permanently because `handleDragEnd` never fires. On iOS the issue is doubled: touch events (`touchmove`/`touchend`) are needed, but they are also attached to `window` and never cleaned.

**Why it happens:**
The drag was implemented for desktop mouse. Touch support was not added. `window` listeners survive view teardown because they are not registered through `this.registerDomEvent()` and there is no `onClose()` override that removes them.

**How to avoid:**
1. Add `onClose()` override in `CalendarView` that defensively calls `handleDragEnd` or directly removes the listeners
2. Add touch event counterparts (`touchstart`, `touchmove`, `touchend`) — or hide the drag handle on mobile with `Platform.isMobile`
3. Store bound handlers and remove them on `onClose`:
```typescript
onClose() {
  window.removeEventListener("mousemove", this.handleDragMoveBound);
  window.removeEventListener("mouseup", this.handleDragEndBound);
  window.removeEventListener("touchmove", this.handleTouchMoveBound);
  window.removeEventListener("touchend", this.handleTouchEndBound);
}
```

**Warning signs:**
- TD-04 symptom: drag handle appears but nothing moves on iOS
- Memory leak symptom on desktop: old `mousemove` handlers fire after view is re-opened (double-move effect)
- Detectable by adding `console.log` inside `handleDragMove` and opening/closing the view repeatedly — count increases

**Requirement:** TD-04
**Blocks:** YES for mobile drag UX; SHOULD fix before releasing any ENH that adds new drag interactions

---

### Pitfall 6: `innerHTML` SVG injection with unvalidated color is flagged during Obsidian plugin directory review

**What goes wrong:**
`SettingsTab.ts` lines 589 and 675 inject `currentColor` directly into an SVG attribute via template literal innerHTML. The Obsidian plugin review team explicitly flags `innerHTML` usage, and the plugin review guidelines state that `innerHTML` should be replaced with DOM API calls or `sanitizeHTML`. A color value loaded from persisted `data.json` (e.g., from a synced vault) with value `">` would break out of the SVG attribute and inject arbitrary HTML into the settings page.

**Why it happens:**
Color values come from `<input type="color">` which enforces `#rrggbb` format in normal UI usage. The developer correctly assumed user-typed values are safe, but did not account for the data.json round-trip path (sync, manual edit, migration).

**How to avoid:**
Add a one-line guard before any `innerHTML` write:
```typescript
const safeColor = /^#[0-9a-fA-F]{6}$/.test(currentColor) ? currentColor : "#7c3aed";
// Then build the SVG element programmatically instead of innerHTML:
const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
// ... set attributes via setAttribute(), not template literals
```
Apply the same regex guard at `loadSettings` time so invalid persisted values are sanitized on read, not just on display.

**Warning signs:**
- SEC-01: any `innerHTML` containing a variable from `this.plugin.settings` will fail the automated linting pass in the Obsidian community plugin review PR
- `sanitizeHTML` from the Obsidian API is available as an alternative to DOMPurify if the SVG element approach is not worth the refactor

**Requirement:** SEC-01
**Blocks:** YES for official directory submission — Obsidian reviewer automation flags `innerHTML` with variables

---

### Pitfall 7: `error.message` access in catch blocks throws a second exception on non-Error throws

**What goes wrong:**
`CalendarView.ts:939`: `new Notice(\`Failed to import: ${error.message}\`)` — if `error` is a string (e.g., `throw "network timeout"`) or a plain object, `error.message` is `undefined` and the `Notice` shows "Failed to import: undefined". Worse: if strict null checks ever cause a runtime exception on `.message` access, the catch block itself throws, leaving the user with no feedback and a silent failure.

**Why it happens:**
TypeScript's `catch` block types `error` as `unknown` in strict mode but `any` in older configs. With `any`, accessing `.message` compiles without error even if the value is not an Error object at runtime.

**How to avoid:**
Apply the consistent helper pattern at every catch site:
```typescript
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
// Usage:
catch (error) {
  new Notice(`Failed to import: ${toMessage(error)}`);
  console.error("Failed to import ICS file:", error);
}
```
Add this helper to `src/utils/constants.ts` or a new `src/utils/errors.ts` and import at all six catch sites identified in CONCERNS.md.

**Warning signs:**
- SEC-02: grep for `.message` inside `catch` blocks — any hit that does not first check `instanceof Error` is a bug
- `new Notice("...undefined")` in production logs from beta testers is a reliable indicator

**Requirement:** SEC-02
**Blocks:** NO for functionality; YES for Obsidian review (TypeScript errors-as-any is a quality flag)

---

## Mobile-Specific Pitfalls

### M-1: `mousemove`/`mouseup` on `window` are no-ops on iOS — drag handle is dead

This is covered above (Pitfall 5) but deserves explicit mobile callout: the resize drag handle sends zero `mousemove` events on iOS because the touch event model does not synthesize mouse events during drag on an element that has `preventDefault()` called in `touchstart`. The drag handle widget will appear in the UI but do nothing on any iOS device. There is no graceful degradation today.

**Prevention:** `Platform.isMobile` check to hide/disable the drag handle on mobile, or implement a `touchstart`/`touchmove`/`touchend` counterpart. Given this is a stabilization milestone (not feature work), hiding the handle on mobile via CSS `display: none` when `Platform.isMobile` is the minimal-risk fix.

**Requirement:** TD-04

---

### M-2: `requestUrl` proxy on iOS may return cached 304 responses that appear as empty event lists

**What goes wrong:**
Obsidian's `requestUrl()` routes through a proxy on mobile to bypass CORS. On iOS, the proxy layer has been observed to return a 304-Not-Modified with no body for calendar URLs that have not changed. `CalendarService.fetchCalendars` currently does not check the HTTP status code — it passes the response body to `ical.js` unconditionally. An empty body produces a parse error that is caught and swallowed, resulting in an empty calendar view with no user notification.

**Why it happens:**
The concurrent-fetch guard (BUG-06) and the 304 case are independent failure modes. The developer assumed `requestUrl` always returns the full body.

**How to avoid:**
After `await requestUrl(...)`, check `response.status`:
```typescript
const response = await requestUrl({ url: source.url });
if (response.status === 304 || !response.text) {
  // Return cached events; do not attempt parse
  return this.events;
}
```
This is especially important on iOS where network conditions make 304 responses more frequent.

**Warning signs:**
- BUG-06 is triggered on iOS far more often than desktop because mobile networks have higher latency and more caching layers
- Symptom: calendar appears empty after refresh on iPhone but shows correct events on desktop with the same calendar URL

**Requirement:** BUG-06

---

### M-3: `window.moment` global access fails silently on iOS if daily notes plugin is unloaded

`CalendarView.renderWeekNumber` (line 469) and `EmbeddedAgendaView.handleDailyNoteClick` (line 358) access `(window as any).moment`. On iOS, if the user has disabled the Daily Notes core plugin, `window.moment` may be undefined, and the week number column shows `?` with no explanation. The `handleDailyNoteClick` path has a guard, but week numbers do not.

**Prevention:** This is a fragility noted in CONCERNS.md. For this milestone, confirm the `?` fallback at line 470 is acceptable (it currently is) and add no additional regression. The refactor to a shared utility wrapper is deferred per PROJECT.md scope decisions.

**Requirement:** (no direct requirement — observation only, impacts ENH-01 indirectly if today indicator relies on moment for week comparisons)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Pass `this.settings` directly to service constructor | Simple, no indirection | Silent stale reads after any future `loadSettings()` call | Never — use getter lambda instead (TD-02) |
| Raw `window.setTimeout` with no stored ID | Less boilerplate | Uncleanable timer fires after plugin unload; crash on mobile | Never for timers that outlive a single synchronous stack frame |
| `window.addEventListener` for drag without cleanup | Shorter code | Leaked listeners accumulate on each view open/close cycle | Never on elements that can be re-created |
| Skip 304 check after `requestUrl` | Simpler code | Empty parse on mobile; silent empty calendar | Never — HTTP status check is one line |
| `new Date("YYYY-MM-DD")` for filename parsing | Concise | Off-by-one day for all UTC-N users | Never when result is used for local calendar date display |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ical.js `Time.toJSDate()` | Assuming it always returns local time — it returns UTC for UTC-marked times, and local-zone for floating times | Check `isAllDay` and `tzid` before deciding which conversion path; `convertIcalTimeToDate` already handles this but the fallback path (line 182) uses local constructor for floating — verify this matches ical.js contract |
| Obsidian `vault.getAbstractFileByPath()` | Assuming path lookup is case-sensitive | On macOS (HFS+) and iOS (APFS default), the filesystem is case-insensitive; `"Meeting.md"` and `"meeting.md"` map to the same file — `getAbstractFileByPath("Meeting.md")` may return a `TFile` whose `.path` is `"meeting.md"`. ENH-02 (has-note indicator) must normalize paths before comparing. |
| Obsidian `vault.on("rename", ...)` | Not registering the rename event — note indicator stays stale forever | `NoteService.getExistingEventNote` calls `getAbstractFileByPath` on each call, so it re-resolves the path dynamically. This is correct. ENH-02's has-note indicator must use the same live lookup, not a cached boolean. |
| BRAT `manifest.json` in release assets | Uploading `manifest.json` from the repo root (which may have an older version) instead of the freshly-built artifact | Build artifacts must include an updated `manifest.json` matching the exact release tag. BRAT reads `manifest.json` from the release assets to determine version; a mismatch causes the plugin to install silently with the wrong version number and BRAT stops offering updates. |
| Obsidian `openFile` + `setCursor` | Calling `editor.setCursor()` synchronously after `leaf.openFile()` — the editor is not yet attached | `leaf.openFile()` resolves before the CodeMirror editor is mounted. Must wait for `app.workspace.onLayoutReady` callback or use a `requestAnimationFrame`/`setImmediate` tick before `getActiveViewOfType(MarkdownView)?.editor.setCursor(pos)` |
| luxon `DateTime.fromObject` with DST-gap times | Passing a wall-clock time that doesn't exist (e.g., 2:30 AM on spring-forward day in a given zone) — `dt.isValid` is `false` but no exception is thrown | `convertIcalTimeToDate` already checks `dt.isValid` (line 213) and logs a warning + falls back. The fallback uses local-constructor which produces an approximate time. For this milestone, document the fallback behavior rather than attempting to resolve DST-gap ambiguity. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| ENH-02 has-note lookup calls `getAbstractFileByPath` for every agenda event on every render | Agenda re-render freezes momentarily with 50+ events; worse on mobile | Compute a `Set<string>` of normalized existing note paths once per render cycle, not per event | At ~50+ visible agenda events |
| ENH-03 calendar-grid has-note indicator calls `NoteService.getExistingEventNote` per day cell during `renderCalendar` | Calendar grid render stalls with 31 × N_calendars path lookups on month navigation | Pre-compute a `Set<string>` of existing note paths at the start of `renderCalendar`, share it across day cells | At 3+ calendars × 31 days = 90+ lookups |
| `CalendarView.refreshEvents` calls `fetchCalendars` on every `saveSettings` call | Each keystroke in calendar URL input triggers a network request | BUG-06 fix (concurrent-fetch guard) partially mitigates; `needsRefresh` short-circuits if cache is fresh — do not remove this guard | Immediately on any settings change |
| `viewRenderers.renderCalendarGrid` creates a new `Set` of enabled sources on every day cell | Small overhead individually, multiplies with day count | Compute the enabled source ID set once before the loop | Unlikely to matter at 31 days; note for future ENH with week-based widgets |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `innerHTML` with `currentColor` variable in `SettingsTab.ts:589,675` | XSS via malicious `data.json` (synced vault attack vector); plugin directory submission rejection | Validate color against `/^#[0-9a-fA-F]{6}$/` before any innerHTML write; prefer `createElementNS` for SVG construction (SEC-01) |
| `error.message` access on `unknown` catch variable | Second exception in catch block hides original failure; `Notice` shows "undefined" | Use `error instanceof Error ? error.message : String(error)` at every catch site (SEC-02) |
| Template variable substitution via `RegExp` on user-controlled strings | A calendar name containing `$` or regex metacharacters in the `replace` pattern could corrupt template output | `applyTemplateVariables` in `NoteService` uses `replace(new RegExp(...), value)` — ensure `value` is treated as a literal string; use `() => value` as the replacer function, not raw string replacement, to prevent `$&` / `$$` / `$1` injection in the replacement value |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Adding `today` CSS class without explicit specificity ordering against `selected` | If `.memochron-day.selected` and `.memochron-day.today` have the same specificity, the last-declared rule wins — themes or snippets may override both unpredictably | Define `.memochron-day.today` and `.memochron-day.today.selected` as explicit compound selectors in `styles.css`; the compound selector (two classes) has higher specificity and wins over single-class rules from themes |
| ENH-05 `{{day}}` / `{{month}}` using `Date.toLocaleDateString` with `'en-US'` locale hardcoded | Users with non-English system locales get English day/month names even when they expect their locale's names | Since the project defers full i18n, use a hardcoded English array (the same pattern already in `getFolderTemplateVariables` lines 428–465) — it is predictable and consistent, and makes clear that localization is deferred |
| ENH-06 `{{cursor}}` marker: stripping the marker from note content but placing cursor at wrong line | Cursor placed at line 0 instead of where `{{cursor}}` was in the template | After `vault.create(path, content)`, open the file, search for the marker string position, remove it with `editor.replaceRange`, then call `editor.setCursor` — all in a single async chain after the leaf is ready |
| ENH-04 NL date format `DD-MM-YYYY` ambiguity with existing UK format `DD/MM/YYYY` (hyphenated) | Users selecting "NL" format could get the same output as "UK hyphenated" — no clear distinction | Add a discriminator: NL format should use the separator `DD-MM-YYYY` (period-delimited) if differentiation matters, or document that "NL" and "UK hyphenated" are aliases and surface them as one option |
| `viewMode` dropdown not syncing after drag-resize | Today button navigates to the wrong week-count view; apparent "jump" confuses users | BUG-03: after `handleDragEnd` + `snapToCurrentViewMode`, explicitly update the dropdown's displayed value to match `this.viewMode` |

---

## "Looks Done But Isn't" Checklist

- [ ] **BUG-01 fix:** Verify that `parseDateFromFilename` uses `new Date(year, month-1, day)` (local), NOT `new Date("YYYY-MM-DD")` (UTC). Test with a machine set to `TZ=America/New_York`.
- [ ] **ENH-02 has-note indicator:** Verify that renaming a note in the vault causes the indicator to disappear from the agenda (i.e., `getExistingEventNote` is called per-render, not cached).
- [ ] **ENH-02 on macOS:** Verify that the indicator appears even when the note filename uses different casing than the expected path (HFS+ case-insensitive lookup).
- [ ] **TD-03 timeout cleanup:** Verify that disabling the plugin while the calendar is loading does not produce console errors. Test by clicking the plugin toggle immediately after Obsidian startup.
- [ ] **TD-04 drag cleanup:** Verify that opening and closing the calendar sidebar 10 times does not accumulate duplicate `mousemove` listeners (check DevTools Event Listeners panel on `window`).
- [ ] **SEC-01 color guard:** Verify that setting `color` in `data.json` to `"red; background: url(x)"` and reopening Obsidian does not inject HTML into the settings page.
- [ ] **ENH-01 today indicator:** Verify that `today` class is present on the correct cell AND that the `selected` class on today's cell does not visually override the today indicator (both indicators must be simultaneously visible).
- [ ] **ENH-05 template variables:** Verify that `{{month}}` emits `"January"` not `"0"` for January (month array is 0-indexed, name array must be accessed with the raw index, not with `month + 1`).
- [ ] **BRAT release:** Verify that `manifest.json` in the GitHub release asset matches the git tag version exactly. Confirm BRAT can install the pre-release by adding the repo URL fresh and checking the installed version.
- [ ] **ENH-06 cursor placement:** Verify that `editor.setCursor()` is called *after* `await leaf.openFile()` AND after at least one microtask tick (e.g., inside a `requestAnimationFrame` callback). Calling it synchronously after `openFile` resolves produces a no-op.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| BUG-01 ships with UTC parse — wrong-day events | HIGH (user data: notes created on wrong day) | Provide a migration notice; notes created on the wrong day cannot be auto-corrected. Add a one-time detection check: if the embedded calendar is rendered with `this.file.name` and the selected date is different from today's local date, show a notice. |
| TD-04 drag listener leak ships to users | MEDIUM | Leaked listeners accumulate silently; a plugin disable+enable cycle clears them. Push a patch release; no user data is corrupted. |
| SEC-01 innerHTML ships with color injection | HIGH (if in community directory) | Obsidian will block the PR; fix required before merge. If already shipped to BRAT users, the attack requires a malicious `data.json` — low probability but warrants immediate patch release. |
| ENH-05 `{{month}}` emits wrong name (0-indexed off-by-one) | HIGH (all notes created with template will have wrong month name in filename or frontmatter) | Emit a migration guide; affected notes require manual rename. |
| ENH-06 cursor placement is a no-op | LOW | No data corruption — cursor just lands at line 0. Patch fix is async chain adjustment. |
| BRAT version mismatch in release | MEDIUM | BRAT users see wrong version; plugin auto-update breaks. Re-publish the release with corrected manifest.json as a release asset; BRAT re-fetches on next check. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Requirement | Prevention Phase | Verification |
|---------|-------------|------------------|--------------|
| UTC midnight parse in `parseDateFromFilename` | BUG-01 | BUG-01 fix PR | Manual test with `TZ=America/New_York node -e "console.log(new Date('2026-01-15').toDateString())"` outputs Jan 14 — confirm fix shows Jan 15 |
| `getStartOfWeek` Saturday edge case | BUG-05 | BUG-05 fix PR | Set `firstDayOfWeek=6`, navigate to a Monday — week row must start on previous Saturday |
| `NoteService` stale settings reference | TD-02 | TD-02 refactor PR | Code review: confirm `NoteService` constructor receives a getter, not a direct object |
| Untracked `setTimeout` calls fire after unload | TD-03 | TD-03 lifecycle PR | Toggle plugin off immediately after Obsidian open — no console errors |
| Drag listener leak on `window` | TD-04 | TD-04 lifecycle PR | Open/close CalendarView 5 times; check `window` event listeners — count must not grow |
| `innerHTML` with unvalidated color | SEC-01 | SEC-01 security PR | Set color in data.json to `"><img src=x onerror=alert(1)>` — confirm no alert on settings open |
| `error.message` on non-Error | SEC-02 | SEC-02 security PR | `throw "string error"` in a test path — Notice must show the string, not "undefined" |
| ENH-02 has-note lookup perf | ENH-02/ENH-03 | ENH-02 implementation PR | Profile agenda render with 100 events; no stall >50ms |
| ENH-02 stale after vault rename | ENH-02 | ENH-02 implementation PR | Rename a note that corresponds to an event; indicator must disappear immediately |
| ENH-05 off-by-one month name | ENH-05 | ENH-05 implementation PR | Create a note with `{{month}}` in January; filename/frontmatter must contain "January" |
| `setCursor` timing after `openFile` | ENH-06 | ENH-06 implementation PR | New note must open with cursor at `{{cursor}}` position, not line 0 |
| BRAT manifest version mismatch | release | Release checklist | Fresh BRAT install shows version matching git tag; no "version mismatch" notice in BRAT log |

---

## Sources

- [Obsidian Plugin Guidelines — innerHTML rejection policy](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Obsidian Views API — never manage references to views; use detachLeavesOfType in onunload](https://docs.obsidian.md/Plugins/User+interface/Views)
- [Obsidian registerDomEvent — required for window/document listeners to ensure cleanup](https://docs.obsidian.md/Reference/TypeScript+API/Component/registerDomEvent)
- [MDN Date constructor — date-only ISO strings are parsed as UTC](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date)
- [Luxon DST boundary handling — fromObject with invalid times returns isValid: false, no exception](https://github.com/moment/luxon/blob/master/docs/zones.md)
- [Luxon issue #914 — ambiguous DST times with fromObject](https://github.com/moment/luxon/issues/914)
- [BRAT plugin forum — manifest.json must be in release assets, not read from HEAD](https://forum.obsidian.md/t/cant-make-a-plugin-to-work-on-brat/84369)
- [BRAT issue #81 — version source of truth is release asset manifest, not repo manifest](https://github.com/TfTHacker/obsidian42-brat/issues/81)
- [Obsidian calendar plugin CSS — today/selected CSS specificity discussion](https://github.com/liamcain/obsidian-calendar-plugin/discussions/281)
- [Obsidian "not able to prevent event on mobile" — mousemove/mouseup suppressed on iOS](https://forum.obsidian.md/t/not-able-to-prevent-event-on-mobile/93217)
- [Vault.rename path case collision on Windows](https://forum.obsidian.md/t/vault-rename-doesnt-handle-path-case-collision-on-windows/90449)
- [DEV Community — JavaScript date off-by-one complete guide](https://dev.to/zachgoll/a-complete-guide-to-javascript-dates-and-why-your-date-is-off-by-1-day-fi1)
- MemoChron source code review: `src/utils/viewRenderers.ts`, `src/views/CalendarView.ts`, `src/services/NoteService.ts`, `src/services/CalendarService.ts`, `src/utils/timezoneUtils.ts`, `src/main.ts`
- MemoChron `.planning/codebase/CONCERNS.md` — codebase audit 2026-05-09

---
*Pitfalls research for: MemoChron Obsidian plugin — stabilization milestone*
*Researched: 2026-05-09*
