# Phase 7: Lifecycle & Compatibility - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Close every directory-scorecard finding rooted in Obsidian's view-lifecycle and runtime-context contracts — DIR-05 (view-in-`registerView` memory leak), DIR-06 (popout-window: `activeDocument` / `activeWindow.setTimeout`), DIR-07 (`as TFile` cast removal), DIR-08 (floating promises + `MarkdownRenderChild` lifecycle return types) — plus BUG-07 (settings modal closes on plugin toggle), which shares root-cause territory with DIR-05.

Concrete violation footprint (from `npx eslint` with Phase-7 overrides disabled):
- `obsidianmd/no-view-references-in-plugin`: **1 site** — `src/main.ts:47` (`plugin.calendarView = view` inside the `registerView` callback)
- `obsidianmd/detach-leaves`: 1 site (companion to DIR-05; teardown counterpart)
- `obsidianmd/no-tfile-tfolder-cast`: **4 sites** — `CalendarView.ts:148, 828`; `EmbeddedCalendarView.ts:234`; `EmbeddedAgendaView.ts:383`
- `obsidianmd/prefer-active-doc`: **14 sites** — all the `getComputedStyle(document.documentElement)` reads across `SettingsTab.ts` (×6), `CalendarView.ts` (×2), `EmbeddedAgendaView.ts` (×1), `viewRenderers.ts` (×1), `colorValidation.ts` (×1), plus three more in SettingsTab
- `obsidianmd/prefer-window-timers`: **4 sites** — `main.ts:202` (auto-refresh `setInterval`), `main.ts:227` (background-refresh `setTimeout`), `CalendarView.ts:79` (startup timer), `SettingsTab.ts:1381, 1783` (2 sites)
- `@typescript-eslint/no-floating-promises`: 10 sites
- `@typescript-eslint/no-misused-promises`: 17 sites — including the two `async onload()` overrides in `EmbeddedCalendarView.ts:83` and `EmbeddedAgendaView.ts:74` that violate `MarkdownRenderChild`'s synchronous lifecycle contract
- `@typescript-eslint/no-unnecessary-type-assertion`: 2 sites (cascade cleanup once `as TFile` casts are narrowed)

Phase end state: the registerView callback constructs and returns `CalendarView` directly without assigning to `plugin.calendarView`; consumers fetch the view lazily via a `getCalendarView()` helper that uses `instanceof CalendarView` narrowing; every `document.*` read in a view context uses `activeDocument` and every `setTimeout`/`setInterval` uses `activeWindow.setTimeout`/`setInterval`; every `as TFile` cast is replaced by `instanceof TFile` narrowing; every fire-and-forget Promise is `void`-prefixed or `.catch`-handled; the two embedded views' `onload` methods are synchronous wrappers around inner async work; the Phase-7 ESLint override block (`eslint.config.mjs:66–92`) is deleted; `npm run lint` passes clean; manual UAT confirms popout-window rendering, daily-note opening, and settings-modal persistence on plugin toggle.

Out of scope (Phase 8 territory): `console.*` cleanup (DIR-01), `any` removal (DIR-09), unused-vars cleanup (DIR-10), `CLAUDE.md` + `CONVENTIONS.md` "Directory Compliance" do/don't section (DOC-02). The Phase-8 ESLint override block stays untouched.

</domain>

<decisions>
## Implementation Decisions

### DIR-05 view access pattern (Claude discretion — locked by user)

- **D-01:** **Add a `getCalendarView(): CalendarView | null` private method on the `MemoChron` plugin class** that does `this.app.workspace.getLeavesOfType(MEMOCHRON_VIEW_TYPE)[0]?.view` and returns it only if it passes an `instanceof CalendarView` check (otherwise `null`). The 5 callsites in `src/main.ts:167–188` (`refreshEvents`, `updateColors`, `goToToday`, `toggleCalendarVisibility`, plus the `forceRefresh` command path) call `this.getCalendarView()` and null-check the result. Rationale: 5 callsites → one lookup site; the `instanceof` guard doubles as the typed-narrowing the obsidianmd rule wants; no inline duplication.
- **D-02:** **Delete the `calendarView: CalendarView` field on the plugin class entirely** (`src/main.ts:20`). The `registerView` callback (line 47) becomes `(leaf) => new CalendarView(leaf, this)` — pure factory, no side-effect assignment. The plugin no longer holds a reference; Obsidian's workspace is the single source of truth.
- **D-03:** **`onunload` teardown stays through `app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)`** which is already present and is the obsidianmd-recommended teardown path. The `detach-leaves` lint finding goes away once the leak field is removed (the rule fires because of the held reference, not the detach call). Verify after the field deletion.

