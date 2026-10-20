---
phase: 04-ux-enhancements
plan: 06
subsystem: ux
type: execute
mode: gap_closure
tags: [bugfix, css, ts, verification]
requirements_completed: [ENH-01, ENH-02, ENH-06]
gaps_closed: [WR-01, WR-02, WR-03]
dependency_graph:
  requires: [04-01, 04-04, 04-05]
  provides:
    - "ENH-01 truth #1 (today distinct when selected) → VERIFIED on next verify run"
    - "ENH-02 truth #2 (agenda icon at trailing end) → VERIFIED on next verify run"
    - "ENH-06 truth #6 (cursor lands in correct file) → VERIFIED on next verify run"
  affects: [styles.css, src/views/CalendarView.ts, src/views/EmbeddedAgendaView.ts]
tech_stack:
  added: []
  patterns:
    - "Absolute positioning anchored to a position: relative parent for trailing-end UI affordances"
    - "Active-file guard inside requestAnimationFrame callbacks (view.file?.path === file.path) to prevent cross-file cursor writes after async file open"
    - "Closure-local const re-bind to satisfy strictNullChecks when capturing a possibly-null let into a closure"
key_files:
  created: []
  modified:
    - styles.css
    - src/views/CalendarView.ts
    - src/views/EmbeddedAgendaView.ts
decisions:
  - "Today-ring contrast: chose REVIEW.md Option A (combined .today.selected override using --text-on-accent) over Option B (single rule with --text-normal) — preserves the verified-clean unselected-today appearance"
  - "Agenda indicator layout: chose REVIEW.md Option B (absolute positioning) over Option A (flexbox) — one-rule diff vs. multi-rule parent change, and preserves the existing vertical time/title/location block stack and the ::before colored-border anchoring"
  - "Active-file guard: kept the rAF mechanism (D-15 locked) and only added a guard inside the existing callback; cancellation on unload (IN-03) intentionally deferred to keep the diff minimal"
metrics:
  duration_minutes: 8
  completed_date: 2026-05-12
  tasks_completed: 3
  files_modified: 3
  commits: 3
---

# Phase 4 Plan 06: WR-01 / WR-02 / WR-03 Gap-Closure Summary

Three-edit surgical patch that closes the gaps surfaced by `04-VERIFICATION.md` so a re-run of `/gsd-verify-phase 4` should flip truths #1, #2, and #6 to VERIFIED (taking the phase from 4/6 to 6/6).

## What was fixed

### WR-02 — Today-ring contrast when today is also selected (truth #1 / ENH-01)

- **File:** `styles.css`
- **Change:** Added new rule `.memochron-day.today.selected { box-shadow: inset 0 0 0 2px var(--text-on-accent); }` immediately after the existing `.memochron-day.today` rule. The existing rule is unchanged. The misleading comment on the preceding line was replaced with a two-line comment block accurately documenting the dual-rule design.
- **Why this approach:** Option A from `04-REVIEW.md` (combined `.today.selected` override using `--text-on-accent`) was chosen over Option B (single rule with `--text-normal`). Option A only changes the dual-state appearance and preserves the original D-03 intent for the unselected-today case (which was verified clean).
- **Commit:** `12e9f3b fix(styles): today-ring contrast when today is also the selected day (WR-02)`

### WR-01 — Agenda note-indicator trailing-end layout (truth #2 / ENH-02)

- **File:** `styles.css`
- **Change:** Switched `.memochron-event-note-indicator` from `margin-left: auto` (which was a no-op on the block parent) to absolute positioning via `position: absolute; top: var(--size-4-2); right: var(--size-4-2);`. The icon now anchors to the top-right of each `.memochron-agenda-event` row by relying on the parent's existing `position: relative` (unchanged at styles.css:365). The colored left-border `::before` pseudo-element (styles.css:378-387) is also unchanged.
- **Why this approach:** Option B from `04-REVIEW.md` (absolute positioning) over Option A (flexbox on the parent). Absolute positioning is a one-rule diff that does not perturb the vertical block stack of time/title/location children and does not risk regressing the `::before` colored-border positioning that also relies on the same `position: relative` anchor.
- **Commit:** `af16a91 fix(styles): anchor agenda note-indicator to top-right via absolute positioning (WR-01)`

### WR-03 — Active-file guard inside cursor-placement rAF (truth #6 / ENH-06)

