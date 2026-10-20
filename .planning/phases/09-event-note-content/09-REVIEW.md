---
phase: 09-event-note-content
reviewed: 2026-10-20T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/services/NoteService.ts
  - src/utils/eventDateVariables.ts
  - src/utils/frontmatterTags.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-20
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

I reviewed the Phase 9 changes against diff base `960b743`: the `{{week}}`/`{{dd}}`/`{{d}}`/`{{year}}` variables (`eventDateVariables.ts` and their wiring in `NoteService.getEventTemplateVariables`), and the line-scanning `tags` merger (`frontmatterTags.ts` and its call in `NoteService.generateFrontmatter`). I also reviewed the unchanged code around those call sites.

The phase harness (`verify-09.mjs`) passes in all 4 timezones. I tested further by bundling `frontmatterTags.ts` with esbuild and parsing its output with the `yaml` package. This turned up input classes the harness does not cover:

- calendar tags that `yamlSafeTag` fails to quote, which change the YAML type of the `tags` value
- valid double-quoted YAML with backslash escapes, which gets rewritten into invalid YAML
- the no-`tags`-key fallback path, which still writes `#tag` values unquoted, so they parse as `null`
- the new local-time date variables, which disagree with the UTC-derived `{{date}}`/`{{start_date}}` used in the default title format

I found no injection or path-traversal issues introduced by this phase. All new values are numeric strings, and tag text is only written into frontmatter, never into paths.

## Warnings

### WR-01: `yamlSafeTag` leaves tags unquoted that YAML parses as mappings, booleans, numbers or null

**File:** `src/utils/frontmatterTags.ts:124-130`
**Issue:** The quoting check only looks for a leading indicator character, `": "`, `"\s#"`, and (in flow context) `,[]{}`. It misses:
- A trailing colon: calendar tag `foo:` produces `tags: [a, foo:]` or `  - foo:`, which parses as `{"tags":["a",{"foo":null}]}`, so the tag becomes a mapping.
- Core-schema plain scalars: `true`, `false`, `null`, `~`, `123` and `1.5` are written unquoted and parse as boolean, null or number (`["a",true,null,123,null]`).

Calendar tags are free text (`SettingsTab.parseTags` only splits on commas and trims), so users can type any of these. The doc comment's promise ("only when it would not be a valid plain YAML scalar") does not hold.
**Fix:**
```ts
const CORE_SCALAR = /^(?:~|null|Null|NULL|true|True|TRUE|false|False|FALSE|[-+]?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|0x[0-9a-fA-F]+|0o[0-7]+|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;
const needsQuote =
  tag !== tag.trim() ||
  CORE_SCALAR.test(tag) ||
  /^[-?:,[\]{}#&*!|>'"%@`]/.test(tag) ||
  /:(\s|$)|\s#/.test(tag) ||
  (flow && /[,[\]{}]/.test(tag));
