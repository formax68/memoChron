---
phase: 08-type-hygiene-conventions
plan: 03
subsystem: infra
tags: [eslint, no-console, logging, dir-01, type-hygiene, refactor]

# Dependency graph
requires:
  - phase: 08-type-hygiene-conventions
    provides: "08-01 — DIR-10 unused-vars / imports cleanup (Wave 1)"
  - phase: 08-type-hygiene-conventions
    provides: "08-02 — DIR-09 any/case-decl/useless-escape (Wave 2)"
provides:
  - "DIR-01 fully closed at source: 0 bare `console.*` lines across `src/`"
  - "33 deletions (no behavior change — each was paired with Notice, lifecycle noise, or silent recovery)"
  - "6 forensic logs preserved behind compile-time `const DEBUG = false` (tree-shakeable when false)"
  - "Per-line `eslint-disable-next-line no-console -- DEBUG flag (Phase 8 D-07)` on each of the 6 gated sites, ready for Plan 04 to remove the global no-console override"
  - "Two per-file DEBUG flags (CalendarService.ts, timezoneUtils.ts) — no shared utils/debug.ts (D-07 default)"
affects: [08-04-PLAN, 08-05-PLAN, dir-01, dir-09, dir-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compile-time `const DEBUG = false` per-file flag with `if (DEBUG) console.X(...)` wrapper for forensic logs (Phase 8 D-07)"
    - "Per-line `eslint-disable-next-line no-console -- DEBUG flag (Phase 8 D-07)` on each gated site so they survive Plan 04's global override removal"

key-files:
  created: []
  modified:
    - src/services/CalendarService.ts
    - src/utils/timezoneUtils.ts
    - src/main.ts
    - src/services/NoteService.ts
    - src/services/IcsImportService.ts
    - src/settings/SettingsTab.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedCalendarView.ts
    - src/views/EmbeddedAgendaView.ts

key-decisions:
  - "Followed RESEARCH.md §DIR-01 Console Audit per-site classification verbatim — all 4 GATE sites and all 33 DELETE sites match the table"
  - "Removed orphaned `logPlatformInfo()` method and its single call site after deleting its sole body (console.debug at :926); removed the now-unused `Platform` import"
  - "Removed useless try/catch wrapper from NoteService.createEventNote that only re-threw after console.error deletion (avoids `no-useless-catch` lint error)"
  - "Updated CalendarView event-click Notice text from 'Failed to create note. Check the console for details.' to inline `errorMessage(error)` — the console it referenced was deleted (Rule 1: preserve user-visible signal)"
  - "Collapsed unused `catch (error)` bindings to `catch {}` where the binding was solely the deleted console.* argument — matches Wave 1's D-09 convention (12 catch sites adjusted total)"

patterns-established:
  - "Forensic-only debug log: `if (DEBUG) console.X(...)` with per-file `const DEBUG = false;` and per-line eslint-disable. Tree-shakes when false; flip locally for support work."

requirements-completed: [DIR-01]

# Metrics
duration: ~45min
completed: 2026-05-17
---

# Phase 8 Plan 3: DIR-01 Console Cleanup Summary

**Closed DIR-01 (39 `console.*` sites across 11 files) — 33 deleted, 6 gated behind compile-time `const DEBUG = false`; zero bare `console.*` survives in `src/`; rule-explicit `no-console: error` lint pass is clean.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-17T06:05Z (approximate, from session start)
- **Completed:** 2026-05-17T06:51Z
- **Tasks:** 4 (3 source-modifying + 1 verification)
- **Files modified:** 9

## Accomplishments

- 33 `console.*` calls deleted across 9 files (every deleted site was either paired with a user-visible `Notice`, lifecycle noise, or silent recovery — zero loss of user-visible signal)
- 6 forensic `console.*` calls gated behind `if (DEBUG) console.X(...)` with `const DEBUG = false;` at the top of `CalendarService.ts` (4 sites) and `timezoneUtils.ts` (2 sites)
- Per-line `// eslint-disable-next-line no-console -- DEBUG flag (Phase 8 D-07)` on each gated site, so Plan 04's `no-console: "off"` override removal will land clean
- `npm run lint` exits 0; `npm run build` exits 0; rule-explicit `npx eslint 'src/**/*.ts' --rule 'no-console: error'` reports 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: CalendarService.ts — gate 4 forensic sites, delete 10 others** — `4093f7b` (refactor)
2. **Task 2: timezoneUtils.ts — gate 2 forensic sites, delete 3 others** — `d959546` (refactor)
3. **Task 3: Delete `console.*` in remaining 7 files** — `6018b6a` (refactor)
4. **Task 4: Full audit, lint, build** — no source-level commit (verification only; SUMMARY commit is the closing artifact)

## Files Created/Modified

| File | Site classification | Adjacent cleanup |
|------|---------------------|------------------|
| `src/services/CalendarService.ts` | 14 sites (4 GATE / 10 DELETE) | Removed orphaned `logPlatformInfo()` method + call site + unused `Platform` import; collapsed `catch (error)` → `catch {}` at outer `fetchCalendars` |
| `src/utils/timezoneUtils.ts` | 5 sites (2 GATE / 3 DELETE) | Collapsed two `catch (error)` → `catch {}` in `toJSDate` fallback branches |
| `src/main.ts` | 2 DELETE | None (silent replacement already in place) |
| `src/services/NoteService.ts` | 6 DELETE | Removed useless try/catch wrapper in `createEventNote` (only re-threw); collapsed 5 `catch (error)` → `catch {}` |
| `src/services/IcsImportService.ts` | 2 DELETE | Collapsed if/else (`console.debug` vs `console.warn` branches) into single `catch {}` |
| `src/settings/SettingsTab.ts` | 2 DELETE | None |
| `src/views/CalendarView.ts` | 6 DELETE | Updated event-click Notice text to inline `errorMessage(error)` (referenced "the console" which no longer exists); collapsed 3 `catch (error)` → `catch {}` |
| `src/views/EmbeddedCalendarView.ts` | 1 DELETE | Collapsed 1 `catch (error)` → `catch {}` |
| `src/views/EmbeddedAgendaView.ts` | 1 DELETE | Collapsed 1 `catch (error)` → `catch {}` |

## Decisions Made

- **All RESEARCH.md classifications honored verbatim.** Zero classification disagreements; the executor cross-referenced each of the 39 sites against the audit table in `08-RESEARCH.md` §"DIR-01 Console Audit" (lines 418–468) before acting. No DELETE-to-GATE or GATE-to-DELETE downgrades.
- **Used the no-brace form of the gate pattern.** Plan `<interfaces>` showed `if (DEBUG) console.X(...);`, plan acceptance grep `grep -cE 'if \(DEBUG\) console\.'` requires the no-brace form. The plan's must_haves text used `if (DEBUG) { console.X(...) }` (with braces) but that's inconsistent with both the acceptance grep and the example; the grep is the authoritative test. Confirmed: 4 hits in CalendarService.ts and 2 in timezoneUtils.ts under the no-brace form.
- **Live line-number drift accommodated.** Plan referenced original-frontmatter line numbers (e.g., `console.error` at :387 in CalendarService.ts); live grep at execution time showed slightly different numbers (e.g., :390) due to Wave 1 & 2 edits. The executor mapped sites by surrounding content rather than line number, which is the correct fallback when the audit table's content claims are stable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Removed useless try/catch wrapper in `NoteService.createEventNote`**

- **Found during:** Task 3 (NoteService.ts deletions)
- **Issue:** After deleting `console.error` from the catch block, the catch only re-threw, producing `no-useless-catch` lint error. Build would fail.
- **Fix:** Removed the try/catch wrapper entirely. `createEventNote` is `async`, so any thrown error already propagates to the caller — which is `CalendarView`'s click handler that catches and shows a Notice.
- **Files modified:** `src/services/NoteService.ts`
- **Verification:** `npx eslint src/services/NoteService.ts` exits clean.
- **Committed in:** `6018b6a` (Task 3 commit)

**2. [Rule 1 — Bug] Updated CalendarView event-click Notice text to embed `errorMessage(error)` inline**

- **Found during:** Task 3 (CalendarView.ts deletions)
- **Issue:** The Notice text was "Failed to create note. Check the console for details." — but DIR-01 deletes the console.error this referenced. Following the deletion would have left users staring at a "check the console" hint with nothing to find.
- **Fix:** Changed Notice to `Failed to create note: ${errorMessage(error)}` so the message itself surfaces the underlying error reason.
- **Files modified:** `src/views/CalendarView.ts`
- **Verification:** Build clean; matches RESEARCH.md classification intent ("paired with Notice — already user-visible elsewhere").
- **Committed in:** `6018b6a` (Task 3 commit)

**3. [Rule 3 — Blocking] Removed orphaned `logPlatformInfo()` method and its only call site (+ unused `Platform` import) in CalendarService**

- **Found during:** Task 1 (CalendarService.ts deletions)
- **Issue:** RESEARCH classifies `console.debug("Platform info: ...")` (the entire body of `logPlatformInfo()`) as DELETE. With the body gone, the method became an empty private function with one caller (`fetchCalendar` catch block). Leaving it would be dead code; leaving the unused `Platform` import would be a `no-unused-vars` error (CalendarService.ts has the rule turned off in `eslint.config.mjs:102` but Plan 04 will narrow that exclusion).
- **Fix:** Deleted the empty method, deleted its single call site (`this.logPlatformInfo();` in the fetch-caught branch), removed `Platform` from the `obsidian` import.
- **Files modified:** `src/services/CalendarService.ts`
- **Verification:** Build clean; `grep -n Platform src/services/CalendarService.ts` shows no matches.
- **Committed in:** `4093f7b` (Task 1 commit)

**4. [Rule 1 — Convention] Collapsed 12 `catch (error)` → `catch {}` bindings where the binding was solely the deleted console.* argument**

- **Found during:** Tasks 1, 2, 3
- **Issue:** After deleting `console.X("...", errorMessage(error))`, the catch `error` binding became unused.
- **Fix:** Per CONTEXT.md D-09 (Wave 1's established convention), unused catch bindings → `catch {}` (TypeScript 4.4+ optional catch binding). Aligns with Wave 1's prior conversions (CalendarService.ts:531, SettingsTab.ts:1174).
- **Files modified:** All 9 files in scope, varied counts (CalendarService 1, timezoneUtils 2, NoteService 5, IcsImportService 1, CalendarView 3, EmbeddedCalendarView 1, EmbeddedAgendaView 1 — wait actually NoteService had 5 because of the removed try/catch wrapper combining with 4 other consoles plus EmbeddedAgendaView 1 and CalendarView 3 — see commit diffs for exact list).
- **Verification:** `npm run lint` exits 0 across all touched files.
- **Committed in:** `4093f7b`, `d959546`, `6018b6a` (per file in the relevant task commit)

**5. [Rule 1 — Bug] Updated `EmbeddedAgendaView` and `EmbeddedCalendarView` Notice text untouched (no change needed)**

- Note: these views' Notices say "Failed to open daily note. Make sure Daily Notes plugin is enabled and configured." — that text doesn't reference the console, so no Notice update was needed even though the paired console.error was deleted. Only `CalendarView`'s event-click Notice referenced the console (item 2 above).

---

**Total deviations:** 5 auto-fix categories (1 useless try/catch removal, 1 Notice text update, 1 orphaned-method removal + import cleanup, 12 catch-binding collapses, 1 verified-no-action-needed)

**Impact on plan:** All deviations were direct consequences of DIR-01 deletions, not scope creep. The lint-driven blocking fixes (useless try/catch, unused Platform import) are mandatory for build to pass. The Notice-text update preserves user-visible signal (Rule 1). The catch-binding collapses align with Wave 1's already-committed D-09 convention. None of the deviations exceed the plan's stated "where a `console.*` is paired with a user-visible `Notice`, DELETE without exception" scope rule.

## Issues Encountered

- **Line-number drift between plan and live source:** Plan's RESEARCH.md classification table referenced line numbers from the original-frontmatter audit (e.g., CalendarService.ts :387). Live grep at the start of Task 1 showed sites at slightly shifted numbers (e.g., :390) due to Wave 1 (08-01) and Wave 2 (08-02) edits. Resolved by matching sites on content (error string and surrounding context) rather than line number — the audit table's content claims were stable.
- **CONTEXT.md vs live grep count for CalendarService.ts:** CONTEXT.md per-file list said `(15)` in the summary header but enumerated 14 lines. Live grep confirms 14 sites in CalendarService.ts; the aggregate 39 = 33 DELETE + 6 GATE still holds. Plan's own count reconciliation note covered this — followed without issue.
- **Plan Task 3 header off-by-one:** Plan Task 3 title says "19 sites total" but the per-file breakdown sums to 20 (2+6+2+2+6+1+1). The 20 matches the underlying audit table. Documented in the Task 3 commit body.

## User Setup Required

None - no external service configuration required. DIR-01 is internal code hygiene with no user-facing behavior change.

## Aggregate Verification

```
=== Full-tree console audit (grep -rnE '^\s*console\.' src/) ===
(no matches)

=== Gated-site enumeration (grep -rcE 'if \(DEBUG\) console\.' src/) ===
src/utils/timezoneUtils.ts:2
src/services/CalendarService.ts:4

=== Total DEBUG flags ===
src/utils/timezoneUtils.ts (1)
src/services/CalendarService.ts (1)

=== Rule-explicit lint (npx eslint 'src/**/*.ts' --rule 'no-console: error') ===
0 errors

=== npm run lint ===
exit 0 (warnings only — "Unused eslint-disable directive" on the 6 gated
sites; these become active once Plan 04 removes the global no-console
override at eslint.config.mjs:85)

=== npm run build ===
exit 0 (tsc -noEmit + esbuild production)
```

**Aggregate confirmation:** 33 DELETE + 6 GATE = 39 across all 11 files in scope. Matches plan must_haves.

## Self-Check: PASSED

- **All 4 tasks executed.** Tasks 1, 2, 3 produced source-modifying commits (`4093f7b`, `d959546`, `6018b6a`); Task 4 was pure verification (no source change, no separate commit — the SUMMARY commit closes the wave).
- **All 3 task commits exist** — verified via `git log --oneline -5`.
- **All 9 modified files exist and reflect changes** — verified via per-file grep counts in Aggregate Verification above.
- **No AI/Claude references in commit messages** — `git log -3 --pretty=%B | grep -iwE 'claude|anthropic'` returns no matches.

## Next Phase Readiness

- **Plan 04 (override delete)** can now proceed: the per-line `eslint-disable-next-line` directives on the 6 gated sites mean that when `eslint.config.mjs:78–96` is deleted, `no-console: error` will activate globally with zero violations.
- **Plan 05 (DOC-02 conventions)** can reference the `DEBUG`-flag pattern as the canonical "intentional escape hatch" example for the Type Hygiene cluster in CONVENTIONS.md.

---
*Phase: 08-type-hygiene-conventions*
*Plan: 03*
*Completed: 2026-05-17*
