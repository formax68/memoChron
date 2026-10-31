# Phase 5: Guardrails & Trivial Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 05-guardrails-trivial-fixes
**Areas discussed:** Lint ruleset source, CI workflow placement, manifest description scope, release attestation contour, ESLint version policy, type-aware lint trade-off, override mechanism, attestation UAT, phase ordering, npm scripts/scope

---

## Lint ruleset source (DOC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Community plugin (`eslint-plugin-obsidianmd`) | Adopt the obsidian-community maintained ESLint plugin; codifies the exact scorecard rules. Add @typescript-eslint for the generic rules. | ✓ |
| Hand-rolled custom rules | Use `no-restricted-syntax` AST selectors + `no-restricted-properties` / `no-restricted-globals` to express each Obsidian-specific rule ourselves. | |
| Layered — community plugin + custom | Start with the community plugin, then layer hand-rolled selectors for any gap. | |

**User's choice:** Community plugin (recommended).
**Notes:** Planner falls back to hand-rolled `no-restricted-syntax` only if the plugin genuinely lacks a specific rule (captured as the implicit fallback in D-02).

---

## CI workflow placement (DOC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated `.github/workflows/lint.yml` | Single-responsibility CI workflow running only `npm run lint` on push + PR. | ✓ |
| New combined `.github/workflows/ci.yml` (lint + build) | One workflow running both `npm run lint` and `npm run build`. | |
| Add lint step to existing `claude.yml` | Append lint to one of the existing Claude workflows. | |

**User's choice:** New dedicated `lint.yml` (recommended).
**Notes:** Keeps lint gate decoupled from Claude review workflows; clearer PR checks signal.

---

## Manifest description scope (DIR-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Append period only | Single-character change: `…iCalendar URLs.` Minimum to satisfy DIR-11. | ✓ |
| Append period + sync `package.json` description | Also update `package.json` description to match manifest. | |
| Mild rewrite + period | Polish the description (e.g., align with core-value statement) and end with `.` | |

**User's choice:** Append period only (recommended).
**Notes:** Preserves the existing directory-indexed description; `package.json` description not flagged.

---

## Release attestation contour (DIR-12)

| Option | Description | Selected |
|--------|-------------|----------|
| `actions/attest-build-provenance@v2` only | Official GitHub-maintained action; SLSA-3 build provenance signed by GitHub OIDC. | ✓ |
| Build provenance + SBOM attestation | Layer `actions/attest-sbom` on top of build provenance. | |
| Generic `actions/attest@v2` | More flexible custom predicate; less recognizable. | |

**User's choice:** Build-provenance only (recommended).
**Notes:** SBOM noted as a deferred idea — DIR-12 wording is satisfied by build-provenance alone.

---

## ESLint version policy (DOC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Modern stack (ESLint 9 + flat config + @typescript-eslint 8) | Install ESLint 9.x with `eslint.config.mjs`; upgrade @typescript-eslint to 8.x. | ✓ |
| ESLint 8 legacy + keep @typescript-eslint 5.29 | Install ESLint 8.x with `.eslintrc.json`; preserve pinned @typescript-eslint 5.29. | |
| ESLint 8 + upgrade @typescript-eslint to 7 | Middle path: ESLint 8.x with legacy config + @typescript-eslint 7. | |

**User's choice:** Modern stack (recommended).
**Notes:** No `eslint` package is installed today, so the upgrade is happening regardless of choice; modern stack is current-supported tooling.

---

## Type-aware lint trade-off (DOC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Enable type-aware lint via `parserOptions.project` | Required for `@typescript-eslint/no-floating-promises`; ~5–10x slower per file. | ✓ |
| Syntax-only lint; use heuristic for floating promises | Faster CI; weaker `no-floating-promises` coverage. | |

**User's choice:** Type-aware (recommended).
**Notes:** ~30 source files — absolute wall-clock is seconds; DOC-01 explicitly names `no-floating-promises`, so this is the only acceptable route.

---

## Override mechanism (DOC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-rule `overrides[]` blocks grouped by future phase | Config-level overrides with leading comments naming Phase 6 / 7 / 8. | ✓ |
| Inline `eslint-disable-next-line` comments at each call site | Per-line suppressions naming the future phase. | |
| Mixed — per-rule overrides for sweeps, inline disables for one-offs | Hybrid based on violation count. | |

**User's choice:** Per-rule `overrides[]` blocks grouped by future phase (recommended).
**Notes:** Single source of truth in `eslint.config.mjs`; each block deletable as one diff when its phase ships.

---

## Attestation UAT (DIR-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Cut a real test pre-release tag and verify | Push throwaway test tag, run release.yml, then `gh attestation verify` against each asset. | ✓ |
| Workflow YAML inspection only; defer real verification | Phase ships with YAML changes only; verification slides to milestone end. | |
| Dry-run via `workflow_dispatch` on a branch | Adds `workflow_dispatch` trigger to release.yml; runs without a real tag. | |

**User's choice:** Real test pre-release (recommended).
**Notes:** DIR-12 acceptance explicitly names "the next pre-release output" — the test tag is what closes acceptance.

---

## Phase ordering and commit granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Trivial-first: DIR-11 → DIR-12 → DOC-01 → verify pre-release | 4 atomic commits; clear the two trivial findings first, then ship the bulk DOC-01 work, then verify. | ✓ |
| DOC-01 first to enforce rules immediately, then DIR-11 → DIR-12 → verify | Install lint guardrails first; mostly aesthetic ordering benefit. | |
| Bundle DIR-11 + DIR-12 in one commit, DOC-01 separate | Two commits + verification; tighter PR. | |

**User's choice:** Trivial-first (recommended).
**Notes:** Each requirement gets its own atomic commit; verification is the 4th and last commit.

---

## npm scripts and lint scope (DOC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| `lint` = `eslint src/`; add `lint:fix`; build unchanged | Lint is a separate gate; dev/build scripts untouched. | ✓ |
| `lint` = `src/` + `*.mjs` config files; add `lint:fix` | Broaden glob to also cover esbuild.config.mjs / version-bump.mjs. | |
| `lint` = `src/`, no `lint:fix`, and build chains lint | Tightest local coupling; slower local builds. | |

**User's choice:** Recommended (src/ only; add `lint:fix`; build unchanged).
**Notes:** Build-script chaining deferred; planner may add `typecheck` script as a separate convenience.

---

## Claude's Discretion

- Exact ESLint / @typescript-eslint / `eslint-plugin-obsidianmd` minor versions (researcher pins at planning time).
- Override block file-glob granularity (planner runs dry-run lint, then groups by future phase).
- Test pre-release tag string (`1.15.0-pre.0` vs `1.15.0-beta.1` vs `1.15.0-alpha.1`) — planner picks.
- Node version in `lint.yml` (Node 18 vs Node 20) — planner aligns with `release.yml`.
- `actions/cache` use in `lint.yml` — convenience, planner's call.
- `--draft` flag on the test pre-release's `gh release create` — planner's call.

## Deferred Ideas

- JSON lint for `manifest.json` punctuation regression via `eslint-plugin-jsonc`.
- Branch protection / required status checks on `main` (GitHub repo settings, not codebase).
- SBOM attestation (`actions/attest-sbom`) — not required by DIR-12.
- `husky` / `lint-staged` pre-commit hooks.
- Bumping `actions/setup-node@v3` → `@v4`, Node 18 → Node 20 in `release.yml`.
- Separate `npm run typecheck` script.
- DIR-01 / DIR-02..DIR-10 actual code changes — by design, silenced behind named-phase overrides this phase.
