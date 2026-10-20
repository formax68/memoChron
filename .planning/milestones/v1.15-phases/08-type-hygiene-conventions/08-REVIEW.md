---
phase: 08-type-hygiene-conventions
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - eslint.config.mjs
  - src/main.ts
  - src/services/CalendarService.ts
  - src/services/IcsImportService.ts
  - src/services/NoteService.ts
  - src/settings/SettingsTab.ts
  - src/settings/types.ts
  - src/types/ical.d.ts
  - src/utils/constants.ts
  - src/utils/pathUtils.ts
  - src/utils/timezoneUtils.ts
  - src/utils/viewRenderers.ts
  - src/views/CalendarView.ts
  - src/views/EmbeddedAgendaView.ts
  - src/views/EmbeddedCalendarView.ts
findings:
  critical: 2
  warning: 7
  info: 8
  total: 17
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 8 closes the v1.15 directory-scorecard for type hygiene (DIR-09/DIR-10), console gating (DIR-01), and documentation (DOC-02). The mechanical work is sound: the `DEBUG = false` gate pattern is correctly dead-code-eliminated by esbuild's tree-shaker in production builds, and `(window as any).moment` has been fully replaced with the typed `import { moment } from "obsidian"`. The `**/*.d.ts no-explicit-any: off` and the `src/**/*.ts no-unsafe-*: off` overrides are scoped narrowly enough.

However, the review surfaces two **Critical** behavioral defects that ride on the explicit-any/unsafe cascade — both pre-date Phase 8 but become more visible now that `no-unsafe-*` is silenced and the surface looks clean. There are also seven **Warnings** flagging error-visibility regressions from the DIR-01 console cleanup (Plan 03), narrow ical.js consumption sites that lost runtime validation when the `no-unsafe-*` block went in, and one logic bug in attendee filtering.

The `no-unsafe-*` override block in Plan 04 is scoped to `src/**/*.ts` (not the whole project) and the ical.js consumption sites have basic runtime validation in most places — but two sites (`isValidCache` cache deserialization and `getEventsForEmbed` source filtering) have gaps that the lint silence now hides.

## Critical Issues

### CR-01: `getEventsForEmbed` / `getAllEventsForEmbed` bypass `enabled` filter when `calendarNames` is provided

**File:** `src/services/CalendarService.ts:140-161`, `src/services/CalendarService.ts:168-189`

**Issue:** When a `memochron-agenda` or `memochron-calendar` code block names calendars explicitly via the `calendars:` parameter, the filtering logic walks only the case-insensitive name match:

```ts
if (calendarNames && calendarNames.length > 0) {
  const lowerNames = calendarNames.map((n) => n.toLowerCase());
  filteredEvents = filteredEvents.filter((event) =>
    lowerNames.includes(event.source.toLowerCase())
  );
}
```

The `else` branch correctly filters by `source.enabled && source.showInEmbeds !== false`, but the `calendarNames` branch does NOT consult `source.enabled` at all. Events from a calendar that the user has explicitly DISABLED in settings still render in any embed that names that calendar.

This breaks the documented invariant ("Disable a calendar to stop fetching/showing its events") and is a privacy regression — a user who disables a sensitive work calendar to hide it on a shared screen will still see its events in an embedded code block. Note that `this.events` may still contain the disabled calendar's events from the last fetch before disabling (cache-write doesn't purge events when a source flips off; see CalendarService.performFetch which only re-fetches from `enabledSources`, but `hasSourceMismatch` lazily re-fetches on the next call — until then, stale events remain).

**Fix:** Intersect both filters in the `calendarNames` branch:

```ts
if (calendarNames && calendarNames.length > 0) {
  const lowerNames = calendarNames.map((n) => n.toLowerCase());
  const enabledNames = new Set(
    this.plugin.settings.calendarUrls
      .filter((s) => s.enabled)
      .map((s) => s.name.toLowerCase())
  );
  filteredEvents = filteredEvents.filter((event) => {
    const lowered = event.source.toLowerCase();
    return lowerNames.includes(lowered) && enabledNames.has(lowered);
  });
}
```

