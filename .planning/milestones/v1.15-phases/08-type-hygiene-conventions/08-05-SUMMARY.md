---
phase: 08-type-hygiene-conventions
plan: 05
subsystem: docs
tags: [doc-02, conventions, claude-md, milestone-close]
status: complete

# Dependency graph
requires:
  - phase: 08-type-hygiene-conventions
    provides: "08-04 — DIR-01/09/10 acceptance commit (Wave 4)"
provides:
  - "DOC-02 closed: `.planning/codebase/CONVENTIONS.md` carries the canonical Directory Compliance do/don't list (4 clusters, 16 rule blocks)."
  - "CLAUDE.md updated: stale `## TODO: Code Quality Issues to Address` block replaced with `## Directory Compliance` pointer linking to CONVENTIONS.md. `### Beta Release Strategy` and `### Memory Reminders` preserved verbatim."
  - "Milestone v1.15 (Directory Compliance) closed. Ready to tag release."
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single source of truth for directory-compliance rules: `.planning/codebase/CONVENTIONS.md#directory-compliance`. CLAUDE.md (loaded into every session) points to it via the new `## Directory Compliance` section."

key-files:
  created:
    - .planning/phases/08-type-hygiene-conventions/08-05-SUMMARY.md
    - .planning/phases/08-type-hygiene-conventions/08-05-CLAUDE-md-change.md
  modified:
    - .planning/codebase/CONVENTIONS.md  # +166 lines: appended ## Directory Compliance with 4 clusters, 16 rule blocks, verification snippet
    - CLAUDE.md  # gitignored project-wide; updated in working tree; lines 182-236 (stale TODO block) replaced with ~15-line pointer section. ### Beta Release Strategy (line 66) and ### Memory Reminders preserved verbatim.

key-decisions:
  - "D-01/D-02/D-03 honored: canonical do/don't list lives in CONVENTIONS.md (single source of truth); grouped by rule CLUSTER (DOM API / Lifecycle & Compatibility / Type Hygiene / Release & Docs); each rule block uses the locked 4-line `Don't:` / `Do:` / `Why:` / `Docs:` shape."
  - "D-04 honored: CLAUDE.md TODO block (lines 182-236) replaced with the pointer section. `### Beta Release Strategy` (BRAT workflow at line 66) and `### Memory Reminders` preserved verbatim — bounded replacement only touches lines 182-236."
  - "D-05 honored: this is commit 5 of the locked 5-commit ordering — the closing commit of Phase 8 AND milestone v1.15. DOC-02 lands last so the do/don't list reflects what the code actually does after v1.15."
  - "Deviation: CLAUDE.md is gitignored project-wide (`.gitignore:28`), so the Task 2 edit was applied to the main checkout's working tree (where it's visible to every Claude session) and a planning tracking document `08-05-CLAUDE-md-change.md` was committed in its place. Functional outcome is identical — the change is live in the file that gets loaded into every Claude session."

patterns-established:
  - "Closing-phase verification via manual smoke test (D-06): the 8-step Obsidian smoke test recorded directly in the closing commit body rather than as a separate HUMAN-UAT.md artifact. Acceptable because Phase 8 is code-internal hygiene with no user-visible behavior change."

requirements-completed:
  - DOC-02  # Directory Compliance do/don't list landed in CONVENTIONS.md + CLAUDE.md pointer; closes milestone v1.15

# Metrics
duration: ~30min
completed: 2026-05-17
---

# Phase 8 Plan 5: Directory Compliance Conventions (DOC-02) — milestone-closing commit

**Closes milestone v1.15 (Directory Compliance). Appends the canonical `## Directory Compliance` section to `.planning/codebase/CONVENTIONS.md` (4 clusters, 16 rule blocks, 1 verification snippet) and replaces the stale `## TODO: Code Quality Issues to Address` block in `CLAUDE.md` with a pointer section linking to it. User-confirmed 8-step Obsidian smoke test: all green.**

## Performance

- **Duration:** ~30 min (Tasks 1+2 in worktree by gsd-executor; Task 3 user smoke test; Task 4 inline closing commit)
- **Started:** 2026-05-17
- **Completed:** 2026-05-17
- **Tasks:** 4 of 4 committed
- **Files modified:** 2 (CONVENTIONS.md tracked; CLAUDE.md gitignored, tracked via 08-05-CLAUDE-md-change.md)

## Tasks Completed

