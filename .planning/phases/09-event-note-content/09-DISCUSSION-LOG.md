# Phase 9: Event Note Content - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 09-event-note-content
**Areas discussed:** Merged tag output shape, Tag order & dedup rules, Tag edge cases, Variables in titles/folders (all delegated)

---

## Gray area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Merged tag output shape | Keep user's inline/scalar style or normalize to block list? | ✓ (delegated) |
| Tag order & dedup rules | User tags first? `#work` == `work`? Case-sensitive? | ✓ (delegated) |
| Tag edge cases | Empty `tags:`, `tags: []`, quoted, singular `tag:`, variable-produced tags, global vs per-calendar | ✓ (delegated) |
| Variables in titles/folders | Extend folder template too, or only titles/templates/frontmatter? | ✓ (delegated) |

**User's choice:** "sensible defaults on the above"
**Notes:** Claude chose defaults for all four areas — see CONTEXT.md D-01..D-14.

---

## Claude's Discretion

- All four gray areas (preserve user's tag form; user tags first, normalized case-insensitive dedup; only top-level `tags` merged, never a second key; new variables in titles/templates/frontmatter only, local time, ISO week).
- ISO week implementation (Obsidian `moment` vs helper), merger structure, exotic YAML shapes within the no-duplicate-key invariant.

## Deferred Ideas

- ISO-week token for folder-path template.
- Aligning calendar view week-number column with ISO weeks.
