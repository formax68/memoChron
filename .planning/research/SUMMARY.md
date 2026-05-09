# Project Research Summary

**Project:** MemoChron — Stabilization Milestone
**Domain:** Obsidian plugin (brownfield) — lifecycle hygiene, security, bug fixes, UX enhancements
**Researched:** 2026-05-09
**Confidence:** HIGH

## Executive Summary

MemoChron is a mature Obsidian plugin with a well-established architecture. The stabilization milestone is not a greenfield build — all stack choices are locked, all component boundaries exist, and all features have clear implementation paths documented to method-level precision. The research task was therefore to find the *correct* usage of the existing APIs and to surface the ordering constraints that the bug/enhancement set creates.

The dominant finding across all four research files is that BUG-01 (UTC midnight parsing of YYYY-MM-DD filename strings) is a hard prerequisite for several other items. ENH-02, ENH-03, and ENH-05 all derive dates from the same parsing path that BUG-01 corrupts, meaning that indicators and template variables built on top of a broken date are worse than useless — they silently confirm the wrong day. BUG-01 must ship before any of those enhancements. ENH-04 (NL DD-MM-YYYY format) also depends on BUG-01 because the hyphenated NL filename is structurally ambiguous with existing formats until the parser is fixed to handle component-by-component construction.

The two primary risks for this milestone are mobile stability (TD-03 untracked timeouts cause iOS crashes on fast plugin disable; TD-04 drag listeners leak and leave `window` in a dirty state) and Obsidian directory submission (SEC-01 `innerHTML` with unvalidated color values is auto-flagged by Obsidian's plugin review). Both must be resolved before the next BRAT release. Everything else is low-risk, additive work with clear implementation paths.

---

## Key Findings

### Stack (from STACK.md)

The stack is fixed and requires no changes. Research validated correct *usage* of what is already in the tree.

**Core technologies:**
- **Obsidian Plugin API (`Component` class)**: `registerInterval`, `register(cb)`, `registerDomEvent`, `registerEvent` are the four lifecycle-aware registration methods. Current code bypasses all of them for timers and drag listeners; migration is the core of the TD-0x work
- **Luxon 3.6.1**: already imported; `DateTime.fromISO(str, { zone: "local" })` and `DateTime.fromObject({ year, month, day })` are the correct replacement for `new Date("YYYY-MM-DD")`; `dt.weekdayLong` / `dt.monthLong` power ENH-05
- **TypeScript 4.7.4 + esbuild 0.17.3**: build toolchain unchanged; `instanceof Error` guard is required for `unknown` catch variables in strict mode

**Critical API constraints verified:**
- `registerDomEvent` is for *permanent* listeners added at initialization — not for per-drag `window` listeners. Drag cleanup belongs in `onClose()`, not `registerDomEvent`
- `sanitizeHTMLToDom()` strips SVG namespace elements — never use it for SVG; use `document.createElementNS` instead
- `editor.setCursor()` must be called after a `requestAnimationFrame` tick following `await leaf.openFile()` — synchronous call after the await is a no-op

### Expected Features (from FEATURES.md)

**Must have (table stakes for this milestone):**
- ENH-01: Today cell always visually distinct from selected cell — CSS compound selector only, zero JS change
- ENH-02: Note-exists indicator on agenda event rows — `getExistingEventNote()` already exists, just needs a render path
- ENH-04: DD-MM-YYYY (NL) date format — one formatter, one settings dropdown entry
- ENH-05: `{{day}}` / `{{month}}` template variables — two array entries following the existing `FolderTemplateVariables` pattern
- ENH-06: Cursor placement after note creation — highest-complexity enhancement; requires post-`openFile` timing dance

**Should have (polish differentiators):**
- ENH-01 today-ring inside selected state — CSS `box-shadow: inset` pattern (Google Calendar convention)
- ENH-02 icon semantics — `file-check-2` (has note) vs `file-plus-2` (no note) using Obsidian `setIcon()`
- ENH-03: Grid dot for days with event-notes — opt-in toggle; default off; depends on ENH-02 lookup pattern

**Defer (anti-features for this milestone):**
- Animated today indicator, pane-split on note open, locale-aware day names, `{{cursor}}` in frontmatter (breaks YAML), ENH-03 enabled by default

### Architecture Approach (from ARCHITECTURE.md)

No new classes, no new files, no new abstractions. All changes are additive within existing components or removal of stale constructor arguments.

**Six boundary-level changes (everything else is internal):**
1. Remove `refreshMinutes` param from `CalendarService` constructor; read `this.plugin.settings.refreshInterval` at call time (TD-01)
2. Change `NoteService` constructor to accept `() => MemoChronSettings` getter instead of a direct settings snapshot (TD-02)
3. Add `CalendarService.destroy()` method; call from `main.ts onunload()` (TD-03)
4. Add `CalendarView.onClose()` override with defensive drag listener cleanup and `initTimeout` cancel (TD-04)
5. Add `NoteService.getCursorPosition(file)` method; call from `CalendarView.showEventDetails()` after `openFile` (ENH-06)
6. Add vault `create`/`delete` event registrations in `CalendarView.onOpen()` and embedded view `onload()` (ENH-02, ENH-03)

**TD-01 + TD-02 must land together** — both are constructor-snapshot fixes at the same `main.ts` instantiation site.
**TD-03 + TD-04 must land together** — both are mobile-crash mitigations sharing the "untracked resource" pattern.
**ENH-02 + ENH-03 must land together** — both extend the same `RenderOptions` interface in `viewRenderers.ts`; splitting them creates a merge conflict.

### Critical Pitfalls (from PITFALLS.md)

1. **UTC midnight trap (BUG-01)** — `new Date("2026-01-15")` is UTC midnight; in UTC-N it is the previous calendar day. Blocks ENH-02, ENH-03, ENH-05, ENH-04. Fix: `DateTime.fromISO(str, { zone: "local" })`. Verify with `TZ=America/New_York`.

2. **Mobile crash from untracked timeouts (TD-03)** — `setTimeout(..., 100)` in `CalendarService.scheduleBackgroundRefresh` has no stored ID. Disabling the plugin within 100ms triggers `undefined is not an object` on iOS. Fix: `CalendarService.cancelPendingRefresh()` called from `onunload()`.

3. **Drag listener leak on `window` (TD-04)** — `mousemove`/`mouseup` attached to `window` in `handleDragStart` survive view destruction if `handleDragEnd` never fires. Accumulates on each open/close cycle; crashes on iOS. Fix: defensive `removeEventListener` in `CalendarView.onClose()`.

4. **`innerHTML` with unvalidated color (SEC-01)** — `SettingsTab.ts` lines 589 and 675 inject `currentColor` from `data.json` via template literal. Auto-flagged by Obsidian directory review automation. The guard must run at `loadSettings` time (not just display time) so corrupt synced vault data is sanitized on read. Fix: `/^#[0-9a-fA-F]{6}$/` regex at load; SVG via `createElementNS`.

5. **ENH-06 cursor timing** — `editor.setCursor()` synchronously after `await leaf.openFile()` is a no-op (CodeMirror not yet mounted). Fix: `requestAnimationFrame` wrapper. The highest-risk enhancement; easy to regress.

6. **ENH-04 / BUG-01 parsing ambiguity** — NL `DD-MM-YYYY` filenames are indistinguishable from existing formats without a discriminated parse path. ENH-04 requires BUG-01's component-aware constructor (`new Date(y, m-1, d)`) to be in place before the NL formatter is useful.

---

## Implications for Roadmap

The ordering constraints from the research collapse naturally into four phases. Items within each phase are independent and can be parallelized.

### Phase 1: Foundation — Lifecycle and Settings Propagation

**Rationale:** TD-01 + TD-02 are constructor-snapshot fixes at the same `main.ts` site — one PR. TD-03 + TD-04 are untracked-resource mobile-crash mitigations — one PR. CLEAN-01 is housekeeping that reduces noise for all subsequent phases. No user-visible behavior changes.

**Delivers:** Plugin that does not leak resources on unload, does not crash on iOS, and reads live settings in both services.

**Addresses:** TD-01, TD-02 (together), TD-03, TD-04 (together), CLEAN-01

**Avoids:** iOS crashes before BRAT release; settings-staleness bugs in the service layer that would silently affect Phase 4 behavior

**Research flags:** None — all patterns API-verified at HIGH confidence; changes are mechanical

---

### Phase 2: Security — Color Validation and Error Handling

**Rationale:** SEC-01 must be resolved before any BRAT release or directory submission. The critical constraint: color validation must guard at `loadSettings` time, not just at display time. SEC-02 is an independent, mechanical change across six call sites.

**Delivers:** Settings page safe against malicious `data.json`; catch blocks that show meaningful messages.

**Addresses:** SEC-01, SEC-02

**Avoids:** Obsidian directory review rejection (SEC-01 is explicitly flagged by their automation); silent error-swallowing that hides beta tester failures

**Research flags:** None — standard DOM and TypeScript patterns

---

### Phase 3: Bug Fixes — Date Parsing, Week Calculation, Concurrency

**Rationale:** BUG-01 is the hard prerequisite for ENH-02, ENH-03, ENH-05, and ENH-04. It must land and be verified (with a timezone-offset test) before Phase 4 begins. All other bug fixes are independent correctness fixes with no UI surface area.

**Delivers:** Correct date display for all non-UTC users; correct week layout for all first-day-of-week settings; no blank-calendar from concurrent fetches on mobile.

**Addresses:** BUG-01 (prerequisite; verify with `TZ=America/New_York`), BUG-02, BUG-03, BUG-04 (verify/close), BUG-05, BUG-06

**Avoids:** Building Phase 4 enhancements on a broken date foundation — the single highest risk of producing silently incorrect behavior in this milestone

**Research flags:** BUG-01 verification requires timezone-offset manual testing — include as a hard definition-of-done criterion, not optional

---

### Phase 4: UX Enhancements

**Rationale:** All ENH items depend on Phase 3 (BUG-01 confirmed fixed). Within Phase 4: ENH-01 first (CSS-only, confidence builder); ENH-04 + ENH-05 next (same template machinery, BUG-01 parse path now available); ENH-02 + ENH-03 together (shared `RenderOptions` extension); ENH-06 last (highest complexity, builds on stable note-creation flow).

**Delivers:** Production-ready UI that passes Obsidian directory review.

**Addresses (in suggested order):**
- ENH-01: CSS compound selectors; `box-shadow: inset` ring for today-inside-selected
- ENH-04: `NL` formatter in `NoteService.formatDate()`; `DD-MM-YYYY (NL/EU)` in settings dropdown
- ENH-05: `day` and `month` keys in `EventTemplateVariables`; shared English name arrays
- ENH-02 + ENH-03: `hasNote` through `RenderOptions`; vault event registrations; opt-in grid toggle
- ENH-06: `NoteService.getCursorPosition()`; `requestAnimationFrame`-guarded `editor.setCursor()`

**Avoids:** Cursor no-op (timing); `{{month}}` off-by-one (0-indexed array, must use raw index); `{{cursor}}` in frontmatter (strip silently, no reposition); ENH-03 on by default (visual regression for existing users)

**Research flags:** ENH-06 cursor timing mechanism (`requestAnimationFrame` vs `setTimeout(0)` vs `onLayoutReady`) needs confirmation at implementation time

---

### Phase Ordering Rationale

- **BUG-01 is the scheduling keystone.** Four items (ENH-02, ENH-03, ENH-05, ENH-04) have a silent correctness dependency on it. This is the finding that was unanimous across all four research files.
- **TD-01 + TD-02 travel together** — same construction site in `main.ts`, one mental model, one review pass.
- **TD-03 + TD-04 travel together** — both untracked resource / mobile-crash pattern; one reviewer context.
- **SEC-01 must guard at load time** — the key insight from PITFALLS.md that prevents a synced vault attack vector from bypassing the settings UI entirely.
- **ENH-02 + ENH-03 must travel together** — both extend the same `RenderOptions` interface; splitting creates a guaranteed merge conflict.
- **ENH-06 is last** — highest-risk enhancement due to timing sensitivity; safest to implement on a fully-stabilized note-creation flow.

### Research Flags

Phases needing deeper research or careful verification:
- **Phase 3 (BUG-01):** Add `TZ=America/New_York node -e "console.log(new Date('2026-01-15').toDateString())"` as a literal acceptance criterion
- **Phase 4 (ENH-06):** Confirm exact tick mechanism for `setCursor` timing at implementation time; do not assume `requestAnimationFrame` without testing on a cold Obsidian start

Phases with well-documented patterns (no additional research needed):
- **Phase 1:** All Obsidian lifecycle API signatures verified at HIGH confidence
- **Phase 2:** Standard regex validation + `createElementNS`; `instanceof Error` guard
- **Phase 3 (non-BUG-01):** Modular week formula and HTTP status check are straightforward once identified
- **Phase 4 (ENH-01 through ENH-05):** All patterns established in the codebase or Obsidian plugin community

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All API signatures verified against `obsidian.d.ts` master and Luxon Context7 docs; no inferred usage |
| Features | HIGH | Requirements sourced from open GitHub issues (#54–#56) and direct codebase inspection; scope tightly bounded |
| Architecture | HIGH | Based on direct source-code read of all affected files; no new abstractions — changes are minimal and additive |
| Pitfalls | HIGH (code-verified) / MEDIUM (mobile edge-cases) | Mobile-specific pitfalls sourced from Obsidian forum reports; main pitfalls from ECMAScript spec and Obsidian plugin guidelines |

**Overall confidence:** HIGH

### Gaps to Address

- **BUG-04 scope:** Whether the `29-01-2026 → 20/01/2029` parsing regression from #56 is resolved by fix #58 needs verification against the actual input string. Do not write new code until confirmed.
- **ENH-04 separator choice:** NL `DD-MM-YYYY` (hyphens) is the research recommendation. Confirm with plugin author whether `DD.MM.YYYY` (dots) is preferred for Dutch filenames before the settings label is finalized.
- **ENH-06 cursor mechanism:** `requestAnimationFrame` vs `app.workspace.onLayoutReady` — the correct choice depends on when Obsidian attaches the CodeMirror editor to the leaf. Verify at implementation time; do not bake an assumption into the roadmap.

---

## Sources

### Primary (HIGH confidence)
- `/obsidianmd/obsidian-api` via Context7 — `Component.registerInterval`, `register(cb)`, `registerDomEvent` (all overloads), `WorkspaceLeaf.detach()`, `Editor.setCursor`, vault event signatures
- `/obsidianmd/obsidian-developer-docs` via Context7 — `createEl`, `appendText`, `innerHTML` policy, `sanitizeHTMLToDom` limitations, `registerEvent` patterns
- `/moment/luxon` via Context7 — `DateTime.fromISO` zone behavior, `DateTime.fromObject`, `weekdayLong`, `monthLong`, `toFormat("cccc"/"LLLL")`
- `https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/obsidian.d.ts` — raw TypeScript signatures for all verified API methods
- MemoChron source (`/Users/mike/code/memoChron/src/`) — direct read confirming bug locations, fix sites, and existing patterns

### Secondary (MEDIUM confidence)
- Obsidian plugin guidelines (docs.obsidian.md) — `innerHTML` rejection policy, `registerDomEvent` requirement
- liam-cain/obsidian-calendar-plugin — `.today`/`.selected` CSS specificity pattern; dot indicator conventions
- MDN Date constructor — UTC parsing of date-only ISO strings confirmed
- BRAT forum / issue #81 — manifest version source of truth is release asset, not repo HEAD

### Tertiary (MEDIUM-LOW confidence)
- Obsidian forum: `openFile` + `setCursor` timing — community pattern, not official docs; flagged for implementation verification
- Wikipedia: Date and time notation in Netherlands — DD-MM-YYYY as official standard; separator ambiguity not definitively resolved

---
*Research completed: 2026-05-09*
*Ready for roadmap: yes*
