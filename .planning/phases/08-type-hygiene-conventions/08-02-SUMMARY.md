---
phase: 08-type-hygiene-conventions
plan: 02
subsystem: type-hygiene
tags: [refactor, lint, dir-09, types, ical, moment]
requires:
  - 08-01 (DIR-10 cleanup)
provides:
  - "DIR-09 closed at the source-violation level: 0 @typescript-eslint/no-explicit-any across src/**/*.ts (the **/*.d.ts glob is excluded per D-08)"
  - "Amendment A1: 5 (window as any).moment casts replaced with typed `import { moment } from \"obsidian\"`; 5 dead null-check branches removed (4 negative-shape + 1 positive-shape)"
  - "Amendment A2: ical.d.ts getValues() return tightened to Array<Time | Duration | string>"
  - "Property.jCal: unknown[] codified in ical.d.ts shim; both (dtstart as any).jCal call sites use typed access"
  - "isValidCache uses the canonical narrowing from RESEARCH.md Pitfall 3 (Record<string, unknown> + typeof/Array.isArray)"
  - "eslint.config.mjs: **/*.d.ts no-explicit-any: off exclusion (D-08)"
  - "no-case-declarations and no-useless-escape closed (pathUtils.ts, viewRenderers.ts)"
affects:
  - src/types/ical.d.ts
  - src/services/CalendarService.ts
  - src/services/IcsImportService.ts
  - src/settings/SettingsTab.ts
  - src/utils/pathUtils.ts
  - src/utils/viewRenderers.ts
  - src/views/CalendarView.ts
  - src/views/EmbeddedCalendarView.ts
  - src/views/EmbeddedAgendaView.ts
  - eslint.config.mjs
tech-stack:
  added: []
  patterns:
    - "import { moment } from \"obsidian\" — typed access to Obsidian's bundled moment.js (replaces (window as any).moment)"
    - "Type-guard with cache: unknown + Record<string, unknown> intermediate cast — canonical TypeScript-eslint pattern for migrating any-typed type guards"
    - "Pick<T, K> for narrowing parameter type to subset of required fields — avoids forcing callers to construct full objects when only a subset is read"
    - "Block-scoped case bodies ({ ... }) for lexical declarations inside switch (no-case-declarations)"
key-files:
  created: []
  modified:
    - src/types/ical.d.ts
    - src/services/CalendarService.ts
    - src/services/IcsImportService.ts
    - src/settings/SettingsTab.ts
    - src/utils/pathUtils.ts
    - src/utils/viewRenderers.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedCalendarView.ts
    - src/views/EmbeddedAgendaView.ts
    - eslint.config.mjs
decisions:
  - "Used `value instanceof Time` to narrow the forEach iteration parameter at CalendarService.ts:771 (the only branch that calls .toJSDate()). Stricter than the RESEARCH.md fallback `typeof value === \"object\" && \"toJSDate\" in value` because the tightened getValues() return type makes Time the only branch that needs the narrowing — Duration has no toJSDate, string has none. Required adding Duration to the ical.js named imports."
  - "Per executor protocol's per-task-commit rule, split Plan 04's single 'EXACT message' commit into three atomic per-task commits (Task 1, Task 2, Task 3). Same Plan 01 precedent."
metrics:
  duration: "≈ 8m"
  completed: "2026-05-17"
  tasks_completed: 4
  commits: 3
  files_modified: 10
  violations_closed: 18  # 16 no-explicit-any + 1 no-case-declarations + 1 no-useless-escape
---

# Phase 08 Plan 02: DIR-09 Type Hygiene Cleanup Summary

Closed every DIR-09 violation at the source-violation level — 16 `@typescript-eslint/no-explicit-any` sites (all 7 non-ambient sites + 5 `(window as any).moment` casts + 4 redundant ambient sites resolved via shim tightening or the new `**/*.d.ts` lint-exclude), 1 `no-case-declarations` site, 1 `no-useless-escape` site — across 10 files in three atomic commits.

## Result

