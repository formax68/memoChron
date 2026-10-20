# Phase 8: Type Hygiene & Conventions - Research

**Researched:** 2026-05-16
**Domain:** TypeScript hygiene + ESLint discipline + conventions documentation for an Obsidian plugin
**Confidence:** HIGH (every claim was verified by reading source files, running ESLint, or fetching docs URLs — see provenance tags inline)

## Summary

Phase 8 closes the final cluster of Obsidian community-plugin scorecard findings — DIR-01 (`console.*` in shipped code), DIR-09 (`any`, `??`-with-constant-LHS, `no-case-declarations`, `no-useless-escape`), DIR-10 (`no-unused-vars`) — then lands DOC-02 (`## Directory Compliance` section in `.planning/codebase/CONVENTIONS.md` + pointer section in `CLAUDE.md`) and deletes the Phase-8 ESLint override block as the acceptance commit.

Live ESLint inventory (with Phase-8 overrides forcibly disabled): **75 errors** total — 39 `no-console`, 16 `no-explicit-any`, 18 `no-unused-vars`, 1 `no-case-declarations`, 1 `no-useless-escape`. Zero `??`-with-constant-LHS sites (grep confirmed). All numbers verified against live `npx eslint src/` output.

**One conflict with CONTEXT.md surfaced during research and must be resolved at plan-phase, before plans are written:** `obsidian` exports a typed `moment` (`export const moment: typeof Moment` at `node_modules/obsidian/obsidian.d.ts:4415`). The CONTEXT.md D-08 decision to keep `(window as any).moment` with per-line `eslint-disable-next-line` is technically valid but is no longer the cleanest option — replacing all 5 sites with `import { moment } from "obsidian"` eliminates the `any` cast entirely with zero bundle-size impact (obsidian is already external). This is the Phase-7 A1/A2 verification pattern repeating: a CONTEXT decision based on existing convention turns out to contradict a better-documented current option. See `## Conflicts with CONTEXT.md` for the full analysis. Planner picks; either is defensible.

**Primary recommendation:** Execute the 5-commit sequence locked in CONTEXT.md D-05 in order. Resolve the `window.moment` conflict (Option A: keep CONTEXT default — per-line disable + rationale; Option B: import the typed `moment` from obsidian and delete all 5 casts) at plan-phase time. Use the do/don't block template in `## DOC-02 Section Templates` verbatim — every URL in the template has been HTTP-200-verified.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Console logging discipline | Source code (all 11 files) | ESLint config | Each call site decides delete vs gate; lint enforces the rule globally |
| `any` removal | Source code + ambient `.d.ts` | ESLint config (.d.ts exclude) | Type system + ambient shim are different correctness layers |
| Unused-vars cleanup | Source code (7 files) | — | Pure deletion at each call site; lint enforces |
| Convention docs | `.planning/codebase/CONVENTIONS.md` | `CLAUDE.md` (pointer) | Single source of truth; CLAUDE.md links to it |
| ESLint override removal | `eslint.config.mjs` | — | One file edit, acceptance gate for the milestone |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Canonical do/don't list lives in `.planning/codebase/CONVENTIONS.md`; `CLAUDE.md` links to it.**

**D-02 — Inside CONVENTIONS.md, the new `## Directory Compliance` section is grouped by rule cluster — not by individual DIR-NN finding.** Four sub-sections: DOM API / Lifecycle & Compatibility / Type Hygiene / Release & Docs. Each cluster gets a 1-sentence intro stating which scorecard findings it closes.

**D-03 — Each rule renders as a four-line block: `Don't:` / `Do:` / `Why:` / `Docs:`.** Format locked verbatim by user. No full before/after code blocks per rule.

**D-04 — In CLAUDE.md, replace the existing `## TODO: Code Quality Issues to Address` block with a `## Directory Compliance` section.** Preserve `### Memory Reminders` and Beta Release Strategy.

**D-05 — Five-or-six atomic commits, mechanical first, override-delete then DOC-02 last:**
1. `refactor: remove unused vars and imports (DIR-10)`
2. `refactor(types): tighten TypeScript hygiene (DIR-09)`
3. `refactor(logs): remove or gate console.* per DIR-01`
4. `chore(lint): remove Phase 8 ESLint overrides (DIR-01/09/10 acceptance)`
5. `docs(08): add Directory Compliance conventions (DOC-02)` — **closing commit**
6. *(optional)* `docs(08): record Phase 8 human UAT`

**D-10 — Delete `eslint.config.mjs:66–109`** as the acceptance commit. Both sub-blocks (rule overrides + closed-set files block).

### Claude's Discretion (defaults established)

**D-06 — No formal HUMAN-UAT.md file required for Phase 8** (code-internal hygiene, no user-facing behavior change). Minimum verification: lint clean → build clean → 60-second Obsidian smoke test recorded in closing commit body.

**D-07 — Default: pure deletion at every `console.*` site.** Exception = compile-time `const DEBUG = false` gate for genuinely-useful forensics sites (cache/fetch debugging). Per-file unless 3+ files end up gated.

**D-08 — Per-category `any` treatment:**
- `src/types/ical.d.ts` (6 sites) → add `**/*.d.ts` exclusion in `eslint.config.mjs` for `no-explicit-any`
- `(window as any).moment` (5 sites) → per-line `eslint-disable-next-line` + rationale comment. **NOTE: research surfaced a typed import alternative — see `## Conflicts with CONTEXT.md`.**
- `(dtstart as any).jCal` (2 sites) → narrow to `{ jCal: unknown[] }` typed assertion
- `isValidCache(cache: any)` (1 site) → `cache: unknown`
- Cosmetic `value: any` + `event: any` (2 sites) → real types

**D-09 — Pure deletion of every flagged unused import/variable.** No `_-prefix`. Catch-binding sites use `catch { … }` (no binding) where unused, otherwise `catch (error)` + `errorMessage(error)`.

### Deferred Ideas (OUT OF SCOPE)

- **FRAG-01:** `window.moment` utility wrapper (deferred to v2)
- **FRAG-02:** Full `jCal[2]` → `VALUE=DATE` migration (deferred to v2)
- Hand-typing `ical.js` API (closed via lint exclude)
- Runtime debug-log toggle setting (compile-time const is sufficient)
- Mobile UAT (deferred to v1.16)
- Refactoring 15 console sites into a structured logger (D-07 = delete-or-gate at existing sites)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIR-01 | Zero `console.*` calls in shipped code (39 sites across 11 files; gated behind dev-only flag where genuinely useful) | `## DIR-01 Console Audit` section classifies all 39 sites delete-vs-gate; `## Conventions Snippet for Cluster: Type Hygiene` provides the rule block |
| DIR-09 | Zero `no-explicit-any` in source (ambient `.d.ts` excepted), zero `no-case-declarations`, zero `no-useless-escape`, zero `??` with constant LHS | `## DIR-09 Any Sites` enumerates all 16 sites with replacement strategies; `## ?? Audit` confirms zero constant-LHS hits; `## DIR-09 Other Lint Errors` enumerates the 2 non-`any` sites |
| DIR-10 | Zero `no-unused-vars` violations (18 live sites; scorecard listed 21) | `## DIR-10 Unused Vars Inventory` enumerates all 18 sites with delete/keep recommendations; `## Catch-Binding Recommendations` covers the 2 `error` sites per D-09 |
| DOC-02 | `## Directory Compliance` section in `.planning/codebase/CONVENTIONS.md` + pointer in `CLAUDE.md` | `## DOC-02 Section Templates` provides the verbatim CONVENTIONS.md skeleton + the CLAUDE.md replacement section; all docs URLs HTTP-200-verified |

## Project Constraints (from CLAUDE.md)

The following directives in `./CLAUDE.md` are non-negotiable and constrain the planner's choices:

- **No remote code execution; no user data sent to external services without permission.** No change in this phase, but the `DEBUG` constant pattern in D-07 must be compile-time (no runtime toggle that could leak data).
- **Mobile compatibility (`isDesktopOnly: false`).** No change in this phase — runtime-only behavior changes are confined to log silencing, no platform-specific code paths.
- **Commit messages and release notes must NOT reference Claude or AI assistance.** All five commit subjects in D-05 already comply; planner enforces in commit bodies.
- **The `## TODO: Code Quality Issues to Address` block in `CLAUDE.md` is the update target for DOC-02 (per D-04).** Most TODO items shipped in Phases 1–7; replace with `## Directory Compliance` pointer.

## Standard Stack

No new dependencies introduced in this phase. Existing stack verified live:

| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| `eslint` | ^9.39.4 | Lint gate | [VERIFIED: package.json:26] |
| `typescript-eslint` | ^8.59.3 | TypeScript rules | [VERIFIED: package.json:32] |
| `eslint-plugin-obsidianmd` | ^0.3.0 | Obsidian-specific rules | [VERIFIED: package.json:27] |
| `typescript` | ^5.9.3 | Type checking | [VERIFIED: package.json:31] |
| `obsidian` | latest | Plugin API (also exports typed `moment`) | [VERIFIED: package.json:29; node_modules/obsidian/obsidian.d.ts:4415] |

**No package installs required.** Phase 8 is pure source-tree changes + ESLint config delete.

## Package Legitimacy Audit

This phase installs zero new packages. The `## Package Legitimacy Audit` step is **not applicable**.

## Architecture Patterns

### Per-line `eslint-disable-next-line` with rationale comment (the "intentional escape hatch" pattern)

**What:** When an `any` cast or rule violation is unavoidable AND documented, use a per-line `eslint-disable-next-line` comment with a one-line rationale. Avoid global rule overrides for intentional violations.

**When to use:**
- Documented intentional patterns where the alternative is worse (e.g., accessing untyped library internals where no typed alternative exists)
- Single-site exceptions, not category-wide

**Anti-example (global override):**
```js
// In eslint.config.mjs — DON'T
{ files: ["src/**/*.ts"], rules: { "@typescript-eslint/no-explicit-any": "off" } }
```

**Correct example (per-line):**
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing untyped jCal internal; FRAG-02 deferred
const jcal = (dtstart as { jCal: unknown[] }).jCal;
```

**Source:** Phase 6 D-13 (Phase 5 `obsidianmd/ui/sentence-case` proper-noun exemptions) [CITED: `.planning/phases/06-dom-api-refactor/06-CONTEXT.md`]. Already in active use across the codebase — grep `eslint-disable-next-line` shows ≥4 surviving uses for `obsidianmd/ui/sentence-case` proper nouns.

### Compile-time `DEBUG` constant gate (D-07 exception)

**What:** A module-level `const DEBUG = false` flag that wraps any preserved forensic logs. Tree-shakes to nothing when `DEBUG=false`.

**Per-file (default — fewer than 3 files):**
```ts
// At the top of src/services/CalendarService.ts
const DEBUG = false;

// At the log site:
if (DEBUG) console.log("MemoChron: cache hit", events.length);
```

**Shared (3+ files):**
```ts
// src/utils/debug.ts
export const DEBUG = false;

// At each call site:
import { DEBUG } from "../utils/debug";
if (DEBUG) console.log(...);
```

**Why compile-time, not runtime setting:** Tree-shakable; no UI/persistence/validation burden; future contributors flip locally without touching build [CITED: CONTEXT.md D-07].

### Catch-binding hygiene (DIR-10 D-09 pattern)

**Genuinely-unused error → no binding:**
```ts
try { … } catch { /* error unused */ }
```

**Used error → bind + consume via errorMessage():**
```ts
try { … } catch (error) {
  new Notice(`MemoChron: ${errorMessage(error)}`);
}
```

**Source:** `src/utils/errors.ts` `errorMessage(err: unknown): string` — established Phase 2 helper, already used at 18 catch sites [VERIFIED: read `src/utils/errors.ts` — exports `errorMessage(err: unknown): string` returning `err instanceof Error ? err.message : String(err)`].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Caught error → printable message | `error instanceof Error ? error.message : String(error)` inline | `errorMessage(error)` from `src/utils/errors.ts` | One-line helper; already used 18 times in this codebase |
| Type guard on unknown JSON | `function isFoo(x: any): x is Foo` | `function isFoo(x: unknown): x is Foo` | `unknown` is TypeScript-idiomatic; no information loss; passes `no-explicit-any` |
| Compile-time-only debug flag | Runtime setting + UI toggle | `const DEBUG = false` | No bundle cost when off; no UX burden |
| Obsidian's `moment` access | `(window as any).moment` | `import { moment } from "obsidian"` | Obsidian exports typed `moment` since old versions [VERIFIED: `node_modules/obsidian/obsidian.d.ts:4415`] |

## Common Pitfalls

### Pitfall 1: Replacing `(window as any).moment` blindly without checking call-site usage

**What goes wrong:** Some call sites use `moment(date).week()` or `moment(date).format(...)`; if you replace the cast with the typed import but call signatures changed across moment versions, TypeScript may flag the call sites.

**Why it happens:** The bundled `moment` in Obsidian is whatever version Obsidian ships; the typed `import { moment } from "obsidian"` typed against `typeof Moment` (default moment types).

**How to avoid:** After the import change, run `npm run build` (which includes `tsc -noEmit`) — TypeScript will catch any signature mismatch. The 5 call sites in scope use `.week()` and `(date)` constructor — both are stable across moment ^2.x.

**Warning signs:** `tsc -noEmit` errors at one of the 5 sites; `npm run build` fails.

### Pitfall 2: Deleting an "unused" import that is actually used in a type position

**What goes wrong:** `ESLint --rule '{"@typescript-eslint/no-unused-vars": ["error", {"args": "none"}]}'` does NOT flag type-only imports by default if the import is used in a type position. But if `isolatedModules` is on (it is here, `tsconfig.json`), deleting a type-only import that's used as `: MyType` in a function signature will break compilation.

**Why it happens:** ESLint sees the symbol as referenced; deleting it requires checking grep across the file first.

**How to avoid:** For each flagged unused import, run `grep -n "<symbolName>" <file>` before deletion; only delete if the count is 1 (the import line itself).

**Warning signs:** `npm run build` fails with "Cannot find name 'X'" after a Phase 8 commit.

**Note:** The 18 sites in this phase's DIR-10 inventory were verified by `npx eslint --rule '...no-unused-vars': "error"'` — all 18 reach the unused-binding state, not the unused-type-import state. Safe to delete.

### Pitfall 3: Replacing `cache: any` with `cache: unknown` and breaking the type-guard body

**What goes wrong:** `function isValidCache(cache: any): cache is CacheData` works because `any` allows `cache.timestamp` access without error. Changing the parameter to `unknown` makes the type guard body fail to typecheck unless the property accesses are guarded.

**Why it happens:** `unknown` is the strict counterpart to `any` — you can't access properties without narrowing first.

**How to avoid:** Look at the current body of `isValidCache` (`src/services/CalendarService.ts:317-321`):
```ts
private isValidCache(cache: any): cache is CacheData {
  return (
    cache && cache.timestamp && cache.events && Array.isArray(cache.events)
  );
}
```
The body uses `cache && cache.X` patterns. With `cache: unknown`, you need to narrow each access. Either:
- Use type assertions inside: `(cache as CacheData).timestamp` (but defeats the purpose)
- Use a typed predicate: cast to `Record<string, unknown>` first, then check each field

**Recommended replacement:**
```ts
private isValidCache(cache: unknown): cache is CacheData {
  if (!cache || typeof cache !== "object") return false;
  const c = cache as Record<string, unknown>;
  return (
    typeof c.timestamp === "number" &&
    Array.isArray(c.events)
  );
}
```
This is a stricter, safer guard than the current implementation [VERIFIED: read `src/services/CalendarService.ts:310-321`].

**Warning signs:** `npm run build` fails after Commit 2.

### Pitfall 4: Adding `**/*.d.ts` exclusion to `eslint.config.mjs` in the wrong commit

**What goes wrong:** D-10 says delete the override block (commit 4); D-08 says add a `**/*.d.ts` exclusion. If both end up in the same commit, the diff becomes hard to review.

**How to avoid:** The `**/*.d.ts` exclusion lands in **commit 2** (`refactor(types): tighten TypeScript hygiene`) as part of DIR-09. Commit 4 ONLY deletes the Phase-8 override block. CONTEXT.md D-08 + D-10 confirm this ordering.

## Runtime State Inventory

> Phase 8 is internal type/lint hygiene only — no rename, no migration, no external service config.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — phase touches no databases, no Obsidian vault data, no cache schema | None |
| Live service config | None — no external services involved | None |
| OS-registered state | None — no Task Scheduler, launchd, systemd entries | None |
| Secrets/env vars | None — phase touches no env vars, no SOPS keys | None |
| Build artifacts | Possibly stale `main.js` (if dev mode left running); resolved by `npm run build` post-phase | Run `npm run build` once after Commit 5 |

**Net:** No runtime state migration is required. The phase is purely compile-time.

## Common Pitfalls (Continued)

### Pitfall 5: Deleting `convertTimezone` import from CalendarService.ts:12 might break callers

**What goes wrong:** `convertTimezone` is one of the 18 flagged unused symbols (`src/services/CalendarService.ts:12`). Deleting the import is safe ONLY if there are no internal `convertTimezone(...)` call sites in the file.

