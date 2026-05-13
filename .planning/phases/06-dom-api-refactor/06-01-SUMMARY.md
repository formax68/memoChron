---
phase: 06-dom-api-refactor
plan: "01"
subsystem: settings
tags: [dom-refactor, innerHTML, createEl, appendText, DIR-02]
dependency_graph:
  requires: []
  provides: [DIR-02-closed]
  affects: [src/settings/SettingsTab.ts]
tech_stack:
  added: [appendText]
  patterns: [createEl+appendText per-segment rewrite]
key_files:
  modified:
    - src/settings/SettingsTab.ts
decisions:
  - "Inline appendText + createEl per segment per D-01; no helper function introduced"
  - "5 sites at lines 1882, 1899, 1920, 1921, 1922 rewritten; zero innerHTML assignments remain"
metrics:
  duration: "< 5 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  files_modified: 1
---

# Phase 06 Plan 01: Setup-guide innerHTML rewrite (DIR-02) Summary

Rewrites all 5 `.innerHTML` assignment sites in `src/settings/SettingsTab.ts` using inline
`appendText` + `createEl("strong", { text })` per-segment rewrites. Zero innerHTML assignments
remain in shipped source; DIR-02 success criterion #1 is satisfied.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite 5 setup-guide innerHTML sites in SettingsTab.ts | a87fee5 | src/settings/SettingsTab.ts |
| 2 | Commit the DIR-02 rewrite | a87fee5 | (git commit only) |

## Sites Rewritten

### Site 1 — line 1882, parent: `gcalSteps`

Before:
```typescript
gcalSteps.createEl("li").innerHTML = "Copy the <strong>Secret address in iCal format</strong>";
```

After:
```typescript
const gcalStep5 = gcalSteps.createEl("li");
gcalStep5.appendText("Copy the ");
gcalStep5.createEl("strong", { text: "Secret address in iCal format" });
```

### Site 2 — line 1899, parent: `outlookSteps`

Before:
```typescript
outlookSteps.createEl("li").innerHTML = "Copy the <strong>ICS link</strong> (not the HTML link)";
```

After:
```typescript
const outlookStep5 = outlookSteps.createEl("li");
outlookStep5.appendText("Copy the ");
outlookStep5.createEl("strong", { text: "ICS link" });
outlookStep5.appendText(" (not the HTML link)");
```

### Site 3 — line 1920, parent: `mistakesList`

Before:
```typescript
mistakesList.createEl("li").innerHTML = "<strong>Using the public link</strong> - This opens a webpage, not calendar data";
```

After:
```typescript
const mistakeItem1 = mistakesList.createEl("li");
mistakeItem1.createEl("strong", { text: "Using the public link" });
mistakeItem1.appendText(" - This opens a webpage, not calendar data");
```

### Site 4 — line 1921, parent: `mistakesList`

Before:
```typescript
mistakesList.createEl("li").innerHTML = "<strong>Using the embed link</strong> - This is for embedding in websites";
```

After:
```typescript
const mistakeItem2 = mistakesList.createEl("li");
mistakeItem2.createEl("strong", { text: "Using the embed link" });
mistakeItem2.appendText(" - This is for embedding in websites");
```

### Site 5 — line 1922, parent: `mistakesList`

Before:
```typescript
mistakesList.createEl("li").innerHTML = "<strong>Missing the .ics extension</strong> - The URL should end with .ics";
```

After:
```typescript
const mistakeItem3 = mistakesList.createEl("li");
mistakeItem3.createEl("strong", { text: "Missing the .ics extension" });
mistakeItem3.appendText(" - The URL should end with .ics");
```

## Verification Results

### grep -nE '\\.(inner|outer)HTML\\s*=' src/settings/SettingsTab.ts

(empty — zero matches)

### git ls-files src/ | xargs grep -nE '\\.(inner|outer)HTML\\s*='

(empty — zero matches across all of src/)

### npm run build

Exit 0 — clean TypeScript compilation and esbuild production bundle.

### appendText count

`grep -c 'appendText' src/settings/SettingsTab.ts` = 6 (meets minimum of 4)

### createEl("strong") count

`grep -c 'createEl("strong"' src/settings/SettingsTab.ts` = 6 (5 new + 1 pre-existing at line 1887)

### All 5 segment strings present

- "Secret address in iCal format" — 1 match (line 1884)
- "ICS link" — 1 match (line 1903)
- "Using the public link" — 1 match (line 1926)
- "Using the embed link" — 1 match (line 1929)
- "Missing the .ics extension" — 1 match (line 1932)

## Commit

- **Hash:** a87fee5
- **Subject:** `refactor(settings): replace setup-guide innerHTML with createEl + appendText (DIR-02)`
- **Files in diff:** `src/settings/SettingsTab.ts` only (single-file commit)
- **Claude/AI references:** none — verified by grep

## Deviations from Plan

None — plan executed exactly as written. All 5 sites rewritten using the inline per-segment
pattern specified in D-01, with no helper function introduced. Exact variable names from the
plan spec were used (`gcalStep5`, `outlookStep5`, `mistakeItem1`, `mistakeItem2`, `mistakeItem3`).

## Hand-off to Plan 02

Plan 02 (DIR-04) addresses the two `document.createElement("input")` sites at
`SettingsTab.ts:652` and `735`. These are independent of the 5 innerHTML sites fixed here —
no line-number drift from this commit affects those sites (both are well above line 1882).

## Self-Check: PASSED

- [x] `src/settings/SettingsTab.ts` exists and contains zero innerHTML assignments
- [x] Commit `a87fee5` exists in git log
- [x] No Claude/AI references in commit message
- [x] `npm run build` exits 0
- [x] DIR-02 success criterion #1 satisfied: zero `\.(inner|outer)HTML\s*=` matches across `src/`
