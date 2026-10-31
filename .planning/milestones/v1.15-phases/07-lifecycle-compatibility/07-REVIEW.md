---
phase: 07-lifecycle-compatibility
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/main.ts
  - src/services/CalendarService.ts
  - src/settings/SettingsTab.ts
  - src/utils/colorValidation.ts
  - src/utils/viewRenderers.ts
  - src/views/CalendarView.ts
  - src/views/EmbeddedAgendaView.ts
  - src/views/EmbeddedCalendarView.ts
  - eslint.config.mjs
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-15
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 7 directives DIR-05 (view-in-registerView memory leak), DIR-06 (popout-window compatibility via `activeDocument` / `window.*` timers), DIR-07 (`instanceof TFile` narrowing), and DIR-08 (floating-promise + async-onload hygiene) are correctly implemented at the rule level — `npm run lint` exits zero, the Phase 7 override block in `eslint.config.mjs` is gone, every `as TFile` cast has been replaced with `instanceof TFile`, `document.documentElement` is exclusively `activeDocument.documentElement`, all timer calls use the `window.*` prefix per A2, and both `EmbeddedCalendarView` / `EmbeddedAgendaView` now expose a synchronous `onload(): void` wrapper around an inner async `loadAndRender()`. The plugin field `calendarView` is gone, the `registerView` callback is a pure factory, and `onunload` no longer calls `detachLeavesOfType` per A1.

Three quality defects survived the lint pass:

1. **`EmbeddedCalendarView` navigation handlers (`void this.navigate()` / `void this.goToToday()`) silently swallow render errors** — violates D-09's stated default of `.catch(error => new Notice(errorMessage(error)))` for ambiguous floating-promise sites. The sister inner-helper `loadAndRender()` has a try/catch + Notice; `navigate()` and `goToToday()` do not, so a network failure on a user-clicked Prev/Today/Next button produces a silent unhandled rejection instead of a Notice.
2. **`handleDragEnd` async function is bound and stored in a void-returning field, then passed to `window.addEventListener`** — the field's declared type `((e: MouseEvent) => void) | undefined` erases the actual `Promise<void>` return, which is exactly the misused-promise shape but lint can't see through the field type. If `saveSettings` rejects during a drag-end, the rejection is unhandled.
3. **`maybeBackgroundRefresh` staleness guard compares against `this.currentDate.getTime()` AFTER `goToToday` has already mutated `this.currentDate`** — the captured `targetTime` is the value AT call-site, so the guard works for the navigate→navigate race, but the dedup path in `CalendarService.fetchCalendars` (`fetchInFlight`) can hand the SAME promise to a `forceRefresh=true` caller and a previous `forceRefresh=false` caller. If the in-flight fetch was started for a stale-cache refresh and the user clicks "Force refresh," they receive the stale-fetch result without honoring `forceRefresh`. Pre-Phase-7 behavior but surfaced again by reading the lifecycle changes around it.

The Critical bucket is empty: no security defects, no data-loss paths, no unhandled crash paths surfaced by the Phase 7 diff.

## Warnings

### WR-01: Embedded calendar navigation buttons swallow render errors via `void`