- **`@typescript-eslint/no-explicit-any`:** 16 source-level sites closed. The 5 remaining ambient sites in `src/types/ical.d.ts` (lines 3, 8, 12, 59, 72) are now covered by the `**/*.d.ts` `no-explicit-any: off` block in `eslint.config.mjs` per D-08.
- **`no-case-declarations`:** 1 site closed (`pathUtils.ts:47` — `case PathType.FILE_URL` body wrapped in `{ ... }`).
- **`no-useless-escape`:** 1 site closed (`viewRenderers.ts:370` — `[-\/]` → `[-/]` inside character class).
- **Amendment A1 (window.moment → typed import):** Applied at all 5 sites. 5 dead null-check branches removed — 4 negative-shape (`if (!moment) return`) and 1 positive-shape (`if (moment) { weekNum = ... }` flattened to unconditional assignment).
- **Amendment A2 (getValues() tightening):** Applied. `Property.getValues()` now returns `Array<Time | Duration | string>` instead of `any[]`. The dependent `forEach` iteration parameter at `CalendarService.ts:771` is correspondingly tightened.
- **`??`-with-constant-LHS audit:** 1 hit found at `src/settings/SettingsTab.ts:262` and it is inside a documentation comment (`// actually toggles — otherwise \`!(undefined ?? false) === true\``). **0 executable violations.** No source edit required, matching the RESEARCH.md expectation.
- **`npm run lint`:** exit 0 (clean).
- **`npm run build`:** exit 0 (clean — `tsc -noEmit -skipLibCheck && esbuild production`).

## Per-Site Outcome Inventory

| File | Line | Before | After | Strategy |
| ---- | ---- | ------ | ----- | -------- |
| `src/types/ical.d.ts` | 14 | `getValues(): any[]` | `getValues(): Array<Time \| Duration \| string>` | Tightened return type (A2) |
| `src/types/ical.d.ts` | (new) 15 | n/a | `jCal: unknown[];` | New field codifying ical.js internal access |
| `src/types/ical.d.ts` | 3, 8, 12, 59, 72 | `any` (5 ambient sites) | unchanged | Covered by new `**/*.d.ts` exclude block (D-08) |
| `eslint.config.mjs` | new block ~65 | n/a | `{ files: ["**/*.d.ts"], rules: { "@typescript-eslint/no-explicit-any": "off" } }` | D-08 lint-exclude |
| `src/services/CalendarService.ts` | 2 (import) | `import { Component, Event as ICalEvent, parse, Time } from "ical.js"` | adds `Duration` | Required by tightened forEach |
| `src/services/CalendarService.ts` | 317 | `isValidCache(cache: any)` truthy-only body | `cache: unknown` with `Record<string, unknown>` intermediate cast + `typeof`/`Array.isArray` | Canonical RESEARCH.md Pitfall 3 narrowing |
| `src/services/CalendarService.ts` | 771 | `forEach((value: any) => { if (value?.toJSDate) ... })` | `forEach((value: Time \| Duration \| string) => { if (value instanceof Time) ... })` | Real type (A2-dependent) |
| `src/services/CalendarService.ts` | 940 | `(dtstart as any).jCal` | `dtstart.jCal` | Typed via shim addition |
| `src/services/IcsImportService.ts` | 100 | `(dtstart as any).jCal` | `dtstart.jCal` | Typed via shim addition |
| `src/settings/SettingsTab.ts` | new import | n/a | `import { CalendarEvent } from "../services/CalendarService"` | Required by `Pick<>` |
| `src/settings/SettingsTab.ts` | 1180 | `generatePreviewPath(template: string, event: any)` | `event: Pick<CalendarEvent, "title" \| "start" \| "end" \| "source">` | Real type (Pick) |
| `src/views/CalendarView.ts` | 1 (import) | obsidian import w/o `moment` | adds `moment` to obsidian import | A1 |
| `src/views/CalendarView.ts` | 158-163 | `const moment = (window as any).moment; if (!moment) return false;` | direct `moment(date)` (no cast, no null check) | A1, negative-shape branch removed |
| `src/views/CalendarView.ts` | 553-559 | `const moment = (window as any).moment; let weekNum = "?"; if (moment) { weekNum = String(moment(date).week()) }` | `const weekNum = String(moment(date).week())` (unconditional) | A1, **positive-shape branch flattened** |
| `src/views/CalendarView.ts` | 803-808 | `const moment = (window as any).moment; if (!moment) { new Notice("Moment.js is not available"); return; }` | direct `moment(date)` (no cast, no null check) | A1, negative-shape branch removed |
| `src/views/EmbeddedCalendarView.ts` | 1 (import) | obsidian import w/o `moment` | adds `moment` to obsidian import | A1 |
| `src/views/EmbeddedCalendarView.ts` | 222-227 | same negative-shape pattern as CalendarView:803 | direct `moment(date)` | A1, negative-shape branch removed |
| `src/views/EmbeddedAgendaView.ts` | 1 (import) | obsidian import w/o `moment` | adds `moment` to obsidian import | A1 |
| `src/views/EmbeddedAgendaView.ts` | 379-383 | same negative-shape pattern as CalendarView:803 | direct `moment(date)` | A1, negative-shape branch removed |
| `src/utils/pathUtils.ts` | 47-56 | `case PathType.FILE_URL: let normalized = ...` | wrapped body in `{ ... }` block scope | no-case-declarations |
| `src/utils/viewRenderers.ts` | 370 | `input.match(/^(\d{4})[-\/](\d{1,2})$/)` | `input.match(/^(\d{4})[-/](\d{1,2})$/)` | no-useless-escape |