Apply the same fix to `getAllEventsForEmbed` (lines 168-189).

---

### CR-02: `isValidCache` accepts malformed event payloads, leading to silent event loss

**File:** `src/services/CalendarService.ts:317-324`, `src/services/CalendarService.ts:326-334`

**Issue:** The cache validator only verifies `timestamp: number` and `events: Array`. After Plan 02 migrated the cast to `cache: unknown` (good), the inner shape of `cache.events` is still untrusted:

```ts
private isValidCache(cache: unknown): cache is CacheData {
  if (!cache || typeof cache !== "object") return false;
  const c = cache as Record<string, unknown>;
  return (
    typeof c.timestamp === "number" &&
    Array.isArray(c.events)
  );
}
```

`restoreFromCache` then iterates blindly:

```ts
cache.events.forEach((event) => {
  event.start = new Date(event.start);   // new Date("garbage") => Invalid Date
  event.end = new Date(event.end);
});
this.events = cache.events;
```

A corrupted, partially-written, or downgrade-incompatible `calendar-cache.json` (the cache file lives under `.obsidian/plugins/memochron/calendar-cache.json` and survives plugin updates) yields `Invalid Date` values for `start`/`end`. Every downstream date comparison (`event.start <= endOfDay`, `event.end >= startOfDay`, `event.end < now`) silently evaluates `false` because `NaN` comparisons return `false`. Result: the user sees zero events, no error notice, no console message (the catch on line 302 is `DEBUG`-gated and `DEBUG = false` in production). The user has no path to recover except to delete the cache file manually.

This is a data-loss-shaped bug (loss of visibility, not corruption) made worse by Plan 03's console cleanup, because the cache-decode failure path went from `console.log(...)` to `if (DEBUG) console.debug(...)` — there is now NO production diagnostic when the cache deserializes badly.

**Fix:** Validate per-event shape and reject the cache instead of silently using bad data:

```ts
private isValidCache(cache: unknown): cache is CacheData {
  if (!cache || typeof cache !== "object") return false;
  const c = cache as Record<string, unknown>;
  if (typeof c.timestamp !== "number") return false;
  if (!Array.isArray(c.events)) return false;
  return c.events.every((e) => {
    if (!e || typeof e !== "object") return false;
    const ev = e as Record<string, unknown>;
    return (
      typeof ev.id === "string" &&
      typeof ev.title === "string" &&
      typeof ev.source === "string" &&
      typeof ev.sourceId === "string" &&
      (typeof ev.start === "string" || ev.start instanceof Date) &&
      (typeof ev.end === "string" || ev.end instanceof Date) &&
      !isNaN(new Date(ev.start as string | Date).getTime()) &&
      !isNaN(new Date(ev.end as string | Date).getTime())
    );
  });
}
```

Additionally, the `catch (error)` on CalendarService.ts:301-302 should at minimum log unconditionally (not `DEBUG`-gated) when the cache file exists but fails to deserialize — silent recovery is fine for "no cache file" but not for "cache file is broken."

---

## Warnings

### WR-01: Per-calendar `filteredCuTypes` overrides cannot express "include nothing"

**File:** `src/services/CalendarService.ts:810-813`

**Issue:** The override falls back to the global default using `||`, not `??`:

```ts
const filteredCuTypes =
  (calendarSettings?.filteredCuTypes) ||
  this.plugin.settings.filteredCuTypes;
```

If a user customizes a calendar to filter out ALL attendee CUTYPEs (an empty array `[]`), the `||` operator coerces `[]`... wait — `[]` is truthy in JS, so `[] || X` returns `[]`. So this is actually safe for the empty-array case. BUT: if a user clears the per-calendar override and the stored value is `null` from a migration, the global wins — which is probably desired. The bigger latent bug is that `IcsImportService.extractAttendees` (line 106) uses `||` against `["INDIVIDUAL", ""]` as the hardcoded default, meaning a caller passing an empty array intentionally gets the default applied. This is inconsistent with CalendarService's behavior and surprising at a call site that no longer has TypeScript safety help.

