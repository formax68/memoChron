---
phase: quick-260515-l3j
plan: 01
subsystem: release-metadata
tags: [release, version-revert, brat, obsidian-install-fix]
requires: []
provides:
  - manifest.json declares version 1.14.0 (matches the latest published GitHub release tag)
  - package.json declares version 1.14.0 (in sync with manifest.json per BRAT/version-bump.mjs contract)
  - versions.json no longer contains the 1.15.0-beta.1 entry; 1.14.0 remains the final entry
affects:
  - Obsidian update fetcher (BRAT and core)
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - manifest.json
    - package.json
    - versions.json
decisions:
  - Revert metadata to 1.14.0 on main; keep the 1.15.0-beta.1 git tag in place as a historical CI test artifact (out of scope for this plan)
metrics:
  duration: ~2 minutes
  completed: 2026-05-15
requirements:
  - REVERT-VERSION-01
---

# Quick 260515-l3j: Revert Manifest to 1.14.0 to Fix Obsidian Install Failures Summary

Reverted `manifest.json`, `package.json`, and `versions.json` from `1.15.0-beta.1` back to `1.14.0` so Obsidian's update fetcher and BRAT stop 404ing against a non-existent release.

## What Changed

| File            | Old Value                       | New Value                  |
| --------------- | ------------------------------- | -------------------------- |
| `manifest.json` | `"version": "1.15.0-beta.1"`    | `"version": "1.14.0"`      |
| `package.json`  | `"version": "1.15.0-beta.1"`    | `"version": "1.14.0"`      |
| `versions.json` | trailing `"1.15.0-beta.1": "1.8.9"` entry + comma on `"1.14.0"` line | `"1.14.0": "1.8.9"` is now the final entry (no trailing comma) |

## Commits

| Task | Description | Commit  | Files                                         |
| ---- | ----------- | ------- | --------------------------------------------- |
| 1    | Revert version metadata to 1.14.0 | `64410f6` | `manifest.json`, `package.json`, `versions.json` |

Commit message: `chore(release): revert version to 1.14.0` (no Claude/AI/Anthropic references; no `Co-Authored-By` trailer).

## Verification

All six verify checks from the plan passed:

1. `manifest OK` — `manifest.json` declares `"version": "1.14.0"`.
2. `package OK` — `package.json` declares `"version": "1.14.0"`.
3. `versions OK` — `versions.json` contains no `1.15.0-beta.1` reference and still contains `"1.14.0": "1.8.9"`.
4. `versions.json parses OK` — file is valid JSON after removing the trailing entry and its preceding comma.
5. `manifest.json parses OK` and `package.json parses OK` — both files are valid JSON.
6. Commit touches exactly the three target files; commit message contains no references to Claude/Anthropic/AI/Co-Authored-By.

`git show --stat HEAD`:

```
64410f6 chore(release): revert version to 1.14.0
 manifest.json | 2 +-
 package.json  | 2 +-
 versions.json | 3 +--
 3 files changed, 3 insertions(+), 4 deletions(-)
```

## Deviations from Plan

None — plan executed exactly as written.

## Out-of-Scope Items (Honored)

- The `1.15.0-beta.1` git tag was NOT deleted (local or remote).
- `version-bump.mjs` was NOT run; no `npm version` invocation.
- No push performed.
- No code changes (nothing under `src/`, `.github/`, or any other file).

## Optional Manual Follow-Up (Not Required for Plan Completion)

- Pull `main` into an Obsidian vault via BRAT or the community plugin updater and confirm the update completes without 404.

## Self-Check: PASSED

- File `manifest.json` exists with `"version": "1.14.0"` — FOUND.
- File `package.json` exists with `"version": "1.14.0"` — FOUND.
- File `versions.json` exists, ends with `"1.14.0": "1.8.9"`, no `1.15.0-beta.1` entry — FOUND.
- Commit `64410f6` exists on `worktree-agent-a7d5a3ce21ef0fe17` — FOUND.
