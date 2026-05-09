---
phase: 01-foundation
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/main.ts
  - src/services/CalendarService.ts
  - src/services/NoteService.ts
  - src/utils/constants.ts
  - src/views/CalendarView.ts
  - src/views/EmbeddedAgendaView.ts
  - src/views/EmbeddedCalendarView.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase delivered five tightly-scoped hygiene requirements (TD-01 through TD-04, CLEAN-01). All five goals were implemented and the primary intent is met: `NoteService` and `CalendarService` read live settings via the plugin reference; all three `setTimeout`/`setInterval` sites are now wrapped in `registerInterval`; `CalendarView.onClose` removes orphaned `window` drag listeners; dead code from CLEAN-01 is gone. No regressions were introduced in any of the reviewed files.

One critical defect exists: `CalendarService.scheduleBackgroundRefresh` passes a `setTimeout` return value to `Plugin.registerInterval`, which internally calls `window.clearInterval` (not `clearTimeout`) on plugin unload. This is the wrong cleanup API for a one-shot timer. Although Electron's (Chromium) shared ID pool makes it work on desktop, the behavior on Obsidian mobile (WKWebView / Android WebView) is implementation-defined and can silently fail to cancel the timer — exactly the iOS rapid-disable scenario TD-03 was designed to prevent.

Three warnings are present: stale interval IDs accumulate in `Plugin`'s internal tracking list on every settings save; `parseAgendaCodeBlock` and `parseCalendarCodeBlock` truncate parameter values that contain colons; and `EmbeddedCalendarView.handleDailyNoteClick` uses a runtime dynamic `import()` for a module already bundled via static imports in the sibling file.

## Critical Issues

### CR-01: `scheduleBackgroundRefresh` passes a `setTimeout` ID to `registerInterval` — wrong cleanup API on mobile

**File:** `src/services/CalendarService.ts:185-187`
**Issue:** `Plugin.registerInterval` is documented as accepting `setInterval` handles. On plugin unload, Obsidian calls `window.clearInterval(id)` on every registered handle. Passing a `setTimeout` return value causes Obsidian to call `clearInterval` on a one-shot timer ID. In Chromium/Electron this is harmless (the two ID pools are shared), but in WKWebView (iOS) and Android WebView the spec does not require the pools to share IDs, so `clearInterval` may silently fail to cancel the timeout. If the user disables the plugin on mobile before the 100 ms fires, the callback executes against a partially-torn-down `CalendarService` instance.

The identical pattern appears in `CalendarView.onOpen` (line 68), but there the `registerInterval` is on the view's own `Component` whose `unload()` is called synchronously when the view closes — so the ID-pool mismatch is less dangerous in practice. The `CalendarService` site is the riskier one because the plugin-level `Component.unload()` runs after service teardown.

**Fix:** Replace `registerInterval` with a stored timeout handle and explicit `clearTimeout` in a teardown path, or — simpler — reschedule as a zero-iteration `setInterval` that clears itself:

```typescript
// Option A: store and clearTimeout explicitly in CalendarService
private backgroundRefreshTimer: ReturnType<typeof window.setTimeout> | null = null;

private scheduleBackgroundRefresh(sources: CalendarSource[]) {
  const enabledSources = sources.filter(
    (source) => source.enabled && source.url?.trim()
  );
  if (this.needsRefresh(enabledSources, false)) {
    if (this.backgroundRefreshTimer !== null) {
      window.clearTimeout(this.backgroundRefreshTimer);
    }
    this.backgroundRefreshTimer = window.setTimeout(
      () => {
        this.backgroundRefreshTimer = null;
        this.fetchCalendars(sources, true);
      },
      100
    );
    // Register the timeout for plugin-unload cleanup using the correct API
    // CalendarService has no Component of its own, so expose a dispose() method
    // called from MemoChron.onunload(), or move the timer to plugin level.
  }
}
```

The cleanest fix that avoids adding a `dispose()` method is to move the one-shot timer into `MemoChron` and call `window.clearTimeout` in `onunload`:

```typescript
// In MemoChron (main.ts):
private backgroundRefreshTimer: ReturnType<typeof window.setTimeout> | null = null;

// In CalendarService, expose a callback-based scheduleBackgroundRefresh:
scheduleBackgroundRefresh(callback: () => void) {
  window.setTimeout(callback, 100);
  // caller (plugin) stores and tracks the ID
}
```

At minimum, the existing line should use `window.clearTimeout` on unload rather than relying on `registerInterval`:

```typescript
// CalendarService.ts line 185-187 — minimal fix
// Replace this.plugin.registerInterval(window.setTimeout(...)) with:
const timerId = window.setTimeout(() => this.fetchCalendars(sources, true), 100);
// Store timerId somewhere clearTimeout can reach it on teardown.
```

---

## Warnings

### WR-01: Stale interval IDs accumulate in Plugin's `registerInterval` tracking list on every settings save

**File:** `src/main.ts:163-171`
**Issue:** `setupAutoRefresh` calls `clearRefreshTimer()` (which cancels the old interval via `window.clearInterval`) and then calls `this.registerInterval(window.setInterval(...))` to create a new one. `Plugin.registerInterval` appends the new numeric ID to an internal array used for cleanup on unload. The old ID — already cancelled by `clearInterval` — is still in that array from the previous call. Each settings save leaves one stale numeric ID in the internal list. `clearInterval` on a stale ID is a no-op, so there is no crash, but the list grows without bound for the lifetime of the plugin if the user saves settings repeatedly.