**Files:** `src/views/EmbeddedCalendarView.ts:128, 134, 140`
**Issue:**
The three navigation button handlers use `void this.navigate(-1)` / `void this.goToToday()` / `void this.navigate(1)`. Each of these methods does `await this.render()`, which in turn awaits `this.plugin.calendarService.fetchCalendars(...)`. `fetchCalendars` swallows network errors internally (via `performFetch`'s try/catch), but `render()` itself can throw on DOM operations (e.g., if `this.container` was detached between renders). Any error after the `await` propagates to the `void` operator and becomes a silent unhandled promise rejection. Per D-09, the default for ambiguous floating-promise sites is `.catch(error => new Notice(errorMessage(error)))` — not `void`. The neighboring `eventEl` click handler in `EmbeddedAgendaView.ts:357-360` follows this exact pattern. The inner `loadAndRender()` wrapper added by D-10 has a try/catch + Notice for the same reason — the three navigation handlers bypass that wrapper.

User-visible failure mode: click Prev/Today/Next on an embedded calendar code block, render throws, no Notice fires, user sees stale calendar with no feedback.

**Fix:**
```ts
prevButton.addEventListener("click", () => {
  this.navigate(-1).catch((error) => new Notice(errorMessage(error)));
});

todayButton.addEventListener("click", () => {
  this.goToToday().catch((error) => new Notice(errorMessage(error)));
});

nextButton.addEventListener("click", () => {
  this.navigate(1).catch((error) => new Notice(errorMessage(error)));
});
```

Or, more uniformly, route navigate/goToToday through the same `loadAndRender`-style wrapper that `onload()` uses — extract a `private safeNavigate(delta)` / `private safeGoToToday()` helper that does the try/catch + Notice and have the click handlers call it.

---

### WR-02: `handleDragEnd` async function is silently coerced to void-returning listener

**Files:** `src/views/CalendarView.ts:32, 219, 1177, 1198, 1202`
**Issue:**
`private handleDragEnd(e: MouseEvent)` is declared `async` and returns `Promise<void>`. At line 219, its bound form is stored in `handleDragEndBound` which is typed `((e: MouseEvent) => void) | undefined` (line 32). The bind() result is `(e: MouseEvent) => Promise<void>`, but TypeScript permits assignment to a `void`-returning function type, and the field's declared type erases the Promise return for downstream lookups. This is exactly the misused-promise shape `@typescript-eslint/no-misused-promises` is designed to catch, but the rule can't see through the field-type declaration.

Concrete consequence:
- `window.addEventListener("mouseup", this.handleDragEndBound!)` (line 1177) wires an async function as a DOM listener. The DOM ignores the returned promise.
- `handleDragEnd` body: `await this.snapToCurrentViewMode()` → `await this.plugin.saveSettings()` (line 1230). If `saveData` fails (vault adapter error, disk full, etc.), the rejection is unhandled. The user sees the drag complete visually but the new `calendarHeight` is never persisted, with no Notice and no console error from the user-facing path. Next plugin reload re-applies the OLD height.

Same shape applies to `handleDragMoveBound` on line 218, but `handleDragMove` is sync — no actual mismatch there. Only `handleDragEnd` is async.

**Fix:**
Option A — keep the function async, fix the field type, add a `.catch`:
```ts
private handleDragEndBound: ((e: MouseEvent) => void) | undefined = undefined;
// In createUI():
this.handleDragEndBound = (e: MouseEvent) => {
  this.handleDragEnd(e).catch((error) =>
    new Notice(errorMessage(error))
  );
};
```

Option B — split the sync teardown from the async persist:
```ts
private handleDragEnd(e: MouseEvent): void {
  this.isDragging = false;
  this.resizeHandle.removeClass("dragging");
  window.removeEventListener("mousemove", this.handleDragMoveBound!);
  window.removeEventListener("mouseup", this.handleDragEndBound!);

  this.snapToCurrentViewMode().catch((error) =>
    new Notice(errorMessage(error))
  );
}
```

Option B is closer to D-09's "fire-and-forget at a sync boundary" pattern and matches the snake-case `loadAndRender` wrapper idiom from D-10.

---

### WR-03: `fetchInFlight` dedup ignores `forceRefresh` when an unforced fetch is already in flight

**File:** `src/services/CalendarService.ts:51-53`
**Issue:**
```ts
if (this.fetchInFlight) {
  return this.fetchInFlight;
}
```

The dedup check happens BEFORE the `forceRefresh` parameter is consulted. Concrete race:

1. User navigates a month — `CalendarView.navigate()` → `maybeBackgroundRefresh()` → `fetchCalendars(sources, /* forceRefresh */ false)`. `fetchInFlight` is set to a Promise that will perform a stale-cache (unforced) fetch.
2. Within ~100–500ms, user clicks the "Force refresh calendars" command — `refreshCalendarView(true)` → `view.refreshEvents(true)` → `fetchCalendars(sources, true)`.
3. The forced call hits the dedup check and is handed the in-flight UNFORCED promise. `forceRefresh=true` is silently dropped.

Failure modes this enables:
- User edits a calendar URL, saves settings (which triggers an unforced refresh via the auto-refresh restart), then clicks "Force refresh" expecting the NEW URL list to be fetched. The dedup hands back the in-flight fetch using the OLD URL list. New URL goes unfetched until the next interval tick.
- The forced-refresh user notification (`"MemoChron: Refreshing calendars..."` in `showFetchNotification`) never fires for the second caller because they joined an existing fetch that already passed that notification gate.

Phase 7 surface (per CONTEXT.md) is lifecycle and compatibility, not the cache layer. The behavior was introduced in Phase 2 BUG-06 (D-12) and the comment block (lines 39-41, 49-53, 76-83) is explicit about deduplication. Surfaced here because reading the Phase 7 `goToToday` / `navigate` / `maybeBackgroundRefresh` flow exposes how easily the race fires now that the synchronous-render path triggers a background fetch on every user-initiated navigation.

**Fix:**
Track the in-flight Promise's `forceRefresh` value and upgrade rather than dedup when an unforced fetch is in flight but a forced one arrives:
```ts
private fetchInFlight: Promise<CalendarEvent[]> | null = null;
private fetchInFlightForced = false;

async fetchCalendars(sources: CalendarSource[], forceRefresh = false) {
  if (this.fetchInFlight && (this.fetchInFlightForced || !forceRefresh)) {
    return this.fetchInFlight;
  }
  // If a forced call arrives while an unforced fetch is in flight, do not
  // join it — the forced caller wants the LATEST URL list and a guaranteed
  // network round-trip.
  ...
  this.fetchInFlightForced = forceRefresh;
  this.fetchInFlight = this.performFetch(...).finally(() => {
    this.fetchInFlight = null;
    this.fetchInFlightForced = false;
  });
}
```

Alternatively, document the dedup behavior at the public method (`fetchCalendars`) doc-comment so callers know `forceRefresh` is best-effort, not guaranteed.

## Info

### IN-01: `EmbeddedCalendarView.handleDateClick` is declared `async` but contains no awaits

**File:** `src/views/EmbeddedCalendarView.ts:183-205`
**Issue:**
`private async handleDateClick(date: Date)` performs only sync work (calls `getEventsForEmbed` which is sync, builds an event list string, calls `new Notice(...)`). The `async` keyword is misleading — it implies the function does asynchronous work, makes callers think they need to `void`/`await` it, and unnecessarily wraps the return value in `Promise<void>`. The `void this.handleDateClick(date)` callsite on line 168 was added to satisfy D-09's no-floating-promise pattern, but that wrapping is only needed because the function is gratuitously async.

**Fix:**
Drop the `async` keyword and unwrap the callsite:
```ts
private handleDateClick(date: Date): void {
  const events = this.plugin.calendarService.getEventsForEmbed(date, this.calendarNames);
  ...
}

// In render():
(date) => this.handleDateClick(date),
```

---

### IN-02: `instanceof TFile` check on `createDailyNote` result is structurally unreachable

**Files:** `src/views/CalendarView.ts:828`, `src/views/EmbeddedCalendarView.ts:244`, `src/views/EmbeddedAgendaView.ts:393`
**Issue:**
The pattern at all three sites is:
```ts
let dailyNote = getDailyNote(momentDate, allDailyNotes);  // TFile | null
if (!dailyNote) {
  dailyNote = await createDailyNote(momentDate);  // TFile (per types)
}
if (dailyNote instanceof TFile) {
  await leaf.openFile(dailyNote);
}
```

Per `obsidian-daily-notes-interface` typings, `createDailyNote` returns `Promise<TFile>` (not `Promise<TFile | null>`). After the `if (!dailyNote)` block, `dailyNote` is `TFile` for both branches. The `instanceof TFile` check is the correct *narrowing* pattern from D-08, but here it's also defensively unreachable for the `null` case — TypeScript narrows `TFile | null` to `TFile` after the if-block. The runtime check guards against a hypothetical library typing bug, which is a fine defensive posture, but if the library returns something that isn't a TFile (or returns null when the docs say it won't), the user clicks and silently nothing happens — no Notice, no console log.

D-08 specifies the narrowing as the fix for `as TFile`. This is correct. The Info is about the silent-fail UX: when the runtime instanceof check is false, the user gets no feedback.

**Fix:**
Add an else branch that surfaces the unexpected state:
```ts
if (dailyNote instanceof TFile) {
  await leaf.openFile(dailyNote);
} else {
  console.error("MemoChron: createDailyNote returned non-TFile:", dailyNote);
  new Notice("Failed to open daily note — unexpected file type returned.");
}
```

---

### IN-03: `eslint.config.mjs` includes `manifest.json` in `allowDefaultProject` but the file is not TypeScript

**File:** `eslint.config.mjs:25, 28`
**Issue:**
```ts
parserOptions: {
  projectService: {
    allowDefaultProject: ["eslint.config.mjs", "manifest.json"],
  },
  tsconfigRootDir: import.meta.dirname,
  extraFileExtensions: [".json"],
},
```

`manifest.json` is a JSON file — typescript-eslint cannot type-check it and the `files: ["src/**/*.ts"]` selector for the rule overrides excludes it from rule application. Including it in `allowDefaultProject` + `extraFileExtensions: [".json"]` adds no observable benefit and clouds the intent of the config. Either lint manifest.json's structure with a separate JSON-aware tool, or drop both entries.

**Fix:**
```ts
parserOptions: {
  projectService: {
    allowDefaultProject: ["eslint.config.mjs"],
  },
  tsconfigRootDir: import.meta.dirname,
},
```

Pre-existing config artifact, not introduced by Phase 7. Mentioning because Phase 7 owns the eslint.config.mjs cleanup.

---

### IN-04: `dragStartY` and `dragStartHeight` fields are uninitialized

**File:** `src/views/CalendarView.ts:29-30`
**Issue:**
```ts
private dragStartY: number;
private dragStartHeight: number;
```

These fields are declared as required `number` but have no initializer. The codebase's `tsconfig.json` has `strictNullChecks: true` but not `strictPropertyInitialization: true`, so the compiler permits this. At runtime, before `handleDragStart` runs, these fields are `undefined`. If `handleDragMove` were ever invoked without a prior `handleDragStart` (e.g., a stray mousemove event during view re-render), `e.clientY - this.dragStartY` would yield `NaN`, propagating to `Math.max(100, NaN + deltaY)` = `NaN`, and `this.calendar.setCssProps({ height: "NaNpx" })` would set an invalid CSS value.

In practice, `mousemove` is only registered inside `handleDragStart` and removed in `handleDragEnd`/`onClose`, so the field is always initialized before first read. But the type contract is loose.

**Fix:**
```ts
private dragStartY = 0;
private dragStartHeight = 0;
```

Or enable `strictPropertyInitialization` in tsconfig and use the definite-assignment assertion `dragStartY!: number` if the field is guaranteed-assigned-before-first-read.

---

### IN-05: `setupAutoRefresh` reschedules timer on every `saveSettings` call regardless of interval change

**File:** `src/main.ts:130-138, 198-212`
**Issue:**
```ts
async saveSettings() {
  await this.saveData(this.settings);
  if (this.calendarService) {
    this.setupAutoRefresh();
  }
  await this.refreshCalendarView();
}
```

`setupAutoRefresh` is called on every `saveSettings()`, even when the user's change was unrelated to the refresh interval (e.g., toggling a calendar's `enabled` flag, editing a tag list, changing the note location). Each call clears the existing timer and starts a fresh one, which means the interval clock is reset every time the user touches settings. A user who saves settings frequently could perpetually delay the next refresh.

Not a Phase 7 directive violation; the pattern was established in earlier phases. Surfaced because Phase 7 reads through the timer-lifecycle code carefully and the WR-01 comment (lines 202-207) explicitly defends the `window.setInterval` choice — the reset-on-every-save side effect could be addressed in the same area.

**Fix:**
Track the last-applied interval and skip the reschedule if unchanged:
```ts
private lastAppliedRefreshInterval: number | null = null;

private setupAutoRefresh() {
  if (this.refreshTimer !== null && this.lastAppliedRefreshInterval === this.settings.refreshInterval) {
    return;
  }
  this.clearRefreshTimer();
  const intervalMs = this.settings.refreshInterval * 60 * 1000;
  this.lastAppliedRefreshInterval = this.settings.refreshInterval;
  this.refreshTimer = window.setInterval(
    () => { void this.refreshCalendarView(); },
    intervalMs
  );
}
```

---

_Reviewed: 2026-05-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
