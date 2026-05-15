---
phase: 7
slug: lifecycle-compatibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

This phase inherits the milestone's "lint-as-validator" pattern (Phase 5 DOC-01 established it). No new unit-test framework is added; per `.planning/PROJECT.md` Out of Scope and `CLAUDE.md`, the test suite is QA-01, deferred to v2. Each phase requirement maps to one or more ESLint rules, grep audits, or a manual UAT step. See `07-RESEARCH.md` §"Validation Architecture" for the source-of-truth derivation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | ESLint 9.x + manual UAT (no unit-test framework this milestone) |
| **Config file** | `eslint.config.mjs` (with Phase 7 override block deletion verified in D-11 commit 6) |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run lint && npm run build` |
| **Estimated runtime** | ~10 seconds (lint), ~5 seconds (esbuild + tsc --noEmit) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`. Lint count must not regress vs the previous commit.
- **After every plan wave:** Run `npm run lint && npm run build`. Both must exit zero.
- **Before `/gsd:verify-work`:** Full suite must be green AND D-12 six-step manual UAT walkthrough complete (recorded in `07-HUMAN-UAT.md`).
- **Max feedback latency:** ~15 seconds.

---

## Per-Task Verification Map

> Per-task rows are populated by the planner once tasks are assigned. The rule-level commands below are the validation primitives every task is composed from.

