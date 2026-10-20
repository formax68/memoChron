---
phase: 04-ux-enhancements
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/services/NoteService.ts
  - src/settings/SettingsTab.ts
  - src/settings/types.ts
  - src/utils/viewRenderers.ts
  - src/views/CalendarView.ts
  - src/views/EmbeddedAgendaView.ts
  - src/views/EmbeddedCalendarView.ts
  - styles.css
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 4: Code Review Report (post 04-06 gap closure)

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The gap-closure pass 04-06 successfully closed WR-01 (agenda note-indicator
trailing layout), WR-02 (today-ring contrast when selected), and WR-03
(active-file guard on cursor rAF). All three fixes are correct, surgical,
and verified in the diff.

However, this re-review surfaces **one new BLOCKER** (CR-01) — the ENH-03
grid corner-square exhibits the same zero-contrast failure pattern that WR-02
fixed for the today-ring: it uses `var(--interactive-accent)` against a
`.memochron-day.selected` background that ALSO uses `var(--interactive-accent)`,
so the dot disappears the moment the user selects a day that has a note.
The original verification (04-VERIFICATION.md) checked the unselected day
case and marked ENH-03 VERIFIED — it missed this state combination. This is
the exact analog of the WR-02 bug the gap-closure plan fixed and was overlooked.

Two warnings cover a missing user-facing error handler on the embedded-agenda
event-click path and the known IN-03 rAF cancellation gap (intentionally
deferred per 04-06 plan but worth re-surfacing as a small future task). Four
info items cover code-quality smells: a dead CSS variable, a `const file =
createdFile` shadowing pattern used twice to satisfy strict-null narrowing,
duplication between the shared `renderEventItem` and `CalendarView.renderEventItem`,
and the inconsistency between `setIcon` rendering being gated on `options.hasNote`
in the shared/embedded paths but unconditional in `CalendarView`.

The phase otherwise meets its ROADMAP success criteria and is one CSS
override away from clean.

## Critical Issues

### CR-01: ENH-03 grid corner-square disappears when day is `.selected` (same bug class as WR-02)

**File:** `styles.css:221-230` (definition) and `styles.css:146-148` (parent state)

**Issue:** The note-indicator corner-square on the calendar grid uses
`background-color: var(--interactive-accent)` (line 228). When the day cell
also has the `.selected` class, the cell's `background-color` is ALSO
`var(--interactive-accent)` (line 147). The 6x6 square has zero contrast
against the cell background and is invisible in this state.

This is identical in shape to the WR-02 today-ring bug that 04-06 just fixed,
and applies whenever a user clicks (selects) any day that has at least one
event with an existing note while `showNoteIndicatorOnGrid` is enabled.

Practical impact: the feature is unreliable for its primary user — someone
who wants to see, at a glance, which days have notes — because the indicator
silently vanishes on whichever day they are currently viewing. The
verification report's `truth #3 VERIFIED` (04-VERIFICATION.md line 45) was
issued without exercising the selected-day branch and should be downgraded.

Note: today + selected + has-note is the worst case — the ring is visible
(post-WR-02 fix), but the indicator is not. today + not-selected + has-note
is clean (no `.selected` background; indicator is visible against transparent).

**Fix:**
Add a combined-state override immediately after the existing
`.memochron-note-indicator` rule. The contrast token already used by WR-02
is the natural pick — `--text-on-accent` is theme-aware and was vetted in
04-06:

```css
/* ENH-03: contrasting indicator when the day is also selected — survives the accent background */
.memochron-day.selected .memochron-note-indicator {
  background-color: var(--text-on-accent);
}
```

(A `border-radius: 1px` ring or a small outline would also work, but a single
color override is the minimum diff and matches the WR-02 resolution style.)

## Warnings

### WR-01: `EmbeddedAgendaView.handleEventClick` swallows `createEventNote` failures

**File:** `src/views/EmbeddedAgendaView.ts:391-432`

**Issue:** `NoteService.createEventNote` re-throws on failure
(`NoteService.ts:82`: `throw error;`). `handleEventClick` awaits it directly
without a `try/catch`. If folder creation fails or
`vault.create` rejects (path collision with non-TFile, write permission,
etc.), the rejection escapes the click listener at line 344-347 as an
unhandled promise rejection — the user sees nothing.

For comparison, `CalendarView.addEventClickHandler` (lines 918-925) wraps the
equivalent `showEventDetails` call in `try/catch` and surfaces a Notice. The
embedded-agenda path is missing this parity.

A real-world trigger: a user with no `noteLocation` configured will be
caught by the early guard at line 392-395, but a user with a corrupt
`folderPathTemplate` (e.g., a `{` with no closing brace producing an invalid
path) will trip `buildFilePath`'s fallback OR cause `ensureParentFolder` to
throw. Either way, no user feedback in the embedded surface.

**Fix:** Wrap the body of `handleEventClick` (or just the `createEventNote`
call) in `try/catch`, log via `errorMessage`, and surface a `Notice`:

```ts
private async handleEventClick(event: CalendarEvent) {
  if (!this.plugin.settings.noteLocation) {
    new Notice("Please set a note location in settings first");
    return;
  }

  try {
    let file = this.plugin.noteService.getExistingEventNote(event);
    const isNewNote = !file;
    let cursorPos: { line: number; ch: number } | null = null;

    if (!file) {
      const created = await this.plugin.noteService.createEventNote(event);
      file = created.file;
      cursorPos = created.cursor;
      // ... rest unchanged
    }
    // ... rest unchanged
  } catch (error) {
    console.error("Failed to create note:", errorMessage(error));
    new Notice("Failed to create note. Check the console for details.");
  }
}
```

