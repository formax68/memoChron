---
phase: 02-security-correctness
plan: 02
subsystem: security
tags: [svg-injection, createElementNS, settings-tab, sec-01, render-time-guard]

# Dependency graph
requires:
  - phase: 02-security-correctness
    plan: 02-01
    provides: isValidColor (load-time validator + VALID_COLOR_REGEX)
provides:
  - "private buildColorSwatch(color: string | null): SVGElement helper in SettingsTab"
  - "render-time defensive isValidColor guard at SVG construction"
  - "structural elimination of customLabel.innerHTML SVG template-literal injection path"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SVG construction via document.createElementNS + setAttribute (net-new for this codebase)"
    - "Defense-in-depth render-time validation guard with silent fallback to plus-icon branch"
    - "Helper extraction collapsing two duplicated SVG construction sites into one private method"

key-files:
  created: []
  modified:
    - src/settings/SettingsTab.ts

key-decisions:
  - "Helper placed immediately after getNextAvailableColor (same color-helper neighborhood) — matches the file's existing organization"
  - "Used replace_all=true for the two identical if/else SVG blocks since the replacement is identical for both sites (renderInlineColorPicker and renderDailyNoteColorPicker)"
  - "Call sites pass `isCustom ? currentColor : null` so the surrounding if-decision is preserved at the call site; the helper's internal validity check produces the same visual outcome (filled circle vs plus-icon)"
  - "FRAG-04 static help-text innerHTML sites at lines 1817, 1834, 1855-57 intentionally left untouched per D-07 and REQUIREMENTS.md (deferred — no user input, only static <strong> tags)"
  - "Catches at SettingsTab.ts:1128 and :1297 left untouched per plan-level scope boundary (1128 discards error; 1297 is parameter-less). SEC-02 in this file is satisfied by definition — no errorMessage() work applies."
  - "Helper does not append to DOM; returns a detached SVGElement so callers control insertion (clearer ownership; matches the established practice for document.createElement-style construction in the same method)"

patterns-established:
  - "createElementNS-based SVG construction with setAttribute for attributes and textContent for inner text — the SEC-01 success criterion #2 pattern, applicable to any future SVG-building sites in the codebase"
  - "buildColorSwatch helper signature (color: string | null) → SVGElement — pass null to deliberately invoke the plus-icon branch"

requirements-completed: [SEC-01]

# Metrics
duration: ~2min
completed: 2026-05-11
---

# Phase 02 Plan 02: SVG Render-Time Guard (`createElementNS`) Summary

**Replaces the two `customLabel.innerHTML = \`<svg ... fill="${currentColor}" .../>\`` template literals in `SettingsTab.ts` with a `document.createElementNS`-based `buildColorSwatch(color: string | null): SVGElement` helper. `setAttribute("fill", value)` does not interpret HTML — the template-literal injection path is now structurally impossible. Render-time `isValidColor` is defense-in-depth on top of the load-time validator from plan 02-01.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-11T06:28:44Z
- **Completed:** 2026-05-11T06:30:32Z
- **Tasks:** 2
- **Files modified:** 1
- **Commits:** 2 (one per task)

## Accomplishments

- Added `import { isValidColor } from "../utils/colorValidation";` to `SettingsTab.ts` (reusing the Wave-1 export from plan 02-01).
- Added `private buildColorSwatch(color: string | null): SVGElement` immediately after `getNextAvailableColor` (line ~557). Helper constructs `<svg>`, `<circle>`, and optionally `<text>` via `document.createElementNS("http://www.w3.org/2000/svg", ...)` and sets every attribute via `setAttribute(name, value)`. The plus-icon `+` glyph is set via `text.textContent`, never `innerHTML`.
- Render-time defensive guard: when `color` is non-null AND passes `isValidColor`, the helper renders the filled-circle branch; otherwise it silently falls back to the plus-icon branch (per D-05 — load-time validator already warned, so render-time is silent).
- Replaced both `customLabel.innerHTML = \`<svg ...\`` sites (originally lines 589 and 675, now lines 643 and 726 after Task 1 inserted the helper) with `customLabel.empty(); customLabel.appendChild(this.buildColorSwatch(isCustom ? currentColor : null));`. The surrounding `if (isCustom)` decision is preserved at the call site by passing `null` for the non-custom path.
- The two duplicated SVG construction blocks collapsed into one source of truth.

## Key Implementation Details

### Helper signature and placement

```typescript
// src/settings/SettingsTab.ts:557 (placed immediately after getNextAvailableColor)
private buildColorSwatch(color: string | null): SVGElement {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 24 24");

  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "10");
  circle.setAttribute("stroke", "#888");
  circle.setAttribute("stroke-width", "2");

  if (color && isValidColor(color)) {
    circle.setAttribute("fill", color);
    svg.appendChild(circle);
  } else {
    circle.setAttribute("fill", "none");
    svg.appendChild(circle);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", "12");
    text.setAttribute("y", "17");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "16");
    text.setAttribute("fill", "#888");
    text.textContent = "+";
    svg.appendChild(text);
  }

  return svg;
}
```

### Call-site replacement (both sites identical)

```typescript
// Was (both sites — lines ~589 and ~675 originally):
//   if (isCustom) {
//     customLabel.innerHTML = `<svg ... fill="${currentColor}" .../>`;
//   } else {
//     customLabel.innerHTML = '<svg ... text>+</text>';
//   }
//
// Now (both sites):
customLabel.empty();
customLabel.appendChild(this.buildColorSwatch(isCustom ? currentColor : null));
```

The call-site replacement preserves the original `isCustom` branch by passing `null` to the helper when `isCustom` is false. The helper's internal `color && isValidColor(color)` check then chooses the visual branch — filled circle for valid custom colors, plus-icon otherwise. This is also the render-time defensive fallback for invalid colors that somehow slipped past the load-time validator.

