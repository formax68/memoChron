---
phase: 02-security-correctness
plan: 05
subsystem: calendar-fetch
tags: [fetch-dedup, in-flight-promise, errors, sec-02, bug-06, defensive-coding]

# Dependency graph
requires:
  - phase: 02-security-correctness
    plan: 03
    provides: "src/utils/errors.ts exporting errorMessage(err: unknown): string (consumed at the top of CalendarService.ts)"
  - phase: 01-foundation
    provides: "setBackgroundRefreshTimer on the plugin (CR-01) — mobile-safe timer ownership; preserved unchanged here"
provides:
  - "CalendarService.fetchInFlight: Promise<CalendarEvent[]> | null — shared in-flight promise that deduplicates concurrent fetchCalendars callers"
  - "Five CalendarService.ts catches normalized through errorMessage(error) — Notice/log paths can no longer surface [object Object] or undefined for non-Error throwables"
  - "CORS / network branch in fetchCalendar(source) now uses message.includes(...) on the helper output, eliminating the secondary TypeError when error.message is undefined"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared in-flight Promise dedup — the Promise's non-null state IS the in-flight signal (D-12). No boolean guard."
    - "performFetch wrapper Promise has its .finally() in the caller (fetchCalendars), not inside performFetch — single source of truth for clearing fetchInFlight."
    - "errorMessage(error) extraction at every non-discarded catch in CalendarService.ts; const message = errorMessage(error) when used 2+ times in the same catch body"

key-files:
  created: []
  modified:
    - "src/services/CalendarService.ts (import added; 5 catches normalized; isFetchingCalendars removed; fetchInFlight added; fetchCalendars entry guard + tail rewritten; performFetch finally block removed)"

key-decisions:
  - "D-12 / D-13 — fetchInFlight is held as Promise<CalendarEvent[]> | null on the instance; non-null IS the in-flight signal; cleared in .finally() wrapping the performFetch call inside fetchCalendars"
  - "performFetch's own finally block was removed entirely — the only line it contained was `this.isFetchingCalendars = false`. The wrapping .finally() in fetchCalendars now owns the cleanup."
  - "Catch wrapping in performFetch (Task 1 work) was preserved as-is when Task 2 dropped the surrounding finally — the catch body itself is unchanged"
  - "D-14 — force-refresh-during-fetch UX is intentionally deferred: if Caller B requests force while Caller A's non-force fetch is in flight, B receives A's in-flight result. Acceptable per success-criteria spirit (no double-render, no duplicate event list); follow-up only if real users complain."
  - "scheduleBackgroundRefresh body unchanged — Phase 1 setBackgroundRefreshTimer wiring (CR-01) is the entry point for the mobile-safe timer; dedup happens at fetchCalendars(...) entry, not at the schedule site"
  - "The two out-of-scope catches (parameter-less mkdir at :342, discarded-error inner adapter.read at :516) are preserved verbatim per D-08 spirit — neither reads its error binding nor surfaces diagnostic / user-facing text from it"

patterns-established:
  - "Shared in-flight Promise dedup at a service-level fetch entrypoint — Promise held on instance, cleared in .finally(); first net-new application of this pattern in the codebase"
  - "Verbose catch shape (Pattern A from plan 02-03) — `const message = errorMessage(error);` extraction when the message is used 2+ times (CORS/network branch + console.error in fetchCalendar; status text + console.error in fetchLocalCalendar)"
  - "Inline catch shape (Pattern B from plan 02-03) — `errorMessage(error)` passed inline when the message is consumed exactly once (performFetch catch, loadFromCache catch, saveToCache catch)"

requirements-completed: [BUG-06, SEC-02]

# Metrics
duration: ~8min
completed: 2026-05-11
---

# Phase 2 Plan 5: CalendarService fetchInFlight Dedup + SEC-02 Catch Normalization Summary