| # | Name | Commit |
|---|------|--------|
| 1 | Append `## Directory Compliance` to CONVENTIONS.md (DOC-02 part A) | `d32998f` |
| 2 | Replace TODO block in CLAUDE.md with pointer section (DOC-02 part B) | `dc29039` (tracking doc; the CLAUDE.md edit itself is in the working tree — file is gitignored) |
| 3 | 60-second Obsidian smoke test (D-06) | (human-verify checkpoint — user responded `approved`) |
| 4 | Final lint + build sanity check, commit, milestone close | (this SUMMARY commit) |

## CONVENTIONS.md additions (Task 1)

Appended the `## Directory Compliance` section with:

| Cluster | Rule blocks | Findings closed |
|---------|-------------|-----------------|
| DOM API | 3 (innerHTML/outerHTML, inline `.style.*`, `document.createElement`) | DIR-02, DIR-03, DIR-04 |
| Lifecycle & Compatibility | 4 (view refs in plugin, popout-window helpers, `instanceof TFile`, floating promises) | DIR-05, DIR-06, DIR-07, DIR-08 |
| Type Hygiene | 6 (`console.*`, `any`, `no-case-declarations`, `no-useless-escape`, `??`-with-constant-LHS, unused vars/imports) | DIR-01, DIR-09, DIR-10 |
| Release & Docs | 3 (`manifest.json` punctuation, release attestation, lint gate) | DIR-11, DIR-12, DOC-01 |
| Verifying compliance | 1 bash code block (5 verification commands) | — |

**Total:** 16 rule blocks in the locked 4-line `Don't:` / `Do:` / `Why:` / `Docs:` format per D-03.

Verification:
- `grep -c '^## Directory Compliance' .planning/codebase/CONVENTIONS.md` → 1 ✓
- `grep -cE '^### (DOM API|Lifecycle & Compatibility|Type Hygiene|Release & Docs)' .planning/codebase/CONVENTIONS.md` → 4 ✓
- `grep -cE '^\*\*Don.t:\*\*' .planning/codebase/CONVENTIONS.md` → 16 ✓ (exceeds the 14 minimum)

## CLAUDE.md update (Task 2)

Replaced the stale `## TODO: Code Quality Issues to Address` block (formerly lines 182-236) with a `## Directory Compliance` pointer section linking to the canonical doc.

Verification (on the live file `/Users/mike/code/memoChron/CLAUDE.md`):
- `grep -c '^## TODO: Code Quality Issues to Address' CLAUDE.md` → 0 ✓
- `grep -c '^## Directory Compliance' CLAUDE.md` → 1 ✓
- `grep -c '^### Beta Release Strategy' CLAUDE.md` → 1 ✓ (preserved verbatim per D-04; BRAT workflow at line 66 is intact)
- `grep -c '^### Memory Reminders' CLAUDE.md` → 1 ✓ (preserved verbatim)
- `grep -c 'CONVENTIONS.md#directory-compliance' CLAUDE.md` → 1 ✓ (the new pointer link)
- `grep -cE 'High Priority Issues|Medium Priority Issues|Low Priority Issues' CLAUDE.md` → 0 ✓ (stale TODO subsection headers gone)

**Deviation from the literal plan:** `CLAUDE.md` is listed in `.gitignore` (line 28), so it cannot be committed to git. The Task 2 edit was applied to the main checkout's working tree (`/Users/mike/code/memoChron/CLAUDE.md`) where it's visible to every Claude session loaded against this project — which is the file's actual job. The accompanying planning tracking doc (`08-05-CLAUDE-md-change.md`) was committed in lieu of the file edit so the planning history records what changed. Functional outcome is identical.

## Smoke test (Task 3 — D-06)

User responded `approved` — all 8 steps of the Obsidian smoke test pass.

The 8 steps:
1. Toggle MemoChron OFF → no console errors. ✓
2. Toggle MemoChron ON → sidebar reload works. ✓
3. Cmd/Ctrl-P → "MemoChron: Open calendar" → month grid + agenda render. ✓
4. Navigate next month → previous month → grid + agenda update. ✓
5. Click event in agenda → note created/opened. ✓
6. Settings → MemoChron → calendar list renders, "Add calendar" flow opens. ✓
7. Toggle "Hide calendar" off/on → sidebar shows/hides correctly. ✓
8. Open note with `memochron-calendar` code block → embedded calendar renders. ✓

