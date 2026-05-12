# Phase 3: Date Parsing & Navigation Bugs - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Bug-fix-only phase — four tightly-scoped requirements, no new user-facing features:

- **BUG-01** — Filenames like `2026-01-15.md` parsed via `parseDateFromFilename` produce a Date that represents the user's local calendar day, not UTC midnight. Resolves issue #59 for Montreal/Americas timezones.
- **BUG-02** — Month/week navigation arrows feel instantaneous; no `await fetchCalendars` blocks the paint on a navigation click.
- **BUG-03** — After a drag-resize from month-height to week-height, the Today button navigates to the current week (not just the current month). The view-mode dropdown sync is verified-already-working — only the Today path needs the fix.
- **BUG-04** — Verify the `29-01-2026` → `20/01/2029` regression from #56 is closed post-#58/Phase-3, document the closure, and delete the unreachable duplicate regex.

Goal at end of phase: a daily-note `2026-01-15.md` in `TZ=America/New_York` selects January 15 events (not January 14); arrow clicks paint without awaiting a network round-trip; the Today button works regardless of view mode after a drag-resize; BUG-04 is closed with an artifact a future maintainer can find.

</domain>

<decisions>
## Implementation Decisions

### BUG-01 — date construction API (Area 1)

- **D-01:** `parseDateFromFilename` (`src/utils/viewRenderers.ts:418–477`) constructs every Date using the **local-time numeric constructor** `new Date(year, month - 1, day)`. Every one of the six format branches normalizes its digits into `year`, `month`, `day` integers, then calls the numeric constructor. The string-form `new Date(dateStr)` (which evaluates `YYYY-MM-DD` as UTC midnight) is removed from all six branches.
- **D-02:** No new library is introduced for this fix. Luxon is already a dep (used in `timezoneUtils`) but the numeric-args `Date` constructor is more explicit at the call site, ships zero new abstraction, and keeps the diff small. A `parseLocalDate(y, m, d)` helper is the planner's call — if it improves readability across the six branches, extract it; otherwise inline.
- **D-03:** Fix scope is **`parseDateFromFilename` only**. The fallback `new Date(input)` at line 410 stays — that branch handles arbitrary caller-supplied strings (potentially full ISO datetimes with timezone info), and changing it would break the existing contract. The `today`/`tomorrow`/`yesterday` keywords already use local `new Date()` and need no change. No broader audit of `new Date(string)` sites elsewhere in `src/` — the success criterion is specifically about daily-note filenames.

### BUG-02 — navigation perceived performance (Area 2)

- **D-04:** `navigate()` (`CalendarView.ts:314–322`) **does not await `fetchCalendars`**. It updates `currentDate`, then calls `renderCalendar()` and `showDayAgenda()` synchronously against the events already in `CalendarService` memory. The arrow-click → paint path becomes a pure render — no network, no I/O.
- **D-05:** After the synchronous render completes, if `this.plugin.calendarService.needsRefresh()` returns true, `navigate()` fires-and-forgets a background `fetchCalendars(...)`. The Phase 2 `fetchInFlight` shared-Promise (Phase 2 D-12) dedups it against the `setupAutoRefresh` interval timer so concurrent triggers collapse into one network round-trip. When the promise resolves, the view re-renders so any newly-fetched events appear.
- **D-06:** `goToToday()` (`CalendarView.ts:324–333`) follows the **same decoupled pattern** as `navigate()` — render synchronously from cached events, fire-and-forget a stale-cache fetch in the background. This keeps the Today button equally snappy and matches the new navigation contract.
- **D-07:** `refreshEvents()` (`CalendarView.ts:101–118`) keeps its current await-then-render shape for **explicit user actions** only — `force-refresh-calendars` command, `layout-change` workspace events, view init in `onOpen()`. Renaming or splitting `refreshEvents` into a `renderFromCache()` / `fetchAndRender()` pair is the planner's call.

### BUG-03 — Today button semantics (Area 3)

- **D-08:** `goToToday()` **always reassigns `currentDate = today`**, re-renders, and selects today — regardless of view mode and regardless of whether today is already in the visible range. The current `isSameMonth(...)` short-circuit is dropped. Rationale: render is fast enough (especially after D-04) that the "no-op when already showing today" optimization is invisible; symmetric behavior is easier to reason about and works correctly in 1–5 week modes where today often falls in the current month but a different week.
- **D-09:** `viewMode` is **not changed** by Today — the button resets the date, not the view shape. A user in 2-week mode who clicks Today stays in 2-week mode, recentered on today's week. The week range falls out naturally because `renderWeekDays` recomputes `getStartOfWeek(this.currentDate)`.
- **D-10:** The view-mode-dropdown half of success criterion #3 is **already working** in the current code: `showViewMenu` rebuilds the Menu fresh on every click with `setChecked(this.viewMode === value)`, and `handleDragMove` updates `viewMode` mid-drag via `recalculateViewModeFromHeight`. No code change needed for the dropdown — but the planner notes this fact so verification doesn't go hunting. A quick read-the-code confirmation step suffices; the HUMAN-UAT entry for BUG-03 covers it from the user's side.

