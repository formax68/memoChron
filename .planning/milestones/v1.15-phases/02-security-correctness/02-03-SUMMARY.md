---
phase: 02-security-correctness
plan: 03
subsystem: error-handling
tags: [errors, catch-normalization, sec-02, helper-extraction, defensive-coding]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Service constructor signatures + live-settings reads pattern (unchanged here, but the helper's
      design preserves Phase 1's "plain function utility module" style established by pathUtils.ts and
      timezoneUtils.ts).
provides:
  - "src/utils/errors.ts exporting errorMessage(err: unknown): string"
  - "13 catch sites normalized across 5 small-touch files (NoteService, IcsImportService, EmbeddedCalendarView, EmbeddedAgendaView, timezoneUtils)"
  - "Plans 02-04 (CalendarView) and 02-05 (CalendarService) can now import { errorMessage } from `../utils/errors` without further setup"
affects: [02-04, 02-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-purpose utility module with no imports — sibling of pathUtils.ts/timezoneUtils.ts naming pattern"
    - "Centralized error-message extraction via errorMessage(err: unknown): string"
    - "Catch blocks read errorMessage(error) into a local `const message` when used 2+ times; pass inline otherwise"

key-files:
  created:
    - "src/utils/errors.ts (10 lines, single export, no imports)"
  modified:
    - "src/services/NoteService.ts (6 catch sites; removed `catch (error: any)` annotation; removed unsafe optional chaining on error.message)"
    - "src/services/IcsImportService.ts (2 catch sites; consolidated bespoke instanceof check + redundant typeof error.message guard; enriched fallback throw message)"
    - "src/views/EmbeddedCalendarView.ts (1 catch site)"
    - "src/views/EmbeddedAgendaView.ts (1 catch site)"
    - "src/utils/timezoneUtils.ts (3 catch sites; diagnostic context object preserved at the conversion-failure site)"

key-decisions:
  - "Helper body is the one-line form err instanceof Error ? err.message : String(err) per D-09 — single point of change for future format extensions (Error.cause unwrapping is explicitly deferred per CONTEXT.md)"
  - "IcsImportService:91-96 re-throw branch preserved verbatim — only the fallback throw is enriched with errorMessage; this keeps original Error stack traces intact when an Error is re-thrown"
  - "IcsImportService timezone-register catch consolidates the bespoke `typeof error.message === 'string'` defensive check away because errorMessage() is documented to always return a string"
  - "NoteService:415 `catch (error: any)` annotation removed entirely; optional chaining on error.message no longer needed since helper always returns string"
  - "timezoneUtils:222 diagnostic context object (icalTime, normalizedTzid, mappedZone, zone) preserved as the 3rd console.error argument — debugging payload survives the refactor"

patterns-established:
  - "Pattern A — verbose: `} catch (error) { const message = errorMessage(error); ... uses message multiple times ... }` (used when the message is checked OR logged AND surfaced via Notice)"
  - "Pattern B — inline: `} catch (error) { console.error('context:', errorMessage(error)); }` (used when error appears only in a single console call)"
  - "Pattern C — preserve re-throw: `} catch (error) { if (error instanceof Error) { throw error; } throw new Error(\\`...: ${errorMessage(error)}\\`); }` (used when fallback path must wrap non-Error throwables)"

requirements-completed: [SEC-02]

# Metrics
duration: ~10min
completed: 2026-05-11
---

# Phase 2 Plan 3: errorMessage Helper + Wave-1 Catch Normalization Summary

**Established `src/utils/errors.ts` exporting `errorMessage(err: unknown): string`, then routed all 13 catch sites in the five small-touch files (NoteService, IcsImportService, EmbeddedCalendarView, EmbeddedAgendaView, timezoneUtils) through it — eliminating `[object Object]` / `undefined` failure-message risk and removing one `catch (error: any)` annotation plus one bespoke `typeof error.message === "string"` defensive check.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-11T06:14:00Z (approx — at plan execution kickoff)
- **Completed:** 2026-05-11T06:24:20Z
- **Tasks:** 3
- **Files modified:** 5 (plus 1 new file: `src/utils/errors.ts`)

## Accomplishments

- Wave-1 unblocker for Plans 02-04 and 02-05: both can now `import { errorMessage } from "../utils/errors"` against an existing, type-checked, build-clean target.
- 13 catch sites normalized — every visible error path in the 5 small-touch files extracts a printable message specifically, with no `[object Object]` or `undefined` failure mode.
- Two structural cleanups absorbed without behavior change:
  - `NoteService.ensureFolderExists` `catch (error: any)` → plain `catch (error)`; optional chaining on `error.message` removed (helper always returns a string).
  - `IcsImportService` timezone-register catch — the bespoke `error instanceof Error && typeof error.message === "string"` guard collapses to a single `errorMessage(error)` call; behavior preserved per D-11.
- `IcsImportService.parseSingleEvent` fallback throw enriched: `Failed to parse ICS file: ${errorMessage(error)}` instead of the bare `"Failed to parse ICS file"` string. Re-throw branch preserved verbatim so original Error stack traces are not lost.
- `timezoneUtils.convertIcalTimeToDate` diagnostic context object (`{ icalTime, tzid: normalizedTzid, mappedZone, zoneUsed }`) preserved as the 3rd argument to `console.error` — debugging payload remains intact.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create `src/utils/errors.ts` with errorMessage helper** — `56595fc` (feat)
2. **Task 2: Normalize catch blocks in NoteService.ts and IcsImportService.ts** — `c322081` (refactor)
3. **Task 3: Normalize catch blocks in EmbeddedCalendarView, EmbeddedAgendaView, and timezoneUtils** — `263a50c` (refactor)

## Files Created/Modified

### Created

- `src/utils/errors.ts` — 10 lines, no imports, single named export `errorMessage(err: unknown): string` with JSDoc following the `timezoneUtils.ts` style. Body: `return err instanceof Error ? err.message : String(err);`.

### Modified

- `src/services/NoteService.ts` — added `import { errorMessage } from "../utils/errors";`. All 6 catches normalized:
  - `createEventNote` (~74) — `console.error("Error creating note:", errorMessage(error))` + preserved `throw error`.
  - `buildFilePath` (~127) — `console.error("Error building file path:", errorMessage(error))` + preserved fallback path.
  - `generateNoteContent` (~165) — `console.error("Error generating note content:", errorMessage(error))` + preserved fallback content string.
  - `applyTemplateVariables` (~268) — `console.error("Error applying template variables:", errorMessage(error))` + preserved `return template`.
  - `formatTitle` (~290) — `console.error("Error formatting title:", errorMessage(error))` + preserved fallback `event.title || "Untitled Event"`.
  - `ensureFolderExists` (~415) — `catch (error: any)` → `catch (error)`; `!error.message?.includes("already exists")` → `!errorMessage(error).includes("already exists")`. Behavior preserved.
- `src/services/IcsImportService.ts` — added `import { errorMessage } from "../utils/errors";`. 2 catches normalized:
  - Timezone-register catch (~30): bespoke `error instanceof Error && typeof error.message === "string"` guard removed; `const message = errorMessage(error);` then branch on `message.includes(...)`. `console.debug` and `console.warn` paths preserved (now log the helper output rather than the raw error object).
  - `parseSingleEvent` outer catch (~91): re-throw branch (`if (error instanceof Error) throw error;`) preserved verbatim per D-11; fallback `throw new Error(...)` enriched with `: ${errorMessage(error)}` suffix.
- `src/views/EmbeddedCalendarView.ts` — added `import { errorMessage } from "../utils/errors";`. 1 catch normalized at `handleDailyNoteClick` (~233): `console.error("Failed to handle daily note:", errorMessage(error))`. User-visible Notice text unchanged.
- `src/views/EmbeddedAgendaView.ts` — added `import { errorMessage } from "../utils/errors";`. 1 catch normalized at `handleDailyNoteClick` (~376): mirror of EmbeddedCalendarView. Notice text unchanged.
- `src/utils/timezoneUtils.ts` — added sibling import `import { errorMessage } from "./errors";`. 3 catches normalized:
  - `convertIcalTimeToDate` floating-time `toJSDate` fallback (~178) — `console.warn(..., errorMessage(error))`.
  - `convertIcalTimeToDate` custom-tzid `toJSDate` fallback (~200) — `console.warn(..., errorMessage(error))`.
  - `convertIcalTimeToDate` top-level conversion-failure (~223) — `console.error("Failed to convert ICAL time:", errorMessage(error), { icalTime, tzid: normalizedTzid, mappedZone, zoneUsed })`. Diagnostic context object preserved verbatim.

## Decisions Made

- **Helper signature exactly matches D-09 spec** (`err instanceof Error ? err.message : String(err)`). No `error.cause` unwrapping — explicitly deferred per CONTEXT.md "Deferred Ideas".
- **Pattern A vs Pattern B applied site-by-site:** when the message is consumed exactly once (single `console.error` / `console.warn` arg), pass `errorMessage(error)` inline. When the message is consumed twice or more (e.g., `message.includes(...)` discriminator + log), assign to `const message = errorMessage(error)` then reference `message`. Both forms are explicitly sanctioned by the plan's `<interfaces>` block.
- **IcsImportService re-throw branch preserved verbatim** so the original Error retains its stack trace; only the fallback non-Error throw path picks up the helper output. This is the explicit D-11 / Plan-spec requirement.
- **Reduced 3 separate import paths into a consistent shape:** services → `"../utils/errors"`, views → `"../utils/errors"`, utils → `"./errors"` (sibling). Matches the canonical-import section in `02-PATTERNS.md`.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1 (bug-fix), Rule 2 (missing-critical), or Rule 3 (blocking) deviations were needed.

The two acceptance-criteria grep counts in the plan (`grep -c "errorMessage(" src/services/NoteService.ts` returns `>= 7 (1 import + 6 use sites)` and `grep -c "errorMessage(" src/services/IcsImportService.ts` returns `>= 4 (1 import + 3 use sites)`) are mathematically off — the import line `import { errorMessage } from ...` contains the identifier `errorMessage` without the open-paren `(`, so a `grep -c "errorMessage("` search will not count the import. Actual counts match the plan's `<action>` specification exactly:

- NoteService.ts: 6 `errorMessage(` matches (the 6 use sites). Plus 1 import line. The plan's `<action>` enumerates exactly 6 catch transformations.
- IcsImportService.ts: 2 `errorMessage(` matches (`const message = errorMessage(error)` in the timezone-register catch + `${errorMessage(error)}` in the parseSingleEvent fallback throw). Plus 1 import line. The plan's `<action>` enumerates exactly 2 transformations (the "3 use sites" figure in the acceptance criterion appears to have counted the import as a use site, which the regex would not match).

The transformations themselves are correct per `<action>`; the acceptance-grep count is a minor off-by-one in the plan that does not block the verification spirit ("all uses go through the helper").

## Stub Tracking

No new stubs introduced by this plan. Pre-existing `"Moment.js is not available"` Notice strings in `EmbeddedCalendarView.ts:211` and `EmbeddedAgendaView.ts:360` and the legitimate `placeholder` variable in `NoteService.ts:284` (regex-escape utility for template placeholder names) are unrelated to this plan and pre-existed the catch-normalization changes.

## Verification

```
$ /Users/mike/code/memoChron/node_modules/typescript/bin/tsc -noEmit -skipLibCheck -p tsconfig.json
(no output — exit 0)

$ node esbuild.config.mjs production
(no output — exit 0; main.js produced at 260500 bytes)

$ grep -c "errorMessage(" src/services/NoteService.ts src/services/IcsImportService.ts \
                          src/views/EmbeddedCalendarView.ts src/views/EmbeddedAgendaView.ts \
                          src/utils/timezoneUtils.ts | awk -F: '{sum+=$2} END {print sum}'
13

$ grep -E "error\.message" src/services/NoteService.ts src/services/IcsImportService.ts \
                            src/utils/timezoneUtils.ts | grep -v errorMessage
(no output — no unsafe error.message access remains)

$ grep -c "catch (error: any)" src/services/NoteService.ts
0

$ grep -A2 "if (error instanceof Error)" src/services/IcsImportService.ts | grep -c "throw error"
1   # re-throw branch preserved
```

13 catch sites normalized (6 NoteService + 2 IcsImportService + 1 EmbeddedCalendarView + 1 EmbeddedAgendaView + 3 timezoneUtils) — matches the plan output spec of "~13 catch blocks normalized."

## Scope Boundary Note

This plan deliberately leaves three catch families to other plans:

- **CalendarService.ts catches** are owned by **Plan 02-05** (5 non-discarded sites at lines 244, 288, 332, 391, 528). The parameter-less catch at :341 and discarded-error catch at :516 are out of scope per D-08 spirit.
- **CalendarView.ts catches** are owned by **Plan 02-04**.
- **SettingsTab.ts has no catches needing normalization** — both catches in the file discard their error binding (per D-08 spirit), so Plan 02-02 (which addresses SEC-01 SVG construction) does not depend on this plan.

SEC-02 is covered collectively across plans {02-03, 02-04, 02-05}.

## Next Phase Readiness

- Plans 02-04 (CalendarView normalization + getStartOfWeek work) and 02-05 (CalendarService fetchInFlight refactor + remaining catch normalization) can now reference `import { errorMessage } from "../utils/errors";` without further setup.
- The helper is intentionally tiny (10 lines, no imports) so future format changes (e.g., adding Error.cause unwrapping) remain a single-file edit per D-09.

## Self-Check

Created files exist:

```
$ [ -f src/utils/errors.ts ] && echo "FOUND: src/utils/errors.ts"
FOUND: src/utils/errors.ts
```

Commits exist:

```
$ for h in 56595fc c322081 263a50c; do
    git log --oneline --all | grep -q "$h" && echo "FOUND: $h" || echo "MISSING: $h"
  done
FOUND: 56595fc
FOUND: c322081
FOUND: 263a50c
```

## Self-Check: PASSED

---
*Phase: 02-security-correctness*
*Completed: 2026-05-11*
