---
phase: "05-guardrails-trivial-fixes"
plan: "02"
subsystem: "CI / Release Workflow"
tags:
  - ci
  - attestation
  - sigstore
  - github-actions
  - security
dependency_graph:
  requires:
    - "05-01-SUMMARY.md (manifest.json description punctuation — DIR-11)"
  provides:
    - "Release workflow with Sigstore build-provenance attestation for main.js, manifest.json, styles.css"
  affects:
    - ".github/workflows/release.yml"
tech_stack:
  added:
    - "actions/attest-build-provenance@v3"
  patterns:
    - "GitHub Actions OIDC token → Sigstore signing certificate → GitHub attestations API"
    - "Multi-subject subject-path literal-block newline list"
key_files:
  modified:
    - ".github/workflows/release.yml"
decisions:
  - "Pinned @v3 (not @v2 as CONTEXT.md D-09 anticipated): v2 has had no updates since June 2025 and is one major behind; v3 (v3.2.0, Jan 2026) is current stable with identical input contract and adds artifact-metadata support"
  - "Preserved actions/checkout@v3 and actions/setup-node@v3 (purist path per RESEARCH.md §11 Q2 — DIR-12 commit diff kept narrow; pin bumps deferred)"
  - "Attestation step ordered after Build plugin and before Create release (load-bearing: artifacts must exist on disk for hashing; sidesteps immutable-releases timing edge case per RESEARCH.md §6.4 §9.5)"
metrics:
  duration: "< 5m"
  completed: "2026-05-13"
  tasks_completed: 1
  files_modified: 1
---

# Phase 5 Plan 02: Release Attestation (DIR-12) Summary

**One-liner:** Added `actions/attest-build-provenance@v3` to `release.yml` with OIDC/attestations/artifact-metadata permissions and a three-file `subject-path` newline list, attesting `main.js`, `manifest.json`, and `styles.css` on every tag push via Sigstore.

## What Was Done

Added the workflow half of DIR-12. Every tag push to `formax68/memoChron` will now produce a Sigstore-signed GitHub artifact attestation anchored to the SHA-256 digest of the three release assets, verifiable with `gh attestation verify`. The acceptance half (test-tag pre-release + `gh attestation verify` output) closes in Plan 04.

## Task 1: Add attest-build-provenance@v3 step + expand permissions

**Status:** Complete
**Commit:** (see below)
**Files modified:** `.github/workflows/release.yml` only

### Full `git diff .github/workflows/release.yml`

```diff
diff --git a/.github/workflows/release.yml b/.github/workflows/release.yml
index fbb21c4..9690de3 100644
--- a/.github/workflows/release.yml
+++ b/.github/workflows/release.yml
@@ -10,6 +10,9 @@ jobs:
     runs-on: ubuntu-latest
     permissions:
       contents: write
+      id-token: write          # required by attest-build-provenance to mint OIDC token
+      attestations: write      # required by attest-build-provenance to persist attestation
+      artifact-metadata: write # required by v3+ for artifact metadata storage records
     steps:
       - uses: actions/checkout@v3
 
@@ -23,6 +26,14 @@ jobs:
           npm install
           npm run build
 
+      - name: Attest release artifacts
+        uses: actions/attest-build-provenance@v3
+        with:
+          subject-path: |
+            main.js
+            manifest.json
+            styles.css
+
       - name: Create release
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### YAML Structural Assertion Output

```
release.yml ok
```

Command: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/release.yml')); ...step order bi < ai < ci, subject-path=['main.js','manifest.json','styles.css']...; print('release.yml ok')"`

### No Other Files Modified

`git diff --stat` shows only `.github/workflows/release.yml` changed. Confirmed via grep checks:
- `actions/checkout@v3`: count=1 (unchanged)
- `actions/setup-node@v3`: count=1 (unchanged)
- `node-version: "18.x"`: count=1 (unchanged)
- `--draft`: count=1 (unchanged)
- `attest-build-provenance@v2`: count=0 (absent — correct)

## Commit

**Title:** `ci(release): attest release artifacts via build-provenance (DIR-12)`

**Body note:** Pinned `@v3` rather than `@v2` (as CONTEXT.md D-09 anticipated): v2 has received no updates since June 2025 and is one major behind. v3 (v3.2.0, Jan 2026) is current stable with an identical input contract; it also adds the `artifact-metadata: write` permission scope used in the new permissions block. Rationale documented in 05-RESEARCH.md §6.1.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Intentional Deviation: @v2 → @v3 (pre-approved by plan)

The plan explicitly documents this as a mandatory deviation:

- **Documented in:** 05-PLAN.md `<objective>` DEVIATION NOTE, `<action>` instruction, 05-RESEARCH.md §6.1
- **Reason:** `actions/attest-build-provenance@v2` last updated June 2025, one major behind; `@v3` (v3.2.0, Jan 2026) is current stable with identical input contract and adds `artifact-metadata: write` support
- **Impact:** No behavioral difference for this use case; `@v3` is strictly more current

## Status: Workflow Half Complete

The workflow half of DIR-12 is now in place. Plan 04 closes the acceptance half via a test-tag pre-release (`1.15.0-beta.1`) followed by `gh attestation verify` against each downloaded artifact, with output captured to `05-HUMAN-UAT.md`.

## Threat Surface Scan

No new security-relevant surface introduced beyond the scope of the plan's threat model:

- `id-token: write` and `attestations: write` are the standard GitHub-required permissions for Sigstore attestation — documented in the plan's `<threat_model>` as T-05-01 and T-05-02
- `artifact-metadata: write` is additive metadata storage, no new trust boundary
- The action itself (`actions/attest-build-provenance@v3`) is the standard GitHub-managed attestation action for public repositories

## Commit Details

**Hash:** d98587a
**Message:** `ci(release): attest release artifacts via build-provenance (DIR-12)`

## Self-Check: PASSED

- [x] `.github/workflows/release.yml` exists at expected path
- [x] Commit `d98587a` exists in git log
- [x] `05-02-SUMMARY.md` exists at `.planning/phases/05-guardrails-trivial-fixes/05-02-SUMMARY.md`
- [x] No stubs or placeholder text in modified file
- [x] No other files modified (git diff --stat shows only release.yml)
