---
phase: 05-guardrails-trivial-fixes
plan: "03"
subsystem: tooling
tags:
  - eslint
  - typescript
  - ci
  - lint
  - devdependencies
dependency_graph:
  requires:
    - 05-01
    - 05-02
  provides:
    - eslint-config
    - lint-ci-workflow
    - typescript-5x
  affects:
    - package.json
    - package-lock.json
    - eslint.config.mjs
    - .github/workflows/lint.yml
    - src/settings/SettingsTab.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedAgendaView.ts
    - src/views/EmbeddedCalendarView.ts
tech_stack:
  added:
    - eslint@9.39.4
    - typescript-eslint@8.59.3
    - eslint-plugin-obsidianmd@0.3.0
    - globals@14.x
  patterns:
    - ESLint 9 flat config (eslint.config.mjs)
    - obsidianmd.configs.recommended
    - phase-tagged override blocks (Phase 6/7/8)
    - type-aware lint via projectService
key_files:
  created:
    - eslint.config.mjs
    - .github/workflows/lint.yml
  modified:
    - package.json
    - package-lock.json
    - src/settings/SettingsTab.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedAgendaView.ts
    - src/views/EmbeddedCalendarView.ts
decisions:
  - "typescript bumped 4.7.4 → ^5.9.3 (mandatory: typescript-eslint@8 peer requires >=4.8.4 <6.1.0)"
  - "ui/sentence-case added to Phase 6 override block (dry-run discovery: all UI-facing files trip this rule)"
  - "no-tfile-tfolder-cast added to Phase 7 override (as TFile casts needed to fix TS 5.x type errors from obsidian-daily-notes-interface dual-module resolution)"
  - "detach-leaves added to Phase 7 override (src/main.ts)"
  - "no-unnecessary-type-assertion added to Phase 7 override (as TFile casts we added to fix TS 5.x errors)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-13"
  tasks: 3
  files_changed: 8
---

# Phase 5 Plan 03: ESLint 9 + obsidianmd + per-phase overrides + CI gate (DOC-01) Summary

ESLint 9 flat config installed with `eslint-plugin-obsidianmd@0.3.0`, `typescript-eslint@8.59.3`, TypeScript bumped 4.7.4 → ^5.9.3, phase-tagged override blocks authored, and `.github/workflows/lint.yml` added as a CI gate on every push and PR.

## Execution Log

### Task 1: TypeScript Bump + ESLint Toolchain Install

**Step A — TypeScript bump in isolation:**

`typescript` changed from `"4.7.4"` to `"^5.9.3"` in `package.json`. After `npm install`, ran `npx tsc -noEmit -skipLibCheck`.

**TS 5.x errors surfaced (Rule 1 — auto-fixed in Task 1):**

Two errors in `src/settings/SettingsTab.ts` from TS 5.x correctly identifying unreachable `??` fallbacks:
```
src/settings/SettingsTab.ts(76,28): error TS2869: Right operand of ?? is unreachable because the left operand is never nullish.
src/settings/SettingsTab.ts(262,28): error TS2869: Right operand of ?? is unreachable because the left operand is never nullish.
```

Root cause: `!x ?? y` — `!x` is always boolean (never nullish), so `?? y` is dead code. TS 4.7 did not catch this narrowing; TS 5.x does.

Fix applied:
- Line 76: `!this.collapsedSections.get(name) ?? !defaultCollapsed` → `!(this.collapsedSections.get(name) ?? defaultCollapsed)`
- Line 262: `!this.collapsedCalendars.get(index) ?? false` → `!(this.collapsedCalendars.get(index) ?? false)`

After fix: `npx tsc -noEmit -skipLibCheck` exits 0.

**Step B — ESLint toolchain install:**

After installing the 4 new packages and removing the 2 legacy ones, a second round of `npx tsc -noEmit -skipLibCheck` errors appeared from `obsidian-daily-notes-interface` having its own bundled `obsidian` at an older version (missing `Vault.appendBinary`). TS 5.x is stricter about structural type compatibility across dual-module resolutions.

Three errors:
```
src/views/CalendarView.ts(825,29): error TS2345: Argument of type '.../obsidian-daily-notes-interface/node_modules/obsidian/obsidian'.TFile is not assignable to parameter of type '.../obsidian/obsidian'.TFile.
src/views/EmbeddedAgendaView.ts(381,29): error TS2345: (same)
src/views/EmbeddedCalendarView.ts(233,29): error TS2345: (same)
```