**Verification:**
```bash
grep -n "convertTimezone" src/services/CalendarService.ts
```
Result: `12:import { convertIcalTimeToDate, convertTimezone } from "../utils/timezoneUtils";` — single hit, the import line. Safe to delete [VERIFIED: grep run].

The same verification applies to every DIR-10 site. See `## DIR-10 Unused Vars Inventory` for per-site grep counts.

## Code Examples

### Example 1: Replacing `(dtstart as any).jCal[2]` with a typed assertion

**Current (`src/services/CalendarService.ts:940`, `src/services/IcsImportService.ts:101`):**
```ts
const jcal = (dtstart as any).jCal;
if (jcal && jcal[2] === "date") return true;
```

**Replacement (D-08 typed assertion):**
```ts
// jCal is ical.js's internal representation; FRAG-02 will replace this
// with the official VALUE=DATE parameter check.
const jcal = (dtstart as unknown as { jCal: unknown[] }).jCal;
if (jcal && jcal[2] === "date") return true;
```

**Why `unknown as`:** Going `Property → { jCal: unknown[] }` directly is a structural-type error because `Property` doesn't declare `jCal`. The double cast through `unknown` is the standard TypeScript pattern when both sides claim incompatible shapes [CITED: TypeScript handbook "Type Assertions"].

**Alternative (if double-cast offends):** Extend `Property` in `src/types/ical.d.ts`:
```ts
export class Property {
  getFirstValue(): unknown;
  getParameter(name: string): string;
  getValues(): unknown[];
  jCal: unknown[];  // internal, exposed for VALUE=DATE detection
}
```
Then `(dtstart as Property).jCal` works without any cast. **Recommended** because it codifies the access; cost is one new field declaration. Planner picks; either resolves DIR-09 at the site.

### Example 2: Replacing `forEach((value: any) => ...)` with a typed iteration

**Current (`src/services/CalendarService.ts:771`):**
```ts
const values = exdateProp.getValues();
values.forEach((value: any) => {
  if (value?.toJSDate) {
    excludedDates.push(value.toJSDate());
  }
});
```

The `getValues()` return type is `any[]` in `ical.d.ts:14`. Once we lint-exclude `.d.ts`, the parameter type can be `unknown`:

**Replacement:**
```ts
const values = exdateProp.getValues();
values.forEach((value: unknown) => {
  // ical.js's getValues() can return Time or other types; narrow defensively
  if (typeof value === "object" && value !== null && "toJSDate" in value) {
    excludedDates.push((value as { toJSDate(): Date }).toJSDate());
  }
});
```

**Alternative (cleaner — tighten `getValues()` in the ambient shim):**
```ts
// In src/types/ical.d.ts:
export class Property {
  getValues(): Array<Time | Duration | string>;  // ical.js can return any of these
}
```
Then the forEach param can be `Time | Duration | string` — strictly typed.

**Recommended:** Tighten the shim. The `.d.ts` exclude covers the `getValues()` body if it's still `any`, but tightening to `Time | Duration | string` is information-preserving and matches what `ical.js` actually returns.

### Example 3: Migrating the `generatePreviewPath(event: any)` parameter to a real type

**Current (`src/settings/SettingsTab.ts:1161-1182`):**
```ts
const sampleEvent = {
  title: "Sample Meeting",
  start: sampleDate,
  end: sampleDate,
  source: "Work Calendar",
};
// …
const previewPath = this.generatePreviewPath(template, sampleEvent);
// …
private generatePreviewPath(template: string, event: any): string {
  // … uses event.start, event.title, event.source
}
```

**Problem:** Replacing `event: any` with `event: CalendarEvent` will fail to compile because `sampleEvent` is missing required fields (`id`, `isAllDay`, `sourceId` — see `CalendarEvent` interface at `src/services/CalendarService.ts:15-27`).

**Two options:**

**Option A (recommended — narrow the parameter type via Pick<>):**
```ts
private generatePreviewPath(
  template: string,
  event: Pick<CalendarEvent, "title" | "start" | "end" | "source">
): string {
  // …
}
```
`sampleEvent` already matches this shape. No change to the sample literal [VERIFIED: read function body at lines 1182-1280; only accesses `event.start`, `event.title`, `event.source`].

**Option B (fill out the sample to a complete CalendarEvent):**
```ts
const sampleEvent: CalendarEvent = {
  id: "preview-sample",
  title: "Sample Meeting",
  start: sampleDate,
  end: sampleDate,
  isAllDay: false,
  source: "Work Calendar",
  sourceId: "preview-sample-source",
};
```
Less surgical; more code change.

**Recommendation:** Option A. The `Pick<>` makes the contract explicit (this function only needs these four fields). [VERIFIED: read the function body — only those 4 fields are accessed; no other usage of `event` in the function].

### Example 4: Replacing `(window as any).moment` with the typed obsidian import

**(See `## Conflicts with CONTEXT.md` below for context. This example documents the conflict resolution Option B.)**

**Current pattern (5 sites):**
```ts
const moment = (window as any).moment;
if (!moment) return;
const momentDate = moment(date);
```

**Replacement (typed import):**
```ts
import { moment } from "obsidian";
// …
const momentDate = moment(date);
// `if (!moment)` check becomes unnecessary — moment is statically guaranteed
```

**Per-site impact:**
- `CalendarView.ts:163`: in `checkDailyNoteForDate`, removes the `if (!moment) return false` branch
- `CalendarView.ts:558`: in `renderWeekNumber`, removes the `if (moment)` branch — `weekNum = String(moment(date).week())` always succeeds
- `CalendarView.ts:808`: in `handleDailyNoteClick`, removes the `if (!moment)` notice path
- `EmbeddedCalendarView.ts:224`: same as 808
- `EmbeddedAgendaView.ts:379`: same as 808

**Why safe:** `import { moment } from "obsidian"` is a static import; if the host Obsidian build is broken, the plugin won't load at all (so the runtime null-check is dead defense). The bundle stays the same size because `obsidian` is already external in `esbuild.config.mjs`.

## DIR-01 Console Audit (39 sites — delete vs. gate classification)

Each site was reviewed by reading the surrounding ±10 lines. Classifications use D-07's two buckets:
- **DELETE** — silent, lifecycle-only, paired with `Notice`, or noisy without forensic value
- **GATE** — genuinely useful for cache/fetch forensics; wrap in `if (DEBUG) console.log(...)`

