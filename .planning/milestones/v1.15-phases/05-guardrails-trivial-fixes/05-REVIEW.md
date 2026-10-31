---
phase: 05-guardrails-trivial-fixes
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - manifest.json
  - .github/workflows/release.yml
  - .github/workflows/lint.yml
  - eslint.config.mjs
  - package.json
  - versions.json
  - src/settings/SettingsTab.ts
  - src/views/CalendarView.ts
  - src/views/EmbeddedAgendaView.ts
  - src/views/EmbeddedCalendarView.ts
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: has-findings
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 10
**Status:** has-findings

## Executive Summary

Two bugs survive the phase. The `!x ?? y` fix in `SettingsTab.ts` was partially correct — the `collapsedSections` toggle (line 76) is now correct, but the `collapsedCalendars` toggle (line 262) introduced a default-value mismatch that makes the first click on any calendar item a no-op. Separately, the Phase 8 override block in `eslint.config.mjs` turns `@typescript-eslint/no-unused-vars` off for all `src/**/*.ts`, completely neutralising the Phase 5 tightening and contradicting DOC-01 success criterion #1. Everything else — `manifest.json` punctuation, `release.yml` step ordering, `as TFile` casts, and `lint.yml` structure — is correct.

---

## Critical Issues

| ID | File:Line | Finding | Suggested Action |
|----|-----------|---------|-----------------|
| CR-01 | `src/settings/SettingsTab.ts:262` | First click on any calendar item is always a no-op | Change `?? false` to `?? true` |
| CR-02 | `eslint.config.mjs:143` | Phase 8 block silences `@typescript-eslint/no-unused-vars` for all `src/**/*.ts`, defeating the Phase 5 `"error"` tightening required by DOC-01 | Move `@typescript-eslint/no-unused-vars: "off"` out of Phase 8; rely on the Phase 5 block staying active until Phase 8 fixes the violations, or add per-file overrides only for files with known violations |

### CR-01: Calendar item first-click is always a no-op

**File:** `src/settings/SettingsTab.ts:262`

**Issue:** The initial render at line 213 defaults to `?? true` (calendar items start collapsed). The toggle handler at line 262 defaults to `?? false`. When no Map entry exists for a calendar index — the common case on first open — the toggle computes `!(undefined ?? false)` = `!false` = `true`, which is identical to the initial state. The Map is then set to `true` (collapsed), so the UI does not change. The user must click twice to expand any calendar item.

Trace:
- First click: `get(index) = undefined` → `undefined ?? false = false` → `!false = true` → set `true` → UI stays collapsed (no visual change)
- Second click: `get(index) = true` → `true ?? false = true` → `!true = false` → UI expands

Compare with `collapsedSections` (line 76, correctly fixed): it uses `?? defaultCollapsed` in both the initial render (line 49) and the toggle, so the defaults are consistent.

**Fix:**
```typescript
// Line 262 — change ?? false to ?? true to match the initial render default at line 213
const nowCollapsed = !(this.collapsedCalendars.get(index) ?? true);
```

### CR-02: Phase 8 override block nullifies no-unused-vars enforcement for all of src/

**File:** `eslint.config.mjs:143`

**Issue:** ESLint 9 flat config applies rules in order; later entries override earlier ones for matching files. The Phase 5 tightening block (index 3 in the config array) sets `@typescript-eslint/no-unused-vars: ["error", { args: "none" }]` for `src/**/*.ts`. The Phase 8 override block (index 6) sets `@typescript-eslint/no-unused-vars: "off"` for the same glob. The Phase 8 entry wins. Running `echo "const x = 1;" > src/foo.ts && npx eslint src/foo.ts` exits 0 with no errors — confirmed empirically. ROADMAP success criterion #1 states `npm run lint` must exit non-zero when `@typescript-eslint/no-unused-vars` is violated. It does not.

The CONTEXT.md D-04 example included `no-unused-vars: "off"` in the Phase 8 block, which is why the plan's dry-run passed. However, the effect contradicts the DOC-01 acceptance language, which says the rule must be enforced, not merely present in the config.

**Fix:** Two options, both acceptable:

Option A — Remove `@typescript-eslint/no-unused-vars: "off"` from the Phase 8 block entirely. The recommended config already sets it to `"warn"`, which the Phase 5 block tightens to `"error"`. Phase 8 should fix the ~21 violations rather than silence them at the config level. The Phase 8 block still silences `no-explicit-any`, `no-unsafe-*`, `no-console`, etc. which do have widespread existing violations.

Option B — Keep the block but restrict it to specific files that have known violations, so new code in clean files still gets checked:
```js
// Phase 8 — DIR-10 will remove these per-file silences when type-hygiene lands.
{
  files: [
    "src/main.ts",
    "src/services/CalendarService.ts",
    // ... only files with confirmed existing violations
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": "off",
  },
},
```

---

## Warnings

