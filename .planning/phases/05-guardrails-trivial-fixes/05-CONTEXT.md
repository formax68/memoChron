# Phase 5: Guardrails & Trivial Fixes - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Install lint/CI guardrails **before** any other v1.15 phase touches code (so Phases 6–8 land against rules already enforced), and land the two single-line directory-scorecard findings that are independent of everything else. Three requirements only — DOC-01 (ESLint + CI), DIR-11 (manifest description punctuation), DIR-12 (release-artifact attestation) — plus the verification of an actual attested pre-release that closes DIR-12's acceptance.

- **DIR-11** — `manifest.json` `description` ends with `.`, `!`, or `?`. Today the field reads `"Calendar integration and note creation with support for public iCalendar URLs"` (no terminating punctuation).
- **DIR-12** — The GitHub release workflow attaches a GitHub artifact attestation to every release asset (`manifest.json`, `main.js`, `styles.css`). Acceptance: workflow YAML inspection **and** the next pre-release output verify successfully.
- **DOC-01** — A working ESLint configuration enforces — at minimum — `no-console`, `no-inner-html`, the Obsidian community linting rules (no inline styles, no `as TFile`, no view-in-`registerView`, popout-window helpers), `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`. `npm run lint` exists in `package.json`; CI runs lint on every push and PR; failing lint blocks the build. ESLint MUST run cleanly against the v1.15 starting tree via per-file / per-rule overrides whose comments explicitly name the future phase that will remove them (Phase 6 → DOM-API rules; Phase 7 → lifecycle/promise/cast rules; Phase 8 → type-hygiene and console rules).

Goal at end of phase: pushing to `main` or opening a PR runs ESLint with the directory-scorecard rules and blocks merge on failure; the rules currently fire on the v1.15 starting tree are silenced **per-rule, with named-phase comments**, so the lint gate is real for any *new* code while Phases 6/7/8 close the existing violations; the next pre-release tag publishes attested artifacts that pass `gh attestation verify`; `manifest.json` description ends with a period.

</domain>

<decisions>
## Implementation Decisions

### Lint ruleset and toolchain (DOC-01)

- **D-01:** **ESLint 9 with flat config (`eslint.config.mjs`)** and `@typescript-eslint` upgraded to **8.x**. The current devDependencies have no `eslint` package at all and `@typescript-eslint/*` pinned to 5.29.0 — both need refreshing anyway, so jumping to the current-supported stack is the right baseline. Phase 5 commits the upgrade; the older `@typescript-eslint` 5.29 entries are removed from `package.json`. Researcher confirms exact `eslint` and `@typescript-eslint/*` v8 minor versions at planning time.
- **D-02:** **`eslint-plugin-obsidianmd`** is the canonical source for the Obsidian-specific scorecard rules (no `innerHTML`/`outerHTML`, inline-style ban, no `as TFile`, no view-in-`registerView`, popout-window helpers — `activeDocument`, `activeWindow.setTimeout`). Researcher confirms the package name, current version, and exact rule names at planning time. `@typescript-eslint/eslint-plugin` provides the generic rules (`no-floating-promises`, `no-explicit-any`, `no-unused-vars`). If `eslint-plugin-obsidianmd` proves immature or lacks a specific rule, planner layers a hand-rolled `no-restricted-syntax` selector to fill the gap — but the community plugin is the **default expectation**.
- **D-03:** **Type-aware lint enabled** via `parserOptions.project: ./tsconfig.json` (or `projectService: true` in @typescript-eslint 8 — researcher picks whichever is the current idiom). This is the only way `@typescript-eslint/no-floating-promises` works correctly, and DOC-01 names it explicitly. The codebase is ~30 source files — wall-clock cost of type-aware lint is seconds, not a CI bottleneck.
- **D-04:** **Per-rule `overrides[]` blocks grouped by future phase**, each with a leading comment naming the phase that will remove it. Example shape:
  ```js
  // Phase 6 — DIR-02/DIR-04 will remove these when the DOM-API refactor lands.
  { files: ["src/views/**", "src/utils/viewRenderers.ts", "src/settings/SettingsTab.ts"],
    rules: { "obsidianmd/no-inner-html": "off", /* ... */ } },
  // Phase 7 — DIR-05..DIR-08 will remove these when lifecycle/compat lands.
  { files: ["src/main.ts", "src/views/CalendarView.ts", /* ... */],
    rules: { "@typescript-eslint/no-floating-promises": "off", /* ... */ } },
  // Phase 8 — DIR-01/DIR-09/DIR-10 will remove these when type-hygiene lands.
  { files: ["src/**/*.ts"],
    rules: { "no-console": "off", "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unused-vars": "off" } },
  ```
  Single source of truth in `eslint.config.mjs`; each block is deletable as one diff when its phase ships. **No `eslint-disable` inline comments** for scorecard violations (those would diff-noise this phase and be invisible at config level). Planner confirms exact file globs after a dry-run against the current tree.