Fix: added `as TFile` cast at each `leaf.openFile(dailyNote)` call, and added `TFile` to the obsidian import in `EmbeddedAgendaView.ts` and `EmbeddedCalendarView.ts` (they did not previously import it).

After fixes: `npx tsc -noEmit -skipLibCheck` exits 0.

**`tsc -noEmit -skipLibCheck` exit-0 confirmation:** PASS

**Dependency verification:**
```
deps ok
memochron@1.14.0 /Users/mike/code/memoChron
└── eslint-plugin-obsidianmd@0.3.0
```

Lockfile confirms:
- `node_modules/eslint`: 9.39.4
- `node_modules/typescript-eslint`: 8.59.3
- `node_modules/eslint-plugin-obsidianmd`: 0.3.0
- `node_modules/typescript`: 5.9.3
- `node_modules/@typescript-eslint/eslint-plugin`: NOT FOUND (removed)
- `node_modules/@typescript-eslint/parser`: NOT FOUND (removed)

---

### Task 2: eslint.config.mjs + lint scripts + dry-run tuning

**Step B — Scripts added to package.json:**
- `"lint": "eslint src/"`
- `"lint:fix": "eslint src/ --fix"`

**Dry-run iteration 1 — initial run with researcher's skeleton globs:**

Exit code: 1. 50 problems (48 errors, 2 warnings) across all src/ files.

Categories of violations found OUTSIDE the initial override blocks:
1. `obsidianmd/ui/sentence-case` — new rule discovery; fires on ALL UI-facing strings with proper nouns/acronyms (MemoChron, iCal, Google Calendar, iCloud, Outlook). Affects: `src/services/CalendarService.ts`, `src/settings/SettingsTab.ts`, `src/utils/viewRenderers.ts`, `src/views/CalendarView.ts`, `src/views/EmbeddedAgendaView.ts`, `src/views/EmbeddedCalendarView.ts`.
2. `obsidianmd/detach-leaves` — in `src/main.ts` (in Phase 7 files but rule not silenced).
3. `obsidianmd/no-static-styles-assignment` — in `src/views/CalendarView.ts` (not in initial Phase 6 `files` array which only had `SettingsTab.ts`).
4. `@typescript-eslint/no-unnecessary-type-assertion` — in `src/views/CalendarView.ts` lines 432, 1221 (the `as TFile` casts added to fix TS 5.x errors, plus pre-existing casts).
5. `obsidianmd/prefer-active-doc` warnings — in `src/utils/colorValidation.ts` and `src/utils/viewRenderers.ts` (not in Phase 7 `files` array).

**Dry-run iteration 1 — override block expansions:**
- Phase 6 `files` array: added `src/views/CalendarView.ts`
- Phase 6: added a second sibling block for `obsidianmd/ui/sentence-case` covering all 6 UI-facing files
- Phase 7 `files` array: added `src/utils/colorValidation.ts`, `src/utils/viewRenderers.ts`
- Phase 7 rules: added `obsidianmd/detach-leaves`, `@typescript-eslint/no-unnecessary-type-assertion`

**Dry-run iteration 2:**

Exit code: 1. Only `obsidianmd/ui/sentence-case` errors remained (39 errors) — the new sibling Phase 6 block wasn't yet authored.

**Dry-run iteration 3 (with ui/sentence-case block):**

Exit code: 0. Zero errors, zero warnings.

**`npm run lint` exits 0 — CONFIRMED.**

**Final `npm run lint` exit-0 output:**
```
(empty — eslint exits silently with no output when there are no violations)
lint exit 0
```

**Final per-phase override-block `files` arrays:**

Phase 6 (DIR-02 / DIR-03 / DIR-04 + ui/sentence-case):
- Block A (innerHTML/styles/createElement): `["src/settings/SettingsTab.ts", "src/views/CalendarView.ts"]`
- Block B (ui/sentence-case): `["src/services/CalendarService.ts", "src/settings/SettingsTab.ts", "src/utils/viewRenderers.ts", "src/views/CalendarView.ts", "src/views/EmbeddedAgendaView.ts", "src/views/EmbeddedCalendarView.ts"]`

