---
phase: 09-event-note-content
reviewed: 2026-10-21T05:44:40Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - README.md
  - src/services/NoteService.ts
  - src/utils/frontmatterTags.ts
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 9: Code Review Report (re-review after WR-01..WR-05 fixes)

**Reviewed:** 2026-10-21T05:44:40Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

This is an incremental re-review. I compared the current files against diff base `2403697` (commits `d7607a3`, `9c6c4da`, `a50b8b5`, `2dd53f0` and `7613289`) and re-checked every open Info finding from the previous review.

The phase harness (`verify-09.mjs`) passes in all 4 timezones. I also bundled `frontmatterTags.ts` with esbuild and tested it against both `yaml` and `js-yaml` 4.1.1. I used hand-written edge cases and an exhaustive fuzz of `yamlSafeTag` over every tag of 1 to 3 characters drawn from 34 YAML-significant characters, in both block and flow context.

**Status of the previous Warnings:**
- **WR-01 (quoting): fixed.** The fuzz found no tag that `yamlSafeTag` leaves unquoted and that `yaml` reads as a non-string. Two obscure `js-yaml`-only gaps remain (new IN-06).
- **WR-02 (backslash escapes): fixed.** I verified `"a\" #b"`, `"a\\" #c`, and `''` escapes in single quotes. A related gap with the same effect remains: a quote character in the middle of a plain scalar is treated as the start of a quoted string. This is the new WR-01, and it is not a regression from the fix.
- **WR-03 (fallback quoting): fixed.** Ordinary tags stay byte-identical, and the `checkParity` check against 1.15.0 passes.
- **WR-04 (UTC vs local dates): fixed with documentation only, as the A-UTC prohibition requires.** The README note and the code comments match the behavior: ISO formatting and `*-iso` use `toISOString()`; US, UK, Long, the time variables, `day`/`month` and `getEventDateVariables` use local time. The mismatch itself still exists. It stays an open human decision and is not reported again here.
- **WR-05 (`$`-patterns / rescanning): fixed.** The single-pass replacer with a `hasOwnProperty` guard is correct. Sharing the module-level `g` regex is safe because `String.prototype.replace` resets `lastIndex`. The placeholder pattern `[\w-]+` matches every key in `EventTemplateVariables`. Unknown placeholders such as `{{cursor}}` are kept. I found no regressions.

**Status of the previous Info findings:**
- IN-01, IN-02, IN-03 and IN-05 are still valid and are carried forward with their IDs. Line numbers are updated.
- **IN-04 is dropped.** The single-pass substitution from the WR-05 fix (`NoteService.ts:344-348`, `364-370`) no longer rescans substituted values, so an event titled `Sprint {{week}}` now stays literal.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: A quote in the middle of a plain `tags` scalar hides its comment, so valid YAML is rewritten as invalid YAML

**File:** `src/utils/frontmatterTags.ts:78-79` (`splitComment`), `src/utils/frontmatterTags.ts:113-117` (`splitFlowItems`), `src/utils/frontmatterTags.ts:297-309` (scalar rewrite)
**Issue:** Both scanners start a quoted string at any `'` or `"`, wherever it appears. In YAML, a quote only starts a quoted scalar at the beginning of a node. Inside a plain scalar, such as `o'reilly`, it is an ordinary character. When a comment containing another quote follows the value, the scanner pairs the two quotes. It never sees the comment, so the comment becomes part of the scalar body. The scalar path then moves that body inside a flow sequence, where ` #` starts a comment, and the closing `]` is lost. Verified with both parsers:

| Template frontmatter (valid YAML) | Merged output | Parse result |
|---|---|---|
| `tags: o'reilly # author's pick` (`{"tags":"o'reilly"}`) | `tags: [o'reilly # author's pick, new]` | `yaml`: "Flow sequence ... must end with a ]"; `js-yaml`: "unexpected end of the stream within a flow collection" |
| `tags: foo'bar # it's` | `tags: [foo'bar # it's, new]` | both parsers fail |
| `tags: say"hi # a"b` | `tags: [say"hi # a"b, new]` | both parsers fail |

When the frontmatter does not parse, Obsidian drops every property of the new note, not just `tags`. This breaks the D-03 invariant ("leave shapes it cannot edit safely untouched") in the same way WR-02 did. The WR-02 fix only covered backslash escapes.

The same misreading has two quieter effects:
- With an unpaired apostrophe, `splitFlowItems` returns `null`, so `tags: don't-forget` is left untouched and the calendar tags are silently dropped (see IN-02).
- In the block-list path (`:240`), `- o'reilly # it's` is read as the existing tag `o'reilly # it's`, so a calendar tag `o'reilly` is not detected as a duplicate and gets appended again.

**Fix:** Only open a quoted string at the start of a node: index 0 of the value, or the first non-space character after `[`, `{` or `,`. In `splitComment`:
```ts
let atNodeStart = true;
for (let i = 0; i < value.length; i++) {
  const c = value[i];
  if (quote) { /* unchanged escape / close handling */ continue; }
  if ((c === '"' || c === "'") && atNodeStart) {
    quote = c;
  } else if (c === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
    return [value.slice(0, i).trimEnd(), value.slice(i)];
  }
  if (/[[{,]/.test(c)) {
    atNodeStart = true;
  } else if (!/\s/.test(c)) {
    atNodeStart = false;
  }
}
```
In `splitFlowItems`, open a quote only when `current.trim() === ""`. Add harness fixtures for `tags: o'reilly # author's pick`, `tags: don't-forget` and `- o'reilly # it's`, and check each with both parsers. A smaller alternative: in the scalar path, return `untouched` when an item that does not start with a quote contains `'`, `"` or `\s#`.

