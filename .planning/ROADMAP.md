# Roadmap: MemoChron

> **Phase numbering is monotonic across milestones.** Phases 01–04 belong to v1.14.0 (Stabilization) and Phases 05–08 to v1.15 (Directory Compliance, shipped as 1.15.0); both are preserved below as collapsed historical entries. Phases 09+ are the active v1.16 (Issue Sweep) work. Do not renumber or reuse 01–08.

## Milestones

- ✅ **v1.14.0 Stabilization** — Phases 01–04 (shipped 2026-05-12)
- ✅ **v1.15 Directory Compliance** — Phases 05–08 (shipped 2026-05-17 as 1.15.0)
- 🚧 **v1.16 Issue Sweep** — Phases 09–11 (in progress)

## Overview

**v1.14.0 (shipped 2026-05-12)** took MemoChron from v1.13.1 through four phases of internal hygiene, security hardening, date-parsing correctness, and UX enhancements.

**v1.15 (shipped 2026-05-17 as 1.15.0)** closed every Obsidian community-plugin Review scorecard finding and installed the ESLint + CI lint gate (`npm run lint`) that keeps them from regrowing.

**v1.16 Issue Sweep (active)** closes the four open user-reported GitHub issues against 1.15.0: #61 (calendar tags emit a duplicate `tags` key when the default frontmatter already has one), #63 (new `{{week}}`, `{{dd}}`, `{{d}}`, `{{year}}` template variables), #62 (a newly created event note does not take focus when Obsidian's "Always focus new tabs" is off, which makes `{{cursor}}` useless), and #54 (the sidebar calendar's view mode resets on restart). Three phases: the two `NoteService` content fixes travel together because they share a file and the title/template/frontmatter substitution path; the focus behavior is its own phase because it touches different code (the note-open paths in the views plus a new setting); and the final phase lands the view-mode persistence fix together with the README/settings documentation and the GitHub issue closure, so the docs describe what actually shipped. All work must pass the v1.15 `npm run lint` CI gate and follow `## Directory Compliance` in `.planning/codebase/CONVENTIONS.md`. There is still no test suite, so verification is manual UAT.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3, …): Planned milestone work
- Decimal phases (9.1, 9.2, …): Urgent insertions (marked with INSERTED)
- Numbering is monotonic across milestones (never restarts).

<details>
<summary>✅ v1.14.0 Stabilization (Phases 01–04) — SHIPPED 2026-05-12</summary>

- [x] **Phase 1: Foundation** — Lifecycle hygiene, settings propagation, dead-code removal
- [x] **Phase 2: Security & Correctness** — Color validation hardened, consistent error handling, three standalone bugs fixed
- [x] **Phase 3: Date Parsing & Navigation Bugs** — BUG-01 date-fix plus related navigation/concurrency/format-verification bugs
- [x] **Phase 4: UX Enhancements** — Today indicator, note-exists markers, NL date format, named template variables, cursor placement

### Phase 1: Foundation

**Goal**: Plugin does not leak resources on unload, does not crash on iOS from untracked timers or drag listeners, and reads live settings in both services — with dead code removed
**Depends on**: Nothing (first phase)
**Requirements**: TD-01, TD-02, TD-03, TD-04, CLEAN-01
**Plans**: 10/10 complete
**Status**: Complete (2026-05-10)

### Phase 2: Security & Correctness

**Goal**: Plugin loads cleanly even with corrupted or malicious color values in saved settings, every catch block emits a meaningful message, and three small standalone bugs are resolved
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, BUG-05, BUG-06
**Plans**: 5/5 complete
**Status**: Complete (2026-05-11)

### Phase 3: Date Parsing & Navigation Bugs

**Goal**: Daily-note filenames in non-UTC timezones map to the correct local calendar day; month/week navigation is instantaneous; drag-resize view-mode sync correct; BUG-04 closed
**Depends on**: Phase 2
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04
**Plans**: 3/3 complete
**Status**: Complete (2026-05-12)

### Phase 4: UX Enhancements

**Goal**: Today clearly distinct from selected day; agenda/grid note-exists indicators; NL date format; named template variables; cursor placement
**Depends on**: Phase 3
**Requirements**: ENH-01, ENH-02, ENH-03, ENH-04, ENH-05, ENH-06
**Plans**: 5/5 complete
**Status**: Complete (2026-05-12)

</details>

<details>
<summary>✅ v1.15 Directory Compliance (Phases 05–08) — SHIPPED 2026-05-17 as 1.15.0</summary>

Full phase details: `.planning/milestones/v1.15-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.15-phases/`.

