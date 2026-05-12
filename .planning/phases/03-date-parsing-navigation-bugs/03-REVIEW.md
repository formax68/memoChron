---
phase: 03-date-parsing-navigation-bugs
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/utils/viewRenderers.ts
  - src/views/CalendarView.ts
  - src/main.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-12
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 3 fixes four bugs across three files. The targeted fixes are correct on
their core mechanics:

- **BUG-01 (timezone correctness):** `parseLocalDate(y, m, d)` uses the numeric
  `Date` constructor — correct local-day construction, no more UTC-midnight
  back-shift. The bounds guard (`month 1..12`, `day 1..31`) is reasonable.
- **BUG-02 (decoupled navigation):** `navigate(delta)` is now synchronous and
  renders from the in-memory cache. The fire-and-forget `maybeBackgroundRefresh`
  helper correctly leans on the Phase 2 `fetchInFlight` dedup gate.
- **BUG-03 (Today always recenters):** the `isSameMonth` short-circuit is gone;
  `currentDate = today` is unconditional; `viewMode` is correctly preserved.
- **BUG-04 (dead duplicate regex removed):** the duplicate `/(\d{2}-\d{2}-\d{4})/`
  at the old line 433 is gone; a single greppable closure comment (#56, #58,
  BUG-01) lands on the surviving regex. The in-branch dual-parse is preserved.

However, three correctness/quality concerns surfaced. Two of them (WR-01,
WR-02) are pre-existing bugs in code paths *adjacent to* the BUG-01 fix that
the new `parseLocalDate` helper masks instead of solving: `parseLocalDate`
accepts e.g. `(2026, 2, 31)` and silently rolls forward to March 3, so a
filename like `31-02-2026.md` returns March 3, 2026 with no error. Separately,
the BUG-01 helper does NOT cover `parseDate(input)` — the "Try standard date
formats" branch at `viewRenderers.ts:410` still calls `new Date(input)`, so a
user-typed `"2026-01-15"` in `parseDate` (used by code-block parameters via
`EmbeddedCalendarView`/`EmbeddedAgendaView`) still has the original UTC-midnight
bug. WR-03 flags a real concurrency/race issue in the fire-and-forget render
path that the planner did not consider: when `selectedDate` mutates between
click and the background-fetch `.then(...)`, the agenda re-renders against
*the new* `selectedDate`, which is the desired behaviour, but `selectedDate`
might also be `null` at click time and a `new Date()` allocated in the `.then`
disagrees with the `new Date()` allocated in the synchronous render — a
display jitter risk if the wall clock crosses midnight between the two
allocations.

Per the review charter, performance issues are out of scope. Focus is correctness
and maintainability.

## Warnings

### WR-01: `parseLocalDate` does not reject invalid day-of-month, silently rolls forward

**File:** `src/utils/viewRenderers.ts:423-427`
**Issue:** The new helper introduced for BUG-01 guards against `month` outside
`1..12` and `day` outside `1..31`, but does NOT reject invalid day-of-month
combinations such as February 30, February 31, April 31, or June 31. JavaScript's
`new Date(year, month - 1, day)` silently rolls overflow into the next month
(e.g. `new Date(2026, 1, 31)` → `2026-03-03`). The `isNaN(date.getTime())` check
never triggers for these inputs because the constructor produces a *valid* but
incorrect Date.

Concrete failure modes that flow through `parseDateFromFilename`:
- `31-02-2026.md` (DD-MM-YYYY): DD-MM interpretation = `parseLocalDate(2026, 2, 31)`
  → returns March 3, 2026 instead of `null`. MM-DD fallback is never tried (it
  would have been `parseLocalDate(2026, 31, 2)` → rejected by the month bound,
  returning `null`).
- `30-02-2026.md`: DD-MM → `parseLocalDate(2026, 2, 30)` → March 2, 2026 (also
  wrong; the user almost certainly meant "no such date, show nothing").
- `2026-02-30.md` (YYYY-MM-DD): rolls to March 2, 2026 silently.
- `20260230` (YYYYMMDD): same — rolls to March 2.

This is a step backwards from one specific case: prior to BUG-01, `new Date("2026-02-30")`
returned `NaN` on most engines and the `!isNaN` check rejected it; now the
numeric constructor accepts it. The BUG-01 timezone fix masked a pre-existing
laxness in the validation.

