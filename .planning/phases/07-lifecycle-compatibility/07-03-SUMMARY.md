---
phase: 07-lifecycle-compatibility
plan: 03
subsystem: obsidian-plugin
tags: [obsidian-plugin, type-narrowing, instanceof, TFile, daily-notes, dir-07]

requires:
  - phase: 07-lifecycle-compatibility
    plan: 02
    provides: Phase 7 ESLint override block at eslint.config.mjs:65-91 still active (the obsidianmd/no-tfile-tfolder-cast and @typescript-eslint/no-unnecessary-type-assertion rules remain suppressed at this commit; the override block removal lands in plan 07-05)
  - codebase
    provides: Pre-existing `instanceof TFile` analogs at NoteService.ts:73, NoteService.ts:89, CalendarService.ts:518 — Phase 7 extends the pattern to the 4 daily-note open sites
provides:
  - DIR-07 closure at the source level (4 `as TFile` casts removed)
  - `instanceof TFile` runtime narrowing across the 4 daily-note consumer sites in views
  - Cascade resolution of the 2 `@typescript-eslint/no-unnecessary-type-assertion` violations identified in CONTEXT.md `<domain>` (they were the same `as TFile` casts viewed through a different rule)
affects: [07-04-promise-hygiene, 07-05-remove-phase-7-override, 07-06-uat]

tech-stack:
  added: []
  patterns: [instanceof-TFile-narrowing, positive-guard-shape-A, typed-narrow-shape-B]

key-files:
  created: []
  modified:
    - src/views/CalendarView.ts
    - src/views/EmbeddedCalendarView.ts
    - src/views/EmbeddedAgendaView.ts

key-decisions:
  - "Made the 4 surgical edits exactly as the plan specified. Shape A (CalendarView.ts:148) wraps `this.dailyNotes.set(...)` in `if (file instanceof TFile)`. Shape B (3 sites) replaces `if (dailyNote)` with `if (dailyNote instanceof TFile)` so the subsequent `await leaf.openFile(dailyNote)` receives a narrowed `TFile`."
  - "No helper introduced (no `assertIsFile`, `isTFile`, etc.) — `instanceof` operator IS the narrow per D-08 + PATTERNS Pattern 2. Any wrapper would defeat TypeScript's control-flow analysis."
  - "Folded the plan's two tasks (source edits + commit) into a single atomic commit. The two tasks are interdependent (edits without commit leave the tree in a non-buildable verified state per the plan's verify blocks), so a single atomic commit is the correct shape and matches the plan's `<output>` (`one git commit`)."

patterns-established:
  - "Shape A — positive guard wrapping a side-effecting consumer: `if (x instanceof TFile) { /* consume x as TFile */ }` (matches NoteService.ts:73 analog)"
  - "Shape B — typed narrow replacing truthy check before `leaf.openFile`: `if (dailyNote instanceof TFile)` lets TypeScript narrow the union for the following `openFile(dailyNote)` call without a cast"

requirements-completed: [DIR-07]

duration: 2min
completed: 2026-05-15
---

# Phase 07 Plan 03: instanceof TFile narrowing (DIR-07) Summary

**Closed DIR-07 at the source level: all 4 `as TFile` casts replaced with `instanceof TFile` runtime narrowing (D-08). Three view files modified, one atomic commit `2c4b5e7` with the exact D-11 step 3 subject line.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-15T13:49:55Z
- **Completed:** 2026-05-15T13:51:50Z
- **Tasks:** 2 (Task 1 source edits, Task 2 atomic commit — folded into a single commit)
- **Files modified:** 3
- **Total edits:** 4

## Edit Sites — Shape A vs Shape B

### Shape A — Positive guard wrapping `Map.set` (1 site)

| # | File:Line (post-commit) | Before | After |
|---|--|--|--|
| 1 | `src/views/CalendarView.ts:148` | `this.dailyNotes.set(dateStr, file as TFile);` (inside `Object.entries(allDailyNotes).forEach(...)`) | Wrapped in `if (file instanceof TFile) { this.dailyNotes.set(dateStr, file); }`. Net diff: +2 lines, removes `as TFile`. Non-`TFile` entries are silently dropped from the map (strictly safer than the previous cast-then-crash path). |

### Shape B — Typed narrow replacing truthy check before `leaf.openFile` (3 sites)