- **D-05:** **`npm run lint` = `eslint src/`** in `package.json`. Add **`npm run lint:fix` = `eslint src/ --fix`** as developer convenience. `build` script stays unchanged (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`) — lint is a separate gate, not chained into build, so dev hot-reload (`npm run dev`) and prod build don't pay the lint cost on every iteration. CI runs `npm run lint` and `npm run build` as separate steps.

### CI placement (DOC-01)

- **D-06:** **New dedicated `.github/workflows/lint.yml`** runs on `push` and `pull_request` against all branches. Steps: checkout → `actions/setup-node@v4` Node 20.x → `npm ci` → `npm run lint`. Single responsibility — its presence/absence in the PR checks list is a clear signal. The existing `claude-code-review.yml` and `claude.yml` are untouched. `release.yml` is touched separately (DIR-12).
- **D-07:** Lint failure **blocks the build** (job exits non-zero on any lint error, which is the default ESLint behavior). No branch-protection-rule change is in scope this phase — the user enables required-status-checks on the GitHub repo settings outside the codebase if/when they want hard merge-blocking. The phase delivers the workflow; enforcement policy is a repo-settings choice.

### Trivial fixes (DIR-11 + DIR-12)

- **D-08:** **DIR-11 — append a single `.` to `manifest.json` `description`.** New value: `"Calendar integration and note creation with support for public iCalendar URLs."`. No other wording change. `package.json` description (`"Calendar integration and note creation plugin for Obsidian"`) is untouched — different field, not flagged by the scorecard, not required for DIR-11.
- **D-09:** **DIR-12 — `actions/attest-build-provenance@v2`** in `release.yml`, run **after** `npm run build` and **before** `gh release create`. Adds `permissions: id-token: write, attestations: write, contents: write` to the job (the existing `contents: write` stays). The action is run with `subject-path: |\n  main.js\n  manifest.json\n  styles.css` so all three release assets get attested. No SBOM attestation in scope (DIR-12 says "artifact attestation" — provenance is the de-facto standard); no `actions/attest` generic predicate. Researcher confirms current `@v2` API and exact `subject-path` syntax at planning time.
- **D-10:** **Pre-release verification (closes DIR-12 acceptance).** As the final step of the phase, push a real test tag (`1.15.0-pre.0` or `1.15.0-beta.1` — exact tag string is planner's call), let `release.yml` run, then run `gh attestation verify main.js --owner formax68`, `gh attestation verify manifest.json --owner formax68`, and `gh attestation verify styles.css --owner formax68` against the produced release assets. Each `verify` MUST pass. This evidence — the three command outputs and the resulting pre-release URL — goes into `05-HUMAN-UAT.md`. The test pre-release is then either kept as v1.15's first beta or deleted (planner's call); the **attestation registry entry remains** either way.

### Phase ordering and commit granularity

- **D-11:** **Sequence: DIR-11 → DIR-12 → DOC-01 → pre-release verification.** Four atomic commits, requirement-scoped:
  1. `fix(manifest): end description with a period (DIR-11)`
  2. `ci(release): attest release artifacts via build-provenance (DIR-12)`
  3. `chore(lint): add ESLint 9 + obsidianmd + per-phase overrides + CI gate (DOC-01)`
  4. `chore(release): cut v1.15.0-pre.0 to verify attestation flow (DIR-12 acceptance)`
  Commit message verbiage is illustrative — planner finalizes. Rationale: clearing the two single-line findings first removes the trivial work from the bulk DOC-01 PR; DOC-01 then lands without other concerns muddying its review; verification is the last commit so the test pre-release reflects the final tree.
- **D-12:** **Commit-message hygiene** — per `CLAUDE.md` and prior-phase practice, no Claude / AI references in any commit message, PR description, or release note. Commit messages stay terse and requirement-coded (`DIR-11`, `DIR-12`, `DOC-01` in the body, not the title).

### Verification approach

- **D-13:** **Code review + HUMAN-UAT** (consistent with Phases 1–4 — no test suite is in scope this milestone). `05-HUMAN-UAT.md` carries: (a) `npm run lint` runs cleanly on a fresh clone (`npm ci && npm run lint` → exit 0); (b) introducing a deliberate `innerHTML` write fails the lint; (c) the test pre-release's `gh attestation verify` commands all succeed; (d) `manifest.json` description in the test pre-release's artifact ends with `.`. Planner authors the UAT script during planning.

### Claude's Discretion

- **Exact ESLint / @typescript-eslint / obsidianmd minor versions** — researcher pins at planning time to the latest stable at that moment.
- **Override block file-glob granularity** — planner runs a dry-run lint of the starting tree, then groups results by future phase into the smallest workable globs that don't accidentally silence Phase-5-added code.
- **Test pre-release tag string** (`1.15.0-pre.0` vs `1.15.0-beta.1` vs `1.15.0-alpha.1`) — planner picks consistent with prior `1.14.0` pre-release naming.
- **Node version in `lint.yml`** (Node 18 vs Node 20) — planner aligns with `release.yml` (currently 18.x — likely also bumped this phase if planner notices the drift; out of strict scope but a reasonable rider).
- **Whether `lint.yml` also caches `node_modules`** via `actions/cache` — convenience, not correctness; planner's call.
- **Whether to keep `--draft` on the `gh release create` for the test pre-release** — current `release.yml` uses `--draft`; planner may flip the test tag's run to a real pre-release so the attestation registry entry is canonical, then mark v1.15.0-pre.0 as a pre-release in the GitHub UI.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project artifacts
- `.planning/ROADMAP.md` — Phase 5 entry; 5 success criteria; explicit lock that per-rule/per-file overrides MUST name the phase that will remove them (Phase 6 / Phase 7 / Phase 8)
- `.planning/REQUIREMENTS.md` — DOC-01 wording (exact rule names), DIR-11 wording (terminating punctuation), DIR-12 wording (artifact attestation on every release asset); Out of Scope confirms "test suite", "accessibility", and non-critical perf are not in this phase
- `.planning/PROJECT.md` — milestone framing; "Install lint/CI guardrails alongside the fixes" as a Key Decision; current scorecard reads "Risks (1/4 red)"
- `.planning/STATE.md` — v1.15 active; Phase 05 is "Roadmap created; ready to plan"

### Codebase intel
- `.planning/codebase/STACK.md` — TypeScript 4.7.4, esbuild 0.17.3, `@typescript-eslint/*` pinned 5.29.0, no `eslint` package installed, no `.eslintrc` present
- `.planning/codebase/ARCHITECTURE.md` — source layout (`src/main.ts`, `src/services/`, `src/views/`, `src/settings/`, `src/utils/`, `src/types/`); planner picks override globs from this map
- `.planning/codebase/CONVENTIONS.md` — current `console.log/.warn/.error/.debug` discipline (prefix `"MemoChron: "`); identifies `NoteService` as having `console.error`-only (no `Notice`) — relevant to DIR-01 in Phase 8, not this phase, but planner is aware
- `.planning/codebase/STRUCTURE.md` — `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `version-bump.mjs` layout

### Prior phase context (decisions carried forward)
- `.planning/phases/01-foundation/01-CONTEXT.md` — live-settings pattern (services read `this.plugin.settings` via getter, no caching) — not directly relevant this phase but documented as a pattern Phase 5 must not break
- `.planning/phases/02-security-correctness/02-CONTEXT.md` — `errorMessage()` helper at `src/utils/errors.ts`; `colorValidation.ts` — relevant for Phase 8 (DIR-09), not this phase
- `.planning/phases/04-ux-enhancements/04-CONTEXT.md` — `MarkdownView` import in `CalendarView.ts`, `requestAnimationFrame` use for `setCursor` — Phase 7 will revisit these (DIR-06: `activeWindow` adoption) — Phase 5 must NOT lint-block them now

### Repository files Phase 5 will touch
- `manifest.json` — DIR-11; single-character change to the `description` value
- `.github/workflows/release.yml` — DIR-12; add `actions/attest-build-provenance@v2` step, expand `permissions`, leave the rest of the publish flow intact
- `.github/workflows/lint.yml` — DOC-01; **new file**
- `eslint.config.mjs` — DOC-01; **new file** (flat config)
- `package.json` — DOC-01; add `lint` and `lint:fix` scripts; refresh `eslint` + `@typescript-eslint/*` devDependencies to current; add `eslint-plugin-obsidianmd`

### Project rules
- `CLAUDE.md` — Obsidian plugin best practices, BRAT release strategy, **commit message hygiene** (NO Claude / AI references in commits or release notes); "High Priority Issues" TODO list overlaps DOC-01 rule selection — Phase 5 enforces the rules; Phases 6–8 fix the violations

### External docs (researcher MUST consult at planning time)
- ESLint 9 flat-config docs — `eslint.config.mjs` shape, `parserOptions.project` vs `projectService` for @typescript-eslint 8
- `eslint-plugin-obsidianmd` README / rule index — current version, rule names, peer-dep constraints
- `actions/attest-build-provenance@v2` action README — required permissions, `subject-path` syntax, `gh attestation verify --owner` semantics
- `@typescript-eslint` v8 docs — type-aware rule list, performance recommendations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`package.json` scripts shape** — three existing scripts (`dev`, `build`, `version`); pattern is short string commands without `&&`-chaining for separate concerns. New `lint` / `lint:fix` slot in naturally.
- **`.github/workflows/` directory exists** with three Claude-related workflow files; adding a new `lint.yml` follows the same `actions/checkout@v3` + `actions/setup-node@v3` pattern (planner may bump to `@v4` / Node 20 if drift is worth a side-fix).
- **`tsconfig.json` exists** with `strictNullChecks: true`, `noImplicitAny: true`, `moduleResolution: node`, `target: ES6`, `module: ESNext` — flat-config `parserOptions.project: ./tsconfig.json` is a one-line pointer.
- **`version-bump.mjs`** is already ESM (`.mjs`); `esbuild.config.mjs` is already ESM — flat config in `eslint.config.mjs` matches the project's existing module style.

### Established Patterns

- **No CI on push/PR for code today** — only Claude workflows fire (`claude-code-review.yml` is `on: pull_request_review_comment`, etc.). Phase 5's `lint.yml` becomes the first true CI gate. Planner makes sure the new workflow does NOT fire on Claude-internal events (use simple `on: [push, pull_request]`).
- **No tests / no test runner** — `package.json` has no `test` script; `tsc -noEmit` in `build` is the only static-correctness check today. Phase 5 doesn't add tests; it adds lint as a sibling static check.
- **Single-step builds** — esbuild is invoked directly; no Gulp/webpack/lint-staged wrappers. Lint stays a direct `eslint` invocation; no `husky` / `lint-staged` setup this phase.

### Integration Points

- **`release.yml` publish step** is the integration site for DIR-12 — the attestation action runs after the build outputs (`main.js`, plus copied `manifest.json` / `styles.css`) exist on disk and before `gh release create` references them.
- **`package.json` devDependencies** is the integration site for the toolchain upgrade — `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` go from 5.29.0 → 8.x; `eslint` is added; `eslint-plugin-obsidianmd` is added.
- **`eslint.config.mjs` `files` globs** are the integration site for the override blocks — every glob must match real paths in `src/` exactly; planner runs `eslint src/ --no-eslintrc --config <new-config>` against the starting tree as a dry-run before locking the override blocks.

</code_context>

<specifics>
## Specific Ideas

- **DIR-11 is genuinely one character.** Acceptance is byte-equality: the `description` JSON value MUST end with `.`, `!`, or `?`. Planner uses a period. No JSON re-formatting (current file uses tabs — preserve).
- **`actions/attest-build-provenance@v2` is the modern standard** (post-2024 GA). Older `actions/attest@v1` exists but is less recognizable for community-plugin reviewers. Researcher confirms `@v2` is the current major as of 2026.
- **`eslint-plugin-obsidianmd` is the expected source for Obsidian-specific rules.** If researcher discovers the plugin name has changed (e.g., `eslint-plugin-obsidian` vs `eslint-plugin-obsidianmd`) or that maintenance has shifted, the decision shape stays the same: prefer a maintained community plugin to hand-rolled `no-restricted-syntax` selectors. Hand-rolled only as fallback for genuine gaps.
- **Per-rule overrides MUST carry a comment naming the future phase that will remove them** (ROADMAP success criterion #3). Planner formats this as a leading `//` comment immediately above each `overrides[]` entry — readable in `eslint.config.mjs`, greppable, and the comment travels in the diff when the block is removed in Phase 6/7/8.
- **The pre-release test tag (D-10) is essential, not optional.** DIR-12 acceptance explicitly says "verified by inspecting the workflow YAML **and** the next pre-release output". Without an actual attested artifact, DIR-12 is half-acceptable. The phase doesn't ship until `gh attestation verify` passes against all three assets of the test tag.
- **`gh attestation verify` requires `--owner formax68`** (the GitHub user — per `gitStatus` config). Researcher confirms whether the `--repo formax68/memoChron` form is needed for private/forked-context verification; for public repos `--owner` alone is sufficient.
- **No accessibility, no test scaffolding, no perf work in this phase.** These are explicit Out of Scope and must not slip in via ESLint config (e.g., do NOT enable `jsx-a11y` even if obsidian-plugin community recommends it — that's QA-02 territory and would generate ~100 violations across the view layer that Phase 5 has no budget to override).

</specifics>

<deferred>
## Deferred Ideas

- **JSON lint for `manifest.json` punctuation enforcement** — could install `eslint-plugin-jsonc` with a `terminal-punctuation` rule to lint-catch DIR-11 regression. Skipped because the single field that needs checking is more cheaply caught by a one-line `grep` in a smoke test, and adding a JSON-lint plugin pulls in additional dependencies for marginal value. If the description ever regresses, Obsidian's own community-plugin Review will flag it again.
- **Branch protection rules / required status checks** on `main` — out of scope (a GitHub repo-settings concern, not a codebase concern). User can wire `lint.yml` as a required check on `main` after Phase 5 ships if desired.
- **SBOM attestation (`actions/attest-sbom`)** — DIR-12 wording is satisfied by build-provenance alone. SBOM attestation is a supply-chain hardening step that may matter for v2+ but not for the directory scorecard. Add later if the scorecard or downstream users explicitly request.
- **`husky` / `lint-staged` pre-commit hooks** — out of scope. CI gate is sufficient. Local pre-commit is a developer-ergonomics question that deserves its own decision.
- **Bumping `actions/setup-node` from `@v3` to `@v4` + Node 18 → Node 20** in `release.yml` — adjacent improvement; planner may bundle if cheap, but it's not a Phase 5 acceptance criterion.
- **Adding `npm run typecheck` as a separate script** (= `tsc -noEmit -skipLibCheck`) — would let CI run lint and typecheck independently of the bundler step. Sensible but not strictly required by Phase 5; planner may add if cost is one line.
- **DIR-01 / DIR-02..DIR-10 actual code changes** — by design, these violations are silenced behind named-phase overrides this phase. Phases 6/7/8 fix them. The whole point of "guardrails first" is that the rules are installed before the fixes.

</deferred>

---

*Phase: 05-guardrails-trivial-fixes*
*Context gathered: 2026-05-13*
