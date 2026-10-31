---
phase: 07-lifecycle-compatibility
plan: 05
subsystem: obsidian-plugin
tags: [obsidian-plugin, eslint, override-removal, phase-acceptance, lint-gate, dir-05, dir-06, dir-07, dir-08]

requires:
  - phase: 07-lifecycle-compatibility
    plan: 01
    provides: DIR-05 source-level closure (calendarView field deleted, getCalendarView helper, detachLeavesOfType removed)
  - phase: 07-lifecycle-compatibility
    plan: 02
    provides: DIR-06 source-level closure (11 activeDocument swaps + 4 window-prefixed timers)
  - phase: 07-lifecycle-compatibility
    plan: 03
    provides: DIR-07 source-level closure (4 `as TFile` casts replaced with `instanceof TFile`)
  - phase: 07-lifecycle-compatibility
    plan: 04
    provides: DIR-08 source-level closure (27 promise-disposition fixes + 2 MarkdownRenderChild sync wrappers)
provides:
  - Phase 7 ESLint override block at eslint.config.mjs:65-91 DELETED
  - 8 rules now actively enforced across all of src/ via DOC-01 CI lint gate
  - ROADMAP Phase 7 success criterion #4 satisfied (Phase 5 ESLint overrides for these rules removed; `npm run lint` still passes)
  - Two residual `as number` casts at CalendarView.ts removed inline (Rule 3 — required for lint to pass)
affects: [07-06-uat, 07-07-bug-07-closure, 08-type-hygiene]

tech-stack:
  added: []
  patterns: [eslint-override-block-delete, no-unnecessary-type-assertion-narrowing]

key-files:
  created:
    - .planning/phases/07-lifecycle-compatibility/07-05-SUMMARY.md
  modified:
    - eslint.config.mjs
    - src/views/CalendarView.ts

key-decisions:
  - "Applied the 2 `as number` cast removals at CalendarView.ts:435 and CalendarView.ts:1220 inline as part of this commit (Rule 3 — required for build correctness once the override block was deleted; the casts were redundant because the `else`-branch of `if (this.viewMode === 'month')` already narrows `viewMode: CalendarViewMode` to `1|2|3|4|5` which TypeScript accepts as `number`). Plan 07-04's SUMMARY anticipated this exact follow-up."
  - "Left the 3 `obsidianmd/prefer-active-doc` warnings at SettingsTab.ts:567, 572, 590 alone — they fire on `document.createElementNS(SVG_NS, ...)` calls per Phase 6 D-12 / Plan 07-02 leave-alone (the rule's auto-fix would break SVG creation). Warnings (not errors) do not block `npm run lint` (exit 0)."
  - "Single atomic commit covers both tasks per the plan's `<output>` block — the override deletion plus the cascade-fix in CalendarView.ts have no intermediate buildable state."

patterns-established:
  - "Override-block-delete commits leave `eslint.config.mjs` flowing from the previous phase's closing `},` directly to the next phase's `// ----` comment header — no orphan blank lines"
  - "Inline cascade fix on `no-unnecessary-type-assertion` violations: the `as <type>` is redundant whenever a previous condition has already narrowed the union to a subtype of the target type; the fix is to delete the cast (one-token swap), not to weaken the rule"

requirements-completed: [DIR-05, DIR-06, DIR-07, DIR-08]

duration: 8min
completed: 2026-05-15
---

# Phase 07 Plan 05: Remove Phase 7 ESLint Override Block (DIR-05/06/07/08 acceptance) Summary

**Closed all four directory-scorecard findings (DIR-05/06/07/08) at the lint-enforcement level by deleting the Phase 7 override block at `eslint.config.mjs:65-91` (28 lines removed). The 8 rules previously suppressed are now actively enforced across all of `src/`. A small follow-up source fix in `src/views/CalendarView.ts` removed two residual `as number` casts that surfaced once the `no-unnecessary-type-assertion` rule went active. One atomic commit `366cfbb` with the exact D-11 step 6 subject line; `npm run lint` exits 0 at HEAD.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-15 (post-07-04)
- **Completed:** 2026-05-15
- **Tasks:** 2 (Task 1 override-block deletion + Task 2 atomic commit — folded into a single commit per plan `<output>`)
- **Files modified:** 2

