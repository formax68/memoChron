# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 7 (all modifications, no new files)
**Analogs found:** 6 / 7 (one requires a synthesized pattern from in-codebase prior art)

This is a pure internal-hygiene phase. No new files are introduced. The "patterns" here are existing in-codebase usages that the planner should mirror, plus one synthesized pattern (the `View.onClose()` override + `registerInterval` on `Component`) that the codebase does not yet exercise but that the Obsidian API (already in `node_modules/obsidian/obsidian.d.ts`) directly supports.

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/main.ts` | plugin entry / composition root | lifecycle (onload/onunload), event-driven (timer, layout-ready) | self — current `setupAutoRefresh`/`clearRefreshTimer` is the analog being augmented | exact (self-pattern extension) |
| `src/services/CalendarService.ts` | service | request-response (fetch), batch (parse), state-cache | self (current constructor `(plugin: MemoChron, refreshMinutes: number)`) | exact (constructor narrowing) |
| `src/services/NoteService.ts` | service | CRUD (note create/read), transform (template variables) | `CalendarService` constructor signature `(plugin: MemoChron, ...)` and its `this.plugin.app.*`/`this.plugin.settings.*` access pattern | role-match (CalendarService is the same tier and already does what NoteService is being changed to do) |
| `src/views/CalendarView.ts` | view (ItemView) | event-driven (DOM, drag), lifecycle (onOpen/onClose) | (a) `SettingsTab.onClose()` for `onClose` shape; (b) self for `handleDragStart`/`handleDragEnd` symmetry; (c) `obsidian.d.ts` for `registerInterval`/`View.onClose` signatures | partial (no existing `View.onClose` in codebase; modal `onClose` is `void`-not-`Promise<void>`) |
| `src/views/EmbeddedCalendarView.ts` | view (MarkdownRenderChild) | rendering (no data flow change) | n/a — straight import deletion | n/a |
| `src/views/EmbeddedAgendaView.ts` | view (MarkdownRenderChild) | rendering (no data flow change) | n/a — straight import deletion | n/a |
| `src/utils/constants.ts` | config / constants | static export | n/a — straight constant deletion | n/a |

---

## Pattern Assignments

### `src/main.ts` (plugin entry)

**Analog:** self — `MemoChron.setupAutoRefresh` and `clearRefreshTimer` already exist; this phase wraps the existing `setInterval` in `registerInterval` and adds `detachLeavesOfType` to `onunload`. Cross-reference: `SettingsTab` uses `this.plugin.registerDomEvent(...)` (see `src/settings/SettingsTab.ts` lines 74, 238, 260, 286, etc.) — the same Obsidian Component-cleanup family, applied to DOM events. `registerInterval` is the timer counterpart.

**Current state — `initializeServices`** (`src/main.ts:33-39`):
```typescript
private initializeServices() {
  this.calendarService = new CalendarService(
    this,
    this.settings.refreshInterval
  );
  this.noteService = new NoteService(this.app, this.settings);
}
```
**Apply pattern:** drop the `this.settings.refreshInterval` argument from `CalendarService` (D-04); change `NoteService` to `new NoteService(this)` (D-01). Both calls land on the single line each — no other call site in the project.

**Current state — `setupAutoRefresh`** (`src/main.ts:164-172`):
```typescript
private setupAutoRefresh() {
  this.clearRefreshTimer();

  const intervalMs = this.settings.refreshInterval * 60 * 1000;
  this.refreshTimer = window.setInterval(
    () => this.refreshCalendarView(),
    intervalMs
  );
}
```
**Apply pattern (D-05, dual-handle):** wrap the inner `window.setInterval(...)` in `this.registerInterval(...)`. The numeric handle is preserved (per `obsidian.d.ts:946 — registerInterval(id: number): number`), so `this.refreshTimer = this.registerInterval(window.setInterval(...))` is valid and `clearRefreshTimer` continues to work unchanged. **Do not** remove the manual handle — `clearRefreshTimer` is the only way to cancel-and-reset on `saveSettings()` (line 102-110).

**Current state — `onunload`** (`src/main.ts:94-96`):
```typescript
onunload() {
  this.clearRefreshTimer();
}
```
**Apply pattern (D-07):** add `this.app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` before (or after — order doesn't matter, both are sync) `this.clearRefreshTimer()`. `MEMOCHRON_VIEW_TYPE` is already imported at line 7.

**Imports already present that you'll lean on:** `MEMOCHRON_VIEW_TYPE` (line 7); `Plugin` from `obsidian` (line 1) — `Plugin extends Component`, so `this.registerInterval` is available without any new import.

---

### `src/services/CalendarService.ts` (service)

**Analog:** self — the constructor at line 40 is exactly the shape being narrowed. The plugin reference is already held on `this.plugin` and used throughout (lines 97, 112, 136, 164, 291-292, 331-333, 340-341, 346-347, 798, 801).

**Current constructor** (`src/services/CalendarService.ts:40`):
```typescript
constructor(private plugin: MemoChron, private refreshMinutes: number) {}
```
**Apply pattern (D-02):**
```typescript
constructor(private plugin: MemoChron) {}
```

**Current `needsRefresh`** (`src/services/CalendarService.ts:189-203`):
```typescript
private needsRefresh(
  enabledSources: CalendarSource[],
  forceRefresh: boolean
): boolean {
  const now = Date.now();
  const cacheExpired =
    now - this.lastFetch >= this.refreshMinutes * 60 * 1000;

  return (
    forceRefresh ||
    this.events.length === 0 ||
    cacheExpired ||
    this.hasSourceMismatch(enabledSources)
  );
}
```
**Apply pattern:** replace `this.refreshMinutes` with `this.plugin.settings.refreshInterval`. Existing access pattern for plugin-side settings is already used in this file (e.g. line 97: `this.plugin.settings.calendarUrls.filter(...)`, line 798: `this.plugin.settings.filteredCuTypes`, line 801: `this.plugin.settings.filteredAttendees`) — exactly the same mechanism.

**Current `scheduleBackgroundRefresh`** (`src/services/CalendarService.ts:180-187`):
```typescript
private scheduleBackgroundRefresh(sources: CalendarSource[]) {
  const enabledSources = sources.filter((source) => source.enabled && source.url?.trim());
  if (this.needsRefresh(enabledSources, false)) {
    setTimeout(() => this.fetchCalendars(sources, true), 100);
  }
}
```
**Apply pattern (D-05):** wrap the bare `setTimeout(...)` in `this.plugin.registerInterval(window.setTimeout(...))`. `CalendarService` is **not** a `Component`, so it must borrow the plugin's registration scope (Pitfall 1 in research). The `100` ms value is preserved per D-06.

**Current `calculateEndDate`** (`src/services/CalendarService.ts:758-762`):
```typescript
private calculateEndDate(start: Time, duration: any): Date {
  const end = start.clone();
  end.addDuration(duration);
  return end.toJSDate();
}
```
**Apply pattern (CLEAN-01 / D-10):** delete this method outright. `grep` verification (run during research) confirmed zero call sites within this file. The two recurring/single processing paths (lines 655-708 and 715-738) inline equivalent logic via `endTime.clone()` + `addDuration`, so no replacement is needed.

**Imports already present:** `MemoChron` at line 4; `Time` from `ical.js` at line 2 — note that after `calculateEndDate` removal, verify `Time` is still referenced (it is — line 652 `let next: Time | null`). Don't auto-prune.

---

### `src/services/NoteService.ts` (service)

**Analog:** `src/services/CalendarService.ts` — the same tier already follows the `(plugin: MemoChron)`-only pattern with the back-reference held on `this.plugin`. The existing access conventions in CalendarService (`this.plugin.app.vault.adapter.read(...)` at line 291, `this.plugin.settings.calendarUrls` at line 97) are exactly the destination shape for NoteService after D-01/D-03.

**Current imports** (`src/services/NoteService.ts:1-3`):
```typescript
import { App, TFile, TFolder, normalizePath } from "obsidian";
import { MemoChronSettings, CalendarNotesSettings } from "../settings/types";
import { CalendarEvent } from "./CalendarService";
```
**Apply pattern (D-01):** add `import MemoChron from "../main";` (mirror `CalendarService.ts:4`). `App` import is no longer needed — drop it from the obsidian named imports. `MemoChronSettings` is still needed for the getter return type (`private get settings(): MemoChronSettings`). `CalendarNotesSettings` is still needed (used at lines 174, 536). `TFile`, `TFolder`, `normalizePath` all still used.

**Current constructor** (`src/services/NoteService.ts:54`):
```typescript
constructor(private app: App, private settings: MemoChronSettings) {}
```
**Apply pattern (D-01 + D-03) — analog from CalendarService.ts:40:**
```typescript
constructor(private plugin: MemoChron) {}

