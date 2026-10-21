---
phase: 09
review: 09-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "A quote in the middle of a plain `tags` scalar hides its comment, so valid YAML is rewritten as invalid YAML"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "`{{week}}` and `{{year}}` disagree at year boundaries (carried forward)"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Calendar tags are silently dropped when the `tags` shape is unsupported (carried forward)"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "CRLF frontmatter is not recognized, so a duplicate `tags` key is emitted (carried forward)"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "The scalar path changes the meaning of a quoted comma string (carried forward)"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "`NON_STRING_SCALAR` misses two forms that `js-yaml` reads as non-strings"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Backslash escapes in double-quoted values are ignored, so valid YAML is rewritten as invalid YAML"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The fallback path still writes calendar tags unquoted, so `#meeting` becomes `null`"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "New local-time variables disagree with the default `{{start_date}}` / `{{date-iso}}` (UTC)"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "`String.replace` replacement patterns in event data corrupt note content (pre-existing, now on the new variables' path)"
  - id: IN-04
    severity: info
    disposition: open
    title: "New variables are expanded inside earlier-substituted remote values"
open: 1
total: 11
recorded: 2026-10-21T06:34:51.324Z
---

# Phase 09: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 09-REVIEW-FIX.md |
| IN-01 | info | fixed | 09-REVIEW-FIX.md |
| IN-02 | info | fixed | 09-REVIEW-FIX.md |
| IN-03 | info | fixed | 09-REVIEW-FIX.md |
| IN-05 | info | fixed | 09-REVIEW-FIX.md |
| IN-06 | info | fixed | 09-REVIEW-FIX.md |
| WR-02 | warning | fixed | 09-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 09-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 09-REVIEW-FIX.md (not in the current review) |
| WR-05 | warning | fixed | 09-REVIEW-FIX.md (not in the current review) |
| IN-04 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
