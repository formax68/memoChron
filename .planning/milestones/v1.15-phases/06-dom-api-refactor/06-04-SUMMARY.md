---
phase: 06-dom-api-refactor
plan: "04"
subsystem: lint, settings, views, services
tags: [eslint, sentence-case, dir-02-accept, dir-03-accept, dir-04-accept, DIR-02, DIR-03, DIR-04]
dependency_graph:
  requires: [DIR-02-closed, DIR-03-closed, DIR-04-closed]
  provides: [DIR-02-accepted, DIR-03-accepted, DIR-04-accepted, ESLint-overrides-removed]
  affects:
    - eslint.config.mjs
    - src/settings/SettingsTab.ts
    - src/services/CalendarService.ts
    - src/utils/viewRenderers.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedAgendaView.ts
    - src/views/EmbeddedCalendarView.ts
tech_stack:
  patterns: [narrow eslint-disable-next-line with -- rationale, sentence-case copy normalisation]
key_files:
  modified:
    - eslint.config.mjs
    - src/settings/SettingsTab.ts
    - src/services/CalendarService.ts
    - src/utils/viewRenderers.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedAgendaView.ts
    - src/views/EmbeddedCalendarView.ts
decisions:
  - "Phase-6 DIR-02/03/04 override block removed (eslint.config.mjs lines 65-82): @microsoft/sdl/no-inner-html, no-unsanitized/property, no-unsanitized/method, obsidianmd/no-static-styles-assignment, no-restricted-syntax all now active on SettingsTab.ts and CalendarView.ts"
  - "Companion ui/sentence-case override block (lines 83-98) removed; rule now active across all 6 UI-facing files"
  - "41 ui/sentence-case violations resolved per D-13: 5 strings lowercased (title-case → sentence case), 36 narrow eslint-disable-next-line comments with -- rationale (proper nouns: MemoChron, Google Calendar, Outlook, Microsoft 365, Apple iCloud, Obsidian Daily Notes, ICS, iCal, PM, macOS UI labels)"
  - "No bare disables, no new file-level or block-level overrides introduced"
  - "Phase 7 and Phase 8 override blocks preserved unchanged"
metrics:
  duration: "~9 minutes"
  completed: "2026-05-13"
  tasks_completed: 3
  files_modified: 7
---

# Phase 06 Plan 04: ESLint override removal + sentence-case resolution Summary

Deletes the two Phase-6 override blocks in `eslint.config.mjs` that were suppressing the DIR-02 /
DIR-03 / DIR-04 rules and the discovered `obsidianmd/ui/sentence-case` rule. Plans 01-03 cleaned
every violation site before this override removal, so the rules can now actively block any
regression. The companion `ui/sentence-case` rule (deferred from Phase 5) is resolved by either
lowercasing 5 title-case strings to sentence case or attaching narrowly-scoped
`eslint-disable-next-line` comments with `-- rationale` suffixes for genuine proper nouns and
acronyms per D-13. `npm run lint` exits 0 against the now-active rule set, which is the formal
acceptance signal for DIR-02 / DIR-03 / DIR-04 per D-16 commit 4.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete Phase-6 override blocks in eslint.config.mjs | b50b7ab | eslint.config.mjs |
| 2 | Resolve all ui/sentence-case violations surfaced by the now-active rule | b50b7ab | src/settings/SettingsTab.ts, src/services/CalendarService.ts, src/utils/viewRenderers.ts, src/views/CalendarView.ts, src/views/EmbeddedAgendaView.ts, src/views/EmbeddedCalendarView.ts |
| 3 | Commit the DIR-02/03/04 acceptance commit and confirm `npm run lint` exits 0 | b50b7ab | (git commit + lint run) |

## Success-Criterion Greps (all zero required)

```
grep -nrE '\.(inner|outer)HTML\s*=' src/         → 0 matches  (DIR-02)
grep -nrE 'document\.createElement\("' src/      → 0 matches  (DIR-04)
grep -nrE '\.style\.(border|color|cursor|display|fontSize|height|left|margin|marginTop|opacity|padding|position|textAlign|top|width)\s*=' src/  → 0 matches  (DIR-03)
```

## ui/sentence-case Resolution Strategy (D-13)

