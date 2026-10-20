# Requirements: MemoChron — v1.16 Issue Sweep

**Defined:** 2026-10-20
**Core Value:** Show the user's calendar inside Obsidian and let them turn any event into a structured note in one click — reliably, across desktop and mobile.

## v1 Requirements

Requirements for the v1.16 Issue Sweep milestone. Closes the four open user-reported GitHub issues against 1.15.0 (#61, #62, #63, #54). All work must pass the v1.15 ESLint/CI gate and follow `## Directory Compliance` in `.planning/codebase/CONVENTIONS.md`. Previous milestone archived at `.planning/milestones/v1.15-REQUIREMENTS.md`.

### Note creation — frontmatter (#61)

- [ ] **BUG-08**: When the default frontmatter (global or per-calendar) already contains a `tags` property, the event's calendar tags are merged into that existing property in place — no second `tags` key is emitted. Handles block-list (`tags:\n  - a`), inline-array (`tags: [a, b]`), and scalar (`tags: a`) forms
- [ ] **BUG-09**: Merged tags are deduplicated; the user's other frontmatter keys, their order, and existing tag values are preserved unchanged. When no `tags` key exists, a `tags` block is appended exactly as in 1.15.0

### Note creation — focus (#62)

- [ ] **ENH-07**: A new setting "Focus new event note" (default ON) makes a newly created event note open in a focused, active tab even when Obsidian's global "Always focus new tabs" option is disabled
- [ ] **ENH-08**: With the setting ON, the `{{cursor}}` marker places the caret in the focused editor so the user can type immediately; with the setting OFF, behavior is identical to 1.15.0

### Template variables (#63)

- [ ] **ENH-09**: `{{week}}` renders the ISO 8601 week number of the event start date, unpadded (e.g. `1`, `19`)
- [ ] **ENH-10**: `{{dd}}` renders the zero-padded day of month (`04`) and `{{d}}` renders the unpadded day of month (`4`) for the event start date
- [ ] **ENH-11**: `{{year}}` renders the four-digit calendar year of the event start date (calendar year, not ISO week-year)
- [ ] **ENH-12**: All four new variables work in note titles (sanitized), note templates, and default frontmatter; `{{d}}` substitution never corrupts `{{dd}}` or `{{date}}`

### Calendar view (#54)

- [ ] **BUG-10**: The sidebar calendar's view mode (Month or 1–N weeks, whether set via the dropdown or via drag-resize) is restored after an Obsidian restart and when the view is reopened
- [ ] **BUG-11**: The v1.14 BUG-02 (fast month/week arrow navigation) and BUG-03 (drag-resize syncs the view-mode dropdown; Today recenters) fixes are re-verified against 1.15.0 and still hold

### Docs & issue closure

- [ ] **DOC-03**: README and the settings-tab help text (note title format, note template) list `{{week}}`, `{{dd}}`, `{{d}}`, `{{year}}` and document the "Focus new event note" setting
- [ ] **ISSUE-01**: GitHub issues #61, #62, #63, and #54 each receive a closing comment referencing the release that fixes them; issues are closed only after the user confirms at release time

## v2 Requirements

Deferred. Tracked but not in current roadmap.

- **TMPL-01**: User-chosen date format tokens in templates (e.g. `{{date:WW}}`, `{{date:dddd D MMMM}}`) — generalizes #63 beyond fixed variables
- **I18N-01**: Locale-aware `{{day}}` / `{{month}}` names (part of #56 locale customization)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Locale customization (#56) | Full i18n is large; dedicated localization milestone |
| Arbitrary moment-format tokens in templates | Fixed variables satisfy #63; general format tokens deferred to TMPL-01 |
| Full YAML parse/re-serialize of user frontmatter | Risk of reformatting/reordering user-authored frontmatter; BUG-08/09 only touch the `tags` key |
| CalDAV (#30), Apple Calendar (#37), bulk import (#38) | Unchanged from v1.15 — each needs its own feature milestone |
| Test suite | Still zero tests; separate milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 0
- Unmapped: 12 ⚠️

---
*Requirements defined: 2026-10-20*
*Last updated: 2026-10-20 after initial definition*
