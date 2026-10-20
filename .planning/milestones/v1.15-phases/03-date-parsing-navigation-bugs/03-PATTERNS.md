# Phase 3: Date Parsing & Navigation Bugs - Pattern Map

**Mapped:** 2026-05-12
**Files modified (not created):** 2 source files, 5 distinct edit sites
**Analogs found:** 5 / 5 (all in-codebase, all in-file or sibling-file)

## File Classification

| Modified File / Site | Role | Data Flow | Closest Analog | Match Quality |
|----------------------|------|-----------|----------------|---------------|
| `src/utils/viewRenderers.ts` `parseDateFromFilename` (lines 418–477) — six format branches | utility / date parser | transform (string → Date) | `src/views/CalendarView.ts:494,499` (`renderMonthDays`) — same `new Date(year, month, day)` numeric constructor | exact |
| `src/utils/viewRenderers.ts:431+433` — duplicate DD-MM-YYYY regex | utility / cleanup | n/a (dead code removal) | none required — pure deletion | n/a |
| `src/views/CalendarView.ts` `navigate(delta)` (lines 314–322) | view orchestration | request-response → fire-and-forget | `CalendarService.scheduleBackgroundRefresh` (lines 192–206) — fires a deferred background fetch through a deduped path | role-match (fire-and-forget fetch with dedup) |
| `src/views/CalendarView.ts` `goToToday()` (lines 324–333) | view orchestration | request-response → fire-and-forget | `navigate(delta)` (post-D-04) — same decoupled-render contract | exact (after sibling fix) |
| `src/views/CalendarView.ts` `refreshEvents(forceRefresh)` (lines 101–118) | view orchestration | request-response | self — current shape preserved for explicit-refresh callers | exact (no change required to contract) |

## Pattern Assignments

### Site 1 — `parseDateFromFilename` six branches → local-date numeric constructor (D-01, D-02)

**Target:** `src/utils/viewRenderers.ts:418–477`

**Analog:** `src/views/CalendarView.ts:494,499` (in `renderMonthDays`)

**Why this analog:** It is the established idiom in the codebase for "I have integer year/month/day and I want a JS Date that represents that local calendar day." It is read by every month grid render, so its semantics define what a "local day" means in MemoChron. The six BUG-01 branches must produce Dates that compare equal (under `toDateString()` and `getEventsForDate`) to the dates `renderMonthDays` produces. Using the same constructor guarantees that.

**Numeric-constructor pattern** (`src/views/CalendarView.ts:490–502`):
```typescript
for (let day = 1; day <= daysInMonth; day++) {
  if (currentDayOfWeek >= 7) {
    currentDayOfWeek = 0;
    if (showWeekNumbers) {
      const currentDate = new Date(year, month, day);
      this.renderWeekNumber(grid, currentDate);
    }
  }

  const date = new Date(year, month, day);
  this.renderDay(grid, date, today);
  currentDayOfWeek++;
}
```

**Note on month arithmetic:** the analog passes `month` as already-zero-indexed (because it came from `currentDate.getMonth()`). `parseDateFromFilename` extracts a calendar month from a filename — i.e., `01..12`. The six branches must therefore convert to zero-indexed before the call: `new Date(year, month - 1, day)`. The same `month - 1` convention is used in `src/utils/timezoneUtils.ts:168,184,218,231` (every site there receives a calendar month and passes `month - 1`). That is the convention for "external numeric month → JS Date" in this codebase.

**Reference convention site** (`src/utils/timezoneUtils.ts:166–170`):
```typescript
// All-day events: ical.js gives us a date with hours/minutes/seconds = 0
// in floating-point timezone. Construct a local-time Date for the same Y/M/D.
return new Date(year, month - 1, day, 0, 0, 0);
```

**Buggy code to replace** (`src/utils/viewRenderers.ts:444–471`, six branches):

Each branch currently does one of:
```typescript
const date = new Date(dateStr);                                  // YYYY-MM-DD → UTC midnight bug
const date = new Date(dateStr.replace(/_/g, "-"));               // YYYY_MM_DD → UTC midnight bug
const date = new Date(dateStr.replace(/\./g, "-"));              // YYYY.MM.DD → UTC midnight bug
const date1 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);   // DD-MM-YYYY → UTC midnight bug
const date2 = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);   // MM-DD-YYYY → UTC midnight bug
const date = new Date(`${year}-${month}-${day}`);                // YYYYMMDD → UTC midnight bug
```

Each must become a numeric-constructor call after parsing the three integers:
```typescript
// Example for YYYY-MM-DD branch:
const [yearStr, monthStr, dayStr] = dateStr.split("-");
const year = Number(yearStr);
const month = Number(monthStr);
const day = Number(dayStr);
const date = new Date(year, month - 1, day);
if (!isNaN(date.getTime())) return date;
```