**Replaced CalendarService's `isFetchingCalendars` boolean guard with a shared `fetchInFlight: Promise<CalendarEvent[]> | null` so concurrent fetch callers (force-refresh click + background timer + embedded views) receive the same in-flight promise instead of a stale `this.events` snapshot — and normalized the five non-discarded catches in the same file through `errorMessage(error)`, eliminating two unsafe `error.message` access patterns that produced `undefined` user-visible text and a secondary TypeError on non-Error throwables.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 (atomic commits)
- **Files modified:** 1 (`src/services/CalendarService.ts`)
- **Commits:**
  - Task 1 — `0cd9540` (`refactor`)
  - Task 2 — `e114a5a` (`fix`)

## Accomplishments

### SEC-02 (CalendarService.ts arm) closed

The five non-discarded catches in CalendarService.ts (lines 244, 288, 332, 391, 528) now extract their error message through `errorMessage(error)`:

- **performFetch outer catch (~244)** — `console.error("Error fetching calendars:", errorMessage(error))` — Notice path was already abstracted via `showErrorNotification`.
- **loadFromCache catch (~288)** — `console.log("MemoChron: No cache found or cache invalid", errorMessage(error))` — preserved the `console.log` level (cache-miss is expected behavior, not exceptional).
- **saveToCache catch (~332)** — `console.error("MemoChron: Failed to save calendar cache:", errorMessage(error))`.
- **per-source fetchCalendar catch (~391)** — `const message = errorMessage(error)`; the console.error now logs the message string, and the CORS/network branch is `message.includes("CORS")` / `message.includes("network")` instead of `error.message && error.message.includes(...)`. The redundant truthiness guard disappears because `errorMessage` never returns `null` or `undefined`.
- **fetchLocalCalendar outer catch (~528)** — `const message = errorMessage(error)`; both the console.error log and the returned `text: 'Error reading file: ${message}'` interpolate the helper output. The status-text formerly read `Error reading file: undefined` for non-Error throwables; that failure mode is structurally eliminated.

Two out-of-scope catches were left untouched per D-08 spirit:
- **Line 342 (`ensureCacheDirectory` mkdir)** — `} catch {` parameter-less swallow. No error binding to normalize.
- **Line 516 (`fetchLocalCalendar` inner `adapter.read` catch)** — `} catch (error) { return { status: 404, text: 'Cannot read file: ${pathInfo.normalizedPath}' }; }`. Discards the `error` binding; returns a static 404 with the path, not the error.

### BUG-06 closed

The boolean `isFetchingCalendars` field is gone. In its place:

```typescript
// BUG-06 (D-12): a single in-flight Promise deduplicates concurrent callers.
// The Promise's non-null state IS the "fetch in flight" signal.
private fetchInFlight: Promise<CalendarEvent[]> | null = null;
```

The `fetchCalendars` entry guard returns the in-flight Promise instead of a stale `this.events`:

```typescript
if (this.fetchInFlight) {
  return this.fetchInFlight;
}
```

The function tail assigns the wrapping promise and returns it:

```typescript
this.fetchInFlight = this.performFetch(enabledSources, forceRefresh).finally(() => {
  this.fetchInFlight = null;
});
return this.fetchInFlight;
```

`performFetch` no longer toggles any in-flight flag; the previous `finally { this.isFetchingCalendars = false; }` block was removed entirely. The wrapping `.finally()` in `fetchCalendars` is now the single source of truth for clearing the in-flight signal.

`scheduleBackgroundRefresh` body is unchanged — its `setBackgroundRefreshTimer(() => this.fetchCalendars(sources, true), 100)` call hits the new entry guard naturally when a fetch is already in flight, so the dedup applies without any change at the schedule site.

## Files Modified

### `src/services/CalendarService.ts`

**Added import:**
```typescript
import { errorMessage } from "../utils/errors";
```

**Field replacement (line ~38):**
- Before: `private isFetchingCalendars = false;`
- After: `private fetchInFlight: Promise<CalendarEvent[]> | null = null;` (with explanatory comment)

