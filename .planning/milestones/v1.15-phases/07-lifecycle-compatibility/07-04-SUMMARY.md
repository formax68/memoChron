---
phase: 07-lifecycle-compatibility
plan: 04
subsystem: obsidian-plugin
tags: [obsidian-plugin, promise-hygiene, MarkdownRenderChild, lifecycle, void-operator, catch-handler, dir-08, d-09, d-10]

requires:
  - phase: 05-eslint-baseline
    provides: Phase 7 ESLint override block at eslint.config.mjs:65-91 suppressing @typescript-eslint/no-floating-promises + @typescript-eslint/no-misused-promises at the v1.15 starting tree
  - phase: 07-lifecycle-compatibility
    plan: 03
    provides: getCalendarView workspace-lookup pattern + instanceof TFile narrowing (pre-existing analogs; not consumed in this plan since promise hygiene is independent)
  - codebase
    provides: errorMessage(error) helper from src/utils/errors.ts (Phase 2 SEC-02); canonical void + .catch + errorMessage chain at CalendarView.maybeBackgroundRefresh (lines 317-349)
provides:
  - DIR-08 closure at the source level (10 floating-promise + 17 misused-promise sites classified into D-09 buckets)
  - D-10 closure (synchronous onload wrappers in both Embedded views)
  - sync-wrapper-around-private-async-helper pattern is now NET-NEW in this codebase
  - void operator is introduced as a first-class promise-disposition marker
affects: [07-05-remove-phase-7-override, 07-06-uat]

tech-stack:
  added: []
  patterns: [sync-wrapper-around-async-helper, three-bucket-promise-discipline, void-operator-fire-and-forget, dot-catch-Notice-errorMessage]

key-files:
  created: []
  modified:
    - src/main.ts
    - src/services/CalendarService.ts
    - src/settings/SettingsTab.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedAgendaView.ts
    - src/views/EmbeddedCalendarView.ts

key-decisions:
  - "Used `loadAndRender` as the inner async helper name for BOTH embedded views (D-10 Claude's-Discretion). Symmetric across files; reads as 'void load and render' at the callsite."
  - "Extracted the inline async drop-handler body in CalendarView.ts to a new private `handleIcsFileDrop(file: File): Promise<void>` method so the listener arrow can be sync. Cleaner than wrapping with an IIFE; matches the Phase 7 idiom of moving complex async work into named methods that the void-callsite calls."
  - "Bucket 1 (`void`) is the dominant choice for sync-callback slots (event listeners, setInterval, setTimeout, renderCalendarGrid callbacks). Bucket 2 (`.catch` with `new Notice(errorMessage(error))`) is the dominant choice for user-initiated settings-save chains. Bucket 3 (`await`) yielded zero sites — every flagged site lives in a sync callback slot."
  - "The eventEl click handler in CalendarView (showEventDetails) already had a try/catch with console.error + Notice — converted to .catch with the same shape to preserve behavior exactly. This is a Bucket 2 variant; the body of the catch is unchanged."
  - "SettingsTab.ts gains `errorMessage` import for the first time. Both embedded views already imported it for their existing handleDailyNoteClick catch sites."
  - "CalendarService.ts:202 (misused-promise in setBackgroundRefreshTimer callback) was NOT pre-enumerated in the plan's `<files>` list but was flagged by the lint probe. Per Task 2 STEP 1, the authoritative inventory comes from the lint output, so it was included in the commit (deviation logged below)."
  - "Folded plan Tasks 1+2+3 into a single atomic commit (D-11 step 4 expects exactly one commit with the named subject). Mirrors the Phase 7 plan-structural pattern from 07-01, 07-02, 07-03."

