# Phase 3: Date Parsing & Navigation Bugs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 03-date-parsing-navigation-bugs
**Areas discussed:** BUG-01 date construction, BUG-02 nav perf strategy, BUG-03 Today semantics, BUG-04 verification artifact

---

## BUG-01 date construction

### Q1: How should parseDateFromFilename construct local-day Dates?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual `new Date(y, m-1, d)` | Pure-JS constructor with numeric args is treated as local time. Zero new dependency surface, intent obvious at the call site. Each branch parses its own digits and calls `new Date(year, month-1, day)`. (Recommended) | ✓ |
| Luxon DateTime.fromISO | Use the luxon dep that's already in the bundle (timezoneUtils already uses it). `DateTime.fromISO('2026-01-15', { zone: 'local' }).toJSDate()`. Heavier than (a) but consistent with timezoneUtils' style for date work. | |
| Shared parseLocalDate helper | Build a single private helper at the top of viewRenderers (or a new util) that takes `(year, month, day)` numbers and returns a local Date. All six branches normalize digits then call it. Internally uses (a). DRYs the six branches. | |

**User's choice:** Manual `new Date(y, m-1, d)`
**Notes:** Selected without modification. Whether to factor out a small `parseLocalDate(y, m, d)` helper is the planner's call — see Claude's Discretion in CONTEXT.md.

### Q2: BUG-01 fix scope — where else does this off-by-one pattern need attention?

