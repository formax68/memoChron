---
phase: 09-event-note-content
fixed_at: 2026-10-21T06:33:27Z
review_path: .planning/phases/09-event-note-content/09-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report (re-review: WR-01, IN-01 to IN-03, IN-05, IN-06)

**Fixed at:** 2026-10-21T06:33:27Z
**Source review:** .planning/phases/09-event-note-content/09-REVIEW.md
**Iteration:** 1

This report replaces the earlier one, which covered the first review's WR-01 to WR-05 (commits `d7607a3`, `9c6c4da`, `a50b8b5`, `2dd53f0`, `7613289`). The finding IDs below are the ones used in the re-review.

**Summary:**
- Findings in scope: 6 (scope `all`: WR-01, IN-01, IN-02, IN-03, IN-05, IN-06; the re-review dropped IN-04)
- Fixed: 6
- Skipped: 0

Three fixes change parsing or merge logic (WR-01, IN-02, IN-05). One adds a new public template variable (IN-01). These are marked "fixed: requires human verification".

## Fixed Issues

### WR-01: A quote in the middle of a plain `tags` scalar hides its comment, so valid YAML is rewritten as invalid YAML

**Status:** fixed: requires human verification (logic change in the scanners)
**Files modified:** `src/utils/frontmatterTags.ts`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** 5b92004
**Applied fix:**
- **Quotes at node start only.** `splitComment` now opens a quoted string only at the start of a node: index 0, or the first non-space character after `[`, `{`, or a `,` inside a flow collection. It tracks flow depth, so a comma in a block plain scalar does not count as a node start. `splitFlowItems` opens a quote only when the current item is still empty. Everywhere else, `'` and `"` are ordinary characters.
- **Guard on the scalar path.** A differential fuzz (below) found that the legacy comma-scalar path still broke valid YAML in the same way, for example `tags: a,#b` and `tags: a,''b`. So the scalar path now returns `untouched` unless every existing item is a valid flow node (`isFlowSafeItem`): either a complete quoted scalar with only legal YAML escapes, or a plain scalar that stays plain in flow context. This is a general form of the review's "smaller alternative".
- **New fixtures.** F22 to F26 cover `tags: o'reilly # author's pick`, `don't-forget`, `say"hi # a"b`, a flow sequence with a mid-scalar quote plus a commented quote, and the block item `- o'reilly # it's` deduplicated against `O'Reilly`. Each output is parsed with both `yaml` and `js-yaml`. U7 to U9 cover the guard.
- **Fixtures fail without the fix.** Against the pre-fix source, the harness fails at F22.

