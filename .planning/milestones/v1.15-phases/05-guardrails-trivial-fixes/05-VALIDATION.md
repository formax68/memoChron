---
phase: 5
slug: guardrails-trivial-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — project has no test runner; static-correctness via `tsc -noEmit` (existing) + `eslint` (this phase installs) |
| **Config file** | `eslint.config.mjs` (new this phase); `tsconfig.json` (existing) |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm ci && npm run lint && npm run build` |
| **Estimated runtime** | ~5–15 seconds (lint) · ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint` (once ESLint is installed in Wave 2)
- **After every plan wave:** Run `npm run lint && npm run build`
- **Before `/gsd-verify-work`:** `npm run lint` exits 0 AND `gh attestation verify` passes for all three release assets of the test pre-release tag
- **Max feedback latency:** ~15 seconds for lint feedback

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | DIR-11 | — | manifest.json description ends with `.` | source assertion | `node -e "process.exit(JSON.parse(require('fs').readFileSync('manifest.json','utf8')).description.match(/[.!?]$/)?0:1)"` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | DIR-12 | Supply-chain spoof | `release.yml` includes attest-build-provenance@v3 with `subject-path` for all three assets | source assertion | `grep -E "attest-build-provenance@v3" .github/workflows/release.yml && grep -E "id-token: write" .github/workflows/release.yml` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | DOC-01 | Tampering (lint bypass) | `npm run lint` exists and runs | CLI output | `npm run lint --silent; echo "exit=$?"` (should be 0 after overrides) | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 3 | DOC-01 | — | lint catches `innerHTML` regression | behavior | introduce `el.innerHTML = "x"` in a scratch file, run `npm run lint`, expect non-zero exit | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 3 | DOC-01 | — | `.github/workflows/lint.yml` exists and triggers on push + pull_request | source assertion | `grep -E "on:\s*\[push, pull_request\]\|on: \[push, pull_request\]" .github/workflows/lint.yml \|\| grep -A2 "^on:" .github/workflows/lint.yml \| grep -E "push\|pull_request"` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 4 | DIR-12 | Supply-chain spoof | test pre-release artifacts attested and verified | CLI output | `gh attestation verify main.js --owner formax68 && gh attestation verify manifest.json --owner formax68 && gh attestation verify styles.css --owner formax68` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Note: "❌ W0" means the file/binary does not yet exist on disk — it is created by an earlier task in the same wave or a prior wave (Wave 0 = Wave preceding this task's wave).*

---

## Wave 0 Requirements

- [ ] No new test framework — project explicitly omits a test runner this milestone (consistent with Phases 1–4)
- [ ] ESLint 9 + `@typescript-eslint@8` + `eslint-plugin-obsidianmd@0.3.0` + `typescript@^5.9.3` installed before any Plan 03 verification runs (planner sequences this as the first task of Plan 03)
- [ ] `gh` CLI v2.x available locally for `gh attestation verify` in Plan 04 (already used by `release.yml`; planner verifies version in pre-flight)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh-clone lint flow | DOC-01 | Acceptance criterion is "clean clone runs `npm ci && npm run lint`" — no automated reproducer; must be done on a clean working tree | Clone to a tmp dir, `npm ci`, `npm run lint`; expect exit 0 |
| Deliberate `innerHTML` regression catches | DOC-01 | Requires intentional code edit to verify the gate fires; not part of normal commits | Add `el.innerHTML = "x"` to a `src/` file, run `npm run lint`, expect non-zero exit and an `obsidianmd/no-inner-html`-class error; revert the edit |
| GitHub PR check status visible | DOC-01 | Requires a real PR to be opened; CI status visibility is a GitHub-side observation | Open a draft PR; confirm the `lint` workflow appears in PR checks; confirm a failing lint blocks the check |
| `gh attestation verify` against published tag | DIR-12 | Requires an actual GitHub release published with attestations; cannot be simulated locally | After Plan 04 publishes the test pre-release tag, run the three `gh attestation verify` commands; record stdout in 05-HUMAN-UAT.md |
| BRAT-compatible release artifacts unchanged | DIR-12 | Acceptance includes "rest of the publish flow intact" — must be eyeballed on the test pre-release's assets list | Compare the test pre-release's asset list to a prior release; confirm `manifest.json`, `main.js`, `styles.css` present; confirm download links work in BRAT |

---

## Validation Sign-Off

- [x] All tasks have automated source/CLI verifications or are listed under Manual-Only
- [x] Sampling continuity: lint is the automated gate after every task in Plan 03; release-flow tasks rely on the CI workflow + `gh attestation verify` output
- [x] Wave 0 covers all toolchain installs that later tasks depend on
- [x] No watch-mode flags (no test framework)
- [x] Feedback latency < 30s (lint ~5–15s; build ~30s)
- [ ] `nyquist_compliant: true` set in frontmatter — kept `false` because the project deliberately omits a test framework this milestone; sampling depends on static checks + manual UAT, which is acceptable for an Obsidian plugin guardrails phase (see CONTEXT.md D-13)

**Approval:** pending
