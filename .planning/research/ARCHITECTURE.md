# Architecture Research

**Domain:** Obsidian plugin — stabilization milestone
**Researched:** 2026-05-09
**Confidence:** HIGH (code read directly; Obsidian API verified via Context7)

---

## Architectural Questions and Answers

This document answers the five architectural questions raised by the active requirements.
It does NOT re-describe the existing architecture (see `.planning/codebase/ARCHITECTURE.md`).

---

## Q1: Live Settings Propagation (TD-01, TD-02)

### Problem

Two services hold stale data from their constructors:

- `CalendarService` stores `refreshMinutes` as a private field (line 40). `needsRefresh()` uses `this.refreshMinutes * 60 * 1000` instead of the live value. After a user changes the refresh interval in settings, the in-process timer is corrected by `setupAutoRefresh()` but the cache-expiry check inside the service continues using the old value until Obsidian restarts.

- `NoteService` is constructed with `this.settings` at plugin load (main.ts line 38). Because `saveSettings()` mutates the existing `this.settings` object in-place (via `Object.assign` at load, then direct mutation on save), the reference happens to be live today. But the code structure implies a snapshot and is one refactor away from silently breaking.

### Pattern Comparison

**Option A — Pass plugin reference (current CalendarService pattern):** CalendarService already does this — it holds `private plugin: MemoChron` and reads `this.plugin.settings` on demand. The stale bug exists only for `refreshMinutes` because it was additionally copied into a local field at construction. Fix is: delete the `refreshMinutes` constructor parameter and local field; replace the one `this.refreshMinutes` read in `needsRefresh()` with `this.plugin.settings.refreshInterval`.

**Option B — Getter function `() => this.settings`:** Breaks the circular-import concern noted in the existing ARCHITECTURE.md (CalendarService already imports from main.ts). Adds a new pattern inconsistency when Option A already works for the rest of CalendarService.

**Option C — Settings event-bus / reactive store:** Entirely disproportionate for a stabilization milestone. Introduces a new abstraction not needed anywhere else in the codebase.

### Recommendation: Option A, applied minimally

For **TD-01**: Remove the `refreshMinutes` constructor parameter from `CalendarService`. Replace `this.refreshMinutes` in `needsRefresh()` with `this.plugin.settings.refreshInterval`. The `private plugin: MemoChron` reference is already there and already used in 12+ places in the same file.

For **TD-02**: `NoteService` is safe today (settings object mutated in-place). Make it explicit and future-proof by changing `NoteService` construction to accept the plugin reference the same way CalendarService does — `new NoteService(this.app, this)` — and reading `this.plugin.settings` inside `NoteService` methods instead of `this.settings`. This removes the fragility noted in CONCERNS.md at the cost of the same mild circular-import that CalendarService already accepts.

**Alternative for TD-02 that avoids the circular import:** Change `NoteService` constructor to `(app: App, getSettings: () => MemoChronSettings)` and pass `() => this.settings`. This keeps NoteService free of the plugin class import and is the cleaner boundary. Either approach is acceptable; the getter is slightly more testable if tests are ever added.

### Files that change

| File | Change |
|------|--------|
| `src/services/CalendarService.ts` | Remove `refreshMinutes` param and field; read `this.plugin.settings.refreshInterval` in `needsRefresh()` |
| `src/services/NoteService.ts` | Change constructor to accept getter `() => MemoChronSettings`; replace all `this.settings` reads with `this.getSettings()` |
| `src/main.ts` | Change `new CalendarService(this, this.settings.refreshInterval)` to `new CalendarService(this)`; change `new NoteService(this.app, this.settings)` to `new NoteService(this.app, () => this.settings)` |

**Files that stay:** All views, `viewRenderers.ts`, `SettingsTab.ts`, `settings/types.ts`.

### Build-order implication

TD-01 and TD-02 are independent of each other and independent of all other items. They can be fixed in any order or in the same commit. No other item depends on them being done first.

### Component-boundary impact

Stays entirely within the service layer and plugin entry. No view code changes. The `CalendarService → MemoChron` import already exists; `NoteService` gains a new minimal dependency (a single getter function, not the full plugin reference, if the getter approach is used).

---

## Q2: Lifecycle Ownership (TD-03, TD-04)

### Problem

Two untracked resource lifetimes:

