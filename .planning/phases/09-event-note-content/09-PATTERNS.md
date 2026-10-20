# Phase 9: Event Note Content - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 4
**Analogs found:** 3 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/NoteService.ts` (modify) | service | transform (note creation) | itself: `generateFrontmatter` L214-235, `getEventTemplateVariables` L257-292, interface L7-31 | exact |
| `src/utils/frontmatterTags.ts` (new, pure, no imports) | utility | transform (string) | `src/utils/colorValidation.ts` (pure, no imports, module-private regex const + exported functions) | role-match |
| `src/utils/eventDateVariables.ts` (new, luxon only) | utility | transform (Date -> strings) | `src/utils/timezoneUtils.ts` L1 (luxon import) + `NoteService.getFolderTemplateVariables` L511-533 (date-part accessors) | role-match |
| `.planning/phases/09-event-note-content/verify-09.mjs` (new) | test harness | batch | none in repo (no `.mjs` harness exists) | none |

All analogs verified git-tracked (`git ls-files src/utils` lists colorValidation.ts, timezoneUtils.ts, etc.).

## Pattern Assignments

### `src/services/NoteService.ts` (service, transform)

**Imports** (L1-5): add `import { mergeCalendarTags } from "../utils/frontmatterTags";` and `import { getEventDateVariables } from "../utils/eventDateVariables";` following the existing relative style:
```typescript
import { TFile, TFolder, normalizePath } from "obsidian";
import MemoChron from "../main";
import { MemoChronSettings, CalendarNotesSettings } from "../settings/types";
import { CalendarEvent } from "./CalendarService";
import { errorMessage } from "../utils/errors";
```

**Interface comment style** (L17-20) - insert `week`, `dd`, `d`, `year` immediately after `month` (Pitfall 5 ordering):
```typescript
  // Full English weekday name (e.g. "Monday") — locale hard-coded to "en-US"
  day: string;
  // Full English month name (e.g. "January") — locale hard-coded to "en-US"
  month: string;
  source: string;
```

**Return object** (L279-281) - insert after `month:` and before `source:`:
```typescript
      day: event.start.toLocaleDateString("en-US", { weekday: "long" }),
      month: event.start.toLocaleDateString("en-US", { month: "long" }),
      source: event.source,
```
Either `...getEventDateVariables(event.start),` or four explicit keys.

**Integration point to replace** (L227-234, inside `generateFrontmatter` L214-235):
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
Wrap with `mergeCalendarTags(frontmatterContent, tags)`; when `found === false`, run the block above verbatim (D-02). See RESEARCH Pattern 2. Keep `formatTagsYaml` (L252-254) unchanged:
```typescript
  private formatTagsYaml(tags: string[]): string {
    return "tags:\n" + tags.map((tag) => `  - ${tag}`).join("\n");
  }
```

---

### `src/utils/frontmatterTags.ts` (utility, pure transform)

**Analog:** `src/utils/colorValidation.ts`. It has no imports, a module-private documented regex const, and exported functions with JSDoc and multi-line `if` bodies.

**Structure** (L1-28):
```typescript
// Module-private whitelist regex ... (explanatory comment block)
const VALID_COLOR_REGEX =
  /^(#[0-9a-fA-F]{3}...)$/;

/**
 * Validate a CSS color string ...
 * @param value The color string to validate
 * @returns true if ...
 */
export function isValidColor(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }
  return VALID_COLOR_REGEX.test(value);
}
```
Apply this to `TAGS_KEY_LINE` / `NULL_VALUES` (module-private consts with comment) and to the exported `mergeCalendarTags`, `normalizeTag`, `splitComment`, and `yamlSafeTag`. The body comes from the RESEARCH "mergeCalendarTags" reference implementation (L284-442). Reformat it to project style (braced multi-line `if`, double quotes, trailing commas, 2-space indent). It must NOT import `obsidian` (Pitfall 7).

---

### `src/utils/eventDateVariables.ts` (utility, transform)

**Import analog:** `src/utils/timezoneUtils.ts` L1:
```typescript
import { DateTime } from "luxon";
```
**Date-part analog:** `NoteService.ts` L511-528 (`getFolderTemplateVariables`), which uses local-time accessors and `padStart`:
```typescript
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    ...
      YYYY: year.toString(),
      DD: day.toString().padStart(2, "0"),
      D: day.toString(),
```
Week: `DateTime.fromJSDate(date).weekNumber` (ISO). Do NOT use `localWeekNumber` or moment `.week()`. Body comes from the RESEARCH "getEventDateVariables" example (L474-491).

---

### `.planning/phases/09-event-note-content/verify-09.mjs` (harness, batch)

There is no analog. Use the RESEARCH "Harness skeleton" (L497-517) and fixture table (L446-469). Keep it `.mjs` and outside `src/` so tsc and eslint ignore it (Pitfall 8). It imports the `src/utils/*.ts` modules directly through Node type stripping.

## Shared Patterns

### Local-time date derivation
**Source:** `NoteService.ts` L511-528
**Apply to:** eventDateVariables.ts. Use `getFullYear`/`getDate`, never `toISOString()` (D-12, Pitfall 6).

### Full-token substitution (unchanged)
**Source:** `NoteService.ts` `applyTemplateVariables` L294+ (reduce over `Object.entries(variables)` with a full `{{key}}` regex) and `formatTitle`. No changes are needed. New keys flow through automatically (D-11).

### Lint gate
`npm run lint` (eslint src/) must pass for both new util files. See `.planning/codebase/CONVENTIONS.md`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/phases/09-event-note-content/verify-09.mjs` | test harness | batch | Repo has no test suite or Node harness; use the RESEARCH skeleton |

## Metadata

**Analog search scope:** `src/services/NoteService.ts`, `src/utils/*`, `.planning/**/*.mjs`
**Files scanned:** 8
**Pattern extraction date:** 2026-10-20