private get settings(): MemoChronSettings {
  return this.plugin.settings;
}
```

**TypeScript compile-time guarantee** (Research Pattern 2): the constructor parameter shorthand `private plugin: MemoChron` creates a field named `plugin`, not `settings`, so the getter `get settings()` does not collide with any field. If a developer accidentally typed `private settings: MemoChronSettings` alongside the getter, TS would emit error TS2403 — the compiler is the safety net.

**`this.app` references to update** — there are 6 in NoteService that must be updated to `this.plugin.app`:
- Line 62: `this.app.vault.getAbstractFileByPath(filePath)`
- Line 68: `this.app.vault.create(filePath, content)`
- Line 77: `this.app.vault.getAbstractFileByPath(filePath)`
- Line 87: `this.app.vault.getAllLoadedFiles().forEach(...)`
- Line 399: `this.app.vault.getAbstractFileByPath(currentPath)`
- Line 409: `this.app.vault.createFolder(currentPath)`

After the constructor change, `tsc -noEmit -skipLibCheck` will fail for any missed reference (`Property 'app' does not exist on type 'NoteService'`) — Pitfall 2 in research. Use the compiler as the verification mechanism rather than grep alone.

**`this.settings` references — leave unchanged.** All 14 `this.settings.x` references (e.g. lines 100, 102, 104, 124, 127, 155, 176, 322, 364, 384, 385, 511, 537, 541) resolve through the new getter to live values. Zero call-site churn — this is the entire point of D-03.

---

### `src/views/CalendarView.ts` (view, ItemView)

**Analog (multi-source — no single existing analog covers all four sub-changes):**

#### Sub-change A — `isDragging` flag

**Analog:** self. `handleDragStart`/`handleDragEnd` are the natural set/clear sites. Mirror the existing `private` field declarations in this class (`src/views/CalendarView.ts:20-32`).

**Current `handleDragStart`** (`src/views/CalendarView.ts:1049-1057`):
```typescript
private handleDragStart(e: MouseEvent) {
  e.preventDefault();
  this.dragStartY = e.clientY;
  this.dragStartHeight = this.calendar.offsetHeight;
  this.resizeHandle.addClass("dragging");

  window.addEventListener("mousemove", this.handleDragMoveBound);
  window.addEventListener("mouseup", this.handleDragEndBound);
}
```
**Apply pattern (D-08):** add `this.isDragging = true;` after `e.preventDefault();`.

**Current `handleDragEnd`** (`src/views/CalendarView.ts:1077-1083`):
```typescript
private async handleDragEnd(e: MouseEvent) {
  this.resizeHandle.removeClass("dragging");
  window.removeEventListener("mousemove", this.handleDragMoveBound);
  window.removeEventListener("mouseup", this.handleDragEndBound);

  await this.snapToCurrentViewMode();
}
```
**Apply pattern (D-08):** add `this.isDragging = false;` as the first statement (before `removeClass`). Alternative position is at the very end after `await snapToCurrentViewMode()` — but if `snapToCurrentViewMode()` throws, the flag would remain stale, so first-statement is safer.

**Field declaration site (D-08):** add `private isDragging = false;` near the other private drag fields at line 28-31:
```typescript
// Existing (lines 28-31):
private dragStartY: number;
private dragStartHeight: number;
private handleDragMoveBound: (e: MouseEvent) => void;
private handleDragEndBound: (e: MouseEvent) => void;
// Add:
private isDragging = false;
```

#### Sub-change B — `onClose()` override

**Analog (signature):** `obsidian.d.ts:4592` (already in node_modules) — `protected onClose(): Promise<void>`. There is no existing `View.onClose` override in the codebase. The two `onClose` methods in `SettingsTab.ts` (lines 1789, 1878) are on `Modal`, which has signature `onClose(): void` — **do not** mirror those signatures (Pitfall 4 in research).

**Apply pattern (D-09) — synthesized from research Pattern 3:**
```typescript
protected async onClose(): Promise<void> {
  if (this.isDragging) {
    window.removeEventListener("mousemove", this.handleDragMoveBound);
    window.removeEventListener("mouseup", this.handleDragEndBound);
    this.isDragging = false;
  }
}
```
**Placement:** Add as a top-level method in the class. A natural site is right after `getIcon()` (line 47-49) alongside other view-lifecycle methods (`onOpen` is at line 51), which keeps lifecycle methods grouped. Final-of-class is also acceptable.

**Listener-removal-only constraint:** Do **not** call `this.handleDragEnd(...)` from `onClose`. `handleDragEnd` (line 1077) calls `snapToCurrentViewMode()` (line 1085) which calls `this.plugin.saveSettings()` (line 1108) which calls `setupAutoRefresh()` and `refreshCalendarView()` (`main.ts:106-110`). On a closing view, `refreshCalendarView()` reaches into `this.calendarView.refreshEvents(...)` against a torn-down view — race + likely throw. Listener-removal alone is the correct pattern (research Pattern 3 / D-09).

**Optional helper extraction:** Per CONTEXT.md `<specifics>`, the planner may extract the two `removeEventListener` calls into a `private removeDragListeners()` helper called from both `handleDragEnd` and `onClose`. This is at the planner's discretion. The current `handleDragEnd` body has only 4 statements, so inlining is also reasonable — either choice is fine.

#### Sub-change C — `setTimeout` wrap in `onOpen`

**Analog:** self — `CalendarView extends ItemView extends View extends Component` (verified via `obsidian.d.ts`), so `this.registerInterval(...)` is a method on the view itself. No need for `this.plugin.registerInterval`.

**Current `onOpen`** (`src/views/CalendarView.ts:51-79`, focus on lines 59-67):
```typescript
// Use efficient timeout to allow DOM to settle
setTimeout(() => {
  const today = new Date();
  this.selectedDate = today;
  this.currentDate = today;
  // Render first to ensure we can measure row heights
  this.renderCalendar();
  this.recalculateViewModeFromHeight(this.plugin.settings.calendarHeight);
  this.refreshEvents();
}, 50);
```
**Apply pattern (D-05):**
```typescript
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
**Note:** The bare `setTimeout` at line 59 was implicitly `window.setTimeout` already; the explicit `window.` prefix is added for clarity and to match the `setInterval` invocation in `main.ts`. The `50` ms value is preserved per D-06.

