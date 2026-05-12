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
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 4 UX Enhancements changes (ENH-01 today indicator, ENH-02/03 note-exists indicators, ENH-04 dropdown relabel, ENH-05 `{{day}}`/`{{month}}` template vars, ENH-06 `{{cursor}}` marker). No security vulnerabilities found — all new DOM construction uses `createEl`/`setIcon` with hardcoded class names and static lucide icon IDs, and the `{{cursor}}` extraction does pure string manipulation with no eval/regex shortcuts. Cursor-placement timing via `requestAnimationFrame` is appropriate for the post-`openFile` case.

Three meaningful UX/visual defects surfaced:
1. The new `.memochron-event-note-indicator` uses `margin-left: auto` to push the icon to the trailing end, but the parent `.memochron-agenda-event` is `display: block` (not flex/grid), so the icon will not actually align right — it will render on its own line below the location row (WR-01).
2. ENH-01's today ring becomes effectively invisible when the today cell is also `.selected`, because both `box-shadow` and the selected-state `background-color` use the identical `var(--interactive-accent)` color (WR-02). The summary's smoke-test claim "ring is still visible on all four inner edges" contradicts the actual color math.
3. The `setCursor` rAF callback resolves `getActiveViewOfType(MarkdownView)` without verifying that the active view is the *file we just opened* — a fast user tab switch (or any other plugin pre-empting focus during `await leaf.openFile`) can land the cursor on a different file (WR-03).

Info-level items document smaller robustness gaps and one CSS commentary inaccuracy worth noting for follow-up.

## Warnings

### WR-01: Note-exists indicator never reaches "trailing end" — wrong flex context

**File:** `styles.css:630-636`, `src/utils/viewRenderers.ts:219-223`, `src/views/CalendarView.ts:894-897`, `src/views/EmbeddedAgendaView.ts:337-341`

**Issue:** The new rule

```css
.memochron-event-note-indicator {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  padding-left: var(--size-4-2);
  color: var(--text-muted);
}
```

uses `margin-left: auto` to push the icon to the trailing end of the agenda event row. However, the parent element `.memochron-agenda-event` (`styles.css:359-367`) is the default `display: block` — it is **not** a flex or grid container. `margin-left: auto` on a non-flex/grid child has no "push right" effect: for an `inline-flex` child in a block formatting context, the auto margin resolves to 0. The icon will appear on its own line below `.memochron-event-location` rather than aligned to the right of the other rows. The other children (`.memochron-event-time`, `.memochron-event-title`, `.memochron-event-location`) are also plain block divs that stack vertically, so there's no "row" to align trailing-end against.

The plan summary (04-04-SUMMARY.md) calls this an "inline-flex icon spacing" pattern with the icon "at trailing end of agenda event rows" — that is not what the current CSS produces.

This is reproducible in all three render paths (sidebar `CalendarView.renderEventItem`, embedded `EmbeddedAgendaView.renderEventItem`, shared `viewRenderers.renderEventItem`).

**Fix:** Make `.memochron-agenda-event` a flex container so `margin-left: auto` lands the indicator on the trailing end. One minimal-impact approach:

```css
.memochron-agenda-event {
  /* existing rules… */
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--size-4-1);
}
```

Then `margin-left: auto` on `.memochron-event-note-indicator` works as intended. Verify the colored left-border `::before` rule (`styles.css:378-387`) still aligns correctly with the new flex flow, and double-check the multi-day view's `.memochron-agenda-date-header` stays full-width (it should — it's a sibling, not a child).

Alternative: position the indicator absolutely at the right edge of the event row instead of relying on auto margins. That keeps the existing block layout but requires `.memochron-agenda-event { position: relative }` (which is already set on line 365) and `.memochron-event-note-indicator { position: absolute; top: 50%; right: var(--size-4-2); transform: translateY(-50%); }`.

---

### WR-02: ENH-01 today ring is invisible when today is also selected — same-color ring on same-color background

**File:** `styles.css:146-148`, `styles.css:162-164`

**Issue:** The ENH-01 rule

```css
.memochron-day.today {
  box-shadow: inset 0 0 0 2px var(--interactive-accent);
}
```

