# Phase 2: Security & Correctness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 02-security-correctness
**Areas discussed:** Color validation regex, Invalid-color failure mode, SEC-02 scope & ergonomics, BUG-06 race fix approach

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Color validation regex | Stored colors today include hex (#rrggbb), hsl(...), and var(--color-red). The strict hex regex from REQUIREMENTS would reject most existing values. Decide what 'valid' means. | ✓ |
| Invalid-color failure mode | When loadSettings finds a bad color, what does the user see? | ✓ |
| SEC-02 scope & ergonomics | Apply the error pattern to every catch block in src/, or only sites with user-visible output? Inline pattern, or a small errorMessage(err) utility? | ✓ |
| BUG-06 race fix approach | Skip scheduleBackgroundRefresh, share the in-flight Promise, or queue a 'refresh requested' flag? | ✓ |

**User's choice:** All four areas selected for discussion.

---

## Color validation regex

| Option | Description | Selected |
|--------|-------------|----------|
| Permissive whitelist (Recommended) | Accept #rrggbb, #rgb, hsl(...), hsla(...), rgb(...), rgba(...), var(--<name>). Reject anything else. Preserves theme-following CSS vars; no migration needed. | ✓ |
| Strict hex only | Accept only `/^#[0-9a-fA-F]{6}$/` as REQUIREMENTS literally states. Migrate hsl/var values to resolved hex on load. Simpler regex, but loses CSS-var theme-following. | |
| Character-only whitelist | Accept any string with no `<`, `>`, `"`, `'`, backtick, or newline. Structurally safe inside SVG attributes but doesn't constrain the value to a real color. | |

**User's choice:** Permissive whitelist.
**Notes:** Decision diverges from the literal REQUIREMENTS.md regex (`/^#[0-9a-fA-F]{6}$/`) — captured in CONTEXT.md D-01 with rationale (CSS-var theme-following preserved; existing `hsl(...)` values from the auto-assignment path keep working).

---

## Invalid-color failure mode

| Option | Description | Selected |
|--------|-------------|----------|
| Silent default + console.warn (Recommended) | Replace the invalid color with the next palette color or a CSS-var fallback; log a console.warn naming the calendar. No Notice — most users will never see this and it's not actionable. | ✓ |
| Notice + default | Show a Notice ('MemoChron: replaced invalid color for calendar X'). User sees it but can't do anything beyond reopening settings. | |
| Silent default, no log | Just replace and move on. Cleanest UX but opaque if a real attacker triggers it during research. | |
| Disable that calendar source | Mark source.enabled=false and Notice the user. Pessimistic — treats any malformed color as suspicious. | |

**User's choice:** Silent default + console.warn.
**Notes:** Captured in CONTEXT.md D-04 / D-05.

---

## SEC-02 scope & ergonomics

| Option | Description | Selected |
|--------|-------------|----------|
| Every catch block + small helper (Recommended) | Add `errorMessage(err: unknown): string` in `src/utils/errors.ts`. Apply to every catch in src/ — services, views, settings, utils. Future-proofs against new sites; one-line touch each. | ✓ |
| Every catch block, inline pattern | Same scope but spell out `error instanceof Error ? error.message : String(error)` at each site. No new utility file. More verbose. | |
| Only user-visible sites + helper | Apply only to catches that produce a Notice or rendered text (~6–8 sites). Console-only error logs unchanged. Tightest match to success criterion. | |
| Only sites that currently access .message | Just the 3–4 sites that do error.message today. Smallest diff. | |

**User's choice:** Every catch block + small helper.
**Notes:** Captured in CONTEXT.md D-08..D-11. Helper named `errorMessage` (not `formatError` / `getErrorMessage`) for natural call-site reading.

---

## BUG-06 race fix approach

| Option | Description | Selected |
|--------|-------------|----------|
| Share in-flight Promise (Recommended) | Store a `private fetchInFlight: Promise<CalendarEvent[]> \| null`. Concurrent callers await the same promise and get the same result. Cleared in a finally. Cleanest pattern, naturally idempotent. | ✓ |
| Guard scheduleBackgroundRefresh only | In scheduleBackgroundRefresh, skip if `isFetchingCalendars=true`. Minimal diff, but force-refresh during a fetch still early-returns silently — doesn't fix all races, just the documented one. | |
| Queue 'refresh requested' flag | Set a flag; after the current fetch finishes, run one more if requested. Most aggressive: never drops a refresh. More state, two-cycle latency for force-refresh. | |
| Cancel pending timer at fetch start | When performFetch starts, cancel the scheduled background-refresh timer if any. Prevents the specific double-fire described in CONCERNS but doesn't help other concurrent callers. | |

**User's choice:** Share in-flight Promise.
**Notes:** Captured in CONTEXT.md D-12..D-14. The `isFetchingCalendars` boolean field is removed; the Promise being non-null IS the in-flight signal. Force-refresh-during-fetch UX is explicitly out of scope (D-14).

---

## Continue or write?

| Option | Description | Selected |
|--------|-------------|----------|
| Write CONTEXT.md now (Recommended) | Four decisions captured; BUG-05 and commit granularity left to planner/researcher discretion. Move on. | ✓ |
| Add a topic | Something I haven't surfaced — e.g., where the validation utility lives, mobile concerns, etc. | |

**User's choice:** Write CONTEXT.md.

---

## Claude's Discretion

- **BUG-05** — REQUIREMENTS.md says `getStartOfWeek` is "currently broken" but CONCERNS.md traces the formula and concludes it is correct-but-non-obvious. Researcher reconciles via a 49-cell trace table (firstDayOfWeek 0..6 × getDay() 0..6) and either fixes the broken cell(s) or closes BUG-05 as verified.
- **Commit granularity** — per-requirement atomic commits is the GSD default. SEC-01 may split into "regex + load-time validation" + "render-time createElementNS" if the diff is large. Planner's call.
- **Validation utility filename** — `src/utils/colorValidation.ts` vs co-located in another util file. Naming consistency suggests `colorValidation.ts` for the regex and `errors.ts` for the helper, but planner has discretion.
- **Color regex shape** — single union regex vs discriminated set of small per-format regexes. Planner's call.

## Deferred Ideas

- **FRAG-04** (static help-text `innerHTML` at lines 1817, 1834, 1855–57) — out of scope per REQUIREMENTS, deferred to fragility milestone.
- **FRAG-03** (`hasSourceMismatch` URL-canonical) — out of scope, fragility milestone.
- **PERF-02** (cache enabled-source Set) — out of scope.
- **Force-refresh-during-fetch UX** — shared-Promise pattern means a force-refresh during a non-force fetch returns the in-flight result. Becomes a follow-up only if real users notice.
- **Error-cause unwrapping** — `Error.cause` chain not unwrapped by the helper today; single-file change if needed later.
- **Color-format migration** — collapsing stored colors to hex on load was rejected (loses CSS-var theme-following). Recorded for future re-evaluation.
