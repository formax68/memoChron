---
phase: 08-type-hygiene-conventions
plan: 04
subsystem: lint
tags: [eslint, dir-01, dir-09, dir-10, checkpoint, architectural]
status: incomplete — Rule 4 architectural checkpoint

# Dependency graph
requires:
  - phase: 08-type-hygiene-conventions
    provides: "08-01 — DIR-10 unused-vars cleanup (Wave 1)"
  - phase: 08-type-hygiene-conventions
    provides: "08-02 — DIR-09 any/case-decl/useless-escape (Wave 2)"
  - phase: 08-type-hygiene-conventions
    provides: "08-03 — DIR-01 console cleanup (Wave 3)"
provides:
  - "Discovery: deleting the Phase-8 override block surfaces ~33 errors from rules NOT addressed by Plans 01–03 (the `@typescript-eslint/no-unsafe-*` typed-linting cascade from ical.js + obsidianmd/rule-custom-message on the one gated `console.log` site + 6 unused-disable directive warnings from Plan 03's wrong-rule disables)"
  - "Worktree is restored to pre-edit state (HEAD = ad33d3e); no commits land for Plan 04 until user resolves the architectural escalation"
affects: [08-04-PLAN, 08-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/08-type-hygiene-conventions/08-04-SUMMARY.md
  modified: []

key-decisions:
  - "Rule 4 escalation: discovered Plan 04 cannot land per its own must_haves (npm run lint exit 0 with only Phase-5 + .d.ts narrow overrides). Deleting eslint.config.mjs:73–113 (the Phase-8 override block) exposes ~33 errors split across three classes (typed-linting cascade, Plan 03 wrong-rule disables, obsidianmd/rule-custom-message). Reverted the pending edit and surfaced the architectural choice to the user."
  - "The pending eslint.config.mjs edit (42 lines removed) was prepared and validated against the mechanical acceptance criteria (every grep check passed), then reverted because npm run lint did not pass. The edit shape is correct; the post-conditions are not satisfiable without a Plan 04 amendment."

patterns-established: []

requirements-completed: []  # DIR-01, DIR-09, DIR-10 NOT closed at acceptance level — see Issues Encountered

# Metrics
duration: ~15min
completed: 2026-05-17
---

# Phase 8 Plan 4: Delete Phase-8 ESLint Override Block — CHECKPOINT

**Mechanical deletion of `eslint.config.mjs` lines 73–113 succeeds (-42 lines, every grep criterion passes), but the resulting lint state has 33 errors + 6 warnings — none of which are auto-fixable inside Plan 04's stated scope. Reverted the edit; surfacing as Rule 4 architectural checkpoint for user resolution.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-17 (approx.)
- **Completed:** 2026-05-17 (checkpoint)
- **Tasks:** 0 of 1 committed (Task 1 prepared then reverted)
- **Files modified:** 0 (1 created — this SUMMARY)

## Status

**INCOMPLETE — Rule 4 architectural escalation.**

The plan's single task ("delete the Phase-8 override block, verify `npm run lint` passes clean") cannot complete because the post-deletion lint state has errors that fall outside Plan 04's scope.

The worktree state is:
- `eslint.config.mjs` — unchanged (`git checkout --` reverted the pending edit)
- `git status` — only this SUMMARY.md as a new file
- `npm run lint` (current) — 6 warnings, 0 errors (pre-Plan-04 baseline)
- `npm run build` — exit 0

## What I Tried

1. **Read `eslint.config.mjs` to locate the Phase-8 override block.** Per Amendment A3 in CONTEXT.md, the block was originally lines 65–105 but Plan 02 added the `**/*.d.ts no-explicit-any: off` exclusion at line 65–71, shifting the Phase-8 block. Located it via `grep -n "// Phase 8"` (lines 74 and 97).

2. **Identified exact span.** The contiguous Phase-8 block runs from line 73 (the `// ---...` separator preceding the first `// Phase 8` comment) through line 113 (the closing `},` of the second sub-block). Lines 65–71 (`**/*.d.ts` exclusion) are BEFORE the block and must remain. Lines 115–121 (`globalIgnores`) are AFTER the block and must remain.

3. **Deleted lines 73–113 (-42 lines).** Confirmed every mechanical acceptance criterion:
   - `grep -c "// Phase 8" eslint.config.mjs` → 0 ✓
   - `grep -c '"\*\*/\*\.d\.ts"' eslint.config.mjs` → 1 ✓ (`.d.ts` block preserved)
   - `grep -c "globalIgnores" eslint.config.mjs` → 2 ✓ (import + call)
   - `grep -c '"no-console": "off"'` → 0 ✓
   - `grep -c '"@typescript-eslint/no-explicit-any": "off"'` → 1 ✓ (only the `.d.ts` block)
   - `grep -c "no-unsafe-assignment"` → 0 ✓
   - `grep -c '"no-case-declarations": "off"'` → 0 ✓
   - `grep -c '"no-useless-escape": "off"'` → 0 ✓
   - `wc -l < eslint.config.mjs` → 80 (was 122; -42 lines; within "~75 ±10" target) ✓

4. **Ran `npm run lint`.** Failed: **33 errors, 6 warnings**.

5. **Reverted the edit** (`git checkout -- eslint.config.mjs`) because the plan's `must_haves.truths` line forbids the obvious fix (a new narrow override) and the alternative fixes spread work across multiple source files beyond Plan 04's `files_modified` of `eslint.config.mjs`.

## The Three Error Classes

### Class 1: `@typescript-eslint/no-unsafe-*` typed-linting cascade (32 errors)

The Phase-8 override block silenced 5 typed-linting rules (`no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-argument`, `no-unsafe-call`, `no-unsafe-return`). These are siblings of `no-explicit-any` from `tseslint.configs.recommendedTypeChecked`. Removing the override surfaces real violations:

| File | Sites | Root cause |
| ---- | ----- | ---------- |
| `src/main.ts` | 1 | `Object.assign(...)` with `await this.loadData()` (Obsidian API returns `any`) |
| `src/services/CalendarService.ts` | 16 | `ICAL.parse()`, `getFirstPropertyValue()`, `getFirstValue()` all declared as `any` in `ical.d.ts` |
| `src/services/IcsImportService.ts` | 9 | Same — ical.js `any` returns propagate |
| `src/services/NoteService.ts` | 3 | `getFirstPropertyValue()`/`getFirstValue()` returns assigned to `string` params |
| `src/views/CalendarView.ts` | 2 | `this.handleDragMove.bind(this)` — `bind()` returns `any` when bound method's `this` is loosely typed |

**These violations were not anticipated.** CONTEXT.md inventoried `no-explicit-any` (12 sites) and `no-unused-vars` (18 sites) but did NOT inventory the `no-unsafe-*` cascade because the Phase-8 override block was silencing them at inventory time. RESEARCH.md's "ESLint Final State" section assumed Plan 02's source-level `no-explicit-any` closures would also close the cascade — but the bulk of the cascade comes from `ical.d.ts` declarations (`parse: any`, `getFirstPropertyValue: any`, `getFirstValue: any`) which Plan 02 explicitly **preserved** as `any` per D-08 (only `getValues()` and `jCal` were tightened; the other 4 `any` returns in the shim remained, and the `**/*.d.ts no-explicit-any: off` exclusion silences them in the shim file itself but not in their consumption sites).

### Class 2: `obsidianmd/rule-custom-message` on `console.log` (1 error)

`src/services/CalendarService.ts:303` — `if (DEBUG) console.log("MemoChron: No cache found or cache invalid", errorMessage(error));`

The Phase-8 override block disabled `obsidianmd/rule-custom-message`. After deletion, the rule fires on this `console.log` (the obsidianmd rule allows `warn`, `error`, `debug` but **not** `log`).

Plan 03 placed a `// eslint-disable-next-line no-console -- DEBUG flag (Phase 8 D-07)` comment on this site, expecting that `no-console` would be the rule firing. But `no-console` is silenced by `obsidianmd/rule-custom-message` even without the Phase-8 override — they're a coordinated pair where the obsidianmd rule handles `console.log` and routes the others through `no-console`'s `allow` list. Plan 03's disable targets the wrong rule.

### Class 3: Plan 03's unused-disable directives (6 warnings)

The same 6 sites Plan 03 gated have `// eslint-disable-next-line no-console -- DEBUG flag (Phase 8 D-07)` comments. With `no-console` set to `0` (off) globally by the recommended config (not by the Phase-8 override), these disables never had any effect — they're "unused eslint-disable directives".

Plan 03's SUMMARY explicitly predicted: "exit 0 (warnings only — 'Unused eslint-disable directive' on the 6 gated sites; these become active once Plan 04 removes the global no-console override at eslint.config.mjs:85)". This prediction was wrong — `no-console` is OFF in the recommended config, not just in the override.

## The Architectural Decision (Rule 4)

The fix paths are:

### Option A: Hand-type the `ical.d.ts` `any` returns

- Tighten `parse(input: string): any` → `unknown` in `ical.d.ts:72`
- Tighten `getFirstPropertyValue(name: string): any` → `unknown` in `ical.d.ts:8`
- Tighten `getFirstValue(): any` → `unknown` in `ical.d.ts:12`
- Tighten `constructor(jCal: any)` → `unknown` in `ical.d.ts:3`
- Tighten `static fromData(data: any)` → `unknown` in `ical.d.ts:59`
- Each consumer site narrows via `if (typeof value === "string")` / `value instanceof Time` / explicit cast with rationale

**Pros:** No new lint overrides; closes the cascade at source; the `unknown` migration is recommended by `@typescript-eslint/no-explicit-any` rule's `fixToUnknown: true` setting (already in the recommended config).
**Cons:** Touches ~5 source files beyond Plan 04's `files_modified` (eslint.config.mjs only). Partial overlap with deferred FRAG-02 work. Plan 04 becomes much larger than its stated scope.
**Estimated effort:** 1–2 hours.

### Option B: Add a narrow `no-unsafe-*: off` block for `src/**/*.ts`

```js
// D-08 (extension) — ical.js consumption cascade. Same root cause as the
// **/*.d.ts no-explicit-any: off exclusion: ical.js is fundamentally untyped.
// Hand-typing its API is deferred to FRAG-02. The typed-linting cascade from
// its any returns is silenced here so source code can call ical.js APIs without
// per-line disables.
{
  files: ["src/**/*.ts"],
  rules: {
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-return": "off",
  },
},
```

**Pros:** Small (5 lines + comment), matches D-08's documented spirit ("lint-exclude for ical.js cascade"), keeps Plan 04 within its `files_modified` scope, doesn't touch any source file.
**Cons:** Violates the strict reading of Plan 04's `must_haves.truths` ("only Phase-5 + `**/*.d.ts` exclusion"). Adds a new narrow override (not present in must_haves but also not "tied to scorecard findings" since `no-unsafe-*` is not a scorecard rule).
**Estimated effort:** 5 minutes.

### Option C: Hybrid — Tighten `parse` and `getFirstPropertyValue` to `unknown` (Option A subset) + add per-line disables at the remaining 2–3 sites where narrowing is not worth the cost

**Pros:** Compromises between cleanliness and effort.
**Cons:** Mixed pattern, harder to document in CONVENTIONS.md (Plan 05/DOC-02 target).
**Estimated effort:** 30–60 min.

### Plan 04 amendment + companion fixes

Regardless of A/B/C, two **definitely required** fixes (not architectural — Rule 1 bug fixes for prior plans):

1. **Class 2 (CalendarService.ts:303):** Change `console.log` to `console.debug` so the obsidianmd rule allows it. (Plan 03 used `console.log` for this site because the `MemoChron:` log prefix convention — but `console.debug` would have been the convention-compliant choice that doesn't trigger the obsidianmd rule.)

2. **Class 3 (6 sites):** Remove the unused `eslint-disable-next-line no-console -- DEBUG flag (Phase 8 D-07)` comments. They never had any effect (the rule they target was already off). Plan 03's intent was to "prepare for Plan 04's override removal", but the wrong rule was targeted, so the directives are pure noise.

These two fixes could be folded into Plan 04 as the "obvious" Rule 1 bug repair, OR they could be split into a separate Plan 04b. The architectural choice is between Options A/B/C for Class 1.

## Recommendation

**Option B** with a brief Plan 04 amendment to its `must_haves.truths`:

> "npm run lint exits 0 cleanly without any per-rule or per-file disables tied to **scorecard findings**. Two siblings of the existing `**/*.d.ts` exclusion are also present: the same exclusion for `**/*.d.ts` (Plan 02) and a `src/**/*.ts no-unsafe-*: off` block (this plan, D-08-extension) — both close the same root cause (ical.js is untyped; hand-typing deferred to FRAG-02)."

**Why:**

1. **It matches CONTEXT.md D-08's documented strategy.** D-08 chose lint-exclusion over hand-typing for ical.js. The `.d.ts` exclusion silences the rule at its source declarations; the new `src/**/*.ts` exclusion silences the same rule's typed-linting siblings at consumption sites. Same root cause, same chosen treatment.

2. **It's the smallest correct close.** 5 lines vs. ~50 lines of source narrowing.

3. **It's not "tied to a scorecard finding".** `no-unsafe-*` is not a DIR-NN finding. The plan's must_haves prohibit overrides tied to scorecard findings; this override is tied to "ical.js is untyped" which is the existing D-08 root cause.

4. **It defers FRAG-02 cleanly.** FRAG-02 is explicitly deferred per CONTEXT.md "Deferred Ideas". Closing the cascade by hand-typing today re-opens FRAG-02 work that the user already decided to defer.

5. **It surfaces clearly in CONVENTIONS.md.** Plan 05 (DOC-02) can document the "ical.js cascade" pattern explicitly in the Type Hygiene cluster, alongside the `**/*.d.ts` exclusion, as a documented escape hatch.

But this is the user's call — Plan 04's `must_haves` line is strict.

## Files Created/Modified

- `.planning/phases/08-type-hygiene-conventions/08-04-SUMMARY.md` — this checkpoint summary

## Task Commits

None — Plan 04's Task 1 was prepared, validated against mechanical acceptance criteria, then reverted because `npm run lint` did not pass. No source commits land for Plan 04 until the user resolves the architectural choice between Options A/B/C.

This SUMMARY is committed as `docs(08-04): checkpoint — override deletion blocked by typed-linting cascade` so the worktree merges cleanly back to main.

## Decisions Made

1. **Reverted the pending edit instead of forcing a fix.** The plan's Rule 4 trigger ("significant structural modification" — adding a new override changes the plan's defined output, multiple defensible options exist, user-locked must_haves are strict) outweighs the convenience of applying Option B autonomously. The user is the right decision-maker.

2. **Did not stage the SUMMARY without explaining the worktree state.** Per the worktree spawn contract, the SUMMARY MUST be committed before return. This SUMMARY documents the discovery, the three error classes, the three fix options, and the recommendation — without forcing a directional choice.

## Deviations from Plan

### Rule 4 — Architectural escalation

**1. [Rule 4 — Architectural] Removing the Phase-8 override block surfaces 33 typed-linting / obsidianmd errors not anticipated by CONTEXT.md or any prior plan**

- **Found during:** Plan 04 Task 1 (post-deletion `npm run lint`)
- **Issue:** Plan 04's `must_haves.truths` requires `npm run lint` exit 0 with only Phase-5 + `**/*.d.ts` overrides. After deletion, 33 errors remain (32 typed-linting cascade from ical.js untyped APIs + 1 obsidianmd/rule-custom-message on a `console.log` site Plan 03 gated with the wrong disable target).
- **Why it's Rule 4:** The fix paths require either (a) ~50 lines of source narrowing across 5 files (out of Plan 04's `files_modified` scope; partially re-opens deferred FRAG-02 work), (b) adding a new narrow override (violates the strict reading of must_haves), or (c) a hybrid. Each has tradeoffs; the user is the right decision-maker.
- **Action:** Reverted the pending `eslint.config.mjs` edit. Documented the discovery in this SUMMARY. Surfacing as checkpoint.
- **Files reverted:** `eslint.config.mjs` (back to its pre-edit state at HEAD `ad33d3e`)

