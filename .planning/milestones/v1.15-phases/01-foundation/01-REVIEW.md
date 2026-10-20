---
phase: 01-foundation
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/main.ts
  - src/services/CalendarService.ts
  - src/views/CalendarView.ts
  - src/views/EmbeddedAgendaView.ts
  - src/views/EmbeddedCalendarView.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 1: Code Review Report (Re-review)

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This is the second code review of phase 01-foundation, performed after plans 01-06..01-10 remediated the six findings (CR-01, IN-01, IN-02, WR-01, WR-02, WR-03) identified in the prior review. The remediation work is solid: every prior finding is closed correctly, no regressions are detectable in the reviewed files, and the new public method on `MemoChron` (`setBackgroundRefreshTimer`) has correct cancellation semantics including the inner null-then-call ordering, which preserves correctness when a callback synchronously schedules a new timer.

The only finding in this review is a single **pre-existing** unused-import quality issue in `EmbeddedCalendarView.ts` that the prior review did not flag. It is not introduced by remediation and is non-functional. Filed as Info because it does not affect correctness or runtime behavior — just bundle hygiene and reader signal.

### Closure verification of prior findings

| Finding | Status | Evidence |
|---|---|---|
| CR-01 — `setTimeout` ID passed to `registerInterval` (mobile clearInterval risk) | **Closed** | `src/services/CalendarService.ts:189-192` now calls the new plugin-owned `this.plugin.setBackgroundRefreshTimer(callback, 100)`, which stores the handle and cancels with `window.clearTimeout` in `MemoChron.clearBackgroundRefreshTimer()` (`src/main.ts:205-210`), invoked from `onunload()` (`src/main.ts:95`). No `setTimeout` handle is now passed to `registerInterval`. |
| WR-01 — Stale interval IDs accumulate in Plugin's `registerInterval` list on every settings save | **Closed** | `src/main.ts:174-177` removed the `registerInterval` wrap. `setupAutoRefresh` now stores the interval ID directly on `this.refreshTimer` and relies on `clearRefreshTimer()` from `setupAutoRefresh` (reset path) and `onunload()` (shutdown path) for cleanup. |
| WR-02 — `parseAgendaCodeBlock` / `parseCalendarCodeBlock` truncate values with colons | **Closed** | Both parsers (`src/views/EmbeddedAgendaView.ts:415-420` and `src/views/EmbeddedCalendarView.ts:250-255`) use `indexOf(":")` + `substring`, splitting only on the first colon. Empty-key guard added. |
| WR-03 — Dynamic `import("obsidian-daily-notes-interface")` inside `handleDailyNoteClick` | **Closed** | `src/views/EmbeddedCalendarView.ts:9-14` now imports the four functions statically, matching the established pattern in `EmbeddedAgendaView.ts:7-12`. The runtime `await import(...)` block is removed; usages on lines 200, 217, 220, 224 reference the static imports directly. |
| IN-01 — Drag handler bindings declared as non-nullable but only assigned in `onOpen`/`createUI` | **Closed** | `src/views/CalendarView.ts:30-31` now types both handlers as `((e: MouseEvent) => void) \| undefined = undefined`. `onClose` guard at line 54 uses an explicit truthy check. The `addEventListener` and `removeEventListener` call sites in `handleDragStart` (line 1075-1076) and `handleDragEnd` (line 1100-1101) use non-null assertions; this is sound because `createUI()` (which assigns the bindings, line 214-215) runs synchronously before any user-driven `mousedown` can reach `handleDragStart`. |
| IN-02 — `CalendarView` startup `setTimeout` passed to `registerInterval` | **Closed** | `src/views/CalendarView.ts:33` adds `private startupTimer: number \| null = null`, line 77-86 stores the handle, and `onClose` (line 59-62) cancels with `window.clearTimeout`. The `registerInterval` wrap is gone. |

## Critical Issues

None.

## Warnings

None.

## Info

### IN-01: Unused `CalendarEvent` import in `EmbeddedCalendarView.ts`

**File:** `src/views/EmbeddedCalendarView.ts:15`
**Issue:** `import { CalendarEvent } from "../services/CalendarService";` is declared but never used in the module — there are no type annotations or runtime references to `CalendarEvent` anywhere in the file. This import survived the WR-03 static-import refactor and was already present at the prior review's diff base (`bac3d92`), so it predates remediation. It is non-functional (esbuild tree-shakes type-only imports), but it adds noise and is misleading to readers scanning the dependencies of this module.

The sibling file `EmbeddedAgendaView.ts:13` legitimately imports and uses `CalendarEvent` (as a type annotation in `renderEventItem` and `renderDailyNoteEntry` parameters). The prior review missed this asymmetry.

**Fix:** Remove the unused import:

```typescript
// Delete line 15:
import { CalendarEvent } from "../services/CalendarService";
```

If a future change introduces a `CalendarEvent` type annotation, re-add it then.

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
