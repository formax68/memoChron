# Phase 8: Type Hygiene & Conventions - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the final cluster of Obsidian community-plugin directory-scorecard findings — DIR-01 (console logging), DIR-09 (TypeScript hygiene: `any`, nullish-on-LHS-of-`??`, lexical decls in `case`, unnecessary regex escapes), DIR-10 (~21 named unused vars / imports) — delete the Phase-8 ESLint override block at `eslint.config.mjs:66–109`, then land DOC-02 (`CLAUDE.md` + `.planning/codebase/CONVENTIONS.md` "Directory Compliance" do/don't section) as the closing commit so future plans land compliant by default.

This is the **milestone-closing phase**. After it lands, `npm run lint` runs clean against the v1.15 source tree with no per-rule or per-file disables tied to scorecard findings, and a fresh Obsidian community-plugin Review scorecard run should show zero remaining "Avoid …" findings from the v1.13.1 report.

**Live violation footprint** (from `npx eslint src/` with Phase-8 overrides re-tightened):

- `no-console`: **39 sites** across 11 files
  - `src/main.ts:112, 123` (2)
  - `src/services/CalendarService.ts:60, 256, 267, 302, 344, 346, 381, 384, 387, 398, 406, 457, 545, 923` (15)
  - `src/services/NoteService.ts:81, 133, 172, 316, 338, 596` (6)
  - `src/services/IcsImportService.ts:38, 40` (2)
  - `src/settings/SettingsTab.ts:1537, 1767` (2)
  - `src/utils/timezoneUtils.ts:179, 200, 215, 224, 266` (5)
  - `src/views/CalendarView.ts:153, 174, 347, 833, 927, 1059` (6)
  - `src/views/EmbeddedAgendaView.ts:398` (1)
  - `src/views/EmbeddedCalendarView.ts:249` (1)
- `@typescript-eslint/no-explicit-any`: **12 sites** across 6 files
  - Ambient: `src/types/ical.d.ts:3, 8, 12, 14, 58, 71` (6 sites — `ical.js` is untyped)
  - `(window as any).moment`: `CalendarView.ts:163, 558, 808`, `EmbeddedCalendarView.ts:224`, `EmbeddedAgendaView.ts:379` (5)
  - `(dtstart as any).jCal`: `CalendarService.ts:940`, `IcsImportService.ts:101` (2)
  - Type-guard: `CalendarService.ts:317` (`isValidCache(cache: any): cache is CacheData`)
  - Cosmetic: `CalendarService.ts:771` (`forEach((value: any) => ...)`)
  - Cosmetic: `SettingsTab.ts:1182` (`generatePreviewPath(template: string, event: any)`)
- `@typescript-eslint/no-unused-vars`: **18 sites** (scorecard listed 21 — the 3-name delta likely already cleaned up during Phases 5–7 churn; planner confirms at implementation)
  - `CalendarService.ts:12` (`convertTimezone`), `:531` (`error`)
  - `IcsImportService.ts:5` (`Property`)
  - `SettingsTab.ts:6, 7, 16, 1174` (`TextAreaComponent`, `DropdownComponent`, `CalendarNotesSettings`, `error`)
  - `settings/types.ts:4` (`DEFAULT_CALENDAR_URLS`)
  - `viewRenderers.ts:2, 3` (`MemoChronSettings`, `TFile`, `Notice`, `App`)
  - `CalendarView.ts:1, 14, 200, 1101` (`DropdownComponent`, `DateElements`, `controls`, `title`)
  - `EmbeddedCalendarView.ts:15, 109` (`CalendarEvent`, `title`)
- `no-case-declarations`: **1 site** — `src/utils/pathUtils.ts:50`
- `no-useless-escape`: **1 site** — `src/utils/viewRenderers.ts:371` (`\/` in a regex literal)
- `??` with constant LHS: **not surfaced by the current rule set** — separate lint rule. Planner does a targeted grep (`grep -rnE '\b(null|undefined|""|0|false)\s*\?\?' src/`) and addresses any hits, or confirms there are none and notes that in the closing commit.

