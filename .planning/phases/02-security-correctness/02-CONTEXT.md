# Phase 2: Security & Correctness - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Internal-only hardening — no new UI affordances. Four tightly-scoped requirements:

- **SEC-01** — Calendar color values are validated at `loadSettings` time AND at render time; SVG swatches are built via `createElementNS` so template-literal injection becomes structurally impossible.
- **SEC-02** — Every `catch (error)` block uses a consistent `error instanceof Error ? error.message : String(error)` pattern. User-visible errors (failed fetch, failed note creation, failed cache read) show specific messages, not `[object Object]` or `undefined`.
- **BUG-05** — `getStartOfWeek` returns the correct week-start for every value of `firstDayOfWeek` (0–6), including the Saturday-start case currently broken.
- **BUG-06** — A second background refresh started while a fetch is already in progress does not produce a double-render or duplicate event list.

Goal at end of phase: a crafted `data.json` color cannot inject markup; every visible error is specific; `getStartOfWeek` is correct for all 7 weekday-start values; concurrent `fetchCalendars` callers are deduplicated structurally rather than relying on `lastFetch` ordering.

</domain>

<decisions>
## Implementation Decisions

### SEC-01 — color validation regex (Area 1)

- **D-01:** "Valid color" is a permissive whitelist that exhaustively names the safe formats currently produced by the codebase, NOT the strict `/^#[0-9a-fA-F]{6}$/` regex named in REQUIREMENTS.md. Reason: stored values today include `#rrggbb` from the color picker, `hsl(...)` from auto-assignment (`SettingsTab.ts:164`), and `var(--color-red)` from the palette (`constants.ts:18`). A strict-hex regex would reject every existing CSS-var-based color and either force a migration that freezes theme-following or flag every existing user as "corrupt."
- **D-02:** The whitelist accepts: `#rgb`, `#rrggbb` (6-digit hex), `#rrggbbaa`/`#rgba` (4/8-digit hex with alpha), `hsl(...)`, `hsla(...)`, `rgb(...)`, `rgba(...)`, and `var(--<identifier>)` where `<identifier>` is `[a-zA-Z0-9_-]+`. Researcher selects the precise sub-regexes; a single union regex or a small `isValidColor(value: string): boolean` checker, planner's call.
- **D-03:** Defense-in-depth applies: validate at `loadSettings` time (replace invalid values) AND at render time in the SVG construction path (refuse to write into the swatch). Both are required by the ROADMAP success criteria; one without the other is not sufficient.

### SEC-01 — invalid-color failure mode (Area 2)