**Fix:** The cleanest resolution is to remove the `refreshTimer` field entirely and rely solely on `registerInterval`, but that requires a different approach to resetting the timer on settings change. A simpler targeted fix: before calling `registerInterval` again, remove the old ID from the tracking list. Since Obsidian does not expose a `deregisterInterval` API, the practical fix is to avoid registering the interval via `registerInterval` at all and instead rely exclusively on the manual `clearRefreshTimer` pattern — trusting that `onunload` calls `clearRefreshTimer` before the component teardown runs:

```typescript
private setupAutoRefresh() {
  this.clearRefreshTimer();
  const intervalMs = this.settings.refreshInterval * 60 * 1000;
  // Do NOT use registerInterval here — clearRefreshTimer + onunload handles cleanup.
  this.refreshTimer = window.setInterval(
    () => this.refreshCalendarView(),
    intervalMs
  );
}
```

This is valid because `onunload` already calls `clearRefreshTimer()` explicitly (line 93), covering the unload path. `registerInterval` was added for belt-and-suspenders unload safety, but its accumulation of stale IDs is a side-effect that grows across every save.

### WR-02: `parseAgendaCodeBlock` and `parseCalendarCodeBlock` truncate values that contain colons

**File:** `src/views/EmbeddedAgendaView.ts:412` and `src/views/EmbeddedCalendarView.ts:250`
**Issue:** Both parser functions split each config line on `":"` with a plain `split(":")`, then destructure `[key, value]`. When a value itself contains a colon — such as `title: My Meeting: Q2 Review` or `date: 2026-05-09T10:30` — the third-and-beyond segments are silently discarded. The `title` parameter is the most practically affected: any title with a colon is truncated. The `date` parameter with an ISO datetime string also loses the time portion.

```
// Input:  "title: Project: Review"
// Result: key = "title", value = "Project"   (": Review" is lost)
```

**Fix:** Use `indexOf` to split only on the first colon:

```typescript
// Replace:
const [key, value] = line.split(":").map((s) => s.trim());

// With:
const colonIndex = line.indexOf(":");
if (colonIndex === -1) continue;
const key = line.substring(0, colonIndex).trim();
const value = line.substring(colonIndex + 1).trim();
```

### WR-03: `EmbeddedCalendarView.handleDailyNoteClick` uses a dynamic `import()` for an already-bundled module

**File:** `src/views/EmbeddedCalendarView.ts:194-199`
**Issue:** `handleDailyNoteClick` in `EmbeddedCalendarView` uses `await import("obsidian-daily-notes-interface")` at runtime instead of a static import at the top of the file. `obsidian-daily-notes-interface` is not in esbuild's `external` list, so it is bundled into `main.js`. esbuild converts the `await import()` to `require()` in CJS output, which resolves synchronously — the `await` is misleading and the code works accidentally rather than by design. More concretely: the sibling file `EmbeddedAgendaView.ts` uses a static import of the same module (lines 7-12), establishing the correct pattern for this codebase. The inconsistency also means the bundle contains the module twice if tree-shaking boundaries differ.

**Fix:** Replace the dynamic import with a static import at the top of the file, matching the pattern in `EmbeddedAgendaView.ts`:

```typescript
// Add to top of EmbeddedCalendarView.ts:
import {
  createDailyNote,
  getDailyNote,
  getAllDailyNotes,
  appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";

// Then remove the `await import(...)` block inside handleDailyNoteClick,
// using the top-level names directly.
```

---

## Info

### IN-01: `CalendarView.handleDragMoveBound` and `handleDragEndBound` are declared but not initialized in the constructor — type declaration does not reflect `undefined` before `onOpen`

**File:** `src/views/CalendarView.ts:30-31`
**Issue:** The two properties are typed as `(e: MouseEvent) => void` (non-nullable), but they are only assigned in `createUI()` which is called from `onOpen()`. If any code path accessed them before `onOpen()` completed (or if `onClose()` ran without `onOpen()`), TypeScript's `strictNullChecks` would not catch the access because the declared type does not include `undefined`. The `isDragging` guard in `onClose()` (line 53) prevents actual runtime access of the uninitialized fields, so there is no current bug. This is a latent type-safety gap rather than an active defect.

**Fix:** Initialize to `undefined` with explicit optional typing, or assign stub functions in the constructor:

```typescript
// Option A — explicit undefined, type reflects reality
private handleDragMoveBound: ((e: MouseEvent) => void) | undefined = undefined;
private handleDragEndBound: ((e: MouseEvent) => void) | undefined = undefined;

// Then update onClose guard (already guarded by isDragging, but be explicit):
if (this.isDragging && this.handleDragMoveBound) { ... }
```

### IN-02: `CalendarView.registerInterval` used with a `setTimeout` handle (same issue as CR-01, lower-risk instance)

**File:** `src/views/CalendarView.ts:68-70`
**Issue:** The 50 ms startup `setTimeout` in `onOpen` is passed to `this.registerInterval`, which internally calls `clearInterval` on it at view unload. As with CR-01, this relies on the browser's shared ID pool between `setTimeout` and `setInterval`. On Obsidian desktop (Chromium) this works. On mobile it is implementation-defined. This instance is lower severity than CR-01 because `CalendarView` is an `ItemView`/`Component` whose `unload()` is called synchronously when the leaf closes — so the cancellation window is narrow. Flagged for completeness.

**Fix:** Store the timer ID and use `window.clearTimeout` directly, similar to CR-01 Option A:

```typescript
// In onOpen, replace:
this.registerInterval(
  window.setTimeout(() => { ... }, 50)
);

// With a stored handle cleared on close:
private startupTimer: ReturnType<typeof window.setTimeout> | null = null;

// In onOpen:
this.startupTimer = window.setTimeout(() => {
  this.startupTimer = null;
  // ... existing body ...
}, 50);

// In onClose:
if (this.startupTimer !== null) {
  window.clearTimeout(this.startupTimer);
  this.startupTimer = null;
}
```

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
