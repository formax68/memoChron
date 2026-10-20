---
phase: 04-ux-enhancements
plan: "02"
subsystem: ui
tags: [settings, dropdown, date-format, ux]

# Dependency graph
requires: []
provides:
  - "UK/EU (DD-MM-YYYY) dropdown label in global and per-calendar date format dropdowns"
  - "ENH-04 closed: NL/EU users can now discover DD-MM-YYYY date format via dropdown"
affects: [04-ux-enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Label-only dropdown change: persisted value unchanged, display text updated for discoverability"

key-files:
  created: []
  modified:
    - src/settings/SettingsTab.ts

key-decisions:
  - "Relabel existing UK entry rather than add parallel EU entry — avoids two synonymous values routing to the same formatter, keeps dropdown short (D-08)"
  - "Leave value: 'UK' unchanged in both arrays — existing data.json files remain valid, no migration needed"

patterns-established:
  - "Label change pattern: when a formatter covers multiple locales, update the dropdown label rather than adding a new value key"

requirements-completed:
  - ENH-04

# Metrics
duration: 5min
completed: 2026-05-12
---

# Phase 4 Plan 02: ENH-04 UK/EU Dropdown Relabel Summary

**DD-MM-YYYY date format relabeled from "UK (DD-MM-YYYY)" to "UK/EU (DD-MM-YYYY)" in both global and per-calendar dropdowns, making the format discoverable to NL/EU users without changing the persisted value or formatter logic**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-12T00:00:00Z
- **Completed:** 2026-05-12T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Relabeled the third entry in both `dateFormats` arrays in `src/settings/SettingsTab.ts` from `"UK (DD-MM-YYYY)"` to `"UK/EU (DD-MM-YYYY)"` (lines 941 and 1588 in the post-change file)
- `npx tsc -noEmit` exit 0 — no type errors
- `npm run build` exit 0 — clean esbuild bundle produced
- `grep -c 'UK/EU (DD-MM-YYYY)' src/settings/SettingsTab.ts` returns 2 (one per dropdown)
- `grep -c '"UK (DD-MM-YYYY)"' src/settings/SettingsTab.ts` returns 0 (old label fully removed)
- `grep -c 'value: "UK"' src/settings/SettingsTab.ts` returns 2 (persisted value unchanged in both arrays)

## Task Commits

Each task was committed atomically:

1. **Task 1: Relabel UK dropdown entry to "UK/EU (DD-MM-YYYY)"** - `9b6a796` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/settings/SettingsTab.ts` — Two string literals updated: `"UK (DD-MM-YYYY)"` → `"UK/EU (DD-MM-YYYY)"` at global dropdown (~line 941) and per-calendar override dropdown (~line 1588)

## Decisions Made

- Relabeled the existing entry rather than adding a parallel `"EU"` or `"NL"` value — avoids two synonymous strings routing to the same formatter and keeps the dropdown to four entries (per D-08 and CONTEXT.md "Claude's Discretion")
- Persisted value `"UK"` left unchanged in both arrays — existing user `data.json` files with `noteDateFormat: "UK"` continue to work without migration

## Deviations from Plan

None - plan executed exactly as written.

## Behavior Assertion (Smoke Test)

The `NoteService.formatDate` `"UK"` branch (NoteService.ts lines 340-347) is unchanged:
- Uses `toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })` → produces `15/01/2026` for January 15 2026
- Routed through `toFilenameSafeDate` which replaces `/` with `-` → produces `15-01-2026`
- ROADMAP success criterion #4 met: selecting the relabeled entry produces a note title containing `15-01-2026` for a January 15 event
- Existing users with `noteDateFormat: "UK"` in their `data.json` see the relabeled entry pre-selected without any migration prompt

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ENH-04 closed; the DD-MM-YYYY label change is the entire fix
- `src/settings/SettingsTab.ts` is clean; plan 04-04 (ENH-02 + ENH-03) can land on top without overlapping line ranges

---
*Phase: 04-ux-enhancements*
*Completed: 2026-05-12*
