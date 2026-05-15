# Phase 7: Lifecycle & Compatibility - Research

**Researched:** 2026-05-15
**Domain:** Obsidian plugin view-lifecycle contracts, popout-window compatibility, TypeScript narrowing hygiene, Promise discipline
**Confidence:** HIGH (rule sources read directly from `node_modules/eslint-plugin-obsidianmd/dist/lib/rules`; Obsidian API types read from `node_modules/obsidian/obsidian.d.ts`)

## Summary

Phase 7 closes the lifecycle/popout/cast/promise cluster of Obsidian directory-scorecard findings — DIR-05, DIR-06, DIR-07, DIR-08 — plus BUG-07 (Settings modal closes on plugin toggle). The required fixes are well-defined by the `eslint-plugin-obsidianmd` rules themselves: each rule reports a precise message and a known good shape, and most rules ship auto-fixes. CONTEXT.md decisions (D-01 through D-13) lock the implementation pattern; this research confirms which decisions match the rules verbatim and flags **two contradictions** between CONTEXT.md decisions and the actual ESLint rule behavior that the planner MUST resolve before writing plans.

Live ESLint run with Phase 7 overrides disabled reports **53 problems (39 errors, 14 warnings)** across 8 files. Every violation maps to one of DIR-05/06/07/08; no surprises.

**Primary recommendation:** Follow CONTEXT.md decisions for the file-level edits (which assignments to delete, which helper to add, which lifecycle pattern to use), but override **D-03** and **D-04/D-06** where the rules contradict them: (1) the `obsidianmd/detach-leaves` rule REQUIRES removing the `detachLeavesOfType` call from `onunload`, not keeping it; (2) `obsidianmd/prefer-window-timers` REQUIRES `window.setTimeout`/`window.setInterval`, not `activeWindow.setTimeout`/`activeWindow.setInterval`. The discuss-phase author appears to have conflated `activeWindow` (correct for DOM ops) with the timer rule (which forbids `activeWindow.*` timers). The planner should flag these in the plan and the user confirms in pre-execute review.

## User Constraints (from CONTEXT.md)

### Locked Decisions

> Source: `.planning/phases/07-lifecycle-compatibility/07-CONTEXT.md` — `<decisions>` section.

**DIR-05 view access pattern:**
- **D-01:** Add a `getCalendarView(): CalendarView | null` private method on the `MemoChron` plugin class that does `this.app.workspace.getLeavesOfType(MEMOCHRON_VIEW_TYPE)[0]?.view` and returns it only if it passes an `instanceof CalendarView` check (otherwise `null`). The 5 callsites in `src/main.ts:167–188` call `this.getCalendarView()` and null-check the result.
- **D-02:** Delete the `calendarView: CalendarView` field on the plugin class entirely (`src/main.ts:20`). The `registerView` callback (line 47) becomes `(leaf) => new CalendarView(leaf, this)` — pure factory, no side-effect assignment.
- **D-03:** `onunload` teardown stays through `app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` which is already present and is the obsidianmd-recommended teardown path. The `detach-leaves` lint finding goes away once the leak field is removed (the rule fires because of the held reference, not the detach call). Verify after the field deletion.
  - **⚠ Conflicts with ESLint rule** — see Critical Conflicts section below.

**DIR-06 active-doc / active-window strategy:**
- **D-04:** Use the Obsidian globals `activeDocument` and `activeWindow` directly — not `this.app.workspace.activeWindow`.
- **D-05:** `setCss*Props`-adjacent reads: every `getComputedStyle(document.documentElement)` becomes `getComputedStyle(activeDocument.documentElement)`. The 14 sites split across SettingsTab.ts, CalendarView.ts, EmbeddedAgendaView.ts, viewRenderers.ts, colorValidation.ts.
- **D-06:** `window.setTimeout` / `window.setInterval` → `activeWindow.setTimeout` / `activeWindow.setInterval` at all 4 sites including the two plugin-context timers in `main.ts:202, 227`.
  - **⚠ Conflicts with ESLint rule** — see Critical Conflicts section below.
- **D-07:** No `app.workspace.activeWindow` indirection. Phase 7 commits to the globals.

**DIR-07 TFile narrowing:**
- **D-08:** Replace each `as TFile` with an `instanceof TFile` guard at the 4 sites — `CalendarView.ts:148, 828`; `EmbeddedCalendarView.ts:234`; `EmbeddedAgendaView.ts:383`.

**DIR-08 promise hygiene:**
- **D-09:** Three-bucket policy: `void` for fire-and-forget where caller doesn't care about errors; `.catch(error => new Notice(errorMessage(error)))` for sites where a user-visible error notice is the right outcome (dominant choice); `await` when the surrounding context is already async. Default for ambiguous sites: `.catch` with `errorMessage()`.
- **D-10:** `MarkdownRenderChild` async-lifecycle fix — synchronous wrapper around inner async helper. `EmbeddedCalendarView.ts:83` and `EmbeddedAgendaView.ts:74` `async onload()` become `onload(): void { void this.initialize(); }` where `initialize()` is a private async helper.

**Commit granularity (D-11):** Six atomic commits in order: (1) DIR-05 fix + BUG-07 verification, (2) DIR-06 active-doc + window-timers, (3) DIR-07 TFile narrowing, (4) DIR-08 promises + lifecycle, (5) BUG-07-CLOSURE.md if commit 1 didn't close it, (6) ESLint override removal, (7) HUMAN-UAT.md.

**UAT scope (D-12, D-13):** Desktop-only manual UAT with six mandatory steps; mobile UAT deferred to v1.16.

### Claude's Discretion

> Source: CONTEXT.md `<decisions>` section, "Claude's Discretion" block.

- Helper method name — `getCalendarView()` is the working name; `findCalendarView()` or `resolveCalendarView()` acceptable.
- Inner async helper name in embedded views — `initialize()` working name; `loadEvents()`, `renderAsync()` acceptable.
- Per-site classification of DIR-08 promises into the three buckets — planner makes the call at implementation time.
- Whether the 14 `getComputedStyle` reads share a tiny helper (e.g., `readAccentColor()`) or stay inline — default is to keep inline.
- Exact `BUG-07-CLOSURE.md` shape if needed — planner formats per D-12 contents.

### Deferred Ideas (OUT OF SCOPE)

> Source: CONTEXT.md `<deferred>` section.

