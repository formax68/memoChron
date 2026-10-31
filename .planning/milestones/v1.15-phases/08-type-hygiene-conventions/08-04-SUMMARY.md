---
phase: 08-type-hygiene-conventions
plan: 04
subsystem: lint
tags: [eslint, dir-01, dir-09, dir-10, option-b, d-08-extension]
status: complete

# Dependency graph
requires:
  - phase: 08-type-hygiene-conventions
    provides: "08-03 — DIR-01 console cleanup (Wave 3)"
provides:
  - "eslint.config.mjs — Phase-8 override block deleted; D-08-extension no-unsafe-* block added; npm run lint passes clean"
  - "DIR-01, DIR-09, DIR-10 closed at acceptance level"
affects: [08-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-08-extension: src/**/*.ts no-unsafe-*: off — silences typed-linting cascade from ical.js untyped APIs at consumption sites; mirrors the existing **/*.d.ts no-explicit-any: off exclusion; defers hand-typing to FRAG-02"

key-files:
  created:
    - .planning/phases/08-type-hygiene-conventions/08-04-SUMMARY.md
  modified:
    - eslint.config.mjs
    - src/services/CalendarService.ts
    - src/utils/timezoneUtils.ts

key-decisions:
  - "Option B chosen (via Rule 4 checkpoint): add narrow src/**/*.ts no-unsafe-*: off block instead of hand-typing ical.d.ts any returns (deferred to FRAG-02). Matches D-08's documented spirit — same root cause as the **/*.d.ts exclusion, same chosen treatment."
  - "Class 2 fix: CalendarService.ts:303 console.log changed to console.debug (obsidianmd/rule-custom-message disallows console.log but allows console.debug). MemoChron: prefix preserved."
  - "Class 3 fix: 6 unused eslint-disable-next-line no-console comments removed from CalendarService.ts and timezoneUtils.ts — no-console is OFF in obsidianmd recommended config (not just in the Phase-8 override), so these disables never had effect."

patterns-established:
  - "D-08-extension pattern: when a third-party library is fundamentally untyped and hand-typing is deferred, silence the typed-linting cascade via a narrow config override matching the same root cause as the existing .d.ts exclusion"

requirements-completed:
  - DIR-01
  - DIR-09
  - DIR-10

# Metrics
duration: ~20min
completed: 2026-05-17
---

# Phase 8 Plan 4: Delete Phase-8 ESLint Override Block — Summary

**Deleted the Phase-8 ESLint override block (lines 73–113) from `eslint.config.mjs`, added the D-08-extension `src/**/*.ts no-unsafe-*: off` override, and applied Plan 03 Rule-1 housekeeping (Class 2: console.log → console.debug; Class 3: 6 unused disable comments removed). `npm run lint` exits 0 cleanly. DIR-01, DIR-09, DIR-10 closed at acceptance level.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-17
- **Completed:** 2026-05-17
- **Tasks:** 2 of 2 committed
- **Files modified:** 3

## `eslint.config.mjs` Line Count

| State | Lines |
|-------|-------|
| Before (pre-Plan-04) | 122 |
| After | 100 |
| Net change | -22 (-41 deleted block + 19 D-08-extension block) |

**Phase-8 block deleted span:** Lines 73–113 inclusive (the `// ---` separator, two `// Phase 8` header comments, the `src/**/*.ts` rules sub-block, the closed-set `files: [...]` no-unused-vars sub-block).

## Final `eslint.config.mjs` Block Inventory

| Block | Lines | Status |
|-------|-------|--------|
| Phase-5 tightening (`src/**/*.ts` — no-unused-vars: error, no-restricted-syntax for createElement) | 44–63 | PRESERVED |
| `**/*.d.ts` no-explicit-any: off (D-08 / Plan 02 — ical.d.ts shim) | 65–71 | PRESERVED |
| D-08-extension `src/**/*.ts` no-unsafe-*: off (this plan) | 73–91 | ADDED |
| `globalIgnores([...])` | 93–100 | PRESERVED |
| Phase-8 override block | 73–113 (old) | DELETED |

## `npm run lint` Output

```
> memochron@1.14.0 lint
> eslint src/
```

Exit 0. No errors. No warnings.

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| Task 1 | Class 2/3 housekeeping — Plan 03 Rule-1 bug fixes (CalendarService.ts + timezoneUtils.ts) | c9b7dbe |
| Task 2 | Delete Phase-8 override block + add D-08-extension (eslint.config.mjs) | 9d042eb |

## Deviations from Plan

None — the amended plan (Option B + Class 2/3 housekeeping) was executed exactly as specified. The amendment history is documented in `08-04-PLAN.md` (objective section) and the Rule-4 escalation that led to it is documented in `08-04-CHECKPOINT.md`.

## Rule-4 Amendment Path Acknowledgement

The original Plan 04 (single task, delete Phase-8 block only) was paused as a Rule-4 architectural checkpoint when executing the deletion exposed 33 errors:
- 32 typed-linting `no-unsafe-*` cascade errors from ical.js untyped APIs
- 1 `obsidianmd/rule-custom-message` error on the `console.log` site Plan 03 gated
- 6 unused-disable-directive warnings from Plan 03's wrong-rule disable comments

The user chose **Option B** (narrow `no-unsafe-*: off` override for `src/**/*.ts`) plus the Class 2/3 housekeeping fixes. `08-04-CHECKPOINT.md` documents the full analysis, the three error classes, the three fix options (A/B/C), and the recommendation. The CHECKPOINT.md file is preserved unchanged as committed historical context.

## Threat Flags

None. This plan only modifies ESLint configuration and removes lint-directive comments. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `eslint.config.mjs` modified and committed (9d042eb)
- `src/services/CalendarService.ts` modified and committed (c9b7dbe)
- `src/utils/timezoneUtils.ts` modified and committed (c9b7dbe)
- `grep -c "// Phase 8" eslint.config.mjs` → 0 ✓
- `grep -c '"no-console": "off"' eslint.config.mjs` → 0 ✓
- `grep -c "no-case-declarations" eslint.config.mjs` → 0 ✓
- `grep -c "no-useless-escape" eslint.config.mjs` → 0 ✓
- `grep -c "D-08-extension" eslint.config.mjs` → 1 ✓
- `grep -c "no-unsafe-assignment" eslint.config.mjs` → 1 ✓
- `**/*.d.ts` block present at line 69 ✓
- `grep -c "globalIgnores" eslint.config.mjs` → 2 ✓
- `wc -l < eslint.config.mjs` → 100 (within ±5 of ~94 target) ✓
- `npm run lint` → exit 0, no errors, no warnings ✓
- `npm run build` → exit 0 ✓
- `08-04-CHECKPOINT.md` preserved unchanged ✓
- Commit messages contain no "Claude", "AI", or "Anthropic" references ✓

---
*Phase: 08-type-hygiene-conventions*
*Plan: 04*
*Status: COMPLETE*
*Completed: 2026-05-17*
