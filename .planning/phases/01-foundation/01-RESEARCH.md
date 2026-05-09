# Phase 1: Foundation — Research

**Researched:** 2026-05-09
**Domain:** Obsidian Plugin API lifecycle, TypeScript getter patterns, DOM event cleanup
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Live-settings pattern (TD-01, TD-02)**
- D-01: Both `CalendarService` and `NoteService` take `(plugin: MemoChron)` only as their constructor argument. `NoteService` no longer takes `app` separately — it reads `this.plugin.app` and `this.plugin.settings`.
- D-02: `CalendarService` drops the cached `private refreshMinutes` field. `needsRefresh()` reads `this.plugin.settings.refreshInterval` live.
- D-03: `NoteService` adds `private get settings(): MemoChronSettings { return this.plugin.settings; }` so all existing `this.settings.x` references resolve live with zero call-site churn.
- D-04: `main.ts` `initializeServices()` is updated to pass only `this` to both services. The `refreshInterval` argument to `new CalendarService(...)` is removed.

**Timeout & onunload (TD-03)**
- D-05: Every `window.setTimeout`/`setInterval` is wrapped in `registerInterval(...)`:
  - `setupAutoRefresh` in `main.ts:168` wraps the existing `window.setInterval` in `this.registerInterval(...)`. The manual `refreshTimer` handle stays — it's needed to `clearInterval` on `saveSettings()` reset. `registerInterval` is belt-and-suspenders for unload.
  - `CalendarService.scheduleBackgroundRefresh` 100ms `setTimeout` is registered via `this.plugin.registerInterval(window.setTimeout(...))`.
  - `CalendarView.onOpen` 50ms `setTimeout` is registered via `this.registerInterval(window.setTimeout(...))` (CalendarView is a Component, so `registerInterval` is on its own instance).
- D-06: Timing values (50ms, 100ms) are NOT changed in this phase. PERF-04 is deferred.
- D-07: `onunload` calls `this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` so `CalendarView.onClose()` fires deterministically on plugin disable. `clearRefreshTimer()` continues to be called for symmetry. No `dispose()` API on services — `registerInterval` covers all timer cleanup.

**Drag teardown (TD-04)**
- D-08: `CalendarView` adds `private isDragging = false`. `handleDragStart` sets it true; `handleDragEnd` sets it false.
- D-09: Override `CalendarView.onClose()` to detach the two `window` listeners (`mousemove`/`mouseup`) and clear `isDragging` if it's true. Listener removal only — do NOT call `handleDragEnd` itself, because that path runs `snapToCurrentViewMode()` → `saveSettings()` → `refreshCalendarView()`, which would race against view teardown.

**Dead-code scope (CLEAN-01)**
- D-10: Strict to the named symbols: `calculateEndDate` (private method in `CalendarService`), `DEFAULT_TEMPLATE_PATH` and `TEMPLATE_VARIABLES` (constants in `src/utils/constants.ts`), unused `App`/`TFile` imports (in `EmbeddedCalendarView` and `EmbeddedAgendaView`), and the unused `renderAgendaList` import in `EmbeddedAgendaView`.
- D-11: The `renderAgendaList` function in `src/utils/viewRenderers.ts` is left intact unless verified by grep to have zero remaining callers. Removing it is out of scope for this phase.

### Claude's Discretion
- Commit granularity: planner decides (per-requirement atomic commits is the GSD default).
- Verification approach: code review of cleanup paths + manual exercise (no test suite in scope).
- Whether to consolidate `CalendarService` and `NoteService` constructor changes into one commit or split: planner's call.