**Fuzz evidence:** The fuzz built every value of 1 to 6 characters from `a ' " # , [ ] space \`. Each value was used both as `tags: <v>` and as `tags:\n  - <v>`, and only inputs valid in both parsers were kept (474,600 inputs). Merging the tag `zz` into these inputs gave invalid YAML 5,880 times before the fix and 0 times after.

### IN-01: `{{week}}` and `{{year}}` disagree at year boundaries (carried forward)

**Status:** fixed: requires human verification (adds a new public template variable)
**Files modified:** `src/utils/eventDateVariables.ts`, `src/services/NoteService.ts`, `README.md`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** 5de89b6
**Applied fix:**
- **New variable.** Added `weekyear` (Luxon `weekYear`, local time) to `EventDateVariables` and `EventTemplateVariables`. `{{weekyear}}-W{{week}}` now gives a correct ISO week label: 2027-01-01 gives `2026-W53`.
- **D-13 unchanged.** `{{week}}` and `{{year}}` behave as before.
- **Docs.** The doc comments say that `{{year}}-W{{week}}` is not a valid ISO week label. The README time-zone note now lists `{{weekyear}}` with the other local-time variables.
- **Fixtures.** The boundary and tracer fixtures now include the expected `weekyear` (for example 2025-12-29 gives `2026`, and 2021-01-03 gives `2020`). A title-format fixture checks `2026-W53`.
- **Not done here.** The optional zero-padded `ww` was not added. The full README variable entry belongs to Phase 11 (DOC-03). DOC-03 should list `{{weekyear}}` with the other new variables.

### IN-02: Calendar tags are silently dropped when the `tags` shape is unsupported (carried forward)

**Status:** fixed: requires human verification (new user-visible notice)
**Files modified:** `src/utils/frontmatterTags.ts`, `src/services/NoteService.ts`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** 75558b8
**Applied fix:**
- **`skipped` flag.** `TagMergeResult` now has `skipped: boolean`. It is `true` only when the merger leaves an unsafe shape untouched. It is `false` for a merge, for an already-complete key ("nothing to add"), and for "no tags key".
- **One-time notice.** When `skipped` is set, `NoteService.generateFrontmatter` shows a `Notice` once per plugin session. The notice says the calendar tags were not added and suggests the list or `[a, b]` form.
- **Why not `console.warn`.** The review suggested `console.warn` as one option, but DIR-01 (Phase 8) bans ungated console output in shipped code. The text passes the `obsidianmd/ui/sentence-case` lint rule.
- **Harness.** The obsidian stub now records `Notice` messages. Each unsafe shape U1 to U9 must raise exactly one notice, and N1/N2 (a merge, and an already-complete key) must raise none.

### IN-03: CRLF frontmatter is not recognized, so a duplicate `tags` key is emitted (carried forward)

**Status:** fixed
**Files modified:** `src/services/NoteService.ts`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** 546dec6
**Applied fix:** `cleanFrontmatter` now converts `\r\n` to `\n` before anything else. The `tags:` key is then found and merged, and the note gets consistent LF line endings. Fixture F27 (CRLF block list) expects one merged `tags` key.

### IN-05: The scalar path changes the meaning of a quoted comma string (carried forward)

**Status:** fixed: requires human verification (merge semantics)
**Files modified:** `src/utils/frontmatterTags.ts`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** 09ece21
**Applied fix:**
- **Approach.** The review offered two options. I used "unquote and split" rather than "untouched", because "untouched" would drop the calendar tags.
- **How it works.** When the scalar is a single quoted string that contains commas, the new `unquoteScalar` decodes it. Single quotes use `''` unescaping. Double quotes use `JSON.parse`, because JSON escapes are a subset of YAML's. The decoded string is split on commas, trimmed, and each part is passed through `yamlSafeTag(part, true)`. Obsidian therefore still sees the same separate tags: `tags: "a, b"` becomes `tags: [a, b, c]`.
- **Unchanged cases.** A quoted scalar without a comma keeps its written form (`tags: "a"` becomes `["a", c]`). If decoding fails, the old item handling applies.
- **Fixtures.** F28 to F31, including `'x, #y'` becoming `[x, "#y", c]` and deduplication against the split parts. The fuzz is still at 0 invalid outputs.

### IN-06: `NON_STRING_SCALAR` misses two forms that `js-yaml` reads as non-strings

**Status:** fixed
**Files modified:** `src/utils/frontmatterTags.ts`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** 85fc67f
**Applied fix:**
- **Regex change.** The leading-dot float branch is now `\.[\d_]+`, and the timestamp separator is `[Tt \t]`.
- **Confirmed gap.** `js-yaml` 4.1.1 loads `._0` as `0`, `._1` as `0.1`, and `2026-01-01<TAB>10:00:00` as a `Date`.
- **Harness.** New unit checks assert that all three are quoted in block and flow form and load back as strings in both parsers.
- **Over-quoting.** The new regex also quotes `._`, which js-yaml reads as a string. That is harmless.

## Verification

Gates ran in two places:
1. **In the isolated worktree** (`.claude/worktrees/rf-09-52700-1792561562`) after each fix. Dependencies resolved from the parent checkout's `node_modules`, and no `node_modules` link was created. Each fix was checked with `verify-09.mjs` (4 timezones), `tsc -noEmit -skipLibCheck` and `eslint` on the changed files.
2. **In the main checkout** after fast-forwarding `gsd/phase-09-event-note-content` to `85fc67f`. These results can be reproduced from the current tree:
   - `node .planning/phases/09-event-note-content/verify-09.mjs`: all checks passed (Europe/Athens, America/Los_Angeles, Pacific/Auckland, UTC)
   - `npm run build` (tsc and esbuild production): exit 0
   - `npm run lint` (`eslint src/`): exit 0

The project has no other test suite. `verify-09.mjs` includes `checkParity`, which compares against the 1.15.0 `NoteService`, and it still passes.

---

_Fixed: 2026-10-21T06:33:27Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