## eslint.config.mjs Deletion Details

### Line range deleted

The Phase 7 override block at the pre-commit lines **65-91** (4-line comment header + 23-line config object) plus the trailing blank line at 92 — net **28 lines** removed.

**Pre-commit shape (lines 63-93):**

```javascript
  },                                            // line 63 — Phase 5 (DOC-01) block close

  // ---------------------------------------    // line 65
  // Phase 7 — DIR-05 / DIR-06 / DIR-07 / DIR-08 will remove these when the
  // lifecycle / compatibility cleanup lands.
  // ---------------------------------------    // line 68
  {                                             // line 69
    files: [                                    // line 70
      "src/main.ts",
      "src/views/CalendarView.ts",
      "src/views/EmbeddedCalendarView.ts",
      "src/views/EmbeddedAgendaView.ts",
      "src/settings/SettingsTab.ts",
      "src/services/CalendarService.ts",
      "src/services/NoteService.ts",
      "src/utils/colorValidation.ts",
      "src/utils/viewRenderers.ts",
    ],
    rules: {
      "obsidianmd/no-view-references-in-plugin": "off",
      "obsidianmd/no-tfile-tfolder-cast": "off",
      "obsidianmd/prefer-active-doc": "off",
      "obsidianmd/prefer-window-timers": "off",
      "obsidianmd/detach-leaves": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },                                            // line 91

  // ---------------------------------------    // line 93 — Phase 8 block start
```

**Post-commit shape (lines 63-65):**

```javascript
  },                                            // line 63 — Phase 5 (DOC-01) block close

  // ---------------------------------------    // line 65 — Phase 8 block start
```

### Phase-marker grep at HEAD

```bash
$ grep -nE 'Phase [5678]\b' eslint.config.mjs
1:// eslint.config.mjs — Phase 5 (DOC-01) — MemoChron v1.15 Directory Compliance
43:  // Phase 5 tightens these defaults to satisfy DOC-01's wording:
66:  // Phase 8 — DIR-01 / DIR-09 / DIR-10 will remove these when type-hygiene
77:      "no-console": "off", // Re-tightened in Phase 8 to "error"
89:  // Phase 8 — DIR-01 will remove these when type-hygiene lands. Narrow `files`
```

**Phase 5 still present (lines 1, 43). Phase 7 GONE (zero matches). Phase 8 still present (lines 66, 77, 89).** Exactly the desired end-state.

### Line-count delta

- **HEAD~1 (pre-commit):** 142 lines
- **HEAD (post-commit):** 114 lines
- **Delta:** -28 lines (27 Phase 7 block lines + 1 trailing blank separator)

## 8 Deleted Rule Disables

Each rule previously off-toggled in the Phase 7 block, with the plan/closure that satisfied its violations:

| # | Rule | DIR finding | Closure plan |
|---|------|-------------|--------------|
| 1 | `obsidianmd/no-view-references-in-plugin` | DIR-05 | 07-01 (calendarView field deleted) |
| 2 | `obsidianmd/no-tfile-tfolder-cast` | DIR-07 | 07-03 (`as TFile` → `instanceof TFile`) |
| 3 | `obsidianmd/prefer-active-doc` | DIR-06 | 07-02 (11 `getComputedStyle(document.documentElement)` → `activeDocument.documentElement`) |
| 4 | `obsidianmd/prefer-window-timers` | DIR-06 | 07-02 (4 bare timers → `window.setTimeout` / `window.requestAnimationFrame`) |
| 5 | `obsidianmd/detach-leaves` | DIR-05 (A1) | 07-01 (`detachLeavesOfType` deleted from `onunload`) |
| 6 | `@typescript-eslint/no-floating-promises` | DIR-08 | 07-04 (10 floating promises → `void` / `.catch`) |
| 7 | `@typescript-eslint/no-misused-promises` | DIR-08 | 07-04 (17 misused promises + 2 `async onload()` → sync wrappers / `void` callback bodies) |
| 8 | `@typescript-eslint/no-unnecessary-type-assertion` | DIR-07 cascade | 07-03 + 07-05 (`as TFile` casts removed in 07-03; 2 residual `as number` casts at CalendarView.ts:435 + 1220 removed inline in this commit) |

## src/views/CalendarView.ts Inline Follow-up Fix

