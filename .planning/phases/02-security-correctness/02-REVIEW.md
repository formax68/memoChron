---
phase: 02-security-correctness
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/main.ts
  - src/services/CalendarService.ts
  - src/services/IcsImportService.ts
  - src/services/NoteService.ts
  - src/settings/SettingsTab.ts
  - src/utils/colorValidation.ts
  - src/utils/errors.ts
  - src/utils/timezoneUtils.ts
  - src/views/CalendarView.ts
  - src/views/EmbeddedAgendaView.ts
  - src/views/EmbeddedCalendarView.ts
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 02 set out to harden SEC-01 (color XSS), SEC-02 (catch normalization), BUG-05 (`getStartOfWeek` correctness verification), and BUG-06 (fetch in-flight guard). The implementation lands the four targeted fixes correctly:

- `isValidColor()` whitelist is anchored, narrow, and re-applied at load-time in `main.ts:110-127`.
- SVG color swatches in `SettingsTab.buildColorSwatch()` are constructed via `createElementNS` and `setAttribute`, structurally immune to markup injection.
- All `catch (error)` blocks reviewed use `errorMessage(error)` rather than interpolating the unknown directly.
- `getStartOfWeek()` formula is correct (spot-checked at 2024-01-01 with various `firstDayOfWeek` values, including year-boundary cases).
- `fetchInFlight` Promise-coalescing in `CalendarService.fetchCalendars()` correctly deduplicates concurrent callers and is cleared via `.finally`.

However, the review found two **BLOCKER** issues that directly undermine the Phase 02 mandate:

1. **CR-01** — `CalendarUrlHelpModal` in `SettingsTab.ts` contains five `innerHTML = "..."` assignments, exactly the sink class SEC-01 was supposed to eliminate. These five lines weren't touched by Phase 02 because the strings are currently hardcoded literals, but they are real, exploitable `innerHTML` sinks. The codebase-wide "no innerHTML" hygiene the SEC-01 hardening implies is violated.
2. **CR-02** — The `fetchInFlight` guard at line 51-53 returns the in-flight Promise **regardless of `forceRefresh`**. A user clicking "Force refresh" while a background fetch is in flight gets the OLD non-forced result. This is a correctness bug in the BUG-06 hardening itself.

Additionally, there are gaps in the in-flight guard's coverage of the cache-loading window, an unused `convertTimezone` import, a missing bounds check on `firstDayOfWeek`, and the previously-acknowledged-but-still-extant `addEventListener` usages in the view layer. None of these were introduced by Phase 02, but the BUG-06 guard gap is a near-miss the phase should have caught.

## Critical Issues

### CR-01: `innerHTML` assignments in `CalendarUrlHelpModal` violate SEC-01 hardening

**File:** `src/settings/SettingsTab.ts:1863, 1880, 1901, 1902, 1903`
**Issue:** Five direct `innerHTML = "..."` assignments are present in the help modal. Although today the right-hand-side strings are hardcoded ASCII literals (so there is no immediate exploit), the SEC-01 phase plan explicitly closes off `innerHTML` as a sink. Leaving these in place re-opens the same class of bug the phase was meant to eliminate, and any future refactor that interpolates a user-controlled value (e.g. calendar name) into these strings becomes an XSS the linter cannot warn on. The `dangerouslySetInnerHTML`-equivalent pattern is exactly what SEC-01 promised to remove from this codebase, and the project CLAUDE.md says "Use Obsidian APIs ... instead of direct DOM manipulation when possible."
**Fix:** Replace each `createEl("li").innerHTML = "..."` with the `createEl + createEl("strong")` pattern already used elsewhere in this file:
```typescript
// Before:
gcalSteps.createEl("li").innerHTML = "Copy the <strong>Secret address in iCal format</strong>";

// After:
const li = gcalSteps.createEl("li");
li.appendText("Copy the ");
li.createEl("strong", { text: "Secret address in iCal format" });
```
Apply this transformation to all five sites: 1863, 1880, 1901, 1902, 1903.

### CR-02: `fetchInFlight` guard ignores `forceRefresh`, returning stale promise to force-refresh callers

**File:** `src/services/CalendarService.ts:51-53`
**Issue:** `fetchCalendars(sources, forceRefresh)` checks `if (this.fetchInFlight) return this.fetchInFlight;` before inspecting `forceRefresh`. Scenario:
1. Auto-refresh timer fires at T=0, starts a non-forced fetch. `fetchInFlight` is set.
2. The user clicks "Force refresh calendars" at T=0.5s while the prior fetch is still in flight.
3. The forced call enters `fetchCalendars(..., true)`, sees `fetchInFlight`, returns it immediately.
4. The user sees only the non-forced result and no "Refresh complete" notice (because `showCompletionNotification` only fires for `forceRefresh` callers, and that decision is baked into the in-flight `performFetch` invocation).

