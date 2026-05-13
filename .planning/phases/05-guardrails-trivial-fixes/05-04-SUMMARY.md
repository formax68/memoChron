---
phase: 05-guardrails-trivial-fixes
plan: "04"
subsystem: release / attestation
tags:
  - dir-12
  - attestation
  - sigstore
  - pre-release
  - uat
dependency_graph:
  requires:
    - 05-02
    - 05-03
  provides:
    - dir-12-acceptance
    - phase-5-uat-evidence
  affects:
    - package.json
    - manifest.json
    - versions.json
    - .planning/phases/05-guardrails-trivial-fixes/05-HUMAN-UAT.md
tech_stack:
  added: []
  patterns:
    - BRAT-compatible version-bump (npm version → version-bump.mjs → commit + tag)
    - GitHub artifact attestation via actions/attest-build-provenance@v3
    - gh attestation verify (Sigstore SLSA provenance v1)
key_files:
  created:
    - .planning/phases/05-guardrails-trivial-fixes/05-HUMAN-UAT.md
  modified:
    - package.json
    - manifest.json
    - versions.json
decisions:
  - "Keep 1.15.0-beta.1 as v1.15's first beta — attestation registry entry persists regardless; one less moving part"
  - "Tag convention 1.15.0-beta.1 follows prior 1.3.0-beta.1 pattern (05-RESEARCH.md §7.1)"
  - "Amended npm-auto-generated commit title to chore(release): cut 1.15.0-beta.1 to verify attestation flow (DIR-12 acceptance) per D-11"
metrics:
  duration: "~30 minutes (tag + workflow watch + verify)"
  completed: "2026-05-13"
  tasks: 4
  files_changed: 4
---

# Phase 5 Plan 04: Cut 1.15.0-beta.1 and Capture DIR-12 Acceptance Evidence Summary

**One-liner:** Pushed test pre-release tag `1.15.0-beta.1`, watched `release.yml` succeed, ran `gh attestation verify` against all three artifacts (exit 0 on each), and captured the evidence in `05-HUMAN-UAT.md`, closing DIR-12's acceptance half and completing Phase 5.

## Execution Log

### Task 1: Pre-flight Checks (checkpoint — orchestrator)

All 8 pre-flight checks passed:

1. `gh version 2.92.0 (2026-04-28)` — >= 2.46.0
2. Authenticated as `formax68` (keyring), protocol SSH, scopes `gist`, `read:org`, `repo`
3. Repo visibility: `PUBLIC`
4. Plans 01/02/03 commits present on `origin/main`
5. Working tree clean
6. `manifest.json` description ends with `.`
7. `grep -c "attest-build-provenance@v3" .github/workflows/release.yml` → `1`
8. `package.json` version pre-bump: `1.14.0`

### Task 2: Cut and Push Tag 1.15.0-beta.1

Version-bump commit (git log -1 --format=fuller):

```
commit 4696020751e00c8b9b0c29245dbe7a5d98d5ea4d
Author:     formax68 <mike@efstratiadis.me>
AuthorDate: Wed May 13 14:56:25 2026 +0300
Commit:     formax68 <mike@efstratiadis.me>
CommitDate: Wed May 13 14:56:34 2026 +0300

    chore(release): cut 1.15.0-beta.1 to verify attestation flow (DIR-12 acceptance)
```

`package.json`, `manifest.json`, and `versions.json` all bumped to `1.15.0-beta.1` via `npm version 1.15.0-beta.1` → `version-bump.mjs`. Commit message amended from the npm default (`1.15.0-beta.1`) to the D-11 illustrative title. Tag re-pointed at the amended commit.

### Task 3: Watch release.yml and Verify Attestation (checkpoint — orchestrator)

**GitHub Actions run:** https://github.com/formax68/memoChron/actions/runs/25797584015
**Conclusion:** success
**Draft release:** https://github.com/formax68/memoChron/releases/tag/untagged-e54dc8a38670a89888e0

All three `gh attestation verify` commands exited 0. Full stdouts are in `05-HUMAN-UAT.md` § DIR-12 Verification.

Asset digests:

| File | SHA-256 | Bytes |
|------|---------|-------|
| main.js | `4312e606ed9bdf5e5dff2a02cd16edfb1d88f363c0d54d653e022938691fe3e7` | 264743 |
| manifest.json | `edec4a092b2da418339663c5368a1faf128989ae20f8af7c46d0588cef42371a` | 259 |
| styles.css | `12b89ea26a3c691a240cd1de465ddfba2f269750e27d80ec97b9e2ece392d8d4` | 28402 |

Downloaded manifest.json sanity check:

```
{ description: 'Calendar integration and note creation with support for public iCalendar URLs.', version: '1.15.0-beta.1', descOk: true }
```

### Task 4: Author 05-HUMAN-UAT.md

Created `.planning/phases/05-guardrails-trivial-fixes/05-HUMAN-UAT.md` with sections:
- `## DIR-11 Verification` — cross-reference to Plan 01 SUMMARY assertion output (`DIR-11 ok`)
- `## DIR-12 Verification` — all three `gh attestation verify` stdouts, asset digest table, release URL, commit SHA
- `## DOC-01 Verification` — CI Lint run URLs, deliberate innerHTML smoke-check stdout, PR-check deferred note
- `## Disposition of test pre-release tag` — KEEP `1.15.0-beta.1`
- `## Sign-off` — DIR-11 ✅, DIR-12 ✅, DOC-01 ✅

Both `05-HUMAN-UAT.md` and this `05-04-SUMMARY.md` are committed in the same `docs(05): ...` commit.

## Disposition of Test Pre-Release Tag

**KEEP `1.15.0-beta.1`** — retained as v1.15's first beta. The attestation registry entry in the GitHub attestations API persists regardless of what happens to the draft release or tag. Keeping the draft is one less operation and provides a clean beta entry when v1.15 is ready for distribution.

## Phase 5 ROADMAP Success Criteria — All Satisfied

| # | Success Criterion | Evidence |
|---|-------------------|----------|
| 1 | `npm run lint` exists and exits non-zero on rule violations | Plan 03 SUMMARY — `npm run lint` exits 0 on clean tree, exits 1 on deliberate innerHTML write |
| 2 | GitHub Actions workflow runs lint on every push and PR | Plan 03 SUMMARY — `.github/workflows/lint.yml` created; two successful CI runs on `origin/main` (runs 25797580283, 25797559062) |
| 3 | ESLint runs cleanly against v1.15 starting tree via named-phase overrides | Plan 03 SUMMARY — `eslint.config.mjs` with Phase 6/7/8 override blocks; `npm run lint` exits 0 |
| 4 | `manifest.json` description ends with `.`, `!`, or `?` | Plan 01 SUMMARY — one-character diff `f5d880a`; `DIR-11 ok` assertion |
| 5 | Release workflow attaches GitHub artifact attestation; verified by YAML inspection AND next pre-release output | Plan 02 SUMMARY — `release.yml` with `attest-build-provenance@v3`; this plan — `gh attestation verify` exits 0 for all three assets of `1.15.0-beta.1` |

## Deviations from Plan

None — plan executed as specified. The version-bump commit was amended from the npm default to the D-11 illustrative title as the plan instructed.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The three `gh attestation verify` outputs confirm T-05-01 (release artifact provenance spoofing) is mitigated end-to-end. The downloaded manifest.json artifact confirms T-05-12 (description regression via version-bump.mjs) is not triggered — `descOk: true`.

## Self-Check: PASSED

- `05-HUMAN-UAT.md` exists at phase directory: VERIFIED
- Contains `## DIR-12 Verification`: VERIFIED
- Contains all three `gh attestation verify` command outputs: VERIFIED
- Contains tag string `1.15.0-beta.1`: VERIFIED
- Contains draft release URL: VERIFIED
- Zero matches for `claude`, `AI assist`, `AI-assisted`, `generated with` (case-insensitive): VERIFIED
- Disposition of test pre-release tag explicitly recorded: VERIFIED (KEEP)
- Version-bump commit `4696020` in git log: VERIFIED
- Phase 5 ROADMAP success criteria 1–5 all satisfied: VERIFIED