### Deferred Ideas (OUT OF SCOPE)
- PERF-04 — Replacing 50/100ms timeouts with `requestAnimationFrame` / `requestIdleCallback`.
- FRAG-03 — `hasSourceMismatch` URL-canonical refactor.
- `renderAgendaList` function removal in `viewRenderers.ts`.
- `addEventListener` → `registerDomEvent` audit outside drag handlers.
- `CalendarService` decoupling from plugin.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TD-01 | `CalendarService` cache-expiry checks read the live `refreshInterval` from settings — no stale constructor copy | D-02: Drop `refreshMinutes` field; `needsRefresh()` reads `this.plugin.settings.refreshInterval` directly |
| TD-02 | `NoteService` reads the live settings object via plugin reference or getter | D-01/D-03: Constructor takes `(plugin: MemoChron)` only; getter `get settings()` provides zero-churn live access |
| TD-03 | All `setTimeout` calls in `CalendarService.scheduleBackgroundRefresh` and `CalendarView.onOpen` are tracked and cancelled on plugin unload / view close | D-05/D-07: `registerInterval` on Plugin and Component; `detachLeavesOfType` in `onunload` |
| TD-04 | `mousemove` / `mouseup` listeners attached to `window` during drag are cleaned up if `CalendarView` is destroyed mid-drag | D-08/D-09: `isDragging` flag + `onClose` override removes `handleDragMoveBound`/`handleDragEndBound` |
| CLEAN-01 | Dead code removed: `calculateEndDate`, unused imports, unused constants | D-10/D-11: Targeted removal of exactly named symbols; grep-verified zero callers |
</phase_requirements>

---

## Summary

Phase 1 is a pure internal hygiene phase with no user-visible change. All five requirements are mechanical edits to existing code — no new dependencies, no new abstractions, no new files. The work splits cleanly across three concerns: (1) live-settings access in both services, (2) tracked timers in `main.ts`, `CalendarService`, and `CalendarView`, and (3) removal of four precisely-identified dead-code symbols plus the `isDragging`/`onClose` guard for drag teardown.

The Obsidian API provides all necessary primitives already present in the codebase's own type definitions. `registerInterval` is a `Component` method (Plugin and ItemView both extend Component) that accepts the numeric handle returned by `window.setInterval` or `window.setTimeout` and cancels it on component unload. `detachLeavesOfType` is a `Workspace` method that removes all leaves of a given view type and fires each leaf's `View.onClose()` synchronously before returning. TypeScript getter syntax prevents the proposed `private get settings()` in `NoteService` from being shadowed by an instance field of the same name — the TypeScript compiler enforces this at compile time.

The most important planning constraint is the **dual-handle pattern for `setupAutoRefresh`**: `registerInterval` is added as belt-and-suspenders for unload correctness, but the manual `this.refreshTimer` handle is **kept** because `saveSettings()` needs to call `clearInterval(this.refreshTimer)` before recreating the interval with a new rate. These two mechanisms serve different purposes and must both exist after this phase.

**Primary recommendation:** Implement each requirement as one atomic commit in requirement order (TD-01 → TD-02 → TD-03 → TD-04 → CLEAN-01), with TypeScript type-check + esbuild build verification after each commit.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Live-settings access in CalendarService | Service Layer | Plugin Entry | `CalendarService` reads settings at check time; Plugin owns the authoritative `settings` object |
| Live-settings access in NoteService | Service Layer | Plugin Entry | `NoteService` uses getter to delegate to Plugin's live `settings` — zero view-layer involvement |
| Timer registration and cancellation | Plugin Entry (main.ts) | View Layer (CalendarView) | `Plugin` and `Component` are the Obsidian-managed owners of `registerInterval` scope |
| Drag listener cleanup | View Layer (CalendarView) | — | Window event listeners were added by the view; the view's `onClose` is the correct cleanup point |
| Dead code removal | All affected files | — | Symbol-scoped deletion; no tier reassignment required |

---

## Standard Stack

### Core (in-scope for this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian (Plugin API) | latest (types: 0.15+) | `registerInterval`, `detachLeavesOfType`, `View.onClose`, `Component.register` | All phase changes use these primitives; they are the Obsidian-canonical cleanup mechanism |
| TypeScript | 4.7.4 (in project) | Getter accessor syntax, strict null checks, `noImplicitAny` | Already in use; getter correctness verified at compile time |

No new packages are introduced in this phase.

**Build verification commands:**
```bash
# Type check (no emit)
node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck

# Production bundle
node esbuild.config.mjs production
```

Note: `npm run build` fails on this machine due to a Node.js 26 + local `tsc` binary path issue (`MODULE_NOT_FOUND` for the `.bin/tsc` shim). Use the two commands above directly. Both currently exit 0 on the unmodified codebase. [VERIFIED: local build run]

---

## Architecture Patterns

### System Architecture Diagram