**Fix:** Use `??` consistently in both places, and document that empty array means "include nothing":

```ts
// CalendarService.ts
const filteredCuTypes =
  calendarSettings?.filteredCuTypes ?? this.plugin.settings.filteredCuTypes;

// IcsImportService.ts
const cuTypeFilter = filteredCuTypes ?? ["INDIVIDUAL", ""];
```

---

### WR-02: DIR-01 console cleanup silently swallows non-403/404 calendar fetch errors

**File:** `src/services/CalendarService.ts:386-392`, `src/services/CalendarService.ts:402-415`

**Issue:** Plan 03's `if (DEBUG) console.error(...)` gating means that in production builds (`DEBUG = false`), the following error paths produce ZERO user-visible or developer-visible output:

1. Line 387-391 (`else` branch for non-403/404 HTTP failure): the body is `if (DEBUG) console.error(...)`. A 500, 502, 503, 401, 429, etc., now produces neither a Notice nor a console line. The user sees their calendar silently fail to refresh.
2. Line 405: `if (DEBUG) console.error('Error fetching calendar ...', message);` — runs only when DEBUG is true. The function then checks `message.includes('CORS')` and `message.includes('network')` to show specific Notices, but EVERY other thrown error (e.g., "ERR_CERT_AUTHORITY_INVALID", "ETIMEDOUT", "ENOTFOUND") produces no Notice and no console output.

The Phase-3 SUMMARY notes 33 console statements were deleted and 6 gated — but these two were gated, not surfaced as Notices. The result is a regression from "noisy logs the user can grep for" to "completely silent failure."

**Fix:** Add a generic fallback Notice for unmatched error categories, and unconditionally log the error so developers diagnosing user reports can ask the user to check the dev console:

```ts
// fetchCalendar catch block
} catch (error) {
  const message = errorMessage(error);
  console.error(`MemoChron: Failed to fetch calendar "${source.name}":`, message);

  if (message.includes('CORS')) {
    new Notice(`MemoChron: Calendar "${source.name}" blocked by CORS policy.`);
  } else if (message.includes('network')) {
    new Notice(`MemoChron: Network error fetching calendar "${source.name}".`);
  } else {
    new Notice(`MemoChron: Failed to fetch calendar "${source.name}". Check console for details.`);
  }
  return [];
}
```

Apply equivalent treatment to the non-403/404 status branch on line 387-391. The DIR-01 rule prohibits *unconditional* console statements, but error paths should still surface to the user — the appropriate fix is a Notice, not a DEBUG-gated console call.

---

### WR-03: `fetchInFlight` deduplication ignores source-set changes mid-fetch

**File:** `src/services/CalendarService.ts:55-87`

**Issue:** The in-flight short-circuit (BUG-06/D-12) runs BEFORE the source-mismatch check:

```ts
if (this.fetchInFlight) {
  return this.fetchInFlight;
}
// ...
if (!this.needsRefresh(enabledSources, forceRefresh)) {
  return this.events;
}
```

If caller A starts a fetch with sources `[X, Y]`, and while it's running the user adds calendar `Z` in settings (triggering `saveSettings → refreshCalendarView → fetchCalendars(newSources)`), caller B with sources `[X, Y, Z]` receives caller A's in-flight promise — which only fetches `[X, Y]`. The mismatch will be detected on the NEXT `fetchCalendars` call (via `hasSourceMismatch`), but the user-triggered refresh appears to "do nothing" — the Notice shows complete with the OLD event count.

Worse, the `Notice` on completion (`showCompletionNotification`) reports `this.events.length` — which is the count from caller A's fetch, not caller B's expected fetch. If the user added a calendar with 100 events, the Notice still shows the old count.

**Fix:** Detect the source-set change and chain a follow-up fetch after the in-flight one settles, or invalidate the in-flight cache for `forceRefresh=true`:

```ts
async fetchCalendars(
  sources: CalendarSource[],
  forceRefresh = false
): Promise<CalendarEvent[]> {
  // If the caller forces a refresh OR the source set differs from what's in flight,
  // do not dedupe — start a fresh fetch chained after the in-flight one settles.
  if (this.fetchInFlight && !forceRefresh && !this.hasSourceMismatch(
    sources.filter((s) => s.enabled && s.url?.trim())
  )) {
    return this.fetchInFlight;
  }
  // ... rest as before
}
```

---

### WR-04: `restoreFromCache` mutates input then aliases — surprising data ownership

**File:** `src/services/CalendarService.ts:326-334`

**Issue:** The method mutates `cache.events[i].start` and `.end` IN PLACE (converting string → Date), then aliases `this.events = cache.events`. The caller is `loadFromCache`, which returns `cacheData.events` — the same array now mutated. If a future refactor caches `cacheData` (e.g., to keep a reference for round-trip diffing), the cached object becomes inconsistent with the file on disk: the on-disk `start`/`end` are ISO strings, the in-memory cache has them as `Date` objects pretending to be the same.

This is also fragile to a partial cache read: if `JSON.parse` succeeds but a subset of events have malformed `start` values, `new Date(invalid)` produces `Invalid Date` and we hit CR-02's silent-loss path.

**Fix:** Build a fresh array, validate each event, and reject the cache rather than mutate:

```ts
private restoreFromCache(cache: CacheData): boolean {
  const restored: CalendarEvent[] = [];
  for (const event of cache.events) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    restored.push({ ...event, start, end });
  }
  this.events = restored;
  this.lastFetch = cache.timestamp;
  return true;
}
```

---

### WR-05: Code duplication: location-icon logic exists in 4 places, drift risk

**File:** `src/utils/viewRenderers.ts:332-336`, `src/views/EmbeddedAgendaView.ts:363-367`, `src/views/CalendarView.ts:883-897`, `src/services/NoteService.ts:341-359`

**Issue:** The same regex-based location classification (URL → 🔗, virtual meeting keywords → 💻, else 📍) is duplicated in four files with subtle variations:

- `viewRenderers.ts:332-336`: regex literal `^(https?:\/\/|www\.)` and `zoom|meet\.|teams|webex` (case-insensitive flag).
- `EmbeddedAgendaView.ts:363-367`: identical to viewRenderers, separately defined.
- `CalendarView.ts:883-897`: split across `getLocationIcon`/`isUrl`/`isVirtualMeeting`, uses `toLowerCase()` and `Array.some` instead of the regex flag.
- `NoteService.ts:341-359`: `getLocationEmoji`/`isUrl`/`isVirtualMeeting` — substantially the same logic but the keyword list `["zoom", "meet.", "teams", "webex"]` is duplicated again as a local const.

If a future change adds "google.meet" or "discord" to the virtual-meeting list, four sites need synchronized edits. Phase 8 silenced the `no-unsafe-*` ical cascade, but did not address this earlier-flagged duplication. The Phase-8 mechanical cleanup work makes this duplication MORE visible because the surrounding code now lints clean — drift becomes the dominant maintenance risk.

**Fix:** Extract a single `getLocationIcon(location: string): string` into `src/utils/locationIcons.ts` (or extend `viewRenderers.ts`) and have all four call sites import it. Same for `parseTags` (duplicated in `SettingsTab` line 1268 and `CalendarNotesSettingsModal` line 1718).

---

### WR-06: `IcsImportService` does not unregister VTIMEZONE components — global service pollution

**File:** `src/services/IcsImportService.ts:25-34`

**Issue:** `parseSingleEvent` registers every VTIMEZONE component from the dropped ICS file into ical.js's `TimezoneService`, which is a **global singleton**. The comment notes "Silently ignore: timezone may already be registered" but nothing ever unregisters. A user who drags multiple ICS files with conflicting custom VTIMEZONE definitions (e.g., two corporate calendars with their own "Customized Time Zone" rules) gets whichever was registered first — subsequent registrations either silently fail (per the catch) or override depending on ical.js internals.