| File | Line | Call | Classification | Rationale |
|------|------|------|----------------|-----------|
| main.ts | 112 | `console.warn` (invalid color in loadSettings) | DELETE | Validation already replaces; warn doesn't help end user |
| main.ts | 123 | `console.warn` (invalid dailyNoteColor) | DELETE | Same |
| CalendarService.ts | 60 | `console.warn` (no enabled sources) | DELETE | Caller's `Notice` covers it |
| CalendarService.ts | 256 | `console.error` (fetch error) | DELETE | Paired with `Notice` at 257 |
| CalendarService.ts | 267 | `console.log` (background refresh started) | DELETE | Pure lifecycle noise |
| CalendarService.ts | 302 | `console.log` (cache miss) | **GATE** | Useful for diagnosing cache freshness on user reports |
| CalendarService.ts | 344 | `console.log` (cache saved) | DELETE | Lifecycle noise |
| CalendarService.ts | 346 | `console.error` (cache save failed) | DELETE | Silent failure is acceptable; next save retries |
| CalendarService.ts | 381 | `console.error` (403 access denied) | DELETE | Paired with `Notice` at 382 |
| CalendarService.ts | 384 | `console.error` (404 not found) | DELETE | Paired with `Notice` at 385 |
| CalendarService.ts | 387 | `console.error` (other HTTP error) | **GATE** | No `Notice` at this branch — keep gated so support can ask the user to enable DEBUG |
| CalendarService.ts | 398 | `console.error` (invalid calendar data) | DELETE | Paired with `Notice` at 399 |
| CalendarService.ts | 406 | `console.error` (fetch caught) | **GATE** | Caller's CORS/network `Notice` is generic; forensic console adds detail |
| CalendarService.ts | 457 | `console.error` (Outlook HTML response) | **GATE** | Outlook quirk debugging — useful when users report Outlook-specific issues |
| CalendarService.ts | 545 | `console.error` (local file read error) | DELETE | Returns 500 status; caller surfaces via `Notice` |
| CalendarService.ts | 923 | `console.debug` (platform info) | DELETE | One-shot diagnostic — could also be moved to GATE with the platform-info function, planner's call |
| NoteService.ts | 81 | `console.error` (create note error) | DELETE | Re-throws; caller handles |
| NoteService.ts | 133 | `console.error` (build file path error) | DELETE | Falls back silently; warn doesn't help |
| NoteService.ts | 172 | `console.error` (generate content error) | DELETE | Falls back silently |
| NoteService.ts | 316 | `console.error` (apply template error) | DELETE | Returns original template; recovers silently |
| NoteService.ts | 338 | `console.error` (format title error) | DELETE | Falls back to `event.title` |
| NoteService.ts | 596 | `console.warn` (calendar source not found) | DELETE | Defensive guard; returns default |
| IcsImportService.ts | 38 | `console.debug` (timezone already registered) | DELETE | Already silent intent |
| IcsImportService.ts | 40 | `console.warn` (timezone error) | DELETE | Recovers; warn doesn't help end user |
| SettingsTab.ts | 1537 | `console.error` (custom settings missing) | DELETE | Returns early; UI shows it |
| SettingsTab.ts | 1767 | `console.log` (refreshing custom settings) | DELETE | Lifecycle noise |
| timezoneUtils.ts | 179 | `console.warn` (toJSDate failed) | DELETE | Falls back; warn doesn't help |
| timezoneUtils.ts | 200 | `console.warn` (toJSDate failed for custom TZID) | DELETE | Falls back |
| timezoneUtils.ts | 215 | `console.warn` (invalid timezone) | **GATE** | TZ debugging — when users report wrong times, this is the first thing to enable |
| timezoneUtils.ts | 224 | `console.error` (full TZ conversion failure) | **GATE** | Catastrophic TZ failure — extremely useful for support |
| timezoneUtils.ts | 266 | `console.warn` (invalid TZ in convertTimezone) | DELETE | Falls back; less useful than 215 |
| CalendarView.ts | 153 | `console.error` (load daily notes failed) | DELETE | Silent recovery; doesn't surface |
| CalendarView.ts | 174 | `console.error` (check daily note failed) | DELETE | Returns false; UI shows no indicator |
| CalendarView.ts | 347 | `console.error` (background refresh failed) | DELETE | Paired with `.catch` Notice at 346 — already user-visible elsewhere |
| CalendarView.ts | 833 | `console.error` (open daily note failed) | DELETE | Paired with `Notice` at 834 |
| CalendarView.ts | 927 | `console.error` (create note failed) | DELETE | Paired with `Notice` at 928 |
| CalendarView.ts | 1059 | `console.error` (ICS import failed) | DELETE | Paired with `Notice` at 1060 |
| EmbeddedAgendaView.ts | 398 | `console.error` (open daily note failed) | DELETE | Paired with `Notice` at 399 |
| EmbeddedCalendarView.ts | 249 | `console.error` (open daily note failed) | DELETE | Paired with `Notice` at 250 |

**Summary:**
- **DELETE: 33 sites** (default path)
- **GATE: 6 sites** across 2 files (`CalendarService.ts` × 4, `timezoneUtils.ts` × 2)

**Per D-07 default (per-file unless 3+ files end up gated):** 2 files → per-file `const DEBUG = false` at the top of `CalendarService.ts` and `timezoneUtils.ts`. No shared `src/utils/debug.ts` needed.

**Planner override option:** If the planner judges any of the 6 GATE sites isn't worth preserving, downgrade to DELETE. The classifications above are recommendations, not locks. The single hard rule from D-07: where a `console.*` is paired with a user-visible `Notice`, the `console.*` is redundant — DELETE without exception.

## DIR-09 Any Sites (16 sites — replacement strategies)

Per D-08 categories. Verified via `npx eslint src/ --rule '{"@typescript-eslint/no-explicit-any":"error"}'`.

### Ambient `.d.ts` (6 sites — closed via lint exclude)

| Site | Current shape | Strategy |
|------|---------------|----------|
| ical.d.ts:3 | `constructor(jCal: any)` | Lint-exclude via `**/*.d.ts` rule disable |
| ical.d.ts:8 | `getFirstPropertyValue(name: string): any` | Lint-exclude |
| ical.d.ts:12 | `getFirstValue(): any` | Lint-exclude |
| ical.d.ts:14 | `getValues(): any[]` | Lint-exclude OR tighten to `Array<Time \| Duration \| string>` (see Example 2 above) |
| ical.d.ts:58 | `static fromData(data: any): Timezone` | Lint-exclude |
| ical.d.ts:71 | `export function parse(input: string): any` | Lint-exclude |

**Required `eslint.config.mjs` addition (commit 2):**
```js
{
  files: ["**/*.d.ts"],
  rules: { "@typescript-eslint/no-explicit-any": "off" },
},
```

Verified: this is the standard flat-config shape. Drop the object anywhere in the `tseslint.config(...)` array AFTER the `obsidianmd.configs.recommended` spread but BEFORE the closing parenthesis. The natural placement is after the Phase-5 tightening block (around line 63).

### `(window as any).moment` (5 sites — see Conflicts section for typed-import alternative)

| Site | File | Disposition (CONTEXT default) |
|------|------|-------------------------------|
| 163 | CalendarView.ts | Per-line `eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing global moment provided by Obsidian; FRAG-01 deferred` |
| 558 | CalendarView.ts | Same |
| 808 | CalendarView.ts | Same |
| 224 | EmbeddedCalendarView.ts | Same |
| 379 | EmbeddedAgendaView.ts | Same |

**Alternative — typed import (research-discovered, see Conflicts):** delete all 5 cast lines and add `import { moment } from "obsidian"` to each file. Zero `eslint-disable` comments needed.

### `(dtstart as any).jCal` (2 sites)

| Site | File | Replacement |
|------|------|-------------|
| 940 | CalendarService.ts | `(dtstart as unknown as { jCal: unknown[] }).jCal` OR add `jCal: unknown[]` to `Property` in `ical.d.ts` |
| 101 | IcsImportService.ts | Same |

**Recommendation:** Add `jCal: unknown[]` to the `Property` class in `ical.d.ts`. One declaration site, two clean access sites. The `.d.ts` exclude covers any remaining `any` in the rest of the shim.

### Type guard (`isValidCache`)

| Site | File | Replacement |
|------|------|-------------|
| 317 | CalendarService.ts | `cache: unknown` + narrow body — see Pitfall 3 |

### Cosmetic (2 sites)

| Site | File | Replacement |
|------|------|-------------|
| 771 | CalendarService.ts | `forEach((value: unknown) => ...)` with `in`/`typeof` narrowing — see Example 2 |
| 1182 | SettingsTab.ts | `event: Pick<CalendarEvent, "title" \| "start" \| "end" \| "source">` — see Example 3 |

## DIR-09 Other Lint Errors (2 sites)

### `no-case-declarations` — `src/utils/pathUtils.ts:50`

```ts
case PathType.FILE_URL:
  // …
  let normalized = decodeURIComponent(path.replace(/^file:\/\/\/?/, ""));
  // …
```

**Fix:** Wrap the case body in a block scope:
```ts
case PathType.FILE_URL: {
  // …
  let normalized = decodeURIComponent(path.replace(/^file:\/\/\/?/, ""));
  // …
  return normalized;
}
```

**One-line change** (add `{` after the case, `}` before the next case). [VERIFIED: read `pathUtils.ts:45-70`].

### `no-useless-escape` — `src/utils/viewRenderers.ts:371`

```ts
const numericMatch = input.match(/^(\d{4})[-\/](\d{1,2})$/);
```

The `\/` inside the character class `[-\/]` is unnecessary — `/` doesn't need escaping inside `[…]`.

**Fix:**
```ts
const numericMatch = input.match(/^(\d{4})[-/](\d{1,2})$/);
```