This defeats the user-facing semantics of the "Force refresh" command. It also means the BUG-06 fix introduced a new bug (silent forced-refresh swallowing) while fixing the double-fetch race.
**Fix:** When the in-flight promise was non-forced and the new caller requests force, either chain a forced fetch after it, or skip the guard for forced callers. The simpler approach:
```typescript
async fetchCalendars(
  sources: CalendarSource[],
  forceRefresh = false
): Promise<CalendarEvent[]> {
  // Only deduplicate when the new caller doesn't need a stronger refresh
  // than what's already in flight. Forced callers always get a fresh fetch.
  if (this.fetchInFlight && !forceRefresh) {
    return this.fetchInFlight;
  }
  // ... rest unchanged
}
```
This trades the "two concurrent forced refreshes both run" edge case for correct user-facing behavior. If even that edge case must be eliminated, store `forceRefresh` alongside the in-flight promise and reuse only when the in-flight fetch was already forced.

## Warnings

### WR-01: `fetchInFlight` guard does not cover the cache-loading window

**File:** `src/services/CalendarService.ts:51-83`
**Issue:** The guard at line 51 only checks `fetchInFlight`, which is set on line 80 — **after** the awaited `loadFromCache()` call on line 65. Two near-simultaneous callers can both enter the cache path, both await `loadFromCache()` (the second sees `isLoadingCache=true` and returns `[]` immediately), and the second falls through to start a real fetch while the first schedules a background refresh. The double-render race BUG-06 was supposed to eliminate is narrowed but not closed.
**Fix:** Set `fetchInFlight` at the top of `fetchCalendars` to a deferred promise representing the entire computation (including cache-load and the `needsRefresh` short-circuit), and resolve/reject it from the various return points. Or, simpler, also early-return when `isLoadingCache` is true:
```typescript
if (this.fetchInFlight || this.isLoadingCache) {
  if (this.fetchInFlight) return this.fetchInFlight;
  // wait for cache-load to finish, then re-enter
  // ...
}
```
The simplest practical patch is to wrap the entire body in a deferred promise stored in `fetchInFlight` from the very first line.

### WR-02: `firstDayOfWeek` is read from settings without bounds-checking

**File:** `src/views/CalendarView.ts:428, 468, 531`; `src/settings/types.ts:51`
**Issue:** `settings.firstDayOfWeek` is typed as `number`, not `0|1|2|3|4|5|6`. The settings UI dropdown only offers 0-6, but a tampered `data.json` could store `7`, `-1`, or `NaN`. With `firstDay = NaN`, `getStartOfWeek` produces `diff = NaN` → `setDate(NaN)` → `Invalid Date` and the entire calendar grid silently fails to render. This is the same threat model SEC-01 covers (`data.json` tampering), so the same defense-in-depth treatment (validate on load) is consistent.
**Fix:** In `main.ts:loadSettings`, after the color validation block, clamp `firstDayOfWeek`:
```typescript
if (!Number.isInteger(this.settings.firstDayOfWeek) ||
    this.settings.firstDayOfWeek < 0 ||
    this.settings.firstDayOfWeek > 6) {
  console.warn(
    `MemoChron: Invalid firstDayOfWeek "${this.settings.firstDayOfWeek}" — replacing with default.`
  );
  this.settings.firstDayOfWeek = DEFAULT_FIRST_DAY_OF_WEEK;
}
```
Optionally tighten the type to a numeric union.

### WR-03: `defaultColorForIndex` formula diverges from `getNextAvailableColor` for non-additive cases

**File:** `src/utils/colorValidation.ts:36-39` vs `src/settings/SettingsTab.ts:537-542`
**Issue:** `defaultColorForIndex(index)` uses `(index * 137.5) % 360` where `index` is the calendar's array index. `getNextAvailableColor()` uses `(usedColors * 137.5) % 360` where `usedColors = calendarUrls.length` (i.e. the index a NEW calendar will receive). These align when assigning the next color to a new calendar, but `loadSettings` calls `defaultColorForIndex(index)` for the calendar AT that index. If a user has 3 calendars and the middle one (index 1) has its color invalidated and replaced, it will receive hue `137.5`, but if the same calendar had been originally created, it would have received hue `137.5` too. So it's actually consistent — but the documentation comment "Mirrors getNextAvailableColor()" is misleading because the inputs are conceptually different. Cosmetic but adds confusion for the next reader.
**Fix:** Either rename the parameter for clarity or update the comment:
```typescript
/**
 * Compute a deterministic default color for a calendar source at the given index.
 * Uses the same golden-angle formula as getNextAvailableColor() — passing the
 * calendar's array index yields the color that calendar would have received
 * if it had been created at that slot.
 */
```

