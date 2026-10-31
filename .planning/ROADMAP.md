# Roadmap: MemoChron

> **Phase numbering is monotonic across milestones.** Phases 01–04 belong to the prior v1.14.0 (Stabilization) milestone and are preserved below as historical entries. Phases 05+ are the active v1.15 (Directory Compliance) work. Do not renumber or reuse 01–04.

## Milestones

- [x] **v1.14.0 Stabilization** — Phases 01–04 (shipped 2026-05-12)
- [ ] **v1.15 Directory Compliance** — Phases 05–08 (active)

## Overview

**v1.14.0 (shipped 2026-05-12)** took MemoChron from v1.13.1 through four phases of internal hygiene, security hardening, date-parsing correctness, and UX enhancements.

**v1.15 (active)** is a compliance milestone. The Obsidian community-plugin Review scorecard for v1.13.1 currently reads **"Risks" (1/4)**, driven by a long list of guideline violations. v1.15 closes every finding in one pass *and* installs lint/CI guardrails so the same issues cannot regrow on future feature work. Four phases — Guardrails first (so the rules are enforced while the rest of the milestone runs), then the big mechanical DOM-API refactor, then lifecycle/compatibility fixes plus the open settings-modal bug, then type/code hygiene closed out with the conventions document — leave the plugin in a state where re-submitting to the directory should flip the badge to "Excellent."

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3, …): Planned milestone work
- Decimal phases (5.1, 5.2, …): Urgent insertions (marked with INSERTED)
- Numbering is monotonic across milestones (never restarts).

### v1.14.0 Stabilization (historical)

- [x] **Phase 1: Foundation** — Lifecycle hygiene, settings propagation, dead-code removal (shipped v1.14.0)
- [x] **Phase 2: Security & Correctness** — Color validation hardened, consistent error handling, three standalone bugs fixed (shipped v1.14.0)
- [x] **Phase 3: Date Parsing & Navigation Bugs** — BUG-01 date-fix plus related navigation/concurrency/format-verification bugs (shipped v1.14.0)
- [x] **Phase 4: UX Enhancements** — Today indicator, note-exists markers, NL date format, named template variables, cursor placement (shipped v1.14.0)

### v1.15 Directory Compliance (active)

- [x] **Phase 5: Guardrails & Trivial Fixes** — Install ESLint + CI lint gate; land DIR-11 manifest punctuation and DIR-12 release attestation so the rest of the milestone runs against enforced rules (completed 2026-05-13)
- [x] **Phase 6: DOM API Refactor** — Replace every `innerHTML`/`outerHTML` write, every `element.style.*` assignment, and every raw `document.createElement` call with Obsidian's `createEl` / `createDiv` / `setText` / `setCssProps` helpers, in one coordinated pass across the view layer (completed 2026-05-14)
- [x] **Phase 7: Lifecycle & Compatibility** — Remove the view-in-`registerView` memory leak, add popout-window helpers, narrow `as TFile` casts via `instanceof`, fix floating promises and `MarkdownRenderChild` return-type mismatches, and resolve BUG-07 (settings modal closes on plugin toggle) (completed 2026-05-16)
- [x] **Phase 8: Type Hygiene & Conventions** — Console logging gated/removed, `any`/`??`/`case`-block/escape-char violations cleaned, ~21 unused vars removed, and `CLAUDE.md` + `.planning/codebase/CONVENTIONS.md` updated so future plans land compliant by default (completed 2026-05-17)
- [x] **Phase 08.1: Address tech debt** — Release prerelease routing, dynamic styles, CSS cleanup and verified planning records (completed 2026-10-30)

## Phase Details

<details>
<summary>✅ Phases 01–04 — v1.14.0 Stabilization (shipped 2026-05-12)</summary>

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

### Phase 5: Guardrails & Trivial Fixes