Phase 7 (DIR-05 / DIR-06 / DIR-07 / DIR-08 + detach-leaves + no-unnecessary-type-assertion):
`["src/main.ts", "src/views/CalendarView.ts", "src/views/EmbeddedCalendarView.ts", "src/views/EmbeddedAgendaView.ts", "src/settings/SettingsTab.ts", "src/services/CalendarService.ts", "src/services/NoteService.ts", "src/utils/colorValidation.ts", "src/utils/viewRenderers.ts"]`

Phase 8 (DIR-01 / DIR-09 / DIR-10):
`["src/**/*.ts"]`

**Regression smoke check:**

A deliberate `innerHTML` write and `document.createElement` call were added to `src/services/CalendarService.ts` (which is NOT in the Phase 6 override block):

```typescript
const el = document.createElement("div");
el.innerHTML = "x"; // SMOKE TEST — deliberate innerHTML write
```

`npm run lint` output (exit code 1):
```
/Users/mike/code/memoChron/src/services/CalendarService.ts
  271:16  error  DIR-04: Use Obsidian's createEl/createDiv/createSpan helpers instead of document.createElement  no-restricted-syntax
  272:5   error  Do not write to DOM directly using innerHTML/outerHTML property                                  @microsoft/sdl/no-inner-html

✖ 2 problems (2 errors, 0 warnings)
```

Rules triggered: `no-restricted-syntax` (our hand-rolled DIR-04 selector) and `@microsoft/sdl/no-inner-html`. The gate works. Edit reverted; `npm run lint` exits 0.

---

### Task 3: .github/workflows/lint.yml

Created `.github/workflows/lint.yml` from the `obsidian-sample-plugin` reference:
- `name: Lint`
- Triggers: `push: branches: ['**']` + `pull_request: branches: ['**']`
- `jobs.lint.runs-on: ubuntu-latest`
- `strategy.matrix.node-version: [20.x, 22.x]`
- Steps: `actions/checkout@v4`, `actions/setup-node@v4` with `cache: 'npm'`, `npm ci`, `npm run lint`
- No `npm run build`, no `if:` gating

YAML verified: `lint.yml ok`.

`release.yml`, `claude.yml`, `claude-code-review.yml` — untouched.

---

## git diff --stat