**Imports already present:** `ItemView, WorkspaceLeaf, Notice, TFile` from `obsidian` (line 1) — no import changes needed for this file.

---

### `src/views/EmbeddedCalendarView.ts` (view, MarkdownRenderChild)

**Analog:** n/a — pure import deletion.

**Current import** (`src/views/EmbeddedCalendarView.ts:1`):
```typescript
import { MarkdownRenderChild, Notice, App } from "obsidian";
```
**Apply pattern (CLEAN-01 / D-10):**
```typescript
import { MarkdownRenderChild, Notice } from "obsidian";
```
Drop `App`. The grep verification in the research file confirmed `App` is referenced only at line 1 of this file. `TFile` is **not** imported here (only in the agenda view) — do not invent a removal.

---

### `src/views/EmbeddedAgendaView.ts` (view, MarkdownRenderChild)

**Analog:** n/a — pure import deletion.

**Current imports** (`src/views/EmbeddedAgendaView.ts:1-7`):
```typescript
import { MarkdownRenderChild, Notice, TFile } from "obsidian";
import MemoChron from "../main";
import {
  renderAgendaList,
  parseDate,
  RenderOptions,
} from "../utils/viewRenderers";
```
**Apply pattern (CLEAN-01 / D-10):**
```typescript
import { MarkdownRenderChild, Notice } from "obsidian";
import MemoChron from "../main";
import {
  parseDate,
  RenderOptions,
} from "../utils/viewRenderers";
```
Drop `TFile` and `renderAgendaList`. **Do not** delete the `renderAgendaList` *function* in `src/utils/viewRenderers.ts:81` (D-11 — out of scope this phase). The function is still exported and remains available for future callers; only the now-unused import in this file is removed.

