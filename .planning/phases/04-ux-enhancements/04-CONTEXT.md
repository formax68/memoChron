# Phase 4: UX Enhancements - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Six user-visible UX enhancements stacked on the Phases 1–3 foundation. No new capabilities outside what ROADMAP success criteria #1–6 already promise. Each enhancement is small and self-contained; ENH-02 + ENH-03 are conjoined via a shared `RenderOptions` extension (per STATE.md "Recent decisions"), and ENH-06 is the highest-risk item (per STATE.md "Blockers/Concerns").

- **ENH-01** — Calendar grid shows a persistent today indicator that stays visible even when today is also the selected day.
- **ENH-02** — Agenda event rows show a lucide icon distinguishing events that already have a note from events that don't.
- **ENH-03** — Optional, toggleable calendar-grid marker (off by default) on days that contain at least one event with a note.
- **ENH-04** — Note-title date format includes a `DD-MM-YYYY` option labelled for NL/EU users (already supported as the `"UK"` formatter — planner's call: relabel or add an alias entry).
- **ENH-05** — Note templates support `{{day}}` and `{{month}}` template variables that emit fully written English weekday/month names (`Monday`, `January`).
- **ENH-06** — Note templates support a `{{cursor}}` marker that places the editor cursor at that position after a newly-created event note opens; the marker text never appears in the saved note.

Goal at end of phase: a user sees today clearly even on the selected day, can tell at a glance which events already have notes (and optionally which days), can choose a `DD-MM-YYYY` date format, can use `{{day}}`/`{{month}}` and `{{cursor}}` in templates, and all of this works on top of the stable date-parsing and live-settings foundation laid by Phases 1–3.

</domain>

<decisions>
## Implementation Decisions

### ENH-01 — Today indicator (Area 1)

- **D-01:** Today's cell gains an **inset accent ring** via `box-shadow: inset 0 0 0 2px var(--interactive-accent)` on `.memochron-day.today`. Independent of the cell's `background-color`, so it stays visible inside the selected (accent-filled) cell — both states show simultaneously per ROADMAP success criterion #1.
- **D-02:** The CSS rule lives on `.memochron-day.today` in `styles.css`. Because `createDayElement` in `src/utils/viewRenderers.ts:236–253` adds the `.today` class for both the sidebar and embedded views, the ring flows through to both surfaces with zero per-surface code.
- **D-03:** Ring color is **hard-coded to `var(--interactive-accent)`** — matches the existing `.today .memochron-day-header` and `.selected` background, both of which already use the accent. No new color setting; no migration; theme-follows. The existing `.today .memochron-day-header { color: var(--interactive-accent); font-weight: 700 }` rule (`styles.css:161–164`) stays as the secondary cue when today is **not** selected.

### ENH-02 + ENH-03 — Note-exists indicators (Area 2)

- **D-04:** **Agenda icon (ENH-02) is always-on**, not toggleable. Matches ROADMAP success criterion #2's unconditional wording ("events that already have an associated note show a file-check icon; events without a note show a file-plus icon"). Rendered via Obsidian's `setIcon` API — `setIcon(el, "file-check")` for has-note, `setIcon(el, "file-plus")` for no-note — at the **trailing end** of each `.memochron-agenda-event` row, after time → title → location. Both render sites get the icon: `src/utils/viewRenderers.ts` `renderEventItem` (~line 162) and `src/views/CalendarView.ts` sidebar event renderer (~line 828). `setIcon` is already imported in `CalendarView.ts:1`.
- **D-05:** **Grid dot (ENH-03) is toggleable**, off by default. New boolean setting on `MemoChronSettings` (e.g., `showNoteIndicatorOnGrid: false`). Visual: a small **accent-colored filled square** in a corner of the day cell — distinct shape from the existing round event-color dots in `.memochron-event-dots-container` so the two layers don't visually merge. Position: top-right or bottom-right of the cell (planner's call; whichever sits clear of the day-header number and the centered event-dots row).
- **D-06:** **`hasNote(event)` lookup happens in the render path.** Extend `RenderOptions` (`src/utils/viewRenderers.ts:6–12`) with either an optional `hasNote?: (event: CalendarEvent) => boolean` callback OR a precomputed `Map<string, boolean>` keyed by event identity (planner's call — callback is simpler if a single identity is hard to define). The lookup itself wraps `this.plugin.noteService.getExistingEventNote(event)` — already cheap and synchronous (`vault.getAbstractFileByPath`). The grid-dot rule additionally requires "any event on this day has a note" — the planner aggregates per-day.
- **D-07:** **Refresh model:** re-render after `createEventNote` returns. `CalendarView.showEventDetails` (`src/views/CalendarView.ts:915–940`) already orchestrates create-or-open + `leaf.openFile`; after a successful create-new, trigger a re-render of the current calendar grid and day agenda so the just-added note flips its icon and the day's grid dot appears. No `vault.on("create"|"delete")` listener — cross-vault thrash isn't worth catching external note creates this phase.

### ENH-04 — DD-MM-YYYY label (Area 4 — already-decided, planner's call)

- **D-08:** The `DD-MM-YYYY` format is **already supported** as the existing `"UK"` formatter in `NoteService.formatDate` (`src/services/NoteService.ts:340–347`), which calls `toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })` and routes through `toFilenameSafeDate` to replace `/` with `-`. Implementation is a **label change** in the two dropdown sites at `src/settings/SettingsTab.ts:938–941` and `:1585–1588` — relabel the "UK" entry to something like `"UK/EU (DD-MM-YYYY)"` OR add a new dropdown entry with `value: "UK"` (same persisted value) and a separate `"NL"`-style label. Planner picks. **Persisted `"UK"` value MUST remain valid** for existing users — no migration, no breaking change.

### ENH-05 — `{{day}}` / `{{month}}` template variables (Area 3)

- **D-09:** **Locale is hard-coded English (`"en-US"`)** for both variables — matches ROADMAP success criterion #5's explicit phrasing ("the correct English weekday/month name"). NOTE-01 (locale customization) is explicitly Out of Scope (REQUIREMENTS.md v2). Implementation: `toLocaleDateString("en-US", { weekday: "long" })` for `{{day}}` and `toLocaleDateString("en-US", { month: "long" })` for `{{month}}`. No new setting; no environment-dependent output.
- **D-10:** **Both body and title are in scope.** Add `day` and `month` fields to the `EventTemplateVariables` interface (`src/services/NoteService.ts:7–27`) and populate them in `getEventTemplateVariables` (line 218). Because `applyTemplateVariables` iterates the variables map for both `generateNoteContent` (body, line 162) and `formatTitle` (line 274–280) — both paths automatically pick up the new fields. The values `"Monday"`/`"January"` are filename-safe; no extra sanitization beyond what `toFilenameSafeDate` (line 361) already does.
- **D-11:** **Source date = `event.start`** for both variables. Consistent with `{{date}}`, `{{start_date}}`, `{{start_time}}` which all derive from `event.start` (lines 221–224). No short-form variants this phase (`{{day_short}}`/`{{month_short}}` would be scope creep — success criterion only names "Monday" and "January"). `FolderTemplateVariables` already exposes `DDD`/`DDDD`/`MMM`/`MMMM` (`src/services/NoteService.ts:29–44`) for folder-path templating if anyone needs short forms there; that's separate.

### ENH-06 — `{{cursor}}` marker (Area 4)

- **D-12:** **Strip the marker before write.** In `NoteService.generateNoteContent` (or a sibling helper called by it) — after template substitution but before `vault.create` — locate the `{{cursor}}` marker in the body, **record its `(line, ch)` position**, and **remove every occurrence** from the content that will be written. The saved file therefore contains zero marker text even if the cursor-placement step that follows fails — ROADMAP success criterion #6 ("the marker text itself does not appear in the saved note") is satisfied unconditionally.
- **D-13:** **First marker after the frontmatter closing delimiter wins.** Find the closing `---` line that ends the frontmatter block; search the body content **after that line** for the first `{{cursor}}` — that position is the cursor target. Strip **all** `{{cursor}}` occurrences from the saved content, including any inside the frontmatter (REQUIREMENTS Out of Scope: "Honoring `{{cursor}}` inside YAML frontmatter — Anti-feature flagged in research — would corrupt frontmatter"). If no marker exists after the frontmatter, **skip `setCursor` entirely** — let the editor open with its default cursor position (top of file); do **not** auto-position to end of file (matches the spirit of the related Out of Scope item "Auto-opening newly created event notes when not requested").
- **D-14:** **Cursor placement runs only for newly-created notes.** `CalendarView.showEventDetails` (`src/views/CalendarView.ts:915–940`) already branches on `isNewNote = !file` at line 922 — the `setCursor` step only runs in the new-note branch. Rationale: the saved file has no marker after D-12, so an existing-note re-open has nothing to honor; and if a user later types the literal string `{{cursor}}` into a saved note, we must **not** treat it as a live editor instruction (that would corrupt their content). Cleanest contract: marker is a *creation-time* directive, not a *file-content* directive.
- **D-15:** **Tick mechanism:** after `await leaf.openFile(file)`, do **one `requestAnimationFrame` yield**, then read the active editor via `const view = this.app.workspace.getActiveViewOfType(MarkdownView); if (view?.editor) view.editor.setCursor(pos); view?.editor?.focus();`. This is the established community-plugin pattern for "place cursor in a just-opened note." It avoids the `onLayoutReady` heavy-weight (vault-startup-only) and the brittle polling loop that PERF-04 explicitly defers. If `view?.editor` is undefined on first read, **abort silently** — no retry; the user can click into the note. `MarkdownView` and `setIcon` join the imports at `CalendarView.ts:1`.

### Claude's Discretion

- **CSS ring details (ENH-01):** ring thickness (2px is the recommendation; 1px or 3px also acceptable based on visual review) and whether to also slightly tweak the existing `.today .memochron-day-header` weight when the cell is *not* selected — planner's call.
- **Grid-dot exact corner / size (ENH-03):** top-right vs bottom-right vs top-left; pixel size relative to event-dots — planner picks whichever reads best alongside existing markup.
- **`RenderOptions` shape (ENH-02 + ENH-03):** callback vs precomputed map — planner picks based on event-identity availability. If using a callback, both grid and agenda paths receive the same callback and call it as needed.
- **ENH-04 label form:** relabel "UK" entry OR add a "NL/EU" entry with `value: "UK"` (or `value: "EU"` mapping to the same formatter). Persisted `"UK"` value MUST remain valid. Planner's call.
- **Helper extraction for `{{cursor}}` parsing:** whether the marker location + strip is a private method on `NoteService` or a sibling pure helper in `src/utils/` — planner's call.
- **Commit granularity:** per-requirement atomic commits is the GSD default; ENH-02 + ENH-03 may travel in one commit given the shared `RenderOptions` change; ENH-06 should be its own atomic commit due to risk profile.
- **Verification approach:** code review + HUMAN-UAT (per-milestone default; no test suite in scope this milestone).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project artifacts
- `.planning/ROADMAP.md` — Phase 4 entry; 6 success criteria mapping 1:1 to ENH-01..ENH-06
- `.planning/REQUIREMENTS.md` — ENH-01..ENH-06 acceptance language; Out of Scope list (NOTE-01 locale customization, QA-01 test suite, QA-02 accessibility, "Auto-opening newly created event notes when not requested", "Honoring `{{cursor}}` inside YAML frontmatter")
- `.planning/PROJECT.md` — milestone framing; "Recent decisions" notes ENH-02 + ENH-03 travel together (shared `RenderOptions` extension); ENH-06 is highest-risk (`setCursor` timing)
- `.planning/STATE.md` — Blockers/Concerns flags: "Phase 4 (ENH-06): Confirm exact tick mechanism for `setCursor` timing at implementation time (`requestAnimationFrame` vs `app.workspace.onLayoutReady`) — do not bake in an assumption"

### Codebase intel
- `.planning/codebase/ARCHITECTURE.md` — service composition; `MemoChron.noteService` access path; `RenderOptions` is the seam between sidebar and embedded views
- `.planning/codebase/CONVENTIONS.md` — naming (`is`/`has`/`should` boolean methods, kebab-case command IDs), error-handling pattern (`errorMessage()` from Phase 2), `setIcon` + lucide naming conventions
- `.planning/codebase/STRUCTURE.md` — where to add new code (new settings field → `src/settings/types.ts` + `DEFAULT_SETTINGS` + `SettingsTab.ts`; new template variable → `EventTemplateVariables` + `getEventTemplateVariables`)
- `.planning/codebase/CONCERNS.md` — Performance / fragility context only; nothing in this phase touches a flagged hot path

### Prior phase context (decisions carried forward)
- `.planning/phases/01-foundation/01-CONTEXT.md` — live-settings pattern: services hold `plugin: MemoChron` reference and read `this.plugin.settings` via getter (D-01..D-04). New ENH-03 setting reads live with zero call-site churn.
- `.planning/phases/02-security-correctness/02-CONTEXT.md` — `errorMessage()` helper at `src/utils/errors.ts` (D-09) used in every catch block; `isValidColor` / color-validation discipline at `src/utils/colorValidation.ts` (D-02) — ENH-01 does NOT introduce new color settings, but any future additions must pass through this validator.
- `.planning/phases/03-date-parsing-navigation-bugs/03-CONTEXT.md` — numeric local-day `Date` constructor is the established idiom (D-01, D-02); `maybeBackgroundRefresh` decoupled-fetch pattern (D-04, D-05) means re-renders after note creation (ENH-02/03 D-07) are cheap and don't await network.

### Project rules
- `CLAUDE.md` — Obsidian plugin best practices (use `setIcon` with lucide names; CSS variables for theme support; mobile compatibility `isDesktopOnly: false`); commit message hygiene (NO Claude / AI references in commits or release notes); MemoChron-specific terminology (Calendar View = month grid; Agenda View = scrollable list below)

### Source files this phase will touch

**ENH-01 (today indicator):**
- `styles.css` — add `.memochron-day.today { box-shadow: inset 0 0 0 2px var(--interactive-accent); }` rule (or similar) alongside lines 146–164. No other CSS changes.

**ENH-02 + ENH-03 (note-exists indicators):**
- `src/settings/types.ts` — add `showNoteIndicatorOnGrid: boolean` to `MemoChronSettings` (default `false` in `DEFAULT_SETTINGS`). No `CalendarNotesSettings` override (this is a global UI preference, not per-calendar).
- `src/utils/viewRenderers.ts` — extend `RenderOptions` (line 6) with `hasNote?: (event: CalendarEvent) => boolean` (or precomputed map). Update `renderEventItem` (~line 162) to render the trailing lucide icon. Update `renderCalendarGrid` / `addEventIndicators` (~lines 14, 281) to render the corner-square grid dot when `showNoteIndicatorOnGrid && some(events, e => hasNote(e))` for that day.
- `src/views/CalendarView.ts` — pass the new `hasNote` callback when calling shared renderers; mirror the trailing-icon and corner-square rendering in the sidebar's own `renderEventItem`-equivalent (~line 828) and `renderDay`/`createDayElement` (~lines 596, 613). Trigger a `renderCalendar()` + `showDayAgenda()` after `createEventNote` returns in `showEventDetails` (line 915–940).
- `src/views/EmbeddedCalendarView.ts` / `src/views/EmbeddedAgendaView.ts` — pass the new `RenderOptions.hasNote` callback if embedded views should also show the markers (they should, per ENH-01 D-02 precedent of cross-surface consistency).
- `src/settings/SettingsTab.ts` — add the toggle UI for `showNoteIndicatorOnGrid` under the calendar-display section.
- `styles.css` — add corner-square selector + sizing rules; agenda-event icon spacing.

**ENH-04 (DD-MM-YYYY label):**
- `src/settings/SettingsTab.ts:938–941` and `:1585–1588` — relabel the existing `"UK"` dropdown entry to `"UK/EU (DD-MM-YYYY)"` OR add an alias entry; preserve `value: "UK"` for the persisted setting (no migration).

**ENH-05 (`{{day}}` / `{{month}}`):**
- `src/services/NoteService.ts:7–27` — add `day: string` and `month: string` fields to `EventTemplateVariables`.
- `src/services/NoteService.ts:218` `getEventTemplateVariables` — populate the new fields via `event.start.toLocaleDateString("en-US", { weekday: "long" })` and `{ month: "long" }`.
- Settings docs / help text in `SettingsTab.ts` — list the new variables alongside the existing ones (planner picks the exact help-text site).

**ENH-06 (`{{cursor}}`):**
- `src/services/NoteService.ts` — extend `generateNoteContent` (line 155) or extract a helper that takes the post-substitution content and returns `{ content: string, cursor: { line: number, ch: number } | null }`. Strip every `{{cursor}}` occurrence; locate the first one after the frontmatter closing `---`.
- `src/views/CalendarView.ts:915–940` `showEventDetails` — in the new-note branch (after `createEventNote` returns and before/after `leaf.openFile`), retrieve the cursor position from `NoteService` (either via a side-channel field on the returned `TFile` wrapper OR a new return-shape on `createEventNote`), then `requestAnimationFrame` → `getActiveViewOfType(MarkdownView)` → `editor.setCursor(...) + editor.focus()`. Import `MarkdownView` from `"obsidian"` at line 1.
- Settings help text in `SettingsTab.ts` — document the `{{cursor}}` marker behavior (creation-time directive; not honored inside frontmatter; only one marker takes effect).

### Source files unchanged (verified by analysis)

- `src/services/CalendarService.ts` — calendar fetch/parse path untouched; the `RenderOptions` extension is rendering-only.
- `src/utils/timezoneUtils.ts`, `src/utils/pathUtils.ts`, `src/utils/errors.ts`, `src/utils/colorValidation.ts` — unchanged; reused as-is.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`NoteService.getExistingEventNote(event)`** (`src/services/NoteService.ts:81–88`) — synchronous vault lookup that already returns `TFile | null`. This is the `hasNote` primitive for ENH-02 + ENH-03; no new method needed on the service.
- **`setIcon` from obsidian** — already imported at `src/views/CalendarView.ts:1`. Used elsewhere in the view (lines 235, 291). Lucide icon names `"file-check"` and `"file-plus"` are explicitly named by ROADMAP success criterion #2.
- **`createDayElement` in `src/utils/viewRenderers.ts:236–253`** — single seam where `.today` class is added. ENH-01's CSS rule applies cleanly without touching this function.
- **`EventTemplateVariables` interface + `getEventTemplateVariables` method** (`src/services/NoteService.ts:7–27, 218`) — single point to add `day`/`month`; consumed automatically by `applyTemplateVariables`, `generateNoteContent`, and `formatTitle`.
- **`isNewNote` branch in `showEventDetails`** (`src/views/CalendarView.ts:922`) — already discriminates new-create from existing-open; the gate for ENH-06's `setCursor` logic.
- **`toFilenameSafeDate` helper** (`src/services/NoteService.ts:361–363`) — handles `/`-to-`-` rewrite for date formats. Already covers ENH-04; no change needed in the formatter logic.
- **`renderEventItem` in shared renderers** (`src/utils/viewRenderers.ts:162–216`) — the agenda event row builder used by embedded views; the trailing-icon append fits naturally after the location line.

### Established Patterns

- **Live-settings reads** (Phase 1 D-03) — `this.plugin.settings.showNoteIndicatorOnGrid` is read fresh on every render; no caching, no constructor copy. Adding a new setting field is a zero-side-effect change to the read path.
- **`RenderOptions` flow-through** — `enableColors`, `firstDayOfWeek`, `timeFormat`, `showDailyNote`, `dailyNoteColor` already flow from settings → `CalendarView` → `renderCalendarGrid`/`renderAgendaList`. New `hasNote` callback (and indirectly `showNoteIndicatorOnGrid`) follow the same path.
- **CSS-var theming** — both `.today` and `.selected` colors already reference `var(--interactive-accent)` and `var(--text-on-accent)` (`styles.css:11, 146–164`). ENH-01's inset ring extends this convention.
- **Per-surface duplication is real** — `CalendarView` has its own `renderDay` (line 596) and its own per-event renderer (line ~828) that mirror the shared `viewRenderers.ts` functions. Both surfaces need touching for ENH-02 + ENH-03. Worth a focused diff review during planning.

### Integration Points

- **`CalendarView.showEventDetails`** (`src/views/CalendarView.ts:915–940`) — orchestrates create-or-open + `leaf.openFile`. The site where: (a) post-create re-render fires (D-07), and (b) post-open `setCursor` runs (D-15).
- **`SettingsTab.display()`** — site for the new `showNoteIndicatorOnGrid` toggle (D-05) and the ENH-04 dropdown relabel (D-08). Both edits are additive; no existing UI sections move.
- **`RenderOptions`** (`src/utils/viewRenderers.ts:6–12`) — the bridge between sidebar / embedded / future surfaces. All ENH-02 + ENH-03 cross-surface behavior flows through here.

</code_context>

<specifics>
## Specific Ideas

- ENH-01 is **CSS-only**. No TypeScript change is required — `createDayElement` already adds the `.today` class on both surfaces. The diff should be ~3 lines in `styles.css`.
- ENH-04 is **label-only**. The format already works; the dropdown text is the only thing changing. Planner should verify by exercising the existing "UK" entry: `toLocaleDateString("en-GB", {...}).replace(/\//g, "-")` produces `15-01-2026` for a 15 January 2026 date — that's the success criterion #4 acceptance.
- ENH-05 uses the **same `toLocaleDateString` API** the existing date/time formatters use — researcher should not invent a new abstraction (e.g., a custom day-name lookup table). `"en-US"` is the only locale used for `{{day}}`/`{{month}}` this phase.
- ENH-06's hardest sub-decision is **what "marker location" means** when it's inside a multi-line block. The strip is a `String.prototype.replaceAll('{{cursor}}', '')` on the body; the position is `(line, ch)` of the FIRST occurrence's start in the post-frontmatter content. The substring index→`(line, ch)` conversion is a small helper — planner extracts as needed.
- For ENH-06, the cursor side-channel from `NoteService.createEventNote` → `CalendarView.showEventDetails` is a real planning question — either return a `{ file: TFile, cursor: { line, ch } | null }` shape, OR expose a `getPendingCursor()` getter, OR pass a callback into `createEventNote`. Planner picks. The Test of the approach: does it survive a future "two creates fired in quick succession" race? A return value is the safest answer.
- HUMAN-UAT entries are the verification artifact (consistent with Phases 1, 2, 3 — see `01-HUMAN-UAT.md`, `02-HUMAN-UAT.md`, `03-HUMAN-UAT.md`). Each ENH gets a small entry walking the user through the visible behavior.

</specifics>

<deferred>
## Deferred Ideas

- **`{{day_short}}` / `{{month_short}}` variants** (e.g., `Mon`, `Jan`) — not user-requested; success criterion #5 only names full forms. Add later if users ask. `FolderTemplateVariables` already has `DDD`/`MMM` for folder paths if needed.
- **Locale customization for template variables** — NOTE-01 (i18n) is REQUIREMENTS.md Out of Scope (its own future milestone). Hard-coded English now is the intentional stop-gap.
- **`{{cursor}}` as a live, file-content directive** (i.e., honor the marker when an existing note is re-opened) — explicitly rejected (D-14) to avoid corrupting user-typed content.
- **Per-calendar override for `showNoteIndicatorOnGrid`** — the grid is a global view across all calendars; per-source override doesn't apply cleanly. Skipped.
- **`vault.on("create" | "delete")` listener for note-state sync** — out of scope (D-07). Catches external file moves but adds always-on cross-vault chatter. Re-render-after-create is enough for the in-plugin flow.
- **PERF-04** — replacing magic 50ms / 100ms `setTimeout` calls with `requestAnimationFrame` / `requestIdleCallback`. The ENH-06 `requestAnimationFrame` use is a one-off, not a sweep. The broader sweep stays in v2 perf milestone.
- **A "Today indicator color" setting** — explicitly rejected (D-03). If users ever request a non-accent today ring, revisit.
- **An always-on grid dot for events-with-notes (no toggle)** — REQUIREMENTS ENH-03 mandates "off by default" and "optional, toggleable." Honored as-is.

</deferred>

---

*Phase: 04-ux-enhancements*
*Context gathered: 2026-05-12*
