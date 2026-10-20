---
status: testing
phase: 09-event-note-content
source: [09-VERIFICATION.md]
started: 2026-10-20T14:21:39Z
updated: 2026-10-20T14:21:39Z
---

## Current Test

number: 1
name: Obsidian UAT, date variables (09-01 Task 2 human-check, backstop truth)
expected: |
  Files `2026-W19 04 {title}.md` and `2027-W53 01 {title}.md`. Body lines `4 | 04 | 2026-05-04 | 19 | 2026` and `1 | 01 | 2027-01-01 | 53 | 2027`. Properties panel shows week = 19 / 53 with no error.
awaiting: user response

## Tests

### 1. Obsidian UAT, date variables (09-01 Task 2 human-check, backstop truth). Build, copy main.js/manifest.json/styles.css into {vault}/.obsidian/plugins/memochron/, then reload. Set the title format to `{{year}}-W{{week}} {{dd}} {{event_title}}`, add the template line `{{d}} | {{dd}} | {{date}} | {{week}} | {{year}}` and the Default frontmatter line `week: {{week}}`. Create notes from TIMED 12:00 events on Mon 2026-05-04 and Fri 2027-01-01.
expected: Files `2026-W19 04 {title}.md` and `2027-W53 01 {title}.md`. Body lines `4 | 04 | 2026-05-04 | 19 | 2026` and `1 | 01 | 2027-01-01 | 53 | 2027`. Properties panel shows week = 19 / 53 with no error.
result: [pending]

### 2. Obsidian UAT, tag merge (09-02 Task 2 human-check, backstop truth). Use a calendar with Tags `work` and Default tags `event, meeting`. (1) Global Default frontmatter `tags:` / `  - a` / `  - b`. (2) `tags: [a, b]`. (3) `tags: a`. (4) `tags:` with user tag `#Work`. (5) No tags key at all. (6) Per-calendar custom notes settings with default frontmatter `tags: [p]`. Open each note in source mode too.
expected: Steps 1-3: ONE tags property with a, b, event, meeting, work and no 'Invalid properties' / YAML banner. Step 4: #Work once, no extra work. Step 5: same output as 1.15.0, with the tags block appended at the end. Step 6: one tags property with p, event, meeting, work and no global frontmatter mixed in. Other keys keep their order and values.
result: [pending]

### 3. Prohibition review (judgment-tier, 09-01): 'MUST NOT change the rendered value of any pre-existing template variable or the 1.15.0 note output for users who do not use the new tokens'.
expected: Human accepts. Non-authoritative LLM-judge verdict: HOLDS. checkParity compares byte-for-byte against a bundle verified to be the genuine 1.15.0 NoteService (it reproduces the #61 duplicate key), using defaults, all pre-existing vars with token-bearing description/location/attendees, a per-calendar override and 4 no-tags-key bodies, on 2 dates in 4 TZs. One uncovered edge: an ICS event TITLE containing a literal `{{week}}` now renders as `Sprint 19` (IN-04). In 1.15.0 it stayed literal. This is the same pre-existing sequential-substitution behavior that already applied to `{{date}}` etc.
result: [pending]

### 4. Prohibition review (judgment-tier, 09-02): 'MUST NOT round-trip user frontmatter through a YAML parse/serialize step in shipped code'.
expected: Human accepts. Non-authoritative LLM-judge verdict: HOLDS. `grep -rnE 'parseYaml|stringifyYaml|processFrontMatter|from "yaml"|js-yaml' src/` finds nothing. frontmatterTags.ts has zero imports and edits lines only.
result: [pending]

### 5. Prohibition review (judgment-tier, 09-02): 'MUST NOT delete, overwrite, re-quote, re-case or reorder user-authored tags or any other frontmatter line; when a shape cannot be edited safely the user's lines win'.
expected: Human decides. Non-authoritative LLM-judge verdict: HOLDS for every fixture shape (T1-T11, F1-F18, U1-U6), but is VIOLATED for one input class: a double-quoted scalar containing an escaped quote followed by ` #`. `tags: "a\" #b"` is rewritten to `tags: ["a\", c] #b"`, which is invalid YAML (WR-02, reproduced by the verifier). That means Obsidian drops all properties for the note. 1.15.0 also produced invalid YAML for this input (a duplicate tags key), so this is not a regression. The input is also not a legal Obsidian tag (quote and space). Related: IN-05 changes the meaning of the quoted comma scalar `tags: "a, b"` to the array `["a, b", z]`.
result: [pending]

### 6. Decide on review warnings WR-01, WR-02 and IN-03 (verifier-reproduced). WR-01: calendar tags `foo:`, `true`, `123` are written unquoted, giving parsed tags [a, {foo: null}, true, 123]. WR-02: see the prohibition item above. IN-03: CRLF default frontmatter is not recognized, so a second tags key is appended. CRLF only arrives through a hand-edited data.json, because the settings textareas normalize to LF.
expected: Each is fixed now, or recorded as accepted/deferred in 09-REVIEW-DISPOSITION.md (all 10 findings are currently `open`). None is a regression vs 1.15.0, and none breaks the documented fixture shapes.
result: [pending]

### 7. Decide on WR-04 / A-UTC. New {{dd}}/{{d}}/{{week}}/{{year}} are local time, while pre-existing {{date}}/{{start_date}}/{{*-iso}} are UTC. An all-day 2026-05-04 event in Europe/Athens yields file `2026-05-03 - Holiday.md` with body `4 04 2026-05-03 19 2026` (verifier probe).
expected: Accept and document it for Phase 11 DOC-03, or open a follow-up. Changing {{date}} is prohibited in this phase.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