---

### `src/utils/constants.ts` (config / constants)

**Analog:** n/a — pure constant deletion.

**Current state** (`src/utils/constants.ts:6, 17-24`):
```typescript
// Line 6:
export const DEFAULT_TEMPLATE_PATH: string = 'templates/defaultTemplate.md';

// Lines 17-24:
export const TEMPLATE_VARIABLES = {
    TITLE: '{{title}}',
    START_TIME: '{{startTime}}',
    END_TIME: '{{endTime}}',
    DATE: '{{date}}',
    DESCRIPTION: '{{description}}',
    LOCATION: '{{location}}',
};
```
**Apply pattern (CLEAN-01 / D-10):** delete both. Grep verification confirmed zero importers outside `constants.ts` itself. Do not touch `DEFAULT_NOTE_TITLE_FORMAT`, `DEFAULT_FRONTMATTER`, or any other constant — the deletion is strictly scoped to the two named symbols.

---

## Shared Patterns

### `registerInterval` borrowing: Component vs. plugin-borrowed

**Analog source:** `obsidian.d.ts:946` (in node_modules) plus the existing `this.plugin.registerDomEvent(...)` usage throughout `src/settings/SettingsTab.ts` (15 call sites — see lines 74, 238, 260, 286, 315, 565, 614, 651, 700, 809, 1023, 1093, 1342, 1343, 1345, 1378, 1743, 1744, 1746, 1780). The DOM-event pattern is the proven idiom; `registerInterval` is the timer counterpart with the identical scoping rule.

