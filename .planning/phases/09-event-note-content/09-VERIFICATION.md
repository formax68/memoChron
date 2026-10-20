---
phase: 09-event-note-content
verified: 2026-10-20T15:10:00Z
status: human_needed
score: 18/20 must-haves verified
covered_files:
  - ".planning/phases/09-event-note-content/09-01-PLAN.md"
  - ".planning/phases/09-event-note-content/09-01-SUMMARY.md"
  - ".planning/phases/09-event-note-content/09-02-PLAN.md"
  - ".planning/phases/09-event-note-content/09-02-SUMMARY.md"
  - ".planning/phases/09-event-note-content/verify-09.mjs"
  - "src/services/NoteService.ts"
  - "src/utils/eventDateVariables.ts"
  - "src/utils/frontmatterTags.ts"
covered_digest: "v3:sha256:474de655cea82b69181afc65afa25f155d1b2c5519ff85017cd4f75dd3694fb9"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items:
  - truth: "SC4: a template placing {{d}}, {{dd}} and {{date}} side by side renders all three correctly"
    reason: fixture-only
    harden: "The harness only uses timed 12:00 events, where the UTC date of {{date}} equals the local date in all 4 zones. For an all-day 2026-05-04 event in Europe/Athens the real path renders `4 04 2026-05-03` and the file is named `2026-05-03 - Holiday.md` (verifier probe). {{date}} is unchanged from 1.15.0 by prohibition (A-UTC / WR-04). Either declare that {{date}}/{{start_date}} are UTC-derived and document it, or decide to fix A-UTC."