## Issues Encountered

### Plan 03 disable-comment target

Plan 03 placed 6 `// eslint-disable-next-line no-console -- DEBUG flag (Phase 8 D-07)` comments on its gated forensic-log sites, expecting that Plan 04's deletion of the Phase-8 override's `"no-console": "off"` line would activate `no-console: error` globally and the disables would suppress real errors at those 6 sites.

**The actual end-state after deletion** is that `no-console` remains `0` (off) — it's not just the Phase-8 override that disabled it; it's also disabled by the obsidianmd recommended config (which routes `console.*` through `obsidianmd/rule-custom-message` instead). The disable comments target the wrong rule.

For the one site that actually fires (`CalendarService.ts:303` with `console.log`), the firing rule is `obsidianmd/rule-custom-message`, not `no-console`. The other 5 gated sites use `console.warn` or `console.error` which the obsidianmd rule allows — they need no disable at all.

**Net:** All 6 of Plan 03's disable comments should be removed (none of them serve a purpose), and the one `console.log` site should be changed to `console.debug` (which the obsidianmd rule allows). This is a Plan 03 Rule-1 bug surfaced by Plan 04; it can be auto-fixed by the executor IF the user authorizes it as part of Plan 04 resolution.

## Next Phase Readiness

**Plan 04 is INCOMPLETE.** It cannot land until the user resolves:

1. **Class 1 architectural choice** — Option A (hand-type ical.d.ts + narrow consumers) vs. Option B (add `no-unsafe-*: off` for `src/**/*.ts`) vs. Option C (hybrid)
2. **Class 2 + Class 3 housekeeping** — fold into Plan 04 (likely Rule-1 auto-fix once Class 1 is resolved) or split into Plan 04b

**Plan 05 (DOC-02 conventions doc) is blocked** until Plan 04 lands, because the closing commit's "lint passes clean" demonstration is a precondition for the DOC-02 acceptance criterion ("milestone-level fresh scorecard run shows zero remaining 'Avoid …' findings").

**Suggested next step:** User reviews this SUMMARY, picks an option for Class 1, and authorizes the executor to apply that option + the Class 2/3 fixes in a new wave (re-run Plan 04 with amended must_haves).

## Self-Check: PASSED

- File `.planning/phases/08-type-hygiene-conventions/08-04-SUMMARY.md` — created (this file).
- Worktree state — `git status --short` shows only this SUMMARY as new file; `eslint.config.mjs` reverted to HEAD.
- HEAD assertion — `git rev-parse --abbrev-ref HEAD` matches `worktree-agent-*` per spawn-time assertion.
- No source commits made — none required per the Rule-4 checkpoint protocol.

---
*Phase: 08-type-hygiene-conventions*
*Plan: 04*
*Status: INCOMPLETE — Rule 4 architectural checkpoint*
*Completed: 2026-05-17*