- [x] **Phase 5: Guardrails & Trivial Fixes** — ESLint + CI lint gate installed first; manifest punctuation and release artifact attestation
- [x] **Phase 6: DOM API Refactor** — `innerHTML`/`outerHTML`, inline `style.*`, and raw `document.createElement` replaced with Obsidian's typed DOM helpers
- [x] **Phase 7: Lifecycle & Compatibility** — View-in-`registerView` leak removed, popout-window helpers, `instanceof TFile` narrowing, floating promises classified, BUG-07 closed
- [x] **Phase 8: Type Hygiene & Conventions** — Console logging removed/gated, `any`/unused-var cleanup, Directory Compliance conventions documented

### Phase 5: Guardrails & Trivial Fixes

**Goal**: ESLint configuration and CI lint gate running before any code-touching phase; `manifest.json` description punctuation and GitHub release artifact attestation landed up front
**Depends on**: Nothing (first phase of v1.15)
**Requirements**: DOC-01, DIR-11, DIR-12
**Plans**: 4/4 complete
**Status**: Complete (2026-05-13)

### Phase 6: DOM API Refactor

**Goal**: View layer constructs DOM exclusively through `createEl` / `createDiv` / `setText` / `setCssProps`; dynamic styling via CSS classes or `setCssProps`; Phase 5 ESLint overrides for these rules removed
**Depends on**: Phase 5
**Requirements**: DIR-02, DIR-03, DIR-04
**Plans**: 5/5 complete
**Status**: Complete (2026-05-14)

### Phase 7: Lifecycle & Compatibility

**Goal**: Every directory finding rooted in Obsidian's view-lifecycle and runtime-context contracts closed; BUG-07 closed with a documented Obsidian-side root cause
**Depends on**: Phase 6
**Requirements**: DIR-05, DIR-06, DIR-07, DIR-08, BUG-07
**Plans**: 7/7 complete
**Status**: Complete (2026-05-16)

### Phase 8: Type Hygiene & Conventions

**Goal**: Console logging, TypeScript hygiene, and unused-var findings closed; remaining ESLint overrides removed; `CLAUDE.md` + `.planning/codebase/CONVENTIONS.md` carry the Directory Compliance do/don't section
**Depends on**: Phase 7
**Requirements**: DIR-01, DIR-09, DIR-10, DOC-02
**Plans**: 5/5 complete
**Status**: Complete (2026-05-17)

</details>

### 🚧 v1.16 Issue Sweep (In Progress)

**Milestone Goal:** Close GitHub issues #61, #62, #63, and #54 so every outstanding user report against 1.15.0 is resolved.

