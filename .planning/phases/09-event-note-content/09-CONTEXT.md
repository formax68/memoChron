# Phase 9: Event Note Content - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Event notes created from any calendar carry exactly one `tags` property: the calendar's tags are merged into whatever `tags` key the user's default frontmatter (global or per-calendar) already declares (#61, BUG-08/09). Four new event template variables — `{{week}}` (ISO week, unpadded), `{{dd}}`, `{{d}}`, `{{year}}` (calendar year) — resolve in note titles, note templates, and default frontmatter (#63, ENH-09..12). All changes live in `src/services/NoteService.ts`.

Not in this phase: full YAML parse/re-serialize of user frontmatter (Out of Scope), folder-path template tokens, arbitrary moment-format tokens (TMPL-01), locale-aware names (I18N-01), README/settings-tab docs for the new variables (Phase 11, DOC-03).

</domain>

<decisions>
## Implementation Decisions

User delegated all gray areas ("sensible defaults on the above"). Every decision below is Claude-chosen; the planner may refine details but should keep the intent.

### Merged tag output shape (BUG-08)
- **D-01:** Preserve the form the user wrote. Never re-format lines other than the `tags` key's own value lines.
  - **Block list** (`tags:` followed by `  - a` lines) → append each new calendar tag as an extra `- tag` line directly after the last existing item, reusing the indentation of the existing items.
  - **Inline array** (`tags: [a, b]`) → insert new tags inside the brackets: `tags: [a, b, work]`. `tags: []` → `tags: [work, meeting]`.
  - **Scalar** (`tags: a`, or legacy comma form `tags: a, b`) → rewrite that one line as an inline array: `tags: [a, b, work]` (split on commas, trim whitespace). Keeps it to one line and is valid YAML for Obsidian Properties.
  - **Empty key** (`tags:` with no value and no following items) → emit calendar tags as a block list under it, identical in format to the existing `formatTagsYaml` output.
- **D-02:** When the default frontmatter has no top-level `tags` key, keep the 1.15.0 behavior byte-for-byte (append `formatTagsYaml` block at the end). When the event has no calendar tags, frontmatter is untouched.
- **D-03:** Hard invariant: the generated frontmatter never contains more than one top-level `tags` key emitted by MemoChron. If the user's `tags` value is in a shape the merger can't safely edit (e.g. a multi-line flow array, flow mapping), leave the user's `tags` lines untouched and skip adding calendar tags rather than emitting a second key.

### Tag order & dedup (BUG-09)
- **D-04:** Order = the user's existing tags first in their original order, then calendar tags in the existing `getTagsForEvent` order (global/per-calendar default tags, then source tags).
- **D-05:** Dedup compares normalized forms: strip surrounding `"`/`'` quotes, strip a leading `#`, trim, case-insensitive (Obsidian treats tags case-insensitively). A calendar tag matching any existing user tag is skipped.
- **D-06:** User-authored tag values are never rewritten (quotes, `#`, casing, and even pre-existing user duplicates stay as written). Only calendar tags that are new get appended, written unquoted as `formatTagsYaml` does today.

