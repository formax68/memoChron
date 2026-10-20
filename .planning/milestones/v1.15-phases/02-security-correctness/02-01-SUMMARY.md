---
phase: 02-security-correctness
plan: 01
subsystem: security
tags: [color-validation, regex-whitelist, loadSettings, svg-injection, sec-01]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: live-settings pattern (plugin owns settings, services read live)
provides:
  - "src/utils/colorValidation.ts with isValidColor, defaultColorForIndex, defaultDailyNoteColor"
  - "load-time color-validation pass in main.ts loadSettings()"
  - "anchored union regex VALID_COLOR_REGEX rejecting markup-breaking characters in CSS color strings"
affects: [02-02-svg-render-time-guard, 02-render-time-color-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Load-time validation of trust-boundary data — read from disk, validate, replace silently with warn"
    - "Whitelist regex with explicit format alternation and start/end anchors"
    - "Console.warn (no Notice) for developer-diagnostic events per D-04"

key-files:
  created:
    - src/utils/colorValidation.ts
  modified:
    - src/main.ts

key-decisions:
  - "Used a single union regex (not discriminated set) for the whitelist — one source of truth, easier to audit; matches planner's preference recorded in PLAN read_first context"
  - "defaultColorForIndex applied to calendarUrls (golden-angle hsl), defaultDailyNoteColor applied to dailyNoteColor (CSS-var with hex fallback) — mirrors existing SettingsTab analogs verbatim"
  - "Replacement is silent + console.warn (no Notice) per D-04 — invalid color is a dev-diagnostic event"
  - "Do not call saveData after replacement — corrected value persists on the next legitimate saveSettings; forcing a write on every load is out of scope"

patterns-established:
  - "Color-validation utility module pattern: pure functions, no imports, named exports only (mirrors pathUtils.ts module shape)"
  - "Trust-boundary validation pass after Object.assign in loadSettings — runs before any view/service consumes settings"

requirements-completed: [SEC-01]

# Metrics
duration: ~18min
completed: 2026-05-11
---

# Phase 02 Plan 01: Color Validation Utility + Load-Time Guard Summary

**Anchored whitelist regex + load-time `loadSettings` pass that replaces any malformed `data.json` color value with a deterministic default before any view consumes it.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-11T06:17:00Z
- **Completed:** 2026-05-11T06:22:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- New `src/utils/colorValidation.ts` exports three pure helpers (`isValidColor`, `defaultColorForIndex`, `defaultDailyNoteColor`) with zero imports — uses only browser globals.
- `isValidColor` uses an anchored union regex that accepts the four CSS color formats produced by this codebase (hex 3/4/6/8, `hsl/hsla(...)`, `rgb/rgba(...)`, `var(--name)`) and structurally rejects markup-breaking characters via `[^()<>]` inside function-call branches.
- `main.ts loadSettings()` extended with a validation pass over `settings.calendarUrls[].color` and `settings.dailyNoteColor`. Invalid values are replaced silently with helper output and emit `console.warn` with the offending value and calendar source name. No `Notice` (per D-04 — developer-diagnostic, not user-actionable).
- Original `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` line preserved verbatim — the validation block runs *after* the merge so DEFAULT_SETTINGS defaults are not double-validated.

## Key Implementation Details

### VALID_COLOR_REGEX

```text
/^(#[0-9a-fA-F]{3}([0-9a-fA-F]([0-9a-fA-F]{2}([0-9a-fA-F]{2})?)?)?|hsla?\([^()<>]*\)|rgba?\([^()<>]*\)|var\(--[a-zA-Z0-9_-]+\))$/
```

- Hex alternation matches exactly 3, 4, 6, or 8 hex digits after `#` — never 5 or 7 (verified by mental trace + 23-case spot-check).
- `hsla?\([^()<>]*\)` and `rgba?\([^()<>]*\)` branches reject `(`, `)`, `<`, `>` inside the function args — structurally prevents `hsl(1)">.<script>` style injection.
- `var(--[a-zA-Z0-9_-]+)` is the strictest branch — only valid CSS custom-property names.
- Leading `^` and trailing `$` anchors are critical — without them `#abc<script>` would partial-match.

### Replacement strategy

| Setting | Replacement helper | Source analog |
|---------|---------------------|---------------|
| `calendarUrls[].color` (invalid) | `defaultColorForIndex(index)` — `hsl((index * 137.5) % 360, 70%, 50%)` | `SettingsTab.getNextAvailableColor` (SettingsTab.ts:536-541) |
| `dailyNoteColor` (invalid) | `defaultDailyNoteColor()` — `getComputedStyle(document.documentElement).getPropertyValue("--interactive-accent").trim() \|\| "#7c3aed"` | `SettingsTab.ts:167-172` daily-note color fallback |

### loadSettings preservation

`grep -c "Object.assign({}, DEFAULT_SETTINGS, await this.loadData())" src/main.ts` → **1** (line preserved verbatim).

## Task Commits

1. **Task 1: Create src/utils/colorValidation.ts with isValidColor + default-color helpers** — `3d4c4fe` (feat)
2. **Task 2: Apply load-time color validation in src/main.ts loadSettings** — `a75981c` (feat)

## Files Created/Modified

- `src/utils/colorValidation.ts` (created) — 50 lines. Three exported functions plus module-private `VALID_COLOR_REGEX`. No imports.
- `src/main.ts` (modified, +28 lines) — Added 4-line import for the three helpers; extended `loadSettings()` with `calendarUrls[].color` and `dailyNoteColor` validation block.

## Decisions Made

- See `key-decisions` in frontmatter.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `node /Users/mike/code/memoChron/node_modules/typescript/bin/tsc -noEmit -skipLibCheck -p .` | Exit 0 (TSC_OK) |
| `NODE_PATH=... node esbuild.config.mjs production` | Exit 0 (main.js 261,244 bytes produced) |
| `grep -c "^export function isValidColor" src/utils/colorValidation.ts` | 1 |
| `grep -c "^export function defaultColorForIndex" src/utils/colorValidation.ts` | 1 |
| `grep -c "^export function defaultDailyNoteColor" src/utils/colorValidation.ts` | 1 |
| `grep -c "VALID_COLOR_REGEX" src/utils/colorValidation.ts` | 2 (declaration + use) |
| `grep -E "^import" src/utils/colorValidation.ts \| wc -l` | 0 (no imports) |
| `grep -c 'from "./utils/colorValidation"' src/main.ts` | 1 |
| `grep -c "isValidColor" src/main.ts` | 3 (1 import + 2 uses) |
| `grep -c "defaultColorForIndex" src/main.ts` | 2 (1 import + 1 use) |
| `grep -c "defaultDailyNoteColor" src/main.ts` | 2 (1 import + 1 use) |
| `grep -c "console.warn" src/main.ts` | 2 |
| `grep -c "MemoChron: Invalid" src/main.ts` | 2 |
| `grep -c "new Notice" src/main.ts` | 0 (no Notice introduced) |
| `grep -c "Object.assign({}, DEFAULT_SETTINGS, await this.loadData())" src/main.ts` | 1 (preserved verbatim) |

### Regex spot-check (23 inputs)

All 23 inputs produced the expected booleans. Notable cases:

| Input | Expected | Got |
|-------|----------|-----|
| `#abc` | true | true |
| `#abcd` | true | true |
| `#aabbcc` | true | true |
| `#aabbccdd` | true | true |
| `#abcde` (5-digit) | false | false |
| `#abcdef0` (7-digit) | false | false |
| `hsl(137, 70%, 50%)` | true | true |
| `hsla(0, 0%, 0%, 0.5)` | true | true |
| `rgb(0,0,0)` | true | true |
| `rgba(0, 0, 0, 0.5)` | true | true |
| `var(--color-red)` | true | true |
| `var(--interactive-accent)` | true | true |
| `var(--my_var-123)` | true | true |
| `#7c3aed` | true | true |
| `">.<script>alert(1)</script>` | false | false |
| `hsl(0, 0, 0)<script>` | false | false |
| `hsl(1)">.<script>` | false | false |
| `""` | false | false |
| `null` | false | false |
| `undefined` | false | false |
| `#abc<script>` | false | false |
| `var(--)` | false | false |
| `javascript:alert(1)` | false | false |

## Issues Encountered

- The worktree has no local `node_modules`; the `node_modules/.bin/tsc` shim from the main repo resolves `../lib/tsc.js` relative to its own real path, but the worktree-relative shim does not exist. Worked around by invoking the bundled `node /Users/mike/code/memoChron/node_modules/typescript/bin/tsc` and `NODE_PATH=/Users/mike/code/memoChron/node_modules node esbuild.config.mjs production` directly. Both commands ran cleanly. Recorded for future executor sessions in the worktree — `npm run build` cannot be invoked unmodified without symlinking `node_modules`.

## Threat Flags

None — no new network surface, no new file-access patterns, no schema changes. The only trust-boundary surface touched (disk → plugin `loadData()`) is already in the plan's `<threat_model>` register as THREAT-1, and this plan implements the assigned `mitigate` disposition.

## Next Phase Readiness

- **Plan 02-02** (render-time SVG `createElementNS` guard) consumes `isValidColor` from this file via `import { isValidColor } from "../utils/colorValidation"`. The named export is locked.
- **Plan 02-03+** (SEC-02 error normalization) is independent of this work.
- The load-time guard satisfies SEC-01 success criterion #1; criterion #2 (render-time `createElementNS`) is plan 02-02's deliverable.

## Self-Check: PASSED

- src/utils/colorValidation.ts: FOUND
- src/main.ts loadSettings validation block: FOUND (`grep -c "MemoChron: Invalid" src/main.ts` → 2)
- Commit 3d4c4fe (Task 1): FOUND in `git log --oneline`
- Commit a75981c (Task 2): FOUND in `git log --oneline`

---
*Phase: 02-security-correctness*
*Completed: 2026-05-11*
