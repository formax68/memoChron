---
phase: 07-lifecycle-compatibility
plan: 06
status: complete
date: 2026-05-15
requirements: [DIR-05, DIR-06, DIR-07, DIR-08, BUG-07]
---

# Plan 07-06 — Phase 7 Human UAT Closure

Phase 7 manual-verification leg. Six mandatory UAT steps executed against a freshly built v1.15-beta plugin in Obsidian 1.12.7 / macOS 26.4.1. Five steps PASS outright; one PARTIAL FAIL routes BUG-07 closure to plan 07-07.

## Artifacts

- **`.planning/phases/07-lifecycle-compatibility/07-HUMAN-UAT.md`** — full evidence-of-record with per-step Result + Notes for all 6 UAT steps and Overall Acceptance verdicts for SC #5 + SC #6.
- **Commit `731eaa9`** — `docs(07): record Phase 7 human UAT` (D-11 step 7 subject, exactly one file changed, no Claude / AI references).
- **Commit `72275fc`** — `refactor(settings): adopt activeDocument for buildColorSwatch SVG creation (DIR-06 gap)` — inline gap-closure for the 3 `document.createElementNS` sites that plan 07-02 missed in `SettingsTab.ts:567,572,590`.

## Step verdicts

- Step 1 (Popout Window Walkthrough): **PASS** — calendar grid renders with correct accent colors in popout, navigation works, drag-resize works, auto-refresh fires under popout focus.
- Step 2 (Daily-Note Open Paths): **PASS** — all 3 `instanceof TFile` surfaces open daily notes correctly (sidebar agenda, embedded calendar, embedded agenda).
- Step 3 (Settings-Modal Persistence / BUG-07): **PARTIAL FAIL** — modal stays open on disable (A1 deletion of `detachLeavesOfType` worked), but closes on re-enable. Routed to plan 07-07 (`BUG-07-CLOSURE.md`).
- Step 4 (Sidebar Parity vs v1.14.0): **PASS** — no visual regression in calendar grid or agenda.
- Step 5 (Embedded-View Parity): **PASS** — D-10 sync wrappers do not regress embedded view rendering or interaction.
- Step 6 (Lint Clean): **PASS** — after the inline gap closure at `72275fc`, `npm run lint` exits 0 with 0 errors and 0 warnings; `grep -nE 'Phase 7\b' eslint.config.mjs` returns zero matches; `npx eslint --fix src/` is a no-op.

## Phase 7 commit sequence (D-11 ordering)

```
731eaa9 docs(07): record Phase 7 human UAT                                                (D-11 step 7)
72275fc refactor(settings): adopt activeDocument for buildColorSwatch SVG creation        (gap-closure)
24c7dfa docs(phase-07): update tracking after wave 5                                      (orchestrator)
61625ec chore: merge executor worktree (worktree-agent-aa238d3cdb195ccef)                 (worktree merge)
06bbe8c docs(07-05): summarize Phase 7 override-block removal                             (D-11 step 6 SUMMARY)
366cfbb chore(lint): remove Phase 7 ESLint overrides (DIR-05/06/07/08 acceptance)         (D-11 step 6)
...
14f050d refactor(views): fix floating promises and MarkdownRenderChild lifecycle          (D-11 step 4 / DIR-08)
...
2c4b5e7 refactor(views): narrow TAbstractFile via instanceof TFile (DIR-07)               (D-11 step 3)
...
ec18e06 refactor(views): adopt activeDocument and add window prefix for timers (DIR-06)   (D-11 step 2)
...
c47dffe refactor(main): fix view-in-registerView memory leak (DIR-05)                     (D-11 step 1)
```

The canonical 6-commit D-11 sequence is present (worktree merges and orchestrator tracking commits interleaved but do not change the source-commit ordering).

## ROADMAP Phase 7 success criteria

- SC #5 (BUG-07): **FAIL** — closure note in plan 07-07.
- SC #6 (popout-window rendering): **PASS** — outright, no deviation observed.
- SC #1–#3 (grep gates), SC #4 (lint clean): all closed in plans 07-01..07-05 + the 72275fc gap-closure.

## Hand-off

- **Plan 07-07** lands `BUG-07-CLOSURE.md` per CONTEXT D-12 step 3 + D-11 step 5 (conditional commit 5). The closure must capture reproduction steps, Obsidian version (1.12.7), OS (macOS 26.4.1), and forum-thread evidence (https://forum.obsidian.md/t/settings-modal-closes-when-disabling-a-plugins-actively-focused-view/111479) confirming Obsidian-side root cause.
- After plan 07-07 lands, Phase 7 is fully complete. Phase 8 (Type Hygiene & Conventions / DOC-02) may begin.

## Deviations

- **Plan task 1 (build-ready checkpoint):** Handled inline by the orchestrator rather than via a subagent — the build artifacts (`main.js`, `manifest.json`, `styles.css`) need to be installed in the reviewer's test vault, which is outside any worktree's reach. Reviewer confirmed "build ready" before Task 2 proceeded.
- **Gap closure outside the plan's `files_modified`:** Plan 07-06's `files_modified` lists only `07-HUMAN-UAT.md`, but the inline DIR-06 gap closure (`72275fc`) modified `src/settings/SettingsTab.ts`. This deviation is documented in the UAT file's Step 6 Notes and was required to satisfy the plan's own Step 6 acceptance criterion ("lint exits 0 with no Phase 7 rule warnings"). Authorized per Rule 3 (auto-fix when required for the plan's own success criterion to hold).
- **Step 3 partial fail nuance:** D-11 step 5 + CONTEXT D-12 step 3 anticipated a binary PASS/FAIL on step 3. The observed behavior is asymmetric (PASS on disable, FAIL on re-enable). The UAT file documents both directions and routes the FAIL closure to plan 07-07. A1's `detachLeavesOfType` deletion still produced a partial win (disable direction).

## No Claude / AI references

`grep -iE 'claude|AI assist|co-authored-by' .planning/phases/07-lifecycle-compatibility/07-HUMAN-UAT.md` returns zero matches. `git log -1 --pretty=%B` for `731eaa9` and `72275fc` likewise return zero matches per CLAUDE.md memory reminders.