**One-character change** (remove the `\`). [VERIFIED: read `viewRenderers.ts:370-376`].

## ?? Audit (zero hits)

```bash
$ grep -rnE '\b(null|undefined|""|0|false)\s*\?\?' src/
src/settings/SettingsTab.ts:263:    // actually toggles — otherwise `!(undefined ?? false) === true`
```

**Only hit is a documentation comment, not executable code.** No real `??`-with-constant-LHS violations exist [VERIFIED: ran grep at research time]. CONTEXT.md says the closing commit body should note this — confirmed: nothing to do.

## DIR-10 Unused Vars Inventory (18 live sites)

All 18 sites verified via `npx eslint src/ --rule '{"@typescript-eslint/no-unused-vars":["error",{"args":"none"}]}'`. Scorecard listed 21; the 3-name delta is reconciled below.

| Site | File | Symbol | Disposition |
|------|------|--------|-------------|
| 12 | services/CalendarService.ts | `convertTimezone` (import) | DELETE import; verified single hit in file |
| 531 | services/CalendarService.ts | `error` (catch binding) | Replace with `catch { … }` — body doesn't use error [VERIFIED: lines 527-537; body returns a fixed `{ status: 404, text }` object] |
| 5 | services/IcsImportService.ts | `Property` (import) | DELETE import; not referenced in file [VERIFIED: grep on file = 1 hit, line 5] |
| 6 | settings/SettingsTab.ts | `TextAreaComponent` (import) | DELETE import; verify grep |
| 7 | settings/SettingsTab.ts | `DropdownComponent` (import) | DELETE import; verify grep |
| 16 | settings/SettingsTab.ts | `CalendarNotesSettings` (import) | DELETE import; verify grep |
| 1174 | settings/SettingsTab.ts | `error` (catch binding) | Replace with `catch { … }` — body just renders "Invalid template format" without using error [VERIFIED: lines 1174-1179] |
| 4 | settings/types.ts | `DEFAULT_CALENDAR_URLS` (import) | DELETE import; verify grep |
| 2 | utils/viewRenderers.ts | `MemoChronSettings` (import) | DELETE import; verify grep |
| 3 | utils/viewRenderers.ts | `TFile` (import) | DELETE import; verify grep |
| 3 | utils/viewRenderers.ts | `Notice` (import) | DELETE import; verify grep |
| 3 | utils/viewRenderers.ts | `App` (import) | DELETE import; verify grep |
| 1 | views/CalendarView.ts | `DropdownComponent` (import) | DELETE import; verify grep |
| 14 | views/CalendarView.ts | `DateElements` (interface) | DELETE the interface block at lines 14-16 entirely |
| 200 | views/CalendarView.ts | `controls` (local variable) | Replace `const controls = this.createControls(container);` with bare call `this.createControls(container);` — verify return value isn't used downstream |
| 1101 | views/CalendarView.ts | `title` (local variable) | Replace `const title = this.calendar.querySelector('.memochron-title');` with bare call OR delete entirely (surrounding code shows it's dead — see comment block at lines 1095-1110 confirms it's exploratory) [VERIFIED: read context] |
| 15 | views/EmbeddedCalendarView.ts | `CalendarEvent` (import) | DELETE import; verify grep |
| 109 | views/EmbeddedCalendarView.ts | `title` (local variable) | Replace `const title = header.createEl(...)` with bare call — `title` not read downstream [VERIFIED: read lines 100-130] |

**Reconciliation with scorecard's 21 names:**

The scorecard listed: `App`, `CalendarEvent`, `CalendarNotesSettings`, `controls`, `convertTimezone`, `date`, `DateElements`, `DEFAULT_CALENDAR_URLS`, `DropdownComponent`, `e`, `error`, `isNewNote`, `MemoChronSettings`, `Notice`, `plugin`, `Property`, `renderAgendaList`, `target`, `TextAreaComponent`, `TFile`, `title` (21 names).

Of these, the following are NOT in the live ESLint output — they were cleaned up during Phases 5–7:
- `date` — not flagged (likely consumed during Phase 6 DOM refactor)
- `e` — not flagged (likely consumed during Phase 7 event-handler cleanup)
- `isNewNote` — not flagged (likely consumed during Phase 4 UX work, before v1.15)
- `plugin` — not flagged
- `renderAgendaList` — not flagged
- `target` — not flagged

**6 names cleaned up across Phases 4–7.** The remaining 15 unique symbol names from the scorecard list match the 18 live sites (some names appear at multiple sites, e.g., `error` appears at both CalendarService.ts:531 and SettingsTab.ts:1174; `title` appears at CalendarView.ts:1101 and EmbeddedCalendarView.ts:109; `DropdownComponent` appears at SettingsTab.ts:7 and CalendarView.ts:1).

CONTEXT.md noted "18 vs 21" — confirmed [VERIFIED: ESLint output count].

## Catch-Binding Recommendations

Per D-09, for the 2 unused `error` catch bindings:

### `src/services/CalendarService.ts:531`

```ts
} catch (error) {
  return {
    status: 404,
    text: `Cannot read file: ${pathInfo.normalizedPath}`,
  };
}
```

**Recommendation: `catch { ... }`** — error is genuinely unused; the catch body returns a fixed shape. [VERIFIED: lines 527-537].

### `src/settings/SettingsTab.ts:1174`

```ts
} catch (error) {
  container.createEl("small", {
    text: "Invalid template format",
    cls: "memochron-preview-error",
  });
}
```

**Recommendation: `catch { ... }`** — error is unused; UI renders generic "Invalid template format" message. [VERIFIED: lines 1174-1179].

**Alternative:** If a future maintainer wants the error visible during debugging, the `errorMessage(error)` helper is already imported in this file — could swap to `text: \`Invalid template format: ${errorMessage(error)}\`` but that's a UX change, not a hygiene change. Default to `catch { ... }`.

## eslint.config.mjs Line Range Verification

CONTEXT.md states "delete lines 66–109" as the Phase-8 acceptance commit (D-10). Verified against the current file:

| Range | Content |
|-------|---------|
| Lines 65-68 | Comment header `// --- Phase 8 — DIR-01 / DIR-09 / DIR-10 …` |
| Lines 69-88 | First override block: `files: ["src/**/*.ts"]` with rule disables for `obsidianmd/rule-custom-message`, `no-console`, `no-explicit-any`, `no-unsafe-*` (5 rules), `no-case-declarations`, `no-useless-escape` |
| Lines 89-91 | Second comment header `// Phase 8 — DIR-01 will remove these …` |
| Lines 92-105 | Second override block: closed-set `files: [7 file paths]` disabling `no-unused-vars` |
| Lines 106 | Blank line |
| Lines 107-114 | `globalIgnores([...])` — **NOT Phase 8; do not delete** |

**Corrected range: lines 65–105** (CONTEXT.md said 66–109, off by 1 at start and 4 at end). The delete should encompass the comment-headers + both rule blocks but stop before the blank line at 106. After deletion, line 107's `globalIgnores` follows directly after the line-63 `}` closing brace of the Phase-5 tightening block.

**Planner action:** Use line 65–105 in the delete-diff, not 66–109. Verify by inspection at commit-4 time.

**No `argsIgnorePattern` or `varsIgnorePattern: "^_"` present** in the current config [VERIFIED: `grep -nE 'argsIgnorePattern|varsIgnorePattern' eslint.config.mjs` returned no hits]. The D-09 "no `_-prefix`" decision doesn't require additional config changes.

## Conflicts with CONTEXT.md

**One conflict surfaced during research; planner must resolve before plan-phase locks plans.**

### Conflict 1: D-08 `(window as any).moment` strategy

**CONTEXT.md D-08 says:**
> `(window as any).moment` (5 sites) — keep as documented intentional pattern per CONVENTIONS.md §TypeScript Usage. Use a per-line `eslint-disable-next-line @typescript-eslint/no-explicit-any` with a one-line rationale comment — NOT a global rule override. The FRAG-01 utility wrapper is deferred to a future milestone.

**What research found:**

Reading `node_modules/obsidian/obsidian.d.ts` shows:
```ts
import * as Moment from 'moment';        // line 8
// …
/** @public */
export const moment: typeof Moment;       // line 4415
```

**Obsidian exports a typed, public `moment` directly.** [VERIFIED: read `node_modules/obsidian/obsidian.d.ts:4414-4415`]

**Implication:**

The cleanest fix is to delete all 5 `(window as any).moment` cast lines AND their accompanying `if (!moment)` null-check guards, and add a single `import { moment } from "obsidian"` line to each of the 3 affected files. This:

1. Eliminates 5 `any` casts → no `eslint-disable-next-line` comments needed
2. Eliminates 5 dead `if (!moment) return` branches (the typed import is statically guaranteed)
3. Bundle size unchanged — `obsidian` is already external in `esbuild.config.mjs`
4. Source code becomes shorter

**Why this matters now:**

This is the Phase 7 A1/A2 pattern repeating. CONTEXT.md decisions made before research surfaced an option are subject to revision when research finds a better one. The planner should resolve the conflict explicitly rather than silently locking either choice.

**Planner options:**

- **Option A (default per CONTEXT D-08):** keep `(window as any).moment` with 5 `eslint-disable-next-line` comments. Pro: matches existing CONVENTIONS.md §TypeScript Usage documentation; minimal source churn. Con: 5 magic-comment lines persist; the FRAG-01 utility wrapper that's "deferred" is actually achievable today.
- **Option B (research-recommended):** replace all 5 casts with `import { moment } from "obsidian"`. Pro: eliminates the `any` cluster outright; FRAG-01 closes incidentally. Con: 5 production code-line changes (small); CONVENTIONS.md §TypeScript Usage description of "window.moment" pattern becomes stale and needs a one-line update.