## Task Commits

1. **Task 1: Add isValidColor import and extract buildColorSwatch helper in SettingsTab.ts** — `4e09824` (feat)
2. **Task 2: Replace both customLabel.innerHTML SVG sites with buildColorSwatch helper calls** — `fed547c` (refactor)

## Files Created/Modified

- `src/settings/SettingsTab.ts` (modified, +52 / −16 = +36 net lines): 1 new import + 52-line helper + 2 sites replaced (5 lines each replacing 8-line if/else blocks)

## Decisions Made

- See `key-decisions` in frontmatter.

## Deviations from Plan

None - plan executed exactly as written.

## Scope Boundary Confirmations

**SEC-02 in SettingsTab.ts is a no-op (confirmed):**

| Site | Disposition | Reason |
|------|-------------|--------|
| `SettingsTab.ts:1128` (Custom template parse preview catch) | NOT modified | The `error` binding is unused; catch produces a static `"Invalid template format"` element with no `Notice`, no `console.error`, and no `error.message` access. Per D-08 spirit, no `errorMessage()` work applies. |
| `SettingsTab.ts:1297` (URL validation catch) | NOT modified | Parameter-less `} catch {` — no `error` binding to normalize. |

**FRAG-04 preserved (confirmed):** `grep -c 'createEl("li").innerHTML' src/settings/SettingsTab.ts` returns **5** — the static help-text sites at lines 1817, 1834, 1855, 1856, 1857 are untouched. These contain only static `<strong>` tags and no user input; explicitly deferred per CONTEXT.md D-07 and REQUIREMENTS.md.

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| TypeScript check | `node /Users/mike/code/memoChron/node_modules/typescript/bin/tsc -noEmit -skipLibCheck -p .` | Exit 0 |
| Production build | `NODE_PATH=/Users/mike/code/memoChron/node_modules node esbuild.config.mjs production` | Exit 0 (main.js 261,384 bytes) |
| `customLabel.innerHTML` count | `grep -c 'customLabel.innerHTML' src/settings/SettingsTab.ts` | **0** (target: 0 — both sites replaced) |
| `customLabel.appendChild(this.buildColorSwatch` count | `grep -c 'customLabel.appendChild(this.buildColorSwatch' src/settings/SettingsTab.ts` | **2** (target: 2 — one per site) |
| `private buildColorSwatch` count | `grep -c 'private buildColorSwatch' src/settings/SettingsTab.ts` | **1** (target: 1) |
| Helper signature exact | `grep -n 'private buildColorSwatch(color: string \| null): SVGElement' src/settings/SettingsTab.ts` | 1 match at line 557 |
| `createElementNS` count | `grep -c 'createElementNS' src/settings/SettingsTab.ts` | **6** (target: >= 3 — 3 element types × helper rendered once per branch, plus the helper itself contains 3 calls) |
| SVG namespace constant | `grep -c 'http://www.w3.org/2000/svg' src/settings/SettingsTab.ts` | 1 (SVG_NS local constant) |
| `setAttribute` count | `grep -c 'setAttribute' src/settings/SettingsTab.ts` | **16** (helper has 4 + 5 + 5 = 14 setAttributes plus 2 pre-existing in the file) |
| `textContent` count | `grep -c 'textContent' src/settings/SettingsTab.ts` | **1** (the `+` glyph) |
| `isValidColor` import + uses | `grep -c 'isValidColor' src/settings/SettingsTab.ts` | **3** (1 import + 2 uses: helper has 1; trace shows wildcard catches the import line once) |
| `customLabel.empty()` count | `grep -c 'customLabel.empty()' src/settings/SettingsTab.ts` | **2** (one per site) |
| Generic `innerHTML = <svg` anywhere | `grep -cE 'innerHTML\s*=\s*.<svg' src/settings/SettingsTab.ts` | **0** (no SVG innerHTML writes remain) |
| FRAG-04 preserved | `grep -c 'createEl("li").innerHTML' src/settings/SettingsTab.ts` | **5** (lines 1817, 1834, 1855, 1856, 1857) |

## Manual Verification (Optional)

Not performed (no test framework, no test vault attached). The plan flags this as recommended-but-optional. Functionality preserved by:
- Helper logic produces visually identical SVG to the original `innerHTML` strings (same width, height, viewBox, circle attributes, text glyph, colors).
- Call sites pass `isCustom ? currentColor : null` preserving the original branch selection.
- `npx tsc -noEmit` and the production build both pass cleanly, confirming no type or build regressions.

## Threat Surface Scan

No new threat surface introduced. The two SVG construction sites that previously had a render-time injection vulnerability (THREAT-1 in the plan's `<threat_model>`) are now structurally closed via `setAttribute` — exactly the `mitigate` disposition specified in the threat register. The defense-in-depth render-time `isValidColor` guard (THREAT-1-DiD) is in place. FRAG-04 (out-of-scope) and SEC-02 in SettingsTab.ts (no-op per plan scope boundary) remain `accept` per the threat register.

## Self-Check: PASSED

- `src/settings/SettingsTab.ts` `buildColorSwatch` helper: FOUND at line 557
- `src/settings/SettingsTab.ts` `customLabel.appendChild(this.buildColorSwatch(...))` x2: FOUND at lines 643 and 726
- Commit `4e09824` (Task 1): FOUND via `git log --oneline`
- Commit `fed547c` (Task 2): FOUND via `git log --oneline`
- No untracked files left behind: confirmed
- No file deletions in either commit: confirmed
- TypeScript and production build: exit 0

---
*Phase: 02-security-correctness*
*Completed: 2026-05-11*