**Total:** 18 violations closed source-side; 5 ambient `.d.ts` sites covered by new lint-exclude.

## Confirmation: Positive-Check `if (moment)` Site at CalendarView.ts:561

Per the plan's specific call-out, the **positive-check** shape at `CalendarView.ts:558/561` (`renderWeekNumber` — `if (moment) { weekNum = String(moment(date).week()) }`) was eliminated alongside the 4 negative-check shapes. The branch and the `let weekNum = "?"` default were both removed; the assignment is now unconditional: `const weekNum = String(moment(date).week())`. Verified via `grep -rnE '\bif\s*\(\s*!?moment\s*\)' src/views/` returning 0 hits after the commit.

## `??` Audit Result

- **Executable hits:** 0
- **Documentation-comment hits:** 1 — `src/settings/SettingsTab.ts:262` (`// actually toggles — otherwise \`!(undefined ?? false) === true\``)
- **Action taken:** None. Matches the RESEARCH.md prediction.

## Verification Commands and Output

### `npm run lint`

```
> memochron@1.14.0 lint
> eslint src/
```

Exit 0; no output.

### `npm run build`

```
> memochron@1.14.0 build
> tsc -noEmit -skipLibCheck && node esbuild.config.mjs production
```

Exit 0; clean tsc + esbuild production output.

### Rule-explicit `no-explicit-any` pass (excluding `**/*.d.ts`)

```
$ npx eslint 'src/**/*.ts' --ignore-pattern '**/*.d.ts' --rule '@typescript-eslint/no-explicit-any: error' 2>&1 | grep -c "no-explicit-any"
0
```

### Rule-explicit `no-case-declarations` pass

```
$ npx eslint 'src/**/*.ts' --rule 'no-case-declarations: error' 2>&1 | grep -c "no-case-declarations"
0
```

### Rule-explicit `no-useless-escape` pass

```
$ npx eslint 'src/**/*.ts' --rule 'no-useless-escape: error' 2>&1 | grep -c "no-useless-escape"
0
```

### Source-pattern audits

```
$ grep -rn "(window as any).moment" src/
(no output — 0 hits)

$ grep -rn "(dtstart as any)" src/
(no output — 0 hits)

$ grep -rnE '\bif\s*\(\s*!?moment\s*\)' src/views/
(no output — 0 hits; both positive and negative shapes eliminated)

$ grep -rnE '\b(null|undefined|"")\s*\?\?' src/
src/settings/SettingsTab.ts:262:    // actually toggles — otherwise `!(undefined ?? false) === true`
(1 hit — documentation comment only)
```

### Shim tightening + d.ts exclude verifications