**Recommendation:** **Option B.** It is strictly cleaner, the bundle impact is zero, and Phase 7's A2 precedent says "verify rule source-of-truth before locking a decision; if research finds a contradicting truth, surface and resolve." The cost is 5 line edits and a 1-line update to CONVENTIONS.md §TypeScript Usage to reflect the new pattern.

**Either resolution is defensible.** The planner makes the call; researcher flags both.

## DOC-02 Section Templates

### CONVENTIONS.md skeleton (verbatim, ready to paste)

```markdown
## Directory Compliance

Every rule below maps to a finding from the Obsidian community-plugin directory scorecard
report on v1.13.1. Closing all of them was the goal of milestone v1.15. Rules are grouped
by cluster, not by individual DIR-NN finding. ESLint enforces each rule via
`eslint.config.mjs`; intentional, single-site exceptions use a per-line
`eslint-disable-next-line <rule> -- <reason>` comment.

### DOM API

Closes scorecard findings **DIR-02** (`innerHTML`/`outerHTML`), **DIR-03** (inline
`element.style.*`), **DIR-04** (`document.createElement` and string-literal HTML).

**Don't:** Use `element.innerHTML = "<div>...</div>"` or `element.outerHTML`.
**Do:** Use `createDiv({ cls, text })` or `createEl("div", { cls, text, attr })`; for
        nested children, chain `parent.createEl(...)` returns; for inline rich-text use
        `appendText("...")` plus `createEl("strong", { text: "..." })`.
**Why:** Bypasses Obsidian's sanitization and breaks the obsidianmd/no-inner-html
         rule + `@microsoft/sdl/no-inner-html`.
**Docs:** https://docs.obsidian.md/Plugins/User+interface/HTML+elements

**Don't:** Write `element.style.border = "1px solid red"` or any other static `.style.*`
          assignment.
**Do:** Add a CSS class to `styles.css` and toggle it via `el.toggleClass("memochron-...",
        condition)`. For dynamic values, use `el.setCssProps({ color: event.color })`.
**Why:** Bypasses Obsidian theming and breaks the
         `obsidianmd/no-static-styles-assignment` rule.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/no-static-styles-assignment.md

**Don't:** Call `document.createElement("input")` or `new HTMLInputElement()`.
**Do:** Call `parent.createEl("input", { type: "color" })` or
        `parent.createDiv({ cls })`. SVG construction stays on
        `createElementNS("http://www.w3.org/2000/svg", ...)`.
**Why:** Bypasses Obsidian's element extension (`.createEl`, `.empty`, `.setText`,
         `.setCssProps`) and breaks the `obsidianmd/prefer-create-el` rule.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/prefer-create-el.md

### Lifecycle & Compatibility

Closes scorecard findings **DIR-05** (no view refs in plugin), **DIR-06**
(`activeDocument` + `window.*` timers), **DIR-07** (`instanceof TFile` over
`as TFile`), **DIR-08** (no floating promises; sync `MarkdownRenderChild` lifecycle).

**Don't:** Assign a view instance to a plugin field inside `registerView`'s callback
          (e.g., `plugin.calendarView = view`).
**Do:** Have `registerView` construct and return the view as a pure factory; consumers
        fetch the view lazily via
        `app.workspace.getLeavesOfType(...)[0]?.view` plus an `instanceof` guard.
**Why:** Holding a reference inside the callback creates a memory leak when leaves are
         detached/re-created; flagged by `obsidianmd/no-view-references-in-plugin`.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/no-view-references-in-plugin.md

**Don't:** Read `document.documentElement` or call `setTimeout(...)` / `setInterval(...)`
          bare in view code.
**Do:** Use `activeDocument` for DOM reads (popout-window-safe); prefix timers with
        `window.` (`window.setTimeout`, `window.setInterval`, `window.requestAnimationFrame`).
**Why:** `activeDocument` follows popout windows; the bare timer globals don't bind
         correctly in popouts. Note the asymmetry — `activeDocument` for DOM,
         `window.*` for timers — both rules auto-fix in opposite directions.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/prefer-active-doc.md
         and https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/prefer-window-timers.md

**Don't:** Cast `file as TFile` after `app.vault.getAbstractFileByPath(...)`.
**Do:** Narrow via `if (file instanceof TFile) { ... }`.
**Why:** A path can resolve to a `TFolder` or `null`; the cast is unsafe and breaks
         `obsidianmd/no-tfile-tfolder-cast`.
**Docs:** https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/no-tfile-tfolder-cast.md

**Don't:** Leave a `Promise`-returning call without `await`, `.catch`, or `void`. Don't
          declare `async onload()` on a `MarkdownRenderChild` subclass.
**Do:** Use `void promise` for fire-and-forget; `.catch(error => new Notice(errorMessage(error)))`
        for user-visible failures; `await` when sequencing matters. For
        `MarkdownRenderChild`, write `onload(): void { void this.initialize(); }` with
        the async work in an inner helper.
**Why:** Floating promises silently swallow errors; the async lifecycle violates
         `MarkdownRenderChild`'s sync return-type contract.
**Docs:** https://typescript-eslint.io/rules/no-floating-promises/

### Type Hygiene

Closes scorecard findings **DIR-01** (no `console.*` in shipped code), **DIR-09**
(no `any` in source, no `??` with constant LHS, no lexical decls in `case`, no
useless escapes), **DIR-10** (no unused vars / imports).

**Don't:** Leave `console.log`, `console.error`, `console.warn`, `console.info`, or
          `console.debug` in shipped code.
**Do:** Delete the call. If a forensic log is genuinely useful (cache debugging,
        fetch failure forensics), wrap it in a compile-time `const DEBUG = false`
        guard at the top of the file: `if (DEBUG) console.log(...)`. The constant
        tree-shakes out of production builds.
**Why:** Default off keeps the user's developer console clean; forensic logs are
        opt-in via a one-line code edit, not a setting.
**Docs:** https://eslint.org/docs/latest/rules/no-console

**Don't:** Use `: any` in source code (`src/**/*.ts`). Don't use `as any`.
**Do:** Use `unknown` for type-guard inputs and narrow inside the guard; use real
        domain types (`CalendarEvent`, `ical.Time`, etc.); for documented intentional
        escape hatches at single sites use
        `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`.
        Ambient `.d.ts` files are excluded by config.
**Why:** `any` defeats the type system. `unknown` forces narrowing at the use site;
         per-line disables document intent visibly. Global rule overrides hide intent.
**Docs:** https://typescript-eslint.io/rules/no-explicit-any/

**Don't:** Declare `let` or `const` directly inside a `case` block.
**Do:** Wrap the case body in a block scope: `case X: { const y = ...; }`.
**Why:** Variable declarations leak across cases without the block scope; flagged
         by `no-case-declarations`.
**Docs:** https://eslint.org/docs/latest/rules/no-case-declarations

**Don't:** Escape characters in regex character classes that don't need escaping
          (`/[-\/]/` — the `\/` is unnecessary inside `[…]`).
**Do:** Write the character literally: `/[-/]/`.
**Why:** Reduces visual noise; flagged by `no-useless-escape`.
**Docs:** https://eslint.org/docs/latest/rules/no-useless-escape

**Don't:** Use `??` with a constant left-hand side (`null ?? x`, `undefined ?? x`,
          `"" ?? x`). The result is always the right-hand side — the `??` is a no-op.
**Do:** Use the right-hand side directly: `x` (not `null ?? x`).
**Why:** Constant-LHS `??` is dead code; lint rules surface it as a logic bug.
**Docs:** https://eslint.org/docs/latest/rules/no-constant-binary-expression

**Don't:** Leave imports, variables, or catch bindings unused.
**Do:** Delete unused imports and variables. For catch blocks that don't consume the
        error, use `catch { ... }` (no binding). For catch blocks that consume the
        error, use `errorMessage(error)` from `src/utils/errors.ts`.
**Why:** Dead imports inflate bundle parsing; unused bindings hide intent. No
         `_-prefix` to mark intentionally unused — every flagged name is either
         deleted or genuinely consumed.
**Docs:** https://typescript-eslint.io/rules/no-unused-vars/

### Release & Docs

Closes scorecard findings **DIR-11** (`manifest.json` description punctuation),
**DIR-12** (release artifact attestation), and **DOC-01** (ESLint + CI lint gate).

**Don't:** Leave `manifest.json` `description` without terminating punctuation.
**Do:** End with `.`, `!`, or `?`.
**Why:** Obsidian directory scorecard checks the field shape; missing punctuation
         is flagged as a low-effort polish issue.
**Docs:** https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin

**Don't:** Publish a release without attached artifact attestation.
**Do:** Use `actions/attest-build-provenance@v2` after `npm run build` and before
        `gh release create`. Attest `main.js`, `manifest.json`, and `styles.css`.
**Why:** Attestation provides supply-chain provenance for downstream users; required
         by the directory scorecard's release-pipeline check.
**Docs:** https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions

**Don't:** Add new code without `npm run lint` passing.
**Do:** Keep `eslint.config.mjs` with the obsidianmd recommended preset + DOC-01's
        rule list. CI runs `npm run lint` on every push and PR (`.github/workflows/lint.yml`).
**Why:** The lint gate is the only thing keeping the rules in this section from
         re-growing on future feature work.
**Docs:** https://eslint.org/docs/latest/use/configure/rules

### Verifying compliance

```bash
npm run lint                                                          # zero errors
git ls-files src/ | xargs grep -nE '\.(inner|outer)HTML\s*='          # zero matches
git ls-files src/ | xargs grep -n 'document\.createElement'           # zero matches
git ls-files src/ | xargs grep -n 'as TFile'                          # zero matches
grep -rnE '\b(null|undefined|""|0|false)\s*\?\?' src/                 # zero matches
```
```