### WR-04: `loadFromCache` swallows JSON parse errors as "no cache found"

**File:** `src/services/CalendarService.ts:289-306`
**Issue:** Any error in `readCacheFile` (including `JSON.parse` throwing on a corrupted cache file) is caught and logged at `console.log` level as "No cache found or cache invalid". A corrupted cache file is a different class of problem than "cache doesn't exist" — it indicates filesystem damage or a write that was interrupted — and silently logging it at `console.log` (not `error` or `warn`) makes the problem invisible. Combined with the fact that `saveToCache` will overwrite the corrupted file on the next successful fetch, the user never sees a signal that anything went wrong, but the cached events for that session may have been served from a partially-parsed file (no — actually `JSON.parse` throwing means `restoreFromCache` isn't called, but the caller cannot distinguish "first run" from "previous cache corrupted").
**Fix:** Differentiate "file not found" (expected) from "parse error" (corrupt cache):
```typescript
private async readCacheFile(): Promise<CacheData> {
  let raw: string;
  try {
    raw = await this.plugin.app.vault.adapter.read(/*...*/);
  } catch {
    // File doesn't exist — first run or fresh install.
    throw new Error("CACHE_NOT_FOUND");
  }
  try {
    return JSON.parse(raw);
  } catch (parseError) {
    console.error("MemoChron: Cache file is corrupted, will be overwritten on next fetch:", errorMessage(parseError));
    throw parseError;
  }
}
```
This keeps the silent-on-missing behavior while surfacing actual corruption.

## Info

### IN-01: Unused `convertTimezone` import in `CalendarService.ts`

**File:** `src/services/CalendarService.ts:12`
**Issue:** `convertTimezone` is imported but no longer referenced anywhere in `CalendarService`. The function is still exported from `timezoneUtils.ts` but only `convertIcalTimeToDate` is used in `CalendarService` and `IcsImportService`.
**Fix:** Remove `convertTimezone` from the import statement:
```typescript
import { convertIcalTimeToDate } from "../utils/timezoneUtils";
```
Optionally remove the `convertTimezone` export from `timezoneUtils.ts` if it has no other callers.

### IN-02: Hardcoded `3` instead of `FRONTMATTER_DELIMITER.length`

**File:** `src/services/NoteService.ts:205, 208`
**Issue:** `cleaned.substring(3)` and `cleaned.substring(0, cleaned.length - 3)` use the literal `3` to skip the `---` delimiter. If `FRONTMATTER_DELIMITER` is ever changed (unlikely, but), these will silently mis-trim.
**Fix:** Use the constant's length:
```typescript
const delim = NoteService.FRONTMATTER_DELIMITER;
if (cleaned.startsWith(delim)) {
  cleaned = cleaned.substring(delim.length);
}
if (cleaned.endsWith(delim)) {
  cleaned = cleaned.substring(0, cleaned.length - delim.length);
}
```

### IN-03: `private generatePreviewPath(template: string, event: any)` uses `any`

**File:** `src/settings/SettingsTab.ts:1182`
**Issue:** The `event` parameter is typed `any` and the call site (line 1169) passes a manually constructed object literal. The function only reads `.start`, `.title`, `.source`, so a `Pick<CalendarEvent, ...>` or local interface would suffice and would catch shape drift if `CalendarEvent` evolves.
**Fix:** Define and use a local type:
```typescript
type PreviewEvent = { start: Date; title: string; source: string };
private generatePreviewPath(template: string, event: PreviewEvent): string {
```

### IN-04: Pre-existing `addEventListener` usages in view layer

**File:** `src/views/CalendarView.ts:209, 648-650, 729, 853, 855, 923, 929, 938, 1094-1095`; `src/views/EmbeddedCalendarView.ts:116, 122, 128`; `src/views/EmbeddedAgendaView.ts:276, 337`
**Issue:** CLAUDE.md "API Usage Compliance" TODO explicitly calls out: "Replace all `addEventListener` with `this.registerDomEvent()` in CalendarView." These were already known tech debt before Phase 02 and are explicitly out of scope for this phase (which targeted SEC-01/02 + BUG-05/06), but they remain a documented violation of the project's stated patterns. Flagged here so they are not lost; the phase did not regress this state, but it also did not address it.
**Fix:** Use `this.plugin.registerDomEvent(...)` for the embedded views (which have access to `this.plugin`) and `this.registerDomEvent(...)` for `CalendarView` (which extends `ItemView` and inherits the method). Schedule in a follow-up cleanup phase, not in Phase 02 scope.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