- `scheduleBackgroundRefresh()` in `CalendarService` calls `setTimeout(() => this.fetchCalendars(...), 100)` with no stored ID. If the plugin is disabled before the 100ms fires, the callback invokes a detached service instance.
- `CalendarView` attaches `mousemove` and `mouseup` to `window` in `handleDragStart()`. These are removed in `handleDragEnd()`, but if the view is closed mid-drag they leak and will fire on a destroyed view.

### Where setTimeout IDs Should Live

**Background refresh timeout (TD-03):** The ID belongs on `CalendarService` itself. It is the only entity that knows whether a background refresh is needed. The service should store `private backgroundRefreshTimeout: number | null = null` and cancel it in a new `destroy()` method. `MemoChron.onunload()` then calls `this.calendarService.destroy()`.

Do NOT store this ID on the plugin. The plugin does not know or care about the service's internal scheduling strategy. Keeping it on the service maintains encapsulation.

The view-init 50ms `setTimeout` in `CalendarView.onOpen()` is owned by the view. Store it as `private initTimeout: number | null = null` and clear it in `onClose()`.

The auto-refresh `window.setInterval` in `main.ts` already tracked as `this.refreshTimer`. Fix is to use `this.registerInterval(window.setInterval(...))` so Obsidian clears it automatically, removing the need for `clearRefreshTimer()` and its call in `onunload()`.

**Drag listeners (TD-04):** These belong on the view via `this.registerDomEvent`. However, `registerDomEvent` is designed for persistent listeners; drag `mousemove` and `mouseup` on `window` are transient — they exist only during a drag. The correct pattern for transient window listeners is to keep the current approach (`window.addEventListener` / `window.removeEventListener`) but add a defensive cleanup in `CalendarView.onClose()`:

```typescript
async onClose() {
  if (this.handleDragMoveBound) {
    window.removeEventListener("mousemove", this.handleDragMoveBound);
    window.removeEventListener("mouseup", this.handleDragEndBound);
  }
  if (this.initTimeout !== null) {
    clearTimeout(this.initTimeout);
    this.initTimeout = null;
  }
}
```

The drag-and-drop listeners on `this.agenda` (dragover, dragleave, drop) are persistent and can be converted to `this.registerDomEvent` calls.

### Files that change

| File | Change |
|------|--------|
| `src/main.ts` | Replace `window.setInterval` with `this.registerInterval`; remove `clearRefreshTimer()`; call `this.calendarService.destroy()` in `onunload()` |
| `src/services/CalendarService.ts` | Store background refresh timeout ID; add `destroy()` method that cancels it |
| `src/views/CalendarView.ts` | Add `onClose()` override with drag listener cleanup and `initTimeout` cancel; optionally convert `agenda` drag-and-drop listeners to `registerDomEvent` |

**Files that stay:** All other files.

### Build-order implication

TD-03 and TD-04 are independent. TD-03 (CalendarService) can be done before or after TD-04 (CalendarView). TD-03 in `main.ts` (registerInterval) should land before any BUG-06 work because BUG-06 (race condition) is in the same fetch/refresh path.

### Component-boundary impact

TD-03 crosses the plugin/service boundary (plugin must call `destroy()`). TD-04 is entirely within the view layer.

---

## Q3: "Event Has Note" Lookup (ENH-02, ENH-03)

### Problem

ENH-02 requires a visual indicator on agenda event items for events that already have an associated note. ENH-03 extends this to the calendar grid (day-level dot). Both need the answer to: "does the note for this CalendarEvent exist on disk right now?"

### Where This Logic Should Live

`NoteService` already has `getExistingEventNote(event: CalendarEvent): TFile | null` (line 75). The path-building logic is encapsulated there. This method is the correct lookup location — it is already called in `CalendarView.showEventDetails()` to check for an existing note before creating one.

The question is: who calls it at render time, and how does the result flow to the renderer?