| Req ID | Source | Behavior | Test Type | Automated Command | File Exists |
|--------|--------|----------|-----------|-------------------|-------------|
| DIR-05 | D-02 / A1 | `registerView` callback is a pure factory; no `plugin.calendarView` field; no `detachLeavesOfType` in `onunload` | lint + grep | `npx eslint src/main.ts` → zero `obsidianmd/no-view-references-in-plugin` AND zero `obsidianmd/detach-leaves`; `git ls-files src/ \| xargs grep -nE 'this\.(calendarView\b)'` → zero matches; `git ls-files src/ \| xargs grep -n 'detachLeavesOfType'` → zero matches | ✅ |
| DIR-05 | D-01 | `getCalendarView()` helper uses `getLeavesOfType` + `instanceof CalendarView` narrowing; 5 callsites updated | grep | `grep -n 'getCalendarView' src/main.ts` → ≥6 matches (1 definition + 5 callsites); `grep -n 'instanceof CalendarView' src/main.ts` → ≥1 match | ✅ |
| DIR-06 | D-05 | All `getComputedStyle(document.documentElement)` reads in view code use `activeDocument.documentElement` | lint + grep | `npx eslint src/` → zero `obsidianmd/prefer-active-doc`; `git ls-files src/ \| xargs grep -nE 'getComputedStyle\(document\.documentElement\)'` → zero matches | ✅ |
| DIR-06 | A2 | All timer calls (`setTimeout`/`setInterval`/`clearTimeout`/`clearInterval`/`requestAnimationFrame`) use `window.` prefix | lint + grep | `npx eslint src/` → zero `obsidianmd/prefer-window-timers`; `git ls-files src/ \| xargs grep -nE '(^\|[^.])\b(setTimeout\|setInterval\|clearTimeout\|clearInterval\|requestAnimationFrame)\b' \| grep -v 'window\.'` → zero non-`window.` matches | ✅ |
| DIR-07 | D-08 | Zero `as TFile` casts; 4 daily-note open sites use `instanceof TFile` narrowing | lint + grep | `npx eslint src/` → zero `obsidianmd/no-tfile-tfolder-cast`; `git ls-files src/ \| xargs grep -n 'as TFile'` → zero matches (success criterion #3 verbatim) | ✅ |
| DIR-08 | D-09 | Zero floating promises across `src/` | lint | `npx eslint src/` → zero `@typescript-eslint/no-floating-promises` | ✅ |
| DIR-08 | D-10 | `EmbeddedCalendarView` + `EmbeddedAgendaView` `onload` is sync (sync wrapper around private async helper) | lint + grep | `npx eslint src/` → zero `@typescript-eslint/no-misused-promises` of the `inheritedMethods` shape; `grep -nE 'async onload' src/views/Embedded*.ts` → zero matches | ✅ |
| DIR-08 | D-11 (commit 6) | Phase 7 ESLint override block at `eslint.config.mjs:66–92` deleted | grep | `grep -nE 'no-view-references-in-plugin\|no-tfile-tfolder-cast\|prefer-active-doc\|prefer-window-timers\|detach-leaves' eslint.config.mjs` → ZERO non-comment matches; the override block (Phase 5 override block for Phase 8 rules is allowed to remain) is gone | ✅ |
| BUG-07 | D-12 / A1 | Toggling MemoChron in Community Plugins does NOT close the Settings modal (or `BUG-07-CLOSURE.md` is committed) | manual UAT | D-12 step 3 — pass condition has two acceptable outcomes: modal stays open OR closure note committed with reproduction steps + Obsidian version + evidence | manual-only ❌ Wave 0 |
| Popout-window | D-12 step 1 | Calendar grid renders correctly, navigation works, timers fire in an Obsidian popout window | manual UAT | D-12 step 1 — walkthrough in `07-HUMAN-UAT.md` | manual-only ❌ Wave 0 |
| Daily-note open path | D-12 step 2 | Click event in sidebar agenda, embedded calendar, embedded agenda → daily note opens (3 paths covered) | manual UAT | D-12 step 2 | manual-only ❌ Wave 0 |
| Sidebar parity | D-12 step 4 | Sidebar calendar + agenda render identically to v1.14.0 post-Phase-6 baseline (no visual regression) | manual UAT | D-12 step 4 (live visual inspection) | manual-only ❌ Wave 0 |
| Embedded parity | D-12 step 5 | `memochron-calendar` + `memochron-agenda` code blocks render unchanged after D-10 lifecycle rewrite | manual UAT | D-12 step 5 | manual-only ❌ Wave 0 |
| Phase gate | D-12 step 6 | `npm run lint` exits zero with override block removed | automated | `npm run lint` | ✅ |

---

## Wave 0 Requirements

- [ ] `.planning/phases/07-lifecycle-compatibility/07-HUMAN-UAT.md` — manual UAT walkthrough scaffolded with D-12's six steps; populated during execution per the no-screenshot live-walkthrough pattern Phase 6 established.
- [ ] (Conditional) `.planning/phases/07-lifecycle-compatibility/BUG-07-CLOSURE.md` — only created if D-12 step 3 fails after commit 1 lands. Skeleton: reproduction steps, Obsidian version (`Obsidian → About`), OS, evidence section citing the [Settings modal closes when disabling a plugin's actively focused view](https://forum.obsidian.md/t/settings-modal-closes-when-disabling-a-plugins-actively-focused-view/111479) forum thread.
- [ ] No test framework install required.

*Per `.planning/PROJECT.md` Out of Scope: unit tests deferred to QA-01 (v2 milestone).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings-modal persistence on plugin toggle | BUG-07 | Obsidian Community-Plugins toggle behavior cannot be exercised programmatically without booting a real Obsidian instance; documented as Obsidian-core bug | D-12 step 3 — disable MemoChron in Community Plugins, confirm modal stays open; re-enable, confirm modal stays open |
| Popout-window rendering + timers | DIR-06 (SC #6) | Popout windows are a real Obsidian UI surface; the `activeDocument`/`activeWindow` adoption only matters when a leaf is in a popout; cannot be tested without a real popout | D-12 step 1 — right-click sidebar tab → "Move to new window", verify grid render, navigation, drag-resize, auto-refresh fires |
| Daily-note open paths (3 surfaces) | DIR-07 | Verifies the `instanceof TFile` narrowing across sidebar agenda, embedded calendar, embedded agenda — three code paths that share the pattern | D-12 step 2 — click event with daily note in each of the 3 surfaces |
| Sidebar visual parity | DIR-06 (regression check) | `activeDocument` change is runtime-only; visual regression requires eyes on it | D-12 step 4 — compare sidebar against v1.14.0 baseline |
| Embedded views parity | DIR-08 (D-10 lifecycle rewrite) | Sync-wrapper `onload` changes initialization timing; needs visual confirmation that embedded views still populate | D-12 step 5 — open note containing code blocks, verify render |

*The Lint gate (D-12 step 6) and all per-rule automated checks above are NOT in this list — they have automated commands.*

---

## Validation Sign-Off

- [ ] All requirement rows above have a `lint`, `grep`, or `manual UAT` automated/recorded command
- [ ] Sampling continuity: every commit in D-11 commits 1–4 runs `npm run lint` and reports the delta vs previous commit
- [ ] Wave 0: `07-HUMAN-UAT.md` scaffolded before any code commits land
- [ ] No watch-mode flags (`npm run lint` is one-shot)
- [ ] Feedback latency < 15s (lint + build well within budget)
- [ ] `nyquist_compliant: true` set in frontmatter after all phase tasks have automated verify entries OR are documented as `manual-only` here

**Approval:** pending
