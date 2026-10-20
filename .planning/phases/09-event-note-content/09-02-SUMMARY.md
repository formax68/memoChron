---
phase: 09-event-note-content
plan: 02
subsystem: notes
tags: [frontmatter, yaml, tags, line-scanner, harness, tdd]

requires:
  - phase: 09-event-note-content (plan 01)
    provides: "verify-09.mjs harness (loadBundle, createNote, workCalendar, makeEvent, CHECKS, 1.15.0 parity bundle)"
provides:
  - "src/utils/frontmatterTags.ts: pure line-scanning merger (TagMergeResult, mergeCalendarTags, normalizeTag, splitComment, yamlSafeTag)"
  - "generateFrontmatter merges calendar tags into an existing top-level tags key (block list, inline array, scalar, empty/null-ish), else keeps the 1.15.0 formatTagsYaml append"
  - "verify-09.mjs: checkTagsTracer (T1-T11), checkTagsShapes (F1-F18, U1-U6), dual-parser single-tags-key assertion, no-key 1.15.0 parity corpus"
affects: [09-verify, 11-docs (DOC-03), 11-issues (ISSUE-01 for #61)]

actuals:
  tokens: 6016
  tasks: 2
  commits: 3
plan_head_before: 83572047cb0f1b6314aa46b3aa58680cfb9d2e60
plan_head_after: f1ebaf75cbcc1490b4bbe502153755762f184755

tech-stack:
  added: []
  patterns:
    - "Conservative line-scanning edit of one YAML key: classify the shape, edit only that key's lines, leave unknown shapes byte-identical"
    - "Harness YAML validity via yaml (uniqueKeys: true) + js-yaml, both locked transitive dev deps, never imported from src/"

key-files:
  created:
    - src/utils/frontmatterTags.ts
  modified:
    - src/services/NoteService.ts
    - .planning/phases/09-event-note-content/verify-09.mjs

key-decisions:
  - "Merger lives in a pure module (no imports) so the harness can unit-probe it; NoteService only calls mergeCalendarTags after applyTemplateVariables and falls back to the untouched 1.15.0 append when found is false"
  - "Shapes the scanner cannot edit safely (multi-line flow, flow mapping, block scalar, anchor/alias/tag, mixed indents, duplicate tags keys, nested flow, unterminated or backslash-escaped quotes) are left byte-identical and calendar tags are skipped (D-03)"
  - "Calendar tags are quoted only when not plain-safe (yamlSafeTag, A2); the no-tags-key path still writes them unquoted exactly like 1.15.0 (D-02)"

patterns-established:
  - "Tag fixtures are exact-string input body -> expected frontmatter body through the real createEventNote path, each also passing assertSingleTagsKey"

requirements-completed: [BUG-08, BUG-09]

coverage:
  - id: D1
    description: "Calendar tags merge into an existing block-list, inline-array, scalar, empty or null-ish top-level tags key (global and per-calendar default frontmatter), giving exactly one tags key that parses under yaml (uniqueKeys) and js-yaml"
    requirement: BUG-08
    verification:
      - kind: integration
        ref: "node .planning/phases/09-event-note-content/verify-09.mjs#checkTagsTracer,checkTagsShapes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dedup by normalized form (quotes, leading #, case), user tags first in written form and order, calendar tags after in getTagsForEvent order; every other frontmatter line byte-identical; unsafe shapes U1-U6 untouched"
    requirement: BUG-09
    verification:
      - kind: integration
        ref: "node .planning/phases/09-event-note-content/verify-09.mjs#checkTagsTracer,checkTagsShapes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Frontmatter with no top-level tags key (empty, type-only, tag:/Tags:/nested tags, commented tags) produces notes byte-identical to the 1.15.0 NoteService, with and without calendar tags"
    requirement: BUG-09
    verification:
      - kind: integration
        ref: "node .planning/phases/09-event-note-content/verify-09.mjs#checkParity"
        status: pass
      - kind: other
        ref: "npm run lint && npm run build"
        status: pass
    human_judgment: false
  - id: D4
    description: "In Obsidian, notes created with block, inline, scalar and per-calendar tags frontmatter show exactly one tags property with user + calendar tags and no YAML or duplicate-key error"
    requirement: BUG-08
    verification: []
    human_judgment: true
    rationale: "Plan backstop truth (A1): the Obsidian Properties panel and its YAML parser cannot be exercised from Node; the Task 2 human-check steps are harvested into 09-HUMAN-UAT.md at end of phase"

duration: 4min
completed: 2026-10-20
status: complete
---

# Phase 9 Plan 02: Calendar Tags Merge Into Existing Frontmatter Tags Summary

**Pure line-scanning `mergeCalendarTags` merges a calendar's tags into the user's existing `tags` key, whether it is a block list, inline array, scalar or empty, with normalized dedup. Every other frontmatter line stays byte-identical, and frontmatter without a `tags` key still matches 1.15.0 byte for byte (fixes GitHub #61, BUG-08/BUG-09).**

## Performance

- **Duration:** about 4 min
- **Started:** 2026-10-20T14:04:10Z
- **Completed:** 2026-10-20T14:08:30Z
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- New pure module `src/utils/frontmatterTags.ts` with no imports. It holds the module-private `TAGS_KEY_LINE`, `NULL_VALUES`, `BLOCK_ITEM_LINE`, `TAGS_REGION_LINE` and `splitFlowItems`, and exports `TagMergeResult`, `mergeCalendarTags`, `normalizeTag`, `splitComment` and `yamlSafeTag`. Behavior matches the 09-RESEARCH reference implementation, reformatted to project style.
- `generateFrontmatter` calls `mergeCalendarTags(frontmatterContent, tags)` after `applyTemplateVariables` (D-07). When `found` is false, the three 1.15.0 statements (`formatTagsYaml` append) run unchanged (D-02). `cleanFrontmatter`, `formatTagsYaml`, `getTagsForEvent` and the per-calendar `??` selection (D-09) are untouched.
- Harness `verify-09.mjs` gained the following, and all 09-01 checks still pass:
  - helpers `frontmatterOf`, `fmFor`, `assertSingleTagsKey`, `expectTags`;
  - checks `checkTagsTracer` (T1-T11) and `checkTagsShapes` (F1-F18, U1-U6);
  - 16 more 1.15.0 parity comparisons.

## Task Commits

1. **Task 1 (tracer): merge into an existing block-list or empty tags key, wired end to end**: `6859fdd` (feat)
2. **Task 2 RED: failing tag-shape fixtures**: `9f59306` (test)
3. **Task 2 GREEN: inline-array and scalar merge plus unsafe-shape guards**: `f1ebaf7` (feat)

No REFACTOR commit was needed because lint was clean after GREEN.

## TDD Gate Compliance (Task 2)

- **RED** `9f59306` (`test(09-02)`, harness only). The target `checkTagsShapes` ran through the real `createEventNote` path and failed on its first planned assertion: fixture F1, `tags: [a, b]` left unmerged. The evidence is a TAP run through Node's test runner. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`).
  - Semantic assessment: a per-fixture matrix against the Task 1 merger gave F1, F2, F5 and F6 FAIL, and U1-U6 PASS. Every other harness check passed, so the failure is the planned missing behavior, not a load, syntax or fixture fault.
- **GREEN** `f1ebaf7` (`feat(09-02)`, `src/utils/frontmatterTags.ts`). The full harness passes in 4 timezones.
- `git merge-base --is-ancestor 9f59306 f1ebaf7` exits 0, so RED precedes GREEN.

## Fixtures

- **36 tag fixtures**, each asserted by exact string, and every one except U6 also by `assertSingleTagsKey`:
  - T1-T11: 11 fixtures;
  - F1-F18: 19 fixtures, because F15 runs both its inline and scalar forms;
  - U1-U6: 6 fixtures.
- Each fixture runs in 4 timezones.
- **Parity:** 8 new no-tags-key corpus entries (empty, `type: event`, `tag:`/`Tags:`/nested `tags`, commented `# tags:`), each with Work tags `[]` and `[x]` and on 2 dates. All are byte-identical to the 1.15.0 bundle.
- **Fixtures differing from 09-RESEARCH.md:** none. Every RESEARCH table row is covered with the same expected output.

## Files Created/Modified
- `src/utils/frontmatterTags.ts`: the tags merger. This is the only place calendar tags are merged into an existing key.
- `src/services/NoteService.ts`: imports `mergeCalendarTags` and adds the merge-or-append branch in `generateFrontmatter`.
- `.planning/phases/09-event-note-content/verify-09.mjs`:
  - `yaml`/`js-yaml` imports and new bundle re-exports;
  - tag helpers, `checkTagsTracer` and `checkTagsShapes`;
  - the extended `checkParity` corpus.

## Decisions Made
- Merger and guards follow the plan and RESEARCH exactly. The two RESEARCH inline regexes are named module-private consts (`BLOCK_ITEM_LINE`, `TAGS_REGION_LINE`), in line with the colorValidation.ts style.
- `checkTagsTracer` also makes direct unit asserts on `normalizeTag`, `yamlSafeTag` and `mergeCalendarTags` (`found: false` when there is no key). This is cheap extra coverage of the exported helpers.

## Deviations from Plan

None to the shipped behavior. One process note: the Task 1 commit first included an AI co-author trailer, which conflicts with the project rule against AI references in commit messages (STATE.md). The commit was local and unpushed. I amended only its message, so its hash became `6859fdd`, and later commits carry no trailer.

## Known limitations

- **D-03 skip (input for Phase 11 DOC-03 docs).** Some `tags` values are shapes the merger leaves untouched. For those, the calendar's tags are **not added** to the note and **no warning is shown**. The shapes are:
  - U1: a multi-line flow array (`tags: [a,` followed by `  b]`);
  - U2: a flow mapping (`tags: {a: 1}`);
  - U3: a block scalar (`tags: |`);
  - U4: an anchor or alias (`tags: &x [a]`);
  - U5: block items with mixed indents;
  - U6: more than one top-level `tags` key.
  - The same skip covers nested flow collections and inline items with an unterminated or backslash-escaped double quote (`["q\"x", b]`; the quote splitter does not interpret escapes).
  - **Workaround:** write `tags` as a block list, a one-line inline array or a scalar.
- Whitespace before a trailing comment on a rewritten inline or scalar `tags` line collapses to one space (A-BUG09). Inserted lines use `\n`, and CRLF is not normalized.

## Issues Encountered
None.

## User Setup Required
None. No external service configuration is required.

## Next Phase Readiness
- Phase 09 code is complete (2/2 plans), and Phase verification and the Obsidian UAT are next. The Task 2 human-check steps 1-6 are ready for harvest into `09-HUMAN-UAT.md`.
- The Known limitations section above feeds Phase 11 DOC-03.

## Self-Check: PASSED
- FOUND: src/utils/frontmatterTags.ts, src/services/NoteService.ts, .planning/phases/09-event-note-content/verify-09.mjs
- FOUND commits: 6859fdd, 9f59306, f1ebaf7. The evaluation scope resolves 3 plan commits on this branch.
- Plan verification:
  - `npm run lint` exit 0;
  - `npm run build` exit 0;
  - the harness prints `verify-09: all checks passed (4 timezones)`;
  - the no-YAML-API grep guard exit 0;
  - `git diff --quiet 1.15.0 -- package.json package-lock.json` exit 0.

---
*Phase: 09-event-note-content*
*Completed: 2026-10-20*
