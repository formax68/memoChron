---
status: partial
phase: 03-date-parsing-navigation-bugs
source: [03-VERIFICATION.md]
started: 2026-05-12T09:00:00Z
updated: 2026-05-12T09:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. BUG-01: daily-note filename in non-UTC timezone selects the correct local day

expected: With Obsidian running on macOS or Linux in `America/New_York` (UTC-5) or any other timezone west of UTC, open the vault, locate or create a daily note named `2026-01-15.md` (no folder requirement; the file just needs to exist in the vault). Click the daily note in the file explorer. The MemoChron agenda pane selects January 15 — not January 14. The calendar grid highlights the January 15 cell. Repeat the test by renaming an existing note to `2026-06-15.md` (mid-year, DST boundary considerations) and confirm June 15 selects (not June 14).
result: [pending]

### 2. BUG-02: month and week navigation arrows feel instantaneous

expected: With at least one configured iCal source enabled and the calendar pane open in month-mode, click the next-month arrow ten times in rapid succession. Each click repaints the grid immediately — no spinner, no perceptible pause between click and paint. With DevTools network panel open, confirm that AT MOST one outbound calendar fetch fires during the ten clicks (not ten). Repeat in 1-week mode by clicking the next-week arrow ten times: same instant repaint, same single-fetch behavior. Confirms ROADMAP success criterion #2 and confirms the Phase 2 `fetchInFlight` dedup is collapsing concurrent triggers.
result: [pending]

### 3. BUG-03: Today button recenters across all view modes after a drag-resize

expected: With the calendar pane in month-mode (default), drag the resize handle UP until the calendar collapses to 1-week mode (the view-mode dropdown should read "Week" or the active week-mode label). Click the next-week arrow several times until today is no longer in the visible week. Click the Today button. The calendar repaints with today's week visible; today's cell is selected; the view-mode dropdown still reads "Week" (the view mode did not change). Repeat in 2-week mode: drag-resize to 2-week height, navigate away, click Today — today's week is centered within the 2-week range.
result: [pending]

### 4. BUG-04: 29-01-2026.md filename parses to 29 January 2026 (not 20 January 2029)

expected: Create (or rename an existing daily note to) a file named `29-01-2026.md` in the vault. Click it in the file explorer. The MemoChron agenda pane selects 29 January 2026. The calendar grid highlights the January 29, 2026 cell (NOT January 20, 2029 — the pre-#58 mis-parse). With code-review verification: `grep -n "#56" src/utils/viewRenderers.ts` returns the BUG-04 closure comment naming `#56`, `#58`, `BUG-01`, and `29-01-2026 → 2026-01-29 local`. Confirms ROADMAP success criterion #4 — closed AND documented.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