human_verification:
  - test: "Obsidian UAT, date variables (09-01 Task 2 human-check, backstop truth). Build, copy main.js/manifest.json/styles.css into {vault}/.obsidian/plugins/memochron/, then reload. Set the title format to `{{year}}-W{{week}} {{dd}} {{event_title}}`, add the template line `{{d}} | {{dd}} | {{date}} | {{week}} | {{year}}` and the Default frontmatter line `week: {{week}}`. Create notes from TIMED 12:00 events on Mon 2026-05-04 and Fri 2027-01-01."
    expected: "Files `2026-W19 04 {title}.md` and `2027-W53 01 {title}.md`. Body lines `4 | 04 | 2026-05-04 | 19 | 2026` and `1 | 01 | 2027-01-01 | 53 | 2027`. Properties panel shows week = 19 / 53 with no error."
    why_human: "Backstop truth (verification: backstop). Real Obsidian file creation and Properties rendering cannot run in Node."
  - test: "Obsidian UAT, tag merge (09-02 Task 2 human-check, backstop truth). Use a calendar with Tags `work` and Default tags `event, meeting`. (1) Global Default frontmatter `tags:` / `  - a` / `  - b`. (2) `tags: [a, b]`. (3) `tags: a`. (4) `tags:` with user tag `#Work`. (5) No tags key at all. (6) Per-calendar custom notes settings with default frontmatter `tags: [p]`. Open each note in source mode too."
    expected: "Steps 1-3: ONE tags property with a, b, event, meeting, work and no 'Invalid properties' / YAML banner. Step 4: #Work once, no extra work. Step 5: same output as 1.15.0, with the tags block appended at the end. Step 6: one tags property with p, event, meeting, work and no global frontmatter mixed in. Other keys keep their order and values."
    why_human: "Backstop truth (A1). Only Obsidian's own YAML parser and Properties panel can confirm 'no duplicate-key or YAML error' (ROADMAP SC1)."
  - test: "Prohibition review (judgment-tier, 09-01): 'MUST NOT change the rendered value of any pre-existing template variable or the 1.15.0 note output for users who do not use the new tokens'."
    expected: "Human accepts. Non-authoritative LLM-judge verdict: HOLDS. checkParity compares byte-for-byte against a bundle verified to be the genuine 1.15.0 NoteService (it reproduces the #61 duplicate key), using defaults, all pre-existing vars with token-bearing description/location/attendees, a per-calendar override and 4 no-tags-key bodies, on 2 dates in 4 TZs. One uncovered edge: an ICS event TITLE containing a literal `{{week}}` now renders as `Sprint 19` (IN-04). In 1.15.0 it stayed literal. This is the same pre-existing sequential-substitution behavior that already applied to `{{date}}` etc."
    why_human: "unverified-prohibition, human review recommended (judgment tier, no wired enforcement descriptor)"
  - test: "Prohibition review (judgment-tier, 09-02): 'MUST NOT round-trip user frontmatter through a YAML parse/serialize step in shipped code'."
    expected: "Human accepts. Non-authoritative LLM-judge verdict: HOLDS. `grep -rnE 'parseYaml|stringifyYaml|processFrontMatter|from \"yaml\"|js-yaml' src/` finds nothing. frontmatterTags.ts has zero imports and edits lines only."
    why_human: "unverified-prohibition, human review recommended (judgment tier)"
  - test: "Prohibition review (judgment-tier, 09-02): 'MUST NOT delete, overwrite, re-quote, re-case or reorder user-authored tags or any other frontmatter line; when a shape cannot be edited safely the user's lines win'."
    expected: "Human decides. Non-authoritative LLM-judge verdict: HOLDS for every fixture shape (T1-T11, F1-F18, U1-U6), but is VIOLATED for one input class: a double-quoted scalar containing an escaped quote followed by ` #`. `tags: \"a\\\" #b\"` is rewritten to `tags: [\"a\\\", c] #b\"`, which is invalid YAML (WR-02, reproduced by the verifier). That means Obsidian drops all properties for the note. 1.15.0 also produced invalid YAML for this input (a duplicate tags key), so this is not a regression. The input is also not a legal Obsidian tag (quote and space). Related: IN-05 changes the meaning of the quoted comma scalar `tags: \"a, b\"` to the array `[\"a, b\", z]`."
    why_human: "unverified-prohibition, human review recommended. The decision is whether WR-02 is fixed in this phase or accepted as a known limitation."
  - test: "Decide on review warnings WR-01, WR-02 and IN-03 (verifier-reproduced). WR-01: calendar tags `foo:`, `true`, `123` are written unquoted, giving parsed tags [a, {foo: null}, true, 123]. WR-02: see the prohibition item above. IN-03: CRLF default frontmatter is not recognized, so a second tags key is appended. CRLF only arrives through a hand-edited data.json, because the settings textareas normalize to LF."
    expected: "Each is fixed now, or recorded as accepted/deferred in 09-REVIEW-DISPOSITION.md (all 10 findings are currently `open`). None is a regression vs 1.15.0, and none breaks the documented fixture shapes."
    why_human: "Scope/risk decision. The phase goal is achieved for every reachable, valid-tag input, but these are counterexamples to the universal wording of the D-03 truth."
  - test: "Decide on WR-04 / A-UTC. New {{dd}}/{{d}}/{{week}}/{{year}} are local time, while pre-existing {{date}}/{{start_date}}/{{*-iso}} are UTC. An all-day 2026-05-04 event in Europe/Athens yields file `2026-05-03 - Holiday.md` with body `4 04 2026-05-03 19 2026` (verifier probe)."
    expected: "Accept and document it for Phase 11 DOC-03, or open a follow-up. Changing {{date}} is prohibited in this phase."
    why_human: "Product decision. SC4's 'renders all three correctly' is only demonstrated for timed events."
---

# Phase 9: Event Note Content Verification Report