This is the same root cause as the `TimezoneService.reset()` need flagged in `ical.d.ts` (line 69). `reset()` exists in the type shim but is never called.

**Fix:** Either (a) call `TimezoneService.reset()` and re-register from the parsed `comp` at the start of each `parseSingleEvent`, accepting the cost of losing previously-registered zones; OR (b) namespace registered zones with a per-file prefix to avoid collisions; OR (c) document this as a known limitation in the user-facing docs. Option (a) is safest:

```ts
static parseSingleEvent(...) {
  // ...
  const vtimezones = comp.getAllSubcomponents("vtimezone");
  // Note: leaves CalendarService's registrations intact since CalendarService
  // does not call register() — only IcsImportService does. If that ever changes,
  // both services need a coordinated reset strategy.
  vtimezones.forEach((tz) => { try { TimezoneService.register(tz); } catch { /* ... */ } });
}
```

The minimum acceptable fix is a code comment documenting that VTIMEZONE registrations leak across imports. The current "silently ignore" comment understates the issue.

---

### WR-07: External link in help modal lacks `rel="noopener"`

**File:** `src/settings/SettingsTab.ts:1934-1938`

**Issue:**
```ts
const link = docLink.createEl("a", {
  text: "View full documentation on GitHub",
  href: "https://github.com/formax68/memoChron#remote-calendars",
});
link.setAttr("target", "_blank");
```

`target="_blank"` without `rel="noopener noreferrer"` allows the opened tab to navigate the opener via `window.opener.location` (reverse-tabnabbing). In Electron with `nodeIntegration` disabled this is partially mitigated, but Obsidian renders external links via the system browser and the rendered HTML still sets `window.opener`. Best practice is to set `rel`.

**Fix:**

```ts
link.setAttr("target", "_blank");
link.setAttr("rel", "noopener noreferrer");
```

---

## Info

### IN-01: Unused exports in `src/utils/constants.ts`

**File:** `src/utils/constants.ts:6,17-26,29-37`

**Issue:** Several exports have no callers anywhere in `src/`:
- `DEFAULT_VIEW` (line 6) — never imported.
- `CALENDAR_COLOR_PALETTE` (lines 17-26) — never imported.
- `CUTYPE_INDIVIDUAL`, `CUTYPE_GROUP`, `CUTYPE_RESOURCE`, `CUTYPE_ROOM`, `CUTYPE_UNKNOWN` (lines 29-33) — never imported as constants; the actual strings are inlined in `SettingsTab.ts:1041-1047`.
- `DEFAULT_FILTERED_CUTYPES` (line 37) is the only CUTYPE constant used externally.

