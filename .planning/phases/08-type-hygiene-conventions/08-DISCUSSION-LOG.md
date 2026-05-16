# Phase 8: Type Hygiene & Conventions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 08-type-hygiene-conventions
**Areas discussed:** DOC-02 conventions document shape

The other three identified gray areas — DIR-01 console policy, DIR-09 `any` strategy across categories, commit/UAT ordering — were declined by the user and routed to Claude's Discretion in CONTEXT.md with documented sensible defaults.

---

## Gray Area Selection

**Question:** Which areas do you want to discuss for Phase 8?

| Option | Description | Selected |
|--------|-------------|----------|
| Console-logging policy (DIR-01) | Pure delete vs gate behind a developer debug flag; mechanism if gated. 39 sites. | |
| `any` strategy across categories (DIR-09) | ical.d.ts ambient, `window.moment`, `jCal`, type-guard `cache: any`, cosmetic any. | |
| DOC-02 conventions document shape | Placement, structure, format, CLAUDE.md anchor. | ✓ |
| Commit ordering & UAT scope | Atomic commit groupings + manual UAT requirement (if any). | |

**User's choice:** DOC-02 conventions document shape
**Notes:** User declined to discuss DIR-01, DIR-09, and commit/UAT explicitly — those are routed to Claude's Discretion with documented defaults in CONTEXT.md `<decisions>`.

---

## DOC-02 conventions document shape

### Q1 — Placement

**Question:** Where should the "Directory Compliance" do/don't section live? Success criterion #5 names both files; the question is duplication vs single-source.

| Option | Description | Selected |
|--------|-------------|----------|
| Canonical in CONVENTIONS.md; CLAUDE.md links to it | Single source of truth in `.planning/codebase/CONVENTIONS.md`; CLAUDE.md has a short pointer. No drift. | ✓ |
| Canonical in CLAUDE.md; CONVENTIONS.md links to it | Full list in CLAUDE.md (loaded every session); CONVENTIONS.md gets a pointer. | |
| Full duplication in both files | Same content copy-pasted into both. Maximum discoverability, drift risk. | |
| Single combined file; deprecate the other | Pick one file, move all conventions content there. | |

**User's choice:** Canonical in CONVENTIONS.md; CLAUDE.md links to it
**Notes:** Locked as D-01. Codebase convention doc is the natural home; CLAUDE.md gets a pointer section.

---

### Q2 — Structure

**Question:** How should the do/don't rules be organized inside CONVENTIONS.md?

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by rule cluster | Four sections (DOM API / Lifecycle & Compatibility / Type Hygiene / Release & Docs). Reads like a developer guide. | ✓ |
| One rule per scorecard finding (literal) | 12 numbered subsections, one per DIR-NN, scorecard order. Reads like a checklist. | |
| Flat alphabetical / topic-tagged | One flat list ordered alphabetically by topic, tagged with DIR-NN code. | |

**User's choice:** Grouped by rule cluster
**Notes:** Locked as D-02. Four clusters: DOM API (DIR-02/03/04), Lifecycle & Compatibility (DIR-05/06/07/08), Type Hygiene (DIR-01/09/10), Release & Docs (DIR-11/12, DOC-01).

---

### Q3 — Format

**Question:** What format should each rule take? Success criterion #5 says "one short rule per finding, each with a one-line rationale and a link to the relevant Obsidian docs page."

| Option | Description | Selected |
|--------|-------------|----------|
| Do/don't pair + rationale + docs link | Four-line block per rule: `Don't:` / `Do:` / `Why:` / `Docs:`. | ✓ |
| Compact one-liner with inline link | Single bullet per rule with inline docs link. Densest format. | |
| Full code example per rule | Do/don't with before/after code block per rule. Maximally pedagogical, doubles file length. | |

**User's choice:** Do/don't pair + rationale + docs link
**Notes:** Locked as D-03. Matches success-criterion-#5 wording verbatim. No full code blocks per rule (call sites already show compliant pattern post-v1.15).

---

### Q4 — CLAUDE.md anchor

**Question:** How should `CLAUDE.md` reference the canonical conventions doc?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace TODO list with link + short summary | Existing `## TODO: Code Quality Issues to Address` block is stale; replace with `## Directory Compliance` section that links to CONVENTIONS.md and names each cluster. | ✓ |
| Add a new section; leave the old TODO list intact | Add a new section, leave stale content. Smallest delta. | |
| Minimal pointer only | One-line entry under an existing section. Maximally terse. | |