**Option A — Views call NoteService at render time:** Each call to `renderEventItem` (in `CalendarView`) and the equivalent in `EmbeddedAgendaView` could call `plugin.noteService.getExistingEventNote(event)` synchronously. The call is cheap (it's just a vault path lookup, no I/O). This is the minimal change.

**Option B — Pre-compute a Set of note-existing event IDs before rendering:** Build `Set<string>` of event IDs with notes, pass it into the renderer. This keeps rendering pure. Suitable if the note lookup is ever found to be slow in practice (it won't be — `vault.getAbstractFileByPath` is a hashmap lookup).

**Recommendation: Option A** for the stabilization milestone. The lookup is already in `NoteService`, already used in the view, and is synchronous. Call it directly in `renderEventItem` and pass the result as a `hasNote: boolean` to `viewRenderers.ts` rendering functions via the existing `RenderOptions` pattern.

For ENH-03 (grid dot), the lookup is coarser: "does any event on this day have a note?" Compute this as a `Map<dateString, boolean>` before calling `renderCalendarGrid()` and pass it in `RenderOptions`. This avoids calling the service inside the grid cell renderer loop.

### Vault event refresh

When notes are created or deleted, the indicators need to update. The correct hook is:

```typescript
this.registerEvent(this.app.vault.on('create', () => this.renderCalendar()));
this.registerEvent(this.app.vault.on('delete', () => this.renderCalendar()));
```

Register these in `CalendarView.onOpen()`. Embedded views (`EmbeddedCalendarView`, `EmbeddedAgendaView`) extend `MarkdownRenderChild` — they should register vault events via `this.registerEvent` in their `onload()` method, which Obsidian will clean up when the note containing the code block is closed.

### Files that change

| File | Change |
|------|--------|
| `src/views/CalendarView.ts` | Pass `hasNote` boolean to `renderEventItem`; compute pre-render `Map<dateString, boolean>` for grid dot; register vault create/delete events |
| `src/utils/viewRenderers.ts` | Add optional `noteExistsMap` to `RenderOptions`; add optional `hasNote` param to agenda event rendering |
| `src/views/EmbeddedAgendaView.ts` | Pass `hasNote` to event rendering; register vault events |
| `src/views/EmbeddedCalendarView.ts` | Pass `noteExistsMap` to `renderCalendarGrid`; register vault events |
| `styles.css` | Add indicator styles |

**Files that stay:** `NoteService.ts` (method already exists), `CalendarService.ts`, `main.ts`, `settings/`.

### Build-order implication

ENH-02 and ENH-03 depend on `NoteService.getExistingEventNote()` which already exists. No prerequisite changes needed. Can start immediately. ENH-02 (agenda) and ENH-03 (grid) are independent of each other but share the same `RenderOptions` extension, so they should be implemented together or in the same PR to avoid double-touching `viewRenderers.ts`.

### Component-boundary impact

Crosses view/service boundary (views call NoteService at render time), which they already do for note creation. This is not a new boundary crossing — it is an additional call site of the same existing method.

---

## Q4: Today Indicator (ENH-01)

### Problem

The existing `today` detection in `renderMonthDays()` applies a CSS class (line 451 checks `date.toDateString() === today`). The requirement is a persistent visual indicator distinct from the selected-day highlight. Currently the same class or no class handles both states.

### Where This Lives

This is a **CSS + rendering split** change, not an architectural one:

1. `viewRenderers.ts` renders the calendar grid and is shared by `CalendarView` and `EmbeddedCalendarView`. The `today` check should be in `viewRenderers.ts` since both consumers need it.

2. `CalendarView.renderDay()` (currently in `CalendarView.ts`, not in `viewRenderers.ts`) adds `selected-day` and `today` class. The today class already exists; it may share CSS specificity with selected-day styling, causing the indicator to disappear when the day is selected.

3. The fix: ensure `memochron-today` and `memochron-selected` are separate CSS classes applied independently, so a cell can have both simultaneously. The rendering logic already computes `today` — only the CSS needs to be disentangled.

**No architectural change required.** The fix is:
- In `CalendarView.renderDay()` (and any equivalent in `EmbeddedCalendarView`), ensure both `memochron-today` and `memochron-selected` classes are applied when a date is both today and selected.
- Update `styles.css` to give `memochron-today` its own persistent styling (e.g., border or underline) that remains visible even when `memochron-selected` background is also applied.

### Files that change

| File | Change |
|------|--------|
| `src/views/CalendarView.ts` | Verify today/selected class logic applies both classes simultaneously |
| `src/views/EmbeddedCalendarView.ts` | Same verification |
| `styles.css` | Add persistent today indicator styling independent of selection |

**Files that stay:** `viewRenderers.ts` (if today rendering is already there), `CalendarService.ts`, all services.

### Build-order implication

ENH-01 has no dependencies. Can be done first (it's a CSS-plus-minimal-logic change). No other item depends on it.

### Component-boundary impact

View-layer only. No service involvement.

---

## Q5: Caret Placement (ENH-06)

### Problem

ENH-06 wants caret placement control in newly-created event notes (e.g., a `{{cursor}}` template variable or a setting). The current flow is:

```
CalendarView.showEventDetails(event)
  → NoteService.createEventNote(event)          [creates file, returns TFile]
  → leaf.openFile(file)                         [opens it]
  [caret ends up at position 0, line 0]
```

### Obsidian API for Cursor Placement

After `await leaf.openFile(file)`, the leaf's view is a `MarkdownView`. The editor is accessible via `(leaf.view as MarkdownView).editor`. The `Editor` interface exposes `setCursor(pos: EditorPosition)` where `EditorPosition = { line: number, ch: number }`.

Verified via Context7 (obsidianmd/obsidian-api): `editor.setCursor({ line: 0, ch: 0 })` is the canonical API. HIGH confidence.

### Where This Lives in the Flow

The caret placement logic belongs in `CalendarView.showEventDetails()` (and its parallel in `EmbeddedAgendaView` if that view also creates notes), not in `NoteService`. `NoteService` is a file-creation service; cursor positioning is a UI concern that belongs in the view that opens the file.

The `{{cursor}}` marker approach: `NoteService.generateNoteContent()` emits the marker into the note body at template-variable substitution time. After `vault.create`, the content is already written. After `leaf.openFile(file)`, the view finds the marker's line/character position and calls `editor.setCursor()`, then optionally removes the marker via `editor.replaceRange("", from, to)`.

### Implementation sketch (boundary-level only)

```
NoteService.createEventNote()  →  returns TFile (unchanged)
NoteService.getCursorPosition(file)  →  new method: reads file, finds {{cursor}}, returns EditorPosition | null

CalendarView.showEventDetails():
  file = await noteService.createEventNote(event)       // unchanged
  await leaf.openFile(file)                             // unchanged
  if (isNewNote) {
    const pos = await noteService.getCursorPosition(file)
    if (pos) {
      const editor = (leaf.view as MarkdownView).editor
      editor.setCursor(pos)
      // optionally remove marker: editor.replaceRange("", pos, {line: pos.line, ch: pos.ch + "{{cursor}}".length})
    }
  }
```

Alternatively, if no `{{cursor}}` marker is present, default to end-of-document: `editor.setCursor({ line: editor.lineCount() - 1, ch: 0 })`.

### Files that change

| File | Change |
|------|--------|
| `src/services/NoteService.ts` | Add `getCursorPosition(file: TFile): Promise<EditorPosition | null>` method; substitute `{{cursor}}` as a no-op in template output (or leave it and strip after find) |
| `src/views/CalendarView.ts` | After `leaf.openFile(file)`, call `getCursorPosition`, apply `editor.setCursor()` |
| `src/views/EmbeddedAgendaView.ts` | Same if that view creates notes |
| `src/settings/SettingsTab.ts` | Add documentation of `{{cursor}}` variable in the template help text |

**Files that stay:** `CalendarService.ts`, `viewRenderers.ts`, `main.ts`, `settings/types.ts` (unless a settings toggle is added).

### Build-order implication

ENH-06 depends on ENH-05 (`{{day}}` and `{{month}}` template variables) only in the sense that they touch the same template-variable machinery in `NoteService`. They are independent changes; ship separately or together. ENH-06 has no other prerequisites.

### Component-boundary impact

Crosses service/view boundary: `NoteService` gains a new read method; `CalendarView` calls it post-open. This is a narrow, well-defined addition. `MarkdownView` must be imported in `CalendarView` (it may already be present, or use `(leaf.view as any).editor` as a fallback with a type guard).

---

## What Stays As-Is

The following components require no architectural changes for this milestone:

- `CalendarService` fetch/parse/cache pipeline — only the `refreshMinutes` field is removed (TD-01); all parsing and caching logic is untouched.
- `IcsImportService` — no active requirements touch it.
- `viewRenderers.ts` — receives new optional `RenderOptions` fields for ENH-02/ENH-03; no structural change.
- `SettingsTab.ts` — SEC-01 (color validation) and CLEAN-01 (dead code removal) are in-place edits with no boundary changes.
- `settings/types.ts` — may gain a new setting field for ENH-06 cursor behavior, but no structural change.
- `timezoneUtils.ts`, `pathUtils.ts`, `constants.ts` — no active requirements touch these beyond CLEAN-01 removing dead constants.
- `EmbeddedCalendarView.ts`, `EmbeddedAgendaView.ts` — receive ENH-01/ENH-02/ENH-03 render updates and vault event registrations, but their class structure and extension hierarchy do not change.

---

## Suggested Refactors at Boundary Level

These are the only boundary-level changes needed. Everything else is internal implementation.

| Refactor | Boundary | Items Fixed |
|----------|----------|-------------|
| Remove `refreshMinutes` param from `CalendarService` constructor | `main.ts` → `CalendarService` | TD-01 |
| Change `NoteService` constructor to accept settings getter | `main.ts` → `NoteService` | TD-02 |
| Add `CalendarService.destroy()` method; call from `main.ts` `onunload()` | `main.ts` → `CalendarService` | TD-03 |
| Add `CalendarView.onClose()` override with drag cleanup | Internal to `CalendarView` | TD-04 |
| Add `NoteService.getCursorPosition(file)` method | `CalendarView` → `NoteService` | ENH-06 |
| Add vault event registrations in `CalendarView.onOpen()` and embedded view `onload()` | Views → Obsidian vault API | ENH-02, ENH-03 |

No new classes, no new files, no new abstractions. All changes are additive within existing components or are removal of stale constructor arguments.

---

## Build Order for Phase Splitting

If the milestone is split into phases, this ordering minimizes merge conflicts:

1. **Phase 1 — Lifecycle and cleanup (TD-01 through TD-04, CLEAN-01):** Pure refactors with no user-visible behavior change. Small diff. Ship first to clean the foundation.

2. **Phase 2 — Security (SEC-01, SEC-02):** Independent of phase 1 but benefits from clean codebase. Touches `SettingsTab.ts` and catch blocks in services/views.

3. **Phase 3 — Bug fixes (BUG-01 through BUG-06):** Several bugs are in `CalendarView.ts` and `CalendarService.ts`. Phase 1 having already landed reduces conflict risk.

4. **Phase 4 — UX enhancements (ENH-01 through ENH-06):** Depend on nothing in phases 1-3, but phase 1's vault event pattern (ENH-02/ENH-03) is cleanest after TD-04 is done. ENH-06 is cleanest after NoteService constructor is stabilized (TD-02).

Items within each phase are independent and can be parallelized.

---

## Anti-Patterns to Avoid in This Milestone

**Do not introduce a settings observer/event system.** The `plugin.settings` object mutation pattern works; the only fix needed is removing the constructor snapshot in two places. An event-bus would be a new abstraction with no other use case in this codebase.

**Do not refactor `CalendarService` to remove the plugin reference.** The anti-pattern note in ARCHITECTURE.md is correct in principle, but removing it would cascade through 12+ call sites in `CalendarService`. This is a future-milestone refactor, not stabilization work.

**Do not split `viewRenderers.ts` into per-view modules.** The shared rendering functions are the whole point. The ENH-02/ENH-03 `RenderOptions` additions are additive fields on an existing interface, not a reason to restructure.

---

## Sources

- `/Users/mike/code/memoChron/src/main.ts` — direct read (construction patterns)
- `/Users/mike/code/memoChron/src/services/CalendarService.ts` — direct read (refreshMinutes field, needsRefresh, scheduleBackgroundRefresh)
- `/Users/mike/code/memoChron/src/services/NoteService.ts` — direct read (constructor, getExistingEventNote, buildFilePath)
- `/Users/mike/code/memoChron/src/views/CalendarView.ts` — direct read (handleDragStart/End, showEventDetails, onOpen)
- `/Users/mike/code/memoChron/.planning/codebase/ARCHITECTURE.md` — existing architecture reference
- `/Users/mike/code/memoChron/.planning/codebase/CONCERNS.md` — concern descriptions and file locations
- Context7 `/obsidianmd/obsidian-api` — `Editor.setCursor`, `registerDomEvent`, `registerInterval`, vault events (HIGH confidence)

---

*Architecture research for: MemoChron stabilization milestone*
*Researched: 2026-05-09*
