---
phase: 09
review: 09-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "`yamlSafeTag` leaves tags unquoted that YAML parses as mappings, booleans, numbers or null"
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
    disposition: open
    title: "`String.replace` replacement patterns in event data corrupt note content (pre-existing, now on the new variables' path)"
  - id: IN-01
    severity: info
    disposition: open
    title: "`{{week}}` and `{{year}}` disagree at year boundaries"
  - id: IN-02
    severity: info
    disposition: open
    title: "Calendar tags are silently dropped when the `tags` shape is unsupported"
  - id: IN-03
    severity: info
    disposition: open
    title: "CRLF frontmatter is not recognized, so a duplicate `tags` key is emitted"
  - id: IN-04
    severity: info
    disposition: open
    title: "New variables are expanded inside earlier-substituted remote values"
  - id: IN-05
    severity: info
    disposition: open
    title: "The scalar path rewrites a quoted comma string's meaning"
open: 6
total: 10
recorded: 2026-10-21T05:40:51.920Z
---

# Phase 09: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 09-REVIEW-FIX.md |
| WR-02 | warning | fixed | 09-REVIEW-FIX.md |
| WR-03 | warning | fixed | 09-REVIEW-FIX.md |
| WR-04 | warning | fixed | 09-REVIEW-FIX.md |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
