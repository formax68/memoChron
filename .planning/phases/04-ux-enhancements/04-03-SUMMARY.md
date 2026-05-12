---
phase: 04-ux-enhancements
plan: "03"
subsystem: notes
tags: [template-variables, ux, ical, settings]
dependency_graph:
  requires: ["04-02"]
  provides: ["{{day}}-variable", "{{month}}-variable"]
  affects: ["src/services/NoteService.ts", "src/settings/SettingsTab.ts"]
tech_stack:
  added: []
  patterns: ["toLocaleDateString with hard-coded en-US locale"]
key_files:
  modified:
    - src/services/NoteService.ts
    - src/settings/SettingsTab.ts
  created: []
decisions:
  - "D-09: Locale hard-coded to \"en-US\" so weekday/month names are always English per ROADMAP success criterion #5"
  - "D-11: Source date is event.start only; no end-of-event variants this phase"
  - "{{day_short}} and {{month_short}} deferred — out of scope per D-11"
metrics:
  duration_minutes: 4
  completed_date: "2026-05-12"
  tasks_completed: 2
  files_changed: 2
---

# Phase 4 Plan 03: ENH-05 — `{{day}}` and `{{month}}` Template Variables Summary

Implemented ENH-05: two new note template variables that emit full English weekday and month names (`Monday`, `January`) from `event.start` with locale hard-coded to `"en-US"`.

## What Was Built

Both variables ride the existing `applyTemplateVariables` substitution path, which is called for both note body (`generateNoteContent` line 162) and note title (`formatTitle` line 280). No new substitution machinery was introduced.

### NoteService.ts changes

**Interface extension — `EventTemplateVariables` (lines 17-20):**

```diff
   end_time: string;
+  // Full English weekday name (e.g. "Monday") — locale hard-coded to "en-US"
+  day: string;
+  // Full English month name (e.g. "January") — locale hard-coded to "en-US"
+  month: string;
   source: string;
```

**Return object population — `getEventTemplateVariables` (lines 244-245):**

```diff
       end_time: this.formatTime(event.end, event.source),
+      day: event.start.toLocaleDateString("en-US", { weekday: "long" }),
+      month: event.start.toLocaleDateString("en-US", { month: "long" }),
       source: event.source,
```

### SettingsTab.ts changes

**`renderNoteTitleFormat` `.setDesc()` — line 924:**
Updated from:
```
"Format for new note titles. Available variables: {{event_title}}, {{date}}, {{start_date}}, {{end_date}}, {{start_time}}, {{end_time}}, {{source}}, {{location}}, {{description}}"
```
To (added `{{day}}, {{month}}` after `{{end_time}}`):
```
"Format for new note titles. Available variables: {{event_title}}, {{date}}, {{start_date}}, {{end_date}}, {{start_time}}, {{end_time}}, {{day}}, {{month}}, {{source}}, {{location}}, {{description}}"
```

**`renderNoteTemplate` `.setDesc()` — line 1010:**
Updated from:
```
"Template for the note content. Available variables: {{event_title}}, {{date}}, {{start_date}}, {{end_date}}, {{start_time}}, {{end_time}}, {{source}}, {{location}}, {{description}}, {{attendees}}, ..."
```
To (added `{{day}}, {{month}}` after `{{end_time}}`):
```
"Template for the note content. Available variables: {{event_title}}, {{date}}, {{start_date}}, {{end_date}}, {{start_time}}, {{end_time}}, {{day}}, {{month}}, {{source}}, {{location}}, {{description}}, {{attendees}}, ..."
```

## Node REPL Spot-Check

Locale independence confirmed — `"en-US"` is hard-coded so system locale does not affect output:

```
$ node -e "console.log(new Date(2026, 0, 15).toLocaleDateString('en-US', { weekday: 'long' })); console.log(new Date(2026, 0, 15).toLocaleDateString('en-US', { month: 'long' }))"
Thursday
January

$ LANG=de_DE.UTF-8 node -e "console.log(new Date(2026, 0, 15).toLocaleDateString('en-US', { weekday: 'long' })); console.log(new Date(2026, 0, 15).toLocaleDateString('en-US', { month: 'long' }))"
Thursday
January
```

January 15 2026 is a Thursday. English strings returned in both cases confirming locale-independence.

## Untouched Methods Verification

`git diff src/services/NoteService.ts` confirmed no hunks in:
- `applyTemplateVariables` (lines 254-272) — zero changes
- `formatTitle` (lines 274-290) — zero changes
- `generateNoteContent` (lines 155-174) — zero changes

Only two hunks: interface block (lines 14-21) and return object (lines 238-250).

## Acceptance Criteria Results

| Criterion | Result |
|-----------|--------|
| `tsc -noEmit` exits 0 | PASS |
| `npm run build` exits 0 | PASS |
| `grep -cE 'day: event.start.toLocaleDateString...'` returns 1 | PASS (1) |
| `grep -cE 'month: event.start.toLocaleDateString...'` returns 1 | PASS (1) |
| `grep -cE '^\s*day: string;'` returns 1 | PASS (1) |
| `grep -cE '^\s*month: string;'` returns 1 | PASS (1) |
| `grep -c '{{day}}'` SettingsTab returns >= 1 | PASS (2) |
| `grep -c '{{month}}'` SettingsTab returns >= 1 | PASS (2) |
| `grep -c '{{day_short}}'` SettingsTab returns 0 | PASS (0) |
| `grep -c '{{month_short}}'` SettingsTab returns 0 | PASS (0) |
| No test files created | PASS |
| Commit references ENH-05 and #56 | PASS |
| Commit has no Claude/AI references | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Commit

**1664255** — `feat(notes): add {{day}} and {{month}} template variables (ENH-05, #56)`

Both Task 1 (NoteService.ts) and Task 2 (SettingsTab.ts) landed in this single atomic commit per the plan's atomic-per-requirement granularity directive.

## Self-Check: PASSED

- [x] `src/services/NoteService.ts` — exists, contains `day: string;`, `month: string;` interface fields and both `toLocaleDateString("en-US", ...)` return object lines
- [x] `src/settings/SettingsTab.ts` — exists, contains `{{day}}` and `{{month}}` in two `.setDesc(...)` strings
- [x] Commit `1664255` exists in git log
- [x] No `*.test.ts` or `*.spec.ts` files created