Phase end state: every site above is either removed, gated, or rewritten; the override block at `eslint.config.mjs:66–109` is gone; `npm run lint` exits zero; CLAUDE.md `## TODO: Code Quality Issues to Address` block is replaced by a `## Directory Compliance` pointer; `.planning/codebase/CONVENTIONS.md` carries the full do/don't list grouped by cluster.

Out of scope (other phases / other milestones): mobile UAT (deferred to v1.16 per Phase 6/7 precedent), test suite (QA-01 deferred), accessibility (QA-02 deferred), fragility refactors (`window.moment` shim / `jCal[2]` cleanup / `hasSourceMismatch` URL identity — deferred to a future fragility milestone; `window.moment` cast intentionally kept per the Claude's Discretion default below).

</domain>

<decisions>
## Implementation Decisions

### DOC-02 conventions document shape (user-locked)

- **D-01:** **Canonical do/don't list lives in `.planning/codebase/CONVENTIONS.md`; `CLAUDE.md` links to it.** Single source of truth. The codebase-conventions doc is the right home — it already exists (`2026-05-09 analysis`), already lives alongside the other codebase intel docs (STRUCTURE.md, STACK.md, ARCHITECTURE.md), and is the natural reference for any future contributor reading `.planning/codebase/`. CLAUDE.md gets a short anchor section that points to it, not a duplicated rules list. Drift risk is eliminated; updating one rule means updating one file.

- **D-02:** **Inside CONVENTIONS.md, the new `## Directory Compliance` section is grouped by rule cluster — not by individual DIR-NN finding.** Four sub-sections:
  - **DOM API** — DIR-02 (`innerHTML`/`outerHTML`), DIR-03 (`element.style.*` inline), DIR-04 (`document.createElement` → `createEl`/`createDiv`/`createSpan`)
  - **Lifecycle & Compatibility** — DIR-05 (no view refs in plugin), DIR-06 (`activeDocument` + `window.*` timers per the Phase-7 A2 asymmetry), DIR-07 (`instanceof TFile` over `as TFile`), DIR-08 (no floating promises; sync `MarkdownRenderChild` lifecycle return types)
  - **Type Hygiene** — DIR-01 (no `console.*` in shipped code, or gated behind dev-only debug flag), DIR-09 (no `any` in source [.d.ts ambient excepted], no `??` with constant LHS, no lexical decls in `case` blocks, no unnecessary escapes), DIR-10 (no unused vars / imports)
  - **Release & Docs** — DIR-11 (`manifest.json` description punctuation), DIR-12 (release artifact attestation), DOC-01 (ESLint + CI lint gate present)
  
  Each cluster gets a 1-sentence intro stating which scorecard findings it closes. Reads like a developer guide, not a flat checklist.

- **D-03:** **Each rule renders as a four-line block: `Don't:` / `Do:` / `Why:` / `Docs:`.** Format locked by user (matched success-criterion-#5 wording verbatim — "one short rule per scorecard finding, each with a one-line rationale and a link to the relevant Obsidian docs page"). Example:
  ```markdown
  **Don't:** Use `element.innerHTML = "<div>...</div>"`.
  **Do:** Use `createDiv({ cls: "..." })` / `createEl("div", { ... })`.
  **Why:** Bypasses Obsidian's sanitization; flagged by the no-unsanitized rule
            and scorecard findings DIR-02 / DIR-04.
  **Docs:** https://docs.obsidian.md/Plugins/User+interface/HTML+elements
  ```
  No full before/after code blocks per rule (the codebase already shows the compliant pattern at every call site after Phases 5–7). Researcher resolves the final canonical Obsidian docs URL per rule.

- **D-04:** **In CLAUDE.md, replace the existing `## TODO: Code Quality Issues to Address` block (high / medium / low priority subsections) with a `## Directory Compliance` section.** That TODO list is stale — most items shipped in v1.14.0 / v1.15. The replacement section:
  1. States in 1–2 sentences that v1.15 closed all Obsidian community-plugin scorecard findings
  2. Links to `.planning/codebase/CONVENTIONS.md#directory-compliance` as the canonical do/don't list
  3. Names each cluster (DOM API / Lifecycle & Compatibility / Type Hygiene / Release & Docs) in a one-line index
  4. **Preserves** the existing "Memory Reminders" subsection (commit hygiene — no Claude references) and the Beta Release Strategy section (BRAT workflow) — those are still valid and not covered by the new section
  
  The "MemoChron-Specific Implementation Notes" section stays; the new Directory Compliance section sits above it in CLAUDE.md.

### Commit ordering (Claude's Discretion — default per Phase 6/7 precedent)

- **D-05:** **Five-or-six atomic commits, mechanical first, override-delete then DOC-02 last.** Mirrors Phase 6 D-16 / Phase 7 D-11.
  1. `refactor: remove unused vars and imports (DIR-10)` — mechanical, smallest commit, no behavior change. Builds confidence before the larger ones.
  2. `refactor(types): tighten TypeScript hygiene (DIR-09)` — `any` → real types or `unknown` where applicable, `no-case-declarations` block scope in pathUtils.ts:50, `no-useless-escape` fix in viewRenderers.ts:371. **If a `??`-with-constant-LHS site is found, it joins this commit.** `ical.d.ts` ambient `any`s handled per D-08 default.
  3. `refactor(logs): remove or gate console.* per DIR-01` — per D-07 default. Largest commit by site count.
  4. `chore(lint): remove Phase 8 ESLint overrides (DIR-01/09/10 acceptance)` — deletes the Phase-8 block at `eslint.config.mjs:66–109`. `npm run lint` runs as part of this commit's verification and must pass clean.
  5. `docs(08): add Directory Compliance conventions (DOC-02)` — writes the `## Directory Compliance` section into `.planning/codebase/CONVENTIONS.md` and the pointer section into `CLAUDE.md`. **Closing commit of the milestone.**
  6. *(optional)* `docs(08): record Phase 8 human UAT` — only if planner decides UAT artifact is worth committing per D-09 default.

  Planner may merge commits 1+2 if both end up small, but commit 5 stays last and standalone. If a `??`-with-constant-LHS audit produces a meaningful change, it joins commit 2.

### UAT scope (Claude's Discretion — default)

- **D-06:** **No formal HUMAN-UAT.md file required for Phase 8.** Justification:
  - Phase 8 is code-internal hygiene — no user-facing behavior change is intentional
  - Console removal cannot be UAT'd against a visible result (logs are developer-only)
  - `any` removal is type-only, no runtime change
  - Unused-vars cleanup is deletion-only, no runtime change
  
  **Minimum verification (Claude's Discretion):** `npm run lint` clean → `npm run build` clean → 60-second smoke test (open Obsidian, confirm sidebar calendar opens, click an event, confirm note is created, open settings, confirm calendar list renders). The planner records the smoke-test result in the closing commit message, not in a separate file.
  
  **If planner judgement says a HUMAN-UAT.md adds value** (e.g., the `(window as any).moment` cast removal touches enough code to warrant a parity check), the planner may add one as commit 6. Default is no.

### DIR-01 console policy (Claude's Discretion — default)

- **D-07:** **Default: pure deletion at every console.* site. Selective re-wrapping under a dev-only flag is OK case-by-case.** Rationale: most flagged sites are either silent (`console.debug` timezone skip), one-shot lifecycle (`MemoChron: Background refresh started`), or already paired with a `Notice` (the `console.error` sites in views all already call `new Notice(...)` for user feedback per Phase 2 SEC-02). Removing them removes noise from the developer console without losing user-visible signal.
  
  **Exception** — if the planner identifies sites where the log is genuinely useful for cache-debugging or fetch-failure forensics, those may be **gated behind a compile-time const** at the top of the file:
  ```ts
  const DEBUG = false;
  if (DEBUG) console.log(...);
  ```
  Compile-time const (not a setting) because:
  - Toggling logs at runtime is not a feature the user asked for
  - A real setting would need UI, persistence, validation — overkill for forensic logs
  - Tree-shaking eliminates the call entirely in the shipped bundle when `DEBUG=false`
  - Future contributors can flip the constant locally without touching the build
  
  Planner makes the per-site call. Default is delete; gate is the exception.

### DIR-09 `any` strategy (Claude's Discretion — default)

- **D-08:** **Per-category default treatment:**
  - **`src/types/ical.d.ts` (6 sites — ambient)**: success criterion #2 explicitly says "ambient `.d.ts` shims and any test fixtures excluded by config". Default = update `eslint.config.mjs` to exclude `**/*.d.ts` from `no-explicit-any` (single-line config change). Hand-typing the `ical.js` API is a multi-day rabbit hole, the library lacks bundled types, and the file is already documented as an ambient shim. Lint-exclude is the cheapest correct close.
  - **`(window as any).moment` (5 sites)**: keep as documented intentional pattern per CONVENTIONS.md §TypeScript Usage. Use a **per-line `eslint-disable-next-line @typescript-eslint/no-explicit-any` with a one-line rationale comment** — NOT a global rule override. The directory scorecard accepts intentional, documented `any` usage; what it forbids is silent `any`. The FRAG-01 utility wrapper is deferred to a future milestone (REQUIREMENTS.md v2).
  - **`(dtstart as any).jCal` (2 sites — `CalendarService.ts:940`, `IcsImportService.ts:101`)**: narrow to a typed assertion. The `ical.d.ts` shim already declares `jCal: any` on `Property` (or similar); typing the assertion as `{ jCal: unknown[] }` and then accessing index 2 explicitly is sufficient. Same `eslint-disable-next-line` + rationale comment fallback if the type math is awkward. FRAG-02 (full `VALUE=DATE` migration) stays deferred.
  - **`isValidCache(cache: any): cache is CacheData` (`CalendarService.ts:317`)**: migrate to `cache: unknown`. This is the typescript-eslint recommended fix for type guards and is a one-line change.
  - **Cosmetic `value: any` and `event: any` (2 sites)**: replace with real types. `forEach((value: any) => ...)` in `CalendarService.ts:771` should become `forEach((value: ical.Time) => ...)` or similar (planner picks based on the loop body). `generatePreviewPath(event: any)` in `SettingsTab.ts:1182` becomes `event: CalendarEvent` (the type already exists).
  
  Planner makes the per-site call within these defaults; ambiguous sites default to `unknown` + comment.

### DIR-10 unused-vars cleanup (Claude's Discretion — default)

- **D-09:** **Pure deletion of every flagged import / variable / parameter binding.** No "_-prefix to mark intentionally unused" — every flagged name from the live ESLint inventory is either dead or accidentally retained from a prior refactor. Catch-binding `error` sites use **`catch { … }`** (no binding) where the error is genuinely unused, otherwise the binding stays and is consumed via `errorMessage(error)`.
  
  Planner audits the catch-binding sites for the unused-`error` flags (`CalendarService.ts:531`, `SettingsTab.ts:1174`) and picks `catch { ... }` vs `catch (error) { /* use it */ }` per site.

### Phase-8 ESLint override block removal

- **D-10:** **Delete `eslint.config.mjs:66–109` in its entirety** as the "acceptance" commit (D-05 commit 4). The block has two sub-blocks:
  1. Lines 66–88 — the `src/**/*.ts` rule overrides (`no-console`, `no-explicit-any` family, `no-case-declarations`, `no-useless-escape`, `obsidianmd/rule-custom-message`)
  2. Lines 89–109 — the closed-set `files: [...]` block disabling `no-unused-vars` for 7 specific files
  
  Both blocks go in the same commit. If D-08's `.d.ts` exclusion lands, that's a separate **addition** to `eslint.config.mjs` (not a removal) — it should land in the DIR-09 commit (commit 2), not the override-delete commit.

### Claude's Discretion

- **Compile-time `DEBUG` constant placement (per-file, top-of-file)** vs a shared `src/utils/debug.ts` exported const — planner decides if any sites end up gated (D-07). Default is per-file unless 3+ files end up gated.
- **Exact final wording of each do/don't block** in CONVENTIONS.md — researcher drafts; planner reviews. Each block uses the four-line shape from D-03; researcher resolves the canonical Obsidian docs URL per rule (some live under `docs.obsidian.md/Plugins/...`, some under `github.com/obsidianmd/eslint-plugin-obsidianmd/blob/main/docs/rules/...`).
- **Whether to add a "Verifying compliance" subsection** at the bottom of CONVENTIONS.md §Directory Compliance — a 3-line snippet showing `npm run lint` + the success-criterion grep commands (`git ls-files src/ | xargs grep -nE '\.(inner|outer)HTML\s*='` and friends). Default is yes; planner skips if it bloats the section.
- **Whether the `~21` count in the goal statement is corrected** — live lint shows 18, so DOC-02 doesn't carry the `21` figure into the conventions doc; the closing commit body notes the actual count.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project artifacts
- `.planning/ROADMAP.md` — Phase 8 entry: 6 success criteria (the four sites in CalendarService:249/282/324 and SettingsTab:1720 + full-tree audit; clean lint for `no-explicit-any` / `no-case-declarations` / `no-useless-escape` / `??`-with-constant-LHS; clean lint for `no-unused-vars` including the 21 named symbols; Phase 5 override block removed; DOC-02 rules in CLAUDE.md + CONVENTIONS.md; milestone-level fresh scorecard run shows zero remaining findings)
- `.planning/REQUIREMENTS.md` — DIR-01 (no console.*), DIR-09 (no `any`/`??`-on-constant/case-decl/useless-escape), DIR-10 (zero `no-unused-vars`), DOC-02 (CLAUDE.md + CONVENTIONS.md "Directory Compliance" do/don't with rationale + docs link)
- `.planning/PROJECT.md` — milestone framing ("v1.15 Directory Compliance — close every finding so the next directory re-check flips Risks → Excellent"); Key Decision: "Install lint/CI guardrails alongside the fixes — without `.eslintrc` enforcing the same rules, the violations will re-grow"
- `.planning/STATE.md` — v1.15 milestone state; Phase 7 complete (Lifecycle & Compatibility); Phase 8 is the closing phase

### Codebase intel (existing — update target for DOC-02)
- `.planning/codebase/CONVENTIONS.md` — **update target.** Add the new `## Directory Compliance` section per D-01 / D-02 / D-03. Keep the existing 2026-05-09 convention analysis intact; the new section sits at the end.
- `.planning/codebase/STRUCTURE.md` — file layout reference; planner uses this to confirm the 11 files in scope for DIR-01 console cleanup
- `.planning/codebase/STACK.md` — TypeScript / ESLint / Obsidian Plugin API stack
- `.planning/codebase/CONCERNS.md` — pre-existing flags; verify nothing new added since 2026-05-09

### Prior phase context (decisions carried forward)
- `.planning/phases/05-guardrails-trivial-fixes/05-CONTEXT.md` — D-04 lists the exact Phase-8 override block to delete; D-13 sets the HUMAN-UAT-only verification pattern (which D-06 reuses)
- `.planning/phases/06-dom-api-refactor/06-CONTEXT.md` — D-16 sets the requirement-then-cleanup commit ordering; D-15 sets the live-walkthrough UAT pattern. Phase 8 D-05 mirrors D-16; Phase 8 D-06 inverts to "no UAT artifact needed for code-internal hygiene".
- `.planning/phases/07-lifecycle-compatibility/07-CONTEXT.md` — D-11 commit-ordering shape (mechanical first, override-delete then docs last); A1 / A2 amendments (rule-source-of-truth verification pattern — researcher reads `eslint-plugin-obsidianmd` rule source files line-by-line, not just the README, to confirm auto-fix shapes)
- `.planning/phases/02-security-correctness/02-CONTEXT.md` — `src/utils/errors.ts` `errorMessage(error)` helper introduced; used at all 18 catch sites; relevant to DIR-10 catch-binding cleanup (D-09)

### Repository files Phase 8 will touch (by DIR cluster)
**DIR-01 console (11 files):**
- `src/main.ts:112, 123`
- `src/services/CalendarService.ts:60, 256, 267, 302, 344, 346, 381, 384, 387, 398, 406, 457, 545, 923` (15 sites)
- `src/services/NoteService.ts:81, 133, 172, 316, 338, 596` (6 sites)
- `src/services/IcsImportService.ts:38, 40` (2 sites)
- `src/settings/SettingsTab.ts:1537, 1767` (2 sites)
- `src/utils/timezoneUtils.ts:179, 200, 215, 224, 266` (5 sites)
- `src/views/CalendarView.ts:153, 174, 347, 833, 927, 1059` (6 sites)
- `src/views/EmbeddedAgendaView.ts:398` (1 site)
- `src/views/EmbeddedCalendarView.ts:249` (1 site)

**DIR-09 `any` / `case` / escape / `??` (6 files):**
- `src/types/ical.d.ts:3, 8, 12, 14, 58, 71` (6 ambient sites — likely closed via lint exclude per D-08)
- `src/services/CalendarService.ts:317, 771, 940` (3 sites)
- `src/services/IcsImportService.ts:101` (1 site)
- `src/settings/SettingsTab.ts:1182` (1 site)
- `src/views/CalendarView.ts:163, 558, 808` (3 `window.moment` sites)
- `src/views/EmbeddedCalendarView.ts:224`
- `src/views/EmbeddedAgendaView.ts:379`
- `src/utils/pathUtils.ts:50` (`no-case-declarations`)
- `src/utils/viewRenderers.ts:371` (`no-useless-escape`)
- Planner also greps for `??`-with-constant-LHS across `src/`

**DIR-10 unused vars (7 files):**
- `src/services/CalendarService.ts:12, 531`
- `src/services/IcsImportService.ts:5`
- `src/settings/SettingsTab.ts:6, 7, 16, 1174`
- `src/settings/types.ts:4`
- `src/utils/viewRenderers.ts:2, 3` (4 names on lines 2–3)
- `src/views/CalendarView.ts:1, 14, 200, 1101`
- `src/views/EmbeddedCalendarView.ts:15, 109`

**Lint + docs:**
- `eslint.config.mjs:66–109` — delete entirely (D-10)
- `eslint.config.mjs` — add `**/*.d.ts` exclusion for `no-explicit-any` per D-08 default (separate commit from the override-delete)
- `.planning/codebase/CONVENTIONS.md` — add `## Directory Compliance` section per D-01 / D-02 / D-03
- `CLAUDE.md` — replace `## TODO: Code Quality Issues to Address` with `## Directory Compliance` pointer per D-04; preserve `### Memory Reminders` and Beta Release Strategy

### Project rules
- `CLAUDE.md` — Obsidian plugin best practices; commit-message hygiene (NO Claude / AI references in commits or release notes); mobile compatibility (`isDesktopOnly: false`); the `## TODO: Code Quality Issues to Address` block is the **update target** per D-04

### External docs (researcher MUST consult at planning time)
- **Obsidian Plugin API documentation site** — `https://docs.obsidian.md/Plugins/` — for canonical docs URLs per rule cluster (DOM API, Lifecycle, Type Hygiene). Researcher resolves the exact subpage per rule for the `Docs:` line of each do/don't block (D-03).
- **`eslint-plugin-obsidianmd`** — rule docs at `https://github.com/obsidianmd/eslint-plugin-obsidianmd/tree/main/docs/rules` (or `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/*.js` for source-of-truth verification per Phase 7 A1/A2 precedent). Researcher confirms each rule's docs URL is live before locking it into the do/don't block.
- **`@typescript-eslint/no-explicit-any`** — `https://typescript-eslint.io/rules/no-explicit-any/` — canonical docs link for the Type Hygiene cluster
- **`@typescript-eslint/no-unused-vars`** — `https://typescript-eslint.io/rules/no-unused-vars/` — confirm whether `args: "none"` is the right exception for catch-bindings or whether `argsIgnorePattern: "^_"` is preferred. D-09 default is delete; this is the fallback if the planner finds genuinely-need-the-binding sites.
- **`no-console`** — `https://eslint.org/docs/latest/rules/no-console` — canonical docs link
- **`no-case-declarations`** — `https://eslint.org/docs/latest/rules/no-case-declarations` — for the one site in `pathUtils.ts:50`
- **`no-useless-escape`** — `https://eslint.org/docs/latest/rules/no-useless-escape` — for the one site in `viewRenderers.ts:371`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/utils/errors.ts` `errorMessage(error)` helper** (Phase 2) — already used at 18 catch sites. If DIR-01 cleanup removes a `console.error` paired with a `Notice`, the `Notice` keeps using `errorMessage()` and no new helper is needed.
- **`eslint.config.mjs` Phase-8 override block** is a single contiguous edit (lines 66–109); deletion is a clean unified-diff hunk per D-10.
- **`CalendarEvent` type** (`src/services/CalendarService.ts`) is already imported and used across views; reusing it for the `generatePreviewPath(event: any)` fix per D-08 is straightforward.
- **`unknown` is the idiomatic TS narrow for type guards** — already a documented pattern in the typescript-eslint guidance the conventions doc will link to. The `isValidCache(cache: unknown)` migration is one-line.
- **CONVENTIONS.md already has a `## TypeScript Usage` section** documenting the four current `any` categories. The new `## Directory Compliance` section sits at the bottom and explicitly supersedes that section's stance on the cosmetic / type-guard / cache `any`s — keep the §TypeScript Usage prose intact for historical context but note "see Directory Compliance for v1.15 rules".

### Established Patterns
- **`MemoChron: ` log prefix** convention (per CONVENTIONS.md §Logging) — applies to the surviving gated logs if any (D-07). Compile-time `DEBUG` const stays consistent: `if (DEBUG) console.log("MemoChron: ...")`.
- **Five-or-six atomic commits, mechanical first, docs last** — Phase 6 D-16 / Phase 7 D-11 precedent; D-05 mirrors directly.
- **Per-line `eslint-disable-next-line` with rationale comment** (vs global rule override) — emerging pattern in v1.15 for intentional, documented anti-patterns (D-08 `window.moment` case). This codifies a new "intentional escape hatch" convention; CONVENTIONS.md §Directory Compliance should call it out explicitly so future contributors know when it's OK.
- **No new test files in this milestone** (REQUIREMENTS.md Out of Scope) — Phase 8 conformance is verified by lint + build + smoke test, not unit tests.

### Integration Points
- **`.planning/codebase/CONVENTIONS.md` is consumed by `gsd-pattern-mapper` and `gsd-planner` agents** as the source-of-truth for pattern conventions in this repo. The new `## Directory Compliance` section is automatically picked up by future plan-phase runs — no additional wiring needed.
- **`CLAUDE.md` is loaded into every session's context** automatically (per the harness). The pointer section in D-04 is therefore the entry point for any Claude session that touches MemoChron code post-v1.15.
- **`eslint.config.mjs` is the lint gate** (DOC-01, Phase 5). Adding the `**/*.d.ts` `no-explicit-any` exclusion is a one-line addition; deleting the Phase-8 override block is a single 44-line delete (lines 66–109).
- **Commit message hygiene** — every commit in this phase MUST omit any Claude / AI references per `CLAUDE.md` "Memory Reminders" and v1.14.0 commit precedent. The convention is enforced socially today; consider whether DOC-02 should mention it (probably no — it's a project-meta rule, not a directory-compliance rule).

</code_context>

<specifics>
## Specific Ideas

- **Source-of-truth verification per Phase 7 A1/A2 precedent.** When the researcher resolves each rule's canonical `Docs:` URL for the do/don't blocks, the researcher reads the actual `eslint-plugin-obsidianmd` source files (`node_modules/eslint-plugin-obsidianmd/dist/lib/rules/*.js`) where the auto-fix shape matters, not just the README. Phase 7 caught two CONTEXT.md decisions that contradicted the auto-fix direction; Phase 8 has fewer rules in play but the same "verify before locking" discipline applies.
- **Four-line do/don't block format with `Don't:` / `Do:` / `Why:` / `Docs:` lines.** Locked by D-03. Cluster intros are one sentence (not paragraphs).
- **Group by rule cluster, not by DIR-NN.** Locked by D-02. Reads like a developer guide, not a checklist.
- **CLAUDE.md TODO block is stale and is being replaced, not augmented.** D-04 is explicit about this — most of the high/medium/low-priority items shipped through v1.14.0 / v1.15. The replacement section is shorter and points at the canonical doc.
- **Compile-time `DEBUG` const, not a setting toggle.** D-07 default. Tree-shake-friendly and no UI burden.
- **`**/*.d.ts` exclusion for `no-explicit-any` is the cheapest correct close for the 6 ambient sites.** D-08. The success-criterion wording explicitly allows ambient `.d.ts` exclusion via config; hand-typing `ical.js` is multi-day work not justified by this milestone's goals.

</specifics>

<deferred>
## Deferred Ideas

- **FRAG-01: `window.moment` utility wrapper** (REQUIREMENTS.md v2) — D-08 keeps the `(window as any).moment` cast at 5 sites with per-line `eslint-disable-next-line` + rationale, intentional pattern. The utility wrapper is deferred to a future fragility milestone.
- **FRAG-02: `jCal[2]` → `VALUE=DATE` parameter check** (REQUIREMENTS.md v2) — D-08 narrows the cast type only; the full migration to RFC 5545 `VALUE=DATE` detection is deferred.
- **Hand-typing `ical.js` API in `ical.d.ts`** — multi-day rabbit hole, library lacks bundled types, not justified by this milestone. D-08 closes via lint config exclusion.
- **Runtime debug-log toggle setting** — would need UI, persistence, validation, settings-migration. Compile-time const (D-07) is sufficient for the dev-forensics use case.
- **Mobile UAT** — deferred to v1.16 per Phase 6 D-15 / Phase 7 D-13 precedent. If a v1.15 release triggers a mobile regression report, it gets its own phase.
- **Refactoring CalendarService.ts's 15 console sites into a structured logger** — out of scope; D-07 default is delete-or-gate at the existing sites, not introduce a new logging abstraction.
- **Cosmetic README / changelog / image overhauls** (PROJECT.md Out of Scope) — not flagged by the scorecard; deferred to a marketing pass.
- **CalDAV (#30), Apple Calendar real-time (#37), bulk import (#38), locale (#56), template-file (#56), Outlook attendees (#56)** — all v2 features, untouched by Phase 8.

</deferred>

---

*Phase: 08-type-hygiene-conventions*
*Context gathered: 2026-05-16*