### BUG-04 — verification artifact (Area 4)

- **D-11:** A code comment on the DD-MM-YYYY/MM-DD-YYYY branch in `parseDateFromFilename` names issue #56, the post-#58 fix, and the Phase 3 BUG-01 closure. Pattern: `// #56 regression closed post-#58 (and BUG-01 fix in Phase 3 — local-day construction). 29-01-2026 → 2026-01-29 local.` Short, greppable for future maintainers, no hand-wave.
- **D-12:** A HUMAN-UAT entry walks through the user-facing check: rename or create a daily note `29-01-2026.md`, click it in the file explorer, confirm the agenda selects 29 January 2026 (not 20 January 2029). This is the "confirmed" half of the success criterion.
- **D-13:** **Remove the unreachable duplicate regex** at `viewRenderers.ts:433` (`/(\d{2}-\d{2}-\d{4})/` is listed at line 431 AND line 433 — the second one is shadowed by the first and never matches). The behavior is preserved by the dual-parse fallback inside the matched branch; the duplicate is dead weight.

### Claude's Discretion

- **Helper extraction** — whether the six branches share a private `parseLocalDate(y, m, d): Date` helper or inline the numeric constructor is the planner's call. Either is fine; readability wins.
- **`refreshEvents` refactor shape** — splitting into `renderFromCache()` + `fetchAndRender()`, or keeping a single function with a `{ skipFetch?: boolean }` flag, or introducing a private `renderCurrentRange()` helper, is the planner's call. The contract (navigate ≠ fetch) is what matters.
- **`layout-change` listener** (`CalendarView.ts:303–309`) — currently calls `refreshEvents()`. The planner decides whether it keeps the await-fetch semantics (workspace layout events are rare and warrant a fresh fetch) or switches to the navigate-style pattern. Default: keep current semantics (rare event, fresh-fetch acceptable).
- **Commit granularity** — per-requirement atomic commits is the GSD default. BUG-02 and BUG-03 share `goToToday`'s touch site (D-06 and D-08 both modify it), so a single commit covering both is acceptable. Planner decides.
- **Verification approach** — code review + HUMAN-UAT (per-milestone default; no test suite in scope).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project artifacts
- `.planning/ROADMAP.md` — Phase 3 entry; 4 success criteria mapping 1:1 to BUG-01..BUG-04
- `.planning/REQUIREMENTS.md` — BUG-01..BUG-04 acceptance language; out-of-scope list (test suite and accessibility are explicitly deferred)
- `.planning/PROJECT.md` — milestone framing, constraint list (mobile compatibility, no remote code, BRAT release flow)
- `.planning/STATE.md` — Phase 2 outputs (Phase 2 closed 2026-05-11 with `fetchInFlight` shared-Promise in place; `errorMessage()` helper available); blocker: BUG-01 requires `TZ=America/New_York` UAT step