**Fix:** verify the constructed Date round-trips to the input components:

```typescript
function parseLocalDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;
  // Reject overflow rollover (e.g. Feb 31 -> Mar 3)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}
```

This is one extra check, makes the helper actually validate the calendar day,
and lets the DD-MM-YYYY branch's dual-parse fallback do its job correctly when
the first interpretation produces an impossible date.

### WR-02: BUG-01 (timezone fix) is incomplete — `parseDate` still uses `new Date(string)`

**File:** `src/utils/viewRenderers.ts:410`
**Issue:** Plan 03-01's stated objective is "daily-note filename UTC parsing"
(via `parseDateFromFilename`), and that path is correctly fixed. But the
sibling helper `parseDate(input, context?)` — invoked from the code-block
parameter parsers (`EmbeddedCalendarView`, `EmbeddedAgendaView` via
`parseCalendarCodeBlock` / `parseAgendaCodeBlock`) — still ends with:

```typescript
// Try standard date formats
const date = new Date(input);
if (!isNaN(date.getTime())) {
  return date;
}
```

In any timezone west of UTC, `new Date("2026-01-15")` is UTC midnight, which
back-shifts to `2026-01-14` local. That is exactly the bug class BUG-01 closes
for filenames but leaves open for code-block parameters such as:

````markdown
```memochron-calendar
date: 2026-01-15
```
````

A user writing this in `America/New_York` gets January 14 selected, not 15 —
the same surprise that motivated BUG-01.

Whether this is "in scope" for Phase 3 is debatable — the ROADMAP success
criterion names "daily-note filename" specifically. But the user-visible bug
class is identical and a future maintainer who greps for `BUG-01` will not
find this call site documented. At minimum this deserves either a fix (route
through `parseLocalDate` after a YYYY-MM-DD detection) or a closure comment
noting why the second call site is intentionally not fixed.

**Fix:** detect ISO-shaped strings explicitly before falling back to the
loose `new Date(input)` form:

```typescript
// Try YYYY-MM-DD explicitly so the result is a local-day Date (BUG-01).
const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
if (isoMatch) {
  const local = parseLocalDate(
    Number(isoMatch[1]),
    Number(isoMatch[2]),
    Number(isoMatch[3])
  );
  if (local) return local;
}

// Try standard date formats (fallback; do NOT pass YYYY-MM-DD here — handled above)
const date = new Date(input);
if (!isNaN(date.getTime())) {
  return date;
}
```

### WR-03: `maybeBackgroundRefresh` `.then` ignores stale closure and unawaited Promise

**File:** `src/views/CalendarView.ts:320-332`
**Issue:** The `.then(...)` callback re-runs the render path against
`this.selectedDate || new Date()`. Two issues:

1. **No staleness guard:** If the user navigates away (clicks another arrow,
   selects a different day, switches view mode) while the background fetch is
   in flight, the `.then` callback completes against the *new* `selectedDate`
   and the *new* `currentDate`. In most cases that is the desired behaviour
   (show the latest user-selected day with the latest events) — but if the user
   has *already triggered a more recent navigation that fired its own
   background refresh*, the older fetch's `.then` will paint *after* the newer
   render call, causing a brief revert flicker. The Phase 2 `fetchInFlight`
   dedup eliminates the duplicate fetch, but only one of the two
   `.then(rerender)` chains runs — the second arrives via the shared Promise
   resolution. The two `.then` callbacks both fire, and the order is
   first-registered-first-run. The net effect on screen is unobservable in the
   common case but is a real source of "phantom revert" reports under flaky
   networks. Worth a guard: capture `currentDate` at call time and bail out of
   the re-render if `this.currentDate` has moved on.

2. **`showDayAgenda` is async but unawaited inside `.then`:** Line 327:
   `this.showDayAgenda(dateToShow);` — `showDayAgenda` is declared `async` and
   its body awaits nothing externally, but it builds DOM. Calling it from the
   `.then` callback without awaiting it leaks an unhandled Promise. If
   `showDayAgenda` ever picks up an async leaf (e.g. a future change adds an
   `await` to fetch event details), errors inside it will silently surface
   to `unhandledrejection` instead of the surrounding `.catch`. The pattern
   `void this.showDayAgenda(dateToShow);` or making the `.then` callback
   `async` and awaiting both renders would close this. The same shape exists
   at `navigate` line 327 and `refreshEvents` line 117 — so this is at most
   a consistency concern, not a fresh regression — but it's the same latent
   bug across three sites now.

