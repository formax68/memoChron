# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.15 — Directory Compliance

**Shipped:** 2026-10-31
**Phases:** 6 (05, 06, 07, 08, 08.1, 08.2) | **Plans:** 27 | **Sessions:** not tracked

### What Was Built
- ESLint 9 flat config enforcing the Obsidian scorecard rules. CI lints every push/PR, and tag releases stop at Lint before build, attestation and publish.
- Release provenance: `attest-build-provenance@v3` on all three assets. Hyphenated tags publish as BRAT-visible prereleases.
- DOM API refactor: no `innerHTML`, inline styles or raw `createElement`. Dynamic colors use `setCssProps` custom properties.
- Lifecycle and popout fixes: a pure `registerView` factory, `activeDocument`, `instanceof TFile`, promise hygiene, and BUG-07 closed on the Obsidian side.
- Type hygiene, plus Directory Compliance conventions in CONVENTIONS.md and CLAUDE.md.

### What Worked
- Landing the lint gate first, with overrides tagged by phase: each later phase had a clear "delete the override, lint passes" acceptance test.
- Grouping DIR-02/03/04 in one DOM pass avoided touching the same lines twice.
- The milestone audit before archiving caught a real weakness: DOC-01 was marked satisfied, but releases skipped lint and some rules only warned.

### What Was Inefficient
- About 5 months passed between Phase 8 (2026-05-17) and the tech-debt/audit closure phases (2026-10-30/31), so 08.1 had to reconcile stale records.
- Progress tooling mixed v1.14.0 and v1.15 counters because v1.14.0 was never archived. Stats needed manual correction at close.
- DOC-01 was marked "Complete" twice before it truly was. Checking boxes against the plan instead of probing behavior caused rework.

### Patterns Established
- Overrides tagged with the phase that removes them, and an acceptance step for that phase that deletes them.
- Releases use separate Install → Lint → Build → Attest → Release steps with default success gating (no `if:` overrides).
- Beta tags carry the bumped manifest, and main stays on the last stable version.
- One silent `debug.ts` helper is the only console exemption.

### Key Lessons
1. Check guardrail requirements with negative probes ("does a violation actually fail?"), not just a clean pass on the current tree.
2. Archive every milestone when it ships. Skipping v1.14.0 polluted v1.15's counters and archival scope.
3. When "accepted risk" or "out of scope" doc drift builds up, plan a small docs-cleanup phase rather than carrying it.

### Cost Observations
- Model mix: not tracked
- Sessions: not tracked
- Notable: execution of the inserted phases (08.1, 08.2) was fast (1–10 min per plan). Most elapsed time was idle time between phases.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.14.0 | — | 4 | First GSD-managed milestone (stabilization); not archived at close |
| v1.15 | — | 6 | Lint-first guardrails; milestone audit drove two inserted closure phases |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.14.0 | 0 | — | — |
| v1.15 | 0 (lint gate only) | — | 0 |

### Top Lessons (Verified Across Milestones)

1. Not enough data yet; revisit after the next milestone.