### Codebase intel
- `.planning/codebase/CONCERNS.md` — Known Bugs section (#59 timezone off-by-one; `getStartOfWeek` analysis from Phase 2 confirms it is correct-but-non-obvious — no work here); Tech Debt / Performance Bottlenecks for context only
- `.planning/codebase/ARCHITECTURE.md` — service composition; `CalendarService.events` is the in-memory cache that `navigate()` will render from in D-04
- `.planning/codebase/CONVENTIONS.md` — naming conventions, error-handling pattern (`errorMessage()` from Phase 2)
- `.planning/phases/01-foundation/01-CONTEXT.md` — live-settings pattern (services hold `plugin: MemoChron`); `registerInterval` wraps for timer ownership
- `.planning/phases/02-security-correctness/02-CONTEXT.md` — `fetchInFlight` shared-Promise (D-12) — the dedup gate that D-05 relies on; `errorMessage()` helper at `src/utils/errors.ts`

### Project rules
- `CLAUDE.md` — Obsidian plugin best practices; commit message hygiene (NO Claude / AI references); mobile compatibility (`isDesktopOnly: false`); BRAT release flow

### Source files this phase will touch
- `src/utils/viewRenderers.ts` — `parseDateFromFilename` lines 418–477 (six branches converted to local-date construction); line 433 duplicate regex removed; new code comment naming #56/#58/BUG-01 closure on the DD-MM-YYYY branch
- `src/views/CalendarView.ts`:
  - `navigate(delta)` lines 314–322 — drop the `await refreshEvents()`; render synchronously and fire-and-forget stale fetch
  - `goToToday()` lines 324–333 — always reassign `currentDate = today`; drop the `isSameMonth` short-circuit; same decoupled-fetch pattern as `navigate`
  - `refreshEvents(forceRefresh)` lines 101–118 — possibly split into render-only and fetch-then-render variants (planner's call)
  - `layout-change` handler lines 303–309 — keep current semantics (planner's call)

### Source files unchanged (verified-already-working)
- `src/views/CalendarView.ts` `showViewMenu` (lines 249–276) — dropdown checkmark already reads live `viewMode`; no change
- `src/views/CalendarView.ts` `handleDragMove` (lines 1098–1114) — already updates `viewMode` mid-drag; no change

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`CalendarService.fetchInFlight`** (Phase 2 D-12) — the shared in-flight Promise on `CalendarService` is the dedup gate that makes D-05's fire-and-forget background fetch safe against the `setupAutoRefresh` timer. No new dedup logic needed.
- **`CalendarService.needsRefresh()`** — already returns true/false based on `lastFetch` and live `refreshInterval` (Phase 1 D-02). D-05 calls it before deciding to spawn the background fetch.
- **`CalendarService.getAllEvents()` / `getEventsForDate()`** — already exposed; render-only path in D-04 reads from these without re-running fetch.
- **`errorMessage()` helper** at `src/utils/errors.ts` (Phase 2 D-09) — any new catch blocks (background fetch promise rejection in D-05) use it for consistency.
- **`renderCalendar()` + `showDayAgenda()`** — both are already synchronous and read directly from the in-memory cache. D-04 wires `navigate()` straight to them.

### Established Patterns
- **Live-settings reads** (Phase 1 D-03) — `this.plugin.settings.refreshInterval` is read fresh by `needsRefresh()`; no stale-copy concerns.
- **`registerInterval` wraps for cleanup** (Phase 1 D-05) — D-05's fire-and-forget fetch uses the existing `scheduleBackgroundRefresh`-style pattern OR adds a top-level `void this.plugin.calendarService.fetchCalendars(...)` after render. If the latter, no new timer is created, so no `registerInterval` is required.
- **Numeric Date constructor** is the established local-date idiom — `renderMonthDays` already uses `new Date(year, month, day)` at line 494; D-01 stays consistent with that.

### Integration Points
- `navigate()` → `renderCalendar()` + `showDayAgenda()` directly (D-04). The async `refreshEvents()` stays for explicit refresh paths.
- `goToToday()` → same direct render + fire-and-forget fetch (D-06).
- `parseDateFromFilename` is called from `parseDate()` (line 391) which is exported and consumed by `EmbeddedAgendaView.ts:45` and `EmbeddedCalendarView.ts:46`. The fix transparently improves both embedded views.

</code_context>

<specifics>
## Specific Ideas

- The BUG-01 fix is structural: `new Date("2026-01-15")` is the bug, `new Date(2026, 0, 15)` is the fix. Researcher should not propose adding a timezone-offset compensation hack on top of the string constructor — the right answer is to never go through the string-parse path.
- The BUG-02 fix is also structural: navigate stops awaiting `fetchCalendars`. The shared-Promise dedup from Phase 2 means a fire-and-forget background fetch is safe against the auto-refresh timer.
- For BUG-03, the planner should not invent a "current week range" comparison helper unless a callsite besides Today needs it. D-08 says Today always recenters — the comparison is unnecessary.
- For BUG-04, the code comment goes on the DD-MM-YYYY/MM-DD-YYYY branch (around line 456 today) because that's the branch that handles `29-01-2026`. The comment names #56, the #58 fix, and the Phase 3 BUG-01 closure — three references in one line. The duplicate regex at line 433 is dead code, not a bug; removing it is hygiene.
- HUMAN-UAT entries are the verification artifact this milestone — same pattern as Phase 1 and Phase 2 (see `01-HUMAN-UAT.md`, `02-HUMAN-UAT.md`).

</specifics>

<deferred>
## Deferred Ideas

- **PERF-04** — replacing magic 50ms / 100ms `setTimeout` calls with `requestAnimationFrame` / `requestIdleCallback`. Stable today; defer to a perf milestone (already in REQUIREMENTS.md Out of Scope).
- **PERF-02** — caching `enabledSources` Set in `getEventsForWidget`. Out of scope for this milestone.
- **FRAG-01** — wrapping `(window as any).moment` in a single utility with absence detection. Still in place at the post-render daily-note lookups; deferred per Phase 2 carry-forward.
- **`refreshEvents` split into separate render-only / fetch-then-render functions** — if the planner extracts these, fine; if a single function with a flag is simpler, also fine. Future readability fix if either path grows.
- **Audit `new Date(string)` everywhere** — D-03 explicitly leaves the line 410 fallback alone. If a future bug surfaces from a different `new Date(string)` site, address it then; no preemptive sweep this phase.
- **Optimistic Today recenter when already in view** — D-08 always recenters. If profiling ever shows the render is non-trivial, the optimization can come back. Not now.

</deferred>

---

*Phase: 03-date-parsing-navigation-bugs*
*Context gathered: 2026-05-12*