No HUMAN-UAT.md artifact was created (user did not type `create UAT.md`; per D-06 the default is to record the result in the commit body only).

## Lint-site resolution summary (Phase 8 aggregate)

| Scope | Sites resolved | Plan |
|-------|----------------|------|
| `@typescript-eslint/no-unused-vars` | 18 | Plan 01 |
| `@typescript-eslint/no-explicit-any` + 1 `no-case-declarations` + 1 `no-useless-escape` | 16 + 1 + 1 | Plan 02 |
| `no-console` | 39 (33 deleted, 6 gated behind `const DEBUG = false`) | Plan 03 |
| `??`-with-constant-LHS in executable code | 0 (audit clean; 1 docs-comment hit at SettingsTab.ts:263 unchanged) | Plan 02 |
| Phase-8 eslint.config.mjs override block | deleted (-41 lines from the override block; +19 lines for the D-08-extension override) | Plan 04 |
| `obsidianmd/rule-custom-message` | 1 site (`CalendarService.ts:303` `console.log` → `console.debug`) | Plan 04 (Class 2 fix) |
| Unused `eslint-disable` directives | 6 (Plan 03 wrong-rule disables removed) | Plan 04 (Class 3 fix) |

## Final state

- `npm run lint` → exits 0 with no errors or warnings ✓
- `npm run build` → exits 0 ✓
- `eslint.config.mjs` overrides remaining:
  - Phase-5 tightening (no-unused-vars: error, no-restricted-syntax for `document.createElement`)
  - `**/*.d.ts` no-explicit-any: off (Plan 02 — ical.d.ts shim)
  - `src/**/*.ts` no-unsafe-*: off (Plan 04 D-08-extension — ical.js consumption-site cascade)
  - `globalIgnores([node_modules, main.js, esbuild.config.mjs, version-bump.mjs, versions.json])`
- `CLAUDE.md` working-tree: pointer to canonical Directory Compliance doc in place; BRAT and Memory Reminders preserved.
- `.planning/codebase/CONVENTIONS.md`: canonical Directory Compliance section live at the end of the file.

## Issues Encountered

**Plan 04 architectural checkpoint (resolved before Plan 05).** Plan 04 originally paused with a Rule-4 escalation when removing the Phase-8 override block exposed 33 errors not anticipated by CONTEXT.md. User chose Option B (narrow `no-unsafe-*` override mirroring D-08's strategy) plus Class 2/3 housekeeping. The amended Plan 04 ran successfully before Plan 05 started — full analysis in `08-04-CHECKPOINT.md`.

**CLAUDE.md gitignored.** Surfaced during Plan 05 Task 2 execution. The original plan didn't anticipate that CLAUDE.md is gitignored project-wide. The executor applied the edit to the working tree (where it actually matters) and committed a tracking document. Functional outcome is identical to what the plan intended; documented in the deviation note above.

## Next Phase Readiness

**Milestone v1.15 (Directory Compliance) closes with this commit.**

After this SUMMARY commit, the orchestrator will:
1. Run the code review gate (advisory)
2. Run the regression gate (prior-phase test files — Phase 8 has no source tests)
3. Spawn the verifier agent for phase-level goal verification
4. Update ROADMAP.md (mark Phase 8 complete)
5. Update STATE.md (advance milestone state)
6. Update REQUIREMENTS.md (close DIR-01, DIR-09, DIR-10, DOC-02 traceability)
7. Evolve PROJECT.md

User next steps after orchestrator finishes:
- Tag the v1.15 release per BRAT workflow in CLAUDE.md `### Beta Release Strategy`
- Run `/gsd:complete-milestone` to archive v1.15 and prepare for v1.16

## Self-Check: PASSED

- `.planning/phases/08-type-hygiene-conventions/08-05-SUMMARY.md` — created (this file).
- CONVENTIONS.md committed in Task 1 (`d32998f`); CLAUDE.md edited in working tree, tracking doc committed in Task 2 (`dc29039`).
- Smoke test reported `approved` by user (all 8 steps green).
- `npm run lint` and `npm run build` both exit 0.
- Commit message will not contain "Claude", "AI", "Anthropic", or "claude.ai" per project CLAUDE.md memory reminders.

---
*Phase: 08-type-hygiene-conventions*
*Plan: 05*
*Status: COMPLETE — milestone v1.15 closes with this commit*
*Completed: 2026-05-17*