### WR-02: rAF callback can fire after the view is unloaded (IN-03 re-surfaced)

**File:** `src/views/CalendarView.ts:963-969` and `src/views/EmbeddedAgendaView.ts:422-428`

**Issue:** The active-file guard added in 04-06 makes the wrong-file cursor
write impossible at the user-visible site, but the `requestAnimationFrame`
handle is never cancelled if the surface unloads between scheduling and
firing. The callback closure holds `this.app`/`this.plugin.app` and
`file`/`pos`; on the next frame after unload, it still runs and calls
`getActiveViewOfType(MarkdownView)` against the live app. The
`view.file?.path === file.path` guard means it cannot corrupt user data, but
the callback execution after unload is technically a lifecycle leak.

The 04-06 plan explicitly deferred this as IN-03 in `<deferred_ideas>`
(plan annotation) on the grounds that the wrong-file write is already
impossible. Calling it out here as a real warning so it is not lost when
this phase is closed.

**Fix:** Capture the rAF handle and cancel it on view unload. For
`CalendarView`, add an instance field and clear it in `onClose`:

```ts
private pendingCursorRaf: number | null = null;

// ... inside the rAF site ...
this.pendingCursorRaf = requestAnimationFrame(() => {
  this.pendingCursorRaf = null;
  // ... existing body ...
});

// ... in onClose ...
if (this.pendingCursorRaf !== null) {
  cancelAnimationFrame(this.pendingCursorRaf);
  this.pendingCursorRaf = null;
}
```

For `EmbeddedAgendaView`, do the same with an `onunload()` override (it
extends `MarkdownRenderChild`).

## Info

### IN-01: Dead CSS variable `--color-text-today`

**File:** `styles.css:11`

**Issue:** `--color-text-today: var(--interactive-accent);` is declared on
`:root` but has zero usages elsewhere in the file (verified by
`grep -n color-text-today styles.css`). The variable predates this phase but
sits alongside the ENH-01 today-cell styling and is easy to mistake for a
live theming hook.

**Fix:** Delete the line; if it was intended as a public theming hook,
either keep it and use it (replace the hard-coded
`var(--interactive-accent)` references at `.memochron-day.today`'s
`box-shadow` and `.memochron-day.today .memochron-day-header`'s `color`),
or document it explicitly in a comment.

### IN-02: `const file = createdFile` shadowing duplicated in two surfaces

**File:** `src/views/CalendarView.ts:959-962` and `src/views/EmbeddedAgendaView.ts:418-421`

**Issue:** The 04-06 fix introduced an aliasing pattern to satisfy
`strictNullChecks` inside the rAF closure:

```ts
const createdFile = file;          // outer alias for the new-note path
if (cursorPos !== null && createdFile) {
  const pos = cursorPos;
  const file = createdFile;        // inner shadow — re-binds the original name
  requestAnimationFrame(() => {
    ...
    if (view?.editor && view.file?.path === file.path) { ... }
  });
}
```

The inner re-binding of `file` to the same value via a different local
shadows the outer `let file: TFile | null`, defeats reader expectations,
and is duplicated verbatim in two files. The cleaner shape is to use
`createdFile` directly in the closure body and drop the inner `const file`:

```ts
const createdFile = file;
if (cursorPos !== null && createdFile) {
  const pos = cursorPos;
  requestAnimationFrame(() => {
    const view = ...
    if (view?.editor && view.file?.path === createdFile.path) {
      view.editor.setCursor(pos);
      view.editor.focus();
    }
  });
}
```

This is a maintainability nit, not a behavior bug.

### IN-03: Duplication between shared `renderEventItem` and `CalendarView.renderEventItem`

**File:** `src/utils/viewRenderers.ts:164-224` and `src/views/CalendarView.ts:835-853`

**Issue:** Two near-identical agenda event-item renderers exist — the
shared one in `viewRenderers.ts` (used by `EmbeddedAgendaView`) and the
sidebar-specific one in `CalendarView.ts`. ENH-02 had to add the note-icon
in both. Any future agenda-row change (icon position, accessibility label,
new field) has to be made in two places or risks regressing one surface.

This is noted in `04-CONTEXT.md` lines 142-143 ("Per-surface duplication is
real") as a known maintenance debt, but the ENH-02 work has now extended
the duplication rather than reduced it. Worth queuing a refactor pass
that has `CalendarView.renderEventItem` delegate to the shared function
(or extracts the icon-append step into a sibling helper both call). Not in
scope for this phase.

### IN-04: Note icon rendering is gated on `options.hasNote` in two paths and unconditional in a third

**File:** `src/utils/viewRenderers.ts:220-223`, `src/views/EmbeddedAgendaView.ts:338-341`, `src/views/CalendarView.ts:894-897`

**Issue:** The shared and embedded paths only render the
`memochron-event-note-indicator` if `options.hasNote` is provided
(`if (options.hasNote) { ... }`). The sidebar `CalendarView.renderEventNoteIndicator`
always renders the icon. Today the embedded view always passes `hasNote`,
so the practical behavior matches across surfaces — but a future caller of
`renderCalendarGrid`/`renderAgendaList` that forgets the callback would
silently lose the agenda icon, while the sidebar would keep showing it.
ROADMAP success criterion #2 mandates the icon unconditionally for
ENH-02.

**Fix:** Either drop the `if (options.hasNote)` guard in the shared/embedded
paths and call `options.hasNote?.(event) ?? false` to default to "no note"
when the callback is missing, OR make the callback non-optional in
`RenderOptions` and require all callers to provide it. The latter matches
the always-on contract of ENH-02 better.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
