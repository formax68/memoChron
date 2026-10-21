---
phase: 09-event-note-content
fixed_at: 2026-10-21T00:00:00Z
review_path: .planning/phases/09-event-note-content/09-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-10-21
**Source review:** .planning/phases/09-event-note-content/09-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01 to WR-05; scope `critical_warning`, so IN-01 to IN-05 are out of scope)
- Fixed: 5 (WR-04 by documentation only, see below)
- Skipped: 0

## Fixed Issues

### WR-01: `yamlSafeTag` leaves tags unquoted that YAML parses as mappings, booleans, numbers or null

**Files modified:** `src/utils/frontmatterTags.ts`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** d7607a3
**Applied fix:** Added the `NON_STRING_SCALAR` regex (null/`~`, booleans, ints, floats, `0b`/`0o`/`0x`, `.inf`/`.nan`, and `YYYY-MM-DD` timestamps, which js-yaml's default schema reads as dates). `yamlSafeTag` now also quotes a trailing `:` (`/:(\s|$)/`) and tags with leading or trailing whitespace. Ordinary tags are unchanged. New harness fixtures T12 (block) and T12f (flow) assert that `foo:`, `true` and `123` are quoted and parse as strings in both `yaml` and `js-yaml`.

### WR-02: Backslash escapes in double-quoted values are ignored, so valid YAML is rewritten as invalid YAML

**Files modified:** `src/utils/frontmatterTags.ts`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** 9c6c4da
**Applied fix:** Inside a `"` string, `splitComment` now skips the character after a `\`. `splitFlowItems` now uses an index loop and appends the escaped character unchanged. Single-quoted `''` handling is unchanged and still works. New fixtures: F19 (scalar `"a\" #b"`), F20 (flow `["a\", b", x]`) and F21 (block item with an escaped quote and a trailing comment). Each output is checked with both YAML parsers.

### WR-03: The fallback path still writes calendar tags unquoted, so `#meeting` becomes `null`

**Files modified:** `src/services/NoteService.ts`, `.planning/phases/09-event-note-content/09-CONTEXT.md`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** a50b8b5
**Applied fix:** `formatTagsYaml` now writes each tag through `yamlSafeTag(tag, false)`. Ordinary tags stay byte-identical to 1.15.0, and the existing `checkParity` no-key corpus still passes against tag `1.15.0`. I added an amendment under D-02 in `09-CONTEXT.md`, as the review asked. I did not add normalized dedup to this path: 09-RESEARCH.md says it would break D-02, and the review's own code fix only quotes. `getTagsForEvent` still removes exact duplicates. New fixture T8b checks that `#meeting` and `a: b` are quoted and parse back as strings.

### WR-04: New local-time variables disagree with the default `{{start_date}}` / `{{date-iso}}` (UTC)

**Files modified:** `src/services/NoteService.ts`, `README.md`
**Commit:** 7613289
**Applied fix:** **Documentation only. Behavior is unchanged.** The review's code fix (deriving ISO dates from local time) is explicitly barred by the recorded A-UTC prohibition (09-01-PLAN.md, 09-RESEARCH.md Open Question 1, 09-01-SUMMARY.md "Known pre-existing issues"). It would rename future notes and break note-exists matching. The harness's `checkAdjacency` also expects the `toISOString()` value. So I applied the review's stated alternative. A comment block on `EventTemplateVariables` and per-field comments now say which variables are UTC and which are local. The README variables section has a new **Time zone** note. The mismatch itself is still there. Whether to fix A-UTC remains the open human decision recorded in 09-VERIFICATION.md / 09-UAT.md.

### WR-05: `String.replace` replacement patterns in event data corrupt note content (pre-existing, now on the new variables' path)

**Files modified:** `src/services/NoteService.ts`, `.planning/phases/09-event-note-content/verify-09.mjs`
**Commit:** 2dd53f0
**Applied fix:** `applyTemplateVariables` and `formatTitle` now do a single `replace` with a module-level `TEMPLATE_PLACEHOLDER` regex (`/\{\{([\w-]+)\}\}/g`) and a replacer function. The replacer uses `hasOwnProperty`, so names like `{{constructor}}` are never resolved. `formatTitle` still runs `sanitizeFileName` on each value. Unknown placeholders (e.g. `{{cursor}}`) are left as they were. This also fixes IN-04, because `{{...}}` text inside a substituted value is no longer expanded. New check `checkLiteralSubstitution` asserts that a title `Budget $$5 and $& {{week}}` and a description `see $' here` come out literally in the filename, body and frontmatter. **Requires human verification:** this is a logic change to substitution order. One behavior changes on purpose: before, a remote value containing a later variable's placeholder (e.g. a description containing `{{attendees}}`) got expanded. Now it is inserted literally.

## Verification

Each fix was checked when it was made: re-read the edited code, syntax-checked the TS with an esbuild transform and the `.mjs` with `node --check`, and ran an ad-hoc YAML round-trip script for WR-01 and WR-02. Before the fast-forward, I also ran a copy of `verify-09.mjs` against the isolated worktree's sources (worktree environment; dependencies resolved from the main checkout's `node_modules`). It passed in all 4 timezones.

The final gates ran in the **main checkout** (`/home/mike/code/memoChron`, branch `gsd/phase-09-event-note-content` at 7613289) after the fast-forward and worktree removal, so anyone can reproduce them from that tree:

- `node .planning/phases/09-event-note-content/verify-09.mjs`: all checks passed in all 4 timezones (Europe/Athens, America/Los_Angeles, Pacific/Auckland, UTC), including `checkParity` against 1.15.0
- `npm run build` (`tsc -noEmit -skipLibCheck` + esbuild production): exit 0
- `npm run lint` (`eslint src/`): clean

The project has no other test script.

---

_Fixed: 2026-10-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