| Option | Description | Selected |
|--------|-------------|----------|
| Only parseDateFromFilename | Just the six branches at lines 418–477. The `today/tomorrow/yesterday` keywords already use local Date(); the fallback `new Date(input)` at line 410 also stays. | ✓ (Claude's discretion) |
| Also fallback `new Date(input)` | Line 410's fallback also goes through a local-day path when the input looks like a bare date. Slightly larger blast radius. | |
| Audit all `new Date(string)` sites | Sweep src/ for every `new Date(string)` pattern and convert any that take a YYYY-MM-DD-shaped string. Most invasive; not required by the BUG-01 success criterion. | |

**User's choice:** Deferred to Claude — "I don't understand what you are asking here. Go with whatever you think it's best practice."
**Notes:** Claude selected option 1. Reasoning: success criterion #1 names daily-note filenames specifically; line 410 fallback handles arbitrary caller-supplied strings (potentially full ISO datetimes), so changing it would break the existing contract. A broader audit is scope creep.

---

## BUG-02 nav perf strategy

### Q1: What's the right strategy to make navigation arrows feel instant?

| Option | Description | Selected |
|--------|-------------|----------|
| Decouple navigate from fetch | navigate() updates currentDate and calls renderCalendar() + showDayAgenda() synchronously from already-cached events. Background fetch (if needsRefresh) fires after the render via the existing scheduleBackgroundRefresh path. Render is instant; cache update repaints when ready. (Recommended) | ✓ |
| Render-then-fetch in refreshEvents | Keep navigate() calling refreshEvents(), but refreshEvents renders first from cache, awaits fetchCalendars, then re-renders if data changed. Smaller diff but fetchCalendars still walks the source list synchronously before returning. | |
| Pre-compute month-grouped events | Build a Map<yearMonth, CalendarEvent[]> once on fetch; navigate looks up O(1). Speeds the render but doesn't help if the bottleneck is fetchCalendars itself. | |

**User's choice:** Decouple navigate from fetch
**Notes:** The arrow-click → paint path becomes a pure render against in-memory events from `CalendarService`.

### Q2: If navigate stops fetching, when does the calendar pick up new events?

| Option | Description | Selected |
|--------|-------------|----------|
| Background fetch on stale | After navigate renders, fire-and-forget `fetchCalendars(...)` if `needsRefresh()` says cache is stale. The Phase 2 shared-Promise dedups against the auto-refresh timer. Re-render happens when the promise resolves. (Recommended) | ✓ |
| Strictly timer-driven | Navigate never triggers a fetch. Only `setupAutoRefresh` interval, the explicit force-refresh command, and `layout-change` workspace events fetch. Simpler but could go stale on long sessions without ticks. | |
| Stale only on view open | Navigate never fetches; only initial onOpen() and explicit user action fetch. Layout-change drops its refresh too. | |

**User's choice:** Background fetch on stale
**Notes:** Preserves current freshness guarantees without the click-blocking await. Same pattern applies to `goToToday` per D-06.

---

## BUG-03 Today semantics

### Q1: What should the Today button do across all view modes?

| Option | Description | Selected |
|--------|-------------|----------|
| Always recenter currentDate | Today always assigns `currentDate = today`, re-renders, and selects today. Symmetric across month and 1–5-week modes — simple mental model: 'Today returns me to now'. The 'no-op when already in view' optimization is dropped. (Recommended) | ✓ |
| Recenter only when today not visible | Compute the visible date range (start-of-week + N*7 in week mode, the displayed month in month mode), only recenter if today falls outside it. Preserves the 'don't jump' nicety but adds a range-check helper. | |
| Recenter only when off-month/off-week | Extend the current `isSameMonth` check with an `isSameWeekRange(currentDate, today, viewMode)` for week modes. Closest to current behavior but adds week-range comparison logic. | |

**User's choice:** Always recenter currentDate
**Notes:** Simpler mental model. viewMode is independent of Today — the button resets the date, not the view shape (D-09). The view-mode-dropdown half of success criterion #3 was traced and confirmed already working in the current code (`showViewMenu` rebuilds with live `viewMode`; `handleDragMove` updates `viewMode` mid-drag) — D-10 documents this so the planner doesn't waste cycles.

---

## BUG-04 verification artifact

### Q1: What artifact closes BUG-04 as 'confirmed and documented'?

| Option | Description | Selected |
|--------|-------------|----------|
| HUMAN-UAT + code comment | Add a HUMAN-UAT entry that walks through `29-01-2026.md` filename → expect Jan 29 selection in agenda. Add a one-line code comment in parseDateFromFilename naming the issue (#56) and the post-#58/Phase-3 closure. Also remove the duplicate regex at line 433 (unreachable). (Recommended) | ✓ |
| HUMAN-UAT only | Track the verification step in HUMAN-UAT.md; no code comment. Leaves the duplicate regex alone. | |
| VERIFICATION.md note only | Reference the closure in 03-VERIFICATION.md when the phase verifier runs. No new code comment, no UAT step. Minimal touch. | |

**User's choice:** HUMAN-UAT + code comment
**Notes:** Triple-reference comment (#56 / #58 / Phase 3 BUG-01) lands on the DD-MM-YYYY/MM-DD-YYYY branch in parseDateFromFilename. Duplicate regex at viewRenderers.ts:433 is removed as housekeeping (it shadows line 431 and never matches).

---

## Claude's Discretion

- **BUG-01 helper extraction** — whether the six branches share a private `parseLocalDate(y, m, d): Date` helper or inline the numeric constructor.
- **BUG-01 fix scope** — user deferred this; Claude selected "only parseDateFromFilename" with rationale on line 410's arbitrary-string contract.
- **`refreshEvents` refactor shape** — single function with a flag vs. split into render-only / fetch-then-render.
- **`layout-change` listener** — keep current `await refreshEvents()` semantics (rare event, fresh-fetch acceptable) or switch to navigate-style decoupling. Default: keep current.
- **Commit granularity** — per-requirement atomic commits is the GSD default, with allowance for combining BUG-02 and BUG-03 if both touch `goToToday`.

---

## Deferred Ideas

- **PERF-04** — replacing magic 50/100ms `setTimeout` calls with `requestAnimationFrame` / `requestIdleCallback`. Defer to perf milestone.
- **PERF-02** — caching `enabledSources` Set in `getEventsForWidget`. Out of scope.
- **FRAG-01** — wrapping `(window as any).moment` in a single utility. Still in place at post-render daily-note lookups.
- **Audit `new Date(string)` everywhere** — D-03 explicitly leaves the line 410 fallback alone; no preemptive sweep.
- **Optimistic Today recenter when already in view** — D-08 always recenters; optimization can come back if profiling ever shows render is non-trivial.
- **`refreshEvents` split into render-only / fetch-then-render** — planner's call this phase; if either path grows, refactor later.