```
 package-lock.json                 | 4955 ++++++++++++++++++++++++--------
 package.json                      |   12 +-
 src/settings/SettingsTab.ts       |    4 +-
 src/views/CalendarView.ts         |    2 +-
 src/views/EmbeddedAgendaView.ts   |    4 +-
 src/views/EmbeddedCalendarView.ts |    4 +-
 6 files changed, 3873 insertions(+), 1108 deletions(-)
 [eslint.config.mjs: new file, ~140 lines]
 [.github/workflows/lint.yml: new file, ~23 lines]
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unreachable `??` fallback in SettingsTab.ts (TS 5.x narrowing)**
- **Found during:** Task 1 Step A (TS bump isolation)
- **Issue:** `!x ?? y` — negation of a Map.get() result is always boolean; TS 5.x correctly flags the `??` as unreachable. TS 4.7 was less strict.
- **Fix:** Changed to `!(x ?? defaultValue)` at lines 76 and 262 of `src/settings/SettingsTab.ts`.
- **Files modified:** `src/settings/SettingsTab.ts`

**2. [Rule 1 - Bug] Fixed TFile type mismatch from dual-module obsidian resolution (TS 5.x structural typing)**
- **Found during:** Task 1 Step B (after ESLint toolchain install with new node_modules)
- **Issue:** `obsidian-daily-notes-interface` bundles its own `obsidian` peer at an older version missing `Vault.appendBinary`. TS 5.x is stricter about structural compatibility between the two `TFile` types from different `obsidian` resolutions.
- **Fix:** Added `as TFile` cast at `leaf.openFile(dailyNote as TFile)` in all three view files. Added `TFile` to obsidian imports in `EmbeddedAgendaView.ts` and `EmbeddedCalendarView.ts`.
- **Files modified:** `src/views/CalendarView.ts`, `src/views/EmbeddedAgendaView.ts`, `src/views/EmbeddedCalendarView.ts`

**3. [Rule 2 - Auto-expand] Expanded Phase 6 override block to include CalendarView.ts for no-static-styles-assignment**
- **Found during:** Task 2 dry-run iteration 1
- **Issue:** `obsidianmd/no-static-styles-assignment` fires on `src/views/CalendarView.ts` (inline `.style.display` assignments in the month/week view rendering). Initial Phase 6 `files` array only included `SettingsTab.ts`.
- **Fix:** Added `src/views/CalendarView.ts` to Phase 6 override block's `files` array.

**4. [Rule 2 - Auto-expand] Added ui/sentence-case override block to Phase 6 (new rule discovered in dry-run)**
- **Found during:** Task 2 dry-run iteration 1
- **Issue:** `obsidianmd/ui/sentence-case` was not anticipated in the researcher's override skeleton. The rule fires on all UI-facing strings containing proper nouns or acronyms (MemoChron, iCal, Google Calendar, iCloud, Outlook, etc.) across 6 files.
- **Fix:** Added a second Phase 6 sibling config object silencing `obsidianmd/ui/sentence-case` for the 6 affected files.
- **Phase tag:** Appropriately assigned to Phase 6 — UI text copy normalisation is within the scope of the DOM-API refactor.

**5. [Rule 2 - Auto-expand] Added detach-leaves, no-unnecessary-type-assertion to Phase 7 override block**
- **Found during:** Task 2 dry-run iteration 1
- **Issue:** `obsidianmd/detach-leaves` fires in `src/main.ts` (pre-existing pattern). `@typescript-eslint/no-unnecessary-type-assertion` fires on the `as TFile` casts added in Task 1 Step B fix (and on pre-existing casts in CalendarView.ts).
- **Fix:** Added both rules to Phase 7 `rules` object (already covers lifecycle/compatibility cleanup).

**6. [Rule 2 - Auto-expand] Added colorValidation.ts + viewRenderers.ts to Phase 7 files**
- **Found during:** Task 2 dry-run iteration 1
- **Issue:** `obsidianmd/prefer-active-doc` warnings in `src/utils/colorValidation.ts:46` and `src/utils/viewRenderers.ts:144` — these files were not in the initial Phase 7 `files` array.
- **Fix:** Added both files to Phase 7 `files` array.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. ESLint and lint.yml are dev-time tooling only.

The `as TFile` casts added to fix TS 5.x errors introduce `obsidianmd/no-tfile-tfolder-cast` violations — these are correctly suppressed by the Phase 7 override block and scheduled for remediation in Phase 7 (DIR-05).

**T-05-08 (eslint-disable tampering):** `grep -c "eslint-disable" eslint.config.mjs` returns 1 — the word appears only in the header comment explaining that NO inline disables are used. Zero inline eslint-disable directives in all `src/` files. Confirmed.

---

## Commit Details

**Commit title:** `chore(lint): add ESLint 9 + obsidianmd + per-phase overrides + CI gate (DOC-01)`

**Commit body notes:**
- TypeScript bumped 4.7.4 → ^5.9.3: mandatory deviation; typescript-eslint@8 peer-requires `typescript >=4.8.4 <6.1.0`. Current 4.7.4 is below the floor.
- lint.yml uses `actions/checkout@v4` and `actions/setup-node@v4` (sample-plugin canonical pins); release.yml retains its existing `@v3` pins (deferred per Phase 5 plan 02 purist-path decision).
- Two TS 5.x narrowing bugs fixed in-place (Rule 1 auto-fixes) during TS bump isolation step.
- Three view files updated with `as TFile` cast to resolve TS 5.x dual-module `TFile` type mismatch.

---

## Files Modified Outside files_modified (plan spec)

Per plan spec, `files_modified` lists: `package.json`, `package-lock.json`, `eslint.config.mjs`, `.github/workflows/lint.yml`.

Additional files modified as Rule 1/2 auto-fixes during TS 5.x migration:
- `src/settings/SettingsTab.ts` — two `??` operator precedence fixes (TS 5.x TS2869)
- `src/views/CalendarView.ts` — `as TFile` cast for dual-module type fix
- `src/views/EmbeddedAgendaView.ts` — `TFile` import + `as TFile` cast
- `src/views/EmbeddedCalendarView.ts` — `TFile` import + `as TFile` cast

These are all in the same commit per the single-commit strategy (D-11).

## Self-Check

Checking created files and ensuring no prior eslint-disable directives in src/:
- eslint.config.mjs: FOUND
- .github/workflows/lint.yml: FOUND
- npm run lint: PASSES (exit 0)
- tsc -noEmit -skipLibCheck: PASSES (exit 0)
- No eslint-disable in src/ files: CONFIRMED (all return 0)