Phase 8's DIR-10 work closed 18 `no-unused-vars` sites, but unused exports require `tsc --noUnusedLocals` + `--noUnusedParameters` (and even then, exports aren't flagged) or a tool like `ts-prune`. Leftover dead exports inflate the public surface and tempt future drift (a new contributor may use `CUTYPE_ROOM` from constants while the existing checkbox UI uses an inlined `"ROOM"` — three months later they're different strings).

**Fix:** Delete `DEFAULT_VIEW` and `CALENDAR_COLOR_PALETTE`. Replace the inlined `"INDIVIDUAL"`/`"GROUP"`/etc. strings in `SettingsTab.ts:1041-1047` with the constants — or delete the unused constants.

---

### IN-02: Per-file `const DEBUG = false` declarations are out of sync risk

**File:** `src/services/CalendarService.ts:17`, `src/utils/timezoneUtils.ts:7`

**Issue:** Plan 03 introduced `const DEBUG = false` independently in two files. The same flag controls different diagnostic outputs in different modules. A developer debugging a calendar issue who flips `CalendarService.ts:17` to `true` will get fetch/cache logs but no timezone logs unless they also remember to flip `timezoneUtils.ts:7`. Conversely, leaving one accidentally at `true` ships verbose logs in a release build.

**Fix:** Centralize into `src/utils/debug.ts`:

```ts
// Single source of truth for forensic-only logging.
// Production builds: flag must be `false`. esbuild tree-shakes `if (DEBUG) ...`.
export const DEBUG = false;
```

Then import in both consumers. The build-time elimination still works because the import resolves to a module-level `const` initializer.

---

### IN-03: `viewRenderers.getReorderedWeekdays` silently breaks on out-of-range `firstDayOfWeek`

**File:** `src/utils/viewRenderers.ts:226-229`

**Issue:**

```ts
function getReorderedWeekdays(firstDay: number): string[] {
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return [...weekdays.slice(firstDay), ...weekdays.slice(0, firstDay)];
}
```

If `firstDay` is `7` (or any out-of-range value), `slice(7)` returns `[]` and `slice(0, 7)` returns the full array — so the function happens to round-trip and produce a valid week. But if `firstDay = -1` or `firstDay = NaN`, `slice` semantics differ and the rendered weekdays misalign with the day grid. The settings dropdown clamps to 0-6 (`SettingsTab.ts:101-109`), so today there is no path to a bad value — but settings restored from a corrupted `data.json` (the same threat model as SEC-01's color validation in `main.ts:110-121`) could inject a bad number.

**Fix:** Clamp at the function boundary:

```ts
function getReorderedWeekdays(firstDay: number): string[] {
  const fd = Math.max(0, Math.min(6, Math.floor(firstDay) || 0));
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return [...weekdays.slice(fd), ...weekdays.slice(0, fd)];
}
```

Apply the same clamp to `CalendarView.getReorderedWeekdays` (line 508-512) and `getMonthInfo`/`getStartOfWeek` (they all consume `firstDayOfWeek`).

---

### IN-04: `getEnabledSourcesForCache` filter differs from elsewhere

**File:** `src/services/CalendarService.ts:361-365`

**Issue:** Fetch logic filters with `source.enabled && source.url?.trim()` (lines 60, 198). The cache-write writes only `source.enabled`:

```ts
private getEnabledSourcesForCache() {
  return this.plugin.settings.calendarUrls
    .filter((source) => source.enabled)
    .map((source) => ({ url: source.url, name: source.name }));
}
```

This embeds enabled-but-blank-URL entries in `cache.sources`. The current `isValidCache` does not check `cache.sources` at all (see CR-02), so this is silently inert today — but if a future validator starts comparing `cache.sources` against current settings, the asymmetry will produce false positives.

**Fix:** Apply the same filter:

```ts
.filter((source) => source.enabled && source.url?.trim())
```

---

### IN-05: `SettingsTab.renderRefreshInterval` silently truncates fractional input

**File:** `src/settings/SettingsTab.ts:850-880`

**Issue:** `parseInt(value)` on `"5.5"` returns `5`. The validator reports valid, the truncated value is saved. The user has no indication their `0.5`-minute precision was lost. Probably benign for refresh intervals (minute-granularity is sensible) but inconsistent with the validation message "Refresh interval must be a number" — `"abc"` is rejected but `"5.5min"` is silently accepted as `5`.

**Fix:** Use `Number(value)` and check `Number.isInteger`:

```ts
const interval = Number(value);
if (!Number.isInteger(interval) || interval <= 0) {
  return { valid: false, error: "Refresh interval must be a positive whole number of minutes" };
}
```

---

### IN-06: Duplicate folder-template variable construction logic

**File:** `src/services/NoteService.ts:471-533`, `src/settings/SettingsTab.ts:1185-1251`

**Issue:** `NoteService.getFolderTemplateVariables` and `SettingsTab.generatePreviewPath` build the same `{YYYY, YY, MM, M, MMM, MMMM, DD, D, DDD, DDDD, Q, source, event_title}` lookup table. The month-names and day-names arrays are duplicated literally. A future change adding `WW` (week-of-year) or `H`/`HH` (hour) needs synchronized edits to two places, and the settings-preview will silently fall behind the runtime.

**Fix:** Extract `getFolderTemplateVariables(date: Date, source: string, event_title: string)` into `src/utils/folderTemplate.ts` and call from both sites.

---

### IN-07: `CalendarView.checkDailyNoteForDate` swallows non-existent-plugin errors

**File:** `src/views/CalendarView.ts:153-167`

**Issue:**

```ts
private checkDailyNoteForDate(date: Date): boolean {
  if (!appHasDailyNotesPluginLoaded()) return false;
  try {
    const momentDate = moment(date);
    const allDailyNotes = getAllDailyNotes();
    const dailyNote = getDailyNote(momentDate, allDailyNotes);
    return dailyNote !== null;
  } catch {
    return false;
  }
}
```

If `getAllDailyNotes()` throws (e.g., due to a malformed Daily Notes plugin config that leaves a TFile that's actually a folder, or an invalid moment format string), every grid cell silently reports "no daily note exists" and the indicator dot disappears. The user sees a calendar that LOOKS correct but has lost data. The DIR-01 cleanup turned what was probably a `console.warn` into a silent catch.

This is called once per visible day per render (e.g., 35-42 times per renderCalendar). Throwing once per call is fine, but unconditionally returning `false` hides legitimate state.

**Fix:** Cache the all-daily-notes lookup at render start and log once:

```ts
private dailyNotesCache: Record<string, TFile> | null = null;

private refreshDailyNotesCache(): void {
  if (!appHasDailyNotesPluginLoaded()) {
    this.dailyNotesCache = null;
    return;
  }
  try {
    this.dailyNotesCache = getAllDailyNotes() as Record<string, TFile>;
  } catch (error) {
    console.error("MemoChron: Failed to load daily notes:", errorMessage(error));
    this.dailyNotesCache = null;
  }
}

private checkDailyNoteForDate(date: Date): boolean {
  if (!this.dailyNotesCache) return false;
  try {
    const momentDate = moment(date);
    return getDailyNote(momentDate, this.dailyNotesCache) !== null;
  } catch {
    return false;
  }
}
```

Call `refreshDailyNotesCache()` at the start of `renderCalendar()`. This both improves performance (one `getAllDailyNotes()` per render instead of one per day cell) AND surfaces the error path once.

---

### IN-08: `ical.d.ts` still uses `any` despite Phase 8's no-explicit-any closure

**File:** `src/types/ical.d.ts:3,8,12,59,72`

**Issue:** The Phase 8 plan correctly excluded `.d.ts` files from the `no-explicit-any` rule (`eslint.config.mjs:69-71`), and the shim contains:

```ts
constructor(jCal: any);
getFirstPropertyValue(name: string): any;
getFirstValue(): any;
static fromData(data: any): Timezone;
export function parse(input: string): any;
```

These remain `any`. The Phase 8 SUMMARY notes hand-typing is deferred to FRAG-02. That's acceptable, but the cost is that the `src/**/*.ts no-unsafe-*: off` override silences the cascade across the entire `src/` tree — not just at ical-consumption sites. Any future developer can call any method on any value and the lint will be silent. The exclusion is broader than necessary.

The escape hatch is to do per-call-site `// eslint-disable-next-line` comments, but that's noisy. A middle ground: type each ical.js export's return value as `unknown` rather than `any` in the shim, forcing consumers to narrow at call sites:

```ts
getFirstPropertyValue(name: string): unknown;
getFirstValue(): unknown;
export function parse(input: string): unknown;
```

This trades a one-time wave of narrowing work for permanent runtime safety on every cache/calendar deserialization (see CR-02). The current trade-off is "no FRAG-02 yet, so accept silence everywhere" — a `unknown`-based shim would let Phase 8 close fully without the broad `src/**/*.ts` override.

**Fix:** Either follow through with FRAG-02 hand-typing on the ~6 ical.js APIs actually consumed, or replace `any` with `unknown` in `ical.d.ts` and remove the `src/**/*.ts no-unsafe-*: off` override block from `eslint.config.mjs:82-91`.

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