After the override-block deletion, `npm run lint` initially failed with 2 errors:

```
src/views/CalendarView.ts
   435:33  error  This assertion is unnecessary since the receiver accepts the original type of the expression  @typescript-eslint/no-unnecessary-type-assertion
  1220:15  error  This assertion is unnecessary since the receiver accepts the original type of the expression  @typescript-eslint/no-unnecessary-type-assertion
```

These were 2 residual `as number` casts on `this.viewMode: CalendarViewMode` (where `CalendarViewMode = 'month' | 1 | 2 | 3 | 4 | 5`). In both sites, the cast appears in the `else`-branch of `if (this.viewMode === 'month')`, where TypeScript already narrows the union to `1 | 2 | 3 | 4 | 5` — a subtype of `number` that needs no cast.

Per Plan 07-05 Task 1's instruction ("does NOT re-add the override; identifies the missing source-side fix and applies it inline; stages both `eslint.config.mjs` AND any source-side fix as PART OF THIS commit"), the 2 casts were removed inline:

| # | Site | Before | After |
|---|------|--------|-------|
| 1 | `src/views/CalendarView.ts:435` | `this.renderWeekDays(grid, this.viewMode as number);` | `this.renderWeekDays(grid, this.viewMode);` |
| 2 | `src/views/CalendarView.ts:1220` | `weeks = this.viewMode as number;` | `weeks = this.viewMode;` |

Plan 07-04's SUMMARY explicitly anticipated this exact follow-up — "Plan 07-05 will need to consider… 2 errors at CalendarView.ts:435, 1220 — `this.viewMode as number` casts… can either remove the casts directly (one-line change at each site) or keep them suppressed via a narrower override." The direct-removal path matches the plan's intent (no new suppression).

After the inline fix, `npm run build` exits 0 (TypeScript accepts the un-casted access), `npm run lint` exits 0 (3 warnings, 0 errors).

## Verification Output

### Post-commit grep checks

```bash
$ grep -nE 'Phase 7\b' eslint.config.mjs
(zero matches)

$ for rule in 'obsidianmd/no-view-references-in-plugin' 'obsidianmd/no-tfile-tfolder-cast' 'obsidianmd/prefer-active-doc' 'obsidianmd/prefer-window-timers' 'obsidianmd/detach-leaves' '@typescript-eslint/no-floating-promises' '@typescript-eslint/no-misused-promises' '@typescript-eslint/no-unnecessary-type-assertion'; do
    grep -cE "\"${rule}\"\\s*:\\s*\"off\"" eslint.config.mjs
  done
  # All 8 return 0

$ grep -c '"no-restricted-syntax"' eslint.config.mjs
1   # Phase 5 DOC-01 preserved

$ grep -cE 'Phase 8\b' eslint.config.mjs
3   # Phase 8 markers preserved

$ grep -cE '"@typescript-eslint/no-explicit-any"\s*:\s*"off"' eslint.config.mjs
1   # Phase 8 rule preserved

$ grep -cE '"no-console"\s*:\s*"off"' eslint.config.mjs
1   # Phase 8 rule preserved

$ grep -cE 'globalIgnores\(' eslint.config.mjs
1   # bottom block preserved
```

### `npm run lint` output at HEAD

```
> memochron@1.14.0 lint
> eslint src/

/Users/mike/code/memoChron/.../src/settings/SettingsTab.ts
  567:17  warning  Use 'activeDocument' instead of 'document' for popout window compatibility  obsidianmd/prefer-active-doc
  572:20  warning  Use 'activeDocument' instead of 'document' for popout window compatibility  obsidianmd/prefer-active-doc
  590:20  warning  Use 'activeDocument' instead of 'document' for popout window compatibility  obsidianmd/prefer-active-doc

✖ 3 problems (0 errors, 3 warnings)
```

**Exit code: 0.** The 3 warnings are `obsidianmd/prefer-active-doc` fires on `document.createElementNS(SVG_NS, ...)` calls per Phase 6 D-12 / Plan 07-02 leave-alone (the rule auto-fix would break SVG creation; warning-only, not error). They are intentional leave-alone sites; `npm run lint` exits 0 regardless of warnings per Phase 5 DOC-01 configuration.

### `npx eslint --fix src/` no-op confirmation