**Goal**: ESLint configuration installed and running in CI before any code-touching phase begins, so the rules being enforced are the same rules the rest of the milestone is fixing. The two single-line directory findings (`manifest.json` description punctuation, GitHub release artifact attestation) land here because they are independent of everything else and the milestone benefits from removing the trivial findings up front.
**Depends on**: Nothing (first phase of v1.15)
**Requirements**: DOC-01, DIR-11, DIR-12
**Success Criteria** (what must be TRUE):

  1. `npm run lint` exists as a script in `package.json` and exits non-zero when any rule in DOC-01's required list is violated (`no-console`, no `innerHTML`/`outerHTML` writes, no inline `element.style.*`, no `as TFile`, `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`, and the Obsidian-specific rules covered by the scorecard)
  2. A GitHub Actions workflow under `.github/workflows/` runs `npm run lint` on every push and pull request, and a failing lint fails the build
  3. ESLint runs cleanly against the v1.15 starting tree by use of per-file or per-rule overrides whose comments explicitly name the phase that will remove them (Phase 6 for the DOM-API rules, Phase 7 for the lifecycle/promise/cast rules, Phase 8 for the type-hygiene and console rules) — no rule is silently disabled
  4. The `description` field in `manifest.json` ends with `.`, `!`, or `?`
  5. The GitHub release workflow that publishes `manifest.json`, `main.js`, and `styles.css` attaches a GitHub artifact attestation to every release asset (verified by inspecting the workflow YAML and the next pre-release output)

**Plans**: 4/4 plans complete
Plans:

- [x] 05-01-PLAN.md — DIR-11: manifest.json description terminating punctuation
- [x] 05-02-PLAN.md — DIR-12: release workflow artifact attestation (actions/attest-build-provenance@v3)
- [x] 05-03-PLAN.md — DOC-01: ESLint 9 flat config + CI lint gate with phase-tagged overrides
- [x] 05-04-PLAN.md — DIR-12 acceptance: 1.15.0-beta.1 pre-release attestation verified

### Phase 6: DOM API Refactor

**Goal**: Eliminate every directory finding tied to raw DOM construction in one coordinated pass. DIR-02, DIR-03, and DIR-04 are bundled because they touch the same files (`CalendarView.ts`, `EmbeddedCalendarView.ts`, `EmbeddedAgendaView.ts`, `SettingsTab.ts`, `viewRenderers.ts`) and splitting them would double-touch the same lines and produce avoidable merge churn. At phase end, the view layer constructs DOM exclusively through Obsidian's typed helpers, dynamic styling is driven by CSS classes or `setCssProps`, and the ESLint overrides for these rules from Phase 5 are removed.
**Depends on**: Phase 5
**Requirements**: DIR-02, DIR-03, DIR-04
**Success Criteria** (what must be TRUE):

  1. `git ls-files src/ | xargs grep -nE '\.(inner|outer)HTML\s*='` returns zero matches in shipped code
  2. `git ls-files src/ | xargs grep -nE '\.style\.(border|color|cursor|display|fontSize|height|left|margin|marginTop|opacity|padding|position|textAlign|top|width)\s*='` returns zero matches in shipped code (dynamic values use `setCssProps`; static values use CSS classes in `styles.css`)
  3. `git ls-files src/ | xargs grep -n 'document\.createElement'` returns zero matches across views, embedded views, settings tab, and `viewRenderers`; all DOM construction goes through `createEl` / `createDiv` / `createSpan`
  4. The Phase 5 ESLint overrides covering `no-inner-html`, the inline-style rule, and `document.createElement` are removed from `.eslintrc` and `npm run lint` still passes
  5. Manual UAT: opening the sidebar calendar, switching month/week view, opening an embedded calendar code block, and opening the settings tab all render visually identically to the v1.14.0 baseline (no layout, color, or interactivity regressions)

**Plans**: 5/5 plans complete
Plans:

- [x] 06-01-PLAN.md — DIR-02: replace setup-guide innerHTML with createEl + appendText (5 sites in SettingsTab.ts)
- [x] 06-02-PLAN.md — DIR-04: replace document.createElement with createEl for color input (2 sites in SettingsTab.ts)
- [x] 06-03-PLAN.md — DIR-03: replace inline styles with CSS classes and setCssProps across 5 source files + styles.css
- [x] 06-04-PLAN.md — Remove Phase 6 ESLint overrides + resolve obsidianmd/ui/sentence-case (DIR-02/03/04 acceptance)
- [x] 06-05-PLAN.md — Record Phase 6 human UAT (visual parity with v1.14.0)

**UI hint**: yes

### Phase 7: Lifecycle & Compatibility

