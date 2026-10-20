---
phase: "9"
slug: "event-note-content"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| 09-01-T1 | 09-01 | 1 | ENH-09, ENH-10, ENH-11, ENH-12 | T-09-01, T-09-SC | Lockfile-only install; new title values pass through `sanitizeFileName` | tracer (harness drives real `createEventNote`, 4 TZ) + source-order gates | `npm run lint && npm run build && node .planning/phases/09-event-note-content/verify-09.mjs` | ✅ | ✅ green |
| 09-01-T2 | 09-01 | 1 | ENH-09, ENH-10, ENH-11, ENH-12 | T-09-01, T-09-02 | Byte-parity with 1.15.0 for users not using new tokens; no cross-substitution | unit + integration (harness, 4 TZ) + `<human-check>` | `node .planning/phases/09-event-note-content/verify-09.mjs && npm run lint && npm run build` | ✅ | ✅ green |
| 09-02-T1 | 09-02 | 2 | BUG-08, BUG-09 | T-09-04, T-09-05, T-09-SC | Exactly one `tags` key; no YAML round-trip of user frontmatter | tracer (harness fixtures T1-T11 + no-key parity vs tag 1.15.0) + grep guards | `npm run lint && npm run build && node .planning/phases/09-event-note-content/verify-09.mjs` | ✅ | ✅ green |
| 09-02-T2 | 09-02 | 2 | BUG-08, BUG-09 | T-09-04, T-09-05, T-09-06 | Unsafe shapes untouched (D-03); `yamlSafeTag` quoting | tdd (harness F1-F18, U1-U6; dual YAML parsers) + `<human-check>` | `node .planning/phases/09-event-note-content/verify-09.mjs && npm run lint && npm run build` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `npm ci` — node_modules absent from working tree. Run by 09-01-T1, and by 09-02-T1 when it executes in a fresh worktree
- [x] `.planning/phases/09-event-note-content/verify-09.mjs` — created by 09-01-T1. It esbuild-bundles the REAL `NoteService` with an `obsidian` stub and drives `createEventNote`, fans out over 4 timezones, and checks byte-parity against git tag `1.15.0`. Extended by 09-01-T2 (date boundaries/adjacency/parity) and 09-02-T1/T2 (tag-merge fixtures)
- [ ] `.planning/phases/09-event-note-content/09-HUMAN-UAT.md` — produced at end of phase by the verifier from the `<human-check>` blocks in 09-01-T2 and 09-02-T2 (`workflow.human_verify_mode` defaults to end-of-phase, so no mid-flight checkpoints)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Properties panel shows one `tags` property, no YAML error (block, inline, scalar; global and per-calendar) | BUG-08 | Obsidian's YAML parser is not available outside the app | Set each fixture as default frontmatter, create a note from a tagged calendar, inspect Properties panel |
| New variables render in title (sanitized filename), template body, frontmatter; `{{d}} {{dd}} {{date}}` side by side | ENH-12 | Rendering goes through Obsidian vault APIs | Use timed midday events on 2026-05-04 and 2027-01-01 (avoids existing UTC `{{date}}` shift for all-day events) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-10-20 (all 4 tasks green; Obsidian UAT remains manual-only)

## Validation Audit 2026-10-20

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
