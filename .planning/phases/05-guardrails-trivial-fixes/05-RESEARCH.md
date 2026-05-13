# Phase 5: Guardrails & Trivial Fixes — Research

**Researched:** 2026-05-13
**Domain:** ESLint 9/10 flat-config, type-aware lint via `@typescript-eslint` v8, `eslint-plugin-obsidianmd`, GitHub Actions `attest-build-provenance`, `gh attestation verify`
**Confidence:** HIGH (versions and APIs verified directly from npm registry, GitHub release API, and the official `obsidian-sample-plugin` reference)

## Summary

The current modern Obsidian-plugin lint stack is `eslint` + `typescript-eslint` (meta package) + `eslint-plugin-obsidianmd`, configured with `tseslint.config(...)` in a flat-config `.mjs` file. The official `obsidian-sample-plugin` ships this exact stack — it is the single best reference implementation. The recommended config from `eslint-plugin-obsidianmd@0.3.0` is **already** type-aware (it extends `tseslint.configs.recommendedTypeChecked` and `eslint-plugin-no-unsanitized`'s recommended config), so most of DOC-01's required rules come for free; the planner mostly needs to tighten `no-console` (the plugin's recommended config allows `warn`/`error`/`debug`, DOC-01 wants none) and pin `no-unused-vars` to `error`.

For DIR-12, `actions/attest-build-provenance` is on **v4 (current major, Feb 2026)** — not v2 as CONTEXT.md anticipated. The action accepts a `subject-path` newline-list and emits a single multi-subject attestation. The action is now a thin wrapper around `actions/attest`; for stability we pin **`@v3` (v3.2.0, Jan 2026)** since v4's only change is the wrapper indirection and v3 is more widely documented in the wild.

**Primary recommendation:** Use the `obsidian-sample-plugin` `eslint.config.mts` as the structural template, adapted to `.mjs` (we keep our codebase out of jiti's path). Pin `eslint@^9.39.4` (the maintenance line — strictly safer than the `latest@10.3.0` which has a Node `>=20.19` floor), `typescript-eslint@^8.59.3`, `eslint-plugin-obsidianmd@^0.3.0`, and bump our `typescript` from `4.7.4` to `^5.9.3` (typescript-eslint v8 requires `>=4.8.4 <6.1.0`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lint rule enforcement (local) | Build tooling (`eslint` CLI) | — | Runs against `src/` from `package.json` script; no runtime impact |
| Lint rule enforcement (CI) | GitHub Actions (`lint.yml`) | — | Identical invocation in the cloud, gates merge |
| Release artifact attestation | GitHub Actions (`release.yml`) | GitHub attestations API | Action runs at build time on the runner; attestation persists in GitHub's transparency log |
| Attestation verification | `gh` CLI (post-release) | Sigstore | Run by human reviewer or by Obsidian-side scripts against the public release |
| `manifest.json` description | Source file (DIR-11) | — | Byte-level change; no build/runtime interaction |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIR-11 | `manifest.json` `description` ends with `.`, `!`, or `?` | §6.2 — one-character append |
| DIR-12 | Release workflow attaches GitHub artifact attestation to every release asset | §6 (action), §7 (test pre-release), §8 (`gh attestation verify`) |
| DOC-01 | ESLint config enforces required rule list; `npm run lint` exists; CI runs lint; failing lint blocks build; per-rule overrides comment-tagged by future phase | §1–§5 (toolchain, type-aware lint, plugin rules, config skeleton, CI workflow) |

## Project Constraints (from CLAUDE.md)

- **Commit hygiene:** No Claude/AI references in commit messages, PR descriptions, or release notes. **CRITICAL** — this includes the test pre-release notes for DIR-12.
- **Tech-stack lock:** TypeScript / esbuild / Obsidian API / `ical.js` / `luxon` — not up for re-evaluation. Phase 5 introduces ESLint and `eslint-plugin-obsidianmd`; both are dev-only and don't affect runtime.
- **Mobile + desktop compat:** `isDesktopOnly: false`, minAppVersion 1.8.9. Lint rules must not flag valid Obsidian-API usage. The `eslint-plugin-obsidianmd` recommended config registers `activeDocument`, `activeWindow`, `createEl`, `createDiv`, `createSpan`, `createFragment` as readonly globals — so they will NOT be flagged by `no-undef` even though they are Obsidian-injected.
- **BRAT compat:** Manifest version must match release tag exactly. Implication for §7: a test pre-release tag of `1.15.0-beta.1` requires bumping `package.json` + `manifest.json` to `1.15.0-beta.1` before tagging.
- **Project skills:** None registered (`.claude/skills/`, `.agents/skills/`, etc. absent).

## 1. ESLint 9 + @typescript-eslint 8 — Toolchain Versions

### 1.1 Pinned Versions (verified 2026-05-13 against npm registry)

| Package | Version | Why this pin |
|---------|---------|--------------|
| `eslint` | `^9.39.4` | `9.x` is the `maintenance` dist-tag; Node engine `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` matches CI Node 18.x/20.x. Choosing 9 over 10 avoids forcing a Node version bump in `release.yml` (Node 18.x → 20.19+). [VERIFIED: `npm view eslint dist-tags`] |
| `typescript-eslint` | `^8.59.3` | Meta package re-exporting `parser`, `eslint-plugin`, configs, and the `tseslint.config()` helper. Peer `eslint: ^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`. Peer `typescript: >=4.8.4 <6.1.0`. [VERIFIED: `npm view typescript-eslint peerDependencies`] |
| `eslint-plugin-obsidianmd` | `^0.3.0` | Published 2026-05-12 (the day this research ran). Maintained by `joethei` on behalf of the official `obsidianmd/eslint-plugin` repo. Peer `eslint: >=9.0.0`. [VERIFIED: `npm view eslint-plugin-obsidianmd`] |
| `typescript` | `^5.9.3` | Current `4.7.4` is **below** the `typescript-eslint@8` floor of `>=4.8.4`. Bumping to `^5.9.3` (latest in the 5.x series; TypeScript 6.0 is current latest but `<6.1.0` is the peer ceiling — 5.9 is the safer pin). [VERIFIED: `npm view typescript@5 version`] |
| `globals` | `^14.0.0` | Used by `obsidian-sample-plugin/eslint.config.mts`; matches the version bundled inside `eslint-plugin-obsidianmd`. [VERIFIED: `obsidian-sample-plugin/package.json`] |

**Packages to remove from `devDependencies`:**
- `@typescript-eslint/eslint-plugin` (5.29.0) — replaced by the `typescript-eslint` meta package
- `@typescript-eslint/parser` (5.29.0) — re-exported by the meta package

[CITED: https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/package.json]

### 1.2 Peer / Engine Constraints

| Constraint | Source | Impact |
|------------|--------|--------|
| `eslint@9` requires Node `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` | npm `engines` | Existing `release.yml` Node 18.x is fine; `lint.yml` Node 20.x is fine. |
| `eslint@10` requires Node `^20.19.0 \|\| ^22.13.0 \|\| >=24` | npm `engines` | If planner upgrades to ESLint 10, **Node 18.x in `release.yml` is no longer compatible**. CONTEXT.md lists this as Claude's discretion ("Node 18 vs Node 20") — sticking with ESLint 9 sidesteps the question. [VERIFIED: `npm view eslint@10.3.0 engines`] |
| `typescript-eslint@8` requires Node `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` | npm `engines` | Same as ESLint 9 — no conflict. |
| `typescript-eslint@8` requires `typescript: >=4.8.4 <6.1.0` | npm `peerDependencies` | **Hard blocker** — current TS 4.7.4 is below floor. Phase 5 MUST bump TS. |
| `eslint-plugin-obsidianmd@0.3.0` lists `eslint: >=9.0.0` and bundles `typescript-eslint: ^8.35.1`, `eslint-plugin-no-unsanitized: ^4.1.5`, `@microsoft/eslint-plugin-sdl: ^1.1.0`, `eslint-plugin-import: ^2.31.0`, `eslint-plugin-depend: 1.3.1` as **direct dependencies** (not peers) | unpacked `package.json` | The plugin self-contains its transitive ESLint plugins — we do NOT separately depend on `eslint-plugin-no-unsanitized` or `@microsoft/eslint-plugin-sdl`. They are pulled in automatically and the plugin's `recommended` config spreads their rules. |

### 1.3 Canonical Flat-Config Pattern

The `tseslint.config(...)` helper from the `typescript-eslint` meta package is the idiomatic flat-config wrapper — it gives type hints and accepts spread configs cleanly. The `obsidian-sample-plugin` uses exactly this pattern:

```js
// Source: https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/eslint.config.mts
import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
    {
        languageOptions: {
            globals: { ...globals.browser },
            parserOptions: {
                projectService: { allowDefaultProject: [...] },
                tsconfigRootDir: import.meta.dirname,
                extraFileExtensions: ['.json']
            },
        },
    },
    ...obsidianmd.configs.recommended,
    globalIgnores([ "node_modules", "main.js", ... ]),
);
```

## 2. Type-Aware Lint Idiom

### 2.1 `projectService: true` is the modern v8 idiom

[CITED: https://typescript-eslint.io/getting-started/typed-linting/] — *"`projectService: true` is the recommended option, with settings to customize TypeScript project information; `project` is described as an older option that can be used as an alternative."*

### 2.2 What `projectService` does
- Uses the same TypeScript project-service API that VS Code uses, so lint and editor see identical type info.
- Default values: `allowDefaultProject: []`, `defaultProject: 'tsconfig.json'`.
- `tsconfigRootDir: import.meta.dirname` pins the resolution base — required when the config file might be invoked from outside its own directory (best-practice belt-and-suspenders).

### 2.3 Performance on a ~30-file project
- typescript-eslint docs: *"For a 30-file codebase, type-aware linting should run roughly the same as your build times."* [CITED: https://typescript-eslint.io/troubleshooting/typed-linting/performance/]
- The current build is `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` — single-digit seconds. Type-aware lint is similar order.
- Critical caveat: maintain consistent `extraFileExtensions` across all matched files. Mixing different `extraFileExtensions` across project files causes TS-server reloads.

### 2.4 Out-of-project files (`esbuild.config.mjs`, `version-bump.mjs`)

These `.mjs` files are NOT included in `tsconfig.json` (which has `"include": ["**/*.ts"]`). Two options:

| Option | What | When |
|--------|------|------|
| **Recommended:** add to `globalIgnores([...])` | Skip them entirely — they are simple build scripts, no benefit from linting | First-pass; matches `obsidian-sample-plugin` |
| `allowDefaultProject: ['*.mjs']` (or specific names) | Lint them via the default project | Only if planner wants build-script lint coverage |

The sample plugin uses the first approach. We should too — `esbuild.config.mjs` and `version-bump.mjs` are stable build glue, not feature code.

### 2.5 Exact snippet for our project

```js
languageOptions: {
  globals: { ...globals.browser },
  parserOptions: {
    projectService: true,
    tsconfigRootDir: import.meta.dirname,
  },
},
```

We omit `extraFileExtensions: ['.json']` (the sample plugin uses it because their plugin lints `manifest.json` via `validate-manifest` — Phase 5 does NOT need JSON lint per CONTEXT.md `<deferred>`, but if we keep `obsidianmd.configs.recommended` we get `validate-manifest` anyway, and `extraFileExtensions: ['.json']` becomes necessary to avoid parser errors on `package.json`). **Decision:** Match sample plugin exactly — include `extraFileExtensions: ['.json']` and `allowDefaultProject: ['eslint.config.mjs', 'manifest.json']`. This is what the recommended config expects.

## 3. eslint-plugin-obsidianmd — Confirmed Rule Index

### 3.1 Package identity

| Property | Value | Source |
|----------|-------|--------|
| npm name | `eslint-plugin-obsidianmd` | [VERIFIED: npm registry] |
| GitHub repo | `obsidianmd/eslint-plugin` (the OFFICIAL Obsidian-owned repo; the `eslint-plugin-obsidianmd` npm package name is the publishing name) | [VERIFIED: `npm view eslint-plugin-obsidianmd repository`] |
| Maintainer | `joethei` (on behalf of `obsidianmd`) | [VERIFIED: `npm view`] |
| Current version | `0.3.0` | [VERIFIED: published 2026-05-12, the day before this research] |
| Peer | `eslint: >=9.0.0` (declared in `dependencies`, not `peerDependencies` — works the same way at install time) | [VERIFIED: unpacked tarball `package.json`] |

There is an **older, unofficial fork** at `mProjectsCode/eslint-plugin-obsidianmd` — do NOT use it. The npm name `eslint-plugin-obsidianmd` resolves to the official Obsidian-owned repo.

### 3.2 Complete rule index (from unpacked `0.3.0/dist/lib/index.js`)

Registered rules (36 total):

```
obsidianmd/commands/no-command-in-command-id
obsidianmd/commands/no-command-in-command-name
obsidianmd/commands/no-default-hotkeys
obsidianmd/commands/no-plugin-id-in-command-id
obsidianmd/commands/no-plugin-name-in-command-name
obsidianmd/settings-tab/no-manual-html-headings
obsidianmd/settings-tab/no-problematic-settings-headings
obsidianmd/vault/iterate
obsidianmd/detach-leaves
obsidianmd/editor-drop-paste
obsidianmd/hardcoded-config-path
obsidianmd/no-forbidden-elements
obsidianmd/no-global-this
obsidianmd/no-plugin-as-component
obsidianmd/no-sample-code
obsidianmd/no-tfile-tfolder-cast
obsidianmd/no-view-references-in-plugin
obsidianmd/no-static-styles-assignment
obsidianmd/object-assign
obsidianmd/platform
obsidianmd/prefer-abstract-input-suggest
obsidianmd/prefer-active-doc
obsidianmd/prefer-file-manager-trash-file
obsidianmd/prefer-instanceof
obsidianmd/prefer-window-timers
obsidianmd/prefer-get-language
obsidianmd/regex-lookbehind
obsidianmd/rule-custom-message
obsidianmd/sample-names
obsidianmd/validate-manifest
obsidianmd/validate-license
obsidianmd/no-unsupported-api
obsidianmd/ui/sentence-case
obsidianmd/ui/sentence-case-json (locales config only)
obsidianmd/ui/sentence-case-locale-module (locales config only)
```

**Note:** the `docs/rules/` folder on GitHub also documents `prefer-create-el`, but it is **NOT registered in 0.3.0**'s index. Treat `prefer-create-el` as unavailable in this release.

### 3.3 What `obsidianmd.configs.recommended` actually enables

The recommended config does FOUR things:
1. Spreads `js.configs.recommended` (ESLint built-ins).
2. Spreads `tseslint.configs.recommendedTypeChecked` (51 type-aware rules at error severity — including `no-floating-promises`, `no-explicit-any` (with `fixToUnknown: true`), `no-unused-vars`).
3. Spreads `eslint-plugin-no-unsanitized.configs.recommended` (Mozilla's `no-unsanitized/method` and `no-unsanitized/property` — these catch `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write`).
4. Adds Microsoft SDL rules: **`@microsoft/sdl/no-inner-html`** and `@microsoft/sdl/no-document-write` — both at `error`.
5. Enables all 26 `obsidianmd/*` rules listed in §3.2 at `error`, EXCEPT:
   - `obsidianmd/prefer-active-doc` is `warn` (not error)
   - `obsidianmd/prefer-file-manager-trash-file` is `warn` (not error)

It also tweaks the generic rules:
```
no-unused-vars: off
no-console: off (overridden by obsidianmd/rule-custom-message which allows warn/error/debug)
no-eval / no-implied-eval / no-implicit-globals / no-alert: error
@typescript-eslint/no-unused-vars: ["warn", { args: "none" }]
@typescript-eslint/no-explicit-any: ["error", { fixToUnknown: true }]
@typescript-eslint/no-deprecated: error
@typescript-eslint/ban-ts-comment: off
@typescript-eslint/require-await: off
```

It also registers Obsidian globals so `no-undef` doesn't flag them: `activeDocument`, `activeWindow`, `createDiv`, `createEl`, `createSpan`, `createSvg`, `createFragment`, `sleep`, `DomElementInfo`, `SvgElementInfo`, `ajax`, `ajaxPromise`, `fish`, `fishAll`, `isBoolean`, `nextFrame`, `ready`.

### 3.4 DOC-01 requirement → rule mapping

| DOC-01 requirement | Rule that satisfies it | Severity in `recommended` | Action needed |
|---|---|---|---|
| `no-console` (catch all console.*) | `no-console` (gated by `obsidianmd/rule-custom-message` to allow `warn`/`error`/`debug`) | `error` only on `log`/`info`/etc. | **Tighten:** override to `["error", { allow: [] }]` to satisfy DIR-01's stricter wording — OR keep loose for Phase 5 and tighten in Phase 8. CONTEXT.md says DIR-01 is Phase 8, so Phase 5 can **silence per-file** under the "Phase 8 — DIR-01" override block. |
| `no-inner-html` (catch innerHTML/outerHTML) | `@microsoft/sdl/no-inner-html` + `no-unsanitized/property` (catches `.innerHTML =` and `.outerHTML =`) | `error` | None — recommended config covers it. Phase 6 overrides need to silence both rule IDs. |
| Inline `element.style.*` ban | `obsidianmd/no-static-styles-assignment` | `error` | None. Phase 6 override needs to silence this. |
| `as TFile` ban | `obsidianmd/no-tfile-tfolder-cast` | `error` | None. Phase 7 override needs to silence this. |
| No view-instance assignment inside `registerView` | `obsidianmd/no-view-references-in-plugin` | `error` | None. Phase 7 override needs to silence this. |
| Popout-window helpers (`activeDocument`, `activeWindow.setTimeout`) | `obsidianmd/prefer-active-doc` + `obsidianmd/prefer-window-timers` | `warn` (active-doc) / `error` (window-timers) | Phase 7 override needs to silence `prefer-window-timers` for any current `setTimeout` calls. |
| `@typescript-eslint/no-floating-promises` | Included via `tseslint.configs.recommendedTypeChecked` | `error` | None. Phase 7 override needs to silence this for current floating promises. |
| `@typescript-eslint/no-explicit-any` | Same | `error` (with `fixToUnknown: true`) | None. Phase 8 override needs to silence this. |
| `@typescript-eslint/no-unused-vars` | Same recommended config, but downgraded to `["warn", { args: "none" }]` | `warn` | **Tighten:** override to `"error"` to satisfy DOC-01 wording, then Phase 8 globally silences via its override block before fixing in Phase 8. |
| `prefer-create-el` (DIR-04: no `document.createElement`) | **Not registered in 0.3.0** | n/a | **Hand-roll:** add a `no-restricted-syntax` selector or `no-restricted-globals: ['document']` won't work (document is rightly used). Use `no-restricted-syntax` with selector `CallExpression[callee.object.name='document'][callee.property.name='createElement']` — see §4.4. |

### 3.5 What's missing from the plugin that DIR-04 requires

DIR-04 demands "no `document.createElement(...)` and no string-literal HTML". The plugin does NOT include `prefer-create-el` in 0.3.0. Two paths:
- **(a)** Add a `no-restricted-syntax` selector in the project config for `document.createElement`.
- **(b)** Wait for `prefer-create-el` to be registered upstream and revisit in Phase 6.

CONTEXT.md `<decisions>` D-02 says *"If `eslint-plugin-obsidianmd` proves immature or lacks a specific rule, planner layers a hand-rolled `no-restricted-syntax` selector to fill the gap"*. **Recommendation:** add the selector in Phase 5 with a comment `// Phase 6 — DIR-04 will silence/remove this once createEl migration ships`. Severity: `error`. Selector:

```js
'no-restricted-syntax': ['error', {
  selector: "CallExpression[callee.object.name='document'][callee.property.name='createElement']",
  message: "DIR-04: Use Obsidian's createEl/createDiv/createSpan helpers instead of document.createElement.",
}],
```

## 4. ESLint Config File — Complete Worked Example

### 4.1 Recommended `eslint.config.mjs` skeleton

```js
// eslint.config.mjs — Phase 5 (DOC-01) — MemoChron v1.15 Directory Compliance
//
// This config enforces the directory-scorecard rule list. The per-file
// "override" blocks below silence findings that exist on the v1.15 starting
// tree; each block names the phase that will remove it. NO inline
// `eslint-disable` comments are used for scorecard violations — all
// suppression is here so the closing-phase diff is a single block delete.
//
// Sources:
//   https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/eslint.config.mts
//   https://typescript-eslint.io/getting-started/typed-linting/
//   https://github.com/obsidianmd/eslint-plugin

import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';

export default tseslint.config(
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs', 'manifest.json'],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.json'],
      },
    },
  },

  // Recommended config from eslint-plugin-obsidianmd brings:
  //   - @eslint/js recommended
  //   - typescript-eslint recommended-type-checked (51 rules incl.
  //     no-floating-promises, no-explicit-any, no-unused-vars)
  //   - eslint-plugin-no-unsanitized recommended (innerHTML / outerHTML)
  //   - @microsoft/sdl/no-inner-html + no-document-write
  //   - 26 obsidianmd/* rules (DOM, lifecycle, TFile, registerView, etc.)
  //   - Obsidian globals (createEl, activeDocument, activeWindow, ...)
  ...obsidianmd.configs.recommended,

  // Phase 5 tightens these defaults to satisfy DOC-01's wording:
  {
    files: ['src/**/*.ts'],
    rules: {
      // DOC-01 lists no-unused-vars explicitly; recommended config makes
      // it "warn" — bump to error so it actually blocks the build.
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],

      // DIR-04: catch `document.createElement` — the obsidianmd plugin
      // version 0.3.0 does NOT yet register `prefer-create-el`.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name='createElement']",
          message:
            "DIR-04: Use Obsidian's createEl/createDiv/createSpan helpers instead of document.createElement.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Phase 6 — DIR-02 / DIR-03 / DIR-04 will remove these when the DOM-API
  // refactor lands.
  // ---------------------------------------------------------------------------
  {
    files: [
      'src/views/CalendarView.ts',
      'src/views/EmbeddedCalendarView.ts',
      'src/views/EmbeddedAgendaView.ts',
      'src/settings/SettingsTab.ts',
      'src/utils/viewRenderers.ts',
    ],
    rules: {
      '@microsoft/sdl/no-inner-html': 'off',
      'no-unsanitized/property': 'off',
      'no-unsanitized/method': 'off',
      'obsidianmd/no-static-styles-assignment': 'off',
      'no-restricted-syntax': 'off', // disables our document.createElement check
    },
  },

  // ---------------------------------------------------------------------------
  // Phase 7 — DIR-05 / DIR-06 / DIR-07 / DIR-08 will remove these when the
  // lifecycle / compatibility cleanup lands.
  // ---------------------------------------------------------------------------
  {
    files: [
      'src/main.ts',
      'src/views/CalendarView.ts',
      'src/views/EmbeddedCalendarView.ts',
      'src/views/EmbeddedAgendaView.ts',
      'src/services/CalendarService.ts',
      'src/services/NoteService.ts',
    ],
    rules: {
      'obsidianmd/no-view-references-in-plugin': 'off',
      'obsidianmd/no-tfile-tfolder-cast': 'off',
      'obsidianmd/prefer-active-doc': 'off',
      'obsidianmd/prefer-window-timers': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },

  // ---------------------------------------------------------------------------
  // Phase 8 — DIR-01 / DIR-09 / DIR-10 will remove these when type-hygiene
  // and console-discipline land.
  // ---------------------------------------------------------------------------
  {
    files: ['src/**/*.ts'],
    rules: {
      // Recommended config gates no-console via obsidianmd/rule-custom-message
      // and ALLOWS console.warn/.error/.debug. DIR-01 wants ALL console.*
      // either removed or gated. Override `rule-custom-message` to no-op,
      // then enforce no-console: "error".
      'obsidianmd/rule-custom-message': 'off',
      'no-console': 'off', // Re-tightened in Phase 8 to "error"

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'no-case-declarations': 'off',
      'no-useless-escape': 'off',
    },
  },

  globalIgnores([
    'node_modules',
    'main.js',
    'esbuild.config.mjs',
    'version-bump.mjs',
    'versions.json',
  ]),
);
```

### 4.2 Flat config does NOT have `overrides[]`

Important convention point — **flat config uses sibling config objects with `files` globs**, NOT an `overrides[]` array (that was ESLint legacy `.eslintrc` syntax). CONTEXT.md D-04 writes "per-rule `overrides[]` blocks" colloquially; the actual flat-config equivalent is what's shown above — each comment-tagged sibling object IS the "override block." [CITED: https://eslint.org/docs/latest/use/configure/configuration-files]

### 4.3 Dry-run discovery (planner's task)

The planner MUST run `npx eslint src/` against the v1.15 starting tree once the config above is installed, then **adjust the `files` globs** per Phase based on actual violations. The skeleton above is researcher's best guess — exact globs need empirical confirmation. The planner's UAT step §13 in CONTEXT.md `<decisions>` D-13 includes this dry-run.

### 4.4 The `tseslint.configs.disableTypeChecked` workaround

The obsidianmd recommended config already includes a block that disables type-checked rules on `package.json` (parsed as JSON). If the planner sees errors complaining about parser-services on `package.json`, do NOT remove `extraFileExtensions: ['.json']` — the recommended config relies on it for `validate-manifest`. The disable-block is wired up internally.

## 5. CI Workflow — `lint.yml`

### 5.1 Complete reference implementation

The official `obsidian-sample-plugin/.github/workflows/lint.yml` is the canonical pattern. Adapted for MemoChron:

```yaml
# .github/workflows/lint.yml
# Source: https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/.github/workflows/lint.yml

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

### 5.2 Notes
- **Action pins:** `actions/checkout@v4`, `actions/setup-node@v4` match the sample plugin exactly. The current latest majors are `@v6.0.2` and `@v6.4.0` respectively, but @v4 is widely deployed, stable, and avoids drift from the sample plugin reference. [VERIFIED: GitHub releases API, 2026-05-13]
- **Node 20.x + 22.x matrix:** matches the sample plugin; both satisfy `eslint@9` engine (`^20.9.0`) and `typescript-eslint@8` engine (`^20.9.0`). Going matrix-of-two costs ~30s extra wall-clock and catches Node-version-specific regressions.
- **`cache: 'npm'`:** auto-detects `package-lock.json` (present in repo). No further config required. [CITED: actions/setup-node README]
- **No matrix needed if simpler is preferred:** CONTEXT.md D-06 says "Node 20.x". A single-job `node-version: 20.x` workflow is equally valid and slightly cheaper. **Researcher's recommendation:** keep the 20/22 matrix to mirror the sample plugin; CONTEXT.md classifies this as Claude's discretion ("planner aligns with `release.yml`").
- **`branches: ['**']`:** lints on ANY branch push and ANY pull_request target — most aggressive and matches sample plugin. CONTEXT.md says "all branches" so this matches.
- **`npm run lint` exit code:** ESLint exits non-zero on any rule failure (default behavior). No `--max-warnings 0` needed; the recommended config emits the rules we care about as `error` not `warn`. [Standard ESLint CLI behavior]

### 5.3 NOT integrating with `release.yml`

CONTEXT.md D-06 and D-07 explicitly say lint is a **separate workflow file**, not chained into build. Do NOT add `npm run lint` to the `release.yml` build steps — keep release fast and lint failures separate from publish failures.

## 6. Release Attestation — DIR-12

### 6.1 Version choice

| Pin | Status | Recommendation |
|-----|--------|----------------|
| `actions/attest-build-provenance@v2` | Last stable in this major: 2.4.0 (June 2025). Documented in CONTEXT.md as the anticipated version. | **AVOID** — superseded. No new features. |
| `actions/attest-build-provenance@v3` | Latest in this major: 3.2.0 (Jan 2026). Adds `artifact-metadata: write` permission as recommended but optional. Bumped to Node 24 runtime. | **RECOMMENDED** — stable, current, well-documented, identical input contract to v2 for our use. |
| `actions/attest-build-provenance@v4` | Latest: 4.1.0 (Feb 2026). v4 is a thin **wrapper around `actions/attest`** (no functional difference for our path). Action README explicitly says "new implementations should use `actions/attest` instead." | Acceptable but adds wrapper indirection. |

**Researcher recommends pinning `@v3`** — same input contract as v2 (the planner doesn't have to relearn anything from CONTEXT.md's v2 assumption), no wrapper indirection, current and stable. The `artifact-metadata: write` permission was added in the v3 era and is the only meaningful difference.

> Note: CONTEXT.md anticipates `@v2`. This research **deviates upward** to `@v3` because v2 is now a one-major-behind line that has received no updates since June 2025; pinning to a stale major is a foot-gun for security-tooling. The planner should briefly call this out in the implementation note when authoring the workflow change.

[VERIFIED: https://api.github.com/repos/actions/attest-build-provenance/releases]
[CITED: https://github.com/actions/attest-build-provenance/blob/v3.2.0/README.md]

### 6.2 DIR-11 — `manifest.json` change

**Current** (line 6):
```
"description": "Calendar integration and note creation with support for public iCalendar URLs",
```
**New:**
```
"description": "Calendar integration and note creation with support for public iCalendar URLs.",
```

Single character append (`.`) before the closing `"`. Preserve tabs (file currently uses tab indentation). Acceptance: byte-equality — the field's string MUST end with `.`, `!`, or `?`.

### 6.3 Exact `release.yml` patch

The current `release.yml`:
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

Patch required:

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
      id-token: write          # NEW — required by attest-build-provenance to mint OIDC token
      attestations: write      # NEW — required by attest-build-provenance to persist attestation
      artifact-metadata: write # NEW — required by v3+ for artifact metadata storage records
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
      - name: Attest release artifacts                            # NEW STEP
        uses: actions/attest-build-provenance@v3
        with:
          subject-path: |
            main.js
            manifest.json
            styles.css
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

### 6.4 Step ordering — verified

- `attest-build-provenance` runs **after** `npm run build` (the three artifacts must exist as files on disk before attestation can hash them)
- `attest-build-provenance` runs **before** `gh release create` (attestation is uploaded to GitHub's attestations API, where the `gh release create --draft` step then uploads the artifact files; the two are independent — the attestation references files BY DIGEST, not by their location in the release)
- **`--draft` is fine** — attestation is tied to the artifact's SHA-256 digest (in GitHub's transparency log), not to the release's published state. A draft release whose artifacts have been attested still passes `gh attestation verify` once those artifacts are downloaded. [CITED: gh attestation verify docs — "the artifact" is what's verified, not the release wrapper]
- **Known edge case (immutable releases):** if the repo has opted into "immutable releases" (a recent GitHub feature), there are known timing problems with attesting AFTER `gh release create`. We attest BEFORE, so we sidestep this. [CITED: https://github.com/actions/attest-build-provenance/issues/734]

### 6.5 `subject-path` syntax — confirmed

From the v3.2.0 action.yml: *"May contain a glob pattern or list of paths (total subject count cannot exceed 1024)."* Newline-separated list is the documented multi-file form:

```yaml
subject-path: |
  main.js
  manifest.json
  styles.css
```

A single multi-subject attestation is generated (NOT three separate ones). This is the v2.0.0+ behavior — *"a single attestation is created with references to each of the supplied subjects."* [CITED: v2.0.0 release notes]

### 6.6 Required permissions — detail

| Permission | Required? | Why |
|------------|-----------|-----|
| `contents: write` | Yes (was already there) | `gh release create` needs it |
| `id-token: write` | Yes (NEW) | Mints the short-lived OIDC token used to request a Sigstore signing certificate |
| `attestations: write` | Yes (NEW) | Persists the attestation to the GitHub attestations API |
| `artifact-metadata: write` | Optional but recommended in v3+ | Creates artifact storage records. If omitted, the action continues without creating the record (per README). Safe to include unconditionally. |

### 6.7 Public-repo requirement

[CITED: action README] *"Artifact attestations are available in public repositories for all current GitHub plans. They are not available on legacy plans, such as Bronze, Silver, or Gold. If you are on a GitHub Free, GitHub Pro, or GitHub Team plan, artifact attestations are only available for public repositories."*

MemoChron is public (`formax68/memoChron`), so this works. If the repo ever goes private it would require GitHub Enterprise Cloud.

### 6.8 Optional adjacent improvements (Claude's discretion per CONTEXT.md)

CONTEXT.md `<decisions>` mentions the planner may also bump:
- `actions/checkout@v3 → v4` (or `v6`)
- `actions/setup-node@v3 → v4` (or `v6`)
- `node-version: "18.x" → "20.x"`

These are NOT strictly required by DIR-12, but `release.yml` will be edited anyway. If the planner bumps Node to 20.x, ensure it's `20.19+` if the planner also chose ESLint 10 (which we recommended against — sticking with ESLint 9 keeps Node 18.x in `release.yml` valid).

## 7. Test Pre-Release Tag — DIR-12 Acceptance

### 7.1 Historical tag convention

Verified via `git tag -l`: the repo has exactly **one** pre-release tag in its history: `1.3.0-beta.1` (commit `d2fadef`, "Prepare beta release 1.3.0-beta.1"). All other tags are unsuffixed semver (`1.13.1`, `1.14.0`, etc.).

**Recommended tag string:** `1.15.0-beta.1` — matches the only prior pre-release convention.

### 7.2 BRAT-compat implication

CONTEXT.md `<constraints>`: *"version in `manifest.json` must match release tag exactly."* For tag `1.15.0-beta.1`:

1. `package.json` `version` → `1.15.0-beta.1`
2. `manifest.json` `version` → `1.15.0-beta.1` (also gets `.` appended for DIR-11 — separate concern, but both happen on the same tag)
3. Run `npm version 1.15.0-beta.1` to trigger `version-bump.mjs` (which syncs `manifest.json` and `versions.json` from `package.json`)
4. `git tag 1.15.0-beta.1 && git push origin 1.15.0-beta.1`
5. `release.yml` runs; the attested artifact's bundled `manifest.json` shows `version: "1.15.0-beta.1"` AND description ending with `.`

### 7.3 Attestation persistence after tag deletion

[CITED: GitHub artifact attestations docs] — the attestation is stored in GitHub's attestations API (and the public Sigstore transparency log for public repos), keyed by the artifact's SHA-256 digest. **The attestation persists even if:**
- the release is deleted
- the tag is deleted
- the release stays in draft

What matters for `gh attestation verify` is that the downloaded artifact file's digest matches the registered attestation. So **the test pre-release can be safely deleted** after DIR-12 acceptance evidence is collected; the registry entry remains as proof.

### 7.4 Draft vs published

Current `release.yml` uses `--draft`. CONTEXT.md `<decisions>` notes the planner may flip the test tag's run to a real pre-release. **Researcher recommends:**
- Keep `--draft` in `release.yml` (unchanged behavior; existing 1.14.0 release flow used it)
- For the DIR-12 test, after CI runs: download the three draft-release assets, run `gh attestation verify` against each LOCAL file (no release-status dependency), capture the output to `05-HUMAN-UAT.md`, then (optionally) promote the draft to a real pre-release in GitHub UI

This sidesteps the immutable-releases ordering issue entirely.

## 8. `gh attestation verify` — Exact Invocation

### 8.1 Syntax

From `gh attestation verify --help` (CLI docs as of 2026-05-13):

```
gh attestation verify [<file-path> | oci://<image-uri>] [--owner | --repo] [flags]
```

**Minimum-required flag** is one of:
- `--owner OWNER` (looser binding — accepts attestations from any repo owned by OWNER)
- `--repo OWNER/REPO` (tighter binding — requires the attestation came from this exact repo)

For our case (public repo, locked to `formax68/memoChron`), `--repo formax68/memoChron` is the stricter and correct invocation. `--owner formax68` would also work and is what CONTEXT.md `<specifics>` mentions, but `--repo` is more defensive against potential cross-repo attestation confusion.

### 8.2 Commands for DIR-12 acceptance

After the test pre-release runs and the three draft assets are downloaded locally to a working directory:

```bash
# Download the three assets from the draft release
gh release download 1.15.0-beta.1 --repo formax68/memoChron --pattern 'main.js'
gh release download 1.15.0-beta.1 --repo formax68/memoChron --pattern 'manifest.json'
gh release download 1.15.0-beta.1 --repo formax68/memoChron --pattern 'styles.css'

# Verify each — all three must succeed
gh attestation verify main.js       --repo formax68/memoChron
gh attestation verify manifest.json --repo formax68/memoChron
gh attestation verify styles.css    --repo formax68/memoChron
```

### 8.3 What success looks like

Successful verification prints (default, non-JSON format) a multi-line confirmation including:
- *"Loaded N attestations from GitHub API"* (typically 1 — the single multi-subject attestation)
- A trust-domain summary line
- For each predicate: *"sigstore: ✓ Verified..."* / *"the attestation is valid against the trusted root"*
- A final *"successfully verified"* / *"all attestations verified"* line

For piped output / scripting, append `--format json` and parse the JSON array of attestation objects. Each object has `attestation` and `verificationResult` — non-empty `verificationResult.signature.certificate` and `verifiedTimestamps` indicate success.

[CITED: https://cli.github.com/manual/gh_attestation_verify]

### 8.4 Network requirement

`gh attestation verify` is NOT a fully-offline operation by default — *"this command will attempt to fetch relevant attestations via the GitHub API."* To run fully offline, the user would need to first `gh attestation download` and then pass `--bundle path.jsonl`. Phase 5's UAT runs online; no offline mode required.

### 8.5 `gh` CLI version requirement

`gh attestation` subcommand was added in `gh` 2.46.0 (May 2024). Currently we have `gh` available in CI (used by `gh release create` already). Local UAT requires a developer-installed `gh` ≥ 2.46. **Researcher recommends** including `gh --version` in the UAT pre-flight check.

## 9. Pitfalls / Gotchas

### 9.1 TypeScript version floor

**Risk:** `typescript-eslint@8` requires `typescript >=4.8.4 <6.1.0`. Project has `4.7.4`. If the planner installs the new lint deps without bumping TS, **`npm install` will succeed but `npx eslint .` will fail at runtime** with a peer-version error from `@typescript-eslint/typescript-estree`.
**Mitigation:** Phase 5 MUST bump `typescript` from `4.7.4` to `^5.9.3`. This is a real change — TS 5.x has stricter type checking than 4.7. Anticipate a small number of `tsc -noEmit` failures during the dry-run that need fixing as part of Phase 5 OR being explicitly silenced. (Most TS 4.7 → 5.x breakage is at the type-system level for advanced patterns; this codebase uses straightforward types and is likely clean — verify in dry-run.)

### 9.2 Type-aware lint on out-of-project `.mjs` files

**Risk:** If the planner does NOT add `eslint.config.mjs` to `globalIgnores` or `allowDefaultProject`, eslint will error: *"Parsing error: ESLint was configured to run on `<file>` but it isn't included in any of the projects provided..."*
**Mitigation:** The skeleton in §4.1 puts `esbuild.config.mjs` and `version-bump.mjs` in `globalIgnores`, and `eslint.config.mjs` in `allowDefaultProject`. This is exactly the sample plugin's pattern.

### 9.3 ESLint 10's stricter Node floor

**Risk:** If the planner takes a "use latest" shortcut and pins `eslint@^10.3.0`, Node 18.x in `release.yml` breaks (10 requires `>=20.19`). The build job won't lint (lint isn't in build), but if planner ever chains lint into release, this becomes a CI failure.
**Mitigation:** Pin `eslint@^9.39.4`. Document the reason in the lockfile commit.

### 9.4 `no-console` semantics in recommended config

**Risk:** The obsidianmd recommended config sets `no-console: off` and replaces it with `obsidianmd/rule-custom-message` allowing `warn`/`error`/`debug`. DIR-01 wording says ALL `console.*` calls should be removed/gated. The two readings of "what does no-console mean" conflict.
**Mitigation:** This is by design — DOC-01 enforces the **rule existence**, Phase 8 (DIR-01) enforces the **specific call removal**. Phase 5 leaves the relaxed default in place and silences via the Phase 8 override block.

### 9.5 `--draft` release + attestation

**Risk:** The action README does not document `--draft` behavior; community guides assume `gh release create` without `--draft`.
**Mitigation:** Attestation is anchored to the artifact digest, not the release state. Verified safe by reading the v2.0.0+ release notes ("a single attestation is created with references to each of the supplied subjects" — subjects are files, not releases) and the `gh attestation verify` docs ("To specify the artifact, this command requires: a file path to an artifact, or a container image URI"). The release wrapper is irrelevant.

### 9.6 Multi-subject attestation in one step

**Risk:** Planner might be tempted to attest each file in a separate step. This works but creates 3 attestations instead of 1, and complicates `gh attestation verify` (it might find multiple competing attestations).
**Mitigation:** Use the single-step `subject-path: |` newline list. The result is one attestation referencing all three subjects — matches the action's recommended pattern.

### 9.7 `actions/attest-build-provenance` requires public repo

**Risk:** If the repo is ever set to private (intentionally or accidentally), the action will fail at the `id-token` step or the attestation upload step.
**Mitigation:** None at Phase 5 level — this is a repo-settings concern. Note in the UAT script: "this works because `formax68/memoChron` is a public repo."

### 9.8 `gh` CLI must support `attestation` subcommand

**Risk:** Local developer running UAT with `gh < 2.46.0` will hit "unknown command: attestation."
**Mitigation:** UAT pre-flight check should run `gh --version` first and fail-fast if `< 2.46`. Latest stable `gh` is `2.62.x` (March 2026) — typical developer machines should be fine, but the check is cheap.

### 9.9 `eslint-plugin-obsidianmd` 0.3.0 is brand-new

**Risk:** Version 0.3.0 was published **23 hours before** this research ran (2026-05-12). New releases can have undiscovered bugs.
**Mitigation:** Pin `^0.3.0` (allows patch updates). Document the publish date in the lockfile commit. If a critical bug surfaces during planner's dry-run, fall back to `^0.2.9` (published 2026-04-30) — both share the same recommended-config shape; the public rule names are stable across these versions.

### 9.10 The disable-block for `package.json` lint

**Risk:** The recommended config from obsidianmd includes a block that switches `package.json` to JSON language and disables type-checked rules. If the planner removes `extraFileExtensions: ['.json']` from parserOptions, the JSON block will fail (no parser for `package.json`).
**Mitigation:** Keep `extraFileExtensions: ['.json']` exactly as in the skeleton. This is the only Phase 5 file that JSON-lints; the planner does NOT need to add `eslint-plugin-jsonc` (which is explicitly deferred per CONTEXT.md `<deferred>`).

### 9.11 `version-bump.mjs` syncs `versions.json` — DIR-11 implication

**Risk:** `version-bump.mjs` rewrites `manifest.json` from `package.json` on `npm version`. Naive: the planner could append `.` to `manifest.json` `description`, then a later `npm version` run **would not preserve the change** because `version-bump.mjs` only touches `version` and `versions.json`, not `description`. ✅ Verified by reading `version-bump.mjs` — it only updates `version` and `versions.json`, never `description`. So DIR-11 is durable.

## 10. Final Recommendations — Pinned Version Table

| Package | Pin | Reason |
|---------|-----|--------|
| `eslint` | `^9.39.4` | Latest maintenance line; avoids ESLint 10's stricter Node floor |
| `typescript-eslint` | `^8.59.3` | Current; provides parser + plugin + configs + `tseslint.config()` helper |
| `eslint-plugin-obsidianmd` | `^0.3.0` | Latest; brings recommended config covering most of DOC-01's rules |
| `globals` | `^14.0.0` | Matches sample plugin and plugin's bundled version |
| `typescript` | `^5.9.3` | Required upgrade from 4.7.4 to satisfy `typescript-eslint@8` peer (`>=4.8.4 <6.1.0`); 5.9 is the safest 5.x pick (6.0 is at the edge of the supported range) |
| `actions/checkout` | `@v4` | Matches sample plugin reference. Optionally bump to `@v6` adjacent to this phase. |
| `actions/setup-node` | `@v4` | Matches sample plugin reference. |
| `actions/attest-build-provenance` | `@v3` | Current stable major; identical input contract to v2; avoids v4 wrapper indirection |

**Packages to REMOVE:**
- `@typescript-eslint/eslint-plugin` (5.29.0 — replaced by `typescript-eslint` meta package)
- `@typescript-eslint/parser` (5.29.0 — re-exported by `typescript-eslint` meta package)

**`package.json` scripts to add:**
```json
"lint": "eslint src/",
"lint:fix": "eslint src/ --fix"
```

Note: the sample plugin uses `"lint": "eslint ."` (which lints everything not in `globalIgnores`). The CONTEXT.md D-05 says `eslint src/` — researcher recommends following CONTEXT.md (more explicit; doesn't depend on `globalIgnores` correctness). Both work; the difference is symbolic.

**Confidence flags:**

| Area | Confidence | Reason |
|------|-----------|--------|
| ESLint / typescript-eslint / obsidianmd versions | HIGH | All verified directly against npm registry on 2026-05-13 |
| `eslint-plugin-obsidianmd` rule list and recommended config behavior | HIGH | Read directly from unpacked 0.3.0 tarball |
| Sample-plugin reference patterns (config skeleton, lint.yml) | HIGH | Fetched verbatim from `obsidianmd/obsidian-sample-plugin@master` |
| `attest-build-provenance` API surface | HIGH | Read action.yml and README from v3.2.0 tag verbatim |
| `gh attestation verify` exact invocation | HIGH | Read the published CLI manual verbatim |
| Attestation persistence after release deletion | MEDIUM | Inferred from "attestation is anchored to artifact digest" docs; not explicitly tested. Planner can verify in §7 UAT by deleting the test release and re-running verify. |
| TS 4.7 → 5.9 breaking-change risk for MemoChron's code | LOW-MEDIUM | Project uses basic TypeScript patterns; no advanced generics in research-grade reading of source. Planner's dry-run will confirm. |
| Phase 6/7/8 override-block file globs | MEDIUM | Researcher's globs are informed best-guesses; planner's dry-run against the v1.15 starting tree is the source of truth |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 6/7/8 file-glob assignments in the override skeleton (§4.1) | §4.1, §4.3 | Wrong globs would silence rules in the wrong scope — caught by planner's dry-run |
| A2 | TS 4.7 → 5.9 will not introduce new type errors in `src/` | §1.1, §9.1 | If wrong, `tsc -noEmit` in build script fails on Phase 5; planner needs to fix or silence |
| A3 | `gh release download` from a draft pre-release works for the repo owner | §8.2 | If wrong, planner runs UAT on the published (post-draft) release instead — same `gh attestation verify` command |
| A4 | The `--draft` release attestation reads correctly with `--repo formax68/memoChron` | §8.2 | If wrong, falling back to `--owner formax68` is the documented alternative |

## Open Questions

1. **TypeScript 5.x type-check breakage on the v1.15 starting tree**
   - What we know: TS bumps 4.7 → 5.9 are usually clean for code that uses basic types, but `strictNullChecks: true` combined with TS 5.x's tightened narrowing can surface latent issues.
   - What's unclear: Whether `src/services/CalendarService.ts`'s `(dtstart as any).jCal` or `src/utils/timezoneUtils.ts`'s Luxon usage will newly error.
   - Recommendation: planner runs `npm install typescript@5.9.3 && npx tsc -noEmit -skipLibCheck` BEFORE installing ESLint, to isolate type errors from lint errors. Fix or silence per case.

2. **Should we bump `actions/checkout` and `actions/setup-node` in `release.yml` at the same time?**
   - What we know: CONTEXT.md `<decisions>` Claude's Discretion says "planner aligns with `release.yml`" but also says this is "adjacent improvement" and "not a Phase 5 acceptance criterion."
   - What's unclear: User preference — purist (only DIR-12 changes touch `release.yml`) vs pragmatic (one PR, all improvements).
   - Recommendation: defer to planner's call. Both are defensible; researcher leans purist (only DIR-12 changes to `release.yml`, no Node bump, no checkout/setup-node bump) to keep the DIR-12 commit's diff narrow.

3. **Will `obsidianmd/validate-manifest` flag MemoChron's `manifest.json`?**
   - What we know: The rule is in `recommended` at `error`. The plugin's manifest validation checks the standard Obsidian manifest schema.
   - What's unclear: Whether MemoChron's current `manifest.json` (e.g., the missing `fundingUrl` field, or `author: ""` in `package.json`) flags anything.
   - Recommendation: planner's dry-run captures this. If it flags, either fix (the spirit of v1.15) or add to a `// Phase 5 — manifest cleanup` override (researcher prefers fix).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `npm` | All package operations | ✓ (project) | 9.x+ | — |
| `node` | ESLint runtime, build | ✓ (project, CI) | local 26.x; CI 18.x → may bump to 20.x | — |
| `gh` CLI | DIR-12 UAT (`attestation verify`) | UAT-time | ≥ 2.46.0 required | None — required for DIR-12 acceptance |
| `git` | Tag creation for test pre-release | ✓ | — | — |
| Public-repo GitHub plan | Artifact attestations | ✓ (`formax68/memoChron` is public) | — | None — required for DIR-12 |

**Blocking dependencies:** `gh` CLI ≥ 2.46.0 on the local machine doing the UAT (Phase 5 commit 4).
**Non-blocking:** none.

## Validation Architecture

> Skipped — `.planning/config.json` is absent; project has no test framework. CONTEXT.md `<decisions>` D-13 explicitly says "Code review + HUMAN-UAT (consistent with Phases 1–4 — no test suite is in scope this milestone)." Validation is human UAT documented in `05-HUMAN-UAT.md`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Plugin has no auth surface |
| V3 Session Management | no | Plugin has no sessions |
| V4 Access Control | no | Plugin runs in Obsidian's sandbox |
| V5 Input Validation | yes | Existing — `colorValidation.ts` from Phase 2; URL validation is Phase 5 out-of-scope |
| V6 Cryptography | yes | **Attestation signing** — Sigstore short-lived certs via GitHub OIDC; never hand-roll. `actions/attest-build-provenance@v3` is the standard control. |
| V12 Files and Resources | yes | Tangential — `manifest.json` description change is the only file touched outside dev tooling |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supply-chain attack on release artifact | Spoofing | Attestation via Sigstore (what we're installing) — `gh attestation verify` is the consumer-side check |
| Compromised CI runner forges attestation | Spoofing/Tampering | OIDC-based signing identity makes this very hard; verification checks `SourceRepository`, `SourceRepositoryOwner` and SAN — falsifiable only by gaining the OIDC token, which is short-lived |
| Lint config rules bypassed by malicious commit | Tampering | Required-status-check on `lint.yml` in branch protection (out of scope per CONTEXT.md — user enables this in repo settings) |

## Sources

### Primary (HIGH confidence)

- **ESLint 9 docs:** https://eslint.org/docs/latest/use/configure/configuration-files (flat-config `files`/`ignores`/cascading objects)
- **ESLint 10 migration guide:** https://eslint.org/docs/latest/use/migrate-to-10.0.0 (Node floor, removed APIs)
- **typescript-eslint v8 typed linting:** https://typescript-eslint.io/getting-started/typed-linting/ (`projectService: true` canonical)
- **typescript-eslint parser:** https://typescript-eslint.io/packages/parser/ (`allowDefaultProject`, `tsconfigRootDir`, `import.meta.dirname`)
- **typescript-eslint performance:** https://typescript-eslint.io/troubleshooting/typed-linting/performance/
- **eslint-plugin-obsidianmd repo:** https://github.com/obsidianmd/eslint-plugin (rule index, recommended config — confirmed against unpacked 0.3.0 tarball)
- **obsidian-sample-plugin (reference):**
  - `eslint.config.mts` — https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/eslint.config.mts
  - `lint.yml` — https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/.github/workflows/lint.yml
  - `package.json` — https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/package.json
- **actions/attest-build-provenance v3.2.0 README:** https://github.com/actions/attest-build-provenance/blob/v3.2.0/README.md
- **actions/attest-build-provenance action.yml:** https://github.com/actions/attest-build-provenance/blob/v3.2.0/action.yml
- **actions/attest-build-provenance v2.0.0 release notes** (multi-subject attestation introduction): https://github.com/actions/attest-build-provenance/releases/tag/v2.0.0
- **gh attestation verify manual:** https://cli.github.com/manual/gh_attestation_verify
- **actions/setup-node README:** https://github.com/actions/setup-node
- **npm registry:** `npm view eslint`, `npm view typescript-eslint`, `npm view eslint-plugin-obsidianmd`, `npm view typescript` (queried 2026-05-13)

### Secondary (MEDIUM confidence)

- **Immutable releases / attestation ordering issue:** https://github.com/actions/attest-build-provenance/issues/734 (explains why we attest BEFORE `gh release create`)
- **Obsidian forum: attestation support thread:** https://forum.obsidian.md/t/attestation-support-for-community-plugins/99285
- **GitHub Docs: artifact attestations:** https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds

### Tertiary (cross-reference only)

- **GitHub release API for action versions:** https://api.github.com/repos/actions/attest-build-provenance/releases (queried 2026-05-13)
- **Node.js release index:** https://nodejs.org/dist/index.json (Node 20.20.2 latest in 20-line, queried 2026-05-13)

## Metadata

**Confidence breakdown:**
- Standard stack & version pins: HIGH — all verified against live npm registry on research date
- Architecture / config skeleton: HIGH — directly modeled on `obsidian-sample-plugin@master` (the canonical reference)
- Plugin rule index: HIGH — unpacked tarball read verbatim
- Phase 6/7/8 override globs: MEDIUM — researcher's best-guess pending planner's dry-run
- Attestation flow: HIGH — both action and CLI docs read verbatim; multi-subject pattern is the documented v2.0.0+ behavior
- DIR-11 byte-change: HIGH — single character append, trivially verifiable

**Research date:** 2026-05-13
**Valid until:** 2026-06-12 (30-day window for stable releases; `eslint-plugin-obsidianmd@0.3.0` was published one day before this research, so re-verify versions if planning slips more than 14 days)
