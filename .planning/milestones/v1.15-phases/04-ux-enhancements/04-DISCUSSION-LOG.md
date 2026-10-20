# Phase 4: UX Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 04-ux-enhancements
**Areas discussed:** Today indicator visual (ENH-01), Note-exists indicator design (ENH-02 + ENH-03), {{day}}/{{month}} locale + scope (ENH-05), {{cursor}} timing and edge cases (ENH-06)

---

## Today indicator visual (ENH-01)

### Q1: Visual treatment that stays visible when today is also selected

| Option | Description | Selected |
|--------|-------------|----------|
| Inset ring around the cell | `box-shadow: inset 0 0 0 2px var(--interactive-accent)`. Independent of background; today ring stays visible inside selected (accent-filled) cell. Widely used pattern. | ✓ |
| Underline on the day number | text-decoration: underline + decoration color = accent. Smaller visual footprint; relies on text-on-accent being visible against accent bg. | |
| Dot/badge in corner of cell | Small accent-colored dot in corner. Strong signal, but risks visual collision with existing event-dots-container. | |

**User's choice:** Inset ring around the cell.

### Q2: Sidebar only, or also embedded views?

| Option | Description | Selected |
|--------|-------------|----------|
| Both sidebar and embedded | CSS rule on `.memochron-day.today` flows through automatically — `createDayElement` in viewRenderers.ts is the shared site. | ✓ |
| Sidebar only | Requires gating the class or CSS by a parent `.memochron-embedded` selector. More code, narrower change. | |

**User's choice:** Both sidebar and embedded.

### Q3: Hard-coded color or new setting?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-coded `var(--interactive-accent)` | Matches existing today/selected colors. No new setting; theme-follows; consistent. | ✓ |
| Add a 'Today indicator color' setting | New color field on MemoChronSettings; must pass colorValidation.ts. No active user request for it. | |

**User's choice:** Hard-coded `var(--interactive-accent)`.

---

## Note-exists indicator design (ENH-02 + ENH-03)

### Q1: Agenda icon rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Lucide trailing icon (`file-check` / `file-plus`) | Matches ROADMAP success criterion #2 verbatim. setIcon already imported in CalendarView.ts. Trailing position keeps time→title→location flow undisturbed. | ✓ |
| Leading lucide icon | Same icons, placed before time column. More noticeable but pushes time/title right; risks visual clutter. | |
| CSS-only state class | Toggle a `.has-note` class; style via CSS (e.g., border-left color). Less explicit than icons; doesn't match success criterion's icon naming. | |

**User's choice:** Lucide trailing icon.

### Q2: Grid dot visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct shape: small filled square in a corner | Differentiates from existing round event-color dots. Accent-colored, in a corner. Doesn't collide with event-dots-container. | ✓ |
| Extra ring/outline on existing event dot | Subtle, reuses markup. Ring fights small dot size; hard to see on theme-colored dots. | |
| Tiny lucide note-icon overlay in corner | Strongest signal but heavier visually. | |

**User's choice:** Distinct shape — small filled square in a corner.

### Q3: Lookup location and refresh model

| Option | Description | Selected |
|--------|-------------|----------|
| Lookup in render path; refresh by re-rendering after note creation | RenderOptions gains `hasNote(event)=>boolean` callback. showEventDetails triggers renderCalendar() + showDayAgenda() after createEventNote returns. Cheap synchronous lookups. | ✓ |
| Watch vault create/delete events globally | Register `vault.on('create')`/`vault.on('delete')` and trigger re-render. Catches external moves but adds always-on listener and cross-vault thrash. | |
| Cache note-exists state on CalendarEvent | Mutate CalendarEvent to carry `hasNote: boolean`. Bigger change to service-owned type; cache-invalidation complexity. | |

**User's choice:** Lookup in render path; refresh by re-rendering after note creation.

### Q4: ENH-02 agenda icon — toggleable or always-on?

| Option | Description | Selected |
|--------|-------------|----------|
| Always-on | ROADMAP success criterion #2 phrases it unconditionally. ENH-03 is the criterion-mandated optional grid layer. | ✓ |
| Toggleable, on by default | Second setting. Minimal user value since icons are small and informative. | |
| Toggleable, off by default | Contradicts success criterion #2's unconditional wording. | |

**User's choice:** Always-on.

---

## {{day}}/{{month}} locale + scope (ENH-05)

### Q1: Locale source

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-coded English (en-US) | `toLocaleDateString('en-US', {weekday/month: 'long'})`. Matches ROADMAP's "correct English weekday/month name" phrasing. NOTE-01 (i18n) Out of Scope. | ✓ |
| System default (Intl) | `toLocaleDateString(undefined, {...})`. Quietly extends scope; French users get 'lundi'/'janvier' filenames. | |
| Setting on MemoChronSettings | `noteTemplateLocale: 'en-US'` default, user can override. Feels like a hidden i18n bootstrap — conflicts with NOTE-01 Out of Scope. | |

**User's choice:** Hard-coded English (en-US).