**User's choice:** Replace TODO list with link + short summary
**Notes:** Locked as D-04. The existing TODO block is stale (most items shipped in v1.14.0 / v1.15). Replacement section names each cluster in a one-line index, preserves Memory Reminders and Beta Release Strategy.

---

### Q5 — Close-out check

**Question:** We've discussed DOC-02 conventions doc shape (placement, structure, format, CLAUDE.md anchor). Anything else you want to lock in before I write CONTEXT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | Write CONTEXT.md now with Claude's Discretion defaults for the other three areas. | ✓ |
| Discuss DIR-01 console policy | Lock delete-vs-gate and the flag mechanism. | |
| Discuss DIR-09 `any` strategy | Lock per-category treatment. | |
| Discuss commit/UAT ordering | Lock atomic-commit groupings and UAT requirement. | |

**User's choice:** I'm ready for context
**Notes:** User accepted Claude's Discretion for DIR-01 (delete-by-default; gate via compile-time const where forensic-useful), DIR-09 (lint-exclude `.d.ts`, keep `window.moment` cast with per-line eslint-disable, narrow `jCal` and `cache: any` assertions, real types for cosmetic), DIR-10 (pure deletion), commits (5–6 atomic per cluster + override-delete + DOC-02 last), UAT (lint + build + 60-second smoke, no formal HUMAN-UAT.md).

---

## Claude's Discretion

**Decisions delegated to researcher/planner with documented defaults:**

- **DIR-01 console policy (D-07):** default = pure deletion at every site; selective re-wrapping under a compile-time `DEBUG = false` const at the top of the file is acceptable for genuinely-useful forensic logs. Compile-time over runtime setting because: no UI burden, tree-shake-friendly, simple.
- **DIR-09 per-category default treatment (D-08):**
  - `ical.d.ts` ambient (6 sites): close via `**/*.d.ts` exclusion in `eslint.config.mjs` (success criterion #2 explicitly allows ambient exclusion via config)
  - `(window as any).moment` (5 sites): keep as documented pattern with per-line `eslint-disable-next-line` + rationale comment
  - `(dtstart as any).jCal` (2 sites): narrow to typed assertion (`{ jCal: unknown[] }`)
  - `isValidCache(cache: any)` (1 site): migrate to `cache: unknown`
  - Cosmetic `value: any` / `event: any` (2 sites): replace with real types (`ical.Time`, `CalendarEvent`)
- **DIR-10 unused vars (D-09):** pure deletion; `catch { ... }` (no binding) where the catch binding is genuinely unused
- **Commit ordering (D-05):** 5–6 atomic commits — DIR-10 → DIR-09 → DIR-01 → override-delete → DOC-02 (closing). Optional UAT commit if planner judges it adds value.
- **UAT scope (D-06):** no formal HUMAN-UAT.md; `npm run lint` clean + `npm run build` clean + 60-second smoke test (sidebar opens, event click creates note, settings renders) recorded in closing commit body.
- **Compile-time `DEBUG` const placement:** per-file default; shared `src/utils/debug.ts` if 3+ files end up gated.
- **Exact docs URLs per rule** in the do/don't blocks: researcher resolves at planning time via Obsidian docs site + `eslint-plugin-obsidianmd` rule source files (Phase 7 A1/A2 source-of-truth verification precedent).
- **"Verifying compliance" subsection** at the bottom of CONVENTIONS.md §Directory Compliance: default yes; planner skips if it bloats the section.
- **`~21` figure in goal statement**: actual count is 18 per live ESLint; closing commit body notes the correction.

---

## Deferred Ideas

- **FRAG-01: `window.moment` utility wrapper** — kept as documented intentional `any` pattern; full wrapper deferred to future fragility milestone (REQUIREMENTS.md v2).
- **FRAG-02: `jCal[2]` → `VALUE=DATE` parameter check** — narrow cast type only; full RFC 5545 migration deferred.
- **Hand-typing `ical.js` API** — multi-day rabbit hole; library lacks bundled types; closed via lint config exclusion instead.
- **Runtime debug-log toggle setting** — would need UI, persistence, validation. Compile-time const is sufficient for the dev-forensics use case.
- **Mobile UAT** — deferred to v1.16 per Phase 6/7 precedent.
- **Refactoring CalendarService.ts's 15 console sites into a structured logger** — out of scope; delete-or-gate, not refactor.
- **CalDAV (#30), Apple Calendar real-time (#37), bulk import (#38), locale (#56), template-file (#56), Outlook attendees (#56)** — all v2 features, untouched by Phase 8.