### Tag edge cases
- **D-07:** Merge runs after template-variable substitution on the frontmatter (current `generateFrontmatter` order), so `tags: [{{source}}]` resolves first and is then merged/deduped.
- **D-08:** Only a top-level (column-0) key named exactly `tags` is merged. Singular `tag:`, differently-cased `Tags:`, and indented/nested `tags` keys are not treated as the tags property (they don't cause a YAML duplicate-key error with the appended `tags`).
- **D-09:** Global vs per-calendar: the code already selects one (`calendarSettings.defaultFrontmatter ?? settings.defaultFrontmatter`); there is no cross-merge between the two. Merge targets whichever is in effect.
- **D-10:** Inline comments after a tags value (`tags: [a] # note`) — Claude's discretion; preserve the comment if handled, otherwise fall under D-03 (skip, never duplicate).

### New template variables (ENH-09..12)
- **D-11:** Variables are added only to `EventTemplateVariables` / `getEventTemplateVariables`, so they automatically flow through all three existing paths: `formatTitle` (sanitized), `applyTemplateVariables` for the note template, and default frontmatter. The folder-path template (`{YYYY}`, `{DD}`, `{D}` … in `FolderTemplateVariables`) is not extended.
- **D-12:** Values derive from `event.start` in local time (`getFullYear`/`getDate`), consistent with `{{day}}`/`{{month}}`, the folder variables, and how all-day events are constructed in `timezoneUtils.ts`. They do not depend on the "Note date format" setting.
- **D-13:** `{{week}}` = ISO 8601 week (Monday start, week containing the first Thursday), unpadded. `{{year}}` = `getFullYear()` (calendar year, never ISO week-year). Acceptance checks: 2026-05-04 → week `19`, dd `04`, d `4`, year `2026`; 2027-01-01 → week `53`, year `2027`.
- **D-14:** No change to the substitution mechanism is needed: both `applyTemplateVariables` and `formatTitle` match the full `{{key}}` token, so `{{d}}` cannot touch `{{dd}}` or `{{date}}`. Planner should still include the side-by-side `{{d}} {{dd}} {{date}}` UAT check.

### Claude's Discretion
- ISO week computation: Obsidian's re-exported `moment` (`moment(date).isoWeek()`, already imported in `CalendarView.ts`) or a small local helper — either is fine.
- Structure of the tag merger (line-scanning helper inside `NoteService`, private methods) and handling of exotic YAML shapes within D-03.
- Comment style on the new interface fields should match the existing `day`/`month` comments.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope
- `.planning/REQUIREMENTS.md` — BUG-08, BUG-09, ENH-09..12 and the Out of Scope table (no full YAML re-serialize)
- `.planning/ROADMAP.md` §"Phase 9: Event Note Content" — success criteria 1–4 (incl. 2026-05-04 and 2027-01-01 date checks)
- `.planning/STATE.md` §"Blockers/Concerns" — Phase 09 edge-case notes

### Conventions
- `.planning/codebase/CONVENTIONS.md` §"Directory Compliance" — rules every change must follow; `npm run lint` CI gate
- `CLAUDE.md` — project conventions

### Code
- `src/services/NoteService.ts` — `generateFrontmatter`, `cleanFrontmatter`, `formatTagsYaml`, `getTagsForEvent`, `getEventTemplateVariables`, `applyTemplateVariables`, `formatTitle`, `EventTemplateVariables`
- `src/utils/constants.ts` — `DEFAULT_FRONTMATTER` (no `tags` key) and `DEFAULT_TAGS`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatTagsYaml(tags)`: produces the block-list format to keep for the no-`tags`-key and empty-`tags:` cases.
- `getTagsForEvent(event)`: already dedups (exact match) global/per-calendar default tags + source tags; its output is the "calendar tags" list for the merge.
- `cleanFrontmatter`: strips `---` delimiters; merge operates on its output after `applyTemplateVariables`.

### Established Patterns
- Template variables are a flat `Record`-like interface; substitution via a `reduce` over entries with full-token regex.
- Title values are passed through `sanitizeFileName`; new variables are numeric so sanitization is a no-op but still applies.
- Date parts in folder variables use local-time `Date` accessors.

### Integration Points
- `generateFrontmatter` lines 227–234: replace the unconditional append with merge-or-append.
- `getEventTemplateVariables` return object + `EventTemplateVariables` interface: add `week`, `dd`, `d`, `year`.

</code_context>

<specifics>
## Specific Ideas

- The calendar grid's week-number column (`CalendarView.ts` ~line 548) uses `moment(date).week()` — locale week, not ISO. `{{week}}` is ISO by requirement, so the two can differ in some locales. Do not change the view in this phase; Phase 11 docs may need to say `{{week}}` is ISO.
- No test suite exists; verification is manual UAT. The planner should spell out concrete frontmatter fixtures (block, inline, scalar, empty, `tags: []`, quoted, `#`-prefixed, mixed-case duplicate) with expected output.

</specifics>

<deferred>
## Deferred Ideas

- `{week}` / ISO-week token for the folder-path template — possible backlog item, not requested by #63.
- Aligning the calendar view's week-number column with ISO weeks — separate UX decision.

</deferred>

---

*Phase: 09-event-note-content*
*Context gathered: 2026-10-20*