### Q2: Scope — body only, or also title?

| Option | Description | Selected |
|--------|-------------|----------|
| Both body and title | Add 'day' and 'month' to EventTemplateVariables; both applyTemplateVariables paths (body via generateNoteContent, title via formatTitle) pick them up. 'Monday'/'January' filename-safe. | ✓ |
| Body template only | Skip in formatTitle. Avoids small risk of accented characters in filenames but breaks the principle that template variables work everywhere. | |

**User's choice:** Both body and title.

### Q3: Source date and short variants?

| Option | Description | Selected |
|--------|-------------|----------|
| Event start date only; no short variants | Match existing convention ({{date}}, {{start_date}} use event.start). Short variants scope creep. FolderTemplateVariables has DDD/MMM for folder paths if needed. | ✓ |
| Event start + add {{day_short}}/{{month_short}} | Adds 'Mon'/'Jan'. Mirrors folder template's DDD/MMM. Not requested. | |

**User's choice:** Event start date only; no short variants.

---

## {{cursor}} timing and edge cases (ENH-06)

### Q1: Tick mechanism for setCursor after openFile

| Option | Description | Selected |
|--------|-------------|----------|
| Read mounted MarkdownView via `workspace.getActiveViewOfType` after a `requestAnimationFrame` yield | Established community-plugin pattern. Single rAF wrap handles late mount; `view?.editor?.setCursor + .focus()`. | ✓ |
| `app.workspace.onLayoutReady` (one-shot) | Heavier — meant for plugin-startup, not per-open. | |
| Polling/retry loop until editor available | Brittle, magic-number-prone. Matches the kind of pattern PERF-04 explicitly defers. | |

**User's choice:** `getActiveViewOfType` after a microtask (`requestAnimationFrame`).

### Q2: Strip the marker before write, or after open?

| Option | Description | Selected |
|--------|-------------|----------|
| Strip before write in NoteService | applyTemplateVariables (or sibling) removes marker AND records (line, ch) before vault.create. Saved file never contains the marker — success criterion #6 satisfied unconditionally. | ✓ |
| Write with marker, edit on open | If open or cursor step fails, marker stays in saved file forever. | |

**User's choice:** Strip before write in NoteService.

### Q3: Edge cases — multiple markers, frontmatter markers, no marker

| Option | Description | Selected |
|--------|-------------|----------|
| First-marker-after-frontmatter wins; strip all others; no marker = no setCursor | Locate closing `---`; find FIRST {{cursor}} after that point. Strip ALL occurrences (including any inside frontmatter per Out of Scope rule). If no marker post-frontmatter, skip setCursor. | ✓ |
| All markers → first one wins; cursor at end if no marker | Treats any-position marker as valid; auto-positions cursor at end if absent — anti-feature spirit. | |
| Error if marker is in frontmatter | Show Notice and skip cursor placement. Creates an obstacle for stray frontmatter strings. | |

**User's choice:** First-marker-after-frontmatter wins; strip all others; no marker = no setCursor.

### Q4: Fire on new notes only, or also re-opens?

| Option | Description | Selected |
|--------|-------------|----------|
| Only on new note creation | Marker is stripped at create — saved file has no marker. On re-open there's nothing to honor. showEventDetails already has isNewNote branch (line 922). Avoids corrupting user-typed content if they type the literal `{{cursor}}` string. | ✓ |
| Run on every open if marker found | Treats marker as live editor instruction even in user-edited files. Risks corruption. | |

**User's choice:** Only on new note creation.

---

## Claude's Discretion

- CSS ring thickness for ENH-01 (recommended 2px; 1px or 3px also acceptable)
- Grid-dot exact corner / size for ENH-03
- `RenderOptions.hasNote` shape — callback vs precomputed map
- ENH-04 label form — relabel existing "UK" entry vs add an alias entry mapping to the same formatter; persisted `"UK"` value must remain valid
- Helper extraction for {{cursor}} parsing — private method on NoteService vs sibling pure helper in `src/utils/`
- Commit granularity — per-requirement default; ENH-02 + ENH-03 may share a commit (shared RenderOptions change); ENH-06 should be its own atomic commit due to risk profile
- Side-channel mechanism for passing the recorded cursor position from `NoteService.createEventNote` to `CalendarView.showEventDetails` — return-value shape, getter, or callback

## Deferred Ideas

- `{{day_short}}` / `{{month_short}}` variants (e.g., `Mon`, `Jan`) — not user-requested
- Locale customization for template variables — NOTE-01 (i18n) future milestone
- `{{cursor}}` as a live, file-content directive — explicitly rejected (corruption risk)
- Per-calendar override for `showNoteIndicatorOnGrid` — grid is a global view
- `vault.on("create" | "delete")` listener for note-state sync — adds always-on cross-vault chatter
- PERF-04 broader sweep of magic-number timeouts — separate perf milestone
- A "Today indicator color" setting — explicitly rejected (hard-coded accent suffices)
- Always-on grid dot for events-with-notes (no toggle) — REQUIREMENTS mandates toggleable, off by default