- **Lowercase rewrite** (5 sites): true title-case headings and placeholders not containing proper
  nouns were rewritten to sentence case directly.
- **Narrow disable** (36 sites): every line carrying a genuine proper noun or acronym
  (MemoChron, Google Calendar, Outlook, Microsoft 365, Apple iCloud, Obsidian Daily Notes,
  ICS, iCal, PM, macOS-label words like "Calendar", "Reminders") gets an
  `// eslint-disable-next-line obsidianmd/ui/sentence-case -- <rationale>` comment.
- **No bare disables**, no `eslint-disable` block comments, no new file-level or block-level
  overrides — strictly per-line narrow disables with a rationale.

## eslint.config.mjs Diff

- 35 lines removed (two override blocks for Phase 6)
- Phase 7 (DIR-05 / DIR-06 / DIR-07 / DIR-08) and Phase 8 override blocks preserved unchanged
- The `obsidianmd/ui/sentence-case` rule is now active across all six UI-facing files

## Verification Results

### npm run lint

```
> memochron@1.15.0-beta.1 lint
> eslint src/
```

Exit 0 — no warnings, no errors.

### npm run build

Exit 0 — clean TypeScript compilation and esbuild production bundle.

### File counts

- `eslint.config.mjs`: 35 lines removed (two override blocks)
- `src/settings/SettingsTab.ts`: 32 line changes (multiple disable comments + 2 placeholder rewrites)
- `src/services/CalendarService.ts`: 3 line additions (disable comments)
- `src/utils/viewRenderers.ts`: 1 line addition (disable comment)
- `src/views/CalendarView.ts`: 5 line additions (disable comments)
- `src/views/EmbeddedAgendaView.ts`: 3 line additions (disable comments)
- `src/views/EmbeddedCalendarView.ts`: 2 line additions (disable comments)

## Commit

- **Hash:** b50b7ab
- **Subject:** `chore(lint): remove Phase 6 ESLint overrides (DIR-02/03/04 acceptance)`
- **Stats:** 7 files changed, 41 insertions(+), 40 deletions(-)
- **Claude/AI references:** none

## Deviations from Plan

None. The plan called for a single acceptance commit removing the two override blocks and
resolving every newly-active `ui/sentence-case` violation. Both override blocks deleted, all 41
violations resolved per D-13 strategy, `npm run lint` exits 0.

(Orchestrator note: this SUMMARY.md was written by the orchestrator after the executor agent
hit a Claude Code API error after the implementation commit but before its metadata commit.
The implementation work and all gates were confirmed clean in the worktree before this SUMMARY
was written.)

## Known Stubs

None. The acceptance commit is final — all three DIR findings are closed in source code AND
their guardrails are active again.

## Threat Flags

No new security-relevant surface introduced. Disable-comment additions are pure copy-string
annotations with no runtime effect. Override-block removal RE-ENABLES safety rules that were
temporarily suppressed during the Phase-5/6 transition.

## Hand-off to Plan 05

Plan 05 is the human-UAT walkthrough (non-autonomous): create `06-HUMAN-UAT.md` and execute its
5-step visual-parity test against a built/installed plugin to confirm no regressions vs v1.14.0
per CONTEXT D-14 and ROADMAP Phase 6 success criterion #5.

## Self-Check: PASSED

- [x] Phase-6 override block (lines 65-82) removed from `eslint.config.mjs`
- [x] Companion ui/sentence-case override block (lines 83-98) removed
- [x] All 5 DIR-02/03/04 rules now actively enforced on SettingsTab.ts and CalendarView.ts
- [x] `obsidianmd/ui/sentence-case` rule now active across 6 UI-facing files
- [x] 5 strings lowercased to sentence case
- [x] 36 narrow `eslint-disable-next-line` comments with `-- rationale` suffix (proper-noun rationale)
- [x] No bare disables, no new file-level or block-level overrides
- [x] `npm run lint` exits 0
- [x] `npm run build` exits 0
- [x] DIR-02 grep: 0 matches across `src/`
- [x] DIR-04 grep: 0 matches across `src/`
- [x] DIR-03 grep (15 banned properties): 0 matches across `src/`
- [x] Commit `b50b7ab` exists in git log
- [x] No Claude/AI/Co-Authored-By references in commit message
- [x] Phase 7 and Phase 8 override blocks preserved unchanged