### DIR-06 active-doc / active-window strategy (Claude discretion — locked by user)

- **D-04:** **Use the Obsidian globals `activeDocument` and `activeWindow` directly** — not `this.app.workspace.activeWindow`. The obsidianmd plugin's `prefer-active-doc` and `prefer-window-timers` rules auto-fix to the globals; the recommended Obsidian eslint config registers them as globals; using the workspace path adds a `this.app.workspace.` prefix without functional benefit and makes the line longer to read. This also fixes `colorValidation.ts:46` cleanly — the file has no plugin reference and doesn't need one.
- **D-05:** **`setCss*Props`-adjacent reads:** every `getComputedStyle(document.documentElement)` becomes `getComputedStyle(activeDocument.documentElement)`. The 14 sites split as: SettingsTab.ts (×9 — lines 170, 612, 636, 670, 681, 705 plus the three more eslint finds), CalendarView.ts (lines 658, 767), EmbeddedAgendaView.ts (line 259), viewRenderers.ts (line 144), colorValidation.ts (line 46). All are accent-color or `--text-on-accent` reads that need to follow the popout window's actual theme — perfect fit for `activeDocument`.
- **D-06:** **`window.setTimeout` / `window.setInterval` → `activeWindow.setTimeout` / `activeWindow.setInterval`** at all 4 sites including the two plugin-context timers in `main.ts:202, 227`. Even though those timers are kicked off at plugin load (not in a view), they fire over a long window during which the active leaf may move to a popout — the rule applies. The mobile-WebView iOS comment at `main.ts:219` about `setTimeout`/`setInterval` ID pools stays as written; the API surface change is `window.` → `activeWindow.` only, the cleanup path is unchanged.
- **D-07:** **No `app.workspace.activeWindow` indirection.** Phase 7 commits to the globals (`activeWindow`, `activeDocument`) per D-04. If a future Obsidian API change deprecates the globals, that's a separate refactor.

### DIR-07 TFile narrowing

- **D-08:** **Replace each `as TFile` with an `instanceof TFile` guard** at the 4 sites — `CalendarView.ts:148` (`this.dailyNotes.set(dateStr, file)` after `if (file instanceof TFile)`), `CalendarView.ts:828` (`await leaf.openFile(dailyNote)` after `if (dailyNote instanceof TFile)`), `EmbeddedCalendarView.ts:234`, `EmbeddedAgendaView.ts:383` (same pattern as 828). The 2 `@typescript-eslint/no-unnecessary-type-assertion` violations resolve as a cascade once the casts are gone. Rationale: `instanceof TFile` is type-safe, mirrors the existing `instanceof TFile` checks already in the codebase (e.g., `pathUtils.ts`), and is the obsidianmd-recommended pattern. No new helper, no `assertIsFile` utility — the `if` guard at each site is the smallest correct change.

### DIR-08 promise hygiene (Claude discretion — locked by user)