patterns-established:
  - "Sync wrapper around async helper (D-10): `onload(): void { void this.loadAndRender(); }` + `private async loadAndRender(): Promise<void> { try { await this.render(); } catch (error) { new Notice(errorMessage(error)); } }`. Net-new to this codebase per PATTERNS Pattern 5; lands in two views simultaneously."
  - "Three-bucket promise discipline (D-09): bucket 1 = `void` operator (fire-and-forget); bucket 2 = `.catch((error) => new Notice(errorMessage(error)))` (user-visible failure); bucket 3 = `await` (sequential). Bucket 2 variant for background paths = `.catch` with `console.error('MemoChron: <context>:', errorMessage(error)) + Notice`."
  - "Wrapping sync-callback parameter slots: `() => this.X()` where X is async → `() => { void this.X(); }`. Wraps the inner Promise without changing the outer arrow's `() => void` signature."
  - "Extract-async-body pattern: when an inline async arrow has multiple awaits + try/catch, extract to a private async method and call it from a sync wrapper with `void this.method(args)`. Applied to CalendarView.handleIcsFileDrop."

requirements-completed: [DIR-08]

duration: 8min
completed: 2026-05-15
---

# Phase 07 Plan 04: DIR-08 floating-promise + MarkdownRenderChild lifecycle Summary

**Closed DIR-08 at the source level: 10 floating-promise sites + 17 misused-promise sites classified into D-09's three buckets (19 `void`, 6 `.catch` with `Notice(errorMessage(error))`, 1 `.catch` with `console.error` + `Notice`, 0 `await`). Both embedded views' `async onload()` rewritten as sync wrappers around private `loadAndRender()` async helpers (D-10). Six source files modified, one atomic commit `14f050d` with the exact D-11 step 4 subject line.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-15 (post-07-03)
- **Completed:** 2026-05-15
- **Tasks:** 3 (Task 1 sync wrappers + Task 2 per-site classification + Task 3 atomic commit — folded into a single commit)
- **Files modified:** 6
- **Total edits:** ~27 (2 D-10 sync-wrapper insertions + 19 Bucket 1 `void` edits + 6 Bucket 2 `.catch` edits + 1 method extraction)

## D-10 Sync-Wrapper Verification

Both embedded views now declare `onload(): void` (line 87 in EmbeddedCalendarView.ts, line 78 in EmbeddedAgendaView.ts). The body is `void this.loadAndRender();`. The new `private async loadAndRender(): Promise<void>` helper wraps the existing `await this.render()` in `try/catch`, emitting `new Notice(errorMessage(error))` on failure. The `render()` body itself is unchanged in both files.

```typescript
// EmbeddedCalendarView.ts:83-100 (post-edit)
// Component.onload() declares `: void`; an async override would return
// Promise<void>, which violates the supertype contract per
// @typescript-eslint/no-misused-promises (checksVoidReturn.inheritedMethods).
// The sync wrapper marks the inner async work as intentionally fire-and-forget.
onload(): void {
  void this.loadAndRender();
}

private async loadAndRender(): Promise<void> {
  try {
    await this.render();
  } catch (error) {
    new Notice(errorMessage(error));
  }
}
```

Identical shape in `EmbeddedAgendaView.ts:74-91` (post-edit).

**Helper-name rationale:** `loadAndRender` reads as "void load and render" at the callsite. Symmetric across both files reduces cross-file cognitive load. Alternative names per CONTEXT.md Claude's-Discretion (`initialize`, `loadEvents`, `renderAsync`) were viable; the chosen name is more specific than `initialize` and matches what the inner `render()` actually does (fetches events + renders).

## D-09 Per-Site Classification Table

### Floating-promise sites (10)