```
$ grep -nE "getValues\(\): Array<Time \| Duration \| string>" src/types/ical.d.ts
14:    getValues(): Array<Time | Duration | string>;

$ grep -nE "jCal: unknown\[\]" src/types/ical.d.ts
15:    jCal: unknown[];

$ grep -c '"\*\*/\*\.d\.ts"' eslint.config.mjs
1

$ grep -nE 'cache as Record<string, unknown>' src/services/CalendarService.ts
319:    const c = cache as Record<string, unknown>;

$ grep -nE "event: Pick<CalendarEvent" src/settings/SettingsTab.ts
1183:    event: Pick<CalendarEvent, "title" | "start" | "end" | "source">
```

## Commits

| # | Hash | Subject |
| - | ---- | ------- |
| 1 | `413b6f3` | `refactor(08-02): tighten ical.d.ts shim and fix 4 non-ambient any sites` |
| 2 | `e69c2fa` | `refactor(08-02): replace (window as any).moment with typed obsidian import (A1)` |
| 3 | `acf4626` | `refactor(08-02): fix no-case-declarations and no-useless-escape (DIR-09)` |

None of the three commit messages contain "Claude", "AI", "Anthropic", or "claude.ai" (case-insensitive) per `CLAUDE.md` Memory Reminders.

## Deviations from Plan

### [Protocol — atomic commits] Single combined commit message in Task 4 replaced by three per-task commits

- **Found during:** Task 4 (verification)
- **Issue:** Task 4 specifies a single combined commit message that would land all DIR-09 changes as one commit. The executor protocol's `<task_commit_protocol>` requires committing after each task completes — so Tasks 1, 2, and 3 were each committed atomically before Task 4 ran, leaving no modified files for Task 4 to commit.
- **Fix:** Used three per-task commit messages instead of the single combined message. Total source delta is identical to the combined message's described changes; just split across three commits along the natural task boundary. Same Plan 01 precedent (see `08-01-SUMMARY.md` "Deviations from Plan").
- **Files modified:** None (commit-message-only deviation)
- **Commits:** `413b6f3` (Task 1), `e69c2fa` (Task 2), `acf4626` (Task 3)

### [Rule 1 — implementation detail] Used `value instanceof Time` narrowing at CalendarService.ts:771 instead of the RESEARCH.md fallback `"toJSDate" in value`

- **Found during:** Task 1
- **Issue:** RESEARCH.md Example 2 offered two narrowing options for the forEach iteration: the structural check `if (typeof value === "object" && value !== null && "toJSDate" in value)` (fallback) and the cleaner real-type approach via the tightened shim. With Amendment A2 applied, the iteration parameter is typed `Time | Duration | string` — so `instanceof Time` becomes the precise narrowing (Duration has no `toJSDate`, string has none).
- **Fix:** Used `if (value instanceof Time)` instead of structural check. Required adding `Duration` to the named imports at `CalendarService.ts:2` (since the iteration parameter type references it).
- **Files modified:** `src/services/CalendarService.ts` (Task 1 commit)
- **Commit:** `413b6f3`

## Authentication Gates

None — Phase 8 is pure compile-time / static-analysis refactor.

## Known Stubs

None — no placeholder values, no `TODO`/`FIXME`/"coming soon" strings introduced. Every change is a real type/narrowing/branch-removal.

## Threat Flags

None — pure type-tightening and dead-branch removal. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check: PASSED

- File `.planning/phases/08-type-hygiene-conventions/08-02-SUMMARY.md` — created (this file).
- Commit `413b6f3` — FOUND in `git log` (Task 1).
- Commit `e69c2fa` — FOUND in `git log` (Task 2).
- Commit `acf4626` — FOUND in `git log` (Task 3).
- All 10 modified files — FOUND on disk and committed:
  - `src/types/ical.d.ts`
  - `src/services/CalendarService.ts`
  - `src/services/IcsImportService.ts`
  - `src/settings/SettingsTab.ts`
  - `src/utils/pathUtils.ts`
  - `src/utils/viewRenderers.ts`
  - `src/views/CalendarView.ts`
  - `src/views/EmbeddedCalendarView.ts`
  - `src/views/EmbeddedAgendaView.ts`
  - `eslint.config.mjs`
- `npm run lint` exit 0 — VERIFIED.
- `npm run build` exit 0 — VERIFIED.
- Rule-explicit passes for `no-explicit-any` (excluding `.d.ts`), `no-case-declarations`, `no-useless-escape` all return 0 — VERIFIED.
