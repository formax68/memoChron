---
phase: 05-guardrails-trivial-fixes
date: 2026-05-13
status: complete
---

# Phase 5 — Human UAT Evidence

This file is the verification-of-record for Phase 5 (Guardrails & Trivial Fixes), consistent with Phases 1–4 practice (D-13). It captures the acceptance evidence for DIR-11, DIR-12, and DOC-01.

---

## DIR-11 Verification

**Requirement:** `manifest.json` `description` field ends with `.`, `!`, or `?`.

Plan 01 SUMMARY (05-01-SUMMARY.md) records the assertion output:

```
DIR-11 ok
```

The assertion was produced by:

```bash
node -e "process.exit(JSON.parse(require('fs').readFileSync('manifest.json','utf8')).description.match(/[.!?]$/)?0:1) || console.log('DIR-11 ok')"
```

The one-character diff (`"Calendar integration and note creation with support for public iCalendar URLs"` → `"Calendar integration and note creation with support for public iCalendar URLs."`) is recorded in 05-01-SUMMARY.md commit `f5d880a`.

The `manifest.json` `description` field durably ends with `.` after the `npm version 1.15.0-beta.1` version-bump — `version-bump.mjs` only mutates the `version` key and `versions.json`; it never touches `description`. Confirmed by the downloaded artifact sanity check in DIR-12 Verification below (`descOk: true`).

---

## DIR-12 Verification

**Requirement:** GitHub release workflow attaches a GitHub artifact attestation to every release asset; verified by inspecting the workflow YAML AND the next pre-release output.

The workflow half was closed in Plan 02 (commit `d98587a`). The output half is closed here via the test pre-release `1.15.0-beta.1`.

### Test Pre-Release

| Field | Value |
|-------|-------|
| Tag | `1.15.0-beta.1` |
| Commit SHA | `4696020751e00c8b9b0c29245dbe7a5d98d5ea4d` |
| Commit title | `chore(release): cut 1.15.0-beta.1 to verify attestation flow (DIR-12 acceptance)` |
| Draft release URL | https://github.com/formax68/memoChron/releases/tag/untagged-e54dc8a38670a89888e0 |
| GitHub Actions run | https://github.com/formax68/memoChron/actions/runs/25797584015 |
| Workflow | Release Obsidian plugin (release.yml) |
| Trigger | `push` on tag `refs/tags/1.15.0-beta.1` |
| Conclusion | success |
| Created | 2026-05-13T11:56:56Z |

### Release Asset Digests

| File | SHA-256 | Bytes |
|------|---------|-------|
| main.js | `4312e606ed9bdf5e5dff2a02cd16edfb1d88f363c0d54d653e022938691fe3e7` | 264743 |
| manifest.json | `edec4a092b2da418339663c5368a1faf128989ae20f8af7c46d0588cef42371a` | 259 |
| styles.css | `12b89ea26a3c691a240cd1de465ddfba2f269750e27d80ec97b9e2ece392d8d4` | 28402 |

### `gh attestation verify main.js --repo formax68/memoChron`

```
Loaded digest sha256:4312e606ed9bdf5e5dff2a02cd16edfb1d88f363c0d54d653e022938691fe3e7 for file:///tmp/dir12-uat/main.js
Loaded 1 attestation from GitHub API

The following policy criteria will be enforced:
- Predicate type must match:................ https://slsa.dev/provenance/v1
- Source Repository Owner URI must match:... https://github.com/formax68
- Source Repository URI must match:......... https://github.com/formax68/memoChron
- Subject Alternative Name must match regex: (?i)^https://github.com/formax68/memoChron/
- OIDC Issuer must match:................... https://token.actions.githubusercontent.com

✓ Verification succeeded!

The following 1 attestation matched the policy criteria

- Attestation #1
  - Build repo:..... formax68/memoChron
  - Build workflow:. .github/workflows/release.yml@refs/tags/1.15.0-beta.1
  - Signer repo:.... formax68/memoChron
  - Signer workflow: .github/workflows/release.yml@refs/tags/1.15.0-beta.1
```

Exit code: 0

### `gh attestation verify manifest.json --repo formax68/memoChron`

```
Loaded digest sha256:edec4a092b2da418339663c5368a1faf128989ae20f8af7c46d0588cef42371a for file:///tmp/dir12-uat/manifest.json
Loaded 1 attestation from GitHub API

The following policy criteria will be enforced:
- Predicate type must match:................ https://slsa.dev/provenance/v1
- Source Repository Owner URI must match:... https://github.com/formax68
- Source Repository URI must match:......... https://github.com/formax68/memoChron
- Subject Alternative Name must match regex: (?i)^https://github.com/formax68/memoChron/
- OIDC Issuer must match:................... https://token.actions.githubusercontent.com

✓ Verification succeeded!

The following 1 attestation matched the policy criteria

- Attestation #1
  - Build repo:..... formax68/memoChron
  - Build workflow:. .github/workflows/release.yml@refs/tags/1.15.0-beta.1
  - Signer repo:.... formax68/memoChron
  - Signer workflow: .github/workflows/release.yml@refs/tags/1.15.0-beta.1
```

