# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 1-foundation
**Areas discussed:** Live-settings pattern, Timeout & onunload, Drag teardown
**Areas declined:** Dead-code scope (strict-list-only by default)

---

## Live-settings pattern

### Q1: What's the canonical way for services to access live settings?

| Option | Description | Selected |
|--------|-------------|----------|
| Plugin reference | NoteService takes `(plugin)`, reads `plugin.settings.x` and `plugin.app` live. CalendarService drops cached `refreshMinutes`. Symmetric pattern across both services. | ✓ |
| Settings getter callback | Both services take `getSettings: () => MemoChronSettings`. No plugin coupling but introduces an indirection layer the codebase doesn't use elsewhere. | |
| Explicit setter on services | Services keep frozen copies; `saveSettings()` calls `setX(...)` mutators. Easy to forget when adding new settings. | |

**User's choice:** Plugin reference
**Notes:** Acknowledged ARCHITECTURE.md flag (plugin-back-reference is the FRAG concern), but the decoupling refactor is out-of-scope for this stabilization milestone.

### Q2: Should NoteService keep `app` as a separate constructor param?

| Option | Description | Selected |
|--------|-------------|----------|
| Plugin only | Constructor `(plugin: MemoChron)`. NoteService reads `this.plugin.app` and `this.plugin.settings`. | ✓ |
| Plugin + app | Keep `(app, plugin)` for explicit vault dependency. | |

**User's choice:** Plugin only

### Q3: Keep `this.settings.x` syntax via getter, or rewrite all references?

| Option | Description | Selected |
|--------|-------------|----------|
| Private getter | `private get settings(): MemoChronSettings { return this.plugin.settings; }`. Zero call-site churn for ~30 references. | ✓ |
| Rewrite to plugin.settings | Replace every `this.settings.x` with `this.plugin.settings.x`. More verbose but explicit at every line. | |

**User's choice:** Private getter

---

## Timeout & onunload

### Q1: Strategy for tracking the three timer surfaces?

| Option | Description | Selected |
|--------|-------------|----------|
| `registerInterval` for all | Wrap every `window.setTimeout`/`setInterval` in `registerInterval(...)`. Auto-refresh keeps manual handle for reset-on-save; registerInterval is belt-and-suspenders. | ✓ |
| Service-owned handles + dispose() | CalendarService gets its own timer field plus `dispose()`; CalendarView stores its 50ms handle. Explicit but more API surface. | |
| Mix: registerInterval for one-shots, manual for resettable | Two different patterns side-by-side. | |

**User's choice:** registerInterval for all
**Notes:** PERF-04 (replace 50/100ms with rAF/requestIdleCallback) stays explicitly deferred. Timing values unchanged.

### Q2: How should `onunload` handle the registered view?

| Option | Description | Selected |
|--------|-------------|----------|
| Detach leaves explicitly | `this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` so `CalendarView.onClose()` fires deterministically. No reliance on undocumented Obsidian behavior. | ✓ |
| Trust Obsidian + null-guards | Don't actively detach; rely on standard view teardown. Smaller diff but keeps implicit lifecycle dependency. | |
| Both: detach + dispose services | Detach AND add `dispose()` API. Most defensive but adds API surface that nothing else has. | |

**User's choice:** Detach leaves explicitly

---

## Drag teardown

### Q1: How should mid-drag teardown be guaranteed?

| Option | Description | Selected |
|--------|-------------|----------|
| `isDragging` flag + onClose cleanup | New `private isDragging = false` field; `onClose()` removes window listeners if `isDragging`. Smallest diff. | ✓ |
| AbortController per drag | Create `AbortController` on drag start, abort on dragEnd or onClose. Pattern not used elsewhere in the codebase. | |
| Bound handlers + idempotent removal | Just call `removeEventListener` unconditionally in `onClose()`. No flag — but reads as "why are we removing window listeners on close?" without context. | |

**User's choice:** isDragging flag + onClose cleanup

### Q2: From `onClose`, full `handleDragEnd` path or listener removal only?

| Option | Description | Selected |
|--------|-------------|----------|
| Listener removal only | Just remove the two listeners and clear `isDragging`. No `snapToCurrentViewMode` / `saveSettings` / refresh. | ✓ |
| Full handleDragEnd path | Run the existing handleDragEnd unconditionally for snap-and-save. Risks stray callbacks against detached DOM. | |

**User's choice:** Listener removal only
**Notes:** Avoids race against view teardown — `saveSettings` would trigger `setupAutoRefresh` and `refreshCalendarView` against a closing view.

---

## Claude's Discretion

- Commit granularity (per-requirement atomic vs. consolidated commits) — planner decides; GSD default is per-requirement atomic.
- Whether to extract a small private helper for the shared listener-removal logic between `handleDragEnd` and `onClose`, or inline the two `removeEventListener` calls in both — planner's call based on resulting diff size.
- Verification approach — code review of cleanup paths plus manual exercise (no automated tests this milestone).

## Deferred Ideas

- **PERF-04** — Replacing 50/100ms timeouts with `requestAnimationFrame` / `requestIdleCallback`. Stays in v2 perf milestone.
- **FRAG-03** — `hasSourceMismatch` URL-canonical refactor.
- **`renderAgendaList` function removal in `viewRenderers.ts`** — only the import is in scope; verifying zero callers and deleting the function itself is a later cleanup pass.
- **Broader `addEventListener` → `registerDomEvent` audit** outside drag handlers.
- **`CalendarService` decoupling from plugin** — fragility concern flagged by ARCHITECTURE.md but explicitly deferred.
