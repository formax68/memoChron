---
phase: "9"
slug: "event-note-content"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-20"
---

# Phase 9 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| ICS / calendar event data -> NoteService template substitution | Event title/description/location from remote ICS feeds are inserted into titles, frontmatter and note bodies | Untrusted remote text |
| Rendered title -> vault file path | The formatted title becomes a filename via `sanitizeFileName` and `normalizePath` | Filename / path |
| User settings (default frontmatter, default tags, per-calendar tags) -> generated YAML | User-entered text is edited at line level and written into note frontmatter | User-authored YAML text |
| npm registry -> node_modules | `npm ci` installs locked packages for lint, build and the harness | Third-party packages (dev only) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Tampering | `formatTitle` with new tokens -> file path | low | mitigate | New values are digits only and pass through unchanged `sanitizeFileName` (`NoteService.ts:342`); `checkSanitizedTitle` in `verify-09.mjs` | closed |
| T-09-02 | Tampering | Existing template variable output | medium | mitigate | `checkParity` byte-diffs against the 1.15.0 NoteService; new keys placed before `source`/`description` | closed |
| T-09-03 | Tampering | Harness runs `git show 1.15.0:...` output in Node | low | accept | See Accepted Risks Log | closed |
| T-09-04 | Tampering | `mergeCalendarTags` writing tag text into YAML | medium | mitigate | `yamlSafeTag` (`frontmatterTags.ts:124`) applied on every merge path (lines 233, 239, 270, 285); fixtures T11/F15 parse under `yaml` (uniqueKeys) and `js-yaml` | closed |
| T-09-05 | Tampering | `mergeCalendarTags` corrupting user frontmatter | medium | mitigate | Line-scoped edits only; conservative classifier leaves unsafe shapes untouched (U1-U6); no YAML parse/serialize import under `src/` (grep guard) | closed |
| T-09-06 | Denial of Service | Regexes in `frontmatterTags.ts` (ReDoS) | low | accept | See Accepted Risks Log | closed |
| T-09-07 | Tampering | ICS `{{description}}` in frontmatter injecting a `tags:` line | low | accept | See Accepted Risks Log | closed |
| T-09-SC | Tampering | npm installs (`npm ci`) | high | mitigate | Lockfile-only `npm ci`; `git diff --quiet 1.15.0 -- package.json package-lock.json` exits 0 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-03 | Content comes from this repository's own release tag and runs only in a local verification script, never in the shipped bundle | plan 09-01 threat model | 2026-10-20 |
| AR-09-02 | T-09-06 | All regexes are anchored with no nested quantifiers; inputs are short user settings strings (a few KB at most) | plan 09-02 threat model | 2026-10-20 |
| AR-09-03 | T-09-07 | Same exposure as 1.15.0, only when the user puts `{{description}}` in frontmatter; the merger never adds a key when more than one `tags` key exists, so it cannot worsen it | plan 09-02 threat model | 2026-10-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-20 | 8 | 8 | 0 | secure-phase (L1 grep verification, execute-phase verify:post) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-20