- `window.moment` utility wrapper (FRAG-01) — deferred to v2.
- `jCal[2]` → `VALUE=DATE` parameter check (FRAG-02) — deferred to v2.
- Mobile-WebView UAT — deferred to v1.16.
- `Setting.addColorPicker` consolidation, drag-resize debouncing, settings-tab incremental render — deferred.
- Refactoring `CalendarView`'s per-event renderer to call into `viewRenderers.ts` — deferred from Phase 6.
- `prefer-active-doc` workspace-instance path (`this.app.workspace.activeWindow`) — not a Phase 7 concern.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIR-05 | `registerView` callback constructs and returns the `CalendarView` instance directly; no `plugin.calendarView = view` assignment occurs inside the callback; the view is fetched lazily from the workspace when other components need it | Confirmed by `obsidianmd/no-view-references-in-plugin` rule source (forbids `this.X = new <View>()` inside `registerView` factory). Canonical fetch pattern is `workspace.getLeavesOfType(TYPE)[0]?.view` with `instanceof CalendarView` narrowing — documented in Obsidian Developer Docs "Custom Views" page. |
| DIR-06 | All `document` references that should reflect the active popout use `activeDocument`; all `setTimeout` / `setInterval` calls that fire in a view context use `activeWindow.setTimeout` / `activeWindow.setInterval` (or the workspace-aware equivalent) | **REQUIREMENTS.md wording is misleading.** The `obsidianmd/prefer-window-timers` rule REQUIRES `window.setTimeout`, not `activeWindow.setTimeout` (verified by reading the rule source — `activeWindow.*` timers are explicitly invalid and auto-fixed to `window.*`). The DIR-06 success criterion language uses "or the workspace-aware equivalent" — `window.*` is that equivalent. `activeDocument` (not `document`) for non-timer DOM ops is correct. |
| DIR-07 | `git ls-files src/ | xargs grep -n 'as TFile'` returns zero matches; every consumer of `TAbstractFile` narrows via `instanceof TFile` first | Confirmed by `obsidianmd/no-tfile-tfolder-cast` rule message: "Avoid casting to 'TFile'. Use an 'instanceof TFile' check to safely narrow the type." Codebase audit confirms 4 sites; CONTEXT.md D-08 already enumerates them. |
| DIR-08 | `npm run lint` reports zero `@typescript-eslint/no-floating-promises` violations and zero "Promise-returning override on `MarkdownRenderChild` lifecycle method" findings; the Phase 5 ESLint overrides for these rules are removed | `MarkdownRenderChild` extends `Component`, and `Component.onload(): void` (verified in `obsidian.d.ts:1844`). `async onload()` returns `Promise<void>`, which violates the supertype's `void` return — caught by `@typescript-eslint/no-misused-promises` with `checksVoidReturn.inheritedMethods` (default `true`). |
| BUG-07 | Toggling MemoChron in Community Plugins should NOT close the Settings modal | **Confirmed Obsidian-core bug** in 1.12.2 — forum report [Settings modal closes when disabling a plugin's actively focused view](https://forum.obsidian.md/t/settings-modal-closes-when-disabling-a-plugins-actively-focused-view/111479) reproduces with BOTH core AND community plugins (graph view example given). Obsidian staff (WhiteNoise) acknowledged. Plugin-side has NO clean workaround if root cause is core. Closure note path (`BUG-07-CLOSURE.md`) is the documented exit. |

## Critical Conflicts: CONTEXT.md vs. ESLint Rules

> **The planner MUST resolve these two contradictions before writing plans.** Both are auto-fixable by ESLint, and the auto-fix output is the canonical Phase 7 end state.

### Conflict 1: D-03 vs. `obsidianmd/detach-leaves`

- **CONTEXT.md D-03 says:** "`onunload` teardown stays through `app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` which is already present and is the obsidianmd-recommended teardown path. The `detach-leaves` lint finding goes away once the leak field is removed (the rule fires because of the held reference, not the detach call)."
- **What the rule actually does** (verified by reading `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/detachLeaves.js`):
  - Rule walks every `onunload` MethodDefinition. For each statement of the form `this.detachLeavesOfType(...)` (or `this.app.workspace.detachLeavesOfType(...)`), it reports `messageId: "onunload"` with the exact message: *"Don't detach leaves in onunload, as that will reset the leaf to it's default location when the plugin is loaded, even if the user has moved it to a different location."*
  - **The rule is fixable** — the auto-fix DELETES the offending statement entirely.
  - Test fixture confirms: `code: 'class MyPlugin { onunload() { this.detachLeavesOfType("foo"); } }'` → `output: "class MyPlugin { onunload() {  } }"`.
  - Rule fires **independently** of whether a view reference is held — it triggers on the call site, not on the held reference. D-03's claim that "the rule fires because of the held reference" is incorrect.
  - Backing source: [Obsidian Plugin Guidelines § Don't detach leaves in onunload](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Don't+detach+leaves+in+%60onunload%60). Quote from the live docs (May 2026): *"When the user updates your plugin, any open leaves will be reinitialized at their original position, regardless of where the user had moved them."*

- **Recommended resolution:** **Delete the `detachLeavesOfType` call** from `src/main.ts:98` as part of Phase 7. Obsidian's workspace handles leaf cleanup automatically on plugin disable/update. Replace the body of `onunload()` with timer-cleanup only:

  ```typescript
  // BEFORE (current main.ts:97-101)
  onunload() {
    this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE);
    this.clearRefreshTimer();
    this.clearBackgroundRefreshTimer();
  }

  // AFTER (Phase 7 end state)
  onunload() {
    // Obsidian cleans up leaves automatically on disable/update.
    // Detaching here would reset user's leaf placement on every plugin reload.
    this.clearRefreshTimer();
    this.clearBackgroundRefreshTimer();
  }
  ```

- **BUG-07 implication:** This DIRECTLY addresses BUG-07. The hypothesis in CONTEXT.md `<specifics>` is correct: "the Community Plugins toggle disables MemoChron, which triggers `onunload`, which calls `detachLeavesOfType(MEMOCHRON_VIEW_TYPE)`. If the active Settings modal is somehow tied to that workspace leaf in older Obsidian builds, detaching it could close the modal." Removing the call is BOTH the directory-compliance fix AND the most likely BUG-07 fix. The Obsidian forum bug report ([forum link](https://forum.obsidian.md/t/settings-modal-closes-when-disabling-a-plugins-actively-focused-view/111479)) reproduces with **graph view (core)** — suggesting the modal-close behavior triggers when *any* leaf detach happens during plugin disable, not just MemoChron-specific code. Removing the explicit `detachLeavesOfType` may or may not be sufficient because Obsidian's internal cleanup still runs; planner should not promise BUG-07 closure on this commit, but the UAT step (D-12 step 3) settles it empirically.

### Conflict 2: D-04 / D-06 vs. `obsidianmd/prefer-window-timers`

- **CONTEXT.md D-06 says:** "`window.setTimeout` / `window.setInterval` → `activeWindow.setTimeout` / `activeWindow.setInterval` at all 4 sites including the two plugin-context timers in `main.ts:202, 227`."
- **What the rule actually does** (verified by reading `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/preferWindowTimers.js` and its test file `preferWindowTimers.test.js`):
  - Rule has **two error messages**: `preferWindowTimer` (for bare `setTimeout(...)` → fix to `window.setTimeout(...)`) and `noActiveWindowTimer` (for `activeWindow.setTimeout(...)` → fix to `window.setTimeout(...)`).
  - The exact `noActiveWindowTimer` message: *"Use 'window.{{name}}()' instead of 'activeWindow.{{name}}()'. Timer functions should use 'window'."*
  - Test fixture: `code: "activeWindow.setTimeout(() => {}, 100);"` → `output: "window.setTimeout(() => {}, 100);"` (auto-fix replaces `activeWindow` with `window`).
  - The `prefer-active-doc` rule ALSO has explicit logic to skip `window.setTimeout`/`window.clearTimeout`/`window.setInterval`/`window.clearInterval`/`window.requestAnimationFrame` (lines 57–63 of `preferActiveDoc.js`) — meaning the rule authors deliberately route timers through `window.`, not `activeWindow.`.
  - The asymmetry is intentional: `activeDocument` for DOM ops (so popout windows render correctly), but `window.*` for timer IDs (because timer ID pools are not guaranteed to be shared across windows on iOS WKWebView — already noted in `src/main.ts:218-220`).

- **Recommended resolution:** Keep `window.setTimeout` / `window.setInterval` / `window.requestAnimationFrame` at all 4 — wait, **6** — sites (the ESLint run found two additional `requestAnimationFrame` sites in `CalendarView.ts:967` and `EmbeddedAgendaView.ts:425` that CONTEXT.md missed). The current code at `main.ts:202` and `main.ts:227` is **already correct** for this rule — no change needed for those two timers. The rule fires only on:
  - `CalendarView.ts:79` — `window.setTimeout(...)` ← already correct
  - `SettingsTab.ts:1381` — bare `setTimeout(...)` ← needs `window.` prefix
  - `SettingsTab.ts:1783` — bare `setTimeout(...)` ← needs `window.` prefix
  - `CalendarView.ts:967` — bare `requestAnimationFrame(...)` ← needs `window.` prefix
  - `EmbeddedAgendaView.ts:425` — bare `requestAnimationFrame(...)` ← needs `window.` prefix

  Re-run the audit grep with the corrected pattern: `git ls-files src/ | xargs grep -nE '(^|[^.])\b(setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame)\b'` and verify each match has a `window.` prefix.

- **D-04 unchanged:** `activeDocument` for DOM-document operations (i.e., the 14 `getComputedStyle(document.documentElement)` sites) remains correct per the `prefer-active-doc` rule. The conflict is ONLY about timers.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plugin lifecycle (load/unload, view registration, timer setup) | Plugin entry (`main.ts`) | — | Single composition root; only place that calls `registerView` and owns the auto-refresh interval. |
| View construction | Plugin entry (factory) → View layer (instance) | — | `registerView` callback is the factory; the returned `CalendarView` instance is the view-layer concern. Phase 7 enforces clean separation (no plugin field). |
| View lookup at runtime | Plugin entry helper (`getCalendarView()`) | Workspace (data source) | Plugin helper centralizes the `getLeavesOfType(...)` + `instanceof CalendarView` lookup; workspace is the single source of truth. |
| DOM ops in views | View layer (CalendarView, Embedded*View) | Utils (`viewRenderers`, `colorValidation`) | Views call shared renderers; renderers read CSS variables from `activeDocument` to follow popout window theme. |
| Timer scheduling | Plugin entry (main.ts: auto-refresh, background-refresh) + View layer (CalendarView: startup timer) + Settings (SettingsTab: 2 sites) | — | Timers tied to the lifetime of their owning component; each owner manages its own clear. `window.*` not `activeWindow.*` (per rule). |
| File-system narrowing (TFile vs TFolder) | View layer (daily-note open sites) | — | Each `instanceof TFile` guard lives at the consumer that needs the narrow; no shared helper. |
| Async error handling | Service layer (Phase 2 `errorMessage()`) + View layer (`.catch` callsites) | — | Existing `errorMessage()` helper from `src/utils/errors.ts` is reused at every `.catch` callsite. |

## Standard Stack

### Core (already installed, no version bumps for this phase)

| Library | Installed Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `obsidian` | `latest` | Plugin API host (Plugin, View, MarkdownRenderChild, TFile, TFolder, Workspace) | Only Obsidian-plugin API. Verified types in `node_modules/obsidian/obsidian.d.ts`. |
| `eslint-plugin-obsidianmd` | `0.3.0` | Enforces the Phase 7 rule set | Official lint plugin; rules sourced directly from `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/`. |
| `typescript-eslint` | `^8.59.3` | Provides `@typescript-eslint/no-floating-promises`, `no-misused-promises`, `no-unnecessary-type-assertion` | Phase 5 already configured these. |
| `eslint` | `^9.39.4` | Lint runner. `npm run lint` script wraps `eslint src/`. | Phase 5 configured. |
| `typescript` | `^5.9.3` | Compiler. `tsc -noEmit` is the type-check gate during build. | Pre-installed. |

**Source verification:** [VERIFIED: `/Users/mike/code/memoChron/package.json` devDependencies, line-by-line read 2026-05-15]

### Supporting (in-repo helpers reused by Phase 7)

| Helper | Path | Purpose | When to Use |
|---------|------|---------|-------------|
| `errorMessage(err)` | `src/utils/errors.ts` | Normalizes unknown caught values to printable string | Every `.catch` callback in DIR-08 fixes |
| `MEMOCHRON_VIEW_TYPE` | `src/utils/constants.ts` | View-type identifier passed to `registerView`/`getLeavesOfType` | In `getCalendarView()` helper |
| `appHasDailyNotesPluginLoaded`, `getDailyNote`, `getAllDailyNotes`, `createDailyNote` | `obsidian-daily-notes-interface` | Daily-notes plugin integration | Already in use; `instanceof TFile` narrowing at consumer sites only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| Inline `if (view instanceof CalendarView)` per callsite | Helper method `getCalendarView()` | Inline at 5 sites = duplication; helper centralizes the narrowing | CONTEXT.md D-01 picks helper; planner agrees |
| `void` operator for fire-and-forget | `.catch(() => {})` empty-catch | `void` skips error reporting; `.catch(() => {})` actively swallows | CONTEXT.md D-09 picks `void` for true fire-and-forget, `.catch(...)` for user-visible errors |
| Inline `getComputedStyle(activeDocument.documentElement)` 14× | Shared `readAccentColor()` helper | Helper introduces indirection; 14 sites is workable | CONTEXT.md leaves to planner; default is keep inline |
| `Plugin.registerInterval()` for the auto-refresh timer | Owned `setInterval` handle | Phase 1 already documented why `registerInterval` is wrong here (it appends but never removes from internal cleanup list; iOS WKWebView quirks for setTimeout IDs). Existing pattern stays. | Keep current `window.setInterval` + manual `clearInterval` per `clearRefreshTimer()` |

**Installation:** No new packages — Phase 7 is pure refactor.

**Version verification:**
```bash
npm view eslint-plugin-obsidianmd version    # 0.3.0 confirmed in package.json
npm view typescript-eslint version           # 8.x installed
npm view obsidian version                    # "latest" (Obsidian API published continuously)
```
[VERIFIED: `package.json` 2026-05-15]

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────┐
                       │  Obsidian Workspace         │
                       │  - getLeavesOfType(TYPE)    │
                       │  - Plugin enable/disable    │
                       │  - Popout window manager    │
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                 ┌──────────────────────────────────────┐
                 │  MemoChron Plugin (src/main.ts)      │
                 │  - onload(): wire services           │
                 │  - registerView(TYPE, factory)       │
                 │  - getCalendarView() ◄── Phase 7 NEW │
                 │  - onunload(): clear timers only     │
                 │       (no detachLeavesOfType)        │
                 └──────────────┬───────────────────────┘
                                │
                 ┌──────────────┴───────────────┐
                 ▼                              ▼
        ┌────────────────┐            ┌─────────────────────┐
        │ Sidebar View   │            │ Embedded Views      │
        │ (CalendarView) │            │ (Embedded*View      │
        │                │            │  extends            │
        │  - registers   │            │  MarkdownRenderChild)│
        │    timers via  │            │                     │
        │    window.*    │            │  - onload(): void { │
        │  - reads       │            │      void this.     │
        │    activeDocu- │            │      initialize();  │
        │    ment        │            │    }                │
        └────────────────┘            └─────────────────────┘
                 │                              │
                 └──────────────┬───────────────┘
                                ▼
                 ┌──────────────────────────────┐
                 │  Shared Utilities            │
                 │  - viewRenderers.ts          │
                 │     uses activeDocument      │
                 │  - colorValidation.ts        │
                 │     uses activeDocument      │
                 │  - errors.ts                 │
                 │     errorMessage(err)        │
                 └──────────────────────────────┘
```

**Data flow for "popout window opens":**
1. User right-clicks pane → "Move to new window"
2. Obsidian moves the leaf to a new BrowserWindow; `activeDocument` and `activeWindow` globals now point to the new window's document/window
3. Existing renderer code re-runs (re-render on layout change); `getComputedStyle(activeDocument.documentElement)` now reads CSS variables from the popout's `<html>` — correct accent color in the popout's theme
4. Timer IDs created via `window.setTimeout` continue to fire on the original window (the timer ID pool is per-realm); the timer's callback runs in the original window context. Per Obsidian guidance and the `prefer-window-timers` rule, this is the intended behavior.

### Pattern 1: View-lookup helper for `registerView`

**What:** Centralize the workspace lookup with type narrowing in one helper.
**When to use:** Any time you need a typed reference to your custom view from inside the plugin class. Avoid storing the view as a plugin field.
**Example:**
```typescript
// Source: [CITED: Obsidian Dev Docs — Custom Views, plus eslint-plugin-obsidianmd no-view-references-in-plugin rule semantics]
private getCalendarView(): CalendarView | null {
  const leaves = this.app.workspace.getLeavesOfType(MEMOCHRON_VIEW_TYPE);
  const view = leaves[0]?.view;
  return view instanceof CalendarView ? view : null;
}

// Callsite pattern (5× in main.ts:166-189):
async refreshCalendarView(forceRefresh = false) {
  const view = this.getCalendarView();
  if (!view) return;
  await view.refreshEvents(forceRefresh);
}
```

### Pattern 2: Synchronous `onload` wrapper for MarkdownRenderChild

**What:** `MarkdownRenderChild.onload()` MUST return `void` (inherited from `Component.onload(): void` — verified in `obsidian.d.ts:1844`). Wrap async initialization in a `void`-prefixed call.
**When to use:** Any `MarkdownRenderChild` subclass that needs to do async work at startup.
**Example:**
```typescript
// Source: [VERIFIED: obsidian.d.ts:1830-1844 Component.onload(): void contract]
// [CITED: @typescript-eslint/no-misused-promises checksVoidReturn.inheritedMethods]
export class EmbeddedCalendarView extends MarkdownRenderChild {
  onload(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.render();
    } catch (error) {
      new Notice(errorMessage(error));
    }
  }
}
```

### Pattern 3: Three-bucket promise discipline

**What:** Every Promise-returning expression that isn't assigned must be classified into one of three handlers.
**When to use:** Every site flagged by `@typescript-eslint/no-floating-promises` or `no-misused-promises`.
**Examples:**
```typescript
// Source: [CITED: typescript-eslint.io/rules/no-floating-promises §ignoreVoid]
// Bucket 1 — true fire-and-forget (error is non-actionable)
void this.refreshEventsInBackground();

// Bucket 2 — user-visible failure (dominant choice in this codebase)
this.refreshEvents().catch((error) => new Notice(errorMessage(error)));

// Bucket 3 — sequential in async context
async someMethod() {
  await this.refreshEvents();
}

// For misused-promises in callback slots (e.g., addEventListener):
button.addEventListener("click", () => {
  void this.handleClick();
  // OR:
  this.handleClick().catch((err) => new Notice(errorMessage(err)));
});
```

### Pattern 4: `activeDocument` for DOM reads, `window.*` for timers

**What:** Use `activeDocument` for any DOM operation that must reflect the popout window. Use `window.*` for setTimeout/setInterval/requestAnimationFrame.
**Why the asymmetry:** `activeDocument` lets DOM ops follow the user's focus (popout vs main). Timer IDs are realm-specific and must be cleared with the same `clearTimeout`/`clearInterval` they were created with — the rule enforces `window.*` to avoid the ID-pool confusion documented at `src/main.ts:215-222`.
**Example:**
```typescript
// Source: [VERIFIED: eslint-plugin-obsidianmd preferActiveDoc.js + preferWindowTimers.js read 2026-05-15]
// Good:
const accent = getComputedStyle(activeDocument.documentElement)
  .getPropertyValue("--interactive-accent")
  .trim();

this.startupTimer = window.setTimeout(() => { /* ... */ }, 50);

// Bad (will fail lint after override removal):
const accent = getComputedStyle(document.documentElement)  // ← prefer-active-doc
  .getPropertyValue("--interactive-accent");

this.startupTimer = activeWindow.setTimeout(/* ... */);    // ← prefer-window-timers
                                                            // (rule explicitly forbids activeWindow timers)
```

### Pattern 5: `instanceof TFile` narrowing

**What:** Replace every `value as TFile` cast with `if (value instanceof TFile)` guard.
**When to use:** Any consumer of `TAbstractFile`, daily-notes return values, or `getAbstractFileByPath` results.
**Example:**
```typescript
// Source: [CITED: Obsidian Dev Docs Vault.md — "Check if TAbstractFile is File or Folder"]
// Site 1 — CalendarView.ts:148 (storing in a Map)
Object.entries(allDailyNotes).forEach(([dateStr, file]) => {
  if (file instanceof TFile) {
    this.dailyNotes.set(dateStr, file);
  }
});

// Sites 2-4 — *.ts:828/234/383 (opening a leaf)
if (dailyNote instanceof TFile) {
  const leaf = this.app.workspace.getLeaf("tab");
  await leaf.openFile(dailyNote);
}
```

### Anti-Patterns to Avoid

- **Storing view reference in plugin field:** `this.calendarView = new CalendarView(...)` inside `registerView` callback prevents garbage collection on view detach. Use `getLeavesOfType` lookup helper. [CITED: `obsidianmd/no-view-references-in-plugin`]
- **`detachLeavesOfType` in `onunload`:** Resets user's leaf position on every plugin reload/update. Obsidian cleans up automatically. [CITED: `obsidianmd/detach-leaves` + Obsidian Plugin Guidelines]
- **`activeWindow.setTimeout`:** Misuses popout-window globals for timer ID pool. Use `window.setTimeout`. [VERIFIED: `obsidianmd/prefer-window-timers`]
- **`document.querySelector` in view code:** Reads main window's document, not the popout's. Use `activeDocument.querySelector`. [VERIFIED: `obsidianmd/prefer-active-doc`]
- **`as TFile` cast:** Bypasses runtime check; folder fed to file-only code crashes at runtime. Use `instanceof TFile`. [VERIFIED: `obsidianmd/no-tfile-tfolder-cast`]
- **`async onload()` on MarkdownRenderChild:** Returns `Promise<void>` where supertype declares `void`. Use sync wrapper + `void this.initialize()`. [VERIFIED: `obsidian.d.ts:1844` + `@typescript-eslint/no-misused-promises`]
- **Floating Promise:** Lost rejections cause silent failures. Use `await`, `.catch(handler)`, or `void` operator. [CITED: `@typescript-eslint/no-floating-promises`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type narrowing for `TAbstractFile` | A `isTFile()` utility | Direct `instanceof TFile` at the callsite | The `instanceof` operator IS the narrow; a utility function would defeat TypeScript's flow analysis |
| Reading CSS variables | A custom CSS-variable getter | `getComputedStyle(activeDocument.documentElement).getPropertyValue(name).trim()` | Browser builtin; one line; already the established pattern at 13 of 14 sites in this codebase |
| Plugin teardown for leaves | Custom leaf-tracking + `detach()` calls | Empty `onunload()` body (timers + own resources only) | Obsidian's workspace handles leaf lifecycle on plugin disable/update. Manual detaches reset user's leaf position. |
| Error string from unknown thrown value | A custom error formatter | `errorMessage(err)` from `src/utils/errors.ts` | Already exists (Phase 2). 18 catch sites already use it. Adding a parallel formatter would fragment the pattern. |
| Sync wrapper for async lifecycle | A `Promise.resolve(...)` adapter | `void this.initialize()` with `private async initialize()` helper | Idiomatic; satisfies the `void` return type contract without runtime overhead; the `void` operator is the canonical "I intentionally ignore this Promise" marker per `typescript-eslint/no-floating-promises` docs |

**Key insight:** Phase 7 is almost entirely about removing custom solutions (held view ref, manual leaf detach, `as TFile` casts, `async onload`) in favor of platform-blessed patterns. The new code is shorter than the old code at every site.

## Runtime State Inventory

> Phase 7 is a code-only refactor with NO data migration, NO storage rename, NO config schema change. The five categories are inventoried explicitly per the research protocol.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 7 does not touch `data.json`, `calendar-cache.json`, or any persisted settings shape. Verified by grep over `MemoChronSettings` interface (`src/settings/types.ts`) and cache schema (`src/services/CalendarService.ts:14-26`) — no field affected. | None |
| Live service config | None — Phase 7 does not touch any external service. Auto-refresh interval continues to fire as before (just via `window.setInterval` instead of any other shape). | None |
| OS-registered state | None — no Task Scheduler / launchd / systemd / pm2 / CRON. Plugin is in-process inside Obsidian. | None |
| Secrets/env vars | None — plugin has no secrets. ICS feeds are fetched via Obsidian's `requestUrl`; no auth tokens stored or referenced. | None |
| Build artifacts | The `main.js` output bundle will change (esbuild rebuilds from source). `manifest.json` and `styles.css` are unchanged. Phase 7 does NOT bump the plugin version (per current `package.json` 1.14.0 — version bump happens at release time, not per phase). | Rebuild via `npm run build` before BRAT distribution / GitHub release. No data migration. |

**Nothing found in any category requiring data migration.** Phase 7's only "runtime state" surface is the auto-refresh timer ID, which is already cleared in `clearRefreshTimer()` and `clearBackgroundRefreshTimer()`. Changing the timer creation from `window.setInterval` to … `window.setInterval` (it's already correct) preserves the same handle type (`number`); the cleanup path is unchanged.

## Common Pitfalls

### Pitfall 1: `getLeavesOfType()` returns workspace leaves, not views

**What goes wrong:** Naive `getLeavesOfType(TYPE)[0]` returns a `WorkspaceLeaf`, not your `View` subclass. Calling `.refreshEvents()` on the leaf crashes.
**Why it happens:** The Obsidian API distinction between leaves (container) and views (content).
**How to avoid:** Always go through `leaf.view` and narrow with `instanceof YourViewClass`.
**Warning signs:** Type error or "function not found" at the callsite.

### Pitfall 2: `instanceof TFile` returning false even for files

**What goes wrong:** Daily-notes plugin returns a `TFile`-shaped object that fails `instanceof TFile` if a different Obsidian module version is loaded.
**Why it happens:** Rarely seen in practice. The community `obsidian-daily-notes-interface` package proxies to the user's installed daily-notes plugin and returns the same TFile constructor.
**How to avoid:** Trust `instanceof TFile`. If the narrowing returns `false`, the underlying value genuinely isn't a TFile — handle the null path.
**Warning signs:** Daily-note opens silently fail. Manual test: open Obsidian developer console, type `Object.getPrototypeOf(someDailyNote).constructor.name` — should return `"TFile"`.

### Pitfall 3: Settings modal closes on plugin toggle (BUG-07)

**What goes wrong:** Disabling MemoChron in Community Plugins closes the Settings modal.
**Why it happens:** Confirmed Obsidian-core behavior in 1.12.2 affecting **both core AND community plugins** ([forum report](https://forum.obsidian.md/t/settings-modal-closes-when-disabling-a-plugins-actively-focused-view/111479) reproduces with graph view). The Obsidian core code path that closes the actively focused leaf when a plugin is disabled also reaches the Settings modal.
**How to avoid:** The plugin-side mitigation is **removing the explicit `detachLeavesOfType` from `onunload`** (which Phase 7 does for the directory-compliance fix). If the modal still closes after that — which it may, since the same forum report shows core plugins reproduce it — close BUG-07 with a written explanation per CONTEXT.md D-12 step 3.
**Warning signs:** During UAT step 3, the Settings modal closes when the plugin toggle is clicked. Empirical UAT result is the source of truth.

### Pitfall 4: `void` operator does not handle rejections

**What goes wrong:** `void riskyAsyncCall();` looks like it handles the Promise. It does not — rejections still surface as unhandled.
**Why it happens:** `void` is purely syntactic — it tells the lint rule "I'm intentionally ignoring this", but the runtime rejection still fires.
**How to avoid:** Use `void` ONLY for fire-and-forget where the function itself handles its own errors internally. For user-initiated actions, use `.catch(error => new Notice(errorMessage(error)))`.
**Warning signs:** "Uncaught (in promise)" in dev console after a `void`-marked call.

### Pitfall 5: `prefer-window-timers` auto-fix silently rewrites `activeWindow.setTimeout`

**What goes wrong:** Running `npx eslint --fix` after the Phase 7 override is removed would silently change every `activeWindow.setTimeout` back to `window.setTimeout`. If a plan was written assuming `activeWindow.setTimeout`, the autofix would override the plan.
**Why it happens:** The rule is fixable; CONTEXT.md D-06 contradicts the rule.
**How to avoid:** Plan writes `window.setTimeout` from the start, per Conflict 2 resolution above.
**Warning signs:** Unexpected diff after `--fix` runs; failed lint after a "compliant" hand-edit.

### Pitfall 6: TypeScript-eslint `no-misused-promises` with `checksVoidReturn.inheritedMethods`

**What goes wrong:** `async onload()` on `MarkdownRenderChild` fails lint with "Promise-returning method provided where a void return was expected by extended/implemented type 'MarkdownRenderChild'".
**Why it happens:** `checksVoidReturn.inheritedMethods` defaults to `true` since `typescript-eslint` v6+. When `MarkdownRenderChild` inherits `Component.onload(): void`, overriding it with `Promise<void>` triggers the check.
**How to avoid:** D-10 pattern — sync wrapper + `void this.initialize()`.
**Warning signs:** Lint error specifically mentioning `MarkdownRenderChild` (or any other supertype with `: void`).

## Code Examples

Verified patterns from rule sources and Obsidian API:

### Phase 7 end-state for `src/main.ts`

```typescript
// Source: [VERIFIED: eslint-plugin-obsidianmd no-view-references-in-plugin + detach-leaves rule sources]
// Source: [VERIFIED: obsidianmd/prefer-window-timers — window.setInterval, not activeWindow]
import { Plugin } from "obsidian";
import { CalendarView } from "./views/CalendarView";
import { MEMOCHRON_VIEW_TYPE } from "./utils/constants";

export default class MemoChron extends Plugin {
  settings: MemoChronSettings;
  calendarService: CalendarService;
  noteService: NoteService;
  // calendarView field REMOVED — workspace is single source of truth
  private refreshTimer: number | null = null;
  private backgroundRefreshTimer: number | null = null;

  async onload() {
    await this.loadSettings();
    this.initializeServices();
    this.registerViews();
    // ...
  }

  private registerViews() {
    this.registerView(
      MEMOCHRON_VIEW_TYPE,
      (leaf) => new CalendarView(leaf, this)  // Pure factory — no side effect
    );
  }

  onunload() {
    // No detachLeavesOfType — Obsidian handles leaf cleanup automatically
    this.clearRefreshTimer();
    this.clearBackgroundRefreshTimer();
  }

  /**
   * Lazy lookup helper. Returns the live CalendarView from the workspace,
   * or null if no leaf is open. Replaces the leak-prone `this.calendarView` field.
   */
  private getCalendarView(): CalendarView | null {
    const leaves = this.app.workspace.getLeavesOfType(MEMOCHRON_VIEW_TYPE);
    const view = leaves[0]?.view;
    return view instanceof CalendarView ? view : null;
  }

  async refreshCalendarView(forceRefresh = false) {
    const view = this.getCalendarView();
    if (!view) return;
    await view.refreshEvents(forceRefresh);
  }

  // ... 4 more callsites with same pattern

  private setupAutoRefresh() {
    this.clearRefreshTimer();
    const intervalMs = this.settings.refreshInterval * 60 * 1000;
    this.refreshTimer = window.setInterval(  // window.*, NOT activeWindow.*
      () => {
        void this.refreshCalendarView();      // void operator: fire-and-forget OK
      },                                       //   (errors surface as Notice inside the chain)
      intervalMs
    );
  }
}
```

### Phase 7 end-state for `src/views/EmbeddedCalendarView.ts`

```typescript
// Source: [VERIFIED: obsidian.d.ts Component.onload(): void contract]
export class EmbeddedCalendarView extends MarkdownRenderChild {
  // ... constructor unchanged

  onload(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.render();
    } catch (error) {
      new Notice(errorMessage(error));
    }
  }

  private async handleDailyNoteOpen(date: Date): Promise<void> {
    // ...
    if (dailyNote instanceof TFile) {  // instanceof, not `as TFile`
      const leaf = this.plugin.app.workspace.getLeaf("tab");
      await leaf.openFile(dailyNote);
    }
  }
}
```

### Phase 7 end-state for `getComputedStyle` read

```typescript
// Source: [VERIFIED: obsidianmd/prefer-active-doc rule + 14 sites in src/]
// Before:
const accent = getComputedStyle(document.documentElement)
  .getPropertyValue("--interactive-accent")
  .trim();

// After:
const accent = getComputedStyle(activeDocument.documentElement)
  .getPropertyValue("--interactive-accent")
  .trim();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Storing view in plugin field | `getLeavesOfType` + `instanceof View` lookup | Documented in Obsidian Dev Docs since the popout-window feature (Obsidian 0.15.0+); enforced by `obsidianmd/no-view-references-in-plugin` since `eslint-plugin-obsidianmd` 0.1.x | Memory leak gone; popout-window views still findable |
| `detachLeavesOfType` in `onunload` | Empty `onunload` (or timers-only) | Documented in current Obsidian Plugin Guidelines page | User's leaf placement preserved across plugin updates |
| `document` / bare `setTimeout` | `activeDocument` for DOM ops; `window.setTimeout` for timers | Obsidian 0.15.0 introduced popout windows; rule enforcement followed | Popout-window plugins now render with correct theme; timer ID pool confusion avoided |
| `as TFile` cast | `instanceof TFile` narrowing | TypeScript best practice; reinforced by `obsidianmd/no-tfile-tfolder-cast` | Runtime-safe; folder crashes prevented |
| `async onload()` on MarkdownRenderChild | Sync `onload(): void { void this.init(); }` wrapper | `@typescript-eslint/no-misused-promises checksVoidReturn.inheritedMethods` default-on since v6+ | Lifecycle contract satisfied; async work still runs |

**Deprecated/outdated:**
- Inline `(this as any).calendarView = view` to work around the lint rule — DO NOT use. The rule reports the assignment, not the type — disabling type info doesn't disable the rule.
- `eslint-disable-next-line` to suppress the rules — Phase 5 deliberately moved all suppression into per-phase override blocks. Phase 7 closes its override block; no inline disables.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 4th `as TFile` site at `EmbeddedAgendaView.ts:383` opens to a leaf the same way the other 3 do | Code Examples / Phase 7 end-state | Low — file read at lines 370-385 confirms same shape |
| A2 | BUG-07 will likely fall out of removing `detachLeavesOfType` from `onunload` per CONTEXT.md `<specifics>` | Conflict 1 resolution | Medium — the forum report reproduces with core plugins, suggesting the bug exists at the Obsidian level independent of plugin code. UAT step 3 (D-12) is the empirical test. |
| A3 | The `prefer-window-timers` rule applies equally to all 6 timer sites (the 4 from CONTEXT.md + 2 `requestAnimationFrame` sites surfaced in the lint run) | Conflict 2 resolution | Low — rule source explicitly lists `requestAnimationFrame` in `TIMER_FUNCTIONS` set |
| A4 | The `errorMessage(error)` helper from Phase 2 returns a clean string for every error shape encountered in DIR-08 catch sites | Pattern 3 | Low — helper source is 3 lines, branches on `Error instanceof` cleanly |
| A5 | Obsidian's automatic leaf cleanup on plugin disable removes MemoChron's calendar leaf without leaving orphaned event listeners | Pattern 1 / Conflict 1 | Low — Obsidian's Component lifecycle (load/unload tree) is well-established; the registered `Component` machinery (registerEvent, registerDomEvent, registerInterval) handles cleanup on unload. ItemView lifecycle docs say "onClose" fires on detach. |

**Assumptions are tagged `[ASSUMED]` in the body text where they appear; this table summarizes them for the planner.**

## Open Questions

1. **Does removing `detachLeavesOfType` from `onunload` close BUG-07?**
   - What we know: The forum report reproduces with core plugins (graph view), suggesting the bug is in Obsidian core. CONTEXT.md `<specifics>` says removing the held reference (D-02) may close it.
   - What's unclear: Whether the explicit `detachLeavesOfType` call is what triggers the modal-close path, or whether Obsidian's internal leaf cleanup triggers the same path.
   - Recommendation: Empirical UAT (D-12 step 3). If it fixes BUG-07 — fold closure into commit 1 per D-11. If not — write `BUG-07-CLOSURE.md` per D-12 with reproduction steps + Obsidian version + evidence that core plugins reproduce it identically.

2. **Are there other floating-promise sites in the auto-fix path that the audit grep missed?**
   - What we know: ESLint reports exactly 39 errors + 14 warnings with Phase 7 overrides disabled.
   - What's unclear: Whether removing the Phase 7 override block could cascade reveal Phase 8 issues (e.g., a floating promise inside a function newly typed via removed type assertion).
   - Recommendation: Run `npm run lint` AFTER each of the 6 commits to verify the count goes down monotonically. The final commit (D-11 step 6) must hit zero.

3. **Does the Phase-8 `no-unused-vars` override block need adjustment after Phase 7 deletes the `calendarView` field?**
   - What we know: CONTEXT.md confirms the Phase-8 override block stays untouched. Deleting `calendarView: CalendarView` removes one identifier from `main.ts`.
   - What's unclear: Whether any `import { CalendarView }` in `main.ts` becomes unused (it does NOT — the import is still used in `registerView(..., (leaf) => new CalendarView(leaf, this))`).
   - Recommendation: Verify after commit 1 by running `npm run lint` — if a new `no-unused-vars` warning appears, the planner adjusts the import. CONTEXT.md already confirms `main.ts` is NOT in the Phase-8 unused-vars override list (the override scopes are: `CalendarService.ts`, `IcsImportService.ts`, `SettingsTab.ts`, `types.ts`, `viewRenderers.ts`, `CalendarView.ts`, `EmbeddedCalendarView.ts`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | esbuild + ESLint + tsc | ✓ | 26.x local / 18.x CI | — |
| npm | dependency mgmt | ✓ | included with Node | — |
| ESLint 9.x + `eslint-plugin-obsidianmd` 0.3.0 | Phase 7 lint gate | ✓ | 9.39.4 + 0.3.0 (verified in package.json) | — |
| TypeScript 5.x | type-check | ✓ | 5.9.3 | — |
| Obsidian desktop binary | Manual UAT step 1 (popout window), step 3 (Settings modal), step 5 (embedded views) | UAT reviewer's machine | ≥ 1.8.9 per `manifest.json minAppVersion` | None — UAT step cannot be automated. UAT MUST run on a desktop Obsidian build (mobile UAT deferred per D-13). |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Note:** No external services or runtimes beyond the developer's machine and Obsidian binary. Plugin builds offline; tests are manual; lint runs locally and in CI.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **ESLint 9.x + manual UAT** (no unit-test framework in this milestone — see `.planning/PROJECT.md` Out of Scope: "Test suite — deferred to QA-01 in v2 milestone") |
| Config file | `eslint.config.mjs` (Phase 5 DOC-01 deliverable) |
| Quick run command | `npm run lint` |
| Full suite command | `npm run lint && npm run build` (esbuild + tsc type-check via `--noEmit`) |

**Validation strategy:** Phase 7 inherits the milestone's "lint-as-validator" pattern from Phase 5. Each requirement maps to one or more lint rules + a grep audit + a manual UAT step. No unit tests are added; per `CLAUDE.md` and `.planning/PROJECT.md`, the test suite is QA-01, deferred to v2.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIR-05 | `registerView` callback is pure factory; `plugin.calendarView` field absent | lint + grep | `npx eslint src/main.ts` (must report zero `obsidianmd/no-view-references-in-plugin`); `git ls-files src/ \| xargs grep -nE 'this\.(calendarView|calendarView\s*=)'` returns zero matches | ✅ ESLint + grep work today |
| DIR-05 | `detachLeavesOfType` removed from `onunload` (per Conflict 1 resolution) | lint + grep | `npx eslint src/main.ts` (must report zero `obsidianmd/detach-leaves`); `git ls-files src/ \| xargs grep -n 'detachLeavesOfType'` returns zero matches | ✅ |
| DIR-06 | All `document.X` in view code replaced by `activeDocument.X` | lint + grep | `npx eslint src/` (must report zero `obsidianmd/prefer-active-doc`); audit: `git ls-files src/ \| xargs grep -nE '(^\|[^.a-zA-Z_])document\.'` reviewed for remaining sites — each must be intentional non-view context | ✅ |
| DIR-06 | All `setTimeout`/`setInterval`/`requestAnimationFrame` use `window.X` (per Conflict 2 resolution) | lint + grep | `npx eslint src/` (zero `obsidianmd/prefer-window-timers`); `git ls-files src/ \| xargs grep -nE '(^\|[^.])\b(setTimeout\|setInterval\|clearTimeout\|clearInterval\|requestAnimationFrame)\b' \| grep -v 'window\.'` returns zero non-`window.` matches | ✅ |
| DIR-07 | Zero `as TFile` casts | lint + grep | `npx eslint src/` (zero `obsidianmd/no-tfile-tfolder-cast`); `git ls-files src/ \| xargs grep -n 'as TFile'` returns zero matches (success criterion #3 verbatim) | ✅ |
| DIR-08 | Zero floating promises | lint | `npx eslint src/` (zero `@typescript-eslint/no-floating-promises`) | ✅ |
| DIR-08 | Zero `MarkdownRenderChild` `async onload`/`async onunload` | lint | `npx eslint src/` (zero `@typescript-eslint/no-misused-promises` of the `inheritedMethods` shape) | ✅ |
| DIR-08 | Phase 7 ESLint override block deleted | grep | `grep -n 'no-view-references-in-plugin' eslint.config.mjs` returns zero matches; `grep -nE 'no-floating-promises|no-misused-promises|no-tfile-tfolder-cast|prefer-active-doc|prefer-window-timers|detach-leaves|no-unnecessary-type-assertion' eslint.config.mjs` returns ONLY references in comments (or zero matches if comments stripped) | ✅ |
| BUG-07 | Settings modal persists when MemoChron is toggled in Community Plugins | manual UAT | D-12 step 3 — not automated. EITHER UAT passes (modal stays open) OR `BUG-07-CLOSURE.md` is committed with reproduction steps + Obsidian version + evidence of Obsidian-side root cause | manual-only ❌ Wave 0 |
| Popout-window rendering | Calendar grid + accent colors + nav + timers fire correctly in popout window | manual UAT | D-12 step 1 — not automated | manual-only ❌ Wave 0 |
| Daily-note open from sidebar agenda, embedded calendar, embedded agenda | Click opens the correct daily note | manual UAT | D-12 step 2 — not automated | manual-only ❌ Wave 0 |
| Sidebar parity with v1.14.0 | No visual regression | manual UAT | D-12 step 4 — visual inspection vs v1.14.0 baseline | manual-only ❌ Wave 0 |
| Embedded views parity | Code-block calendar/agenda render unchanged | manual UAT | D-12 step 5 | manual-only ❌ Wave 0 |
| Lint gate | `npm run lint` exits 0 | automated | `npm run lint` (D-12 step 6) | ✅ |

### Sampling Rate

- **Per task commit:** `npm run lint` (full run; <10s on this codebase) — verifies the just-edited files plus all rules across `src/`. Commit must not regress the lint count.
- **Per wave merge:** Same — `npm run lint` exit code 0 is the merge gate, plus `npm run build` to confirm esbuild + tsc still produce a clean bundle.
- **Phase gate:** Full `npm run lint && npm run build` clean + D-12's six-step manual UAT before `/gsd-verify-work`. UAT evidence committed to `07-HUMAN-UAT.md` per D-12.

### Wave 0 Gaps

> Wave 0 is the planning's pre-implementation wave for filling test/infrastructure gaps.

- [ ] Manual UAT script template — copy from `06-HUMAN-UAT.md` (Phase 6) which already established the no-screenshot live-walkthrough pattern. New file: `.planning/phases/07-lifecycle-compatibility/07-HUMAN-UAT.md`.
- [ ] BUG-07-CLOSURE.md template — only created if D-12 step 3 fails. Skeleton: reproduction steps, Obsidian version (`Obsidian → About`), OS, evidence section that core plugins (e.g., graph view) reproduce the same modal-close — citing forum thread [Settings modal closes when disabling a plugin's actively focused view](https://forum.obsidian.md/t/settings-modal-closes-when-disabling-a-plugins-actively-focused-view/111479).
- [ ] No test framework install needed (none in scope per milestone).

*(Per project decision: no unit tests added in v1.15. QA-01 deferred to v2.)*

## Security Domain

> Project has `security_enforcement` defaulted (not explicitly disabled in config.json). Phase 7 is a lifecycle/promise/type refactor with no security implications. ASVS categories surveyed for relevance:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Plugin has no auth; ICS feeds are public-URL only |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Obsidian's permission model applies; plugin honors `requestUrl()` for proxy-aware HTTPS |
| V5 Input Validation | yes (existing — Phase 2 DIR-02 handled) | Color validation via `isValidColor` (`src/utils/colorValidation.ts`); ICS parsing via `ical.js`; URL validation deferred (not Phase 7 scope) |
| V6 Cryptography | no | No crypto in plugin |

**Phase 7 changes that touch security:** None.
- DIR-05 fix (removing held view ref) has no security implication.
- DIR-06 fix (`activeDocument` for CSS reads) only reads computed styles — no DOM injection.
- DIR-07 fix (TFile narrowing) is strictly type-safety — actually IMPROVES robustness against malformed daily-note returns.
- DIR-08 fix (promise hygiene) prevents silent rejections that could mask security-relevant failures elsewhere — net positive but not a security control on its own.

### Known Threat Patterns for Obsidian plugin

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious ICS feed injecting HTML | Tampering (XSS) | Already mitigated Phase 6 DIR-02 (no innerHTML) and Phase 2 (color validation). Phase 7 doesn't reintroduce. |
| Remote-code execution from plugin update | Spoofing/Elevation | Obsidian's plugin signing (DIR-12, complete) handles this. Phase 7 ships no new attack surface. |
| Data exfiltration via unauthorized network request | Information Disclosure | All network through `requestUrl()`; no new fetches in Phase 7. |

## Sources

### Primary (HIGH confidence)

- [VERIFIED: `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/detachLeaves.js`] — `obsidianmd/detach-leaves` rule source read directly 2026-05-15: removes `this.detachLeavesOfType(...)` calls from `onunload`. Message: *"Don't detach leaves in onunload, as that will reset the leaf to it's default location when the plugin is loaded, even if the user has moved it to a different location."*
- [VERIFIED: `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/preferWindowTimers.js`] — Two messages: `preferWindowTimer` (bare → `window.*`) and `noActiveWindowTimer` (`activeWindow.* → window.*`). Tests at `dist/tests/preferWindowTimers.test.js` confirm `activeWindow.setTimeout` is INVALID.
- [VERIFIED: `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/preferActiveDoc.js`] — Explicit skip for `window.setTimeout`/`window.clearTimeout`/`window.setInterval`/`window.clearInterval`/`window.requestAnimationFrame` (lines 57-63) confirms the asymmetry: `activeDocument` for DOM, `window.*` for timers.
- [VERIFIED: `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/noViewReferencesInPlugin.js`] — Rule fires on `this.X = new View(...)` (or aliased `self.X = ...`) inside `registerView` factory body. Type-aware via `getParserServices`.
- [VERIFIED: `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/noTFileTFolderCast.js`] — Fires on `value as TFile` and `<TFile>value`. NOT auto-fixable (intentional — narrowing requires control-flow change).
- [VERIFIED: `node_modules/obsidian/obsidian.d.ts:1830-1857`] — `Component.onload(): void;` and `Component.onunload(): void;` are the supertype contracts; `MarkdownRenderChild extends Component` (line 3970).
- [VERIFIED: `node_modules/eslint-plugin-obsidianmd/package.json` v0.3.0] — Installed plugin version.
- [VERIFIED: `npx eslint src/` run 2026-05-15 with Phase 7 overrides disabled] — Concrete violation inventory: 39 errors + 14 warnings across 8 files.
- [CITED: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Don't+detach+leaves+in+`onunload`] — Obsidian's official guideline confirming `detach-leaves` rule rationale.
- [CITED: https://docs.obsidian.md/Plugins/Guides/Support+pop-out+windows] — Active document / active window contract.
- [CITED: Context7 `/obsidianmd/obsidian-developer-docs` query "MarkdownRenderChild onload onunload lifecycle async return type" 2026-05-15] — Confirms `Component.onload(): void` and `MarkdownRenderChild` inheritance.

### Secondary (MEDIUM confidence)

- [CITED: https://typescript-eslint.io/rules/no-floating-promises/ #ignoreVoid] — Three acceptable handlers: `await`, `.then`/`.catch`, `void` operator. `void` is "intentionally not awaited" syntactic marker (does not actually handle rejection).
- [CITED: https://typescript-eslint.io/rules/no-misused-promises/] — `checksVoidReturn.inheritedMethods` is the option triggering `MarkdownRenderChild` `async onload()` failure. Default-on since v6+.
- [CITED: https://forum.obsidian.md/t/settings-modal-closes-when-disabling-a-plugins-actively-focused-view/111479] — Confirmed Obsidian 1.12.2 bug: Settings modal closes when disabling any plugin (core OR community) whose view is focused. Acknowledged by moderator `WhiteNoise`. No published fix as of 2026-05-15. **Evidence basis for BUG-07 closure note (if needed).**

### Tertiary (LOW confidence — verified via secondary)

- [WebSearch 2026-05-15: "eslint-plugin-obsidianmd no-view-references-in-plugin"] — Confirmed independently against rule source.
- [WebSearch 2026-05-15: "Obsidian plugin detachLeavesOfType onunload bad practice"] — Confirmed independently against rule source and Obsidian docs page.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified by reading `package.json` and `node_modules/*/package.json`.
- Architecture: HIGH — rule sources read directly from `node_modules`; Obsidian API types verified in `obsidian.d.ts`.
- Pitfalls: HIGH — pitfalls 1-2, 4-6 verified from rule source + TypeScript ESLint docs; pitfall 3 (BUG-07) HIGH-MEDIUM — forum report is single-source but corroborates with rule-source reasoning (the `detachLeavesOfType` call IS what the rule flags) and reproduces with core plugins (confirming Obsidian-side cause).
- Code examples: HIGH — every snippet derived from the file-level diff shape mandated by rule auto-fix output or CONTEXT.md.
- Conflicts (D-03, D-06): HIGH — rule sources read line-by-line and corroborated by rule unit tests in the same package.

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (30 days for stable Obsidian API + `eslint-plugin-obsidianmd` 0.3.0; if a 0.4.x release lands during the phase, re-verify the timer rule has not changed shape)