```
[Obsidian plugin host — disable event]
        |
        v
MemoChron.onunload()
  ├── clearRefreshTimer()          -- manual handle for resettable interval
  ├── detachLeavesOfType(...)      -- triggers CalendarView.onClose()
  └── (registerInterval auto-cancels all registered timers)
             |
             v
     CalendarView.onClose()
       ├── if isDragging:
       │     window.removeEventListener('mousemove', handleDragMoveBound)
       │     window.removeEventListener('mouseup',   handleDragEndBound)
       │     isDragging = false
       └── (return Promise<void>)

[Settings save path]
saveSettings()
  ├── saveData(settings)
  ├── setupAutoRefresh()           -- clearInterval(refreshTimer), new setInterval wrapped in registerInterval
  └── refreshCalendarView()

[CalendarService.needsRefresh() — live read]
  reads: this.plugin.settings.refreshInterval   (not stale refreshMinutes field)

[NoteService.buildFilePath() etc — live read via getter]
  this.settings  -->  private get settings() { return this.plugin.settings; }
```

### Recommended Project Structure

No structural changes in this phase. All edits are within existing files:

```
src/
├── main.ts                        # +registerInterval, +detachLeavesOfType
├── services/
│   ├── CalendarService.ts         # -refreshMinutes field, +live read in needsRefresh, +plugin.registerInterval in scheduleBackgroundRefresh
│   └── NoteService.ts             # constructor: (app,settings) → (plugin), +settings getter, +app via plugin
├── views/
│   ├── CalendarView.ts            # +isDragging flag, +onClose override, +registerInterval on 50ms timeout
│   ├── EmbeddedCalendarView.ts    # -App import
│   └── EmbeddedAgendaView.ts      # -TFile import, -renderAgendaList import
└── utils/
    └── constants.ts               # -DEFAULT_TEMPLATE_PATH, -TEMPLATE_VARIABLES
```

### Pattern 1: `registerInterval` as Belt-and-Suspenders

**What:** Wrap `window.setInterval`/`window.setTimeout` in `this.registerInterval(...)`. The return value of `registerInterval` is the same numeric ID. The Plugin (and CalendarView via ItemView → Component) auto-cancels all registered IDs on unload.

**When to use:** Every timer that must not fire after plugin unload or view close.

**Example:**
```typescript
// Source: https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Reference/TypeScript API/Component/registerInterval.md
// In Plugin (main.ts) — belt-and-suspenders: manual handle ALSO kept for saveSettings() reset
this.refreshTimer = this.registerInterval(
  window.setInterval(() => this.refreshCalendarView(), intervalMs)
);

// In CalendarService (via plugin reference) — setTimeout one-shot
this.plugin.registerInterval(
  window.setTimeout(() => this.fetchCalendars(sources, true), 100)
);

// In CalendarView (Component subclass) — setTimeout one-shot
this.registerInterval(
  window.setTimeout(() => {
    this.selectedDate = today;
    // ...
  }, 50)
);
```

**Key constraint:** `registerInterval` accepts the numeric handle from `window.setInterval` or `window.setTimeout`. Both return numbers in the browser environment. The return value of `registerInterval` is that same number. [VERIFIED: obsidian.d.ts line 946: `registerInterval(id: number): number`]

### Pattern 2: TypeScript Getter for Live-Settings Access

**What:** Define a property getter in `NoteService` that delegates to `this.plugin.settings`. Because TypeScript disallows having both a getter and an instance field of the same name in the same class, this is enforced at compile time.

**When to use:** When a class has many `this.settings.x` references that should all be live but call-site refactoring is out of scope.

**Example:**
```typescript
// NoteService after D-01/D-03
export class NoteService {
  constructor(private plugin: MemoChron) {}

  private get settings(): MemoChronSettings {
    return this.plugin.settings;
  }

  // All 14 existing `this.settings.x` references continue to work
  // All 6 existing `this.app.x` references become `this.plugin.app.x`
  // — there is no `private app` field any more; the compiler will error
  //   if any `this.app` reference remains, making the refactor safe
}
```

**TypeScript rule:** [VERIFIED: TypeScript 4.7.4 spec — you cannot declare both an accessor (getter/setter) and a property with the same name in a class body; the compiler emits TS2403.] The constructor parameter shorthand `private plugin: MemoChron` creates a field named `plugin`, not `settings`, so there is no conflict.