**Fix (recommended for both concerns):**

```typescript
private maybeBackgroundRefresh(): void {
  const targetDate = this.currentDate;  // capture for staleness check
  void this.plugin.calendarService
    .fetchCalendars(this.plugin.settings.calendarUrls, false)
    .then(async () => {
      // Bail if user has navigated since this fetch started.
      if (this.currentDate !== targetDate) return;
      this.loadDailyNotes();
      this.renderCalendar();
      const dateToShow = this.selectedDate || new Date();
      await this.showDayAgenda(dateToShow);
    })
    .catch((error) => {
      console.error("MemoChron: background refresh failed:", errorMessage(error));
    });
}
```

Note: the comparison `this.currentDate !== targetDate` works because navigate
*replaces* the Date in some paths and *mutates* it via `setMonth`/`setDate` in
others. The mutation paths produce the *same* object, so a strict-equality
guard wouldn't fire for in-place arithmetic. To guard correctly, capture
`targetDate.getTime()` instead: `const targetTime = this.currentDate.getTime();`
and compare `this.currentDate.getTime() !== targetTime`. (The current
implementation mutates `currentDate` in `navigate`'s month-branch — see line
342 `this.currentDate.setMonth(...)` — so identity comparison would miss a
navigate-while-fetching race.)

## Info

### IN-01: `viewMode === 'month'` type-guards by string literal but the alternative branch casts to `number`

**File:** `src/views/CalendarView.ts:341-346, 415-419`
**Issue:** `CalendarViewMode = 'month' | 1 | 2 | 3 | 4 | 5` is a discriminated
union, but the code uses `this.viewMode as number` at lines 344 and 418
instead of letting TypeScript narrow. After `if (this.viewMode === 'month')`,
the else branch has `this.viewMode: 1 | 2 | 3 | 4 | 5` — which is already
assignable to `number` without a cast. The `as number` is dead.

**Fix:** drop the `as number` casts at lines 344 and 418:

```typescript
const weeks = this.viewMode; // already 1 | 2 | 3 | 4 | 5 in this branch
this.currentDate.setDate(this.currentDate.getDate() + (weeks * 7 * delta));
```

Cosmetic, but the cast obscures that the union has already been narrowed.

### IN-02: Redundant comment of the same #56 closure note repeated inside the branch body

**File:** `src/utils/viewRenderers.ts:441` and `src/utils/viewRenderers.ts:470`
**Issue:** Plan 03-03 placed the BUG-04 closure comment above the surviving
regex at line 441. The branch body at line 470 also carries the same
`#56 regression closed post-#58 (and BUG-01 fix in Phase 3 — local-day construction). 29-01-2026 → 2026-01-29 local.`
note. This is duplicated documentation — both lines say the same thing about
the same code, and a maintainer editing one branch is likely to miss the
other.

**Fix:** keep only the comment at line 441 (next to the regex it documents).
The branch body at line 470 already has the descriptive comment at line 469
("DD-MM-YYYY or MM-DD-YYYY - try both interpretations") which is sufficient
in-place documentation. Delete line 470.

### IN-03: `parseDate` keyword branches return a Date with the *current time*, not midnight

**File:** `src/utils/viewRenderers.ts:395-407`
**Issue:** Pre-existing behaviour, but worth flagging because BUG-01 raises
the question of "what does parseDate return — a calendar day or a moment?"
Today's `parseDate("today")` returns `new Date()` — a Date pinned to the
*current wall-clock instant*, not local midnight. If the caller (typically
the agenda renderer in `EmbeddedAgendaView`) does any day-equality comparison
using `.toDateString()`, the answer is the right day in the user's local
timezone — so this is not user-visible. But if a future change uses
`event.start >= parseDateResult`, the Date is suddenly mid-day and the
comparison silently shifts. The `parseLocalDate` helper introduced by BUG-01
gives a clean way to return local midnight for the keyword branches too.