- **D-04:** When `loadSettings` finds an invalid color, **silently replace + `console.warn`**. The replacement is the next palette color or a CSS-var fallback (planner's call — pick the same logic that `getNextAvailableColor()` uses for new sources). The `console.warn` names the affected calendar source so a developer can find it via DevTools. **No `Notice`** — the typical user will never see this and it's not actionable; the warn is enough for diagnostics.
- **D-05:** The render-time path (in `customLabel.innerHTML` sites at `SettingsTab.ts:589` and `:675`) uses the same validator. On a render-time miss, fall back to the same default color and skip the warn (loadSettings already warned). Better: validation at load means render-time cannot see an invalid value through the normal flow — the render-time guard is purely defensive.

### SEC-01 — SVG construction (locked by ROADMAP success criterion #2)

- **D-06:** Replace both `customLabel.innerHTML = \`<svg ... fill="${currentColor}" .../>\`` template literals (`SettingsTab.ts:589`, `:675`) with `document.createElementNS("http://www.w3.org/2000/svg", "svg")` + `setAttributeNS`/`setAttribute` for child elements. The fill value goes through `setAttribute("fill", ...)` — `setAttribute` does not interpret HTML, so even an unsanitized value cannot inject markup. The validator (D-02) is still applied as belt-and-suspenders.
- **D-07:** Out of scope for this phase: the static help-text `innerHTML` sites at `SettingsTab.ts:1817`, `:1834`, `:1855–57`. These are FRAG-04 (deferred); the strings have no user input and only carry `<strong>` tags.

### SEC-02 — scope and ergonomics (Area 3)

- **D-08:** Apply the pattern to **every** `catch` block in `src/` — services, views, settings, utils. Future-proofs against new sites and matches the REQUIREMENTS.md wording ("every `catch (error)` block ... uses a consistent pattern"). Sites that currently `console.error("...", error)` already serialize Error correctly via console; rewriting them to use the helper still wins on consistency and eliminates ambiguity if the format ever changes.
- **D-09:** Add a tiny utility at `src/utils/errors.ts` exporting `errorMessage(err: unknown): string`. Implementation: `err instanceof Error ? err.message : String(err)`. Every catch site imports and uses it. Reason: one-line touch per site; future format changes (e.g., adding cause-chain unwrapping) are a single-file edit.
- **D-10:** Sites that today pass `error` directly to `console.error("...", error)` (which the browser stringifies sensibly) are still rewritten to `console.error("...:", errorMessage(error))` for consistency with the user-visible Notice paths. The success criterion's spirit is that both diagnostic and user-facing paths read the same way.
- **D-11:** Sites that already do `error instanceof Error` correctly (`IcsImportService.ts:33` and `:92`) are refactored to use the helper to remove the bespoke check. Behavior preserved.

### BUG-06 — race fix (Area 4)

- **D-12:** Replace the boolean `isFetchingCalendars` short-circuit with a **shared in-flight Promise**. Add `private fetchInFlight: Promise<CalendarEvent[]> | null = null`. On `fetchCalendars` entry: if `fetchInFlight` is non-null, await and return it; otherwise assign `fetchInFlight = this.performFetch(...)` and clear it in a `finally`. Concurrent callers — including `scheduleBackgroundRefresh` and any user-triggered force-refresh — get the same result without duplicating the network round-trip.
- **D-13:** `isFetchingCalendars` is removed. The Promise being non-null IS the in-flight signal.
- **D-14:** Force-refresh-during-fetch is **not** in scope. The success criterion is "no double-render or duplicate event list", which the shared-Promise approach satisfies. If a user clicks "force refresh" while a non-force fetch is in flight, they receive the in-flight result. That UX nuance is a separate concern; if it surfaces in real use, it gets its own follow-up.

### Claude's Discretion

- **BUG-05** — `REQUIREMENTS.md` says `getStartOfWeek` is "currently broken" for the Saturday-start case, but `CONCERNS.md` traces the formula and concludes it is correct-but-non-obvious. Researcher traces every `firstDayOfWeek ∈ {0..6}` × every `getDay() ∈ {0..6}` pair in `CalendarView.ts:407–413` to surface the actual misbehaving case (if any) and chooses between minimal-formula-fix vs. cleaner replacement (e.g., `((day - firstDay + 7) % 7)` style) based on what the trace shows.
- Commit granularity: per-requirement atomic commits is the GSD default. SEC-01 may split into "regex + load-time validation" + "render-time `createElementNS`" if the diff is large. Planner's call.
- Whether the validation utility lives at `src/utils/errors.ts` (errors only) or `src/utils/validation.ts` (validation only) or both: planner's call. Naming consistency with existing utils (`pathUtils.ts`, `timezoneUtils.ts`, `viewRenderers.ts`) suggests `src/utils/colorValidation.ts` for the color regex and `src/utils/errors.ts` for the error helper.
- Whether the color-validator regex is one combined union or a discriminated set of small regexes per format: planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project artifacts
- `.planning/ROADMAP.md` — Phase 2 entry, 5 success criteria (the SVG `createElementNS` requirement is in success criterion #2; not all four bugs map 1:1 to success criteria, watch BUG-04 is Phase 3, not here)
- `.planning/REQUIREMENTS.md` — SEC-01, SEC-02, BUG-05, BUG-06 acceptance language; out-of-scope list (FRAG-04 static `innerHTML` is explicitly deferred)
- `.planning/PROJECT.md` — milestone framing, security constraint ("No remote code execution; no user data sent to external services")
- `.planning/STATE.md` — Phase 1 outputs (services hold plugin reference; live-settings pattern; mobile-safe timer ownership via `setBackgroundRefreshTimer`)

### Codebase intel
- `.planning/codebase/CONCERNS.md` — Security Considerations section (`innerHTML` color injection at `SettingsTab.ts:589,675`; untyped `error` accesses); Known Bugs section (the `getStartOfWeek` analysis that contradicts REQUIREMENTS' "currently broken" wording — researcher must reconcile)
- `.planning/codebase/ARCHITECTURE.md` — services-hold-plugin coupling (already in place after Phase 1)
- `.planning/codebase/CONVENTIONS.md` — error-handling patterns currently in use across services and views
- `.planning/phases/01-foundation/01-CONTEXT.md` — service constructor signatures after Phase 1 (`(plugin: MemoChron)` only); `setBackgroundRefreshTimer` exists on plugin

### Project rules
- `CLAUDE.md` — Obsidian plugin best practices (no `innerHTML` for user-controlled values; `createElementNS` is the recommended construction path); `registerDomEvent` guidance; commit message hygiene (NO Claude / AI references); mobile compatibility (`isDesktopOnly: false`)

### Source files this phase will touch
- `src/main.ts` — `loadSettings()` (line 98) gains color-validation pass over `settings.calendarUrls[].color` and `settings.dailyNoteColor`
- `src/settings/SettingsTab.ts` — two `innerHTML` SVG sites at lines 589 and 675 replaced with `createElementNS`-built SVG; render-time validator applied; existing `error.message` access at line 1128 routed through the helper
- `src/services/CalendarService.ts` — `isFetchingCalendars` field replaced with `fetchInFlight` Promise; `scheduleBackgroundRefresh` updated to share the same promise; existing `error.message` accesses at lines 396, 398, 532 routed through `errorMessage()`; remaining catches at lines 244, 288, 332, 391, 516, 528 normalized
- `src/services/NoteService.ts` — catches at lines 74, 126, 164, 267, 416 normalized through `errorMessage()`
- `src/services/IcsImportService.ts` — catches at lines 30 and 91 refactored to use `errorMessage()` (currently use bespoke `instanceof Error` checks)
- `src/views/CalendarView.ts` — catches at lines 148, 169, 752, 841, 956 normalized; `error.message` access at line 958 routed through helper; `getStartOfWeek` at lines 407–413 verified or fixed (researcher decides scope after trace)
- `src/views/EmbeddedCalendarView.ts` — catch at line 232 normalized
- `src/views/EmbeddedAgendaView.ts` — catch at line 375 normalized
- `src/utils/timezoneUtils.ts` — catches at lines 177, 198, 222 normalized
- `src/utils/errors.ts` — NEW. Exports `errorMessage(err: unknown): string`.
- `src/utils/colorValidation.ts` — NEW (or co-located in another util file, planner's call). Exports `isValidColor(value: string): boolean` and a default-color fallback chooser.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`setBackgroundRefreshTimer` on the plugin** — added in Phase 1 (CR-01) for mobile-safe timer ownership. The shared-promise refactor must call into this same path so the cancellation behavior on `onunload` stays correct.
- **`getNextAvailableColor()` in `SettingsTab.ts:523`** — already produces a sensible default color for new calendar sources. Reuse for the loadSettings invalid-color fallback (D-04).
- **`IcsImportService.ts:33` and `:92`** — already do `error instanceof Error` correctly. Refactor to use the helper rather than removing the check.
- **`getComputedStyle(...).getPropertyValue("--interactive-accent")`** pattern — used in `SettingsTab.ts:170` for `dailyNoteColor` default. Same pattern can serve as the load-time fallback if a stored color is invalid.

### Established Patterns
- **Live-settings reads** — both services read `this.plugin.settings` live (Phase 1 D-03). The validator pass in `loadSettings` writes the corrected values back into `this.settings` before `saveSettings` is ever called downstream.
- **Notice + console.error pairing** — user-visible errors today are `Notice + console.error`. The helper unifies the message extraction; the pairing pattern stays.
- **CSS-var color values** — `var(--color-red)` style values flow through to SVG `fill` and `backgroundColor` already; the SVG path uses them in `setAttribute("fill", ...)` post-refactor, which renders correctly because SVG accepts CSS-var fills in the browser context.

### Integration Points
- `main.ts loadSettings()` (line 98) — single point for the color-validation pass. Runs before any view/service consumes the settings.
- `CalendarService.fetchCalendars()` (line 42) — single entry point for the dedup gate. The shared-promise replaces the early-return at lines 46–48.
- `CalendarService.scheduleBackgroundRefresh()` (line 180) — already calls `this.fetchCalendars(sources, true)` after the timer fires. With shared-promise dedup, that call naturally deduplicates without extra logic at the schedule site.
- Two `innerHTML` SVG sites at `SettingsTab.ts:589` and `:675` — both build the same swatch SVG; planner extracts a private helper `buildColorSwatch(color: string): SVGElement` to avoid duplication.

</code_context>

<specifics>
## Specific Ideas

- The validator regex is permissive by design (D-01, D-02). The threat model is "stored color contains characters that break out of an SVG attribute context" — closing that hole via `setAttribute` (D-06) is the structural fix; the regex is belt-and-suspenders.
- The shared-promise refactor (D-12) is a documented JavaScript pattern; researcher should not invent a new abstraction. The Promise is held on the service instance, cleared in a `finally`, and is the only signal of "fetch in flight."
- The error helper signature is `errorMessage(err: unknown): string`. Not `formatError`, not `getErrorMessage`, not `toString` — `errorMessage` reads naturally at call sites: `console.error("...:", errorMessage(error))`.
- For BUG-05, the researcher's first deliverable is a small trace table (`firstDayOfWeek` × `getDay()`, all 49 cells) showing what the current formula returns for an arbitrary reference date. If every cell is correct, BUG-05 closes as "verified" with a comment in the code referencing the analysis; if any cell is wrong, the fix targets that case.

</specifics>

<deferred>
## Deferred Ideas

- **FRAG-04** — Static help-text `innerHTML` sites in `SettingsTab.ts:1817, 1834, 1855–57` (replace with `createEl("strong", ...)`). Out of scope per REQUIREMENTS.md; cosmetic Obsidian-convention nit.
- **FRAG-03** — `hasSourceMismatch` URL-canonical refactor in `CalendarService.ts:212–222`. Out of scope; deferred to fragility milestone.
- **PERF-02** — Caching the enabled-source `Set<string>` in `getEventsForWidget`. Out of scope.
- **Force-refresh-during-fetch UX** — when a user clicks force-refresh while a non-force fetch is in flight, the shared-Promise pattern hands them the in-flight result. If real users notice and complain, this becomes a follow-up (its own concern).
- **Error-cause unwrapping** — modern Error supports a `cause` chain. The helper does not unwrap it today; if it becomes useful, it's a single-file change.
- **Color-format migration** — collapsing all stored colors to hex on load (lose theme-following but simpler regex). Explicitly rejected (D-01) but recorded here in case the trade-off ever needs revisiting.

</deferred>

---

*Phase: 02-security-correctness*
*Context gathered: 2026-05-10*