### Pattern 3: `onClose` Override for Mid-Drag Cleanup

**What:** Override `View.onClose()` in `CalendarView` to remove `window` listeners that may still be attached if the view is destroyed during a drag.

**When to use:** Any `View` that attaches raw `addEventListener` to objects outside its own DOM subtree (i.e., `window`, `document`).

**Signature:** `protected async onClose(): Promise<void>` [VERIFIED: obsidian.d.ts line 4592]

**Example:**
```typescript
protected async onClose(): Promise<void> {
  if (this.isDragging) {
    window.removeEventListener("mousemove", this.handleDragMoveBound);
    window.removeEventListener("mouseup", this.handleDragEndBound);
    this.isDragging = false;
  }
}
```

**Why not call `handleDragEnd` directly:** `handleDragEnd` calls `snapToCurrentViewMode()` → `saveSettings()` → `refreshCalendarView()` → `calendarView.refreshEvents()`. Calling `refreshEvents()` on a view that is in the middle of being closed races against Obsidian's view teardown sequence and may throw. Listener-removal-only is the correct pattern. [VERIFIED: code trace through CalendarView.ts lines 1077-1110]

### Pattern 4: `detachLeavesOfType` for Deterministic View Close

**What:** `this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` removes all leaves of the given view type and fires `onClose()` on each one before the call returns.

**When to use:** In `Plugin.onunload()` when you need to guarantee that your custom `View.onClose()` cleanup runs on plugin disable.

**Rationale:** Without this call, Obsidian may or may not fire `View.onClose()` when the plugin is disabled depending on whether the view leaf is still in the workspace layout. The explicit call is deterministic. [VERIFIED: Obsidian developer docs — `detachLeavesOfType` removes all leaves of the given type; View.onClose() is called for each removed leaf]

**Example:**
```typescript
onunload() {
  this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE);
  this.clearRefreshTimer();
}
```

### Anti-Patterns to Avoid

- **Calling `registerInterval` on `CalendarService` directly:** `CalendarService` is not a `Component`. It must use `this.plugin.registerInterval(...)` to borrow the plugin's registration scope.
- **Removing the manual `refreshTimer` handle:** `saveSettings()` calls `clearInterval(this.refreshTimer)` before recreating the interval. Without the handle, `setupAutoRefresh()` would not be able to cancel the previous interval on settings change, causing duplicate auto-refresh timers.
- **Calling `handleDragEnd` from `onClose`:** See Pattern 3 rationale — this path triggers async state mutations on a closing view.
- **Removing `renderAgendaList` from `viewRenderers.ts`:** D-11 explicitly keeps the function. Only the import in `EmbeddedAgendaView.ts` is removed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timer cancellation on plugin unload | Custom cleanup registry | `this.registerInterval(window.setInterval(...))` | Obsidian's Component base class already manages a cleanup list; belt-and-suspenders with zero extra code |
| DOM event cleanup on view close | Manual `removeEventListener` tracking list | `this.registerDomEvent(el, event, handler)` | Already used in `SettingsTab`; auto-removed on component unload. Note: for `window` listeners in drag handlers, `removeEventListener` in `onClose` remains appropriate since `registerDomEvent` does not support `window` targets in the same way |
| Live settings propagation to services | Observer pattern, event bus, settings change callback | TypeScript getter delegating to `this.plugin.settings` | `plugin.settings` is mutated in-place by `saveSettings()`; a getter is a single line with zero observable overhead |

**Key insight:** Obsidian's `Component` lifecycle methods (`registerInterval`, `registerDomEvent`, `register`) exist precisely to eliminate manual cleanup bookkeeping. They are the idiomatic solution for every timer and DOM event in this phase.

---

## Common Pitfalls

### Pitfall 1: Forgetting the Manual `refreshTimer` Handle Serves a Different Purpose Than `registerInterval`

**What goes wrong:** Developer wraps `setInterval` in `registerInterval` and removes `this.refreshTimer`, assuming `registerInterval` handles everything.

**Why it happens:** `registerInterval` does cancel on unload. But `saveSettings()` explicitly calls `clearInterval(this.refreshTimer)` before creating a new interval to avoid duplicate timers when the user changes the refresh rate.