| # | File:Line (post-commit) | Before | After |
|---|--|--|--|
| 2 | `src/views/CalendarView.ts:828` | `if (dailyNote) { const leaf = this.app.workspace.getLeaf("tab"); await leaf.openFile(dailyNote as TFile); }` | `if (dailyNote instanceof TFile) { const leaf = this.app.workspace.getLeaf("tab"); await leaf.openFile(dailyNote); }`. Same line count, replaces truthy check with typed narrow, drops `as TFile` cast. |
| 3 | `src/views/EmbeddedCalendarView.ts:232` (line 234 in plan refers to the `openFile` call; the `if` line is 232 after the swap) | `if (dailyNote) { ... await leaf.openFile(dailyNote as TFile); }` | `if (dailyNote instanceof TFile) { ... await leaf.openFile(dailyNote); }` |
| 4 | `src/views/EmbeddedAgendaView.ts:381` (line 383 in plan refers to the `openFile` call; the `if` line is 381 after the swap) | `if (dailyNote) { ... await leaf.openFile(dailyNote as TFile); }` | `if (dailyNote instanceof TFile) { ... await leaf.openFile(dailyNote); }` |

The 3 Shape B sites previously trusted the `TFile` shape via `as TFile`; an unexpected `TFolder` (or other `TAbstractFile` subtype) returned by `getDailyNote()` / `createDailyNote()` would have passed the truthy check and then crashed at `leaf.openFile(...)`. The new behavior skips the open path cleanly. The surrounding `try/catch` blocks at `CalendarView.ts:830-836`, `EmbeddedCalendarView.ts:236-242`, `EmbeddedAgendaView.ts:385-391` remain unchanged — they continue to handle filesystem errors from `await leaf.openFile(...)`.

## In-Tree Analogs (Pattern Reuse)

The 4 new guards bring the total `instanceof TFile` site count in `src/` to 7. The 3 pre-existing analogs that established the pattern:

| File:Line | Context |
|-----------|---------|
| `src/services/NoteService.ts:73` | Inside `getExistingEventNote()`; positive narrow before returning `{ file: existingFile, cursor: null }` |
| `src/services/NoteService.ts:89` | Inside `createEventNote()`; positive narrow before treating an existing file as a `TFile` |
| `src/services/CalendarService.ts:518` | Negated narrow `if (!file || !(file instanceof TFile))` for early-return safety when reading a local `.ics` file |

PATTERNS Pattern 2 + D-08 both required that no helper (`assertIsFile`, `isTFile`, etc.) be introduced — `instanceof` is the operator that produces TypeScript's narrowed type, and any wrapper defeats control-flow analysis. Verified: `git diff HEAD~1` introduces no new exported function for `TFile` narrowing.

## Import Verification

All 3 modified files already import `TFile` from the `obsidian` package:

| File | Import line |
|------|-------------|
| `src/views/CalendarView.ts:1` | `import { ItemView, WorkspaceLeaf, Notice, TFile, DropdownComponent, setIcon, MarkdownView, Menu, MenuItem } from "obsidian";` |
| `src/views/EmbeddedCalendarView.ts:1` | `import { MarkdownRenderChild, Notice, TFile } from "obsidian";` |
| `src/views/EmbeddedAgendaView.ts:1` | `import { MarkdownRenderChild, MarkdownView, Notice, setIcon, TFile } from "obsidian";` |

No new imports added. No import statement changed.

## Task Commits

1. **Task 1 + Task 2 combined: source edits + atomic commit** — `2c4b5e7` (refactor)

Plan tasks were structured as separate "source edits" (Task 1) and "commit only" (Task 2) steps. The two are interdependent — the plan's Task 2 verify block requires zero `as TFile` in src AND lint+build green, which is only achievable once all 4 edits land together. A single atomic commit covers both tasks' acceptance criteria.

## Verification Output