**Apply rule:**
- `MemoChron` (Plugin extends Component) → `this.registerInterval(...)` directly (used in `main.ts setupAutoRefresh`).
- `CalendarView` (ItemView extends View extends Component) → `this.registerInterval(...)` directly (used in `CalendarView.onOpen` 50 ms timeout).
- `CalendarService` (plain class — **not** a Component) → `this.plugin.registerInterval(...)` (used in `scheduleBackgroundRefresh` 100 ms timeout). Mirrors the borrowing pattern that `SettingsTab` uses for `this.plugin.registerDomEvent(...)` — `SettingsTab` extends `PluginSettingTab` (which extends Component) but still routes through `this.plugin` for the DOM-event helpers; same shape applies here.

**Concrete excerpt** — from `SettingsTab.ts:286-289`, illustrating plugin-borrowed registration on a non-self component scope:
```typescript
this.plugin.registerDomEvent(urlInput.inputEl, "blur", async () => {
  // ...
});
```

The numeric handle returned by `registerInterval` equals the input handle (per `obsidian.d.ts:946`), so chained assignment is the canonical Obsidian pattern:
```typescript
// main.ts pattern (research Pattern 1):
this.refreshTimer = this.registerInterval(
  window.setInterval(() => this.refreshCalendarView(), intervalMs)
);
```

### Plugin back-reference in services

**Analog:** `src/services/CalendarService.ts:4` — `import MemoChron from "../main";` and `src/services/CalendarService.ts:40` — `constructor(private plugin: MemoChron, ...)`. The same import statement and constructor shape land in `NoteService.ts`. Pitfall 3 in research confirms: the seemingly-circular import (main → service → main) is already exercised by CalendarService and the project builds clean — esbuild and `tsc -noEmit` handle it because the back-reference is type-only at the import boundary.

**Apply to:** `src/services/NoteService.ts` (this phase). Future services in later phases should follow the same shape.

### TypeScript getter for live config delegation

**Analog:** none in this codebase (no existing `private get` accessors). The pattern is emitted by the TypeScript 4.7 compiler with no special syntax — it's standard ES2015 accessor syntax. Verified pattern from research Pattern 2.