**How to avoid:** Keep `this.refreshTimer = this.registerInterval(window.setInterval(...))`. The assignment to `refreshTimer` gives `setupAutoRefresh` a handle to cancel before recreating. `registerInterval` provides the unload guarantee. Both are needed.

**Warning signs:** If `refreshTimer` is `null` when `setupAutoRefresh` tries to clear it on second invocation, you may get duplicate refresh timers accumulating each time settings are saved.

### Pitfall 2: `app` Access After NoteService Constructor Change

**What goes wrong:** After changing NoteService constructor from `(app: App, settings: MemoChronSettings)` to `(plugin: MemoChron)`, references to `this.app` in NoteService methods still exist and cause a compile error.

**Why it happens:** There are 6 `this.app` references in `NoteService.ts`. The constructor parameter shorthand `private app: App` will be removed, but the references remain.

**How to avoid:** After changing the constructor, grep for `this\.app\b` in `NoteService.ts` and update each to `this.plugin.app`. The TypeScript compiler will catch any missed ones (`TS2339: Property 'app' does not exist on type 'NoteService'`).

**Warning signs:** `tsc -noEmit` fails with `Property 'app' does not exist`.

### Pitfall 3: Circular Import Pattern Is Established, Not New

**What goes wrong:** Developer hesitates to add `import MemoChron from "../main"` to `NoteService.ts`, fearing a circular import.

**Why it happens:** `main.ts` imports `NoteService`. `NoteService` would import from `main.ts`. This looks circular.

**How to avoid:** Recognize that `CalendarService.ts` already has `import MemoChron from "../main"` at line 4, and the project builds cleanly. Node/esbuild handle circular ES module references when one side only uses the type at runtime (via a constructor parameter reference). This is an established pattern in this codebase. [VERIFIED: CalendarService.ts line 4; `npm run build` (tsc + esbuild) exits 0]

### Pitfall 4: `onClose` Signature Must Match `View.onClose`

**What goes wrong:** Developer writes `async onClose(): void` or `onClose(): void`, causing a TypeScript error because the base signature is `protected async onClose(): Promise<void>`.

**Why it happens:** `Modal.onClose()` is `void` (not async). `View.onClose()` is `Promise<void>`. `CalendarView extends ItemView extends View`, so the correct override is async.

**How to avoid:** Use `protected async onClose(): Promise<void>`. [VERIFIED: obsidian.d.ts line 4592]

### Pitfall 5: `calculateEndDate` is Private — Import Is Not the Issue

**What goes wrong:** Developer searches for `import.*calculateEndDate` and finds nothing, concluding removal is trivial but forgetting to actually delete the method body.

**Why it happens:** `calculateEndDate` is a private method defined at `CalendarService.ts:758`. It is never called from within the class (the call sites inline the same logic). The fix is to delete lines 758-762 from `CalendarService.ts`.

**How to avoid:** Grep for the method definition: `grep -n "calculateEndDate" src/services/CalendarService.ts`. Verify zero call sites with `grep -n "this\.calculateEndDate\|calculateEndDate(" src/services/CalendarService.ts`. Then delete the method body.

---

## Code Examples

### Dead-Code Verification Commands

```bash
# Verify calculateEndDate has zero callers
grep -n "calculateEndDate" src/services/CalendarService.ts
# Expected: only the definition line (758)

# Verify DEFAULT_TEMPLATE_PATH and TEMPLATE_VARIABLES have no importers
grep -rn "DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/ --include="*.ts" | grep -v "constants.ts"
# Expected: no output

# Verify renderAgendaList has zero callers (only definition + one import)
grep -rn "renderAgendaList" src/
# Expected: definition in viewRenderers.ts:81, import in EmbeddedAgendaView.ts:4
# After CLEAN-01: only definition in viewRenderers.ts:81

# Verify App import in EmbeddedCalendarView.ts is the only reference
grep -n "\bApp\b" src/views/EmbeddedCalendarView.ts
# Expected: only line 1 (import)

# Verify TFile import in EmbeddedAgendaView.ts is the only reference  
grep -n "\bTFile\b" src/views/EmbeddedAgendaView.ts
# Expected: only line 1 (import)

# Post-phase static verification: none of the dead symbols remain
grep -rn "calculateEndDate\|DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/
# Expected: no output
```

