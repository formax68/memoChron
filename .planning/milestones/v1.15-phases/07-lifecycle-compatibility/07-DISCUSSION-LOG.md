# Phase 7: Lifecycle & Compatibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 7-lifecycle-compatibility
**Areas discussed:** Commit granularity, UAT scope

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| DIR-05 view access + BUG-07 | Helper-getter vs inline workspace lookup for the 5 callsites; BUG-07 root-cause path | |
| DIR-06 activeDocument/activeWindow | Globals vs `this.app.workspace.activeWindow`; colorValidation.ts edge case; plugin-context timers | |
| DIR-08 floating-promise + MarkdownRenderChild | `void` vs `.catch` vs `await` per site; sync wrapper for async lifecycle | |
| Commit granularity + UAT scope | Per-requirement vs grouped commits; UAT walkthrough scope (popout, plugin-toggle, mobile) | ✓ |

**User's choice:** Commit granularity + UAT scope only.
**Notes:** The other three areas were delegated to Claude's discretion. They are mechanical with established phase-6 patterns and Obsidian-recommended fixes. Locked in CONTEXT.md `<decisions>` (D-01..D-10) and reflected in the "Claude's Discretion" subsection.

---

## Commit granularity

### Q1 — DIR-05 + BUG-07 commit pairing

| Option | Description | Selected |
|--------|-------------|----------|
| Same commit if fix falls out, else split | Implement DIR-05; if BUG-07 closes as side effect, fold into same commit. Otherwise BUG-07 closes via separate `docs(07): close BUG-07 with Obsidian-side root cause note` commit. | ✓ |
| Always split | Keep DIR-05 (code) and BUG-07 (verification or closure) in separate commits regardless. | |
| Always bundled | Single commit either way; closure note inside commit body if needed. | |

**User's choice:** Same commit if fix falls out, else split.

### Q2 — DIR-07 + DIR-08 commit pairing

| Option | Description | Selected |
|--------|-------------|----------|
| Separate commits | DIR-07 (4 sites, ~10 lines) and DIR-08 (27 sites + 2 async lifecycle rewrites) in distinct commits. Keeps DIR-08's larger diff isolated for review. | ✓ |
| Single typescript-hygiene commit | One combined commit `refactor(views): TypeScript hygiene — TFile narrowing and promise discipline`. | |
| Split DIR-08 itself | DIR-07 separate; DIR-08 split into MarkdownRenderChild lifecycle commit + void/.catch annotation commit. | |

**User's choice:** Separate commits.

### Q3 — DIR-06 splitting

| Option | Description | Selected |
|--------|-------------|----------|
| Single DIR-06 commit | Both `prefer-active-doc` (14 sites) and `prefer-window-timers` (4 sites) in one commit; shares "workspace-aware runtime context" rationale. | ✓ |
| Split active-doc vs timers | Separate commit per rule, so the 4-site timer change can land independently of the 14 read sites. | |

**User's choice:** Single DIR-06 commit.

### Q4 — Commit order

| Option | Description | Selected |
|--------|-------------|----------|
| DIR-05/BUG-07 → 06 → 07 → 08 | Lifecycle root cause first (highest risk + possibly closes BUG-07), then runtime-context, then mechanical type narrowing, then promise hygiene (largest diff). Each step de-risks the next. | ✓ |
| Smallest diff first | DIR-07 → DIR-05 → DIR-06 → DIR-08. Each commit grows blast radius. | |
| Roadmap order | Order from REQUIREMENTS.md / success criteria. No re-ordering. | |

**User's choice:** DIR-05/BUG-07 → 06 → 07 → 08.

---

## UAT scope

### Q5 — Popout window walkthrough depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full popout walkthrough | Render, navigate, drag-resize, wait for one auto-refresh fire. Covers all DIR-06 surfaces. | ✓ |
| Basic popout check | Open popout, confirm render + one navigation. Skip drag-resize and timer verification. | |
| Popout + main-window parity | Full popout walkthrough plus side-by-side comparison with main sidebar. | |

**User's choice:** Full popout walkthrough.

### Q6 — BUG-07 closure shape

| Option | Description | Selected |
|--------|-------------|----------|
| Reproduction + Obsidian-version evidence | Capture steps, Obsidian version, OS; test against current Obsidian Insider build; commit closure note at `.planning/phases/07-*/BUG-07-CLOSURE.md`. | ✓ |
| Reproduction only | Steps + version; skip cross-version verification. | |
| Reproduction + linked issue | Reproduction + version + forum-search for upstream issue link. | |

**User's choice:** Reproduction + Obsidian-version evidence.

### Q7 — DIR-07 daily-note UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Add daily-note open step | Click an event in agenda, confirm daily note opens; repeat for embedded calendar + embedded agenda. Covers all 3 `instanceof TFile` openFile sites. | ✓ |
| Trust lint + types | `instanceof TFile` is type-safe by construction; no extra UAT step. | |

**User's choice:** Add daily-note open step.

### Q8 — Mobile UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Defer mobile to v1.16 | Phase 7 adds no new CSS; runtime-only changes; mobile globals point to the same window/document. Note "Desktop-only; mobile audit deferred to v1.16 if regression reported." | ✓ |
| Add mobile smoke check | Full walkthrough on Obsidian mobile. | |
| Mobile critical paths only | Mobile UAT covers daily-note open only. | |

**User's choice:** Defer mobile to v1.16.

### Q9 — Continue or write CONTEXT

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Lock remaining areas at Claude's discretion, write CONTEXT.md. | ✓ |
| More UAT questions | Continue with another UAT question. | |
| Explore more gray areas | Open one of the three deferred areas for discussion. | |

**User's choice:** Ready for context.

---

## Claude's Discretion

Three areas delegated to Claude's judgment, locked in CONTEXT.md `<decisions>`:

- **DIR-05 view access pattern (D-01..D-03):** add a `getCalendarView(): CalendarView | null` helper on the plugin class using `instanceof CalendarView` narrowing; delete the `calendarView` field; the 5 callsites in `main.ts:167–188` call the helper.
- **DIR-06 active-doc/active-window source (D-04..D-07):** use the Obsidian globals `activeDocument` and `activeWindow` directly (not `this.app.workspace.activeWindow`); apply to all 14 read sites + 4 timer sites including plugin-context timers in `main.ts:202, 227` and the no-plugin-reference file `colorValidation.ts:46`.
- **DIR-08 floating-promise policy + MarkdownRenderChild lifecycle (D-09..D-10):** three-bucket classification (`void` / `.catch(error => new Notice(errorMessage(error)))` / `await`) with `.catch` as the default for ambiguous sites; convert `async onload()` in EmbeddedCalendarView/EmbeddedAgendaView to sync wrappers calling an inner `initialize()` async helper.

Plus the smaller in-decision discretion items: helper-method name, inner-async helper name, per-site DIR-08 bucket assignment, whether to share a tiny `readAccentColor()` helper across the 14 `getComputedStyle` sites, and the exact shape of `BUG-07-CLOSURE.md` if it's needed.

## Deferred Ideas

None new from this discussion beyond what was already captured in CONTEXT.md `<deferred>`. The discussion stayed within phase scope; no scope-creep redirections.