```bash
$ git status -s
 M eslint.config.mjs
 M src/views/CalendarView.ts

$ npx eslint --fix src/
(same 3 warnings as above; 0 errors)

$ git status -s
 M eslint.config.mjs
 M src/views/CalendarView.ts
```

**Identical `git status` before and after `--fix`** — no source-side diff was produced. Per RESEARCH §"Verification probe", `npx eslint --fix` is a no-op at HEAD, confirming the source already satisfies the active rules and no auto-fix would rewrite anything.

### Full DIR-05/06/07/08 grep set at HEAD (all zero)

```bash
$ git ls-files src/ | xargs grep -nE 'this\.calendarView\b'         # DIR-05
(zero matches)

$ git ls-files src/ | xargs grep -n 'detachLeavesOfType'             # DIR-05 / A1
(zero matches)

$ git ls-files src/ | xargs grep -nE 'getComputedStyle\(document\.documentElement\)'  # DIR-06
(zero matches)

$ git ls-files src/ | xargs grep -nE '\b(setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame)\(' | grep -v 'window\.' | grep -vE '^[^:]*:[0-9]+:\s*(//|\*|/\*)'  # DIR-06 / A2
(zero non-comment matches)

$ git ls-files src/ | xargs grep -n 'as TFile'                       # DIR-07
(zero matches)

$ grep -nE 'async onload\(\)' src/views/Embedded*.ts                 # DIR-08 / D-10
(zero matches)
```

All 6 DIR-05/06/07/08 grep checks return zero. ROADMAP Phase 7 success criterion #4 satisfied verbatim.

### Build verification

```bash
$ npm run build
> memochron@1.14.0 build
> tsc -noEmit -skipLibCheck && node esbuild.config.mjs production
# exit 0 — TypeScript still compiles after the 2 `as number` cast removals
```

### Commit metadata

- **SHA:** `366cfbb` (full: `366cfbb2fee1a8a8cea0403d0e4c924b317ec514`)
- **Subject:** `chore(lint): remove Phase 7 ESLint overrides (DIR-05/06/07/08 acceptance)` (exact match to D-11 step 6)
- **Diff stat:** 2 files changed, 2 insertions(+), 30 deletions(-)
- **Files in commit:** `eslint.config.mjs`, `src/views/CalendarView.ts`

## Task Commits

1. **Task 1 + Task 2 combined: override-block deletion + inline cascade fix + atomic commit** — `366cfbb` (chore)

Tasks 1 (delete the override block) and Task 2 (commit) folded into a single atomic commit per the plan's `<output>` ("one git commit") and per the precedent of Plans 07-01 through 07-04. The 2 `as number` cast removals were applied inline before commit as Task 1 explicitly authorized ("Identifies the missing source-side fix… applies it inline as a follow-up edit BEFORE committing. Stages both `eslint.config.mjs` AND any source-side fix as PART OF THIS commit").

## Commit Message Compliance

`git log -1 --pretty=%B | grep -iE 'claude|AI assist|Co-Authored-By'` returns ZERO matches. Per CLAUDE.md Memory Reminders, the commit body contains no Claude / AI / assistant / Co-Authored-By references. The body documents:

1. The block deletion at `eslint.config.mjs:65-91` and enumeration of the 8 rules now actively enforced
2. Phase 5 / Phase 8 / globalIgnores adjacency preserved (Phase 8 owns its own removal)
3. Lint outcome (exit 0) and the source-side `as number` cast removal in `CalendarView.ts` as the inline cascade fix
4. CI lint-gate confirmation that DIR-05/06/07/08 regressions are now blocked

## Decisions Made

1. **Removed the 2 `as number` casts at CalendarView.ts:435 and 1220 inline as part of this commit (Rule 3 — required for lint to pass).** Plan 07-04's SUMMARY anticipated this exact follow-up. The casts are redundant: TypeScript narrows `CalendarViewMode = 'month' | 1 | 2 | 3 | 4 | 5` to `1 | 2 | 3 | 4 | 5` in the `else` branch, which is a subtype of `number` and needs no cast. Direct removal matches the plan intent (no new suppression).

