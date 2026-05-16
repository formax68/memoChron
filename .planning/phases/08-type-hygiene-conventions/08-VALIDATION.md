---
phase: 8
slug: 08-type-hygiene-conventions
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-16
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 8 is **lint-driven** — there is no unit-test infrastructure in this codebase per project Out-of-Scope (QA-01 deferred to v2).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no unit-test infrastructure; QA-01 deferred to v2) |
| **Config file** | `eslint.config.mjs` (flat config) |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run lint && npm run build` |
| **Estimated runtime** | ~5 seconds (lint) + ~2 seconds (build) = ~7s |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run lint && npm run build`
- **Before `/gsd:verify-work`:** Full lint+build green AND 8-step Obsidian smoke test green (recorded in commit-5 body per D-06)
- **Max feedback latency:** ~7 seconds

---

## Per-Task Verification Map

> Tasks are filled in by the planner during PLAN.md authoring. The Requirement column maps to the table below.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DIR-10 | Zero `no-unused-vars` violations | lint | `npm run lint` returns 0 `no-unused-vars` errors | ✅ | ⬜ pending |
| DIR-09a | Zero `no-explicit-any` in `src/` (`.d.ts` excluded by config) | lint | `npm run lint` returns 0 `@typescript-eslint/no-explicit-any` errors | ✅ | ⬜ pending |
| DIR-09b | Zero `no-case-declarations` | lint | `npm run lint` returns 0 `no-case-declarations` errors | ✅ | ⬜ pending |
| DIR-09c | Zero `no-useless-escape` | lint | `npm run lint` returns 0 `no-useless-escape` errors | ✅ | ⬜ pending |
| DIR-09d | Zero `??` operators with constant LHS | grep | `grep -rnE '\b(null\|undefined\|""\|0\|false)\s*\?\?' src/` returns no executable hits | ✅ | ⬜ pending |
| DIR-01 | Zero `console.*` in shipped code; gated forensics behind compile-time `DEBUG=false` | lint + grep | `npx eslint src/ --rule '{"no-console":"error"}'` returns 0 errors; remaining `console.*` lines are inside `if (DEBUG) { ... }` blocks | ✅ | ⬜ pending |
| Acceptance | `eslint.config.mjs` Phase-8 override block deleted; lint passes clean | lint + line check | `npm run lint` returns 0 errors with no `// Phase 8` comment block in `eslint.config.mjs`; file is ~75 lines (was ~115) | ✅ | ⬜ pending |
| DOC-02a | `## Directory Compliance` section exists in `.planning/codebase/CONVENTIONS.md` with 4 clusters | grep | `grep -c '^## Directory Compliance' .planning/codebase/CONVENTIONS.md` returns 1; `grep -cE '^### (DOM API\|Lifecycle & Compatibility\|Type Hygiene\|Release & Docs)' .planning/codebase/CONVENTIONS.md` returns 4 | ✅ | ⬜ pending |
| DOC-02b | `## Directory Compliance` pointer section in `CLAUDE.md`; `### Memory Reminders` preserved; old TODO block removed | grep | `grep -c '^## Directory Compliance' CLAUDE.md` returns 1; `grep -c '^### Memory Reminders' CLAUDE.md` returns 1; `grep -c '^## TODO: Code Quality Issues to Address' CLAUDE.md` returns 0 | ✅ | ⬜ pending |
| Build sanity | `npm run build` succeeds (catches type-system regressions from DIR-09 changes) | build | `npm run build` exits 0 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- None — `npm run lint` is already a `package.json` script, `eslint.config.mjs` is in place, and CI runs lint on every push. No test-framework install or scaffolding needed.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar calendar opens, click event creates note, settings list renders | D-06 smoke test | UI behavior in Obsidian Electron host; no headless harness | 60-second smoke: open Obsidian → reveal sidebar calendar → click any event → confirm note is created → open Settings → confirm calendar list renders → close. Record result in commit-5 body. |
| Fresh Obsidian community-plugin Review scorecard (milestone-level success criterion #6) | Milestone | External scorecard tool not in repo | Run the v1.13.1 review scorecard methodology against the v1.15 main-branch snapshot after merge. Confirm zero "Avoid …" findings remain. This is a milestone-close check, not a phase-close check. |

---

## Validation Sign-Off

- [x] All requirements have an `<automated>` verify command or are explicitly Manual-Only
- [x] Sampling continuity: every requirement except the milestone-level scorecard has a single-command verify under 10 seconds
- [x] Wave 0 covers all MISSING references (Wave 0 is empty — no missing references)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter — pending planner sign-off after PLAN.md tasks are mapped to this table

**Approval:** pending
