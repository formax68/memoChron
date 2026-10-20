# Phase 9: Event Note Content - Research

**Researched:** 2026-10-20
**Domain:** Line-level YAML frontmatter editing (tags merge) and date template variables in an Obsidian plugin (TypeScript, `NoteService`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

User delegated all gray areas ("sensible defaults on the above"). Every decision below is Claude-chosen; the planner may refine details but should keep the intent.

#### Merged tag output shape (BUG-08)
- **D-01:** Preserve the form the user wrote. Never re-format lines other than the `tags` key's own value lines.
  - **Block list** (`tags:` followed by `  - a` lines) → append each new calendar tag as an extra `- tag` line directly after the last existing item, reusing the indentation of the existing items.
  - **Inline array** (`tags: [a, b]`) → insert new tags inside the brackets: `tags: [a, b, work]`. `tags: []` → `tags: [work, meeting]`.
  - **Scalar** (`tags: a`, or legacy comma form `tags: a, b`) → rewrite that one line as an inline array: `tags: [a, b, work]` (split on commas, trim whitespace). Keeps it to one line and is valid YAML for Obsidian Properties.
  - **Empty key** (`tags:` with no value and no following items) → emit calendar tags as a block list under it, identical in format to the existing `formatTagsYaml` output.
- **D-02:** When the default frontmatter has no top-level `tags` key, keep the 1.15.0 behavior byte-for-byte (append `formatTagsYaml` block at the end). When the event has no calendar tags, frontmatter is untouched.
- **D-03:** Hard invariant: the generated frontmatter never contains more than one top-level `tags` key emitted by MemoChron. If the user's `tags` value is in a shape the merger can't safely edit (e.g. a multi-line flow array, flow mapping), leave the user's `tags` lines untouched and skip adding calendar tags rather than emitting a second key.

#### Tag order & dedup (BUG-09)
- **D-04:** Order = the user's existing tags first in their original order, then calendar tags in the existing `getTagsForEvent` order (global/per-calendar default tags, then source tags).
- **D-05:** Dedup compares normalized forms: strip surrounding `"`/`'` quotes, strip a leading `#`, trim, case-insensitive (Obsidian treats tags case-insensitively). A calendar tag matching any existing user tag is skipped.
- **D-06:** User-authored tag values are never rewritten (quotes, `#`, casing, and even pre-existing user duplicates stay as written). Only calendar tags that are new get appended, written unquoted as `formatTagsYaml` does today.

#### Tag edge cases
- **D-07:** Merge runs after template-variable substitution on the frontmatter (current `generateFrontmatter` order), so `tags: [{{source}}]` resolves first and is then merged/deduped.
- **D-08:** Only a top-level (column-0) key named exactly `tags` is merged. Singular `tag:`, differently-cased `Tags:`, and indented/nested `tags` keys are not treated as the tags property (they don't cause a YAML duplicate-key error with the appended `tags`).
- **D-09:** Global vs per-calendar: the code already selects one (`calendarSettings.defaultFrontmatter ?? settings.defaultFrontmatter`); there is no cross-merge between the two. Merge targets whichever is in effect.
- **D-10:** Inline comments after a tags value (`tags: [a] # note`) — Claude's discretion; preserve the comment if handled, otherwise fall under D-03 (skip, never duplicate).

#### New template variables (ENH-09..12)
- **D-11:** Variables are added only to `EventTemplateVariables` / `getEventTemplateVariables`, so they automatically flow through all three existing paths: `formatTitle` (sanitized), `applyTemplateVariables` for the note template, and default frontmatter. The folder-path template (`{YYYY}`, `{DD}`, `{D}` … in `FolderTemplateVariables`) is not extended.
- **D-12:** Values derive from `event.start` in local time (`getFullYear`/`getDate`), consistent with `{{day}}`/`{{month}}`, the folder variables, and how all-day events are constructed in `timezoneUtils.ts`. They do not depend on the "Note date format" setting.
- **D-13:** `{{week}}` = ISO 8601 week (Monday start, week containing the first Thursday), unpadded. `{{year}}` = `getFullYear()` (calendar year, never ISO week-year). Acceptance checks: 2026-05-04 → week `19`, dd `04`, d `4`, year `2026`; 2027-01-01 → week `53`, year `2027`.
- **D-14:** No change to the substitution mechanism is needed: both `applyTemplateVariables` and `formatTitle` match the full `{{key}}` token, so `{{d}}` cannot touch `{{dd}}` or `{{date}}`. Planner should still include the side-by-side `{{d}} {{dd}} {{date}}` UAT check.

### Claude's Discretion
- ISO week computation: Obsidian's re-exported `moment` (`moment(date).isoWeek()`, already imported in `CalendarView.ts`) or a small local helper — either is fine.
- Structure of the tag merger (line-scanning helper inside `NoteService`, private methods) and handling of exotic YAML shapes within D-03.
- Comment style on the new interface fields should match the existing `day`/`month` comments.

### Deferred Ideas (OUT OF SCOPE)
- `{week}` / ISO-week token for the folder-path template — possible backlog item, not requested by #63.
- Aligning the calendar view's week-number column with ISO weeks — separate UX decision.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUG-08 | Calendar tags merged into an existing `tags` property in place (block-list, inline-array, scalar); no second `tags` key | Pattern 1 (line-scanning merger), Code Example "mergeCalendarTags"; prototype passed 22 fixtures under two strict YAML parsers |
| BUG-09 | Merged tags deduplicated; other keys/order/values preserved; no `tags` key → 1.15.0 append byte-for-byte | Pattern 2 (integration with `found` flag keeps the 1.15.0 `else` branch verbatim); `normalizeTag` (D-05); Pitfall 1 |
| ENH-09 | `{{week}}` = ISO 8601 week, unpadded | luxon `DateTime#weekNumber` (ISO, verified in luxon 3.6.1 source), cross-checked against moment `isoWeek()` and a reference helper across 1990–2060 in 4 timezones: 0 mismatches |
| ENH-10 | `{{dd}}` padded / `{{d}}` unpadded day of month | `getDate()` + `padStart(2, "0")` (same as `FolderTemplateVariables.DD`/`D`) |
| ENH-11 | `{{year}}` = calendar year, not ISO week-year | `getFullYear()`; 2027-01-01 verified → `2027` while ISO week-year is `2026` |
| ENH-12 | New variables work in titles (sanitized), templates, frontmatter; `{{d}}` never corrupts `{{dd}}`/`{{date}}` | Full-token regex substitution verified by running the exact `reduce` logic: `"{{d}} {{dd}} {{date}}"` → `"4 04 2026-05-04"` |
</phase_requirements>

## Summary

Both halves of this phase are small, self-contained changes to `NoteService`, but the tag merger is the riskiest code in the milestone. It edits user-authored YAML at line level, with no YAML library, because full parse/re-serialize is explicitly Out of Scope. During this session I prototyped the merger as a pure TypeScript function and ran 22 fixtures through it: block, indentless block, block with comments and blank lines, inline, `[]`, trailing comma, quoted item containing a comma, scalar, comma scalar, empty key (last and middle), `~`, `tags: #a` (a YAML comment), quoted/`#`/mixed-case dedup, all-present, quoted key, no key, empty frontmatter, singular `tag:`, multi-line flow, flow mapping, and pre-existing duplicate keys. Every output was checked with **both** `yaml` 2.x (`uniqueKeys: true`) and `js-yaml` 4.x, and all 22 passed. The prototype also passes the repo's real `eslint` config and `tsc -noEmit`. It appears below as the reference implementation.

The template variables are four lines. `{{week}}` should use **luxon's `DateTime.fromJSDate(date).weekNumber`**. luxon 3.6.1 is already a runtime dependency, already bundled through `timezoneUtils.ts`, and documented as ISO 8601. `{{dd}}`/`{{d}}`/`{{year}}` mirror the existing `FolderTemplateVariables` local-time accessors. Substitution needs no mechanism change: both substitution loops match the full `{{key}}` token. One important gotcha came out of this: the pre-existing `{{date}}` (ISO format) and `{{date-iso}}` are computed with `toISOString()`, which is UTC. For all-day events in UTC+ timezones (the user is in Europe/Athens), `{{date}}` shows the **previous day**, while `{{dd}}`/`{{day}}` show the correct local day. Verified: `new Date(2026,4,4)` in `TZ=Europe/Athens` gives `toISOString()` `2026-05-03` and `getDate()` `4`. This will make the success-criterion-4 side-by-side UAT look like a failure unless it uses a timed (midday) event, or the planner decides to fix it.

The `obsidian` npm package is types-only (`"main": ""`), so any code inside `NoteService.ts` cannot be executed by a Node script. To get automated verification without adding a test framework (Out of Scope), put the merger and date-part logic in **pure modules under `src/utils/`** that have no `obsidian` import. A phase-local `.mjs` harness then runs them directly with Node's built-in TypeScript type stripping. Node 26.12 is available locally, and the repo already has `yaml` 2.9.0 and `js-yaml` 4.1.1 in `node_modules` as transitive dev dependencies.

**Primary recommendation:** Implement `mergeCalendarTags()` as a pure line-scanner in `src/utils/frontmatterTags.ts`, using the prototype below. Call it from `generateFrontmatter` and keep the 1.15.0 append as the untouched `else` branch. Add `week`/`dd`/`d`/`year` via luxon + `Date` accessors, and verify both with a Node fixture harness plus Obsidian UAT.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tag merge into default frontmatter | Plugin service (`NoteService.generateFrontmatter`) | Pure util (`src/utils/frontmatterTags.ts`) | String transformation at note-creation time; there is no server or storage tier. The pure util makes it Node-testable |
| Calendar tag list (`getTagsForEvent`) | Plugin service (`NoteService`) | Settings (`settings/types.ts`) | Already exists, unchanged; it is the merge input |
| Date template variables | Plugin service (`NoteService.getEventTemplateVariables`) | Pure util (date parts) + luxon | All three substitution paths read from this one object (D-11) |
| Filename sanitization of title | Plugin service (`formatTitle` → `sanitizeFileName`) | — | Unchanged; numeric values are no-ops |
| YAML validity of the result | Obsidian (metadata cache / Properties panel) | — | Out of the plugin's control. The plugin must emit valid YAML with unique keys |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| luxon | 3.6.1 (lockfile) | `DateTime.fromJSDate(d).weekNumber` for ISO week | Already a runtime dependency, imported by `src/utils/timezoneUtils.ts:1` (`import { DateTime } from "luxon";`), so zero new bundle cost. `weekNumber` is documented in source as "the week number of the week year … @see https://en.wikipedia.org/wiki/ISO_week_date" [VERIFIED: node_modules/luxon/src/datetime.js:1234-1240, luxon 3.6.1] |
| TypeScript string/regex | — | Line-scanning tag merger | No YAML library permitted for rewrite (Out of Scope: "Full YAML parse/re-serialize of user frontmatter") [VERIFIED: .planning/REQUIREMENTS.md Out of Scope table] |

### Supporting (verification only, already installed transitively, not added to package.json)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yaml | 2.9.0 (`dev: true`, transitive) | Harness: assert merger output parses with unique keys | Phase-local verify script only [VERIFIED: package-lock.json:5077-5082] |
| js-yaml | 4.1.1 (`dev: true`, transitive) | Harness: second parser cross-check | Phase-local verify script only [VERIFIED: package-lock.json:3268-3272] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| luxon `weekNumber` | `moment(d).isoWeek()` from `"obsidian"` | Equally correct (0 mismatches vs luxon over 77,799 samples). But `obsidian` cannot be imported in Node, so the date-parts code could not be harness-tested. Fine if the planner keeps date vars inline in `NoteService` |
| luxon `weekNumber` | Hand-rolled UTC-arithmetic ISO helper | Also verified correct, but it is a hand-roll when the dependency is already bundled |
| Line-scanning merger | `parseYaml`/`stringifyYaml` or `processFrontMatter` | Rejected by Out of Scope: it reformats and reorders user frontmatter, drops comments, and breaks D-01/BUG-09 "preserved unchanged" |
| — | `moment(d).week()` (what `CalendarView.ts:548` uses) | **Wrong** for `{{week}}`: locale week. Verified `moment(2027-01-01).week()` = `1`, required `53` |

**Installation:** None. No new packages. Wave 0 must run `npm ci`, because `node_modules` is currently absent in the working tree (`ls node_modules/.bin` returns "No such file or directory").

**Version verification:** luxon 3.6.1 is pinned in `package-lock.json:3462-3466`. It was checked with `gsd-tools package-legitimacy check --ecosystem npm luxon` → `OK` (24.2M weekly downloads, repo `github.com/moment/luxon`, no postinstall).

## Package Legitimacy Audit

This phase installs **no** external packages. luxon is an existing dependency. yaml/js-yaml are existing transitive dev dependencies, used only by an uncommitted-to-bundle verification script.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| luxon (existing dep) | npm | latest publish 2025-09-05 | 24.2M/wk | github.com/moment/luxon | OK | Approved (already in package.json) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User clicks event
      │
      ▼
NoteService.createEventNote(event)
      │
      ├─► buildFilePath ──► formatTitle(noteTitleFormat)
      │                        │  reduce over getEventTemplateVariables(event)
      │                        │  (now incl. week/dd/d/year) → sanitizeFileName(value)
      │                        ▼
      │                     "<loc>/<folderTemplate>/<title>.md"
      │
      └─► generateNoteContent
              │
              ├─► variables = getEventTemplateVariables(event)
              │        └─ week = luxon weekNumber(local) ; dd/d = getDate ; year = getFullYear
              │
              ├─► generateFrontmatter(event, variables)
              │        defaultFrontmatter = perCalendar ?? global          (D-09)
              │        cleanFrontmatter (strip ---) ─► applyTemplateVariables (D-07)
              │        tags = getTagsForEvent(event)
              │        tags.length == 0 ? ──yes──► unchanged
              │              │no
              │              ▼
              │        mergeCalendarTags(fm, tags)
              │          ├─ no top-level tags key ─► found:false ─► 1.15.0 append formatTagsYaml (D-02)
              │          ├─ block / empty / inline / scalar ─► in-place edit of tags lines only
              │          └─ unsafe shape or >1 tags keys ─► found:true, content unchanged (D-03)
              │
              ├─► applyTemplateVariables(noteTemplate)
              └─► extractCursorMarker("---\nfm\n---\nbody") ─► vault.create
```

### Recommended Project Structure
```
src/
├── services/NoteService.ts        # integration: generateFrontmatter + getEventTemplateVariables + interface
└── utils/
    ├── frontmatterTags.ts         # NEW, pure (no imports): mergeCalendarTags, normalizeTag, helpers
    └── eventDateVariables.ts      # NEW, pure (imports luxon only): getEventDateVariables(date)
.planning/phases/09-event-note-content/
└── verify-09.mjs                  # NEW phase-local Node harness (not under src/, not linted, not type-checked)
```
File naming follows CONVENTIONS ("camelCase for utility files: `pathUtils.ts`, `timezoneUtils.ts`") [VERIFIED: .planning/codebase/CONVENTIONS.md:9]. If the planner prefers literal adherence to CONTEXT's "line-scanning helper inside `NoteService`, private methods", the logic is identical, but automated verification then drops to UAT only (see Pitfall 7).

### Pattern 1: Line-scanning tags merger (BUG-08/09)
**What:** Locate the single column-0 `tags` key line, classify its value (empty / null-ish / block list / inline `[...]` / scalar / unsafe), and edit only those lines.
**When to use:** Always, when `getTagsForEvent(event).length > 0`.
**Classification rules (prototype-verified):**
1. Key regex `^((["']?)tags\2[ \t]*:)(.*)$`. This matches `tags:`, `tags :`, `"tags":`, `'tags':`. It does not match `tag:`, `Tags:`, or indented `  tags:` (D-08). The quoted key forms are included because YAML treats `"tags"` as the same key, so appending a second `tags` would be a duplicate-key error (upholds D-03).
2. More than one matching line → return unchanged (`found: true`). The user already has duplicates, and the plugin never adds another.
3. Strip a trailing comment from the value: `#` preceded by whitespace (or at value start), outside quotes (D-10: comment preserved).
4. "Region" = following lines that are blank, comments, indented, or column-0 `- `. These belong to the key.
5. Body empty (or `~`/`null`/`""`/`''`) → block mode. All non-blank, non-comment region lines must be `-` items at one identical indent, otherwise unsafe. No items → write `tags:` (+comment) followed by `  - tag` lines (exactly `formatTagsYaml`'s item format). Items present → insert `${indent}- tag` after the **last item line** (indentless `- a` at column 0 is valid YAML and handled).
6. Body non-empty but region has non-comment content (multi-line plain scalar or flow) → unsafe.
7. Body starts with `{ | > & * !` → unsafe (flow map, block scalar, anchor, alias, tag).
8. Body `[…]` on one line → split inner on commas outside quotes. Any nested `[]{}` → unsafe. Append before `]`, and handle `[]` and a trailing comma `[a, b,]`.
9. Otherwise scalar → split on commas outside quotes. Any `[]{}` → unsafe. Rewrite the line as `tags: [items…, new…]` (D-01).

### Pattern 2: Integration preserving 1.15.0 byte-for-byte (D-02)
**What:** Keep the existing append block verbatim as the `else` branch, so the no-`tags`-key path cannot drift.

```typescript
// Source: src/services/NoteService.ts:227-234 (current) + merger (new)
const tags = this.getTagsForEvent(event);
if (tags.length > 0) {
  const merged = mergeCalendarTags(frontmatterContent, tags);
  if (merged.found) {
    frontmatterContent = merged.content;
  } else {
    // 1.15.0 behavior, unchanged (BUG-09 / D-02)
    const tagsYaml = this.formatTagsYaml(tags);
    if (frontmatterContent) {
      frontmatterContent += "\n";
    }
    frontmatterContent += tagsYaml;
  }
}
```
Current code being replaced, verbatim [VERIFIED: src/services/NoteService.ts:227-234]:
```typescript
    const tags = this.getTagsForEvent(event);
    if (tags.length > 0) {
      const tagsYaml = this.formatTagsYaml(tags);
      if (frontmatterContent) {
        frontmatterContent += "\n";
      }
      frontmatterContent += tagsYaml;
    }
```
`formatTagsYaml` verbatim [VERIFIED: src/services/NoteService.ts:252-254]: `return "tags:\n" + tags.map((tag) => \`  - ${tag}\`).join("\n");`

### Pattern 3: Template variables via the one variables object (D-11)
Place the four new keys **immediately after `month`** in both the interface and the returned object (see Pitfall 5 for why order matters). Existing comment style, verbatim [VERIFIED: src/services/NoteService.ts:17-20]:
```
  // Full English weekday name (e.g. "Monday") — locale hard-coded to "en-US"
  day: string;
  // Full English month name (e.g. "January") — locale hard-coded to "en-US"
  month: string;
```

### Anti-Patterns to Avoid
- **`processFrontMatter` / `parseYaml` + `stringifyYaml`:** reorders keys, drops comments, re-quotes values. Violates BUG-09 and is explicitly Out of Scope.
- **Regex `.replace(/tags:.*$/m, …)` one-liner:** misses block items, the indentless form, comments, and quoted keys, and can match `tags:` inside a substituted multi-line value.
- **`moment(date).week()`:** locale week (what the calendar grid uses). Gives `1` for 2027-01-01, where the requirement says `53`.
- **`isoWeekYear()`/`weekYear` for `{{year}}`:** gives `2026` for 2027-01-01. The requirement says the calendar year `2027`.
- **Applying new dedup/normalization in the no-key path:** breaks the D-02 byte-for-byte guarantee. Normalization belongs only inside the merger.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ISO 8601 week number | Custom Thursday-shift arithmetic | luxon `DateTime.fromJSDate(d).weekNumber` | Already bundled. Year-boundary weeks (W53, W1 in December) are a classic bug source |
| YAML validity checking in verification | Ad-hoc "looks right" eyeballing | `yaml.parse(out, { uniqueKeys: true })` + `js-yaml.load(out)` in the harness | Both throw on duplicate keys and malformed flow; already in node_modules |
| Test runner | jest/vitest install | Plain `node verify-09.mjs` with `node:assert` | Test suite is Out of Scope; Node 26 strips TS types natively |

**Key insight:** The tag merger *must* be hand-rolled, because a full YAML round-trip is forbidden. The way to make that safe is a narrow, conservative classifier (anything unrecognized → leave untouched, D-03) plus fixture verification against real YAML parsers.

## Common Pitfalls

### Pitfall 1: Breaking the 1.15.0 no-`tags` path
**What goes wrong:** Routing the no-key case through the merger (e.g. normalizing or deduping calendar tags case-insensitively) changes output for every existing user.
**How to avoid:** The merger returns `found: false` and the caller runs the untouched 1.15.0 code. The harness asserts the exact string for `DEFAULT_FRONTMATTER` + `DEFAULT_TAGS`. Verbatim defaults [VERIFIED: src/utils/constants.ts:11-12]: `export const DEFAULT_FRONTMATTER: string = '---\ntype: event\ndate: {{start_date}}\n---';` and `export const DEFAULT_TAGS: string[] = ['event', 'meeting'];`. The expected output for the frontmatter body is `type: event\ndate: <start_date>\ntags:\n  - event\n  - meeting`.

### Pitfall 2: `#` starts a YAML comment
**What goes wrong:** `tags: #work` is **not** a tag in YAML. It is a null value with a comment. `[a, #b]` is an unterminated flow sequence (parse error).
**How to avoid:** Comment-strip the user value before classifying. Treat `tags: #a` as an empty key with a comment, and append block items under it (prototype-verified valid: Obsidian sees tags = calendar tags). Calendar tags beginning with `#` (or containing flow indicators) must be quoted when written. Prototype `yamlSafeTag()` quotes only tags that would otherwise be invalid, so ordinary tags stay unquoted per D-06.
**Warning signs:** The Properties panel shows "Invalid YAML" or an empty tags property after merge.

### Pitfall 3: Indentless block sequences
**What goes wrong:** `tags:\n- a\n- b` (dash at column 0) is valid YAML and common when users paste from other tools. A scanner that requires indentation treats `- a` as the end of the block and appends at the wrong place, or emits a second key.
**How to avoid:** The region scan accepts column-0 `- ` lines, and new items reuse the detected indent (`""`).

### Pitfall 4: Quoted commas and trailing commas in inline arrays
**What goes wrong:** Naive `split(",")` breaks `["x, y", b]`. Naive append to `[a, b,]` produces `[a, b,, c]`.
**How to avoid:** Use a quote-aware splitter. Use the `head.endsWith(",") ? " " : ", "` separator logic.

### Pitfall 5: Cross-substitution through `reduce` order
**What goes wrong:** `applyTemplateVariables` replaces key by key in insertion order. A *value* inserted by an earlier key (e.g. `event_title` containing the literal text `{{d}}`) is re-substituted by a later key.
**How to avoid:** Insert the new keys right after `month`. That puts them before `source`/`location`/`description`/attendees, so description text containing `{{week}}` is never altered. Only `event_title`/date/time values precede them, which is the same exposure every existing key already has. Note that the token match itself is exact: verified `"{{ d }} {{D}} {{ddd}}"` is left untouched and `"{{d}} {{dd}} {{date}}"` → `"4 04 2026-05-04"`. Substitution is case-sensitive, so `{{D}}` is not a variable.

### Pitfall 6: UTC `{{date}}` vs local `{{dd}}` (pre-existing, affects UAT)
**What goes wrong:** `formatDate` ISO and `{{date-iso}}` use `toISOString()` (UTC). All-day events are built at local midnight (`new Date(year, month - 1, day, 0, 0, 0)` [VERIFIED: src/utils/timezoneUtils.ts:172]), so in UTC+ zones `{{date}}` renders the previous day next to a correct `{{dd}}`. Verified in `TZ=Europe/Athens`: `2026-05-03` vs `4`.
**How to avoid:** Do not change this in Phase 9 (not in requirements). Run the criterion-4 side-by-side UAT on a **timed event at midday**, and record the discrepancy as a known pre-existing issue (see Open Question 1).

### Pitfall 7: Harness cannot import `NoteService.ts`
**What goes wrong:** `obsidian` is types-only (`"main": ""` in obsidian 1.12.3 package.json), so `import … from "obsidian"` fails in Node with `ERR_MODULE_NOT_FOUND` (verified).
**How to avoid:** Keep the merger and date-parts in pure modules with no `obsidian` import. luxon resolves fine in Node.

### Pitfall 8: Harness file picked up by `tsc`/`eslint`
**What goes wrong:** `tsconfig.json` has `"include": ["**/*.ts"]`. A `.ts` harness that imports `./x.ts` would hit TS5097 during `npm run build`.
**How to avoid:** Write the harness as `.mjs` under `.planning/` (not matched by `*.ts`, and not under `eslint src/`). Node's type stripping still lets the `.mjs` import the `src/utils/*.ts` modules. Verified working, with a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning.

### Pitfall 9: Substituted multi-line values in frontmatter
**What goes wrong:** Merge runs after substitution (D-07). A `{{description}}` placed in frontmatter could inject a column-0 `tags:` line.
**How to avoid:** Accept. This is the same exposure as today's duplicate-key bug and is user-authored. The merger's ">1 tags key → untouched" rule keeps it from making things worse.

## Code Examples

### mergeCalendarTags (reference implementation; lint + tsc clean under repo config; 22/22 fixtures pass)
```typescript
// Source: prototype written and verified this session (eslint src/ + tsc -noEmit clean with repo configs)
export interface TagMergeResult {
  /** true when a top-level `tags` key exists (merged, already complete, or left untouched as unsafe) */
  found: boolean;
  content: string;
}

const TAGS_KEY_LINE = /^((["']?)tags\2[ \t]*:)(.*)$/;
const NULL_VALUES = new Set(["~", "null", "Null", "NULL", '""', "''"]);

export function normalizeTag(tag: string): string {
  let t = tag.trim();
  if (t.length >= 2 && (t[0] === '"' || t[0] === "'") && t[t.length - 1] === t[0]) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/^#+/, "").trim().toLowerCase();
}

/** Split a YAML value into [body, comment]; a comment starts at '#' preceded by whitespace (or at index 0) outside quotes. */
export function splitComment(value: string): [string, string] {
  let quote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
      return [value.slice(0, i).trimEnd(), value.slice(i)];
    }
  }
  return [value.trimEnd(), ""];
}

/** Split on commas outside quotes. Returns null if an unquoted flow indicator ([]{}) is present. */
function splitFlowItems(text: string): string[] | null {
  const items: string[] = [];
  let quote: string | null = null;
  let current = "";
  for (const c of text) {
    if (quote) {
      current += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; current += c; continue; }
    if ("[]{}".includes(c)) return null;
    if (c === ",") { items.push(current.trim()); current = ""; continue; }
    current += c;
  }
  if (quote) return null;
  items.push(current.trim());
  return items.filter((s) => s.length > 0);
}

/** Quote a calendar tag only when it would not be a valid plain scalar. Ordinary tags are returned unchanged. */
export function yamlSafeTag(tag: string, flow: boolean): string {
  const needsQuote =
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(tag) ||
    /: |\s#/.test(tag) ||
    (flow && /[,[\]{}]/.test(tag));
  return needsQuote ? JSON.stringify(tag) : tag;
}

export function mergeCalendarTags(frontmatter: string, calendarTags: string[]): TagMergeResult {
  const lines = frontmatter.split("\n");
  const keyIdx: number[] = [];
  lines.forEach((l, i) => { if (TAGS_KEY_LINE.test(l)) keyIdx.push(i); });
  if (keyIdx.length === 0) return { found: false, content: frontmatter };
  const untouched = { found: true, content: frontmatter };
  if (keyIdx.length > 1) return untouched; // user already has duplicates: never add another

  const i = keyIdx[0];
  const m = TAGS_KEY_LINE.exec(lines[i]);
  if (!m) return untouched;
  const keyPart = m[1];
  const rawValue = m[3];
  const leadingWs = rawValue.slice(0, rawValue.length - rawValue.trimStart().length);
  const [body0, comment] = splitComment(rawValue.slice(leadingWs.length));
  const body = body0.trim();
  const commentSuffix = comment ? ` ${comment}` : "";

  // Region after the key line: blank, comment, indented, or column-0 "- " lines.
  let end = i + 1;
  while (end < lines.length && /^(\s*$|[ \t]|-(\s|$)|#)/.test(lines[end])) end++;
  const region = lines.slice(i + 1, end);

  const seen = new Set<string>();
  const pickNew = (existing: string[]): string[] => {
    existing.forEach((t) => seen.add(normalizeTag(t)));
    const out: string[] = [];
    for (const tag of calendarTags) {
      const n = normalizeTag(tag);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(tag);
    }
    return out;
  };

  // Block list or empty key
  if (body === "" || NULL_VALUES.has(body)) {
    const itemRe = /^([ \t]*)-(?:[ \t]+(.*))?$/;
    let indent: string | null = null;
    let lastItem = -1;
    const existing: string[] = [];
    for (let k = 0; k < region.length; k++) {
      const l = region[k];
      if (/^\s*$/.test(l) || /^\s*#/.test(l)) continue;
      const im = itemRe.exec(l);
      if (!im) return untouched; // continuation / nested / unknown shape
      if (indent === null) indent = im[1];
      if (im[1] !== indent) return untouched;
      if (body !== "") return untouched; // `tags: ~` followed by items is invalid already
      existing.push(splitComment(im[2] ?? "")[0]);
      lastItem = i + 1 + k;
    }
    const add = pickNew(existing);
    if (add.length === 0) return untouched;
    const out = [...lines];
    if (lastItem === -1) {
      out[i] = `${keyPart}${commentSuffix}`; // drop null-ish value, keep comment
      out.splice(i + 1, 0, ...add.map((t) => `  - ${yamlSafeTag(t, false)}`));
    } else {
      out.splice(lastItem + 1, 0, ...add.map((t) => `${indent}- ${yamlSafeTag(t, false)}`));
    }
    return { found: true, content: out.join("\n") };
  }

  // Any non-blank, non-comment continuation line under a scalar/flow value is unsafe (multi-line value)
  if (region.some((l) => !/^\s*$/.test(l) && !/^\s*#/.test(l))) return untouched;
  if (/^[{|>&*!]/.test(body)) return untouched;

  if (body.startsWith("[")) {
    if (!body.endsWith("]")) return untouched; // multi-line flow sequence
    const inner = body.slice(1, -1);
    const items = splitFlowItems(inner);
    if (items === null) return untouched; // nested flow collections
    const add = pickNew(items);
    if (add.length === 0) return untouched;
    const head = inner.trimEnd();
    const sep = head.trim() === "" ? "" : head.endsWith(",") ? " " : ", ";
    const newBody = `[${head}${sep}${add.map((t) => yamlSafeTag(t, true)).join(", ")}]`;
    const out = [...lines];
    out[i] = `${keyPart}${leadingWs}${newBody}${commentSuffix}`;
    return { found: true, content: out.join("\n") };
  }

  // Scalar (incl. legacy comma form) -> inline array
  const items = splitFlowItems(body);
  if (items === null) return untouched;
  const add = pickNew(items);
  if (add.length === 0) return untouched;
  const out = [...lines];
  out[i] = `${keyPart} [${[...items, ...add.map((t) => yamlSafeTag(t, true))].join(", ")}]${commentSuffix}`;
  return { found: true, content: out.join("\n") };
}
```
The executor should reformat this to project style: multi-line `if` bodies, trailing commas, 2-space indentation, double quotes. Behavior must stay identical, so re-run the harness after any reformat.

### Verified fixture → expected output (calendar tags `["event", "meeting", "Work"]`)
| Fixture (default frontmatter body) | Expected merged body |
|---|---|
| `type: event\ntags:\n  - a\n  - b\ndate: 2026-05-04` | `type: event\ntags:\n  - a\n  - b\n  - event\n  - meeting\n  - Work\ndate: 2026-05-04` |
| `type: event\ntags:\n- a\ndate: x` | `type: event\ntags:\n- a\n- event\n- meeting\n- Work\ndate: x` |
| `type: event\ntags: [a, b]\ndate: x` | `type: event\ntags: [a, b, event, meeting, Work]\ndate: x` |
| `tags: []\ndate: x` | `tags: [event, meeting, Work]\ndate: x` |
| `tags: [a, b,]` | `tags: [a, b, event, meeting, Work]` |
| `tags: ["x, y", b] # c` | `tags: ["x, y", b, event, meeting, Work] # c` |
| `tags: a\ndate: x` | `tags: [a, event, meeting, Work]\ndate: x` |
| `tags: a, b` | `tags: [a, b, event, meeting, Work]` |
| `type: event\ntags:` | `type: event\ntags:\n  - event\n  - meeting\n  - Work` |
| `tags:\ndate: x` | `tags:\n  - event\n  - meeting\n  - Work\ndate: x` |
| `tags: ~\ndate: x` | `tags:\n  - event\n  - meeting\n  - Work\ndate: x` |
| `tags: #a\ndate: x` | `tags: #a\n  - event\n  - meeting\n  - Work\ndate: x` |
| `tags:\n  - "Event"\n  - '#meeting'\n  - work` | unchanged (all calendar tags dedup against user tags, D-05/D-06) |
| `tags: [event, meeting, work]` | unchanged |
| `"tags": [a]` | `"tags": [a, event, meeting, Work]` |
| `type: event\ndate: x` (no key) | `type: event\ndate: x\ntags:\n  - event\n  - meeting\n  - Work` (1.15.0) |
| `` (empty) | `tags:\n  - event\n  - meeting\n  - Work` (1.15.0) |
| `tag: a` | `tag: a\ntags:\n  - event\n  - meeting\n  - Work` (D-08) |
| `tags: [a,\n  b]\ndate: x` | unchanged (D-03) |
| `tags: {a: 1}` | unchanged (D-03) |
| `tags: a\nx: 1\ntags: b` | unchanged (pre-existing user duplicate; no third key added) |

### getEventDateVariables (pure; luxon only)
```typescript
// Source: verified this session; luxon weekNumber is ISO per luxon 3.6.1 src/datetime.js:1234-1240
import { DateTime } from "luxon";

export interface EventDateVariables {
  week: string;
  dd: string;
  d: string;
  year: string;
}

export function getEventDateVariables(date: Date): EventDateVariables {
  const day = date.getDate();
  return {
    week: DateTime.fromJSDate(date).weekNumber.toString(),
    dd: day.toString().padStart(2, "0"),
    d: day.toString(),
    year: date.getFullYear().toString(),
  };
}
```
Verified output: `new Date(2026,4,4,9)` → `{ week: '19', dd: '04', d: '4', year: '2026' }`, and `new Date(2027,0,1,9)` → `{ week: '53', dd: '01', d: '1', year: '2027' }`. The same weekNumber matched `moment#isoWeek` and a reference helper for every day from 1990 to 2060 at 00:30/12:30/23:30, in Europe/Athens, America/Los_Angeles, Pacific/Auckland and UTC: 77,799 samples each, 0 mismatches. `padStart` is already used in `NoteService.ts:520` (`MM: (month + 1).toString().padStart(2, "0"),`), so it compiles under the repo's tsconfig lib setting.

In `getEventTemplateVariables`, spread after `month`, for example `...getEventDateVariables(event.start),`. Or assign the four keys explicitly with comments in the existing `day`/`month` style, e.g. `// ISO 8601 week number of the event start (e.g. "19") — unpadded, local time`.

### Harness skeleton (`.planning/phases/09-event-note-content/verify-09.mjs`)
```javascript
// Run: node .planning/phases/09-event-note-content/verify-09.mjs   (Node >= 22.18 / 23.6 for default TS type stripping)
import assert from "node:assert/strict";
import YAML from "yaml";        // transitive dev dep (package-lock: yaml 2.9.0)
import jsyaml from "js-yaml";   // transitive dev dep (package-lock: js-yaml 4.1.1)
import { mergeCalendarTags } from "../../../src/utils/frontmatterTags.ts";
import { getEventDateVariables } from "../../../src/utils/eventDateVariables.ts";

const formatTagsYaml = (t) => "tags:\n" + t.map((x) => `  - ${x}`).join("\n"); // mirror NoteService:252-254
const generate = (fm, tags) => {
  if (tags.length === 0) return fm;
  const r = mergeCalendarTags(fm, tags);
  return r.found ? r.content : (fm ? fm + "\n" : "") + formatTagsYaml(tags);
};
// for each fixture row above: assert.equal(generate(input, cal), expected);
//   and for parseable ones: YAML.parse(out, { uniqueKeys: true }); jsyaml.load(out); one /^(["']?)tags\1\s*:/m line
assert.deepEqual(getEventDateVariables(new Date(2026, 4, 4, 9)), { week: "19", dd: "04", d: "4", year: "2026" });
assert.deepEqual(getEventDateVariables(new Date(2027, 0, 1, 9)), { week: "53", dd: "01", d: "1", year: "2027" });
console.log("verify-09: all checks passed");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-node/tsx needed to run TS in Node | Built-in type stripping (no flag) | Node 23.6 / 22.18 | Harness needs no new dev dependency. Local Node is v26.12.0 |
| luxon `weekNumber` only | `weekNumber` (ISO) + `localWeekNumber` (locale) | luxon 3.4 | Must use `weekNumber`, not `localWeekNumber` (en-US gave `18` for 2026-05-04) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Obsidian's frontmatter parser rejects duplicate keys and malformed flow the same way `yaml` (uniqueKeys) and `js-yaml` do. The identity of Obsidian's YAML library could not be confirmed | Summary, Validation | Low. The merger never emits duplicates, and Obsidian UAT is the final gate |
| A2 | Quoting calendar tags only when they would otherwise be invalid YAML (`yamlSafeTag`) is within D-06's intent ("written unquoted as formatTagsYaml does today") | Pitfall 2, Code Examples | Low. Ordinary tags are unquoted. If the user rejects it, drop `yamlSafeTag` and accept that `#tag`-style calendar tags break inline arrays |
| A3 | Treating quoted keys `"tags":`/`'tags':` as the tags key is consistent with D-08 (which lists only `tag:`, `Tags:`, and nested keys as excluded) | Pattern 1 | Low. The alternative produces a YAML duplicate-key error, which violates D-03 |
| A4 | Placing merger/date code in new `src/utils/*.ts` files (rather than NoteService private methods) is acceptable under "Claude's Discretion: structure of the tag merger" | Project Structure | Low. Only affects automated verifiability, not behavior |
| A5 | `~`/`null`/`""`/`''` values are treated as an empty `tags` key and replaced by a block list | Pattern 1 | Very low. The alternative (D-03 skip) loses calendar tags |

## Open Questions

1. **Pre-existing UTC `{{date}}`/`{{date-iso}}` off-by-one for all-day events in UTC+ zones**
   - What we know: `formatDate` ISO and `*-iso` use `toISOString()`. All-day events start at local midnight. In Europe/Athens, `{{date}}` = `2026-05-03` while `{{dd}}` = `04`.
   - What's unclear: whether the user wants it fixed in this phase. It is not in BUG-08..ENH-12, and success criterion 4 says the side-by-side template "renders all three correctly".
   - Recommendation: Do not fix in Phase 9. Run criterion-4 UAT with a timed midday event, and log a backlog item. If the user wants it fixed, it is a separate change to `formatDate`/`date-iso`, and it changes existing users' filenames, so it needs its own decision.
2. **Should `{{week}}` docs warn that it can differ from the calendar grid's week column?** That decision belongs to Phase 11 (DOC-03). Noted in CONTEXT specifics; nothing to do here.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | lint/build/harness | ✓ | v26.12.0 | — |
| npm `node_modules` | `npm run lint`, `npm run build`, harness (luxon/yaml/js-yaml) | ✗ (not installed in working tree) | — | Run `npm ci` in Wave 0 (verified working with the repo lockfile in a scratch copy) |
| Obsidian desktop app | Manual UAT (Properties panel, note creation) | not probed (GUI) | — | none, so human UAT checkpoint |
| gh CLI | (not needed this phase) | ✓ authenticated | — | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** `node_modules`, via `npm ci`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | ESLint 9 + `tsc` type-check (existing CI gate) + phase-local Node harness (`node:assert`, no framework) + manual Obsidian UAT |
| Config file | `eslint.config.mjs`, `tsconfig.json`; harness `.planning/phases/09-event-note-content/verify-09.mjs` (Wave 0) |
| Quick run command | `npm run lint && node .planning/phases/09-event-note-content/verify-09.mjs` |
| Full suite command | `npm run lint && npm run build && node .planning/phases/09-event-note-content/verify-09.mjs` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-08 | block / indentless / inline / `[]` / trailing comma / quoted comma / scalar / comma scalar / empty / `~` / `#`-comment / quoted key merged in place, exactly one tags key, parses under yaml(uniqueKeys)+js-yaml | unit (harness) | `node .planning/phases/09-event-note-content/verify-09.mjs` | ❌ Wave 0 |
| BUG-08 | Obsidian Properties panel shows one `tags` property, no YAML error (block, inline, scalar fixtures, global and per-calendar frontmatter) | manual UAT | — | manual-only |
| BUG-09 | dedup (quotes, `#`, case) and order (user first, then calendar order); unsafe shapes untouched; other lines byte-identical | unit (harness exact-string) | same harness | ❌ Wave 0 |
| BUG-09 | no `tags` key → exact 1.15.0 output for `DEFAULT_FRONTMATTER` + `DEFAULT_TAGS` | unit (harness exact-string) | same harness | ❌ Wave 0 |
| ENH-09/10/11 | 2026-05-04 → 19/04/4/2026; 2027-01-01 → 53/01/1/2027 | unit (harness) | same harness | ❌ Wave 0 |
| ENH-12 | `{{d}} {{dd}} {{date}}` and all four vars in title (sanitized filename), template body, default frontmatter | manual UAT (timed midday event, see Pitfall 6) + grep that keys exist in `EventTemplateVariables` | `grep -nE '^\s+(week|dd|d|year): string;' src/services/NoteService.ts` → 4 lines | manual-only for rendering |
| all | lint + type-check gate | automated | `npm run lint && npm run build` | ✅ |

### Sampling Rate
- **Per task commit:** `npm run lint && node .planning/phases/09-event-note-content/verify-09.mjs`
- **Per wave merge:** `npm run lint && npm run build && node .planning/phases/09-event-note-content/verify-09.mjs`
- **Phase gate:** Full suite green + Obsidian UAT (recorded in `09-HUMAN-UAT.md`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `npm ci` (node_modules absent)
- [ ] `.planning/phases/09-event-note-content/verify-09.mjs`: fixture table above + date checks
- [ ] `09-HUMAN-UAT.md` script: create notes from a tagged calendar with each fixture as global default frontmatter and at least one as per-calendar override; check Properties panel; title format `{{year}}-W{{week}} {{day}} {{dd}} {{month}} {{event_title}}`; template line `{{d}} | {{dd}} | {{date}} | {{week}} | {{year}}`; frontmatter line `week: {{week}}`; use events on 2026-05-04 and 2027-01-01 (timed, midday)

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (user/ICS strings flow into YAML and filenames) | Conservative classifier (unknown shape → untouched); `yamlSafeTag` quoting; existing `sanitizeFileName` for titles |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| YAML injection via calendar tag text (`#`, `[`, `: `) corrupting frontmatter | Tampering | `yamlSafeTag` quotes non-plain-safe tags in merge paths |
| Path characters in new title variables | Tampering | Values are digits only, and still pass through `sanitizeFileName` |
| ReDoS in new regexes | DoS | All regexes are anchored with no nested quantifiers. Inputs are short settings strings |

## Sources

### Primary (HIGH confidence)
- `src/services/NoteService.ts` (full read): lines 7-31, 214-254, 256-332, 511-533
- `src/utils/constants.ts:11-12`, `src/utils/timezoneUtils.ts:1,172`, `src/settings/SettingsTab.ts:1268-1273` (`parseTags` splits on commas, so calendar tags never contain commas)
- `node_modules/luxon/src/datetime.js:1224-1279` (luxon 3.6.1, `weekNumber` ISO vs `localWeekNumber`)
- `node_modules/obsidian/package.json` (`"main": ""`) and `obsidian.d.ts:4415` (`export const moment: typeof Moment;`)
- Executed verification: ISO-week cross-check script (4 TZs × 77,799 samples), merger prototype (22 fixtures × 2 parsers), `eslint src/` + `tsc -noEmit` with repo configs, and the substitution-order check
- GitHub issues #61 and #63 (via `gh issue view`)

### Secondary (MEDIUM confidence)
- [yaml error handling: DUPLICATE_KEY](https://tessl.io/registry/tessl/npm-yaml/files/docs/error-handling.md)
- [Obsidian forum: frontmatter parse failures (tab indentation)](https://forum.obsidian.md/t/only-indent-with-spaces-in-yaml-front-matter-or-allow-yaml-parser-to-handle-tab-indentation/48457)

### Tertiary (LOW confidence)
- Which YAML library Obsidian uses internally: not established (A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new deps, and luxon semantics were read from source and cross-checked empirically.
- Architecture: HIGH. The integration point is small and the 1.15.0 path stays verbatim.
- Pitfalls: HIGH. Each was reproduced in a scratch run (UTC date, `#` comment, indentless lists, obsidian types-only).

**Research date:** 2026-10-20
**Valid until:** 2026-11-19 (stable domain)