- **Files:** `src/views/CalendarView.ts`, `src/views/EmbeddedAgendaView.ts`
- **Change:** Inside the `requestAnimationFrame` callback in both `showEventDetails` (CalendarView) and `handleEventClick` (EmbeddedAgendaView), extended the existing condition `if (view?.editor)` to `if (view?.editor && view.file?.path === file.path)`. The rAF mechanism itself (D-15) is preserved — only an active-file guard was added.
- **Closure-binding adjustment:** Because the outer `file` is declared as `let file = ...` and reassigned on the create-new branch, TypeScript's strict-null narrowing does not flow into the rAF closure. To satisfy `strictNullChecks` while keeping the literal `view.file?.path === file.path`, the change introduces `const createdFile = file` outside the cursor branch and `const file = createdFile;` shadowing inside it. This is a closure-local re-bind only — no behavior change beyond ensuring TypeScript can prove non-nullness inside the callback.
- **Why this approach:** The plan's `<gap_closure_specifics>` was explicit that the rAF tick stays (D-15) and only the active-file check was missing. IN-03 (rAF cancellation on unload) was intentionally deferred per `<deferred_ideas>` to keep the diff minimal — the guard alone makes the wrong-file write impossible at the only moment the user-visible bug occurs.
- **Commit:** `31eb735 fix(views): guard cursor-placement rAF against active-file mismatch (WR-03)`

## Verification

- All three per-task `<verify>` blocks were re-run after their respective commits and pass:
  - `.memochron-day.today.selected` selector present with `text-on-accent`; original `.memochron-day.today` rule retained; misleading wording removed.
  - `.memochron-event-note-indicator` rule contains `position: absolute`, `top: var(--size-4-2)`, `right: var(--size-4-2)` and no `margin-left: auto`; parent `.memochron-agenda-event` still has `position: relative`; `::before` colored-border rule unchanged.
  - `view.file?.path === file.path` appears exactly once in each file, on the same line as the `view?.editor &&` conjunction, inside the existing `requestAnimationFrame` callback; no `cancelAnimationFrame` introduced.
- `npm run build` (which runs `tsc -noEmit -skipLibCheck && esbuild production`) exits 0 after each task.
- Phase-level non-regression checks from `<verification>` (`grep -n "memochron-day.today"`, `showNoteIndicatorOnGrid`, `extractCursorMarker`) confirm the shipped scope of 04-01..04-05 is unchanged — only the three targeted defects were touched.
- The next workflow step is to re-run `/gsd-verify-phase 4`, which is expected to report 6/6 truths VERIFIED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] strictNullChecks rejected `file.path` inside the rAF closure**
- **Found during:** Task 3 first build attempt (TS2531: Object is possibly 'null' in both `CalendarView.ts:963` and `EmbeddedAgendaView.ts:422`).
- **Issue:** The plan's `<interfaces>` block stated `file` is in scope and used the literal `view.file?.path === file.path`, but `file` is declared as `let file: TFile | null = ...` in both methods and reassigned on the create-new branch. TypeScript does not carry the `if (!file) throw` narrowing into the rAF arrow function under strict null checks.
- **Fix:** Inside the existing `if (isNewNote)` branch, introduced `const createdFile = file;` then `const file = createdFile;` in the inner `if (cursorPos !== null && createdFile)` scope. The closure now captures a non-null `const file: TFile`, the literal `view.file?.path === file.path` is preserved verbatim, and the runtime behavior is identical (we only enter the cursor branch when a new file was created and cursorPos is non-null, which already implied file was non-null).
- **Files modified:** `src/views/CalendarView.ts`, `src/views/EmbeddedAgendaView.ts`
- **Commit:** Folded into `31eb735` (Task 3 commit) — no separate commit.

No other deviations. No authentication gates encountered. No architectural decisions deferred to the user.

## Deferred Items (per plan `<deferred_ideas>`)

- **IN-01** — Per-calendar template description docs polish (omits `{{day}}`, `{{month}}`, `{{cursor}}`). Documentation polish; outside this gap-closure pass.
- **IN-02** — `extractCursorMarker` body-start detection is fooled by frontmatter containing interior `---`. Requires a refactor of `generateNoteContent` to pass a precomputed line count; current behavior is safe for well-formed frontmatter.
- **IN-03** — Cancel pending rAF on view/render-child unload (companion robustness to WR-03). Needs class-instance fields + teardown hooks in two surfaces. The WR-03 guard already makes the wrong-file write impossible at the user-visible site; IN-03 only adds protection against post-unload rAF firing into an unrelated MarkdownView (rare and lower severity).

All three are documented for a future hardening pass and do not affect any of the six ROADMAP success criteria.

## Known Stubs

None. This plan added no UI components, no settings, no new data sources — all three edits are surgical patches to already-shipped code.

## Self-Check: PASSED

- `styles.css` — modified, present in working tree.
- `src/views/CalendarView.ts` — modified, present in working tree.
- `src/views/EmbeddedAgendaView.ts` — modified, present in working tree.
- Commit `12e9f3b` (Task 1, WR-02) — FOUND in `git log --oneline`.
- Commit `af16a91` (Task 2, WR-01) — FOUND in `git log --oneline`.
- Commit `31eb735` (Task 3, WR-03) — FOUND in `git log --oneline`.
- `npm run build` — exits 0.
- No references to Claude or AI assistance in commit messages or this SUMMARY.