| ID | File:Line | Finding | Suggested Action |
|----|-----------|---------|-----------------|
| WR-01 | `eslint.config.mjs:80` | `"no-restricted-syntax": "off"` in the Phase 6 block silences the entire rule for `SettingsTab.ts` and `CalendarView.ts`, not just the `document.createElement` selector | Scope this to the specific selector rather than the whole rule class |
| WR-02 | `.github/workflows/release.yml:43-46` | `gh release create` uses `--draft` but not `--prerelease`; a tag like `1.15.0-beta.1` is published as a draft, not a marked pre-release | Add `--prerelease` for semantic-versioning identifiers |

### WR-01: Phase 6 block turns off all no-restricted-syntax, not just document.createElement

**File:** `eslint.config.mjs:80`

**Issue:** The Phase 5 tightening block at line 53 installs a `no-restricted-syntax` rule targeting `document.createElement`. The Phase 6 override at line 80 silences `"no-restricted-syntax": "off"` entirely for `src/settings/SettingsTab.ts` and `src/views/CalendarView.ts`. If any future `no-restricted-syntax` selectors are added to the Phase 5 block (e.g. for other forbidden patterns), they will be silently bypassed in those two files until Phase 6 removes the block. The current implementation makes the override broader than necessary.

**Fix:**
```js
// In Phase 6 block, scope to just the selector used in Phase 5:
"no-restricted-syntax": ["off"],
// or better: use a per-selector override if ESLint supports it; otherwise document
// this as "silences all no-restricted-syntax in Phase 6 files".
```
At minimum, add a comment noting what this "off" encompasses, so it is clear the broader scope is intentional.

### WR-02: Release workflow does not mark pre-release tags as GitHub pre-releases

**File:** `.github/workflows/release.yml:43-46`

**Issue:** Tags with pre-release identifiers (e.g. `1.15.0-beta.1`) are created as drafts only. GitHub does not automatically infer pre-release status from SemVer identifiers; the `--prerelease` flag must be passed explicitly to `gh release create`. BRAT determines pre-release eligibility by GitHub's release `prerelease` field. Without `--prerelease`, beta users added via BRAT will not see the release as an update target until the draft is manually promoted.

This is noted in CLAUDE.md "Beta Release Strategy": "Mark release as `pre-release` in GitHub." The current workflow does not enforce this for any tag — including `-beta.*` and `-rc.*` tags.

**Fix:**
```yaml
gh release create "$tag" \
  --title="$tag" \
  --draft \
  $(echo "$tag" | grep -qE '-(alpha|beta|rc|pre)\.' && echo '--prerelease') \
  main.js manifest.json styles.css
```
Or, since the current release flow always creates drafts first (manually promoted to release/pre-release), document that the `--prerelease` flag is deliberately omitted and must be set in the GitHub UI during draft promotion.

---

## Info

| ID | File:Line | Finding | Suggested Action |
|----|-----------|---------|-----------------|
| IN-01 | `.github/workflows/release.yml:17,20` | `release.yml` uses `actions/checkout@v3` and `actions/setup-node@v3` while `lint.yml` uses `@v4` for both — version mismatch across workflows in the same repo | Update `release.yml` to `@v4` for consistency (deferred per Phase 5 plan decision, but worth a follow-up) |

### IN-01: release.yml action pins lag behind lint.yml

**File:** `.github/workflows/release.yml:17,20`

**Issue:** `lint.yml` uses `actions/checkout@v4` and `actions/setup-node@v4`. `release.yml` still uses `@v3` for both. This is a known deferred decision (documented in 05-02-SUMMARY.md as the "purist path"). It is tracked here for completeness so it is not forgotten when Phase 5's scope decisions are revisited.

**Fix:** In a follow-up commit, update `release.yml`:
```yaml
- uses: actions/checkout@v4
# ...
uses: actions/setup-node@v4
```

---

## Notes on Confirmed-Correct Changes

The following phase 5 changes were verified and found to be correct:

- **manifest.json** — One-character `.` append; tab indentation, key order, and all other fields byte-identical. JSON is valid. No trailing newline was present before or after (pre-existing, not a regression).

- **release.yml attestation step** — Step order `Build plugin` (index 2) → `Attest release artifacts` (index 3) → `Create release` (index 4) is correct. All four required permissions are present (`contents: write`, `id-token: write`, `attestations: write`, `artifact-metadata: write`). The `subject-path` newline list covers exactly the three release assets.

- **collapsedSections toggle (SettingsTab.ts:76)** — `!(this.collapsedSections.get(name) ?? defaultCollapsed)` is correct. Both the initial render (line 49) and the toggle use `?? defaultCollapsed`, so the defaults are consistent. The fix matches intent.

- **`as TFile` casts (CalendarView.ts:825, EmbeddedAgendaView.ts:381, EmbeddedCalendarView.ts:233)** — Safe. `getDailyNote` returns `TFile` and `createDailyNote` returns `Promise<TFile>` in the `obsidian-daily-notes-interface` type declarations. The type error was purely from dual-module `obsidian` resolution (the package bundles an older peer); the values are genuine `TFile` instances at runtime.

- **lint.yml** — Correct structure: `push` + `pull_request` triggers on all branches (`**`), `ubuntu-latest`, Node matrix `[20.x, 22.x]`, `npm ci` before `npm run lint`, no `npm run build`, no `if:` gating.

- **versions.json** — `1.15.0-beta.1` → `1.8.9` mapping correctly added.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
