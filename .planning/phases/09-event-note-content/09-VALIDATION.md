---
phase: "9"
slug: "event-note-content"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-20"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | ESLint 9 + `tsc` type-check (existing CI gate) + phase-local Node harness (`node:assert`, no framework) + manual Obsidian UAT |
| **Config file** | `eslint.config.mjs`, `tsconfig.json`; harness `.planning/phases/09-event-note-content/verify-09.mjs` (Wave 0) |
| **Quick run command** | `npm run lint && node .planning/phases/09-event-note-content/verify-09.mjs` |
| **Full suite command** | `npm run lint && npm run build && node .planning/phases/09-event-note-content/verify-09.mjs` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && node .planning/phases/09-event-note-content/verify-09.mjs`
- **After every plan wave:** Run `npm run lint && npm run build && node .planning/phases/09-event-note-content/verify-09.mjs`
- **Before `/gsd-verify-work`:** Full suite must be green, plus Obsidian UAT recorded in `09-HUMAN-UAT.md`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | BUG-08, BUG-09 | — | N/A | unit (harness) | `node .planning/phases/09-event-note-content/verify-09.mjs` | ❌ W0 | ⬜ pending |
| (filled by planner) | | | ENH-09, ENH-10, ENH-11 | — | N/A | unit (harness) | `node .planning/phases/09-event-note-content/verify-09.mjs` | ❌ W0 | ⬜ pending |
| (filled by planner) | | | ENH-12 | — | N/A | grep + manual UAT | `grep -nE '^\s+(week|dd|d|year): string;' src/services/NoteService.ts` | ✅ | ⬜ pending |
| (all) | | | all | — | N/A | lint + type-check | `npm run lint && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm ci` — node_modules absent from working tree
- [ ] `.planning/phases/09-event-note-content/verify-09.mjs` — tag-merge fixture table (BUG-08/09) + date-variable checks (ENH-09/10/11)
- [ ] `.planning/phases/09-event-note-content/09-HUMAN-UAT.md` — Obsidian UAT script

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Properties panel shows one `tags` property, no YAML error (block, inline, scalar; global and per-calendar) | BUG-08 | Obsidian's YAML parser is not available outside the app | Set each fixture as default frontmatter, create a note from a tagged calendar, inspect Properties panel |
| New variables render in title (sanitized filename), template body, frontmatter; `{{d}} {{dd}} {{date}}` side by side | ENH-12 | Rendering goes through Obsidian vault APIs | Use timed midday events on 2026-05-04 and 2027-01-01 (avoids existing UTC `{{date}}` shift for all-day events) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