- **D-09:** **Fire-and-forget pattern policy** — three buckets:
  - **`void` operator** for truly fire-and-forget where caller doesn't care about errors and a global error wouldn't be actionable (e.g., refresh-on-leaf-open).
  - **`.catch(error => new Notice(errorMessage(error)))`** for sites where a user-visible error notice is the right outcome (uses the Phase 2 `errorMessage()` helper from `src/utils/errors.ts`). This is the dominant choice — most floating promises in the codebase are user-initiated actions whose failure deserves a Notice.
  - **`await`** when the surrounding context is already async and execution should sequence (this should be rare — most identified sites are inside callback signatures that don't allow `await`).

  Planner classifies each of the 10 floating-promise + 17 misused-promise sites into one of the three buckets at implementation time; default for ambiguous sites is `.catch` with `errorMessage()` (safer than swallowing via `void`).

- **D-10:** **`MarkdownRenderChild` async-lifecycle fix — synchronous wrapper around inner async helper.**
  - `EmbeddedCalendarView.ts:83` and `EmbeddedAgendaView.ts:74` currently declare `async onload()` which returns `Promise<void>` and violates the `MarkdownRenderChild` contract.
  - **Pattern:** rename the body to a private `initialize()` (or `loadEvents()`) helper that retains the async signature, then write `onload(): void { void this.initialize(); }`. The inner async helper handles its own errors via `.catch` per D-09. The synchronous `onload` satisfies the type contract; the work happens asynchronously without blocking the lifecycle.
  - Same shape applied to both views. Planner picks the helper name based on what each view actually does (one fetches events + renders calendar, the other fetches events + renders agenda — names should reflect that).

### Commit granularity and ordering (user-locked)

- **D-11:** **Six atomic commits in execution order:**
  1. `refactor(main): fix view-in-registerView memory leak (DIR-05)` — main.ts only; deletes the `calendarView` field, makes the `registerView` callback a pure factory, adds the `getCalendarView()` helper, updates the 5 callsites. **Includes BUG-07 verification.** If disabling MemoChron in Community Plugins no longer closes the Settings modal after this commit, fold BUG-07 closure into this commit's message and the SUMMARY. If it still closes, leave BUG-07 for commit 5 below.
  2. `refactor(views): adopt activeDocument and activeWindow for popout-window support (DIR-06)` — single commit covering both `prefer-active-doc` (14 sites) and `prefer-window-timers` (4 sites). Touches `main.ts`, `CalendarView.ts`, `EmbeddedAgendaView.ts`, `SettingsTab.ts`, `viewRenderers.ts`, `colorValidation.ts`.
  3. `refactor(views): narrow TAbstractFile via instanceof TFile (DIR-07)` — small commit, 4 narrowing sites.
  4. `refactor(views): fix floating promises and MarkdownRenderChild lifecycle return types (DIR-08)` — largest commit; 27 promise sites + 2 async-onload rewrites. Last code commit because the diff is biggest and review-heaviest.
  5. `docs(07): close BUG-07 with Obsidian-side root cause note` — **only if commit 1 didn't close BUG-07**. Adds `.planning/phases/07-lifecycle-compatibility/BUG-07-CLOSURE.md` with reproduction steps, Obsidian version, OS, evidence. If commit 1 closed it, this commit is skipped and the closure is noted in commit 1's body.
  6. `chore(lint): remove Phase 7 ESLint overrides (DIR-05/06/07/08 acceptance)` — deletes the override block at `eslint.config.mjs:66–92`. `npm run lint` runs as part of this commit's verification and must pass clean.
  7. `docs(07): record Phase 7 human UAT` — adds `07-HUMAN-UAT.md` with the D-12 walkthrough.

  Net: 5 commits if BUG-07 falls out of commit 1, 6 commits if it requires a closure note. Mirrors Phase 6's `requirement-then-cleanup-then-UAT` shape from D-16.

### UAT scope (user-locked)

- **D-12:** **HUMAN-UAT.md walkthrough — six mandatory steps:**
  1. **Popout window full walkthrough** (success criterion #6): right-click sidebar tab → "Move to new window"; in the popout, confirm (a) calendar grid renders with correct accent colors (verifies `activeDocument.documentElement` reads), (b) month-prev / month-next navigation works, (c) drag-resize between month-view and week-view works (verifies `activeWindow.setTimeout` for the startup timer + drag handlers), (d) wait long enough for the auto-refresh interval and confirm one refresh fires (verifies `activeWindow.setInterval` for the background-refresh timer).
  2. **Daily-note open path** (DIR-07 verification): in the agenda, click an event whose date has a daily note; confirm the daily note opens correctly. Repeat for an embedded calendar code block and an embedded agenda code block (covers all 3 `instanceof TFile` openFile sites).
  3. **Settings-modal persistence on plugin toggle** (success criterion #5 / BUG-07): open Obsidian Settings → Community Plugins, locate MemoChron, click the toggle to disable; confirm the Settings modal STAYS OPEN. Re-enable, confirm the modal stays open. If the modal still closes: commit 5 above lands with `BUG-07-CLOSURE.md` capturing reproduction steps, Obsidian version (`Obsidian → About`), OS, and an evidence note that the Obsidian Insider build (if accessible) reproduces the same behavior.
  4. **Sidebar parity check:** in the main sidebar, confirm calendar grid + agenda render identically to v1.14.0 / post-Phase-6 baseline. No regression from the active-doc / active-window changes.
  5. **Embedded-view parity check:** open a note containing `memochron-calendar` and `memochron-agenda` code blocks; confirm both render and the daily-note-click path works (covers EmbeddedCalendarView/EmbeddedAgendaView async-lifecycle rewrite from D-10).
  6. **Lint clean:** `npm run lint` exits zero with the Phase-7 override block deleted.
- **D-13:** **Mobile UAT is deferred to v1.16.** Phase 7 introduces no new CSS classes (Phase 6 did that work). The active-doc/active-window changes are runtime-only; on mobile-WebView the globals point to the only window/document available. HUMAN-UAT.md carries the line "Desktop-only verification; mobile audit deferred to v1.16 if regression reported" per Phase 6 D-15 precedent.

### Claude's Discretion

- **Helper method name** — `getCalendarView()` is the working name (D-01). Planner may prefer `findCalendarView()` or `resolveCalendarView()` if either reads better at the callsites; either is fine as long as the `instanceof CalendarView` narrowing is preserved.
- **Inner async helper name** in `EmbeddedCalendarView`/`EmbeddedAgendaView` — `initialize()` is the working name (D-10). Planner may pick `loadEvents()`, `renderAsync()`, or another verb-based name that reads naturally at the `void this.X()` callsite.
- **Per-site classification of DIR-08 promises into the three buckets** (D-09: `void` vs `.catch` vs `await`) — planner makes the call at implementation time. Default for ambiguous sites is `.catch(error => new Notice(errorMessage(error)))` — safer than silent `void`.
- **Whether the 14 `getComputedStyle` reads share a tiny helper** (e.g., `readAccentColor()`) or stay as inline `getComputedStyle(activeDocument.documentElement).getPropertyValue(...)` — planner decides if the duplication is worth abstracting. Default is to keep inline (matches the existing pattern; introducing a helper is its own refactor).
- **Exact `BUG-07-CLOSURE.md` shape if needed** — planner formats based on D-12 contents: reproduction steps, Obsidian version (`Obsidian → About`), OS, evidence that the same behavior happens on a stock Obsidian instance (no MemoChron-side workaround works), and a one-line statement that DIR-05 has been verified independently.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project artifacts
- `.planning/ROADMAP.md` — Phase 7 entry; 6 success criteria including the popout-window UAT (SC #6) and plugin-toggle modal persistence (SC #5); explicit note that BUG-07's root cause may be Obsidian-side
- `.planning/REQUIREMENTS.md` — DIR-05 (registerView callback shape), DIR-06 (`activeDocument` + `activeWindow.setTimeout` requirement), DIR-07 (no `as TFile` casts), DIR-08 (no floating promises + `MarkdownRenderChild` sync return-type requirement), BUG-07 (settings-modal persistence on plugin toggle)
- `.planning/PROJECT.md` — milestone framing; "Install lint/CI guardrails alongside the fixes" Key Decision; "BUG-07 joins Phase 07 because root-cause analysis points at the same view-lifecycle area as DIR-05"
- `.planning/STATE.md` — v1.15 active; Phase 6 complete (DIR-02/03/04 closed); Phase 7 (DIR-06) flagged: "Popout-window compatibility cannot be fully verified without a manual test in an Obsidian popout window. UAT step is mandatory." Phase 7 (BUG-07) flagged: "Root cause may be in Obsidian core, not MemoChron. If so, close with a written explanation."

### Codebase intel
- `.planning/codebase/STRUCTURE.md` — source layout; 5-file scope (main.ts, CalendarView, EmbeddedCalendarView, EmbeddedAgendaView, SettingsTab) plus colorValidation, viewRenderers
- `.planning/codebase/CONVENTIONS.md` — Obsidian API usage guidelines, current `as TFile` and floating-promise patterns called out as anti-patterns
- `.planning/codebase/CONCERNS.md` — pre-existing flags for lifecycle, view-references-in-plugin, popout-window

### Prior phase context (decisions carried forward)
- `.planning/phases/01-foundation/01-CONTEXT.md` — TD-03 / TD-04 established the `onunload` cleanup pattern (timers cancelled, leaves detached); Phase 7 D-03 extends rather than replaces this
- `.planning/phases/02-security-correctness/02-CONTEXT.md` — Phase 2 introduced `src/utils/errors.ts` `errorMessage(error)` helper used in 18 catch sites; Phase 7 D-09 reuses it for `.catch` handlers on floating promises
- `.planning/phases/05-guardrails-trivial-fixes/05-CONTEXT.md` — D-04 lists this phase's exact override block to delete; D-13 sets the HUMAN-UAT-only verification pattern that Phase 7 reuses
- `.planning/phases/06-dom-api-refactor/06-CONTEXT.md` — D-14 / D-15 set the visual-parity UAT precedent (no screenshot baselines, live walkthrough), D-16 sets the requirement-then-cleanup commit ordering; Phase 7 D-11 / D-12 mirror these

### Repository files Phase 7 will touch
- `src/main.ts` — DIR-05 (lines 20, 47, 167–188) plus DIR-06 timers (lines 202, 227)
- `src/views/CalendarView.ts` — DIR-06 `getComputedStyle` (lines 658, 767), `setTimeout` (line 79); DIR-07 `as TFile` (lines 148, 828); DIR-08 floating promises (planner re-scans)
- `src/views/EmbeddedCalendarView.ts` — DIR-07 `as TFile` (line 234); DIR-08 async onload rewrite (line 83)
- `src/views/EmbeddedAgendaView.ts` — DIR-06 `getComputedStyle` (line 259); DIR-07 `as TFile` (line 383); DIR-08 async onload rewrite (line 74)
- `src/settings/SettingsTab.ts` — DIR-06 `getComputedStyle` (×9 sites including 170, 612, 636, 670, 681, 705 plus three more from eslint), `setTimeout` (lines 1381, 1783); DIR-08 floating promises (planner classifies)
- `src/utils/viewRenderers.ts` — DIR-06 `getComputedStyle` (line 144)
- `src/utils/colorValidation.ts` — DIR-06 `getComputedStyle` (line 46) — file has no plugin reference; uses global `activeDocument` per D-04
- `eslint.config.mjs` — delete Phase-7 override block (lines 66–92) per D-11 commit 6
- `.planning/phases/07-lifecycle-compatibility/07-HUMAN-UAT.md` — new file per D-12
- `.planning/phases/07-lifecycle-compatibility/BUG-07-CLOSURE.md` — new file IF commit 1 doesn't close BUG-07

### Project rules
- `CLAUDE.md` — Obsidian plugin best practices, view-lifecycle ("Always clean up resources in `onunload()`"), `this.registerEvent()` / `this.registerDomEvent()` cleanup pattern; mobile compatibility (`isDesktopOnly: false`); commit-message hygiene (NO Claude / AI references in commits or release notes)

### External docs (researcher MUST consult at planning time)
- Obsidian Plugin API docs — `activeDocument` / `activeWindow` semantics (when does the active window change? does it return the popout window when a leaf is moved? does the global persist across leaf moves?), `getLeavesOfType` return value, `MarkdownRenderChild` `onload` / `onunload` signatures and lifecycle order
- `eslint-plugin-obsidianmd` rule docs — `no-view-references-in-plugin`, `prefer-active-doc`, `prefer-window-timers`, `no-tfile-tfolder-cast`, `detach-leaves` exact rule definitions and auto-fix shapes
- `@typescript-eslint/no-floating-promises` rule docs — confirm `void`, `.catch`, `await` are the three accepted resolutions
- `@typescript-eslint/no-misused-promises` rule docs — specifically the `checksVoidReturn` configuration that flags the async-onload return-type mismatch

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/utils/errors.ts` `errorMessage(error)` helper** (Phase 2) — already used in 18 catch sites. D-09's `.catch(error => new Notice(errorMessage(error)))` pattern reuses this directly. No new error-handling infrastructure needed.
- **`MEMOCHRON_VIEW_TYPE` constant** (`src/utils/constants.ts`) — already exported and used in `registerView`/`detachLeavesOfType`. D-01's `getCalendarView()` helper passes this to `getLeavesOfType(MEMOCHRON_VIEW_TYPE)`.
- **`pathUtils.ts` `instanceof TFile` checks** — the codebase already uses `instanceof TFile` narrowing in several places (e.g., when classifying vault entries). D-08 extends the same pattern to the 4 daily-note open sites; the `import { TFile } from "obsidian"` line is already present in all 4 files.
- **Phase 1's `clearRefreshTimer` cleanup** (`src/main.ts` `onunload`) — already tracks and cancels the auto-refresh interval. D-06's `window.setInterval` → `activeWindow.setInterval` change preserves the timer ID, so the cleanup path is unchanged.
- **Phase 2's per-catch `errorMessage` normalization** — D-09 maintains this convention; `.catch` handlers go through the same helper rather than inventing new error strings.

### Established Patterns
- **`obsidianmd/no-static-styles-assignment` is locked off this phase** — Phase 6 closed that. Any inline-style work re-surfaces would have to be in a Phase 7 follow-up, but the scout shows no new inline-style writes added in the Phase 7 surface.
- **`createElementNS` for SVG** stays as Phase 6 D-12 documented — not affected by DIR-06 (no `obsidianmd/prefer-active-doc` flag on `createElementNS`).
- **Sync wrapper around async work** is a new pattern in this codebase introduced by D-10. The shape is documented inline in CONTEXT.md; the planner doesn't need to invent it. Mirrors a common Obsidian sample-plugin idiom.
- **No `void` operator in codebase today** — Phase 7 introduces it for D-09's fire-and-forget classification. Single-keyword adoption, not a sweeping pattern change.

### Integration Points
- **`src/main.ts:47` (`registerView` callback)** — single-line surgical change point for DIR-05. The callback becomes `(leaf) => new CalendarView(leaf, this)`. No other Obsidian-side wiring changes.
- **`src/main.ts:167–188`** — the 5 callsites that need `this.getCalendarView()`. Each becomes `const view = this.getCalendarView(); if (!view) return; view.refreshEvents(forceRefresh);` (or equivalent for the other 4 methods). Each callsite is a 2–3 line replacement.
- **`src/views/EmbeddedCalendarView.ts:83` and `EmbeddedAgendaView.ts:74`** — `async onload()` becomes `onload(): void { void this.initialize(); }`. The inner `initialize()` retains the existing async body, with `.catch` added per D-09 for top-level error handling.
- **`eslint.config.mjs:66–92`** — single-block delete (the Phase-7 comment header + the `files`/`rules` object). Adjacent Phase-5 and Phase-8 blocks stay.

</code_context>

<specifics>
## Specific Ideas

- **Use the Obsidian globals, not workspace-instance paths.** `activeDocument` and `activeWindow` are the named alternatives in the `obsidianmd` recommended config; using them keeps lines short and matches the auto-fix shape the rule prescribes. `this.app.workspace.activeWindow` is functionally equivalent but more verbose.
- **`getCalendarView()` returns `CalendarView | null`, not the workspace-leaf wrapper.** Consumers want the view, not the leaf. The `instanceof CalendarView` guard is the typed-narrow that satisfies `obsidianmd/no-view-references-in-plugin`.
- **`MarkdownRenderChild` lifecycle is synchronous by contract.** Obsidian calls `onload()` and `onunload()` and discards the return value — but a `Promise<void>` return makes the type contract violate the supertype declaration, which the misused-promises rule catches. The fix is to make the override sync; the async work continues to run, the lifecycle just doesn't wait for it.
- **Phase 6's HUMAN-UAT.md precedent stands.** No before/after screenshot artifacts under `.planning/phases/07-*/`. Live walkthrough during UAT is the verification; bitrot-resistant.
- **BUG-07 hypothesis (root cause may be Obsidian-side):** the Community Plugins toggle disables MemoChron, which triggers `onunload`, which calls `detachLeavesOfType(MEMOCHRON_VIEW_TYPE)`. If the active Settings modal is somehow tied to that workspace leaf in older Obsidian builds, detaching it could close the modal. After D-02 deletes `plugin.calendarView`, the workspace's understanding of which leaf is "the calendar leaf" is unchanged — so if BUG-07 was driven by the held reference, it goes away. If it was driven by Obsidian-side modal/workspace coupling, no MemoChron-side change closes it and the closure note (D-12) documents that.

</specifics>

<deferred>
## Deferred Ideas

- **`window.moment` utility wrapper (FRAG-01)** — stable in practice; tracked as v2 fragility milestone work, not a Phase 7 concern even though `(window as any).moment` is one of the `any` sites Phase 8 will touch.
- **`jCal[2]` → `VALUE=DATE` parameter check (FRAG-02)** — same: stable, deferred, not a Phase 7 concern.
- **Mobile-WebView UAT** (D-13) — deferred to v1.16 per Phase 6 precedent. If a user files a mobile-specific regression report against v1.15, it gets its own phase.
- **Replace `Setting.addColorPicker` consolidation, drag-resize debouncing, settings-tab incremental render** — all deferred from prior phases; not in Phase 7 scope.
- **Refactoring `CalendarView`'s per-event renderer to call into `viewRenderers.ts`** — deferred from Phase 6; still out of scope. A `Phase 7 dependent` follow-up only if DIR-08's promise audit surfaces duplicate error paths between the two surfaces.
- **`prefer-active-doc` workspace-instance path** (D-07) — if the Obsidian globals API ever changes, the workspace-instance path (`this.app.workspace.activeWindow`) is the migration target. Not a Phase 7 concern.

</deferred>

---

*Phase: 07-lifecycle-compatibility*
*Context gathered: 2026-05-15*