### CLAUDE.md replacement block (replaces lines 182-236; preserves `### Memory Reminders` lines 238-242)

```markdown
## Directory Compliance

v1.15 closed all Obsidian community-plugin scorecard findings from the v1.13.1 report.
The canonical do/don't list — one short rule per finding with rationale and docs URL —
lives in [.planning/codebase/CONVENTIONS.md#directory-compliance](.planning/codebase/CONVENTIONS.md#directory-compliance).

Index of rule clusters:
- **DOM API** — `innerHTML`/`outerHTML`, inline `element.style.*`, raw `document.createElement` (closes DIR-02 / DIR-03 / DIR-04)
- **Lifecycle & Compatibility** — view refs in plugin, popout-window helpers, `instanceof TFile`, floating promises (closes DIR-05 / DIR-06 / DIR-07 / DIR-08)
- **Type Hygiene** — `console.*`, `any` types, `case`-block declarations, useless escapes, unused vars (closes DIR-01 / DIR-09 / DIR-10)
- **Release & Docs** — `manifest.json` punctuation, release attestation, ESLint + CI gate (closes DIR-11 / DIR-12 / DOC-01)

ESLint enforces every rule above (`eslint.config.mjs`). CI runs `npm run lint`
on every push and PR via `.github/workflows/lint.yml`.
```

(Lines 238-242 `### Memory Reminders` stay verbatim immediately below the new section.)

**Planner action:** The replacement block above can be dropped in as a single edit. Verify the heading level: `## Directory Compliance` is `h2`, matching the level of the section being replaced. The `### Memory Reminders` subheading below it then continues to render under the new section, which is acceptable (memory reminders ARE a project-level constraint that fits naturally under directory compliance), but if the planner prefers, the Memory Reminders subsection can be promoted to its own `## Project Conventions` section above or below Directory Compliance. Either ordering is fine.

## Smoke-Test Plan (D-06 — verification recorded in closing commit body)

After commit 5 (DOC-02), before tagging the release:

1. **Lint clean:** `npm run lint` → exits zero. Capture the output.
2. **Build clean:** `npm run build` → exits zero (runs `tsc -noEmit -skipLibCheck` first, then esbuild). Capture output.
3. **Obsidian 60-second smoke test:**
   1. Open Obsidian with the dev vault containing MemoChron.
   2. Toggle MemoChron off → on in Community Plugins (covers `onload`/`onunload` paths).
   3. Open the sidebar calendar (Cmd/Ctrl+P → "MemoChron: Open calendar").
   4. Navigate one month forward, one month back.
   5. Click an event in the agenda → confirm a note is created OR opened.
   6. Open Settings → MemoChron → confirm the calendar list renders, the "Add calendar" flow opens correctly.
   7. Toggle "Hide calendar" → confirm the calendar hides; toggle again → confirm it returns.
   8. Open an embedded `memochron-calendar` code block in a test note → confirm rendering.

**If any step fails:** revert the offending commit, investigate, re-land. Do not push commit 5 (the milestone-closing commit) without all 8 smoke-test steps passing.

**Recording:** Add the smoke-test results to commit 5's commit message body as a short checklist:
```
docs(08): add Directory Compliance conventions (DOC-02)

Closes v1.15 Directory Compliance milestone.

Smoke-test verification (Phase 8 D-06):
- npm run lint → clean
- npm run build → clean
- Obsidian smoke test (8 steps) → all green
- Lint sites resolved: 39 no-console, 16 no-explicit-any, 18 no-unused-vars,
  1 no-case-declarations, 1 no-useless-escape, 0 nullish-on-constant-LHS
```

Per CLAUDE.md, no Claude/AI references in commit messages.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `error instanceof Error ? error.message : String(error)` inline | `errorMessage(error)` helper at `src/utils/errors.ts` | Phase 2 (2026-05-10) | All 18 catch sites already use the helper [VERIFIED: grep in src/] |
| `(window as any).moment` cast pattern | `import { moment } from "obsidian"` (typed since obsidian API exports moment) | Available now (obsidian.d.ts:4415 already exists) | Eliminates 5 `any` casts in this codebase; see Conflicts section |
| Global `no-explicit-any: "off"` override | `**/*.d.ts` exclude + per-line `eslint-disable-next-line` for documented exceptions | Phase 8 (this phase) | Lint catches new `any` while documented exceptions stay readable |
| `: any` for type-guard inputs | `: unknown` + narrow inside the guard | typescript-eslint recommended-type-checked default since v4.x | One-line change at `CalendarService.isValidCache` |

**Deprecated/outdated:**
- `(window as any).moment` — `obsidian` exports typed `moment` directly [VERIFIED: `obsidian.d.ts:4415`]
- CONVENTIONS.md §TypeScript Usage's "intentional and limited `any` usage" stance (lines 201-209) — becomes partially stale after Phase 8 lands. Update §TypeScript Usage to reference §Directory Compliance for the current rule.

## Assumptions Log

> All claims in this research are tagged `[VERIFIED]` or `[CITED]` against a source. No `[ASSUMED]` claims.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (empty) | All claims verified against source files, live ESLint runs, or HTTP-200-checked docs URLs | — | — |

## Open Questions

1. **Should the `(window as any).moment` typed-import alternative supersede CONTEXT.md D-08?**
   - What we know: `obsidian` exports a typed `moment` (Conflict 1, verified); replacing the casts eliminates 5 `any` sites + 5 dead null-check branches; bundle impact zero
   - What's unclear: User preference — does v1.15 want the cleanest possible source tree, or the minimum diff necessary to satisfy the lint rule?
   - Recommendation: Surface to user at plan-phase open. Default to Option B (typed import) per Phase 7 A1/A2 precedent of "research-discovered better option overrides CONTEXT default."

2. **Should `ical.d.ts` be tightened beyond the lint-exclude default?**
   - What we know: D-08 default is lint-exclude only; the file currently uses `any` at 6 sites; for `getValues()` specifically, tightening to `Array<Time | Duration | string>` improves DIR-09 quality at no cost
   - What's unclear: How much shim-tightening the planner wants in scope
   - Recommendation: lint-exclude is the cheapest correct close (D-08 default). Tightening `getValues()` is a 1-line `.d.ts` edit; planner's call whether to bundle it with commit 2.

3. **Where should `### Memory Reminders` (CLAUDE.md lines 238-242) live after the TODO block is replaced?**
   - What we know: Memory Reminders is a project-meta rule (commit hygiene); CONTEXT D-04 says preserve it; the TODO block is the only natural home in current CLAUDE.md
   - What's unclear: Whether to keep it as a subsection of the new `## Directory Compliance` section, promote to its own `## Project Conventions` section, or move it elsewhere
   - Recommendation: Keep at the bottom of `## Directory Compliance` as a `### Memory Reminders` subsection. Reads naturally with the rest of the cluster index; no separate section needed.

## Environment Availability

