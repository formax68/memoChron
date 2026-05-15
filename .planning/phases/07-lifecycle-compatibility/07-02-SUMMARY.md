---
phase: 07-lifecycle-compatibility
plan: 02
subsystem: obsidian-plugin
tags: [obsidian-plugin, popout-window, activeDocument, window-timers, prefer-active-doc, dir-06, a2]

requires:
  - phase: 05-eslint-baseline
    provides: Phase 7 ESLint override block at eslint.config.mjs:65-91 suppressing obsidianmd/prefer-active-doc + obsidianmd/prefer-window-timers at the v1.15 starting tree
  - phase: 07-lifecycle-compatibility
    plan: 01
    provides: getCalendarView workspace-lookup pattern (not consumed in this plan; reads stay inline per phase discretion default)
provides:
  - DIR-06 closure at the source level (11 activeDocument swaps + 4 window-prefixed timer sites)
  - prefer-active-doc / prefer-window-timers compliance across src/views, src/settings, src/utils
  - Popout-window-correct theme reads (CSS custom properties follow the user's focused window)
affects: [07-03-instanceof-tfile, 07-04-promise-hygiene, 07-05-remove-phase-7-override, 07-06-uat]

tech-stack:
  added: []
  patterns: [activeDocument-DOM-reads, window-prefix-for-timers]

key-files:
  created: []
  modified:
    - src/settings/SettingsTab.ts
    - src/utils/colorValidation.ts
    - src/utils/viewRenderers.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedAgendaView.ts

key-decisions:
  - "Used replace_all on the two files with >1 identical sites (SettingsTab.ts ×6 of getComputedStyle; CalendarView.ts ×2) — the one-token swap is identical at every site so replace_all is safe and minimal"
  - "Amended the initial commit to remove a stray case-insensitive `Claude's-Discretion` reference in the body (per CLAUDE.md). Amend was safe because the prior SHA (51a932b) had no downstream consumers and was created seconds earlier in the same agent run; replaced with SHA ec18e06"
  - "No helper introduced (no readAccentColor) — 11 reads remain inline per CONTEXT.md Claude's-Discretion default"

patterns-established:
  - "activeDocument for DOM custom-property reads — `getComputedStyle(activeDocument.documentElement).getPropertyValue('--interactive-accent').trim() || '#7c3aed'`"
  - "window.* prefix for bare timer calls — `window.setTimeout`, `window.requestAnimationFrame` (rule-correct shape per obsidianmd/prefer-window-timers; activeWindow.* is forbidden)"
  - "Intentional asymmetry: activeDocument for DOM, window.* for timers — inline-documented at src/main.ts:215-222"

requirements-completed: [DIR-06]

duration: 3min
completed: 2026-05-15
---

# Phase 07 Plan 02: activeDocument + window-prefix-timers (DIR-06) Summary

**Closed DIR-06 at the source level: 11 `getComputedStyle(document.documentElement)` reads swapped to `getComputedStyle(activeDocument.documentElement)` (D-05), and 4 bare timer sites gained the `window.` prefix (A2). Five files modified, 15 edits total, one atomic commit `ec18e06` with the exact D-11 step 2 subject line.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-15T13:42:23Z
- **Completed:** 2026-05-15T13:45:54Z
- **Tasks:** 3 (Tasks 1+2 source edits, Task 3 atomic commit)
- **Files modified:** 5
- **Total edits:** 15

## Per-File Edit Count

| File | Active-doc swaps | Timer-prefix adds | Total edits |
|------|------------------|-------------------|-------------|
| `src/settings/SettingsTab.ts` | 6 | 2 | 8 |
| `src/views/CalendarView.ts` | 2 | 1 | 3 |
| `src/views/EmbeddedAgendaView.ts` | 1 | 1 | 2 |
| `src/utils/viewRenderers.ts` | 1 | 0 | 1 |
| `src/utils/colorValidation.ts` | 1 | 0 | 1 |
| **Total** | **11** | **4** | **15** |

## D-05 Migration: 11 active-doc swaps

Each site: `getComputedStyle(document.documentElement)` → `getComputedStyle(activeDocument.documentElement)`. Line numbers held stable post-edit (one-token swap; line lengths essentially unchanged).

| # | File | Line | Context |
|---|------|------|---------|
| 1 | `src/settings/SettingsTab.ts` | 170 | daily-note-color initialization |
| 2 | `src/settings/SettingsTab.ts` | 612 | calendar-color-picker theme read (cssVar ternary) |
| 3 | `src/settings/SettingsTab.ts` | 636 | calendar-color-picker isCustom check |
| 4 | `src/settings/SettingsTab.ts` | 670 | daily-note color-picker fallback |
| 5 | `src/settings/SettingsTab.ts` | 681 | daily-note color-picker theme read (cssVar ternary) |
| 6 | `src/settings/SettingsTab.ts` | 705 | daily-note color-picker isCustom check |
| 7 | `src/views/CalendarView.ts` | 658 | calendar-grid daily-note-dot color resolution |
| 8 | `src/views/CalendarView.ts` | 767 | agenda daily-note color resolution |
| 9 | `src/views/EmbeddedAgendaView.ts` | 259 | embedded-agenda daily-note color resolution |
| 10 | `src/utils/viewRenderers.ts` | 144 | shared renderDailyNoteEntry helper |
| 11 | `src/utils/colorValidation.ts` | 46 | `defaultDailyNoteColor()` — uses `activeDocument` global directly (no plugin ref) |

## A2 Migration: 4 timer-prefix additions

Each site: bare timer call → `window.`-prefixed call.

| # | File | Line | Function | Change |
|---|------|------|----------|--------|
| 1 | `src/settings/SettingsTab.ts` | 1381 | autocomplete `blur` handler | `setTimeout(...)` → `window.setTimeout(...)` |
| 2 | `src/settings/SettingsTab.ts` | 1783 | autocomplete `blur` handler | `setTimeout(...)` → `window.setTimeout(...)` |
| 3 | `src/views/CalendarView.ts` | 967 | post-`openFile` cursor restore | `requestAnimationFrame(...)` → `window.requestAnimationFrame(...)` |
| 4 | `src/views/EmbeddedAgendaView.ts` | 425 | post-`openFile` cursor restore | `requestAnimationFrame(...)` → `window.requestAnimationFrame(...)` |

## Verified No-Change (A2 site-by-site reconciliation)

Per amendment A2, the following 6 sites were verified to already be correct (no edit applied):

| # | File | Line | Status |
|---|------|------|--------|
| 1 | `src/main.ts` | 208 | `window.setInterval` — already correct (plan said line 202; live grep shows 208 — content match, content-addressed) |
| 2 | `src/main.ts` | 216 | `window.clearInterval` — already correct (plan said line 210) |
| 3 | `src/main.ts` | 231 | `window.clearTimeout` — already correct (plan said line 225) |
| 4 | `src/main.ts` | 233 | `window.setTimeout` — already correct (plan said line 227) |
| 5 | `src/main.ts` | 241 | `window.clearTimeout` — already correct (plan said line 235) |
| 6 | `src/views/CalendarView.ts` | 79 | `window.setTimeout` — already correct |

The plan's frontmatter line numbers for `main.ts` were 4-6 lines off (e.g., `main.ts:202` for `window.setInterval` is actually at line 208). Content match is exact; the offset is harmless and consistent with comment / docstring drift since 07-01. No deviation — `main.ts` stays untouched per A2.

## Leave-Alone Sites (Cross-Reference)

| File | Lines | Reason |
|------|-------|--------|
| `src/views/CalendarView.ts` | 1112, 1207 | `getComputedStyle(this.calendar)` — element reference, not document reference; PATTERNS Pattern 3 leave-alone |
| `src/settings/SettingsTab.ts` | 562, 567, 585 | `document.createElementNS(SVG_NS, ...)` — SVG creation; Phase 6 D-12 leave-alone (rule does not flag `createElementNS`) |

Verification commands confirm all five lines/files still match their leave-alone patterns post-commit (see Verification Output below).

## Task Commits

1. **Task 1 + Task 2 + Task 3 combined: source edits + atomic commit** — `ec18e06` (refactor)

Per the plan's `<verify>` block on Task 3, the commit is single and atomic. Tasks 1 and 2 are source-edit-only with no intermediate buildable state required; Task 3 is the commit step. Single commit satisfies all three tasks' acceptance criteria.

The initial commit was `51a932b`, but it was amended to `ec18e06` to remove a stray case-insensitive match for "Claude's-Discretion" in the body (paragraph 3 originally said "per CONTEXT Claude's-Discretion"). The amend was safe because:
- The prior SHA had no downstream consumers — created seconds earlier in this same agent run
- No other agent or human had observed the SHA
- The amend reused the identical tree (only the commit message changed)
- This is permitted under the destructive-git-prohibition rules (own commit, just created, no force-push to protected branch)

## Verification Output

- **`npm run build`**: exit 0 (`tsc --noEmit -skipLibCheck && node esbuild.config.mjs production`)
- **`npm run lint`**: exit 0 (Phase 7 override block at `eslint.config.mjs:65-91` still active; both `obsidianmd/prefer-active-doc` and `obsidianmd/prefer-window-timers` are still suppressed in this commit per D-11 — the override removal lands in plan 07-05)
- **Lint violation-count delta vs HEAD~1**: 0 → 0 (no regression; both commits produce zero lint output)
- **`git ls-files src/ | xargs grep -nE 'getComputedStyle\(document\.documentElement\)'`**: zero matches
- **`git ls-files src/ | xargs grep -cE 'getComputedStyle\(activeDocument\.documentElement\)' | awk -F: '{s+=$2} END {print s}'`**: 11 (one per migrated site)
- **`git ls-files src/ | xargs grep -nE '\b(setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame)\(' | grep -v 'window\.' | grep -vE '^[^:]*:[0-9]+:\s*(//|\*|/\*)'`**: zero non-comment matches
- **`grep -c 'window\.setTimeout' src/settings/SettingsTab.ts`**: 2 (sites 1381, 1783)
- **`grep -c 'window\.requestAnimationFrame' src/views/CalendarView.ts`**: 1 (site 967)
- **`grep -c 'window\.requestAnimationFrame' src/views/EmbeddedAgendaView.ts`**: 1 (site 425)
- **`git ls-files src/ | xargs grep -nE 'getComputedStyle\(this\.calendar\)'`**: 2 matches at `CalendarView.ts:1112, 1207` (intentional leave-alone — element refs)
- **`git ls-files src/ | xargs grep -nE 'document\.createElementNS'`**: 3 matches at `SettingsTab.ts:562, 567, 585` (Phase 6 D-12 leave-alone)
- **`git ls-files src/ | xargs grep -nE 'app\.workspace\.active(Window|Document)'`**: zero matches (D-07 satisfied — no workspace-instance indirection)
- **`git log -1 --pretty=%s`**: `refactor(views): adopt activeDocument and add window prefix for timers (DIR-06)` (exact match to D-11 step 2)
- **`git log -1 --pretty=%B | grep -iE 'claude|AI assist|Co-Authored-By'`**: zero matches (CLAUDE.md compliance)
- **`git diff HEAD~1 --name-only | sort`**: exactly 5 files (the 5 expected: SettingsTab.ts, colorValidation.ts, viewRenderers.ts, CalendarView.ts, EmbeddedAgendaView.ts)

## Commit Message Compliance

The commit message contains no Claude / AI / assistant / Co-Authored-By references (verified by `git log -1 --pretty=%B | grep -iE 'claude|AI assist|Co-Authored-By'` returning zero matches). The original commit had an incidental "Claude's-Discretion" reference (phase decision label, but case-insensitive grep flagged it); the commit was amended to use "phase discretion default" instead. Per CLAUDE.md Memory Reminders, no Claude/AI references in commit messages.

## Decisions Made

1. **Used `replace_all` for SettingsTab.ts and CalendarView.ts.** The one-token swap `document.documentElement` → `activeDocument.documentElement` inside `getComputedStyle(...)` is identical at every site. `replace_all` is exact-pattern and safe; produced the expected 6 swaps in SettingsTab and 2 swaps in CalendarView without any collateral matches (verified by post-edit grep showing exactly 11 total `activeDocument.documentElement` occurrences across all 5 files).

2. **Amended the initial commit (51a932b → ec18e06) to remove a stray "Claude" reference.** The initial commit body said "per CONTEXT Claude's-Discretion" — a phase decision label, but the case-insensitive grep flagged it as a Claude reference per CLAUDE.md. Amend is safe because the prior SHA had no downstream consumers and was created in the same agent run; the tree is unchanged, only the commit message text changes. Replaced with "per the phase discretion default".

3. **Folded Tasks 1+2+3 into a single atomic commit.** Tasks 1 and 2 are source-edits only; Task 3 is the commit. The plan's `<verify>` block on Task 3 expects exactly the 5 files in `git diff HEAD~1 --name-only`, which is satisfied by a single commit.

4. **Kept all 11 reads inline (no `readAccentColor` helper).** Per CONTEXT.md `<decisions>` Claude's-Discretion 4th bullet — keep inline.

5. **Documented the `main.ts` line-number drift in the verified-no-change table** rather than treating it as a deviation. The plan's line numbers for `main.ts` (202, 210, 225, 227, 235) are 4-6 lines off the live grep output (208, 216, 231, 233, 241). Content match is exact, the drift is comment/docstring movement since 07-01, and the file is untouched per A2.

## Deviations from Plan

### Auto-fixed Issues

None — the plan's instructions exactly matched the source tree. No bugs, no missing functionality, no blocking issues.

### Plan-Structural Simplifications (Not Deviations)

**1. Folded Task 1 + Task 2 + Task 3 into a single atomic commit**

- **Found during:** Task 3 → final commit
- **Issue:** Plan Task 3 was structured as a separate "commit only" task. Tasks 1 and 2 are source-edits with no intermediate buildable state separating them (both produce a coherent buildable tree only once all 15 edits land).
- **Fix:** A single commit with subject `refactor(views): adopt activeDocument and add window prefix for timers (DIR-06)` covers all three tasks. Acceptance criteria for all tasks are satisfied by this single commit.
- **Impact:** None — this is a structural simplification, matches the plan's `<output>` ("one git commit").

**2. Amended own commit (51a932b → ec18e06) to remove case-insensitive Claude reference**

- **Found during:** Post-commit verification of the "no Claude/AI references" check
- **Issue:** The initial commit body mentioned "Claude's-Discretion" — the phase decision label. CLAUDE.md mandates no Claude references in commits, and the verification grep is case-insensitive, so this triggered a hit.
- **Fix:** Amend with the same tree and a slightly reworded paragraph 3 ("phase discretion default" instead of "CONTEXT Claude's-Discretion"). New SHA: ec18e06.
- **Safety justification:** The prior SHA had no downstream consumers (just-created, no observers, no push). This is NOT a destructive amend of a published commit; it's amending an own-just-created commit. Permitted under the destructive-git-prohibition rules (the rule against amending applies primarily to published / pre-existing commits; for own-just-created commits the rule is "prefer a new commit, but amend is acceptable when no consumer observed the prior SHA").
- **Impact:** Source tree is unchanged. Only the commit message was edited. Verification block confirms the final SHA ec18e06 satisfies all acceptance criteria.

---

**Total deviations:** 0 auto-fix (plan was exact)
**Plan-structural simplifications:** 2 (single commit; own-commit amend for CLAUDE.md compliance)
**Impact on plan:** None on artifacts; the commit subject, file list, and verification all match the plan exactly.

## Issues Encountered

- **Incidental "Claude's-Discretion" reference in initial commit body** — caught by post-commit verification grep (case-insensitive match on "claude"). Resolved by amending the own-just-created commit. See Decision 2 and Deviation 2 above.

## Threat Flags

None — Phase 7 ships no new attack surface per the plan's `<threat_model>` (T-07-03 and T-07-04 both `accept` disposition; severity none). The change is runtime-context hardening:
- `activeDocument` for DOM reads reduces "stale theme on popout window" UX bug surface (no security implication)
- `window.*` for timers follows the rule-correct shape (no new surface; iOS WKWebView timer-ID-pool quirk already managed by the existing owned-handle pattern in `main.ts`)

## Known Stubs

None.

## Hand-off to Plan 07-03 (DIR-07 instanceof TFile narrowing)

**Plan 07-03 is unblocked.** This plan touched no `TFile` / `TFolder` cast sites — those are isolated to `NoteService.ts` and adjacent files per phase 07-PATTERNS.md. The `activeDocument` + `window.*` patterns established here do not interact with the cast-narrowing work.

The Phase 7 ESLint override block at `eslint.config.mjs:65-91` remains active for `obsidianmd/no-tfile-tfolder-cast` (and the rules already satisfied by 07-01 and 07-02). The override removal lands in plan 07-05 after 07-03 (DIR-07) and 07-04 (promise hygiene) close their respective rules.

## Self-Check: PASSED

Verified claims:
- `src/settings/SettingsTab.ts` exists (modified) ✓
- `src/utils/colorValidation.ts` exists (modified) ✓
- `src/utils/viewRenderers.ts` exists (modified) ✓
- `src/views/CalendarView.ts` exists (modified) ✓
- `src/views/EmbeddedAgendaView.ts` exists (modified) ✓
- `.planning/phases/07-lifecycle-compatibility/07-02-SUMMARY.md` exists (created by this Write call)
- Commit `ec18e06` exists in `git log --oneline` ✓
- Commit subject exactly matches `refactor(views): adopt activeDocument and add window prefix for timers (DIR-06)` ✓
- Commit body contains no Claude/AI/Co-Authored-By references ✓
- `npm run build` exits 0 ✓
- `npm run lint` exits 0 ✓
- 11 `activeDocument.documentElement` occurrences across the 5 files ✓
- 0 non-comment bare timer calls in `src/` ✓
- 0 `app.workspace.activeWindow|activeDocument` indirections (D-07) ✓

---
*Phase: 07-lifecycle-compatibility*
*Completed: 2026-05-15*
