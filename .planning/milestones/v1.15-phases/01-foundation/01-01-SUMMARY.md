---
phase: 01-foundation
plan: "01"
subsystem: services
tags: [lifecycle, settings, services, calendar-service]
dependency_graph:
  requires: []
  provides: [CalendarService-single-arg-constructor, live-refreshInterval-read]
  affects: [src/services/CalendarService.ts, src/main.ts]
tech_stack:
  added: []
  patterns: [plugin-back-reference, live-settings-read]
key_files:
  modified:
    - src/services/CalendarService.ts
    - src/main.ts
decisions:
  - "D-02: CalendarService drops private refreshMinutes field; needsRefresh reads this.plugin.settings.refreshInterval live"
  - "D-04: main.ts initializeServices passes only this to new CalendarService(this)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 1 Plan 1: TD-01 Live RefreshInterval Read Summary

**One-liner:** Drop CalendarService's stale constructor-copy `refreshMinutes` field; `needsRefresh()` reads `this.plugin.settings.refreshInterval` live so settings changes take effect immediately without an Obsidian reload.

## What Was Done

Two files were modified as part of the TD-01 requirement. Both changes land in a single atomic commit.

### Files Modified

**`src/services/CalendarService.ts`** — Two edits:
1. Constructor narrowed from `constructor(private plugin: MemoChron, private refreshMinutes: number) {}` to `constructor(private plugin: MemoChron) {}` — the `refreshMinutes` field is dropped entirely.
2. Inside `needsRefresh()` (line 194), `this.refreshMinutes * 60 * 1000` replaced with `this.plugin.settings.refreshInterval * 60 * 1000` — cache-expiry now reads the live settings value.

**`src/main.ts`** — One edit:
- `initializeServices()` construction call changed from `new CalendarService(this, this.settings.refreshInterval)` to `new CalendarService(this)` — the now-removed second argument is dropped.
- `new NoteService(this.app, this.settings)` is left untouched (TD-02 / Plan 02 will handle it).

## Commit

| Hash | Message | Files |
|------|---------|-------|
| `65b8313` | `refactor(services): drop CalendarService refreshMinutes; read live refresh interval` | `src/services/CalendarService.ts`, `src/main.ts` |

## Verification Output

```
# Build
node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck  →  exit 0
node esbuild.config.mjs production                               →  exit 0

# TD-01 static checks
grep -n "refreshMinutes" src/services/CalendarService.ts         →  (no output)
grep -nE "this\.plugin\.settings\.refreshInterval" src/services/CalendarService.ts
  195:  now - this.lastFetch >= this.plugin.settings.refreshInterval * 60 * 1000;
grep -nE "new CalendarService\(this\)" src/main.ts
  34:  this.calendarService = new CalendarService(this);
```

## NoteService Construction Confirmed Untouched

`grep -E "new NoteService\(this\.app, this\.settings\)" src/main.ts` returns a match — the NoteService call site is handed off to Plan 02 as planned.

## Deviations from Plan

None — plan executed exactly as written. Both edits made, build verified, single atomic commit created with no Claude/AI references in the message.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This is a pure internal refactor with no new attack surface. Threat model in plan covers T-01-01 (Tampering / live settings read) and T-01-02 (DoS / refreshInterval=0) as accepted/pre-existing behaviors.

## Self-Check: PASSED

- `src/services/CalendarService.ts` modified and committed: FOUND
- `src/main.ts` modified and committed: FOUND
- Commit `65b8313` exists: FOUND
- `grep refreshMinutes src/services/CalendarService.ts` returns 0 matches: VERIFIED
- `grep this.plugin.settings.refreshInterval src/services/CalendarService.ts` returns 1 match (line 195): VERIFIED
- TypeScript type-check exits 0: VERIFIED
- esbuild production bundle exits 0: VERIFIED
- Commit message contains no Claude/AI references: VERIFIED