paints a 2px inset accent ring. The pre-existing `.memochron-day.selected` rule fills the cell background with the same color:

```css
.memochron-day.selected {
  background-color: var(--interactive-accent);
}
```

When a cell has BOTH `.today` and `.selected` (the common case where the user has today selected), the ring and the background are the identical color (`var(--interactive-accent)`), so the ring has zero visible contrast against the background — it disappears.

This contradicts plan 04-01's stated goal ("today stays visually distinct even when also .selected") and its Visual Smoke Check Note (b) which claims "the inset accent ring is still visible on all four inner edges" — that claim cannot be true given the CSS color math.

The only differentiation remaining for selected-today vs selected-other is the day-header weight (`.today .memochron-day-header { font-weight: 700 }` vs `.selected .memochron-day-header { font-weight: 600 }`). The `--interactive-accent` text color from `.today` is overridden by `--text-on-accent` from `.selected` via `!important` (`styles.css:151-153`).

**Fix:** Use a contrasting color for the today ring that survives the selected background. Options:

```css
/* Option A — use the on-accent variable so the ring is visible on accent fill */
.memochron-day.today {
  box-shadow: inset 0 0 0 2px var(--interactive-accent);
}
.memochron-day.today.selected {
  box-shadow: inset 0 0 0 2px var(--text-on-accent);
}
```

```css
/* Option B — use text-normal which contrasts both regular and selected backgrounds */
.memochron-day.today {
  box-shadow: inset 0 0 0 2px var(--text-normal);
}
```

Option A preserves the original accent-on-default appearance and only switches the ring color in the dual-state case. Either option meets the original "today stays visually distinct when selected" goal.

---

### WR-03: `setCursor` rAF callback does not verify the active view's file before writing the cursor

**File:** `src/views/CalendarView.ts:958-967`, `src/views/EmbeddedAgendaView.ts:417-426`

**Issue:** After `await leaf.openFile(file)`, the post-create block schedules:

```typescript
requestAnimationFrame(() => {
  const view = this.app.workspace.getActiveViewOfType(MarkdownView);
  if (view?.editor) {
    view.editor.setCursor(pos);
    view.editor.focus();
  }
});
```

`getActiveViewOfType(MarkdownView)` returns whichever MarkdownView is currently focused — there is no guarantee that view is the file we just opened. Failure modes:
- User switches tabs (or another plugin focuses a different leaf) between `openFile` resolving and the next animation frame.
- A faster background paint triggers the rAF before Obsidian fully registers the new leaf as active.
- The newly-opened file fails to attach a Markdown editor (e.g., the file opens in preview mode), but a different MarkdownView is active in another leaf — the cursor lands on that unrelated file.

When this happens, the cursor is written to the wrong file. There is no recovery and no log entry — the user sees their cursor jump to a position in a document they didn't expect.

**Fix:** Verify the resolved view points at the file we just created before writing the cursor:

```typescript
requestAnimationFrame(() => {
  const view = this.app.workspace.getActiveViewOfType(MarkdownView);
  if (view?.editor && view.file?.path === file.path) {
    view.editor.setCursor(pos);
    view.editor.focus();
  }
});
```

Apply the same guard in both `CalendarView.showEventDetails` and `EmbeddedAgendaView.handleEventClick`. The `view.file` property is the canonical "what file is this MarkdownView showing" handle — comparing paths is sufficient and is a one-line addition.

This is a low-probability bug in steady-state use but a non-deterministic correctness gap; on slow-loading vaults or during rapid clicks it becomes more likely.

## Info

### IN-01: Per-calendar Note template description omits new `{{day}}`, `{{month}}`, and `{{cursor}}` variables

**File:** `src/settings/SettingsTab.ts:1586-1598`, `src/settings/SettingsTab.ts:1683-1697`

**Issue:** The global Note title format (line 940) and Note template (line 1026) descriptions were correctly updated with the new variables. The per-calendar overrides (lines 1588 and 1685) do NOT list any variables at all — only "Title format for this calendar (leave empty to use default)" and "Template for this calendar (leave empty to use default)". Per-calendar overrides accept exactly the same variables, but the user has no in-UI way to discover this from the per-calendar panel.