**Helper extraction (planner's call per D-02):**
If the six branches collapse repeatedly, extract a private file-local helper:
```typescript
function parseLocalDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}
```
Name + signature match the project's camelCase function naming (see `getReorderedWeekdays`, `getMonthInfo` in the same file at lines 28 and 40). Otherwise inline — both are fine per D-02.

**Code comment for BUG-04 (D-11):**
On the DD-MM-YYYY/MM-DD-YYYY branch (the one that handles `29-01-2026`), insert above the branch:
```typescript
// #56 regression closed post-#58 (and BUG-01 fix in Phase 3 — local-day construction). 29-01-2026 → 2026-01-29 local.
```
This pattern matches existing greppable BUG/issue comments in `CalendarService.ts`:
```typescript
// BUG-06 (D-12): a single in-flight Promise deduplicates concurrent callers.    (CalendarService.ts:39)
// BUG-06 (D-12): hold the in-flight promise so concurrent callers see it.       (CalendarService.ts:76)
```

---

### Site 2 — `parseDateFromFilename` duplicate regex removal (D-13)

**Target:** `src/utils/viewRenderers.ts:431,433`

**No analog needed — pure deletion.**

Current code:
```typescript
const formats = [
  /(\d{4}-\d{2}-\d{2})/,    // line 425 — YYYY-MM-DD
  /(\d{4}_\d{2}_\d{2})/,    // line 427 — YYYY_MM_DD
  /(\d{4}\.\d{2}\.\d{2})/,  // line 429 — YYYY.MM.DD
  /(\d{2}-\d{2}-\d{4})/,    // line 431 — DD-MM-YYYY
  /(\d{2}-\d{2}-\d{4})/,    // line 433 — MM-DD-YYYY (UNREACHABLE — same regex as line 431)
  /(\d{8})/,                // line 435 — YYYYMMDD
];
```

After deletion, four format branches remain in the array (the dual-parse for DD/MM disambiguation already happens *inside* the matched branch at lines 456–464, so no logic moves — only the dead array entry vanishes).

---

### Site 3 — `navigate(delta)` decouple from fetch (D-04, D-05)

**Target:** `src/views/CalendarView.ts:314–322`

**Analog:** `CalendarService.scheduleBackgroundRefresh` (`src/services/CalendarService.ts:192–206`) — the established pattern in the codebase for "trigger a background fetch *only if* the cache is stale, and rely on `fetchInFlight` dedup."

**Why this analog:** It is literally the dedup-aware fire-and-forget gate that Phase 2 D-12 introduced. Reusing the same predicate (`needsRefresh`) and the same downstream entry (`fetchCalendars`) means the background fetch from `navigate()` is automatically deduped against the auto-refresh timer.

**Dedup-aware background fetch pattern** (`src/services/CalendarService.ts:192–206`):
```typescript
private scheduleBackgroundRefresh(sources: CalendarSource[]) {
  // Only schedule a refresh if the cache has actually expired
  // This respects the refresh interval setting
  const enabledSources = sources.filter((source) => source.enabled && source.url?.trim());
  if (this.needsRefresh(enabledSources, false)) {
    // Delegate timer ownership to the plugin so the handle is cancelled
    // with window.clearTimeout in onunload (CR-01). registerInterval is
    // documented to call clearInterval at unload, which on iOS WKWebView
    // is not guaranteed to cancel a setTimeout handle.
    this.plugin.setBackgroundRefreshTimer(
      () => this.fetchCalendars(sources, true),
      100
    );
  }
}
```

**Existing `navigate` code to rewrite:**
```typescript
private async navigate(delta: number) {
  if (this.viewMode === 'month') {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
  } else {
    const weeks = this.viewMode as number;
    this.currentDate.setDate(this.currentDate.getDate() + (weeks * 7 * delta));
  }
  await this.refreshEvents();                          // ← BUG-02: this is the await that blocks paint
}
```

**Target shape** (planner's prerogative on helper extraction):
```typescript
private navigate(delta: number) {                      // no longer async
  if (this.viewMode === 'month') {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
  } else {
    const weeks = this.viewMode as number;
    this.currentDate.setDate(this.currentDate.getDate() + (weeks * 7 * delta));
  }

  // D-04: render synchronously from the in-memory cache
  this.renderCalendar();
  const dateToShow = this.selectedDate || new Date();
  this.showDayAgenda(dateToShow);

  // D-05: if the cache is stale, kick off a background fetch.
  // The fetchInFlight dedup (Phase 2 D-12) collapses this with the auto-refresh timer.
  this.maybeBackgroundRefresh();
}
```

**Background-fetch helper pattern** (new private method on `CalendarView`; the planner may choose to inline instead, but a helper is justified because `goToToday` will call it too):
```typescript
private maybeBackgroundRefresh() {
  const enabledSources = this.plugin.settings.calendarUrls.filter(
    (s) => s.enabled && s.url?.trim()
  );
  if (!this.plugin.calendarService.needsRefresh(...)) return;

  // Fire-and-forget; fetchInFlight in CalendarService dedups this against the
  // setupAutoRefresh interval timer (Phase 2 D-12).
  void this.plugin.calendarService
    .fetchCalendars(this.plugin.settings.calendarUrls, false)
    .then(() => {
      this.loadDailyNotes();
      this.renderCalendar();
      const dateToShow = this.selectedDate || new Date();
      this.showDayAgenda(dateToShow);
    })
    .catch((error) => {
      console.error("Background refresh failed:", errorMessage(error));
    });
}
```

**Note on `needsRefresh` visibility:** It is currently `private` on `CalendarService` (line 208). To call it from `CalendarView`, either:
- (a) widen visibility to `public` (smallest change, matches the public surface of `getAllEvents` / `getEventsForDate`), OR
- (b) move the predicate into the helper itself — the helper just calls `fetchCalendars(..., false)`, which already short-circuits internally via `needsRefresh` and `fetchInFlight`. **Option (b) is preferred** because it leans entirely on the existing dedup gate and adds no new public API. The helper becomes a thin `void fetchCalendars(...).then(rerender).catch(log)` without any pre-check — `fetchCalendars` returns the cached events immediately when `needsRefresh` is false.

If the planner picks (b), the helper simplifies to:
```typescript
private maybeBackgroundRefresh() {
  void this.plugin.calendarService
    .fetchCalendars(this.plugin.settings.calendarUrls, false)
    .then((events) => {
      // Only re-render if the fetch actually produced new events.
      // (Optional: a "did the array change" check; otherwise just re-render unconditionally —
      //  renderCalendar is cheap and showDayAgenda already runs on every navigate.)
      this.loadDailyNotes();
      this.renderCalendar();
      const dateToShow = this.selectedDate || new Date();
      this.showDayAgenda(dateToShow);
    })
    .catch((error) => {
      console.error("MemoChron: background refresh failed:", errorMessage(error));
    });
}
```

**Error-formatting pattern** (`src/utils/errors.ts:8–10`):
```typescript
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```
The catch block above uses `errorMessage(error)` — same idiom as every other catch in `CalendarView.ts` (lines 150, 171, 771, 860, 975) and `CalendarService.ts` (lines 256, 300, 344, 403, 541). `errorMessage` is already imported in `CalendarView.ts` at line 6 — no new import.

---

### Site 4 — `goToToday()` always recenter + decoupled fetch (D-06, D-08, D-09)

**Target:** `src/views/CalendarView.ts:324–333`

**Analog:** `navigate(delta)` (post-D-04). Same decoupled-render contract: synchronous render, optional background fetch.

**Existing `goToToday` code to rewrite:**
```typescript
async goToToday() {
  const today = new Date();

  if (!this.isSameMonth(this.currentDate, today)) {        // D-08: drop this short-circuit
    this.currentDate = today;
    await this.refreshEvents();                            // D-06: drop the await
  }

  this.selectDate(today);
}
```

**Target shape:**
```typescript
goToToday() {                                              // no longer async
  const today = new Date();

  // D-08: always reassign currentDate — symmetric with navigate(). The
  // previous isSameMonth short-circuit was incorrect for week-mode views
  // (today often falls in the current month but a different week).
  this.currentDate = today;

  // D-09: viewMode is NOT changed — Today resets the date, not the view shape.
  // A user in 2-week mode stays in 2-week mode, recentered on today's week.

  // D-06: same decoupled pattern as navigate(): render synchronously, fire-and-forget stale fetch.
  this.renderCalendar();
  this.selectDate(today);          // this calls showDayAgenda internally
  this.maybeBackgroundRefresh();
}
```

**Note on `selectDate`:** It is `private async selectDate(date: Date)` at line 342 — it awaits `showDayAgenda`. The new `goToToday` does NOT need to await it (the agenda render is synchronous in practice — `showDayAgenda` is `async` only because it shares structure with code that needs await elsewhere; it does no I/O against the cache path). Calling it without `await` keeps the click → paint synchronous.

**`isSameMonth` helper:** After D-08, this helper at line 335 has no other callers in the file. The planner may remove it or leave it. Default: remove (dead code hygiene), but it is a private method so leaving it does not pollute the public surface.

---

### Site 5 — `refreshEvents(forceRefresh)` preserved for explicit refresh paths (D-07)

**Target:** `src/views/CalendarView.ts:101–118`

**Analog:** self. The contract is unchanged.

**Existing code (preserved):**
```typescript
async refreshEvents(forceRefresh = false) {
  await this.plugin.calendarService.fetchCalendars(
    this.plugin.settings.calendarUrls,
    forceRefresh
  );

  // Reload daily notes
  this.loadDailyNotes();

  this.renderCalendar();

  // Update calendar visibility based on current settings
  this.updateCalendarVisibility();

  // Always show agenda for selected date or today
  const dateToShow = this.selectedDate || new Date();
  this.showDayAgenda(dateToShow);
}
```

**Per D-07, callers of `refreshEvents`:**
- `force-refresh-calendars` command — keep `await`, user is asking for a fresh fetch
- `layout-change` workspace event (line 306) — keep `await` per D-10 / `Claude's Discretion` default ("workspace layout events are rare and warrant a fresh fetch")
- View init in `onOpen()` (lines 86, 89, 97) — keep `await`, initial load needs the data before first render

**Planner's prerogative (D-07, deferred-ideas section of CONTEXT):**
Whether to split `refreshEvents` into `renderFromCache()` + `fetchAndRender()` (or introduce a `renderCurrentRange()` private helper that `navigate`/`goToToday` reuse) is left to the planner. The above target shape inlines two lines (`renderCalendar()` + `showDayAgenda(dateToShow)`) in three places — if that duplication offends, extract:
```typescript
private renderCurrentRange() {
  this.renderCalendar();
  const dateToShow = this.selectedDate || new Date();
  this.showDayAgenda(dateToShow);
}
```
Then `navigate`, `goToToday`, and the `.then(...)` callback inside `maybeBackgroundRefresh` all call `this.renderCurrentRange()`.

---

## Shared Patterns

### Numeric Date constructor (local calendar day idiom)

**Source:** `src/views/CalendarView.ts:494,499`; `src/utils/timezoneUtils.ts:168,184,218,231`

**Apply to:** every BUG-01 branch in `parseDateFromFilename`

```typescript
new Date(year, month - 1, day)  // month is 1-indexed at the call site → 0-indexed in JS Date
```

Convention: the variable passed to `Date(...)`'s second argument is named `month` and is *already zero-indexed* if it came from `Date.prototype.getMonth()`; it is named `month` and is *one-indexed* if it came from external numeric input (filename digits, ical.js fields), in which case the call site writes `month - 1` explicitly. Both patterns are visible in `timezoneUtils.ts:166–231`.

### Catch-block error formatting

**Source:** `src/utils/errors.ts:8–10`

**Apply to:** every new catch block introduced this phase (the `.catch(...)` on the background-fetch promise in D-05)

```typescript
.catch((error) => {
  console.error("MemoChron: background refresh failed:", errorMessage(error));
})
```

Already imported in `CalendarView.ts` at line 6 — no new import.

### Greppable issue/bug code comment

**Source:** `src/services/CalendarService.ts:39, 49, 76` (BUG-06 / D-12 comments)

**Apply to:** the DD-MM-YYYY branch comment in D-11

Pattern: `// <issue-ref> <decision-ref>: <one-line summary including before/after concrete value>`

D-11 instance:
```typescript
// #56 regression closed post-#58 (and BUG-01 fix in Phase 3 — local-day construction). 29-01-2026 → 2026-01-29 local.
```

### Fire-and-forget Promise (`void` prefix)

**Source:** none in the existing codebase — fire-and-forget is introduced by D-05. Closest existing analog is `scheduleBackgroundRefresh`, which uses `setBackgroundRefreshTimer` instead of a bare `void p.then(...)`.

**Apply to:** `maybeBackgroundRefresh` helper in D-05.

**Rationale for the `void` prefix:** TypeScript's `no-floating-promises` ESLint rule (the project has `@typescript-eslint/eslint-plugin` 5.29.0 as a devDep, though no `.eslintrc` config currently activates it) treats unhandled Promises as errors. Prefixing with `void` signals intentional fire-and-forget. The Promise chain (`.then(...).catch(...)`) handles re-render and error logging, so the promise is "handled" in the sense that matters — `void` just suppresses static-analysis noise. This pattern is documented in TypeScript best practices but not yet present in MemoChron source; introducing it here is consistent with `errorMessage` being introduced in Phase 2.

## No Analog Found

No phase-3 site lacks an in-codebase analog. The closest-to-novel pattern is the fire-and-forget `void promise.then().catch()` itself, and it is a thin combination of two existing patterns:
- Deferred fetch through `fetchCalendars` (already deduped via `fetchInFlight`)
- `errorMessage`-formatted catch blocks (universal in the codebase)

So even the "novel" pattern is just composition of two established ones.

## Metadata

**Analog search scope:** `src/services/`, `src/views/`, `src/utils/` (entire `src/` tree)
**Files scanned:** 5 (`CalendarView.ts`, `CalendarService.ts`, `viewRenderers.ts`, `timezoneUtils.ts`, `errors.ts`)
**Pattern extraction date:** 2026-05-12