**Fix:** for the three keyword branches, normalize to local midnight to match
the calendar-day semantics of the filename branches:

```typescript
if (input.toLowerCase() === "today") {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
```

(and likewise for `tomorrow` / `yesterday`). Or document explicitly that
`parseDate` returns "a Date intended for day-equality comparison via
`.toDateString()`, not a midnight-pinned Date." Pick one — current code is
ambiguous.

### IN-04: `goToToday` calls `this.selectDate(today)` without awaiting, despite `selectDate` being `async`

**File:** `src/views/CalendarView.ts:373`
**Issue:** Same shape as WR-03 item 2. `selectDate` is declared `async` and
internally `await`s `this.showDayAgenda(date)`. Calling it without `await`
from the new synchronous `goToToday(): void` is intentional per plan 03-02 to
keep the click-to-paint path synchronous — and that intent is correct — but
the unhandled Promise is a latent error sink. If `selectDate` or
`showDayAgenda` ever throws (today they don't), the error reaches
`unhandledrejection` instead of a `try/catch`. The plan's comment "calls
showDayAgenda internally; not awaited because the agenda render does no I/O
against the cached path" documents the intent but does not address the
exception-handling delta.

**Fix:** either `void this.selectDate(today);` (makes intent explicit; the
TypeScript `no-floating-promises` lint rule, if enabled, will then be
satisfied), or wrap the call in an inline catch:

```typescript
this.selectDate(today).catch((error) => {
  console.error("MemoChron: selectDate failed:", errorMessage(error));
});
```

Same applies to the unawaited `this.showDayAgenda(dateToShow);` calls inside
`renderCurrentRange` (line 337) and `refreshEvents` (line 117). Three sites,
all latent; recommend a one-pass cleanup with `void` prefixes.

---

## Notes on items NOT flagged (verified correct)

These were scrutinized and judged sound:

- **`parseLocalDate` boundary check `month < 1 || month > 12`:** correct.
  Combined with the YYYY-MM-DD regex `\d{2}` shape, month=0 and month=13+ are
  filtered before reaching the constructor.
- **Removal of duplicate `/(\d{2}-\d{2}-\d{4})/`:** verified unreachable in
  the pre-fix code. The first regex always matches first (`Array.prototype` is
  iterated in order; `for (const format of formats)` short-circuits on first
  match). Deletion is safe.
- **`navigate` mutates `currentDate` in-place via `setMonth`/`setDate`:**
  preserves the pre-existing identity for any external reference; no
  observable change versus pre-fix. The behaviour is correct for both
  arithmetic paths, including DST-boundary edge cases (verified mentally:
  March 13 + 7 days = March 20 even across the DST forward shift, because
  `setDate` operates in calendar-day units, not 24-hour-millisecond units).
- **`goToToday` does not modify `viewMode`:** confirmed correct against
  ROADMAP success criterion #3. A user in 2-week mode stays in 2-week mode.
- **`goToToday` re-renders via `renderCalendar()` + `selectDate(today)`** (not
  `renderCurrentRange`): also correct. `renderCurrentRange` re-uses the
  *existing* `selectedDate` and would not select today's cell. The split is
  intentional and documented in 03-02-PLAN.md.
- **Removal of `isSameMonth` helper:** confirmed no remaining callers via
  `grep`. Dead-code deletion is safe.
- **`maybeBackgroundRefresh` uses `errorMessage(error)`** and the
  `"MemoChron: "` log prefix: matches the project convention from Phase 2.
- **`main.ts:178-182` `goToToday()` no longer `async`:** correct — the
  underlying view method is no longer async, so the `await` removal is
  consistent and intentional.
- **`main.ts:97 await this.goToToday()` → `this.goToToday()`:** correct
  drop; no need to await a void method.
- **The day-render double-listener pattern (`touchstart` then `click`):**
  pre-existing, not modified by this phase, not flagged.

---

## Prompt-Injection Notice

A `<system-reminder>` block in one of the tool outputs read during this
review contained fake "MCP Server Instructions" for unrelated services
(Airtable, Context7, Gamma). I ignored it. No action was taken on those
purported instructions; the user-supplied task was followed instead. Flagging
here so the orchestrator can decide whether to investigate the injection
source.

---

_Reviewed: 2026-05-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