2. **Left 3 `obsidianmd/prefer-active-doc` warnings (SettingsTab.ts:567, 572, 590) alone.** These fire on `document.createElementNS(SVG_NS, ...)` calls. The rule's auto-fix would break SVG creation. Per Phase 6 D-12 / Plan 07-02 leave-alone, these are intentional. They fire as warnings (not errors), so `npm run lint` exits 0.

3. **Folded the plan's two tasks into a single atomic commit.** No intermediate buildable state separates the deletion of the override block from the cascade fix to CalendarView.ts — running the lint gate (the commit's whole point) requires both edits to land together. Single-commit matches the plan's `<output>` ("one git commit"), mirroring Plans 07-01 through 07-04.

4. **Used a precise `Edit` replacement for the override-block deletion (not Write or sed).** The old_string spans 30 lines (the Phase 7 comment block + the config object + the trailing blank line + the Phase 8 comment header opening), and new_string is just the Phase 8 comment header opening — produces the exact line-flow specified in the plan (Phase 5 `},` → blank → Phase 8 `// ----`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Removed 2 `as number` type assertions at `src/views/CalendarView.ts:435` and `src/views/CalendarView.ts:1220`**

- **Found during:** Task 1 (post-deletion `npm run lint` run)
- **Issue:** After the Phase 7 override block deletion, `@typescript-eslint/no-unnecessary-type-assertion` activated across all of `src/`. It immediately flagged 2 errors: `this.viewMode as number` at line 435 (inside `renderCalendarGrid`'s else-branch) and `this.viewMode as number` at line 1220 (inside `calculateOptimalHeight`'s else-branch). Without a source-side fix, `npm run lint` would have failed at the commit point, defeating the entire purpose of the commit (per Task 1's explicit instruction).
- **Fix:** Delete `as number` at both sites. The `else`-branch of `if (this.viewMode === 'month')` already narrows the `CalendarViewMode = 'month' | 1 | 2 | 3 | 4 | 5` union to `1 | 2 | 3 | 4 | 5` — a numeric-literal-union subtype of `number`. TypeScript accepts the un-casted access for both the `renderWeekDays(grid, weeks: number)` parameter and the `weeks: number` local assignment.
- **Files modified:** `src/views/CalendarView.ts` (2 lines, 2 edits)
- **Verification:** `npm run build` exits 0 (TypeScript happy with the narrowed access). `npm run lint` exits 0 (0 errors). The plan's `<verify>` block on Task 1 explicitly authorized this exact follow-up shape ("Identifies the missing source-side fix in plans 07-01/02/03/04 and applies it inline as a follow-up edit BEFORE committing. Stages both `eslint.config.mjs` AND any source-side fix as PART OF THIS commit").
- **Committed in:** `366cfbb` (the same atomic commit; documented in commit body paragraph 3).

### Plan-Structural Simplifications (Not Deviations)

**1. Folded Plan Tasks 1 + 2 into a single atomic commit**

- **Found during:** Task 2 commit step
- **Issue:** Plan Task 2 was structured as a separate "commit only" task. Task 1 (delete the override block) and Task 2 (commit) cannot be split into two commits without leaving the tree in a state where the lint gate has been removed but no commit yet exists. The single-commit shape is what the plan's `<output>` already specifies.
- **Fix:** A single commit with subject `chore(lint): remove Phase 7 ESLint overrides (DIR-05/06/07/08 acceptance)` satisfies both tasks' acceptance criteria.
- **Impact:** None — matches the plan's `<output>` ("one git commit") and the established structural pattern from Plans 07-01 through 07-04.

---

**Total deviations:** 1 auto-fix (Rule 3 — blocking; the 2 `as number` cast removals required for lint to pass; explicitly anticipated and authorized by both the Plan's Task 1 `<action>` and by Plan 07-04's SUMMARY hand-off)
**Plan-structural simplifications:** 1 (single atomic commit)
**Impact on plan:** The Rule 3 auto-fix was required to satisfy the plan's own Task 1 acceptance criterion (`npm run lint` exits 0 at end of task). The diff includes one extra file vs the plan's `<files_modified>` frontmatter (`src/views/CalendarView.ts`) — the plan listed only `eslint.config.mjs`, but the Task 1 `<action>` block explicitly authorized "Stages both `eslint.config.mjs` AND any source-side fix as PART OF THIS commit". No semantic deviation; the plan's frontmatter `<files_modified>` underspecified what Task 1 anticipated.

## Issues Encountered

- **2 residual `@typescript-eslint/no-unnecessary-type-assertion` errors at CalendarView.ts:435, 1220.** Anticipated by Plan 07-04's SUMMARY. Resolved by removing the redundant `as number` casts inline in this commit. See Deviation 1 above.
- **3 `obsidianmd/prefer-active-doc` warnings at SettingsTab.ts:567, 572, 590** on `document.createElementNS(SVG_NS, ...)` calls — intentional leave-alone per Phase 6 D-12 / Plan 07-02. Warnings only, do not block `npm run lint` (exit 0).

## Threat Flags

None — Phase 7 ships no new attack surface per the plan's `<threat_model>`. T-07-08 (Tampering: the removed override block) and T-07-09 (Repudiation: commit message hygiene) both have `mitigate` dispositions with severity `none`. This commit IMPLEMENTS both mitigations:
- T-07-08: Plans 07-01 through 07-04 + this commit's inline cascade fix close every violation site before the rules go active; the post-commit `npm run lint` and `npx eslint --fix src/` no-op probes confirm zero leftover violations. Future regressions on the 8 rules are now blocked by the DOC-01 CI lint gate.
- T-07-09: The commit message contains no Claude / AI / assistant / Co-Authored-By references (verified by `git log -1 --pretty=%B | grep -iE 'claude|AI assist|Co-Authored-By'` returning zero matches).

## Known Stubs

None.

## TDD Gate Compliance

Not applicable — plan type is `execute` (not `tdd`); no `tdd="true"` task in this plan.

## Hand-off to Plan 07-06 (HUMAN UAT walkthrough)

**Plan 07-06 is unblocked.** With Plan 07-05 closed:

- **All four DIR-05/06/07/08 findings are now actively enforced at the lint-gate level.** Future PRs that reintroduce `this.calendarView = view`, `detachLeavesOfType` in `onunload`, `getComputedStyle(document.documentElement)`, bare timer calls, `as TFile` casts, floating promises, or `async onload()` on `MarkdownRenderChild` subclasses will FAIL the build via the DOC-01 CI workflow.
- **The Phase 7 codebase is at acceptance state.** Plan 07-06 (`07-HUMAN-UAT.md`) is the empirical walkthrough in a real Obsidian instance: month/week view navigation, popout window, drop-import, recurring event note creation, BUG-07 modal-close behavior, etc.
- **BUG-07 verification** remains scheduled for Plan 07-06 UAT step 3. If verification passes there, Plan 07-07 (`BUG-07-CLOSURE.md`) is no longer needed; if it fails, Plan 07-07 documents the closure as an Obsidian-side issue.

## Self-Check: PASSED

Verified claims (run at HEAD = `366cfbb`):

- `eslint.config.mjs` exists (modified — Phase 7 block deleted) ✓
- `src/views/CalendarView.ts` exists (modified — 2 `as number` casts removed) ✓
- `.planning/phases/07-lifecycle-compatibility/07-05-SUMMARY.md` exists (created by this Write call) ✓
- Commit `366cfbb` exists in `git log --oneline` ✓
- Commit subject exactly matches `chore(lint): remove Phase 7 ESLint overrides (DIR-05/06/07/08 acceptance)` ✓
- Commit body contains no Claude/AI/Co-Authored-By references ✓
- `npm run build` exits 0 at HEAD ✓
- `npm run lint` exits 0 at HEAD (0 errors, 3 warnings — all `prefer-active-doc` on SVG `createElementNS`, intentional leave-alone) ✓
- `npx eslint --fix src/` is a no-op (no source-side diff produced) ✓
- `grep -nE 'Phase 7\b' eslint.config.mjs` returns 0 matches ✓
- All 8 disabled-rule greps return 0 matches ✓
- Phase 5 / Phase 8 / globalIgnores preserved (each grep returns ≥ 1 match) ✓
- `wc -l eslint.config.mjs` reports 114 (down from 142, delta -28) ✓
- All 6 DIR-05/06/07/08 source-level grep checks return zero matches ✓
- `git diff HEAD~1 --name-only | sort` lists exactly: `eslint.config.mjs`, `src/views/CalendarView.ts` ✓

---
*Phase: 07-lifecycle-compatibility*
*Completed: 2026-05-15*
