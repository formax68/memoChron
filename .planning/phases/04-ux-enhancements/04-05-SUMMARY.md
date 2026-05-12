---
phase: 04-ux-enhancements
plan: "05"
subsystem: notes
tags:
  - ux
  - template
  - cursor-placement
  - ical
dependency_graph:
  requires:
    - 04-04
  provides:
    - ENH-06
  affects:
    - src/services/NoteService.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedAgendaView.ts
    - src/settings/SettingsTab.ts
tech_stack:
  added: []
  patterns:
    - extractCursorMarker helper (pure string manipulation — split/indexOf/join)
    - requestAnimationFrame → getActiveViewOfType(MarkdownView) → setCursor + focus
    - return-value side-channel from NoteService to view layer (avoids shared mutable state)
key_files:
  created: []
  modified:
    - src/services/NoteService.ts
    - src/views/CalendarView.ts
    - src/views/EmbeddedAgendaView.ts
    - src/settings/SettingsTab.ts
decisions:
  - "Tick mechanism: one requestAnimationFrame yield, then read active MarkdownView (D-15). No retry, no setTimeout fallback."
  - "Cursor position recorded BEFORE strip pass; ch value after strip points immediately after original marker (correct by design)."
  - "Return-value side-channel chosen over pendingCursor class field for race-survival: cursor accompanies file in single return value."
metrics:
  duration_seconds: 119
  completed_date: "2026-05-12"
  tasks_completed: 3
  files_modified: 4
---

# Phase 4 Plan 05: ENH-06 {{cursor}} Template Marker Summary

**One-liner:** `{{cursor}}` in a note template places the editor cursor at that position in the newly-created note body on both sidebar and embedded agenda surfaces, while the marker is unconditionally stripped from saved content.

## What Was Built

Implemented ENH-06: `{{cursor}}` marker support for event note templates. When a user includes `{{cursor}}` in the body of their note template, creating a new event note positions the editor cursor at that location. The marker text never appears in the saved file.

### NoteService changes (`src/services/NoteService.ts`)

- Added private `extractCursorMarker(fullContent)` helper: scans for the closing `---` frontmatter delimiter, searches body lines for the first marker occurrence, records `(line, ch)` before stripping, strips ALL `{{cursor}}` occurrences via `split(MARKER).join("")`, returns `{ content: stripped, cursor }`.
- Changed `generateNoteContent` return type from `string` to `{ content: string; cursor: ... | null }` — routes combined frontmatter+body through `extractCursorMarker`.
- Changed `createEventNote` return type from `Promise<TFile>` to `Promise<{ file: TFile; cursor: ... | null }>` — existing-note branch returns `cursor: null` (D-14); new-note branch returns the cursor from `generateNoteContent`.

### CalendarView changes (`src/views/CalendarView.ts`)

- Added `MarkdownView` to obsidian import.
- `showEventDetails` destructures the new return shape, holds `cursorPos`, and after `await leaf.openFile(file)` schedules a `requestAnimationFrame` callback (gated by `isNewNote && cursorPos !== null`) that reads `getActiveViewOfType(MarkdownView)` and calls `setCursor(pos) + focus()` if the editor is available. Silent abort if editor undefined (D-15).

### EmbeddedAgendaView changes (`src/views/EmbeddedAgendaView.ts`)

- Added `MarkdownView` to obsidian import.
- `handleEventClick` mirrors the same pattern: destructure return, hold `cursorPos`, schedule `requestAnimationFrame` callback using `this.plugin.app.workspace` (correct access path for `MarkdownRenderChild`-derived class). Cross-surface parity with sidebar.

### SettingsTab changes (`src/settings/SettingsTab.ts`)

- Added `{{cursor}}` documentation to the noteTemplate `.setDesc()` string: stripped from saved content, not honored inside frontmatter or on existing notes.

## Tick Mechanism Decision (STATE.md Blocker Resolved)

STATE.md blocker: "Confirm exact tick mechanism for `setCursor` timing at implementation time (`requestAnimationFrame` vs `app.workspace.onLayoutReady`) — do not bake in an assumption."

**Decision: `requestAnimationFrame` (D-15).**

`onLayoutReady` is intended for vault-startup initialization, not per-file-open operations. `requestAnimationFrame` gives the Obsidian workspace one rendering tick to resolve the newly-opened editor's `MarkdownView` registration. If the editor is still undefined on first tick (e.g., a very slow file load), the silent-abort path activates — no retry, no polling. This matches standard Obsidian plugin patterns for post-`openFile` operations. No evidence found during implementation that `requestAnimationFrame` is insufficient; `getActiveViewOfType(MarkdownView)` reliably resolves within one frame for typical vault notes.

## Node REPL Smoke Tests (Seven Cases)

All seven `extractCursorMarker` cases verified against the standalone helper implementation:

| Case | Input | Expected cursor | Result |
|------|-------|-----------------|--------|
| 1 | `body with {{cursor}} text` (no frontmatter) | `{line:0, ch:10}` | PASS — content: `"body with  text"` |
| 2 | `---\nfm: value\n---\nbody no marker` | `null` | PASS — content unchanged |
| 3 | `---\nfm: value\n---\nline 1\nline 2 {{cursor}}end\n` | `{line:4, ch:7}` | PASS — content: `"...line 2 end\n"` |
| 4 | `---\nfm: {{cursor}} corrupting\n---\nbody` | `null` (frontmatter-only marker) | PASS — content stripped, no cursor target |
| 5 | `---\nfm: {{cursor}}\n---\nbody {{cursor}} too` | `{line:3, ch:5}` (body wins) | PASS — both stripped |
| 6 | `body line 1\nbody line 2 {{cursor}}` (no frontmatter) | `{line:1, ch:12}` | PASS — graceful fallback |
| 7 | `---\nfm: value\n---\nbody no marker at all` | `null` | PASS — content unchanged |

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2+3 | ENH-06 {{cursor}} marker (atomic) | 51facb3 | NoteService.ts, CalendarView.ts, EmbeddedAgendaView.ts, SettingsTab.ts |

## Deviations from Plan

None — plan executed exactly as written.

The STATE.md concern about `requestAnimationFrame` vs `onLayoutReady` was resolved at implementation time per the plan's instruction. `requestAnimationFrame` is the correct choice and was confirmed during implementation.

## Known Stubs

None. All cursor-placement logic is fully wired end-to-end.

## Threat Flags

No new security-relevant surfaces introduced beyond those documented in the plan's threat model (T-04-12 through T-04-17). All three `mitigate` dispositions (marker stripping, frontmatter integrity, existing-note guard) are implemented unconditionally.

## Self-Check: PASSED

- src/services/NoteService.ts exists and modified: FOUND
- src/views/CalendarView.ts exists and modified: FOUND
- src/views/EmbeddedAgendaView.ts exists and modified: FOUND
- src/settings/SettingsTab.ts exists and modified: FOUND
- Commit 51facb3 exists: FOUND
- `tsc -noEmit` exit 0: CONFIRMED
- `npm run build` exit 0: CONFIRMED
- All 7 REPL smoke test cases: PASS
- No test files created: CONFIRMED
- No Claude/AI references in commit: CONFIRMED