### TD-03: Wrapping Timers in `registerInterval`

```typescript
// main.ts — setupAutoRefresh (keep refreshTimer handle, add registerInterval)
private setupAutoRefresh() {
  this.clearRefreshTimer();
  const intervalMs = this.settings.refreshInterval * 60 * 1000;
  this.refreshTimer = this.registerInterval(
    window.setInterval(() => this.refreshCalendarView(), intervalMs)
  );
}

// CalendarService.ts — scheduleBackgroundRefresh
private scheduleBackgroundRefresh(sources: CalendarSource[]) {
  const enabledSources = sources.filter((source) => source.enabled && source.url?.trim());
  if (this.needsRefresh(enabledSources, false)) {
    this.plugin.registerInterval(
      window.setTimeout(() => this.fetchCalendars(sources, true), 100)
    );
  }
}

// CalendarView.ts — onOpen (inside the existing if block)
this.registerInterval(
  window.setTimeout(() => {
    const today = new Date();
    this.selectedDate = today;
    this.currentDate = today;
    this.renderCalendar();
    this.recalculateViewModeFromHeight(this.plugin.settings.calendarHeight);
    this.refreshEvents();
  }, 50)
);
```

### TD-04: `isDragging` Flag + `onClose` Override

```typescript
// CalendarView.ts — property declaration (add with other private fields)
private isDragging = false;

// handleDragStart — add flag set
private handleDragStart(e: MouseEvent) {
  e.preventDefault();
  this.isDragging = true;          // ADD
  this.dragStartY = e.clientY;
  // ...existing code...
}

// handleDragEnd — add flag clear
private async handleDragEnd(e: MouseEvent) {
  this.isDragging = false;         // ADD
  this.resizeHandle.removeClass("dragging");
  // ...existing code...
}

// onClose override — new method
protected async onClose(): Promise<void> {
  if (this.isDragging) {
    window.removeEventListener("mousemove", this.handleDragMoveBound);
    window.removeEventListener("mouseup", this.handleDragEndBound);
    this.isDragging = false;
  }
}
```

### TD-01: Drop `refreshMinutes`, Read Live

```typescript
// CalendarService.ts — constructor (BEFORE)
constructor(private plugin: MemoChron, private refreshMinutes: number) {}

// CalendarService.ts — constructor (AFTER)
constructor(private plugin: MemoChron) {}

// needsRefresh (BEFORE)
const cacheExpired = now - this.lastFetch >= this.refreshMinutes * 60 * 1000;

// needsRefresh (AFTER)
const cacheExpired = now - this.lastFetch >= this.plugin.settings.refreshInterval * 60 * 1000;

// main.ts initializeServices (BEFORE)
this.calendarService = new CalendarService(this, this.settings.refreshInterval);

// main.ts initializeServices (AFTER)
this.calendarService = new CalendarService(this);
```

### TD-02: NoteService Constructor + Getter

```typescript
// NoteService.ts — constructor (AFTER)
import MemoChron from "../main";

export class NoteService {
  constructor(private plugin: MemoChron) {}

  private get settings(): MemoChronSettings {
    return this.plugin.settings;
  }

  // All 14 `this.settings.x` references unchanged
  // All 6 `this.app.x` references become `this.plugin.app.x`
}

// main.ts initializeServices (AFTER)
this.noteService = new NoteService(this);
```

---

## Runtime State Inventory

This is a pure code-change phase. No stored data, live service config, OS-registered state, secrets, or build artifacts embed any of the symbols being changed. The dead-code symbols (`calculateEndDate`, `DEFAULT_TEMPLATE_PATH`, `TEMPLATE_VARIABLES`) are never persisted to disk or used in any user-facing string.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — no symbol from this phase is persisted to `calendar-cache.json` or `data.json` | None |
| Live service config | None — no Obsidian workspace configuration embeds these symbol names | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | `main.js` (253KB) — will be replaced by production build after changes | Rebuild after each commit |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build (esbuild, tsc) | Yes | v26.0.0 | — |
| TypeScript (node_modules) | `tsc -noEmit` type check | Yes | 4.7.4 | — |
| esbuild (node_modules) | Production bundle | Yes | 0.17.3 | — |
| `npm run build` shorthand | Convenience | Broken (Node 26 + tsc binary path issue) | — | Use `node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck && node esbuild.config.mjs production` directly |