**Phase Goal:** Event notes created from any calendar carry exactly one `tags` property, with the calendar's tags merged into whatever the user's default frontmatter already declares. Note titles, templates, and frontmatter can use the ISO week number, the padded and unpadded day of month, and the calendar year (#61, #63).
**Verified:** 2026-10-20T15:10:00Z
**Status:** human_needed
**Re-verification:** No. Initial verification.

## Goal Achievement

### Observable Truths

ROADMAP success criteria (SC1-SC4) are merged with the PLAN must-haves. A plan truth that restates an SC is folded into it.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / D-01 / BUG-08: block, inline and scalar user `tags` (global and per-calendar) give exactly one tags key with user + calendar tags, each once, and valid YAML | ✓ VERIFIED (automated part) | T1-T11 and F1-F18 assert exact strings through the real `createEventNote`, plus `YAML.parse(uniqueKeys)` and `js-yaml`. T9 covers the per-calendar case. The verifier independently showed that the 1.15.0 bundle emits `tags: [a]` + a second `tags:` block, and the current code emits `tags: [a, event, meeting, Work]`. The Obsidian Properties clause is carried by truth 19 |
| 2 | SC2 / D-02 / BUG-09: other keys keep order and value; with no tags key, output is identical to 1.15.0 | ✓ VERIFIED | Exact-string fixtures cover every surrounding line. `checkParity` diffs 4 no-key bodies × sourceTags [] and [x] × 2 dates × 4 TZs against `git show 1.15.0:src/services/NoteService.ts`. The baseline is confirmed to be genuine 1.15.0 |
| 3 | SC3 / D-13: 2026-05-04 → 19/04/4/2026; 2027-01-01 → week 53, year 2027 | ✓ VERIFIED | `checkTracer`, through both the util and createEventNote, in 4 TZs. The verifier probe also confirms an all-day 2026-05-04 event in Athens gives `4 04 … 19 2026` |
| 4 | SC4 / D-11 / D-14: the variables resolve in the sanitized title, the body and frontmatter; `{{d}} {{dd}} {{date}}` has no cross-substitution | ✓ VERIFIED (coincidental-reliance) | `checkTracer` (basename `2026-W19 04 4 Standup.md`), `checkSanitizedTitle` (`2026-W19 04 a-b-c--.md`), `checkAdjacency` (`4 04 {iso}\|404\|{{ d }} {{D}} {{ddd}}\|192026` and frontmatter `line: 404 19`). Full-token `{{key}}` regex. See coincidental_reliance: {{date}} is UTC (WR-04) |
| 5 | D-12: local time, independent of the Note date format setting | ✓ VERIFIED | `checkDateFormatIndependence`, US vs ISO, gives `04\|4\|2026\|19` for both. The util uses only `getDate`/`getFullYear`/luxon `fromJSDate`, and no code changes luxon `Settings.defaultZone` |
| 6 | ENH-09 boundary matrix (11 cases) identical in 4 TZs | ✓ VERIFIED | `checkBoundaries`. Harness run: all 4 zones `ok` |
| 7 | ENH-09 precision: week/d unpadded, dd 2 digits, year 4 digits | ✓ VERIFIED | `checkPrecision` regexes over 13 dates |
| 8 | ENH-12 empty: all four values are non-empty digit strings | ✓ VERIFIED | `checkPrecision` (`^[1-9][0-9]*$` etc.) |
| 9 | ENH-12 ordering: new keys sit after `month`, before `source`; literal tokens in description/location/attendees are never substituted | ✓ VERIFIED | Interface order gate gives `week:string;,dd:string;,d:string;,year:string;` and the spread-position gate gives 1. Parity corpus (b) uses token-bearing ICS text |
| 10 | Prohibition guard: 1.15.0 byte parity for non-new-token settings | ✓ VERIFIED | `checkParity` corpora a/b/c + d-g |
| 11 | lint and build exit 0; package.json/lock unchanged since 1.15.0 | ✓ VERIFIED | `npm run lint` exit 0, `npm run build` exit 0, `git diff --quiet 1.15.0 -- package.json package-lock.json` gives OK |
| 12 | D-01 shapes: block (incl. indentless), inline (incl. `[]` and trailing comma), scalar/comma scalar → inline array, empty/~/null/'' → block items | ✓ VERIFIED | T1-T4, F1-F8 exact strings |
| 13 | D-03: never a second tags key; unsafe shapes (multi-line flow, flow map, block scalar, anchor, mixed indents, duplicate keys) left byte-identical | ✓ VERIFIED (with warnings) | U1-U6 are byte-identical. Not covered by the enumerated shapes: WR-02 (escaped quote, rewritten to invalid YAML) and IN-03 (CRLF, so a second key is appended). Both reproduced; neither is a regression vs 1.15.0. See Human Verification |
| 14 | D-04/05/06: user tags first in written form; calendar tags in order; normalized dedup (quotes, #, case); user duplicates kept | ✓ VERIFIED | T5, F10, F13, F14 |
| 15 | D-07..D-10: merge after substitution; only a column-0 (optionally quoted) key; per-calendar replaces global; trailing comment kept | ✓ VERIFIED | F18 (`tags: [Work, event]`), F11/F12/F17, T9, F4/F9/F16. The awk merge-after-substitution gate passes |
| 16 | BUG-08 adjacency: dedup into the user entry; `tags:` then `date: x` gets items between the two lines | ✓ VERIFIED | T4, T5, F13 |
| 17 | BUG-08 empty: empty frontmatter gives the 1.15.0 block; `tags:`/`~`/`''` give a block list; `[]` gives inline; zero calendar tags leave it untouched | ✓ VERIFIED | T3, T7, T10, F2, F7, F8, parity d-empty |
| 18 | BUG-08 ordering: `tags: [Work, a]` + [event, meeting, work] gives `tags: [Work, a, event, meeting]` | ✓ VERIFIED | F13 |
| 19 | Backstop: Obsidian rendering of the date variables (filenames, body, `week` property) | ? UNCERTAIN (insufficient_spec) | Non-inferable truth. Presence and the harness do not qualify, so it goes to human UAT |
| 20 | Backstop: Obsidian Properties panel shows one tags property, no YAML/duplicate-key error (block, inline, scalar, per-calendar) | ? UNCERTAIN (insufficient_spec) | Non-inferable truth (A1), so it goes to human UAT |

**Score:** 18/20 truths verified (0 present-but-behavior-unverified; 2 backstop truths awaiting human UAT)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/eventDateVariables.ts` | `getEventDateVariables`, `EventDateVariables` | ✓ VERIFIED | 28 lines. Its only import is luxon; it uses `weekNumber` (ISO, not `localWeekNumber`) and `getFullYear()` |
| `src/utils/frontmatterTags.ts` | `TagMergeResult`, `mergeCalendarTags`, `normalizeTag`, `splitComment`, `yamlSafeTag` | ✓ VERIFIED | 289 lines, 0 imports, all 5 exports present, full block/inline/scalar/guard logic (no tracer stub left) |
| `src/services/NoteService.ts` | Interface fields + spread; merge-or-append in `generateFrontmatter` | ✓ VERIFIED | Diff vs 1.15.0 has 24 lines. `applyTemplateVariables`, `formatTitle`, `sanitizeFileName` and the folder vars are untouched. `formatTagsYaml` is unchanged |
| `.planning/phases/09-event-note-content/verify-09.mjs` | Harness over real createEventNote, 4 TZs, 1.15.0 parity, `assertSingleTagsKey` | ✓ VERIFIED | 736 lines, 9 checks, exact-string asserts. Ends with `verify-09: all checks passed (4 timezones)` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| NoteService.ts | eventDateVariables.ts | `...getEventDateVariables(event.start),` after `month` | WIRED | Import present, and the spread sits between `month:` and `source:` |
| NoteService.ts | frontmatterTags.ts | `mergeCalendarTags(frontmatterContent, tags)` after `applyTemplateVariables` | WIRED | Inside `generateFrontmatter`; the awk ordering gate passes |
| NoteService.ts | `formatTagsYaml` (1.15.0 path) | else branch when `!merged.found` | WIRED | `const tagsYaml = this.formatTagsYaml(tags);` count 1; body unchanged |
| verify-09.mjs | NoteService.ts | esbuild bundle → `createEventNote` | WIRED | Verifier re-bundled independently and got the same behavior |
| verify-09.mjs | git tag 1.15.0 | `loadBundle("1.15.0")` | WIRED | Verifier confirmed the baseline bundle reproduces the 1.15.0 duplicate-key bug, so parity is a real comparison, not a self-comparison |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `getEventTemplateVariables` | week/dd/d/year | `event.start` (CalendarEvent from ICS) → luxon/Date accessors | Yes | ✓ FLOWING |
| `generateFrontmatter` | merged tags | `getTagsForEvent` (settings defaultTags + source.tags) → `mergeCalendarTags` → `vault.create` content | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full automated suite (run once) | `npm run lint && npm run build && node .planning/phases/09-event-note-content/verify-09.mjs` | lint 0, build 0, `verify-09 [Europe/Athens\|America/Los_Angeles\|Pacific/Auckland\|UTC]: ok`, `all checks passed (4 timezones)` | ✓ PASS |
| Baseline is genuine 1.15.0 (#61 reproduced) | verifier scratch probe, `tags: [a]` + calendar Work | 1.15.0: two tags keys; current: `tags: [a, event, meeting, Work]` | ✓ PASS |
| All-day event, Europe/Athens | verifier probe | `2026-05-03 - Holiday.md`, body `4 04 2026-05-03 19 2026` | ? new vars correct; {{date}} is UTC (pre-existing, WR-04) |
| WR-01 unquoted calendar tags | `mergeCalendarTags("tags: [a]", ["foo:","true","123"])` | one key, valid YAML, parsed `["a",{"foo":null},true,123]` | ⚠️ WARNING (type change, same as 1.15.0 append path) |
| WR-02 escaped-quote scalar | `mergeCalendarTags('tags: "a\" #b"', ["c"])` | `tags: ["a\", c] #b"`, YAML parse error | ⚠️ WARNING (invalid YAML; 1.15.0 was also invalid via a duplicate key) |
| IN-03 CRLF | createEventNote with `---\r\ntags: [a]\r\nx: 1\r\n---` | second `tags:` block appended | ⚠️ WARNING (only reachable through a hand-edited data.json; same as 1.15.0) |

### Probe Execution

Step 7c: not applicable. No `scripts/*/tests/probe-*.sh` exists, and no PLAN or SUMMARY declares one. The phase harness `verify-09.mjs` ran in the verifier's own process (see above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BUG-08 | 09-02 | Calendar tags merged into an existing `tags` (block/inline/scalar), no second key | ✓ SATISFIED (Obsidian UAT pending) | Truths 1, 12, 13, 16-18 |
| BUG-09 | 09-02 | Dedup; other keys and tag values preserved; no-key gives the 1.15.0 append | ✓ SATISFIED | Truths 2, 14, parity |
| ENH-09 | 09-01 | `{{week}}` ISO 8601, unpadded | ✓ SATISFIED | Truths 3, 6, 7 |
| ENH-10 | 09-01 | `{{dd}}` padded, `{{d}}` unpadded | ✓ SATISFIED | Truths 3, 5, 7 |
| ENH-11 | 09-01 | `{{year}}` calendar year | ✓ SATISFIED | Truths 3, 6 (2027-01-01 gives 2027; 2025-12-29 gives 2025) |
| ENH-12 | 09-01 | Works in title (sanitized), template, frontmatter; `{{d}}` never corrupts `{{dd}}`/`{{date}}` | ✓ SATISFIED (Obsidian UAT pending) | Truths 4, 8, 9 |

Orphaned requirements: none. REQUIREMENTS.md maps exactly BUG-08, BUG-09 and ENH-09..ENH-12 to Phase 9, and every one is claimed by a plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all 3 src files) | — | TBD/FIXME/XXX/TODO/console | — | None found |
| `src/utils/frontmatterTags.ts` | 124-130 | `yamlSafeTag` misses trailing colon and core-schema scalars (WR-01) | ⚠️ Warning | Calendar tags `foo:`/`true`/`123` change YAML type. There is still one key and the YAML is valid |
| `src/utils/frontmatterTags.ts` | 58-115 | Quote scanners ignore `\"` escapes (WR-02) | ⚠️ Warning | A pathological quoted user tag is rewritten to invalid YAML (the D-03 promise fails for that input) |
| `src/utils/frontmatterTags.ts` | 13, 145 | `\r` not handled (IN-03) | ⚠️ Warning | CRLF frontmatter gets a duplicate tags key; not reachable through the settings UI |
| `src/services/NoteService.ts` | 267-269 | `formatTagsYaml` still unquoted (WR-03) | ℹ️ Info | Kept intentionally for D-02/BUG-09 1.15.0 parity; product decision |
| `src/services/NoteService.ts` | 319-344 | `String.replace` `$`-patterns and sequential substitution (WR-05, IN-04) | ℹ️ Info | Pre-existing. The new tokens now also expand inside ICS titles (`Sprint {{week}}` becomes `Sprint 19`) |

### Human Verification Required

#### 1. Obsidian UAT: date variables
**Test:** Title format `{{year}}-W{{week}} {{dd}} {{event_title}}`, template line `{{d}} | {{dd}} | {{date}} | {{week}} | {{year}}`, frontmatter `week: {{week}}`. Create notes from timed 12:00 events on 2026-05-04 and 2027-01-01.
**Expected:** `2026-W19 04 …` / `2027-W53 01 …`; body `4 | 04 | 2026-05-04 | 19 | 2026` / `1 | 01 | 2027-01-01 | 53 | 2027`; `week` 19 / 53; no Properties error.
**Why human:** Backstop truth; real Obsidian rendering.

#### 2. Obsidian UAT: tag merge
**Test:** The six steps from 09-02 Task 2: block, inline and scalar forms, `#Work` dedup, no-key parity, per-calendar `tags: [p]`, and a source-mode check.
**Expected:** Exactly one tags property each time with no YAML banner, and 1.15.0 output when there is no key.
**Why human:** Only Obsidian's parser and Properties panel can confirm ROADMAP SC1's "no duplicate-key or YAML error".

#### 3-5. Judgment-tier prohibitions (3 items)
The non-authoritative verdicts are in the frontmatter. Two HOLD. The 09-02 "user's lines win" prohibition is violated by the WR-02 input class, so a human decision is needed.

#### 6. Review warnings WR-01 / WR-02 / IN-03
**Test:** Decide whether to fix them in this phase or record them as accepted or deferred in 09-REVIEW-DISPOSITION.md.
**Expected:** Every finding gets a disposition other than `open`.
**Why human:** Scope decision. Each is reproduced, none is a regression vs 1.15.0, and none affects a valid Obsidian tag in the documented shapes.

#### 7. WR-04 / A-UTC
**Test:** Decide whether to document the UTC `{{date}}` next to the local `{{dd}}` in Phase 11 DOC-03, or open a follow-up.
**Expected:** A recorded decision.
**Why human:** A product decision. This phase is prohibited from changing `{{date}}`.

### Gaps Summary

No blocking gaps. Every ROADMAP success criterion and every PLAN truth that can be checked automated is verified against production code. The evidence comes from the phase harness, which the verifier re-ran once (lint, build and 9 checks × 4 timezones), and from independent verifier probes. Those probes also confirmed that the 1.15.0 parity baseline is genuine: it reproduces the #61 duplicate `tags` key, and the current code merges it into one key.

The phase is not `passed`, for three reasons:
- Two backstop truths need real Obsidian UAT, notably SC1's "Properties panel shows no YAML error".
- Three judgment-tier prohibitions need human sign-off.
- The code review warnings are still `open`.

The verifier reproduced three of those warnings as counterexamples to the universal wording of the D-03 truth:
- WR-02: an escaped-quote scalar becomes invalid YAML.
- IN-03: CRLF input gets a duplicate key.
- WR-01: unquoted special calendar tags change type.

None is a regression vs 1.15.0. Each needs input that is not a legal Obsidian tag, or that the settings UI cannot produce. They were therefore classified as warnings for a human scope decision, not blockers.

SC4's "renders all three correctly" is demonstrated only for timed events. For all-day events in UTC+ zones, the pre-existing UTC `{{date}}` lags the new local `{{dd}}` by a day (WR-04 / A-UTC).

---

_Verified: 2026-10-20T15:10:00Z_
_Verifier: Claude (gsd-verifier)_