## Info

### IN-01: `{{week}}` and `{{year}}` disagree at year boundaries (carried forward)

**File:** `src/utils/eventDateVariables.ts:23-26` (unchanged since the previous review; this file is outside this re-review's file list)
**Issue:** `week` is the ISO week number, but `year` is the calendar year. So 2027-01-01 gives `2027` / `53`, and 2025-12-29 gives `2025` / `1`. A pattern like `{{year}}-W{{week}}` therefore produces wrong labels, and `2025-W1` collides with the real week 1 of 2025. This is the documented D-13 decision, but there is no `{{weekyear}}` variable, so users cannot build a correct ISO week label.
**Fix:** Add `weekyear: DateTime.fromJSDate(date).weekYear.toString()` (and optionally a zero-padded `ww`) to `EventDateVariables`. Document that `{{year}}-W{{week}}` is not a valid ISO week label. The README docs for these variables are planned for Phase 11 (DOC-03).

### IN-02: Calendar tags are silently dropped when the `tags` shape is unsupported (carried forward)

**File:** `src/utils/frontmatterTags.ts:34-39`, `src/utils/frontmatterTags.ts:176-180`, `src/utils/frontmatterTags.ts:229-239`, `src/utils/frontmatterTags.ts:266-273`, `src/utils/frontmatterTags.ts:277-284`, `src/utils/frontmatterTags.ts:299-301`; `src/services/NoteService.ts:256-258`
**Issue:** `found: true` is returned both when tags were merged (or were already complete) and when the shape was unsafe and skipped. `generateFrontmatter` cannot tell these cases apart. For unsupported shapes, the calendar tags disappear with no notice or log. Unsupported shapes include:
- multi-line flow
- anchor or explicit tag
- block scalar
- duplicate keys
- mixed indents
- an unpaired mid-scalar quote such as `tags: don't-forget` (see WR-01)

A multi-line `{{description}}` substituted into the frontmatter that contains a column-0 `tags:` line also triggers this, through `keyIdx.length > 1`. D-03 intends the skip, but the user never sees it.
**Fix:** Add `skipped: boolean` to `TagMergeResult`. Have `generateFrontmatter` emit a `console.warn` (or a one-time `Notice`) when it is set.

### IN-03: CRLF frontmatter is not recognized, so a duplicate `tags` key is emitted (carried forward)

**File:** `src/utils/frontmatterTags.ts:13`, `src/utils/frontmatterTags.ts:166`; `src/services/NoteService.ts:271-282`
**Issue:** `.` does not match `\r`, and `$` without the `m` flag does not match before `\r`, so a `tags:` line ending in `\r` does not match `TAGS_KEY_LINE`. Re-verified on the current source: `mergeCalendarTags("tags:\r\n  - a\r\ntitle: x", ["b"])` returns `found: false`. `NoteService` then appends a second `tags:` block, using LF, which gives a duplicate key and mixed line endings. Textarea input normalizes to LF, so this only happens with a hand-edited or synced `data.json`.
**Fix:** Normalize `\r\n` to `\n` in `cleanFrontmatter`, or split on `/\r?\n/` in `mergeCalendarTags` and rejoin with the original separator.

### IN-05: The scalar path changes the meaning of a quoted comma string (carried forward)

**File:** `src/utils/frontmatterTags.ts:297-309`
**Issue:** `tags: "a, b"` (one YAML string) becomes `tags: ["a, b", z]`. Before the merge, Obsidian splits a comma-separated string `tags` value into the tags `a` and `b`. After the rewrite, `a, b` is a single array element, which is not a valid tag. The unquoted form `tags: a, b` is handled correctly because it is split into separate items.
**Fix:** For a single quoted scalar that contains commas, either return `untouched`, or unquote it and split it on commas before rebuilding the flow sequence.

### IN-06: `NON_STRING_SCALAR` misses two forms that `js-yaml` reads as non-strings

**File:** `src/utils/frontmatterTags.ts:23-24`
**Issue:** The fuzz found two gaps. Both parse as strings in `yaml` but not in `js-yaml` 4.1.1:
- `._0` and `._1`: the float branch requires a digit right after the `.` (`\.\d[\d_]*`), but js-yaml's float pattern is `\.[0-9_]+`. These parse as `0` and `0.1`.
- `2026-01-01<TAB>10:00:00`: the timestamp branch only accepts `[Tt ]` as the separator, but js-yaml also accepts a tab. This parses as a `Date`.

Neither is a realistic calendar tag, but the doc comment promises that every js-yaml non-string form is covered.
**Fix:** Change the float branch to `\.[\d_]+` and the timestamp separator to `[Tt \t]`, for example `\d{4}-\d\d?-\d\d?(?:[Tt \t].*)?`.

---

_Reviewed: 2026-10-21T05:44:40Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