**Missing dependencies with no fallback:** None — build chain fully functional via direct node invocation.

**Missing dependencies with fallback:** `npm run build` is broken on Node 26 locally; the two-step direct invocation is the confirmed working fallback and produces identical output. [VERIFIED: both commands exit 0 on the current codebase]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `window.setInterval` stored in plain field | `this.registerInterval(window.setInterval(...))` | This phase (D-05) | Obsidian guarantees cancellation on plugin unload; manual field kept for resettable-interval pattern |
| `new CalendarService(this, this.settings.refreshInterval)` — stale copy | `new CalendarService(this)` — live read via `this.plugin.settings.refreshInterval` | This phase (D-02/D-04) | Cache-expiry check always uses current setting |
| `new NoteService(this.app, this.settings)` — stale reference | `new NoteService(this)` + getter | This phase (D-01/D-03) | Note path/template decisions always reflect current settings |
| No `CalendarView.onClose()` override | New `onClose()` removes window drag listeners | This phase (D-09) | Mid-drag destroy leaves no orphan listeners on `window` |

---

## Open Questions

1. **SettingsTab `setTimeout` calls (lines 1346, 1747) — in scope for TD-03?**
   - What we know: TD-03 scope is defined as `CalendarService.scheduleBackgroundRefresh` and `CalendarView.onOpen` only (per REQUIREMENTS.md).
   - What's unclear: The two `SettingsTab` `setTimeout` calls at lines 1346 and 1747 are untracked bare `setTimeout` calls. They are used for suggestion-dropdown blur handling and are very short-lived. They are NOT in TD-03 scope per the requirements definition.
   - Recommendation: Leave them out of this phase. Document them as a remaining naked-timeout item for a future hygiene pass. The planner should NOT include them in TD-03 tasks.

2. **iOS rapid disable/enable crash — desktop reproduction**
   - What we know: The crash is described as "undefined is not an object" when a timer callback fires after plugin unload into a torn-down view. This is a WebKit/JavaScriptCore error pattern common on iOS.
   - What's unclear: Desktop Obsidian (Electron/V8) throws `TypeError: Cannot read properties of undefined` which is detectable but the exact reproduction timing may differ.
   - Recommendation: The static verification approach is reliable: after Phase 1, `grep -rn "window\.setInterval\|window\.setTimeout\|^[^/]*\bsetTimeout\b\|^[^/]*\bsetInterval\b" src/` (excluding the two `SettingsTab` blur deferrals) should return zero unregistered timers in `main.ts`, `CalendarService.ts`, and `CalendarView.ts`. This is the acceptance criterion. Desktop crash reproduction is not feasible via enable/disable cycle alone.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `detachLeavesOfType` fires `View.onClose()` synchronously before the method returns | Architecture Patterns / Pattern 4 | If async, the `clearRefreshTimer` + `detachLeavesOfType` sequence in `onunload` might not guarantee teardown order. Risk is LOW: official docs say "removes all leaves" and the onClose pattern is used by most Obsidian plugins for cleanup. |
| A2 | The two `SettingsTab.setTimeout` calls (lines 1346, 1747) are not in TD-03 scope | Open Questions | If they are in scope, two additional timer wraps are needed. Risk is LOW: REQUIREMENTS.md explicitly names only `scheduleBackgroundRefresh` and `CalendarView.onOpen`. |

---

## Verification Approach (no test suite)

Since `nyquist_validation` is `false` and no test suite exists, verification is static + manual:

**Per-requirement static checks (run after each commit):**