| # | File:Line (pre-edit) | Call | Bucket | Resolution |
|---|----------------------|------|--------|------------|
| 1 | `src/main.ts:32` | `this.activateView()` in `onLayoutReady` callback | 1 | `void this.activateView();` (lifecycle, fire-and-forget) |
| 2 | `src/views/CalendarView.ts:87` | `this.refreshEvents()` in startup `setTimeout` | 1 | `void this.refreshEvents();` (startup chain, errors non-actionable) |
| 3 | `src/views/CalendarView.ts:118` | `this.showDayAgenda(dateToShow)` in `refreshEvents` after render | 1 | `void this.showDayAgenda(dateToShow);` (rendering chain) |
| 4 | `src/views/CalendarView.ts:130` | `this.showDayAgenda(dateToShow)` in `updateColors` | 1 | `void this.showDayAgenda(dateToShow);` (rendering chain) |
| 5 | `src/views/CalendarView.ts:309` | `this.refreshEvents()` in layout-change handler | 1 | `void this.refreshEvents();` (background; idempotent on next layout-change) |
| 6 | `src/views/CalendarView.ts:354` | `this.showDayAgenda(dateToShow)` in `renderCurrentRange` | 1 | `void this.showDayAgenda(dateToShow);` (rendering chain) |
| 7 | `src/views/CalendarView.ts:390` | `this.selectDate(today)` in `goToToday` | 1 | `void this.selectDate(today);` (selection chain; sets UI state) |
| 8 | `src/settings/SettingsTab.ts:971` | `this.plugin.refreshCalendarView()` after time-format change | 2 | `.catch((error) => new Notice(errorMessage(error)))` (user-initiated) |
| 9 | `src/settings/SettingsTab.ts:1067` | `this.plugin.refreshCalendarView()` after attendee-filter checkbox change | 2 | `.catch((error) => new Notice(errorMessage(error)))` (user-initiated) |
| 10 | `src/settings/SettingsTab.ts:1083` | `this.plugin.refreshCalendarView()` after filtered-attendees input change | 2 | `.catch((error) => new Notice(errorMessage(error)))` (user-initiated) |

### Misused-promise sites (17)

| # | File:Line (pre-edit) | Call | Bucket | Resolution |
|---|----------------------|------|--------|------------|
| 1 | `src/main.ts:209` | `() => this.refreshCalendarView()` in `window.setInterval` callback | 1 | `() => { void this.refreshCalendarView(); }` (auto-refresh lifecycle) |
| 2 | `src/services/CalendarService.ts:202` | `() => this.fetchCalendars(sources, true)` in `setBackgroundRefreshTimer` callback | 1 | `() => { void this.fetchCalendars(sources, true); }` (background, idempotent) |
| 3 | `src/settings/SettingsTab.ts:351` | `async (file) => { ... saveSettings() ... display() }` callback to `FilePickerModal` | 2 | Sync arrow `(file) => { saveSettings().then(display).catch(Notice+errorMessage) }` (user-initiated) |
| 4 | `src/views/CalendarView.ts:709` | `() => this.selectDate(date)` click listener | 1 | `() => { void this.selectDate(date); }` (selection callback) |
| 5 | `src/views/CalendarView.ts:710` | `() => this.handleDayDoubleClick(date)` dblclick listener | 1 | `() => { void this.handleDayDoubleClick(date); }` (opens daily note) |
| 6 | `src/views/CalendarView.ts:790` | `async (e) => { stopPropagation; await handleDailyNoteClick(date) }` click listener | 1 | Sync arrow with `void this.handleDailyNoteClick(date);` (open-on-click; handler emits its own Notice on failure) |
| 7 | `src/views/CalendarView.ts:924` | `async (e) => { stopPropagation; try/catch await showEventDetails }` click listener | 2 (variant) | Sync arrow with `this.showEventDetails(event).catch((error) => { console.error(...); new Notice(...) })` — preserves the pre-existing console.error + Notice shape exactly |
| 8 | `src/views/CalendarView.ts:1017` | `async (e) => { preventDefault; stopPropagation; ... await readFile; await createNoteFromImportedEvent; try/catch }` drop listener | 1 | Sync arrow with `void this.handleIcsFileDrop(file);` (extracted async body to a NEW private method `handleIcsFileDrop(file: File): Promise<void>` — the inner try/catch already calls `console.error` + `Notice` for user-visible failure) |
| 9 | `src/views/EmbeddedAgendaView.ts:74` | `async onload()` | D-10 | Sync wrapper → `loadAndRender` (D-10 covered above) |
| 10 | `src/views/EmbeddedAgendaView.ts:278` | `async (e) => { stopPropagation; await handleDailyNoteClick(date) }` click | 1 | Sync arrow with `void this.handleDailyNoteClick(date);` (handler emits its own Notice on failure) |
| 11 | `src/views/EmbeddedAgendaView.ts:345` | `async (e) => { stopPropagation; await handleEventClick(event) }` click | 2 | Sync arrow with `this.handleEventClick(event).catch((error) => new Notice(errorMessage(error)));` (user-initiated note creation) |
| 12 | `src/views/EmbeddedCalendarView.ts:83` | `async onload()` | D-10 | Sync wrapper → `loadAndRender` (D-10 covered above) |
| 13 | `src/views/EmbeddedCalendarView.ts:116` | `() => this.navigate(-1)` click listener | 1 | `() => { void this.navigate(-1); }` (nav action) |
| 14 | `src/views/EmbeddedCalendarView.ts:122` | `() => this.goToToday()` click listener | 1 | `() => { void this.goToToday(); }` (nav action) |
| 15 | `src/views/EmbeddedCalendarView.ts:128` | `() => this.navigate(1)` click listener | 1 | `() => { void this.navigate(1); }` (nav action) |
| 16 | `src/views/EmbeddedCalendarView.ts:156` | `(date) => this.handleDateClick(date)` callback to `renderCalendarGrid` | 1 | `(date) => { void this.handleDateClick(date); }` (calendar-day click; shows agenda as Notice) |
| 17 | `src/views/EmbeddedCalendarView.ts:157` | `(date) => this.handleDateDoubleClick(date)` callback to `renderCalendarGrid` | 1 | `(date) => { void this.handleDateDoubleClick(date); }` (dblclick → open daily note) |