- [ ] **Phase 9: Event Note Content** — Calendar tags merge into an existing frontmatter `tags` key (#61); `{{week}}`, `{{dd}}`, `{{d}}`, `{{year}}` template variables (#63)
- [ ] **Phase 10: Focus New Event Note** — "Focus new event note" setting (default ON) so a newly created note opens focused and `{{cursor}}` is immediately usable (#62)
- [ ] **Phase 11: View Mode Persistence & Issue Closure** — Sidebar calendar view mode survives restart and reopen, BUG-02/03 re-verified (#54); v1.16 additions documented; all four issues closed at release

## Phase Details

### Phase 9: Event Note Content

**Goal**: Event notes created from any calendar carry exactly one `tags` property, with the calendar's tags merged into whatever the user's default frontmatter already declares. Note titles, templates, and frontmatter can use the ISO week number, the padded and unpadded day of month, and the calendar year (#61, #63). Both issues live in `NoteService` (`generateFrontmatter` and `getEventTemplateVariables`) and share the title/template/frontmatter substitution path, so they ship together.
**Depends on**: Nothing within v1.16 (builds on the 1.15.0 baseline)
**Requirements**: BUG-08, BUG-09, ENH-09, ENH-10, ENH-11, ENH-12
**Success Criteria** (what must be TRUE):

  1. A user's default frontmatter (global or per-calendar) already declares `tags` as a block list (`tags:` followed by `  - a` lines), an inline array (`tags: [a, b]`), or a scalar (`tags: a`). When they create an event note from a tagged calendar, the note has exactly one `tags` key holding their original tags plus the calendar's tags, each listed once, and Obsidian's Properties panel shows it with no duplicate-key or YAML error
  2. In that note, every other frontmatter key the user wrote keeps its original order and value. If the default frontmatter has no `tags` key, the created note's frontmatter is identical to what 1.15.0 produced
  3. For an event starting Monday 2026-05-04, `{{week}}` renders `19`, `{{dd}}` renders `04`, `{{d}}` renders `4`, and `{{year}}` renders `2026`. For an event starting Friday 2027-01-01, `{{week}}` renders `53` (ISO week) and `{{year}}` renders `2027` (calendar year, not the ISO week-year `2026`)
  4. The four new variables resolve in the note title format (the resulting filename is sanitized and valid), in the note template body, and in default frontmatter. A template that places `{{d}}`, `{{dd}}`, and `{{date}}` side by side renders all three correctly, with no partial or cross-substitution

**Plans**: 2/2 plans executed

Plans:
**Wave 1**
- [x] 09-01-PLAN.md — `{{week}}`/`{{dd}}`/`{{d}}`/`{{year}}` template variables end-to-end, plus the `verify-09.mjs` harness (real NoteService via esbuild, 4 timezones, 1.15.0 parity) (ENH-09..ENH-12)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 09-02-PLAN.md — Calendar tags merged in place into an existing `tags` key (block/inline/scalar), deduped, unsafe shapes untouched, no-key path byte-identical to 1.15.0 (BUG-08, BUG-09)

### Phase 10: Focus New Event Note

**Goal**: Creating an event note puts the user straight into that note's editor, ready to type at the `{{cursor}}` marker, even when Obsidian's global "Always focus new tabs" option is off (#62). It is a separate phase because it touches different code from Phase 9: the note-open paths in `CalendarView` (~L932) and `EmbeddedAgendaView` (~L422), both currently `getLeaf("tab")`, plus a new plugin setting.
**Depends on**: Nothing within v1.16 (independent of Phase 9, so the two can be executed in parallel)
**Requirements**: ENH-07, ENH-08
**Success Criteria** (what must be TRUE):

  1. The settings tab shows a "Focus new event note" toggle. It is ON for fresh installs and for users upgrading from 1.15.0 who have no saved value
  2. With the toggle ON and Obsidian's "Always focus new tabs" OFF, creating an event note from the sidebar calendar/agenda or from an embedded agenda code block opens it in the active, focused tab, on both desktop and mobile
  3. With the toggle ON and a note template containing `{{cursor}}`, the user can type as soon as the note opens and the text lands where the marker was, with the marker removed
  4. With the toggle OFF, creating an event note behaves exactly as in 1.15.0: whether the new tab takes focus follows Obsidian's global setting

**Plans**: TBD
**UI hint**: yes

### Phase 11: View Mode Persistence & Issue Closure

**Goal**: The sidebar calendar reopens in the view mode the user left it in. The v1.14 navigation and drag-resize fixes are confirmed to still hold, so #54 can close. The README and settings help describe everything v1.16 added, and all four issues are ready to close with the release. Docs and issue closure land last so they describe what actually shipped.
**Depends on**: Phase 9, Phase 10 (DOC-03 documents their variables and setting; ISSUE-01 needs all four fixes in the release)
**Requirements**: BUG-10, BUG-11, DOC-03, ISSUE-01
**Success Criteria** (what must be TRUE):

  1. A user sets the sidebar calendar to Month or any 1–N week mode, using either the view-mode dropdown or drag-resize. The same mode is shown after restarting Obsidian, and again after closing the calendar view and reopening it from the ribbon or command palette
  2. On both 1.15.0 and the v1.16 build (after the persistence change):
     - rapid month/week arrow navigation stays instant, with no lag or skipped renders
     - drag-resizing keeps the view-mode dropdown in sync with the visible grid
     - Today recenters from any month or week offset

     The BUG-02/BUG-03 re-verification result is recorded
  3. The README and the settings-tab help text for note title format and note template list `{{week}}`, `{{dd}}`, `{{d}}`, and `{{year}}`, and both describe the "Focus new event note" setting and its default
  4. Each of #61, #62, #63, and #54 has a closing comment that names the release containing its fix. Comments are posted and issues closed only after the user confirms at release time

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 (v1.14.0, shipped) → 5 → 6 → 7 → 8 (v1.15, shipped) → 9 → 10 → 11 (v1.16, active). Phases 9 and 10 are independent and may run in parallel; Phase 11 depends on both.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.14.0 | 10/10 | Complete | 2026-05-10 |
| 2. Security & Correctness | v1.14.0 | 5/5 | Complete | 2026-05-11 |
| 3. Date Parsing & Navigation Bugs | v1.14.0 | 3/3 | Complete | 2026-05-12 |
| 4. UX Enhancements | v1.14.0 | 5/5 | Complete | 2026-05-12 |
| 5. Guardrails & Trivial Fixes | v1.15 | 4/4 | Complete | 2026-05-13 |
| 6. DOM API Refactor | v1.15 | 5/5 | Complete | 2026-05-14 |
| 7. Lifecycle & Compatibility | v1.15 | 7/7 | Complete | 2026-05-16 |
| 8. Type Hygiene & Conventions | v1.15 | 5/5 | Complete | 2026-05-17 |
| 9. Event Note Content | v1.16 | 2/2 | In Progress | - |
| 10. Focus New Event Note | v1.16 | 0/TBD | Not started | - |
| 11. View Mode Persistence & Issue Closure | v1.16 | 0/TBD | Not started | - |