No external dependencies required. Phase 8 is pure source-tree changes (lint passes; build passes; no install).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm run lint`, `npm run build` | ✓ | local | — |
| `eslint` package | Lint gate | ✓ | 9.39.4 | — |
| `eslint-plugin-obsidianmd` | DIR-* rule enforcement | ✓ | 0.3.0 | — |
| Obsidian app (desktop) | Smoke test | Assumed available on developer machine | — | — |

## Validation Architecture

Phase 8 has `workflow.nyquist_validation: true` in `.planning/config.json` (no override in CONTEXT.md). Validation is **lint-driven** — there is no unit-test infrastructure in this codebase per project Out-of-Scope (QA-01 deferred to v2).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (no unit-test infrastructure; QA-01 deferred to v2) |
| Config file | n/a |
| Quick run command | `npm run lint` |
| Full suite command | `npm run lint && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DIR-01 | Zero `console.*` in shipped code; gated forensics behind `DEBUG=false` | lint (no-console) + grep | `npx eslint src/ --rule '{"no-console":"error"}'` → 0 errors; `git ls-files src/ \| xargs grep -nE "console\\."` returns only `if (DEBUG) console.…` lines | ✅ |
| DIR-09a | Zero `no-explicit-any` in src (`.d.ts` excluded) | lint | `npm run lint` → zero `no-explicit-any` errors | ✅ |
| DIR-09b | Zero `no-case-declarations` | lint | `npm run lint` → zero `no-case-declarations` errors | ✅ |
| DIR-09c | Zero `no-useless-escape` | lint | `npm run lint` → zero `no-useless-escape` errors | ✅ |
| DIR-09d | Zero `??` with constant LHS | grep | `grep -rnE '\b(null\|undefined\|""\|0\|false)\s*\?\?' src/` → no executable hits (comments OK) | ✅ |
| DIR-10 | Zero `no-unused-vars` | lint | `npm run lint` → zero `no-unused-vars` errors | ✅ |
| DOC-02a | `## Directory Compliance` section exists in `.planning/codebase/CONVENTIONS.md` with 4 clusters | grep | `grep -c '^## Directory Compliance' .planning/codebase/CONVENTIONS.md` returns 1; `grep -c '^### DOM API\|^### Lifecycle & Compatibility\|^### Type Hygiene\|^### Release & Docs' .planning/codebase/CONVENTIONS.md` returns 4 | ✅ |
| DOC-02b | `## Directory Compliance` pointer section in `CLAUDE.md`; `### Memory Reminders` preserved | grep | `grep -c '^## Directory Compliance' CLAUDE.md` returns 1; `grep -c '^### Memory Reminders' CLAUDE.md` returns 1; `grep -c '^## TODO: Code Quality Issues to Address' CLAUDE.md` returns 0 | ✅ |
| **Acceptance** | `eslint.config.mjs:65-105` (Phase-8 override block) deleted; lint passes clean | lint + line count | `npm run lint` → 0 errors with no `// Phase 8` comment block in `eslint.config.mjs`; `wc -l eslint.config.mjs` ≈ 75 lines (was 115) | ✅ |
| **Build sanity** | `npm run build` succeeds (catches type-system regressions from DIR-09 changes) | manual | `npm run build` → exit 0 | ✅ |

### Sampling Rate

- **Per task commit:** `npm run lint` (under 5 seconds on this codebase)
- **Per wave merge:** `npm run lint && npm run build` (both required; build catches type-system regressions that lint alone misses)
- **Phase gate:** Full lint+build green AND 8-step Obsidian smoke test green (recorded in commit-5 body per D-06)

### Wave 0 Gaps

- None — `npm run lint` is already a `package.json` script, `eslint.config.mjs` is in place, and CI runs lint on every push. No test-framework install or scaffolding needed.

## Security Domain

> Phase 8 is type/lint/conventions hygiene — no security-surface changes. Including this section for completeness per init context (`security_enforcement` not set to false in config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | no | Already addressed in Phase 2 (SEC-01 color validation, SEC-02 error handling) |
| V6 Cryptography | no | n/a |
| V7 Error Handling | no | Already addressed in Phase 2 (`errorMessage()` helper at every catch site) |
| V14 Configuration | indirect | ESLint configuration shape; the lint gate IS the configuration control |

### Known Threat Patterns for Obsidian plugin TypeScript

| Pattern | STRIDE | Standard Mitigation | Phase 8 Impact |
|---------|--------|---------------------|----------------|
| `any` type masking unvalidated input | T (Tampering) | Use `unknown` + type guards | Phase 8 closes this at `isValidCache` (DIR-09) and at `(dtstart as any).jCal` access sites |
| `console.*` leaking sensitive info in logs | I (Information Disclosure) | Default off; explicit allow-list for forensic logs | Phase 8 deletes 33 sites and gates 6 behind `DEBUG=false` (DIR-01) |
| Suppressed lint masking real bugs | T (Tampering) | Per-line `eslint-disable` with rationale; no global overrides | Phase 8 deletes the Phase-8 global-override block (DIR-01/09/10 acceptance) |

**No new threat surface introduced by Phase 8.** All changes are reductive (deleting code, deleting overrides, deleting dead bindings).

## Sources

### Primary (HIGH confidence)

- `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/preferActiveDoc.js` — confirmed `prefer-active-doc` rule auto-fix shape (document → activeDocument) [read 2026-05-16]
- `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/preferWindowTimers.js` — confirmed `prefer-window-timers` auto-fix direction (window.setTimeout, NOT activeWindow.setTimeout) — codifies the Phase 7 A2 asymmetry [read 2026-05-16]
- `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/preferCreateEl.js` — confirmed docs URL pattern `https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/${name}.md` [read 2026-05-16]
- `node_modules/obsidian/obsidian.d.ts:4415` — confirmed `export const moment: typeof Moment` (typed moment export) [read 2026-05-16]
- Live `npx eslint` runs — exact violation counts and sites verified at research time
- `src/utils/errors.ts` — confirmed `errorMessage(err: unknown): string` helper signature [read 2026-05-16]
- `.planning/phases/08-type-hygiene-conventions/08-CONTEXT.md` — all locked decisions D-01 through D-10 [read 2026-05-16]
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — milestone framing [read 2026-05-16]
- `eslint.config.mjs` — confirmed line range 65-105 for Phase-8 override block [read 2026-05-16]
- `CLAUDE.md` lines 180-243 — confirmed `## TODO` block runs 182-236, `### Memory Reminders` at 238-242 [read 2026-05-16]
- `package.json` — confirmed lint script and dependency versions [read 2026-05-16]

### Secondary (MEDIUM confidence)

- ESLint docs (`https://eslint.org/docs/latest/rules/{rule}`) — HTTP-200-verified for `no-console`, `no-case-declarations`, `no-useless-escape`, `no-constant-binary-expression`, `configure/rules` [verified 2026-05-16]
- typescript-eslint docs (`https://typescript-eslint.io/rules/{rule}/`) — HTTP-200-verified for `no-explicit-any`, `no-unused-vars`, `no-floating-promises` [verified 2026-05-16]
- Obsidian docs (`https://docs.obsidian.md/...`) — HTTP-200-verified for `Plugins/User+interface/HTML+elements`, `Plugins/Releasing/Plugin+guidelines`, `Plugins/User+interface/About+styling`, `Plugins/Vault`, `Plugins/Releasing/Submit+your+plugin`, `Reference/TypeScript+API/Plugin/registerView`, `Reference/TypeScript+API/MarkdownRenderChild`, `Plugins/Releasing/Release+your+plugin+with+GitHub+Actions` [verified 2026-05-16]
- eslint-plugin-obsidianmd rule docs (`https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/{rule}.md`) — HTTP-200-verified for `detach-leaves`, `prefer-create-el`, `no-static-styles-assignment`, `no-tfile-tfolder-cast`, `no-view-references-in-plugin`, `prefer-active-doc`, `prefer-window-timers`, `prefer-instanceof`, `validate-manifest` [verified 2026-05-16]

### Tertiary (LOW confidence)

- (none — every claim in this research is verified against either a local source file or an HTTP-200-checked URL)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified against `package.json` and `node_modules/`
- Architecture/conventions templates: HIGH — every docs URL HTTP-200-verified; every code pattern in the templates matches existing codebase usage
- DIR-01 console classification: HIGH — every site inspected in source with ±10 lines of context
- DIR-09 any sites: HIGH — every site inspected; every replacement strategy compiled against the existing code path
- DIR-10 unused vars: HIGH — counts verified via live ESLint run; per-site dispositions verified via grep
- Conflict 1 (`window.moment` typed export): HIGH — verified via reading `obsidian.d.ts:4415` directly
- `eslint.config.mjs` line range: HIGH — verified via line-by-line inspection
- Pitfalls: HIGH — each pitfall mapped to a specific file/line where it would manifest

**Research date:** 2026-05-16
**Valid until:** 2026-06-15 (30 days — Obsidian API, ESLint, and the linked docs URLs are all stable on this horizon)

---

*Phase: 08-type-hygiene-conventions*
*Researched: 2026-05-16*