- **`npm run build`** at HEAD: exit 0 (`tsc --noEmit -skipLibCheck && node esbuild.config.mjs production`)
- **`npm run lint`** at HEAD: exit 0 (Phase 7 override block at `eslint.config.mjs:65-91` still active; `obsidianmd/no-tfile-tfolder-cast` and `@typescript-eslint/no-unnecessary-type-assertion` both suppressed at this commit — the override removal lands in plan 07-05)
- **Lint violation-count delta vs HEAD~1**: **0 → 0** (no regression). Measured by `git stash`ing the changes, running lint to capture the baseline, then restoring. Both pre-change (HEAD~1) and post-change (HEAD) lint outputs are clean. The 2 `@typescript-eslint/no-unnecessary-type-assertion` cascade violations identified in CONTEXT.md `<domain>` would close automatically if the rule were active anywhere, but the Phase 7 override block currently suppresses them; the cascade is structurally satisfied (the `as TFile` casts that would have triggered the rule are gone), so when the override block is removed in plan 07-05 the rule will report zero violations.
- **`git ls-files src/ | xargs grep -n 'as TFile'`** at HEAD: ZERO MATCHES (ROADMAP Phase 7 success criterion #3 satisfied verbatim)
- **`git ls-files src/ | xargs grep -nE 'instanceof\s+TFile'`** at HEAD: 7 matches across `src/` — 4 new edits (`CalendarView.ts:148`, `CalendarView.ts:828`, `EmbeddedCalendarView.ts:232`, `EmbeddedAgendaView.ts:381`) + 3 pre-existing analogs (`NoteService.ts:73`, `NoteService.ts:89`, `CalendarService.ts:518`). Plan said "at least 6"; the extra `NoteService.ts:89` analog brings it to 7.
- **`grep -c 'instanceof TFile' src/views/CalendarView.ts`**: 2 (sites 148 and 828)
- **`grep -c 'instanceof TFile' src/views/EmbeddedCalendarView.ts`**: 1 (site 232)
- **`grep -c 'instanceof TFile' src/views/EmbeddedAgendaView.ts`**: 1 (site 381)
- **`git log -1 --pretty=%s`**: `refactor(views): narrow TAbstractFile via instanceof TFile (DIR-07)` (exact match to D-11 step 3 subject line)
- **`git log -1 --pretty=%B | grep -iE 'claude|AI assist|Co-Authored-By'`**: ZERO MATCHES (CLAUDE.md compliance)
- **`git diff HEAD~1 --name-only | sort`**: exactly 3 files — `src/views/CalendarView.ts`, `src/views/EmbeddedAgendaView.ts`, `src/views/EmbeddedCalendarView.ts`
- **Diff stats**: 3 files changed, 9 insertions(+), 7 deletions(-) (net +2 lines: Edit 1 Shape A adds 2 lines for the guard; Edits 2-4 are line-neutral)

## Commit Message Compliance

The commit message body contains no Claude / AI / assistant / Co-Authored-By references (verified by `git log -1 --pretty=%B | grep -iE 'claude|AI assist|Co-Authored-By'` returning zero matches). Per CLAUDE.md Memory Reminders, no such references appear in commit messages or release notes.

## Decisions Made

1. **Folded Tasks 1+2 into a single atomic commit.** Task 1 (source edits) and Task 2 (commit) are structurally interdependent — the plan's Task 2 verify block requires zero `as TFile` at HEAD and lint+build green, which is only achievable once all 4 edits land in a single commit. The plan's `<output>` block also explicitly says "one git commit". No deviation, just structural simplification.

2. **No helper introduced.** D-08 + PATTERNS Pattern 2 explicitly prohibit `assertIsFile` / `isTFile` / `narrowToTFile` wrappers. The `instanceof` operator IS the narrow; any wrapper defeats control-flow analysis (TypeScript narrows the union only when the operator appears literally in the condition, per RESEARCH §"Don't Hand-Roll"). The 3 pre-existing analogs (`NoteService.ts:73`, `NoteService.ts:89`, `CalendarService.ts:518`) all use the inline shape; the 4 new sites follow suit.

3. **Used Edit (not replace_all) for all 4 sites.** Each site has unique surrounding context, so a single targeted `Edit` per site is the precise tool. Unlike plan 07-02 (which used `replace_all` for identical one-token swaps across many sites), this plan's 4 edits live in 4 distinct shapes/contexts and benefit from per-site review.

4. **Measured lint baseline via `git stash`.** To compute the lint count delta vs HEAD~1, I stashed the working-tree changes, ran lint on the baseline tree, then popped the stash. Confirmed: 0 violations before, 0 violations after. The two `@typescript-eslint/no-unnecessary-type-assertion` cascade violations in CONTEXT.md `<domain>` are suppressed by the Phase 7 override block at this commit but would close structurally once the override is removed in plan 07-05.

## Deviations from Plan

### Auto-fixed Issues

None — the plan's instructions exactly matched the source tree. No bugs, no missing functionality, no blocking issues.

### Plan-Structural Simplifications (Not Deviations)

**1. Folded Task 1 + Task 2 into a single atomic commit**

- **Found during:** Final commit step
- **Issue:** Plan Task 2 was structured as a separate "commit only" task. Task 1 (source edits) leaves the tree in a state where 4 `as TFile` casts are gone but uncommitted — Task 2's verify block requires the commit to exist at HEAD with the correct subject, which can only be achieved by committing.
- **Fix:** A single commit with subject `refactor(views): narrow TAbstractFile via instanceof TFile (DIR-07)` covers both tasks. The commit body includes the cascade note and the strictly-safer behavior note from Task 2's commit-message spec.
- **Impact:** None — matches the plan's `<output>` block ("one git commit"). Same as plan 07-02's structural pattern.

### Plan vs Live Line-Number Reconciliation

The plan's `<must_haves>` block referenced 4 site lines: `CalendarView.ts:148`, `CalendarView.ts:828`, `EmbeddedCalendarView.ts:234`, `EmbeddedAgendaView.ts:383`. Live `git ls-files src/ | xargs grep -n 'as TFile'` confirmed all 4 lines exactly. Post-commit, the `if`-line positions for the Shape B sites shift by 2 lines in `EmbeddedCalendarView.ts` (234 → 232 for the `if`-line, since the original 234 was the `openFile` line) and similarly for `EmbeddedAgendaView.ts` (383 → 381 for the `if`-line). These are reporting conventions — the `if`-line is what `grep -n 'instanceof TFile'` returns, the `openFile` line was what the plan referenced. No semantic discrepancy.

---

**Total deviations:** 0 auto-fix (plan was exact)
**Plan-structural simplifications:** 1 (single commit)
**Impact on plan:** None on artifacts; the commit subject, file list, and verification all match the plan exactly.

## Issues Encountered

None.

## Threat Flags

None — Phase 7 ships no new attack surface per the plan's `<threat_model>` (T-07-05 disposition `mitigate`, severity none). The 4 new `instanceof TFile` guards are exactly the mitigation called for in the threat register: malformed daily-notes plugin returns (`TFolder` or other `TAbstractFile` subtypes) are now filtered out (Shape A) or skipped (Shape B) rather than passing through to a downstream crash.

## Known Stubs

None.

## TDD Gate Compliance

Not applicable — plan type is `execute` (not `tdd`); no `tdd="true"` task in this plan.

## Hand-off to Plan 07-04 (DIR-08 floating promises + MarkdownRenderChild lifecycle)

**Plan 07-04 is unblocked.** This plan touched no promise-await sites or `MarkdownRenderChild` lifecycle hooks — those are isolated to the embedded-view classes (`EmbeddedCalendarView`, `EmbeddedAgendaView`) and to floating-promise call sites in views/services per phase 07-PATTERNS.md. The `instanceof TFile` narrowing established here does not interact with the promise-hygiene work.

The Phase 7 ESLint override block at `eslint.config.mjs:65-91` remains active for `obsidianmd/no-tfile-tfolder-cast` (rule structurally satisfied at this commit — zero `as TFile` in src) and for the remaining DIR-08 rules. The override removal lands in plan 07-05 after 07-04 closes the promise-hygiene work.

## Self-Check: PASSED

Verified claims:
- `src/views/CalendarView.ts` exists (modified) ✓
- `src/views/EmbeddedCalendarView.ts` exists (modified) ✓
- `src/views/EmbeddedAgendaView.ts` exists (modified) ✓
- Commit `2c4b5e7` exists in `git log --oneline` ✓
- Commit subject exactly matches `refactor(views): narrow TAbstractFile via instanceof TFile (DIR-07)` ✓
- Commit body contains no Claude/AI/Co-Authored-By references ✓
- `npm run build` exits 0 at HEAD ✓
- `npm run lint` exits 0 at HEAD ✓
- Zero `as TFile` matches in `src/` at HEAD ✓
- 7 `instanceof TFile` occurrences in `src/` at HEAD (4 new + 3 pre-existing analogs) ✓
- Per-file post-edit `instanceof TFile` counts: CalendarView.ts=2, EmbeddedCalendarView.ts=1, EmbeddedAgendaView.ts=1 ✓
- `git diff HEAD~1 --name-only | sort` lists exactly the 3 view files ✓
- No new helper function introduced ✓
- `TFile` already imported in all 3 view files (no import line added) ✓

---
*Phase: 07-lifecycle-compatibility*
*Completed: 2026-05-15*
