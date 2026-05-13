# Phase 5: Guardrails & Trivial Fixes — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 5 (2 modify, 1 modify-trivial, 2 new)
**Analogs found:** 5 / 5 (all five have strong in-tree analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `manifest.json` (modify, 1-char) | config (plugin manifest) | static-config | `manifest.json` itself (self-modify) + `version-bump.mjs` (only other writer) | exact |
| `.github/workflows/release.yml` (modify) | CI workflow (release) | event-driven (tag push) | `.github/workflows/release.yml` (in-place edit) + `.github/workflows/claude.yml` (only existing workflow with `id-token: write` — permissions reference) | exact |
| `.github/workflows/lint.yml` (new) | CI workflow (lint gate) | event-driven (push/PR) | `.github/workflows/release.yml` (only "real CI" workflow in repo — shape donor) | role-match (no existing push/PR-triggered lint workflow) |
| `eslint.config.mjs` (new) | tooling config (ESM) | static-config | `esbuild.config.mjs` + `version-bump.mjs` (the only two existing `.mjs` files — ESM style donor) | role-match (no existing lint config) |
| `package.json` (modify scripts + devDeps) | tooling config | static-config | `package.json` itself (current `scripts` block + `devDependencies` block) | exact |

---

## Pattern Assignments

### `manifest.json` (DIR-11 — append `.` to `description`)

**Analog:** `manifest.json` itself (the file is its own analog — single-character edit).

**Why this is a pattern question at all:** `version-bump.mjs` re-writes `manifest.json` on every `npm version` invocation, so the planner must verify the bump script preserves any new punctuation.

**Current file** (`manifest.json:1-9`) — note **tab indentation**, no trailing newline issue, JSON keys in this exact order:

```json
{
	"id": "memochron",
	"name": "MemoChron",
	"version": "1.14.0",
	"minAppVersion": "1.8.9",
	"description": "Calendar integration and note creation with support for public iCalendar URLs",
	"author": "Michalis Efstratiadis",
	"isDesktopOnly": false
}
```

**Confirmed via `od -c`:** indentation is `\t` (single tab), not spaces. Preserve.

**Be careful — don't break this:**
- **Tabs, not spaces.** `version-bump.mjs:9` uses `JSON.stringify(manifest, null, "\t")` — if anyone hand-edits and saves with spaces, the next `npm version` will diff-noise the whole file. Preserve tab indentation in the DIR-11 edit.
- **`version-bump.mjs` only touches `version` (line 8) and writes to `versions.json` (lines 12–14).** It does NOT touch `description`. Confirmed — DIR-11's punctuation is durable across future `npm version` runs. RESEARCH.md §9.11 also confirms this.
- **Key order matters for diff hygiene, not for correctness.** Obsidian parses by key, but `version-bump.mjs`'s `JSON.stringify(manifest, ...)` preserves key insertion order of the parsed object — i.e. whatever order is currently in the file. Don't reorder.
- **Only `manifest.json` needs the `.`** — `package.json` has its own `description` ("Calendar integration and note creation plugin for Obsidian") which is a different field and is NOT in DIR-11's scope. CONTEXT.md D-08 explicitly says leave `package.json description` alone.

---

### `.github/workflows/release.yml` (DIR-12 — add attestation step + expand `permissions:`)

**Analog:** `release.yml` itself (in-place edit) **plus** `.github/workflows/claude.yml:21-26` for the multi-line `permissions:` block shape (the only other workflow in the repo that already uses `id-token: write`).

**Current file** (`release.yml:1-36`) — the entire file is short; new step inserts between `Build plugin` and `Create release`:

```yaml
name: Release Obsidian plugin

on:
  push:
    tags:
      - "*"

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18.x"

      - name: Build plugin
        run: |
          npm install
          npm run build

      - name: Create release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          tag="${GITHUB_REF#refs/tags/}"

          gh release create "$tag" \
            --title="$tag" \
            --draft \
            main.js manifest.json styles.css
```

**Permissions-block shape donor** — `.github/workflows/claude.yml:21-26`:

```yaml
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
      actions: read # Required for Claude to read CI results on PRs
```

That's the only file in `.github/workflows/` that already declares `id-token: write` — use it as the indentation / formatting reference for the new permissions to add. Two-space indent, one entry per line, inline `#` comments allowed.

**Pattern to copy from RESEARCH.md §6.3** (researcher deviates from CONTEXT.md `@v2` → `@v3`, with explicit justification in §6.1):

```yaml
    permissions:
      contents: write
      id-token: write          # NEW — required by attest-build-provenance to mint OIDC token
      attestations: write      # NEW — required by attest-build-provenance to persist attestation
      artifact-metadata: write # NEW — required by v3+ for artifact metadata storage records
    steps:
      - uses: actions/checkout@v3   # preserve existing pin unless planner bundles the @v3→@v4 bump (see "Adjacent" below)
      # ...
      - name: Attest release artifacts
        uses: actions/attest-build-provenance@v3
        with:
          subject-path: |
            main.js
            manifest.json
            styles.css
      - name: Create release
        # ... unchanged
```

**Be careful — don't break this:**
- **Existing pins are `@v3`, not `@v4`** for both `actions/checkout` and `actions/setup-node`. Other workflows in this repo (`claude.yml:29`, `claude-code-review.yml:30`) already use `@v4`. RESEARCH.md §10 recommends `@v4` to match the obsidian-sample-plugin reference. CONTEXT.md `<deferred>` and §6.8 list this as Claude's discretion. **Researcher's note in §9 Q2 leans purist — do NOT bundle.** If the planner bundles the bump anyway, do it in a separate commit per D-11's commit granularity.
- **Node `18.x`** in `release.yml:19`. RESEARCH.md §1.2 confirms `eslint@9` + `typescript-eslint@8` work on Node `^18.18.0`, so the lint gate does NOT force a release-runtime Node bump. Leave Node 18.x alone (purist) — or bump to 20.x as a separate commit (pragmatic).
- **Step ordering is load-bearing.** Attestation step MUST come after `npm run build` (artifacts must exist on disk to hash) and SHOULD come before `gh release create` (sidesteps the "immutable releases" timing edge case — RESEARCH.md §6.4, §9.5). Do not reorder.
- **`--draft` is preserved.** RESEARCH.md §6.4 and §9.5 confirm attestation is anchored to the artifact's SHA-256 digest, not the release's published state. Draft releases pass `gh attestation verify` once the assets are downloaded.
- **`subject-path: |` newline list, not separate steps per file.** RESEARCH.md §6.5 and §9.6 — one multi-subject attestation, not three. Three separate attestation steps would create three competing attestations and complicate `gh attestation verify`.
- **CONTEXT.md says `@v2`; researcher upgraded to `@v3`.** Planner must keep the upgrade justification in either the commit message body or a YAML comment — this is the kind of "deviation from locked decision" that needs a written reason for downstream reviewers.

---

### `.github/workflows/lint.yml` (new — DOC-01 CI gate)

**Analog:** `release.yml:1-35` (workflow shape — `name:` / `on:` / `jobs.build.runs-on` / `steps:` style + the `actions/checkout@v3` and `actions/setup-node@v3` pins).

**Why `release.yml` and not the Claude workflows:** the Claude workflows fire on Claude-specific events (`issue_comment`, `pull_request_review_comment`, `pull_request_review`) and are gated behind `if: contains(...@claude...)` — wrong template for a "fires on every push/PR" lint gate. CONTEXT.md `<code_context>` explicitly says: *"Planner makes sure the new workflow does NOT fire on Claude-internal events (use simple `on: [push, pull_request]`)."*

**Copy from RESEARCH.md §5.1** (sourced from `obsidianmd/obsidian-sample-plugin`):

```yaml
name: Lint

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  lint:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x, 22.x]

    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
```

**Be careful — don't break this:**
- **In-repo `release.yml` pins `@v3`, sample-plugin lint.yml pins `@v4`.** Choose one and be consistent within `lint.yml`. RESEARCH.md §5.2 recommends `@v4` (matches sample plugin). Decoupled from the `release.yml` Node-bump question — `lint.yml` is a brand-new file, no prior-art drift to preserve.
- **Node matrix vs single-job** — CONTEXT.md D-06 says "Node 20.x" (single version). RESEARCH.md §5.2 recommends a `[20.x, 22.x]` matrix to mirror the sample plugin and catch Node-version drift. **CONTEXT.md `<decisions>` Claude's Discretion lists this** ("Node 18 vs Node 20"). Planner picks; if single, use Node 20.x.
- **`cache: 'npm'` auto-detects `package-lock.json`.** This repo has a `package-lock.json` (per STACK.md). No extra config needed.
- **Trigger gating** — `on: { push: { branches: ['**'] }, pull_request: { branches: ['**'] } }` lints every branch push and every PR. CONTEXT.md D-06 says "all branches" — this matches. Do NOT add `if:` gating; this is a true CI gate, not a Claude-event-gated workflow.
- **`npm ci`, not `npm install`.** `release.yml:23` uses `npm install`; `lint.yml` should use `npm ci` (CI-mode, respects lockfile exactly, faster). RESEARCH.md §5.1.
- **Plain `npm run lint` exit code is the gate.** ESLint exits non-zero on any rule failure by default; no `--max-warnings 0` flag needed because the recommended config emits the rules we care about at `error` severity. RESEARCH.md §5.2 last bullet.
- **Do NOT add `npm run build`** to `lint.yml`. CONTEXT.md D-05 and §5.3 are explicit: lint is a separate gate from build. Adding build here would duplicate `release.yml`'s build minus the actual release.

---

### `eslint.config.mjs` (new — DOC-01)

**Analog:** `esbuild.config.mjs:1-49` + `version-bump.mjs:1-15` — the only two `.mjs` files in the repo. Together they define the project's ESM-config-file conventions.

**Pattern from `esbuild.config.mjs:1-3` (import style):**

```js
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
```

**Pattern from `version-bump.mjs:1`:**

```js
import { readFileSync, writeFileSync } from "fs";
```

**Conventions to mirror:**
- **Double-quoted import paths** (matches both `.mjs` files and matches `src/` TypeScript convention).
- **2-space indentation** (`esbuild.config.mjs` uses 2 spaces — confirmed via `od -c` equivalent inspection; the project tsconfig also implies 2-space style).
- **Top-level `export default ...`** — `esbuild.config.mjs` uses top-level await + `await context.watch();` pattern; `eslint.config.mjs` uses `export default tseslint.config(...)` (RESEARCH.md §4.1) which matches the same "ESM module, top-level statement" idiom.
- **Trailing commas on multi-line objects/arrays** — confirmed in `esbuild.config.mjs:14-42` (the `context()` config object).
- **No semicolons-at-EOF strict policy either way** — `esbuild.config.mjs` uses semicolons consistently. Match it.
- **Comments use `//` line-comments**, no `/* block */`. Matches CLAUDE.md "Comments" convention.

**Copy whole skeleton from RESEARCH.md §4.1** — it is already adapted to MemoChron's structure. The skeleton:
1. Imports `tseslint`, `obsidianmd`, `globals`, `globalIgnores` (top-level ESM imports — same style as `esbuild.config.mjs`).
2. `export default tseslint.config(...)` — matches `esbuild.config.mjs`'s top-level export idiom.
3. `parserOptions.projectService` with `allowDefaultProject: ['eslint.config.mjs', 'manifest.json']` and `tsconfigRootDir: import.meta.dirname` — RESEARCH.md §2.1, §2.5.
4. Spread of `obsidianmd.configs.recommended` (brings @typescript-eslint recommended-type-checked + no-unsanitized + Microsoft SDL rules + 26 `obsidianmd/*` rules).
5. Three phase-tagged sibling config objects: Phase 6 (DIR-02/03/04 — DOM-API), Phase 7 (DIR-05/06/07/08 — lifecycle/promise/cast), Phase 8 (DIR-01/09/10 — type-hygiene + console).
6. `globalIgnores([...])` final entry with `esbuild.config.mjs` and `version-bump.mjs` ignored (matches RESEARCH.md §2.4 recommendation).

**File-to-rule mapping for the override-block globs (CONTEXT.md D-04, ROADMAP success criterion #3 — comment MUST name the phase that will remove the block):**

Based on a grep of the current tree:

| Phase | Rule(s) silenced | Files that hit the rule today |
|-------|------------------|-------------------------------|
| **Phase 6** (DIR-02 — `no-inner-html` / `no-unsanitized/property`) | `@microsoft/sdl/no-inner-html`, `no-unsanitized/property` | `src/settings/SettingsTab.ts` (lines 1879, 1896, 1917, 1918, 1919 — five `innerHTML =` writes) |
| **Phase 6** (DIR-04 — `document.createElement` / custom `no-restricted-syntax`) | `no-restricted-syntax` | `src/settings/SettingsTab.ts` (lines 649, 732 — `document.createElement("input")`; the `createElementNS` calls at 560, 565, 583 are NOT caught by the selector — it matches `createElement` only) |
| **Phase 6** (DIR-03 — `no-static-styles-assignment`) | `obsidianmd/no-static-styles-assignment` | `src/settings/SettingsTab.ts` heavily (~25 hits clustered around lines 225, 301-303, 314-315, 614, 645-661 — color picker and error styling) |
| **Phase 7** (DIR-05 — `as TFile` cast) | `obsidianmd/no-tfile-tfolder-cast` | `src/views/CalendarView.ts:147` |
| **Phase 7** (DIR-06 — `prefer-window-timers` / `prefer-active-doc`) | `obsidianmd/prefer-window-timers`, `obsidianmd/prefer-active-doc` | `src/main.ts:202` (`window.setInterval`), `src/main.ts:227` (`window.setTimeout`), `src/views/CalendarView.ts:78` (`window.setTimeout`), `src/settings/SettingsTab.ts:1408, 1809` (bare `setTimeout`) |
| **Phase 7** (DIR-07/08 — `no-floating-promises` / `no-misused-promises`) | `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises` | requires dry-run to enumerate — `src/main.ts`, `src/views/CalendarView.ts`, `src/services/CalendarService.ts` are the likely hotspots |
| **Phase 8** (DIR-01 — `no-console`) | `obsidianmd/rule-custom-message` (off), `no-console` (left off — Phase 8 re-tightens) | 39 `console.*` calls across `src/` — every file under `src/services/`, `src/views/`, `src/utils/timezoneUtils.ts`, `src/main.ts`, `src/settings/SettingsTab.ts` |
| **Phase 8** (DIR-09 — `no-explicit-any`) | `@typescript-eslint/no-explicit-any` + unsafe-* | `src/types/ical.d.ts` (6 `: any` / `any[]`), `src/views/CalendarView.ts:160`, `src/views/EmbeddedAgendaView.ts:365`, `src/views/EmbeddedCalendarView.ts:211` (all `(window as any).moment`), `src/settings/SettingsTab.ts:1198` (`event: any`) |
| **Phase 8** (DIR-10 — `no-unused-vars`) | `@typescript-eslint/no-unused-vars` | requires dry-run |

This map should let the planner write the smallest workable globs in the override blocks rather than `src/**/*.ts` everywhere. Concretely:
- Phase 6 override block's `files` glob can be **just `src/settings/SettingsTab.ts`** for the inner-html / inline-style / `document.createElement` rules — none of the other files trip them based on grep. RESEARCH.md §4.1 has it broader (`['src/views/...', 'src/utils/viewRenderers.ts', 'src/settings/SettingsTab.ts']`) as a defensive guess; the planner's dry-run will narrow.
- Phase 7 override block needs `src/main.ts`, `src/views/CalendarView.ts`, possibly `src/settings/SettingsTab.ts` (for `setTimeout`), plus any service files the dry-run surfaces for floating-promises.
- Phase 8 override block stays broad (`src/**/*.ts`) — `console.*` and `any` usage is genuinely scattered across the whole source tree.

**Be careful — don't break this:**
- **`projectService: true` (or `projectService: { allowDefaultProject: [...] }`) — NOT `project: './tsconfig.json'`.** CONTEXT.md D-03 says "researcher picks". RESEARCH.md §2.1 confirms `projectService` is the modern @typescript-eslint v8 idiom.
- **`tsconfigRootDir: import.meta.dirname`** is required when the config file is invoked from a subdir (belt-and-suspenders). Pattern from RESEARCH.md §2.5.
- **`extraFileExtensions: ['.json']`** is required for the recommended config's `validate-manifest` rule. Do NOT remove it. RESEARCH.md §9.10.
- **The Phase 5 tightening block** (`@typescript-eslint/no-unused-vars: ['error', { args: 'none' }]` and the `no-restricted-syntax` selector for `document.createElement`) must sit AFTER `...obsidianmd.configs.recommended` and BEFORE the phase-suppression blocks. Order matters in flat config — later wins. RESEARCH.md §4.1.
- **Each phase block needs the `// Phase N — DIR-XX will remove this when ...` comment immediately above it.** ROADMAP success criterion #3 / CONTEXT.md `<specifics>`. Make the comments greppable and self-explanatory.
- **`globalIgnores([...])` includes `node_modules`, `main.js`, `esbuild.config.mjs`, `version-bump.mjs`, `versions.json`.** RESEARCH.md §4.1. These are stable build glue / generated output — never lint them.
- **TS bump is a Phase 5 dep** — RESEARCH.md §1.1 + §9.1: `typescript-eslint@8` peer-requires `typescript >=4.8.4 <6.1.0`, current is `4.7.4`. The bump to `^5.9.3` is part of THIS phase's `package.json` change. Without it, `npx eslint .` fails at runtime with a peer-version error. Planner should run `npx tsc -noEmit -skipLibCheck` first to isolate TS upgrade fallout from ESLint config fallout (RESEARCH.md §11 Q1).

---

### `package.json` (DOC-01 — add scripts + refresh devDeps)

**Analog:** `package.json` itself (in-place edit). The existing `scripts` block and `devDependencies` block define the file's own conventions.

**Current `scripts` block** (`package.json:6-10`):

```json
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "version": "node version-bump.mjs && git add manifest.json versions.json"
  },
```

**Conventions to mirror:**
- **2-space indentation** for JSON (confirmed in `package.json`). Note this is DIFFERENT from `manifest.json` (tabs). Do not unify them.
- **Single-string scripts.** Existing scripts are short shell strings. Some chain with `&&` (`build`, `version`) — `&&` is fine when the chain is genuinely sequential. CONTEXT.md `<code_context>` says "no `&&`-chaining for separate concerns" — `lint` is a separate concern from `build`, so don't chain them. New scripts:
  ```json
  "lint": "eslint src/",
  "lint:fix": "eslint src/ --fix"
  ```
  RESEARCH.md §10 confirms `eslint src/` (matching CONTEXT.md D-05) over `eslint .` (matching sample plugin). Both work; `src/` is more explicit and decouples from `globalIgnores` correctness.
- **Trailing comma policy in JSON** — JSON does NOT allow trailing commas. The current file does not have any, and standard JSON parsers (used by `npm`) reject them. Be careful when inserting new entries that the comma after the last existing entry is added.
- **Insertion point for new scripts** — after `"version"` script. Final order: `dev`, `build`, `version`, `lint`, `lint:fix`. (No strong convention either way; this order keeps the build-flow scripts grouped above the dev-tooling scripts.)

**Current `devDependencies` block** (`package.json:19-29`):

```json
  "devDependencies": {
    "@types/luxon": "^3.6.2",
    "@types/node": "^16.11.6",
    "@typescript-eslint/eslint-plugin": "5.29.0",
    "@typescript-eslint/parser": "5.29.0",
    "builtin-modules": "3.3.0",
    "esbuild": "0.17.3",
    "obsidian": "latest",
    "tslib": "2.4.0",
    "typescript": "4.7.4"
  },
```

**Conventions to mirror:**
- **Alphabetical key order** within the block (confirmed — `@types/*` first by ASCII sort, then `@typescript-eslint/*`, then plain names).
- **Mixed pin style** — some entries use `^` (caret range), some use exact pins (`5.29.0`, `3.3.0`, `0.17.3`, `2.4.0`, `4.7.4`, `latest`). The existing file is not consistent. RESEARCH.md §10 recommends caret ranges for the new entries (`^9.39.4`, `^8.59.3`, `^0.3.0`, `^14.0.0`, `^5.9.3`). Use caret ranges for the new entries — that's the safer convention and matches what most of the JS ecosystem expects.

**Changes required** (consolidating RESEARCH.md §1.1 and §10):

| Action | Entry |
|--------|-------|
| **Remove** | `"@typescript-eslint/eslint-plugin": "5.29.0"` |
| **Remove** | `"@typescript-eslint/parser": "5.29.0"` |
| **Bump** | `"typescript": "4.7.4"` → `"typescript": "^5.9.3"` |
| **Add** | `"eslint": "^9.39.4"` |
| **Add** | `"typescript-eslint": "^8.59.3"` (meta package — re-exports parser + plugin + configs + `tseslint.config()` helper) |
| **Add** | `"eslint-plugin-obsidianmd": "^0.3.0"` |
| **Add** | `"globals": "^14.0.0"` |

**Be careful — don't break this:**
- **`package-lock.json` regenerates on `npm install`.** Plan the lockfile update as part of the same commit. CONTEXT.md `<integration_points>` lists this as the integration site for the toolchain upgrade.
- **`typescript@5.x` is a real breaking-change risk** — RESEARCH.md §9.1 and §11 Open Question 1. Planner should run `npm install typescript@5.9.3 && npx tsc -noEmit -skipLibCheck` BEFORE installing the ESLint deps, to isolate type-checker fallout from lint fallout. If `tsc` finds new errors, fix or silence in this phase (don't push to Phase 8).
- **DO NOT add `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` separately at v8.** The `typescript-eslint` meta package re-exports them — adding them separately wastes lockfile slots and risks version skew. RESEARCH.md §1.1 last paragraph.
- **DO NOT add `eslint-plugin-no-unsanitized` or `@microsoft/eslint-plugin-sdl` as direct devDependencies.** `eslint-plugin-obsidianmd@0.3.0` pulls them in as **direct dependencies** (not peers) — they install automatically and the recommended config wires them up. RESEARCH.md §1.2 last row + §3.3.
- **`"author": ""` is currently empty** in `package.json:17`. RESEARCH.md §11 Q3 flags this as something `obsidianmd/validate-manifest` MAY flag during dry-run. Out of Phase 5 strict scope (validate-manifest checks `manifest.json`, not `package.json`); flag for awareness only.
- **Do NOT add `"test"` or `"typecheck"` scripts.** CONTEXT.md `<deferred>` flags `npm run typecheck` as out-of-scope (planner's discretion). Tests are explicitly Out of Scope for v1.15.
- **`obsidian: "latest"` floating pin** is a pre-existing wart. Leave it alone — out of scope.

---

## Shared Patterns

### Tab vs Space Indentation Policy

**Source:** `manifest.json` (tabs) vs `package.json` (2 spaces) vs `tsconfig.json` (2 spaces) vs `.mjs` files (2 spaces) vs `.yml` files (2 spaces) vs `src/**/*.ts` (2 spaces).

**Apply to:** Every file Phase 5 touches.

| File | Indent |
|------|--------|
| `manifest.json` | TAB (preserve — written by `version-bump.mjs:9` as `JSON.stringify(..., null, "\t")`) |
| `package.json` | 2 spaces |
| `eslint.config.mjs` | 2 spaces (matches `esbuild.config.mjs`) |
| `.github/workflows/lint.yml` | 2 spaces (YAML standard; matches existing workflows) |
| `.github/workflows/release.yml` | 2 spaces (preserve existing) |

A single-character DIR-11 edit that flips indentation would be a noisy diff. Don't.

### Commit-Message Hygiene

**Source:** `CLAUDE.md` "Memory Reminders" + git log convention.

**Apply to:** All four Phase 5 commits (per D-11) AND the test pre-release notes (per RESEARCH.md "Project Constraints").

- No "Claude", "AI", "AI-assisted", "Generated with..." references anywhere in the commit message, PR description, or release notes
- Recent commit titles (verified via `git log`) follow `docs(state): ...` / `docs(05): ...` / `docs: ...` style — short conventional-commit prefixes, lowercase verbs
- CONTEXT.md D-11 illustrative titles match this: `fix(manifest): ...`, `ci(release): ...`, `chore(lint): ...`, `chore(release): ...`

### Workflow File Conventions

**Source:** `.github/workflows/release.yml:1-35` (the only existing real-CI workflow).

**Apply to:** `lint.yml` (new) and `release.yml` (modified).

- `name:` on first line, blank line after
- `on:` block, blank line after
- `jobs:` block with single job (matches both existing workflows)
- `runs-on: ubuntu-latest`
- `permissions:` listed line-by-line (matches both `release.yml:11-12` and `claude.yml:21-26`)
- Two-space indent throughout
- Multi-line shell scripts use `run: |` (YAML literal block) — matches `release.yml:21-24, 28-35`
- Single-line shell uses `run: <command>` — matches sample-plugin pattern

### ESM Configuration File Style

**Source:** `esbuild.config.mjs:1-3`, `version-bump.mjs:1`.

**Apply to:** `eslint.config.mjs`.

```js
import tseslint from "typescript-eslint";        // double-quoted import paths
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(                 // top-level default export
  // ... 2-space indented body
);
```

(RESEARCH.md §4.1 uses single-quoted import paths — planner converts to double quotes to match in-repo convention. Functionally identical; ESM doesn't care; the project's two existing `.mjs` files both use double quotes.)

---

## No Analog Found

No files in this phase fall into this category. All five files have at least a role-matched analog in the existing codebase.

---

## Metadata

**Analog search scope:**
- `/Users/mike/code/memoChron/.github/workflows/` (3 files — full read)
- `/Users/mike/code/memoChron/` root (`manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `version-bump.mjs`, `versions.json`)
- `/Users/mike/code/memoChron/src/**/*.ts` (grep-only — for Phase 6/7/8 override-glob mapping)

**Files scanned (full read):** 9
- 3 workflow files
- `manifest.json`, `package.json`, `tsconfig.json`
- `esbuild.config.mjs`, `version-bump.mjs`, `versions.json`

**Files scanned (grep-only):** all `src/**/*.ts` for `console.*`, `innerHTML`, `\.style\.`, `as TFile`, `registerView`, `setTimeout`, `setInterval`, `document\.createElement`, `: any` / `as any` patterns.

**Pattern extraction date:** 2026-05-13