**Goal**: Close every directory finding rooted in Obsidian's view-lifecycle and runtime-context contracts. The fixes share teardown / context-discovery reasoning, so they travel together. BUG-07 (toggling MemoChron in Community Plugins closes the Settings modal) joins this phase because root-cause analysis points at the same view-lifecycle area — the bug either falls out of DIR-05's fix or is closed with a documented Obsidian-side explanation.
**Depends on**: Phase 6
**Requirements**: DIR-05, DIR-06, DIR-07, DIR-08, BUG-07
**Success Criteria** (what must be TRUE):

  1. The `registerView` callback in `src/main.ts` constructs and returns the `CalendarView` instance directly; `plugin.calendarView = view` no longer occurs inside the callback; consumers fetch the view lazily from the workspace
  2. `git ls-files src/ | xargs grep -nE '(^|[^.a-zA-Z])document\.|window\.set(Timeout|Interval)\b'` audited: every match in a view context uses `activeDocument` / `activeWindow.setTimeout` / `activeWindow.setInterval` (or the workspace-aware equivalent); non-view contexts are documented
  3. `git ls-files src/ | xargs grep -n 'as TFile'` returns zero matches; every consumer of `TAbstractFile` narrows via `instanceof TFile` first
  4. `npm run lint` reports zero `@typescript-eslint/no-floating-promises` violations and zero "Promise-returning override on `MarkdownRenderChild` lifecycle method" findings; the Phase 5 ESLint overrides for these rules are removed
  5. Manual UAT: disabling MemoChron in Obsidian's Community Plugins list does NOT close the Settings modal (or, if root cause is Obsidian-side, a written closure note is committed under `.planning/phases/07-*/` with reproduction steps and Obsidian-version evidence)
  6. Manual UAT: opening the plugin in an Obsidian popout window (right-click pane → "Move to new window") renders the calendar grid correctly, navigation works, and timers continue to fire — verifying DIR-06's `activeDocument` / `activeWindow` adoption

**Plans**: 7/7 plans complete (final commit 7 is conditional on UAT step 3 outcome — 6 plans if BUG-07 falls out of plan 07-01, 7 plans if a closure note is required)
Plans:
**Wave 1**

- [x] 07-01-PLAN.md — DIR-05 + A1: fix view-in-registerView memory leak; remove detachLeavesOfType from onunload (main.ts only)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02-PLAN.md — DIR-06: adopt activeDocument for getComputedStyle reads; add window. prefix for timers (5 source files)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-03-PLAN.md — DIR-07: narrow TAbstractFile via instanceof TFile (4 sites across 3 view files)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 07-04-PLAN.md — DIR-08: classify floating + misused promises into D-09 buckets; sync onload() wrapper on Embedded*View

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 07-05-PLAN.md — Remove Phase 7 ESLint overrides (DIR-05/06/07/08 acceptance)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 07-06-PLAN.md — Record Phase 7 human UAT (6-step walkthrough — popout window, daily-note open paths, settings modal, sidebar parity, embedded views parity, lint clean)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 07-07-PLAN.md — (conditional) Close BUG-07 with Obsidian-side root cause note — only if UAT step 3 FAILS

**UI hint**: yes

### Phase 8: Type Hygiene & Conventions

**Goal**: Close the final cluster of directory findings — console logging, TypeScript hygiene (`any`, nullish-on-LHS-of-`??`, lexical decls in `case`, unnecessary regex escapes), and the 21 named unused vars/imports — and land the conventions document as the closing commit so every rule learned across the milestone is captured for future work. Ending the milestone with DOC-02 (rather than starting with it) guarantees the do/don't list reflects what the code actually does after v1.15 lands, not what was hoped for at planning time.
**Depends on**: Phase 7
**Requirements**: DIR-01, DIR-09, DIR-10, DOC-02
**Success Criteria** (what must be TRUE):

  1. The four sites flagged by the scorecard (`CalendarService.ts:249, 282, 324` and `SettingsTab.ts:1720`) no longer contain `console.*` calls in shipped code; the full source tree is audited and any other `console.*` calls are either removed or gated behind a developer-only debug flag that defaults to `false`
  2. `npm run lint` reports zero `@typescript-eslint/no-explicit-any` violations across `src/` (ambient `.d.ts` shims and any test fixtures excluded by config), zero `no-case-declarations` violations, zero `no-useless-escape` violations, and zero `??` operators with a constant LHS
  3. `npm run lint` reports zero `@typescript-eslint/no-unused-vars` violations; specifically, the 21 names called out by the scorecard (`App`, `CalendarEvent`, `CalendarNotesSettings`, `controls`, `convertTimezone`, `date`, `DateElements`, `DEFAULT_CALENDAR_URLS`, `DropdownComponent`, `e`, `error`, `isNewNote`, `MemoChronSettings`, `Notice`, `plugin`, `Property`, `renderAgendaList`, `target`, `TextAreaComponent`, `TFile`, `title`) are either deleted from source or genuinely consumed
  4. The Phase 5 ESLint overrides for `no-console`, `no-explicit-any`, `no-unused-vars`, `no-case-declarations`, and `no-useless-escape` are removed; `npm run lint` passes against a clean configuration with no per-rule or per-file disables tied to scorecard findings
  5. `CLAUDE.md` and `.planning/codebase/CONVENTIONS.md` carry a "Directory Compliance" do/don't section with one short rule per scorecard finding, each with a one-line rationale and a link to the relevant Obsidian docs page
  6. Milestone-level: a fresh run of the Obsidian community-plugin Review scorecard against the v1.15 main-branch snapshot shows zero remaining "Avoid …" findings from the v1.13.1 report