Exit code: 0

### `gh attestation verify styles.css --repo formax68/memoChron`

```
Loaded digest sha256:12b89ea26a3c691a240cd1de465ddfba2f269750e27d80ec97b9e2ece392d8d4 for file:///tmp/dir12-uat/styles.css
Loaded 1 attestation from GitHub API

The following policy criteria will be enforced:
- Predicate type must match:................ https://slsa.dev/provenance/v1
- Source Repository Owner URI must match:... https://github.com/formax68
- Source Repository URI must match:......... https://github.com/formax68/memoChron
- Subject Alternative Name must match regex: (?i)^https://github.com/formax68/memoChron/
- OIDC Issuer must match:................... https://token.actions.githubusercontent.com

✓ Verification succeeded!

The following 1 attestation matched the policy criteria

- Attestation #1
  - Build repo:..... formax68/memoChron
  - Build workflow:. .github/workflows/release.yml@refs/tags/1.15.0-beta.1
  - Signer repo:.... formax68/memoChron
  - Signer workflow: .github/workflows/release.yml@refs/tags/1.15.0-beta.1
```

Exit code: 0

### Downloaded manifest.json Sanity Check

Confirms DIR-11 durability in the published artifact AND correct BRAT-compatible version string:

```
{
  description: 'Calendar integration and note creation with support for public iCalendar URLs.',
  version: '1.15.0-beta.1',
  descOk: true
}
```

Command:

```bash
node -e "const m=require('/tmp/dir12-uat/manifest.json'); console.log({description:m.description, version:m.version, descOk:/[.!?]$/.test(m.description)})"
```

---

## DOC-01 Verification

**Requirement:** `npm run lint` enforces the scorecard ruleset; CI runs lint on every push and PR; a failing lint blocks the build.

### Fresh-Clone Lint Flow

Satisfied by the CI Lint workflow runs that fired on pushes to `origin/main` including Plans 01/02/03 commits. The GitHub Actions runner pulls a fresh clone for each run and executes `npm ci && npm run lint`.

Both runs concluded `success`:

- Run [25797580283](https://github.com/formax68/memoChron/actions/runs/25797580283) — push to main, head `0fd30c5` — conclusion: success
- Run [25797559062](https://github.com/formax68/memoChron/actions/runs/25797559062) — push to main, head `9896c08` — conclusion: success

### Deliberate innerHTML Regression Smoke-Check

From Plan 03 SUMMARY (05-03-SUMMARY.md), the regression smoke-check was run during Task 2 (dry-run tuning). A deliberate `innerHTML` write and `document.createElement` call were added to `src/services/CalendarService.ts` — a file NOT covered by the Phase 6 override block — and `npm run lint` was run:

```
/Users/mike/code/memoChron/src/services/CalendarService.ts
  271:16  error  DIR-04: Use Obsidian's createEl/createDiv/createSpan helpers instead of document.createElement  no-restricted-syntax
  272:5   error  Do not write to DOM directly using innerHTML/outerHTML property                                  @microsoft/sdl/no-inner-html

✖ 2 problems (2 errors, 0 warnings)
```

Exit code: 1. The gate fires. Rules triggered: `no-restricted-syntax` (hand-rolled DIR-04 selector) and `@microsoft/sdl/no-inner-html`. The edit was reverted; `npm run lint` exits 0 on the clean tree.

### GitHub PR Check Status Visible

The `lint.yml` workflow has appeared as a real Actions check on `origin/main` (confirmed by the two run URLs above). PR-check appearance — where the lint status is listed in the PR's "Checks" panel — will be visible on the next opened pull request.

**Deferred to next real PR:** No test PR has been opened during Phase 5 execution; the lint.yml trigger on `pull_request` branches is confirmed by inspecting the workflow YAML (`on: pull_request: branches: ['**']`) and by the successful push-trigger runs above.

---

## Disposition of Test Pre-Release Tag

**Decision: KEEP `1.15.0-beta.1`.**

The draft release and tag are retained as v1.15's first beta. Keeping it is one less moving part — no delete operation to track, no gap in the version history, and the attestation registry entry in the GitHub attestations API persists regardless (per 05-RESEARCH.md §7.3). The draft can be promoted to a published pre-release in the GitHub UI when the v1.15 milestone is ready for beta distribution.

---

## Sign-off

DIR-11 ✅, DIR-12 ✅, DOC-01 ✅ — Phase 5 acceptance evidence captured 2026-05-13