**Fix:** This is the existing pattern (per-calendar descriptions deliberately defer to the global help text), so updating them is optional. If you want parity, mirror the variable list onto the per-calendar `setDesc()` calls, e.g.:

```typescript
.setDesc(
  "Template for this calendar (leave empty to use default). Same variables as the global template, including {{day}}, {{month}}, and {{cursor}}."
)
```

Documenting "same variables as global" is sufficient — no need to repeat the full list.

---

### IN-02: `extractCursorMarker` body-start detection is fooled by user-supplied frontmatter content that itself contains `---` lines

**File:** `src/services/NoteService.ts:183-219`

**Issue:** The walker counts the first two lines whose `.trim() === "---"` and treats everything after the second as body. If a user's `defaultFrontmatter` contains an interior `---` line (e.g., they wrote a malformed frontmatter that has `---` separators inside the YAML block), the walker will treat content inside the frontmatter section as body and *honor* a `{{cursor}}` in that pseudo-body region. The marker is still stripped, but the cursor lands in what semantically is frontmatter.

Concrete example user frontmatter:

```yaml
title: My event
---
extra: stuff with {{cursor}}
---
```

After `cleanFrontmatter`, the leading `---` (if present) and trailing `---` are stripped, but the interior `---` lines remain. The wrapper then re-adds outer `---` delimiters. The walker sees four `---` lines and stops counting at the second, putting `bodyStartLine` inside the user's malformed frontmatter content.

This is an edge case (user has to actively author malformed frontmatter), but the cursor will be placed in the frontmatter region, which D-13 explicitly disallows for "honoring" markers.

**Fix:** Two options:
1. Anchor on the actual frontmatter block produced by `generateFrontmatter` rather than re-scanning lines. Since `generateNoteContent` controls the combine step, it knows the exact line count of the frontmatter portion and can compute `bodyStartLine = frontmatterLineCount` directly:
   ```typescript
   const frontmatterLines = frontmatter.split("\n").length;
   const combined = `${frontmatter}\n${content}`;
   return this.extractCursorMarker(combined, frontmatterLines);
   ```
   Then `extractCursorMarker` accepts the body-start line index directly and skips the delimiter walk.
2. Sanitize the user's frontmatter input to reject/strip interior `---` lines.

Option 1 is cleaner and removes the malformed-input ambiguity entirely.

---

### IN-03: Pending `requestAnimationFrame` is not cancelled on view/render-child unload

**File:** `src/views/CalendarView.ts:961-967`, `src/views/EmbeddedAgendaView.ts:420-426`

**Issue:** If the user closes the calendar view (CalendarView.onClose) or unloads the embedded code block (MarkdownRenderChild.unload) while the post-create rAF is still pending, the callback fires after teardown. It is mostly harmless — `this.app.workspace` is still alive — but combined with WR-03 it can write a cursor into whatever MarkdownView happens to be active at fire time, which the user did not initiate.

**Fix:** Capture the rAF handle and cancel on unload:

```typescript
private pendingCursorRaf: number | null = null;
// in showEventDetails / handleEventClick:
if (this.pendingCursorRaf !== null) cancelAnimationFrame(this.pendingCursorRaf);
this.pendingCursorRaf = requestAnimationFrame(() => {
  this.pendingCursorRaf = null;
  // ... existing body, ideally with WR-03 fix applied
});
// in onClose / unload:
if (this.pendingCursorRaf !== null) {
  cancelAnimationFrame(this.pendingCursorRaf);
  this.pendingCursorRaf = null;
}
```

Low priority — combine with WR-03 fix for one cohesive cursor-placement cleanup.

---

### IN-04: `today` ring CSS comment is misleading

**File:** `styles.css:161`

**Issue:** The comment `/* ENH-01: persistent today indicator — inset ring survives the .selected accent background */` overstates the behavior. As surfaced in WR-02, the ring does not "survive" the selected background — both are the same color, so the ring is invisible in the selected-today state. Either fix the CSS per WR-02 (and the comment becomes accurate) or update the comment to acknowledge that the ring only shows when today is unselected.

**Fix:** Resolve WR-02; the comment becomes truthful again.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