**Apply to:** `src/services/NoteService.ts` only this phase. The getter return type `MemoChronSettings` keeps strict-null-checks happy (`this.plugin.settings` is non-null after `loadSettings()` runs in `onload`). All 14 `this.settings.x` reads in NoteService resolve through the getter at access time — zero refactor of call sites.

### Mid-drag teardown via `View.onClose`

**Analog:** `obsidian.d.ts:4592` — `protected onClose(): Promise<void>`. The codebase has no existing `View.onClose` override, but the **shape** is documented in node_modules and used by most published Obsidian plugins. `Modal.onClose` (used in `SettingsTab.ts:1789, 1878`) is a different signature (`void`, not `Promise<void>`) — do not mirror.

**Apply to:** `src/views/CalendarView.ts` only this phase. If a future view also attaches raw `addEventListener` to `window`/`document`, the same pattern applies there.

### `detachLeavesOfType` for deterministic teardown

**Analog:** `obsidian.d.ts:4926` — `detachLeavesOfType(viewType: string): void`. Confirmed synchronous-fire-onClose semantic (Assumption A1, LOW risk). The codebase already uses `getLeavesOfType` (in `main.ts:113`) — same `Workspace` API surface, sibling method.

**Apply to:** `src/main.ts onunload` only this phase. The view-type constant `MEMOCHRON_VIEW_TYPE` is already imported.

---

## No Analog Found

| File / change | Reason | Source for pattern |
|---|---|---|
| `View.onClose()` override pattern | No existing `View.onClose` override anywhere in `src/` | `obsidian.d.ts:4592` (in node_modules); research Pattern 3 |
| TypeScript `private get` accessor | No existing getters in `src/` | TypeScript 4.7 spec / research Pattern 2 |
| `registerInterval` direct usage | Currently zero usages in `src/` | `obsidian.d.ts:946`; `SettingsTab`'s `registerDomEvent` calls are the closest in-repo idiom |
| `detachLeavesOfType` | Currently zero usages in `src/` | `obsidian.d.ts:4926`; `getLeavesOfType` at `main.ts:113` is the sibling already in use |

For all four, the fallback is direct verification against `node_modules/obsidian/obsidian.d.ts` plus the verified examples in `01-RESEARCH.md`. The planner should reference the research file's "Code Examples" section directly when writing the per-requirement plans.

---

## Verification Hooks for the Planner

Each plan should include build verification per research §"Verification Approach":

```bash
node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck && \
  node esbuild.config.mjs production && \
  echo "BUILD OK"
```

Per-requirement static greps from `01-RESEARCH.md` lines 539-571 are the acceptance gates:
- TD-01: `grep -n "refreshMinutes" src/services/CalendarService.ts` — no output
- TD-02: `grep -n "private app\b\|private settings\b" src/services/NoteService.ts` — no output (settings is now a getter, not a field)
- TD-03: `grep -n "window\.setInterval\|window\.setTimeout\|setTimeout\|setInterval" src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts` — every match must be inside a `registerInterval(...)` wrap
- TD-04: `grep -n "isDragging\|onClose" src/views/CalendarView.ts` — flag declaration + set/clear in `handleDragStart`/`handleDragEnd` + `onClose` override present
- CLEAN-01: `grep -rn "calculateEndDate\|DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/` — no output; plus `grep -n "renderAgendaList" src/views/EmbeddedAgendaView.ts` — no output; plus `grep -n "\bApp\b" src/views/EmbeddedCalendarView.ts` — no output; plus `grep -n "\bTFile\b" src/views/EmbeddedAgendaView.ts` — no output

---

## Metadata

**Analog search scope:** `src/` (`main.ts`, all services, all views, all utils, all settings)
**Files scanned:** 7 directly modified + `SettingsTab.ts` (registerDomEvent analog) + `IcsImportService.ts` (service shape sanity-check) + `obsidian.d.ts` (Component / View / Workspace API verification, via research)
**Pattern extraction date:** 2026-05-09
**Pattern source confidence:** HIGH — every concrete pattern excerpt is from a file currently on disk; signature verifications cross-checked against `01-RESEARCH.md`'s VERIFIED claims.