## Per-Bucket Totals

| Bucket | Resolution Shape | Count |
|--------|------------------|-------|
| 1 (`void`) | `void this.X(...)` — true fire-and-forget where errors aren't actionable | **19** (excl. 2 D-10 sync wrappers; incl. those = 21) |
| 2 (`.catch` + `new Notice(errorMessage(error))`) | User-visible failure surface | **5** |
| 2 (variant: `.catch` with `console.error` + `Notice`) | Pre-existing console+notice pattern preserved (event-detail click) | **1** |
| 3 (`await`) | Sequential | **0** |
| D-10 (sync wrapper) | `onload(): void { void this.loadAndRender(); }` + try/catch helper | **2** |
| **Total** | | **27** sites + 2 D-10 wrappers |

The 27 total matches CONTEXT.md `<domain>`'s "10 floating-promise + 17 misused-promise = 27 candidate sites".

## Per-File Edit Count

| File | D-10 wrapper | Bucket 1 (void) | Bucket 2 (.catch) | Method extraction | Total edits |
|------|--------------|-----------------|-------------------|-------------------|-------------|
| `src/main.ts` | 0 | 2 | 0 | 0 | 2 |
| `src/services/CalendarService.ts` | 0 | 1 | 0 | 0 | 1 |
| `src/settings/SettingsTab.ts` | 0 | 0 | 4 | 0 | 4 (+1 import line) |
| `src/views/CalendarView.ts` | 0 | 10 | 1 | 1 (`handleIcsFileDrop`) | 12 |
| `src/views/EmbeddedAgendaView.ts` | 1 | 1 | 1 | 0 | 3 |
| `src/views/EmbeddedCalendarView.ts` | 1 | 5 | 0 | 0 | 6 |
| **Total** | **2** | **19** | **6** | **1** | **28** |

## In-Tree Analogs Reused

- **`errorMessage(error)`** from `src/utils/errors.ts` (Phase 2 SEC-02 helper) — used in 5 new `.catch` handlers (SettingsTab.ts × 4, EmbeddedAgendaView.ts × 1) + 2 new D-10 catch blocks. The existing 18 catch sites are unchanged.
- **`maybeBackgroundRefresh` at `CalendarView.ts:317-349`** (the `void` + `.catch` + `errorMessage` chain) — the canonical in-tree shape new `.catch` handlers mirror. The CalendarView.ts:924 event-click variant uses `console.error` + `Notice` matching the pre-existing pattern in that handler's try/catch (preserved behavior).
- **No new helper introduced.** `git diff HEAD~1` confirms zero new exported functions. The only new method is `private handleIcsFileDrop` on `CalendarView`, which is the inline drop-handler body extracted to a named method for clarity — not a generalizable helper.

## Imports Added

- **`src/settings/SettingsTab.ts`:** Added `import { errorMessage } from "../utils/errors";` — first use of the helper in this file. Both embedded views already had it imported.

No other imports changed.

## Method Added