```
Add `foo:`, `true` and `123` cases to `verify-09.mjs`.

### WR-02: Backslash escapes in double-quoted values are ignored, so valid YAML is rewritten as invalid YAML

**File:** `src/utils/frontmatterTags.ts:58-75`, `src/utils/frontmatterTags.ts:83-115`
**Issue:** `splitComment` and `splitFlowItems` close a double-quoted string at the first `"`, including an escaped `\"`. For the valid input `tags: "a\" #b"` (one tag: `a" #b`), `splitComment` treats ` #b"` as a comment. The scalar path then writes `tags: ["a\", c] #b"`, which fails to parse ("Flow sequence ... must end with a ]"). When frontmatter does not parse, Obsidian drops every property in the note, not just `tags`. D-03 says the merger must leave shapes it cannot edit safely untouched, but this one is silently corrupted.
**Fix:** In both scanners, inside a `"` string, treat `\` as an escape that consumes the next character:
```ts
if (quote) {
  if (quote === '"' && c === "\\") { i++; continue; }   // splitComment (index loop)
  if (c === quote) quote = null;
  continue;
}
```
In `splitFlowItems`, switch to an index loop so the escaped character can be appended and skipped. Alternatively, return `untouched` whenever the body contains `\` inside double quotes.

### WR-03: The fallback path still writes calendar tags unquoted, so `#meeting` becomes `null`

**File:** `src/services/NoteService.ts:242-247`, `src/services/NoteService.ts:267-269`
**Issue:** When the template has no `tags` key, `generateFrontmatter` still uses `formatTagsYaml`, which writes `  - ${tag}` with no quoting. Obsidian users commonly type tags with a `#` prefix, and `tags:\n  - #meeting` parses as `[null]`, so the tag is silently lost. A tag like `foo: bar` becomes a mapping.

The merge path added in this phase passes the same tags through `yamlSafeTag`. So a calendar tag now produces correct YAML if the template has a `tags:` key and broken YAML if it does not. That inconsistency also conflicts with D-01, which says the empty-key output should be "identical in format to the existing `formatTagsYaml` output". The fallback path is also not normalized-deduplicated (`Work` and `work` are both emitted), unlike `pickNew`. D-02 asks for byte-for-byte parity with 1.15.0 here, but that parity is preserving a data-loss bug.
**Fix:** Reuse the merger's quoting and dedup:
```ts
private formatTagsYaml(tags: string[]): string {
  return "tags:\n" + tags.map((tag) => `  - ${yamlSafeTag(tag, false)}`).join("\n");
}
```
Ordinary tags stay byte-identical. Only tags that are currently corrupted change. Record this as an amendment to D-02.

### WR-04: New local-time variables disagree with the default `{{start_date}}` / `{{date-iso}}` (UTC)

**File:** `src/services/NoteService.ts:274-279`, `src/services/NoteService.ts:296`, `src/utils/eventDateVariables.ts:20-28`
**Issue:** `{{dd}}`, `{{d}}`, `{{year}}` and `{{week}}` are derived from local time. `{{date}}`, `{{start_date}}` and `{{*-iso}}` with the default `ISO` format (`DEFAULT_NOTE_DATE_FORMAT = 'ISO'`) come from `toISOString()`, which is UTC.

Verified with `TZ=Europe/Athens`: an event at 2026-05-04 01:30 local gives `{{start_date}}` = `2026-05-03` but `{{dd}}` = `04`. The default title format is `{{start_date}} - {{event_title}}`, so a note titled `2026-05-03 - ...` would have a body saying day `04`. In UTC+ zones this affects every all-day event at local midnight. The UTC derivation predates this phase, but this phase adds a second, conflicting date source to the same variable set. Templates that mix the two, such as `{{year}}-W{{week}}` next to `{{date-iso}}`, are now internally inconsistent.
**Fix:** Derive the ISO date strings from local components too, e.g. `DateTime.fromJSDate(d).toISODate()` in `formatDate`'s `ISO` formatter and the three `*-iso` variables. If that is out of scope, record the mismatch as a known issue and document which variables are local and which are UTC.

### WR-05: `String.replace` replacement patterns in event data corrupt note content (pre-existing, now on the new variables' path)

**File:** `src/services/NoteService.ts:319-323`, `src/services/NoteService.ts:338-344`
**Issue:** `applyTemplateVariables` and `formatTitle` pass remote calendar values directly as the replacement string of `String.prototype.replace`, so `$$`, `$&`, `` $` `` and `$'` are interpreted. Verified: a description of `see $' here` inserts the rest of the template (`"see \nEND here\nEND"`), and a title of `Budget $$5 and $&` becomes `Budget $5 and {{event_title}}`. Event titles and descriptions come from external ICS feeds, so a third party can change the generated note and frontmatter. With `$'`, that includes duplicating the frontmatter lines that the new `tags` merger then scans. The new date variables are not affected, but they now go through this same sequential substitution.
**Fix:** Use a replacer function so values are inserted literally, and do a single pass so substituted values are never rescanned:
```ts
return template.replace(/\{\{([\w-]+)\}\}/g, (m, key: string) =>
  key in variables ? (variables as Record<string, string>)[key] || "" : m
);
```
In `formatTitle`, do the same with `this.sanitizeFileName(...)` inside the replacer.

## Info

### IN-01: `{{week}}` and `{{year}}` disagree at year boundaries

**File:** `src/utils/eventDateVariables.ts:23-26`
**Issue:** `week` is the ISO week number but `year` is the calendar year, so 2027-01-01 gives `2027` / `53` and 2025-12-29 gives `2025` / `1`. A title or folder pattern like `{{year}}-W{{week}}` therefore produces wrong labels (`2027-W53`, `2025-W1`). The second one collides with the real 2025-W1. This is the documented D-13 decision, but no `{{weekyear}}` variable is offered, so users cannot build a correct ISO week label.
**Fix:** Add `weekyear: DateTime.fromJSDate(date).weekYear.toString()` (and a zero-padded `ww`) to `EventDateVariables` and document that `{{year}}-W{{week}}` is not a valid ISO week label.

### IN-02: Calendar tags are silently dropped when the `tags` shape is unsupported

**File:** `src/utils/frontmatterTags.ts:155-158`, `src/utils/frontmatterTags.ts:209-218`, `src/utils/frontmatterTags.ts:246-252`; `src/services/NoteService.ts:240-241`
**Issue:** `found: true` is returned for both "merged or already complete" and "unsafe, skipped", and `generateFrontmatter` cannot tell them apart. When the shape is unsupported (multi-line flow, anchor or tag, block scalar, duplicate keys, mixed indents), calendar tags vanish with no notice or log. One way this happens is when a multi-line `{{description}}` substituted into the frontmatter contains a column-0 `tags:` line, which makes `keyIdx.length > 1`. D-03 intends the skip, but it is invisible to the user.
**Fix:** Add a `skipped: boolean` to `TagMergeResult` and emit a `console.warn` (or a one-time `Notice`) from `generateFrontmatter` when tags were skipped.

### IN-03: CRLF frontmatter is not recognized, so a duplicate `tags` key is emitted

**File:** `src/utils/frontmatterTags.ts:13`, `src/utils/frontmatterTags.ts:145`
**Issue:** `.` does not match `\r`, so with `$` and no `m` flag, `tags: [a]\r` does not match `TAGS_KEY_LINE`. Verified: `mergeCalendarTags("tags: [a]\r\ntitle: x", ["b"])` returns `found: false`, and `NoteService` then appends a second `tags:` block. That breaks the D-03 invariant. Textarea input normalizes to LF, so this only happens with a hand-edited or synced `data.json`.
**Fix:** Split on `/\r?\n/` (and rejoin with the original separator), or normalize `\r\n` to `\n` in `cleanFrontmatter`.

### IN-04: New variables are expanded inside earlier-substituted remote values

**File:** `src/services/NoteService.ts:284-307`, `src/services/NoteService.ts:319-323`
**Issue:** Substitution runs sequentially in object key order, and `event_title` comes before `week`/`dd`/`d`/`year`. So an event titled `Sprint {{week}}` becomes `Sprint 19`, both in the body and in the filename via `formatTitle`. Remote data should be inserted literally. The single-pass fix in WR-05 also fixes this.
**Fix:** See WR-05.

### IN-05: The scalar path rewrites a quoted comma string's meaning

**File:** `src/utils/frontmatterTags.ts:276-288`
**Issue:** `tags: "a, b"` (one YAML string) becomes `tags: ["a, b", z]`. Before the merge, Obsidian splits a comma-separated string `tags` value into tags `a` and `b`. After the rewrite it is one array element, `a, b`, which is not a valid tag. Unquoted `tags: a, b` is handled correctly because it is split into separate items.
**Fix:** For a quoted single scalar containing commas, either leave it `untouched` or unquote it and split on commas before rebuilding the flow sequence.

---

_Reviewed: 2026-10-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