**fetchCalendars rewrite:**
- Entry guard: `if (this.isFetchingCalendars) return this.events;` → `if (this.fetchInFlight) return this.fetchInFlight;`
- Tail: `return this.performFetch(enabledSources, forceRefresh);` → `this.fetchInFlight = this.performFetch(enabledSources, forceRefresh).finally(() => { this.fetchInFlight = null; }); return this.fetchInFlight;`

**performFetch slimming:**
- Removed `this.isFetchingCalendars = true;` at the top of the try block
- Removed the entire `finally { this.isFetchingCalendars = false; }` block — replaced with a comment noting that the wrapping `.finally()` in `fetchCalendars` owns the cleanup
- Catch body wrapping (`errorMessage(error)`) was applied in Task 1 and preserved as-is in Task 2

**Catch normalizations (five sites):** see "SEC-02" section above.

## Decisions Made

- **No new fields beyond `fetchInFlight`** — the existing `events`, `lastFetch`, `isLoadingCache` are unaffected.
- **`.finally()` placement is in `fetchCalendars`, not `performFetch`** — `performFetch` should not need to know about the dedup mechanism; it just produces a promise. The dedup wrapper lives at the entry that owns the lifecycle (`fetchCalendars`).
- **The `performFetch` catch wrapping (`errorMessage(error)`)** is the post-Task-1 shape; Task 2 only restructures the surrounding control flow (removes `finally`), not the catch body itself.
- **D-14 deferral acknowledged** — force-refresh-during-fetch UX is not addressed; B sees A's result without distinguishing forced vs non-forced. Recorded in the threat model and in this summary; follow-up only if real users complain.
- **Catch normalization shape** — used Pattern A (`const message = errorMessage(error)` extraction) at the two sites that consume the message twice or more (`fetchCalendar` ~391 with the console.error log + CORS/network discriminator; `fetchLocalCalendar` ~528 with the console.error log + status-text interpolation). Used Pattern B (inline `errorMessage(error)`) at the three sites where the message is consumed exactly once.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1, Rule 2, or Rule 3 deviations were needed.

## Race-scenario Trace (Acceptance Criteria 7-Step Trace)

Tracing the modified code path to confirm dedup correctness:

1. **Caller A invokes `fetchCalendars(sources, false)`.** `this.fetchInFlight` is `null`, so the entry guard is skipped. Execution proceeds through the early-exit branches (none match), reaches the tail, executes `this.fetchInFlight = this.performFetch(enabledSources, false).finally(() => { this.fetchInFlight = null; })`, and returns the promise. `performFetch` begins its async work (`fetchPromises = enabledSources.map(...)`, then `await Promise.all(...)`).

2. **While A's promise is pending, Caller B invokes `fetchCalendars(sources, true)`** (e.g. `scheduleBackgroundRefresh`'s `setBackgroundRefreshTimer` callback fires).

3. **B hits the entry guard.** `this.fetchInFlight` is non-null (it holds the promise from step 1), so the guard returns `this.fetchInFlight` immediately. B's call performs ZERO additional network round-trips. B's `forceRefresh = true` is effectively ignored in favor of A's pending non-force fetch (D-14 acceptance).

4. **A's underlying `performFetch` promise resolves.** Inside `performFetch`: `this.events = results.flat()`, `this.lastFetch = Date.now()`, `await this.saveToCache()`, `this.showCompletionNotification(forceRefresh)`, and finally `return this.events`. The returned `CalendarEvent[]` array becomes the resolution value of the inner promise.

5. **The `.finally(() => { this.fetchInFlight = null; })` callback fires AFTER the inner promise settles but BEFORE its resolution value is delivered to awaiters of the wrapping promise.** Per the JS spec, `.finally(onFinally)` schedules `onFinally` to run when the source promise settles; the returned promise then resolves with the original value (or rejects with the original reason) AFTER `onFinally` completes. Both Caller A and Caller B receive the SAME resolved `CalendarEvent[]` from this wrapping promise.