- **`CalendarView.handleIcsFileDrop(file: File): Promise<void>`** — the inline async body of the drop event listener was extracted to this private method so the listener arrow can be sync (`(e) => { ...; void this.handleIcsFileDrop(file); }`). No behavior change: the same `readFile`/`parseSingleEvent`/`createNoteFromImportedEvent` chain with the same try/catch + console.error + Notice.

## Verification Output

### Final state (Phase 7 override block ACTIVE)

- **`npm run build`** at HEAD: exit 0 (`tsc --noEmit -skipLibCheck && node esbuild.config.mjs production`)
- **`npm run lint`** at HEAD: exit 0 (Phase 7 override block at `eslint.config.mjs:65-91` still suppresses `@typescript-eslint/no-floating-promises` and `@typescript-eslint/no-misused-promises` for the 9 listed files; the override removal lands in plan 07-05)
- **`grep -nE 'async onload\(\)' src/views/Embedded*.ts`**: ZERO MATCHES
- **`grep -E 'onload\(\)\s*:\s*void' src/views/EmbeddedCalendarView.ts src/views/EmbeddedAgendaView.ts`**: 2 matches (one per file)
- **`grep -E 'private async loadAndRender' src/views/EmbeddedCalendarView.ts src/views/EmbeddedAgendaView.ts`**: 2 matches
- **`grep -A 6 'private async loadAndRender' src/views/Embedded*.ts | grep -c 'errorMessage(error)'`**: 2 (both catch handlers emit Notice with errorMessage)
- **`grep -c 'void this\.' src/main.ts src/views/CalendarView.ts src/views/EmbeddedCalendarView.ts src/views/EmbeddedAgendaView.ts src/settings/SettingsTab.ts src/services/CalendarService.ts`**: 2 / 13 / 6 / 2 / 0 / 1 = **24** total (incl. 2 D-10 wrappers and the pre-existing 2 in `maybeBackgroundRefresh`)
- **`grep -c '\.catch((error) =>' src/main.ts src/views/CalendarView.ts src/views/EmbeddedCalendarView.ts src/views/EmbeddedAgendaView.ts src/settings/SettingsTab.ts src/services/CalendarService.ts`**: 0 / 2 / 0 / 1 / 4 / 0 = **7** total (incl. the pre-existing 1 in `maybeBackgroundRefresh`)
- **`grep -nE 'Phase 7\b' eslint.config.mjs`**: 1 match at line 66 (override block STILL PRESENT)
- **`git log -1 --pretty=%s`**: `refactor(views): fix floating promises and MarkdownRenderChild lifecycle return types (DIR-08)` (exact match to D-11 step 4)
- **`git log -1 --pretty=%B | grep -iE 'claude|AI assist|Co-Authored-By'`**: ZERO MATCHES (CLAUDE.md compliance)
- **`git diff HEAD~1 --name-only | sort`**: exactly 6 files — `src/main.ts`, `src/services/CalendarService.ts`, `src/settings/SettingsTab.ts`, `src/views/CalendarView.ts`, `src/views/EmbeddedAgendaView.ts`, `src/views/EmbeddedCalendarView.ts`. Does NOT include `eslint.config.mjs` (plan 07-05's territory).
- **Diff stats**: 6 files changed, 98 insertions(+), 61 deletions(-)
- **Commit SHA**: `14f050d`

### Verification probe (Phase 7 override block TEMPORARILY DISABLED)

With lines 65-91 of `eslint.config.mjs` commented out, `npx eslint src/` reports:

```
src/settings/SettingsTab.ts
  567:17  warning  Use 'activeDocument' instead of 'document' for popout window compatibility  obsidianmd/prefer-active-doc
  572:20  warning  Use 'activeDocument' instead of 'document' for popout window compatibility  obsidianmd/prefer-active-doc
  590:20  warning  Use 'activeDocument' instead of 'document' for popout window compatibility  obsidianmd/prefer-active-doc

src/views/CalendarView.ts
   435:33  error  This assertion is unnecessary since the receiver accepts the original type of the expression  @typescript-eslint/no-unnecessary-type-assertion
  1220:15  error  This assertion is unnecessary since the receiver accepts the original type of the expression  @typescript-eslint/no-unnecessary-type-assertion

✖ 5 problems (2 errors, 3 warnings)
```

**DIR-08 verification:**
- `@typescript-eslint/no-floating-promises`: **0 violations** ✓ (down from 10)
- `@typescript-eslint/no-misused-promises`: **0 violations** ✓ (down from 17)
- Phase 7 success criterion #4 satisfied verbatim at the source level

**Out-of-DIR-08 findings (intentionally left for other plans):**
- 3 `obsidianmd/prefer-active-doc` warnings at `SettingsTab.ts:567, 572, 590` — these are `document.createElementNS(SVG_NS, ...)` calls. Per Plan 07-02 Decision/Leave-Alone, `createElementNS` is NOT what `prefer-active-doc` is supposed to flag; the rule's auto-fix would break SVG creation. These have been pre-existing and were already excluded from Plan 07-02. They remain documented as Phase 6 D-12 leave-alone sites. The rule fires here in warning form (not error), which means it does NOT block plan 07-05's override-block removal — it will surface as warnings after the override is dropped but does not fail lint.
- 2 `@typescript-eslint/no-unnecessary-type-assertion` errors at `CalendarView.ts:435, 1220` — these are `this.viewMode as number` casts. They are NOT the `as TFile` cascade from DIR-07 (Plan 07-03 closed those). They are pre-existing and out of DIR-08 scope. Plan 07-05 will need to either address them or extend the override block, but they are not this plan's concern. Note: the line offsets shifted slightly (1218 → 1220) because Plan 07-04's edits added comments and methods earlier in the file.

The override block was restored via `cp /tmp/eslint.config.mjs.bak eslint.config.mjs` BEFORE staging the commit. `grep -nE 'Phase 7\b' eslint.config.mjs` at HEAD returns 1 match (override block ACTIVE). `git diff HEAD~1 --name-only` does NOT include `eslint.config.mjs`.

## Commit Message Compliance

`git log -1 --pretty=%B | grep -iE 'claude|AI assist|Co-Authored-By'` returns ZERO matches. Per CLAUDE.md Memory Reminders, the commit body contains no Claude/AI/assistant/Co-Authored-By references.

## Decisions Made

1. **Helper name `loadAndRender` for both Embedded views** (D-10 Claude's-Discretion). Reads as "void load and render" at the callsite; symmetric across files; more specific than `initialize`.
2. **Extracted CalendarView drop handler body to `handleIcsFileDrop` method** rather than using an IIFE. The inline async body had multiple awaits and a try/catch — moving it to a named method is more readable and matches the codebase's existing pattern of "private async X" methods.
3. **Preserved the eventEl click handler's `console.error` + `Notice` shape** in CalendarView.ts when converting from try/catch to `.catch`. The pre-existing behavior intentionally logs to console AND shows a Notice; switching to plain `new Notice(errorMessage(error))` would have dropped the console.error. The `.catch` body is byte-identical to the prior catch body.
4. **Used Bucket 1 `void` for the auto-refresh `setInterval` and CalendarService background-refresh `setTimeout` callbacks** per RESEARCH end-state. These are background lifecycle paths; failures retry on the next interval and aren't user-actionable.
5. **Used Bucket 2 `.catch` with Notice for ALL 4 SettingsTab.ts user-initiated saves.** Settings changes are user actions; failure deserves user-visible feedback. The plan's "default for ambiguous sites" rule pointed here even before the per-site analysis.
6. **Fixed CalendarService.ts:202 as part of this commit** even though `src/services/CalendarService.ts` was not pre-listed in the plan's `<files>` frontmatter. The plan's Task 2 STEP 1 instruction says the authoritative inventory comes from `npx eslint src/`; the probe surfaced this one extra site. Logged as a deviation below.
7. **Folded plan Tasks 1+2+3 into a single atomic commit.** The plan's `<output>` says "one git commit"; the D-11 step 4 subject matches a single commit. No intermediate buildable state separates the three tasks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Included `src/services/CalendarService.ts:202` in the commit**

- **Found during:** Task 2 STEP 1 lint probe
- **Issue:** The plan's `<files>` frontmatter listed 5 files (`src/views/*.ts`, `src/settings/SettingsTab.ts`, `src/main.ts`). The `npx eslint src/` probe (override block temporarily disabled) flagged a sixth site: `src/services/CalendarService.ts:202` (`() => this.fetchCalendars(sources, true)` — misused-promises shape, `setBackgroundRefreshTimer` callback expects `() => void` but receives `() => Promise<void>`). Leaving this site unfixed would have left a residual `no-misused-promises` violation in the verification probe, violating the plan's success criterion ("zero `no-misused-promises` of the lifecycle shape").
- **Fix:** Applied Bucket 1 (`void`): `() => { void this.fetchCalendars(sources, true); }`. Background refresh path — failures retry on the next interval and aren't user-actionable. Mirrors the plan's classification for the parallel site at `main.ts:209` (auto-refresh interval callback).
- **Files modified:** `src/services/CalendarService.ts` (1 line, 1 edit)
- **Verification:** Verification probe at HEAD reports zero `no-misused-promises` violations across the entire src/ tree.
- **Committed in:** `14f050d` (the same DIR-08 atomic commit; documented in commit body paragraph 1).

### Plan-Structural Simplifications (Not Deviations)

**1. Folded plan Tasks 1 + 2 + 3 into a single atomic commit**

- **Found during:** Task 3 commit step
- **Issue:** Plan Task 3 was structured as a separate "commit only" task. Tasks 1 (D-10 sync wrappers) and 2 (D-09 per-site fixes) are source-edits with no intermediate buildable state separating them — both produce a coherent buildable tree only once all 27 edits land together. The verification probe is run once at the end after all edits, not after Task 1 alone.
- **Fix:** A single commit with subject `refactor(views): fix floating promises and MarkdownRenderChild lifecycle return types (DIR-08)` covers all three tasks. Acceptance criteria for all three are satisfied by this commit.
- **Impact:** None — matches the plan's `<output>` ("one git commit"). Mirrors the same structural simplification applied in Plans 07-01, 07-02, 07-03.

### Plan-vs-Live Line-Number Drift (Not a Deviation)

The plan's `<must_haves>` referenced specific line numbers for the embedded `async onload()` sites: line 83 in EmbeddedCalendarView.ts and line 74 in EmbeddedAgendaView.ts. Live grep at execution time confirmed exact match. Post-commit, the `onload(): void` lines are at 87 (EmbeddedCalendarView) and 78 (EmbeddedAgendaView) because the sync-wrapper expansion added a 4-line docblock above the new method. The plan's references are pre-edit positions; the SUMMARY reports both pre- and post-edit lines where useful.

The 2 `no-unnecessary-type-assertion` errors surfaced by the verification probe at `CalendarView.ts:435` and `CalendarView.ts:1220` (the plan documented these as 435 and 1218) reflect a similar 2-line drift from the comment+method-extraction added in this plan. These sites are out of DIR-08 scope.

---

**Total deviations:** 1 auto-fix (Rule 3 — blocking; included CalendarService.ts:202)
**Plan-structural simplifications:** 1 (single atomic commit)
**Impact on plan:** The Rule 3 auto-fix was required to satisfy the plan's own success criterion (zero `no-misused-promises` in the verification probe). The plan's "5 source files modified" estimate ("potentially fewer if the lint output flags fewer files") becomes 6 instead, but the plan explicitly allowed for the count to be set by the lint output.

## Issues Encountered

- **One extra site (`CalendarService.ts:202`) not pre-enumerated in the plan's `<files>` list.** Resolved as a Rule 3 auto-fix (required for the verification probe to pass). See Deviations.
- **Verification probe surfaces 3 `obsidianmd/prefer-active-doc` warnings and 2 `no-unnecessary-type-assertion` errors after the override block is disabled.** These are out of DIR-08 scope (covered by Plan 07-02 leave-alone or by future cleanup). Plan 07-05 will need to decide how to handle them — most likely by leaving the SVG-createElementNS sites alone (rule false-positive) and either fixing the `as number` casts directly or extending the override block selectively.

## Threat Flags

None — Phase 7 ships no new attack surface per the plan's `<threat_model>`. T-07-06 (Repudiation: silent Promise rejections) and T-07-07 (Information Disclosure via errorMessage) both have `mitigate`/`accept` dispositions with severity `none`. This plan IMPLEMENTS the T-07-06 mitigation: every Promise now has explicit disposition (void / .catch / await) and silent rejections in `async onload()` are eliminated by the sync-wrapper + try/catch + Notice.

## Known Stubs

None.

## TDD Gate Compliance

Not applicable — plan type is `execute` (not `tdd`); no `tdd="true"` task in this plan.

## Hand-off to Plan 07-05 (remove Phase 7 ESLint override block)

**Plan 07-05 is unblocked.** With Plan 07-04 closed:

- DIR-05 (Plan 07-01) ✓ — `obsidianmd/no-view-references-in-plugin` + `obsidianmd/detach-leaves` structurally satisfied
- DIR-06 (Plan 07-02) ✓ — `obsidianmd/prefer-active-doc` + `obsidianmd/prefer-window-timers` structurally satisfied (with 3 SVG-createElementNS leave-alone sites that will surface as warnings, not errors)
- DIR-07 (Plan 07-03) ✓ — `obsidianmd/no-tfile-tfolder-cast` structurally satisfied
- DIR-08 (Plan 07-04) ✓ — `@typescript-eslint/no-floating-promises` + `@typescript-eslint/no-misused-promises` structurally satisfied

**Residual items Plan 07-05 will need to consider:**

1. **`@typescript-eslint/no-unnecessary-type-assertion` (2 errors at CalendarView.ts:435, 1220)** — `this.viewMode as number` casts. These were originally flagged in CONTEXT.md `<domain>` as cascade cleanup from DIR-07's `as TFile` removal, but they are `as number` casts on `viewMode: CalendarViewMode = 'month' | 1 | 2 | 3 | 4 | 5;`. Inspection shows TypeScript can narrow `viewMode` via the `if (this.viewMode === 'month')` branch — the `else` branch should have `viewMode` narrowed to `number`, making the cast unnecessary. Plan 07-05 can either remove the casts directly (one-line change at each site) or keep them suppressed via a narrower override.

2. **`obsidianmd/prefer-active-doc` (3 warnings at SettingsTab.ts:567, 572, 590)** — `document.createElementNS(SVG_NS, ...)` calls. Per Phase 6 D-12 + Plan 07-02 leave-alone, `createElementNS` is intentional. These fire as warnings (not errors) and do not fail `npm run lint`. Plan 07-05 can leave the override block dropped (warnings are acceptable per DOC-01 — `npm run lint` exits 0 with warnings).

## Self-Check: PASSED

Verified claims (run at HEAD = `14f050d`):

- `src/main.ts` exists (modified) ✓
- `src/services/CalendarService.ts` exists (modified) ✓
- `src/settings/SettingsTab.ts` exists (modified) ✓
- `src/views/CalendarView.ts` exists (modified) ✓
- `src/views/EmbeddedAgendaView.ts` exists (modified) ✓
- `src/views/EmbeddedCalendarView.ts` exists (modified) ✓
- `.planning/phases/07-lifecycle-compatibility/07-04-SUMMARY.md` exists (created by this Write call)
- Commit `14f050d` exists in `git log --oneline` ✓
- Commit subject exactly matches `refactor(views): fix floating promises and MarkdownRenderChild lifecycle return types (DIR-08)` ✓
- Commit body contains no Claude/AI/Co-Authored-By references ✓
- `npm run build` exits 0 at HEAD ✓
- `npm run lint` exits 0 at HEAD ✓
- `eslint.config.mjs` is UNCHANGED at HEAD (Phase 7 override block still present at line 66+) ✓
- Verification probe (override temporarily disabled) reported 0 `no-floating-promises` and 0 `no-misused-promises` (lifecycle shape) ✓
- `grep -nE 'async onload\(\)' src/views/Embedded*.ts` returns 0 matches at HEAD ✓
- `grep -E 'onload\(\)\s*:\s*void' src/views/Embedded*.ts` returns 2 matches ✓
- `grep -E 'private async loadAndRender' src/views/Embedded*.ts` returns 2 matches ✓
- `errorMessage(error)` imported in SettingsTab.ts (added in this commit); both Embedded views already had it ✓

---
*Phase: 07-lifecycle-compatibility*
*Completed: 2026-05-15*