**Plans**: 5/5 plans complete (4 waves; Plans 04 and 05 land sequentially within Wave 4)
Plans:
**Wave 1**

- [x] 08-01-PLAN.md — DIR-10: delete 18 unused vars/imports + convert 2 unused catch bindings to `catch { }`

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — DIR-09: TypeScript hygiene — 16 `any` sites (5 typed-import `moment` per Amendment A1, 2 jCal shim additions, 1 `unknown` narrowing, 1 `Pick<>`, ambient `.d.ts` lint-exclude), no-case-declarations + no-useless-escape + `??` audit

**Wave 3** *(blocked on Wave 2 completion — overlaps Plan 02's file set, so sequential)*

- [x] 08-03-PLAN.md — DIR-01: delete 33 console sites + gate 6 forensic sites behind `const DEBUG = false` in CalendarService.ts and timezoneUtils.ts

**Wave 4** *(blocked on Wave 2 AND Wave 3 completion)*

- [x] 08-04-PLAN.md — Remove Phase 8 ESLint overrides (DIR-01/09/10 acceptance)
- [x] 08-05-PLAN.md — DOC-02: add Directory Compliance section to CONVENTIONS.md + replace TODO block in CLAUDE.md (closing commit of v1.15)

**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 (v1.14.0, shipped) → 5 → 6 → 7 → 8 (v1.15, active)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.14.0 | 10/10 | Complete | 2026-05-10 |
| 2. Security & Correctness | v1.14.0 | 5/5 | Complete | 2026-05-11 |
| 3. Date Parsing & Navigation Bugs | v1.14.0 | 3/3 | Complete | 2026-05-12 |
| 4. UX Enhancements | v1.14.0 | 5/5 | Complete | 2026-05-12 |
| 5. Guardrails & Trivial Fixes | v1.15 | 4/4 | Complete   | 2026-05-13 |
| 6. DOM API Refactor | v1.15 | 5/5 | Complete   | 2026-05-14 |
| 7. Lifecycle & Compatibility | v1.15 | 7/7 | Complete   | 2026-05-16 |
| 8. Type Hygiene & Conventions | v1.15 | 5/5 | Complete   | 2026-05-17 |
| 08.1. Address tech debt | v1.15 | 3/3 | Complete | 2026-10-30 |

### Phase 08.1: Address tech debt: release prerelease flag, inline styles, CSS cleanup (INSERTED)

**Goal:** Close the v1.15 milestone-audit tech debt before the milestone is archived. Beta tags (`X.Y.Z-beta.N`) publish as non-draft GitHub prereleases that BRAT can install, while stable tags keep the draft flow. The release workflow runs on the same toolchain as the lint gate, with build-provenance attestation intact. Every remaining inline style write in `src/` goes through `setCssProps`. `styles.css` has no dead selectors. The REQUIREMENTS / ROADMAP / STATE / SUMMARY / VERIFICATION records match the verified state of Phases 5–8.
**Requirements**: 05-WR-02, 05-IN-01, W1, 06-WR-02, 06-WR-03, 06-WR-04, I1, W3, BK-01, BK-02, BK-03, BK-04 (item IDs from `.planning/v1.15-MILESTONE-AUDIT.md` `tech_debt`; this phase has no REQUIREMENTS.md IDs. BK-01/02 = 05/06 SUMMARY `requirements-completed` back-fill, BK-03 = 06-VERIFICATION status, BK-04 = ROADMAP progress/checkboxes + STATE counters)
**Depends on:** Phase 8
**Success Criteria** (what must be TRUE):

  1. Pushing a hyphenated tag (e.g. `1.16.0-beta.1`) runs `gh release create … --prerelease` without `--draft`. A plain semver tag still runs `--draft`. The `actions/attest-build-provenance@v3` step for `main.js` / `manifest.json` / `styles.css` still runs before release creation.
  2. `release.yml` uses `actions/checkout@v4`, `actions/setup-node@v4`, Node `20.x` and `npm ci`, with no dependency cache, and its job permissions are unchanged.
  3. `git ls-files src/ | xargs grep -nE '\.style\.'` returns zero matches. Settings color dots and swatches use `setCssProps({ "--memochron-swatch-color": … })`, and agenda colors use `setCssProps({ "--event-color": … })`. `npm run lint && npm run build` exit 0, and colors look unchanged in the settings tab, sidebar agenda and embedded agenda.
  4. `styles.css` has no `calendar-hidden` selector, ends with a newline, and documents `memochron-daily-note` as an intentional theming hook (the class is kept).
  5. REQUIREMENTS.md shows all 15 v1 requirements checked and Complete. ROADMAP shows Phases 5–8 checked and Phase 6 at 5/5 Complete. The 05-01..05-04 and 06-01..06-05 SUMMARYs carry `requirements-completed`. 06-VERIFICATION.md is `passed`.
  6. These audit items are recorded as deferred with reasons: the Nyquist VALIDATION gaps (05–08), I2 (`window.setInterval`), the ical.js `no-unsafe-*` override, the SC6 scorecard re-run, and the BUG-07 Obsidian-side enable-direction.

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 08.1-01-PLAN.md — Release workflow: hyphenated tags publish as BRAT-visible prereleases; checkout/setup-node v4, Node 20.x, npm ci; attestation preserved (05-WR-02, 05-IN-01)
- [x] 08.1-02-PLAN.md — Inline styles → `setCssProps` (`--memochron-swatch-color`, `--event-color`) + styles.css cleanup (stale `calendar-hidden` rules, trailing newline, `memochron-daily-note` hook) (W1, 06-WR-02/03/04, I1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08.1-03-PLAN.md — Milestone records: 05/06 SUMMARY `requirements-completed`, 06-VERIFICATION passed, Phases 5–8 ticked, REQUIREMENTS Complete, STATE counters, CONVENTIONS rules, deferred-item list (W3, BK-01..04)

### Phase 08.2: Close DOC-01 gaps: enforce required lint rules and gate release builds (INSERTED)

**Goal:** Close v1.15 audit blockers B1 and B2 so DOC-01 is genuinely satisfied. Every DOC-01-required violation (any console call outside the debug helper, bare `document` access, warnings, inline rule bypasses) makes `npm run lint` fail, and a failing lint stops the tag-triggered release before build, attestation and publish.
**Requirements**: DOC-01
**Depends on:** Phase 8
**Success Criteria** (what must be TRUE):

  1. Any `console.*` call outside `src/utils/debug.ts`, bare `document` access, lint warning, or inline ESLint directive other than the sentence-case-with-reason form makes `npm run lint` fail.
  2. The six forensic logs use `debugLog`/`debugWarn`/`debugError` in `src/utils/debug.ts`, the single exempt file, and the real tree passes `npm run lint && npm run build`.
  3. `release.yml` runs Install dependencies → Lint → Build plugin → Attest → Create release on Node 20.x with no cache and no `if:` overrides; lint failure skips build, attestation and release. Prerelease/draft routing is unchanged.
  4. DOC-01 is reassigned to Phase 08.2 and re-checked only after 08.2 verification passes. The next real beta tag confirms the live gate (pending human verification).

**Plans:** 3/3 plans executed

Plans:
**Wave 1**

- [x] 08.2-01-PLAN.md — Lint enforcement (B2): `src/utils/debug.ts` helper + six-site migration, console wrapper override with guidelines link, popout/trash rules at error, unused-directive errors, `--max-warnings=0`, `lint:directives` allow-list guard (DOC-01)
**Wave 2** *(blocked on Wave 1 completion — its simulation copies and lints Plan 01's files in the same working tree)*

- [x] 08.2-02-PLAN.md — Release gate (B1): release.yml Install dependencies → Lint → Build plugin, Node 20.x uncached, routing unchanged, local gate simulation (DOC-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08.2-03-PLAN.md — Integrated B1+B2 proof recorded in VALIDATION, CONVENTIONS/CLAUDE.md policy alignment, DOC-01 reopened and retargeted to Phase 08.2 with 05 reopening addendum (DOC-01)