6. **Both A and B's awaited results are the same `CalendarEvent[]` reference** — same network round-trip, same parse, same flatten, same cache write. The "double-render or duplicate event list" failure mode from BUG-06 is eliminated structurally.

7. **Caller C, invoked at any point after the `.finally()` callback fires in step 5,** sees `this.fetchInFlight === null` and starts a fresh fetch (assuming `needsRefresh` returns true). The cycle repeats.

Trace is sound. The `.finally` semantics critically depend on the chained `.finally()` promise resolving AFTER the callback completes — this is guaranteed by ECMAScript (TC39 `Promise.prototype.finally`).

## Stub Tracking

No new stubs introduced by this plan. Existing helpers (`showFetchNotification`, `showCompletionNotification`, `showErrorNotification`, `logPlatformInfo`) were preserved with their existing bodies.

## Verification

```
$ /Users/mike/code/memoChron/node_modules/typescript/bin/tsc -noEmit -skipLibCheck
(exit 0)

$ NODE_PATH=/Users/mike/code/memoChron/node_modules node esbuild.config.mjs production
(exit 0; main.js produced at 261275 bytes)

$ grep -c "isFetchingCalendars" src/services/CalendarService.ts
0

$ grep -c "fetchInFlight" src/services/CalendarService.ts
7

$ grep -c "errorMessage(error)" src/services/CalendarService.ts
5

$ grep -c '^import.*errorMessage.*errors' src/services/CalendarService.ts
1

$ grep -nE 'error\.message' src/services/CalendarService.ts
(no output — no unsafe error.message access remains)

$ grep -c "Promise<CalendarEvent\[\]> | null" src/services/CalendarService.ts
1

$ grep -c "setBackgroundRefreshTimer" src/services/CalendarService.ts
1

$ grep -A2 "if (this.fetchInFlight)" src/services/CalendarService.ts | head -4
    if (this.fetchInFlight) {
      return this.fetchInFlight;
    }

$ grep -c "this.fetchInFlight = this.performFetch" src/services/CalendarService.ts
1

$ grep -c "this.fetchInFlight = null" src/services/CalendarService.ts
1
```

All plan-level `<verification>` items are satisfied.

### Out-of-scope catches preserved

```
$ grep -n "    } catch {" src/services/CalendarService.ts
342:    } catch {

$ grep -B1 -A3 "Cannot read file:" src/services/CalendarService.ts
            status: 404,
            text: `Cannot read file: ${pathInfo.normalizedPath}`,
          };
        }
```

Both out-of-scope sites (`:342` parameter-less mkdir, `:516`–`:521` discarded-error adapter.read) are unchanged.

### scheduleBackgroundRefresh unchanged

The `scheduleBackgroundRefresh` body retains its Phase 1 (CR-01) shape: `this.plugin.setBackgroundRefreshTimer(() => this.fetchCalendars(sources, true), 100)`. The dedup naturally applies because the timer callback enters `fetchCalendars` and hits the new entry guard.

## Threat Flags

None — no new security-relevant surface introduced. All edits are to existing seams already covered by the plan's `<threat_model>`. The new `fetchInFlight` field is a private in-memory dedup signal with no external trust boundary; the catch normalizations strictly reduce attack surface by eliminating the unsafe `error.message` access patterns.

## Self-Check

Created files: (none — this plan only modifies one existing file)

```
$ [ -f .planning/phases/02-security-correctness/02-05-SUMMARY.md ] && echo "FOUND: 02-05-SUMMARY.md"
FOUND: 02-05-SUMMARY.md
```

Commits exist:

```
$ for h in 0cd9540 e114a5a; do
    git log --oneline --all | grep -q "$h" && echo "FOUND: $h" || echo "MISSING: $h"
  done
FOUND: 0cd9540
FOUND: e114a5a
```

## Self-Check: PASSED

---
*Phase: 02-security-correctness*
*Completed: 2026-05-11*