```bash
# After every change: build must be clean
node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck && \
  node esbuild.config.mjs production && \
  echo "BUILD OK"

# TD-01: no refreshMinutes field remains
grep -n "refreshMinutes" src/services/CalendarService.ts
# Expected: no output

# TD-02: no direct app/settings constructor params in NoteService  
grep -n "private app\b\|private settings\b" src/services/NoteService.ts
# Expected: no output (settings is now a getter, not a field)

# TD-03: no unregistered timers in target files
grep -n "window\.setInterval\|window\.setTimeout\|setTimeout\|setInterval" \
  src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts
# Expected:
#   main.ts: setInterval inside registerInterval(...)
#   CalendarService.ts: setTimeout inside plugin.registerInterval(...)
#   CalendarView.ts: setTimeout inside this.registerInterval(...)

# TD-04: isDragging field exists, onClose override exists
grep -n "isDragging\|onClose" src/views/CalendarView.ts
# Expected: isDragging declaration, set in handleDragStart/End, used in onClose

# CLEAN-01: dead symbols gone from codebase
grep -rn "calculateEndDate\|DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/
# Expected: no output
grep -n "renderAgendaList" src/views/EmbeddedAgendaView.ts
# Expected: no output (import removed)
grep -n "\bApp\b" src/views/EmbeddedCalendarView.ts
# Expected: no output (import removed)
grep -n "\bTFile\b" src/views/EmbeddedAgendaView.ts
# Expected: no output (import removed)
```

**Manual exercise checklist (post-all-commits):**

1. Build and install plugin in Obsidian (copy `main.js`, `manifest.json`, `styles.css` to plugin folder).
2. Open Obsidian, enable MemoChron. Calendar view opens, events load.
3. Open Settings → MemoChron → change refresh interval (e.g., 30 → 15 min). Save. Verify no Obsidian reload required.
4. Click and drag the resize handle. Mid-drag, close the sidebar entirely (click the sidebar close button). Verify no console errors about `mousemove`/`mouseup` handlers referencing undefined.
5. Disable MemoChron plugin, immediately re-enable. Verify console shows no errors (covers TD-03 timer teardown).
6. Open Developer Tools → confirm no error output during steps 2-5.

---

## Project Constraints (from CLAUDE.md)

The planner MUST honor these directives:

| Constraint | Directive |
|------------|-----------|
| Commit messages | Must NOT reference Claude or AI assistance. Standard conventional-commit style. |
| Mobile compatibility | Plugin runs on iOS (`isDesktopOnly: false`). Changes must not introduce desktop-only APIs. `registerInterval` and `detachLeavesOfType` are cross-platform Obsidian APIs. |
| No remote code execution | Not affected by this phase (no network changes). |
| Lifecycle cleanup | Use `this.registerEvent()`, `this.registerInterval()`, `this.registerDomEvent()` — this phase implements exactly these. |
| `registerDomEvent` | Preferred over raw `addEventListener`. This phase does NOT migrate the drag-start `resizeHandle.addEventListener` or the agenda drag handlers — those are out of scope per deferred items. Only `window` drag listeners are addressed via `onClose`. |
| `setupAutoRefresh` reset pattern | `saveSettings()` must continue to work: clears old interval, creates new one. Manual `refreshTimer` handle preserved. |
| Build verification | `tsc -noEmit` + esbuild production bundle must both succeed after every commit. |
| No test suite | Out of scope per milestone constraints. |
| No accessibility work | Out of scope per milestone constraints. |

---

## Sources

### Primary (HIGH confidence)
- `/obsidianmd/obsidian-developer-docs` (Context7) — `Component.registerInterval()`, `View.onClose()`, `Workspace.detachLeavesOfType()`, plugin lifecycle/cleanup patterns
- `/obsidianmd/obsidian-api` (Context7) — `registerInterval` signature
- `node_modules/obsidian/obsidian.d.ts` (local, line 946) — `registerInterval(id: number): number`; line 4592 — `protected onClose(): Promise<void>` on `View`; line 4926 — `detachLeavesOfType(viewType: string): void`
- Direct codebase read + grep verification — all symbol references, build chain status, dead-code confirmation

### Secondary (MEDIUM confidence)
- Obsidian developer docs examples for `registerInterval` pattern with `window.setInterval`

### Tertiary (LOW confidence)
- Assumption A1 (`detachLeavesOfType` synchrony) — documented behavior but synchrony guarantee not explicitly stated in API docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs verified in local obsidian.d.ts and Context7 docs
- Architecture: HIGH — all patterns traced to actual code; no new dependencies introduced
- Pitfalls: HIGH — derived from direct code reading and TypeScript compiler behavior; A1 is the only LOW-confidence claim

**Research date:** 2026-05-09
**Valid until:** 2026-11-09 (Obsidian API stable; 6-month window before re-verification warranted)
