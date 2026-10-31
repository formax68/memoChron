# Phase 7: Lifecycle & Compatibility - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 7 modified source files + 2 new markdown files in `.planning/phases/07-lifecycle-compatibility/`
**Analogs found:** 6 strong / 2 net-new patterns (flagged below)

## Phase Character

Phase 7 is a **lint-driven refactor**. There are NO net-new source files. The only files Phase 7 creates are:

1. `.planning/phases/07-lifecycle-compatibility/07-HUMAN-UAT.md` (mandatory per D-12)
2. `.planning/phases/07-lifecycle-compatibility/BUG-07-CLOSURE.md` (conditional per D-12 step 3 — only if commit 1 does not close BUG-07)

The remainder of the work is in-place edits to 7 existing source files plus a single block-delete in `eslint.config.mjs`. Pattern mapping below identifies the closest in-tree analog for each kind of edit so the planner can cite concrete code.

## File Classification

| File | Role | Phase 7 Operation | Touch Type |
|------|------|-------------------|------------|
| `src/main.ts` | plugin entry | DIR-05 field delete + factory + `getCalendarView()` helper + 5 callsite refactors + remove `detachLeavesOfType` from `onunload` (A1) | refactor |
| `src/views/CalendarView.ts` | view (sidebar) | DIR-06 `getComputedStyle` ×2; DIR-06 `window.requestAnimationFrame` prefix at line 967; DIR-07 `instanceof TFile` narrowing ×2; DIR-08 floating promises | refactor |
| `src/views/EmbeddedCalendarView.ts` | view (embedded MarkdownRenderChild) | DIR-07 `instanceof TFile` narrowing ×1; DIR-08 `onload` sync-wrapper rewrite | refactor |
| `src/views/EmbeddedAgendaView.ts` | view (embedded MarkdownRenderChild) | DIR-06 `getComputedStyle` ×1; DIR-06 `window.requestAnimationFrame` prefix at line 425; DIR-07 `instanceof TFile` ×1; DIR-08 `onload` sync-wrapper rewrite | refactor |
| `src/settings/SettingsTab.ts` | settings UI | DIR-06 `getComputedStyle` ×6; DIR-06 `window.` prefix on 2 `setTimeout` sites; DIR-08 promises | refactor |
| `src/utils/viewRenderers.ts` | shared rendering util | DIR-06 `getComputedStyle` ×1 | refactor |
| `src/utils/colorValidation.ts` | color util (no plugin ref) | DIR-06 `getComputedStyle` ×1 (uses global `activeDocument` per D-04) | refactor |
| `eslint.config.mjs` | lint config | Delete Phase 7 override block (lines 66–91) | delete-block |
| `.planning/phases/07-lifecycle-compatibility/07-HUMAN-UAT.md` | UAT evidence | New file per D-12 | create |
| `.planning/phases/07-lifecycle-compatibility/BUG-07-CLOSURE.md` | bug closure doc | New file IF needed per D-12 step 3 | create-conditional |

## Pattern Assignments

### Pattern 1: `getCalendarView()` helper (DIR-05 / D-01)

**Target sites in Phase 7:** new private method on `MemoChron`, plus 5 callsites at `src/main.ts:166–190` (`refreshCalendarView`, `updateCalendarColors`, `goToToday`, `toggleCalendar`'s view-call branch, plus the `forceRefresh` command callback).

**Closest in-tree analog:** `src/main.ts:161-164` — `MemoChron.getOrCreateLeaf()`. Same shape (private, no params, narrowed return) but returns a leaf rather than a view. The planner mirrors the private-method conventions (declaration site, naming, indentation) and adds `instanceof CalendarView` narrowing.

**Excerpt — existing private helper on `MemoChron`:**
```typescript
// src/main.ts:161-164
private getOrCreateLeaf() {
  const rightLeaf = this.app.workspace.getRightLeaf(false);
  return rightLeaf || this.app.workspace.getLeaf("split", "vertical");
}
```

**What differs / what to mirror:** Mirror the `private` modifier, the location (group with other workspace helpers near `activateView`/`createCalendarView` at lines 140-164), and the implicit return type (TypeScript inference). Add an explicit `CalendarView | null` return type and `instanceof CalendarView` narrowing. The `getCalendarView()` body is:
```typescript
private getCalendarView(): CalendarView | null {
  const leaves = this.app.workspace.getLeavesOfType(MEMOCHRON_VIEW_TYPE);
  const view = leaves[0]?.view;
  return view instanceof CalendarView ? view : null;
}
```

**Callsite pattern to replace `if (this.calendarView)` blocks** (5 sites at `src/main.ts:166-190`). Current shape:
```typescript
// src/main.ts:166-170 — BEFORE
async refreshCalendarView(forceRefresh = false) {
  if (this.calendarView) {
    await this.calendarView.refreshEvents(forceRefresh);
  }
}
```
becomes:
```typescript
// AFTER (D-01 + early-return shape, no new abstraction)
async refreshCalendarView(forceRefresh = false) {
  const view = this.getCalendarView();
  if (!view) return;
  await view.refreshEvents(forceRefresh);
}
```

---

### Pattern 2: `instanceof TFile` narrowing (DIR-07 / D-08)

**Target sites in Phase 7:** `CalendarView.ts:148`, `CalendarView.ts:828`, `EmbeddedCalendarView.ts:234`, `EmbeddedAgendaView.ts:383`.

**Closest in-tree analog:** `src/services/NoteService.ts:72-76` — `existingFile instanceof TFile` guard guarding a `TFile`-typed return path. Same shape (lookup → narrow → use). Note: CONTEXT.md `<code_context>` references `pathUtils.ts` for this pattern, but `pathUtils.ts` does NOT contain `instanceof TFile` checks (it deals with string-path classification). The actual in-tree analogs live in `NoteService.ts` and `CalendarService.ts`.

**Excerpt — canonical narrowing pattern:**
```typescript
// src/services/NoteService.ts:69-83
try {
  await this.ensureParentFolder(filePath);

  const existingFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
  if (existingFile instanceof TFile) {
    return { file: existingFile, cursor: null };
  }

  const { content, cursor } = this.generateNoteContent(event);
  const file = await this.plugin.app.vault.create(filePath, content);
  return { file, cursor };
} catch (error) {
  console.error("Error creating note:", errorMessage(error));
  throw error;
}
```

**Second in-tree analog — negated guard with early return:**
```typescript
// src/services/CalendarService.ts:515-524
const file = this.plugin.app.vault.getAbstractFileByPath(
  pathInfo.normalizedPath
);
if (!file || !(file instanceof TFile)) {
  return {
    status: 404,
    text: `File not found: ${pathInfo.normalizedPath}`,
  };
}
content = await this.plugin.app.vault.read(file);
```

**What differs / what to mirror:** The `as TFile` casts at the 4 daily-note sites are in TWO shapes:

**Shape A — Map.set (1 site, CalendarView.ts:147-149):**
```typescript
// BEFORE
Object.entries(allDailyNotes).forEach(([dateStr, file]) => {
  this.dailyNotes.set(dateStr, file as TFile);
});

// AFTER (mirrors NoteService.ts:73 positive-guard shape)
Object.entries(allDailyNotes).forEach(([dateStr, file]) => {
  if (file instanceof TFile) {
    this.dailyNotes.set(dateStr, file);
  }
});
```

**Shape B — leaf.openFile (3 sites: CalendarView.ts:826-829, EmbeddedCalendarView.ts:232-235, EmbeddedAgendaView.ts:381-384):**
```typescript
// BEFORE
if (dailyNote) {
  const leaf = this.app.workspace.getLeaf("tab");
  await leaf.openFile(dailyNote as TFile);
}

// AFTER (mirrors NoteService.ts:73 positive-guard shape; replaces the truthy check with a typed narrow)
if (dailyNote instanceof TFile) {
  const leaf = this.app.workspace.getLeaf("tab");
  await leaf.openFile(dailyNote);
}
```

No new helper, no `assertIsFile` utility — the `if (... instanceof TFile)` guard at each site is the established pattern.

---

### Pattern 3: `activeDocument` adoption for `getComputedStyle` reads (DIR-06 / D-04 / D-05)

**Target sites in Phase 7:** 14 sites — `SettingsTab.ts:170, 612, 636, 670, 681, 705` (6 sites); `CalendarView.ts:658, 767` (2); `EmbeddedAgendaView.ts:259` (1); `viewRenderers.ts:144` (1); `colorValidation.ts:46` (1). Note: CONTEXT.md mentions "9 sites" in SettingsTab and 14 total — grep shows 6 unique `document.documentElement` reads in SettingsTab + 7 elsewhere = 13. Planner must re-grep at execution time to settle the count; current live grep result is documented above.

> **Net-new pattern flag:** There is currently NO `activeDocument` usage in the codebase. Every site is a `document.documentElement` read. The swap is a one-token edit (`document` → `activeDocument`) at each site. No prior in-tree analog to mirror; the rule auto-fix shape (verified in research § Conflict 2 / Pattern 4) IS the template.

**Excerpt — current shape (representative site):**
```typescript
// src/settings/SettingsTab.ts:168-173
if (!this.plugin.settings.dailyNoteColor) {
  this.plugin.settings.dailyNoteColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--interactive-accent")
      .trim() || "#7c3aed";
}
```

**Phase 7 target shape (one-token swap):**
```typescript
// AFTER (D-05)
if (!this.plugin.settings.dailyNoteColor) {
  this.plugin.settings.dailyNoteColor =
    getComputedStyle(activeDocument.documentElement)
      .getPropertyValue("--interactive-accent")
      .trim() || "#7c3aed";
}
```

**What differs / what to mirror:** Single identifier swap at every site. `activeDocument` is registered as a global by `obsidianmd.configs.recommended` (see `eslint.config.mjs:33-41`); no import needed. Per CONTEXT.md "Claude's Discretion" — planner decides whether the 14 reads share a tiny helper (e.g., `readAccentColor()`) or stay inline. Default is to keep inline (matches the established pattern; introducing a helper is its own refactor and unrelated to Phase 7's lint goal).

**Note for `colorValidation.ts:46`:** This file has no plugin reference and is the ONLY site that could not use a workspace-instance approach. The global `activeDocument` per D-04 is the only correct option here — confirming D-04's "globals, not workspace-instance" decision.

**Cross-reference with CalendarView.ts:1112, 1207:** These two sites use `getComputedStyle(this.calendar)` (an element reference, not `document.documentElement`). They are NOT prefer-active-doc targets and Phase 7 must leave them alone.

---

### Pattern 4: `.catch(error => new Notice(errorMessage(error)))` fire-and-forget (DIR-08 / D-09)

**Target sites in Phase 7:** Planner classifies the 10 floating-promise + 17 misused-promise sites into three buckets per D-09 (`void` / `.catch` / `await`). Default for ambiguous sites is `.catch(...)` with `errorMessage()`.

**Closest in-tree analog:** `src/views/CalendarView.ts:315-346` — `maybeBackgroundRefresh()`. This is the **canonical D-09 pattern** already in the codebase from Phase 2 BUG-02. It demonstrates both the `void` operator at the head of a Promise chain AND a `.catch` handler at the tail using `errorMessage`. The planner MUST mirror this exact shape for new `.catch` handlers.

**Excerpt — canonical fire-and-forget chain (`void` + `.catch` + `errorMessage`):**
```typescript
// src/views/CalendarView.ts:315-347
private maybeBackgroundRefresh(): void {
  // BUG-02 (D-05): fire-and-forget background fetch. fetchCalendars short-circuits
  // internally when needsRefresh() is false, and fetchInFlight (Phase 2 D-12)
  // dedups against the setupAutoRefresh interval timer. The `void` prefix marks
  // the Promise as intentionally unhandled at the call site; the .then/.catch
  // chain handles re-render and error logging.
  const targetTime = this.currentDate.getTime();
  void this.plugin.calendarService
    .fetchCalendars(this.plugin.settings.calendarUrls, false)
    .then(() => {
      if (this.currentDate.getTime() !== targetTime) return;
      this.loadDailyNotes();
      this.renderCalendar();
      const dateToShow = this.selectedDate || new Date();
      void this.showDayAgenda(dateToShow);
    })
    .catch((error) => {
      console.error("MemoChron: background refresh failed:", errorMessage(error));
    });
}
```

**What differs / what to mirror:**
- The `void` keyword at the head of the chain (line 327) — Phase 7 reuses this for bucket-1 (true fire-and-forget) sites.
- The `.catch((error) => { console.error(..., errorMessage(error)); })` shape (lines 344-346) — Phase 7 reuses for bucket-2 sites, but D-09 prefers `new Notice(errorMessage(error))` over `console.error(...)` when the failure is user-visible. The decision per site:
  - **User-initiated action with visible failure surface** (e.g., refresh button click, settings change) → `.catch((error) => new Notice(errorMessage(error)))`
  - **Background refresh / lifecycle / idempotent retry-able** → `.catch((error) => console.error(..., errorMessage(error)))` (mirrors the existing line 344-346 shape, no Notice)
- `errorMessage(error)` from `src/utils/errors.ts` is the helper to import — already imported in 18 sites including the 3 view files Phase 7 will edit (confirmed by grep).
- Inline `void this.showDayAgenda(dateToShow)` (line 342) — the pattern for unawaited Promise calls inside a callback. Phase 7's `void this.initialize()` in the embedded views' `onload` mirrors this.

---

### Pattern 5: Synchronous `onload` wrapper for `MarkdownRenderChild` (DIR-08 / D-10)

**Target sites in Phase 7:** `EmbeddedCalendarView.ts:83` and `EmbeddedAgendaView.ts:74` — both currently declare `async onload()`.

> **Net-new pattern flag:** There is NO existing `void this.helper()` synchronous-wrapper pattern in this codebase. Phase 7 introduces it. The closest precedent is the standalone `void this.showDayAgenda(...)` call inside a callback at `CalendarView.ts:342` (above), but that lives inside a callback rather than as a method body. Planner should flag this as a NEW idiom for the codebase in the plan.

**Excerpt — current `async onload()` shape (the violation):**
```typescript
// src/views/EmbeddedCalendarView.ts:83-85
async onload() {
  await this.render();
}

// src/views/EmbeddedAgendaView.ts:74-76
async onload() {
  await this.render();
}
```

**Phase 7 target shape (D-10):**
```typescript
// AFTER — applies to BOTH files
onload(): void {
  void this.initialize();
}

private async initialize(): Promise<void> {
  try {
    await this.render();
  } catch (error) {
    new Notice(errorMessage(error));
  }
}
```

**What differs / what to mirror:**
- The `onload(): void { ... }` signature satisfies `Component.onload(): void` (verified by researcher in `obsidian.d.ts:1830-1844`).
- The inner `initialize()` (name per "Claude's Discretion" — could be `loadEvents()` or `renderAsync()`) retains the async body and adds a `try/catch` with the user-visible `Notice` pattern from D-09 bucket 2.
- The `void this.initialize()` call (single statement) IS the only thing the synchronous `onload` does.
- The `render()` method bodies on lines 87+ (EmbeddedCalendarView) and 78+ (EmbeddedAgendaView) are UNCHANGED — only the `onload`/`initialize` shell is rewritten.

---

### Pattern 6: ESLint override-block deletion (DIR-08 / D-11 commit 6)

**Target site in Phase 7:** Single block delete at `eslint.config.mjs:65-91` (note: the comment header starts at line 65, the closing `},` is at line 91).

**Excerpt — exact bounds of the Phase 7 override block:**
```javascript
// eslint.config.mjs:65-91
  // ---------------------------------------------------------------------------
  // Phase 7 — DIR-05 / DIR-06 / DIR-07 / DIR-08 will remove these when the
  // lifecycle / compatibility cleanup lands.
  // ---------------------------------------------------------------------------
  {
    files: [
      "src/main.ts",
      "src/views/CalendarView.ts",
      "src/views/EmbeddedCalendarView.ts",
      "src/views/EmbeddedAgendaView.ts",
      "src/settings/SettingsTab.ts",
      "src/services/CalendarService.ts",
      "src/services/NoteService.ts",
      "src/utils/colorValidation.ts",
      "src/utils/viewRenderers.ts",
    ],
    rules: {
      "obsidianmd/no-view-references-in-plugin": "off",
      "obsidianmd/no-tfile-tfolder-cast": "off",
      "obsidianmd/prefer-active-doc": "off",
      "obsidianmd/prefer-window-timers": "off",
      "obsidianmd/detach-leaves": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
```

**Adjacent blocks that MUST stay untouched:**
- **Above (lines 43-63):** The Phase-5 / DOC-01 hardening block (`no-unused-vars` bumped to `error`, `no-restricted-syntax` for `document.createElement`). This is a sibling top-level config object — NOT to be touched.
- **Below (lines 93-116 and 117-133):** Two Phase 8 override blocks. Both stay.

**What differs / what to mirror:** This is a pure block delete. The planner specifies the exact line range (65-91, including the 3-line comment header at 65-68 and the closing brace + trailing comma at 91). The trailing comma on line 91 separates the deleted block from the next top-level config object; deleting it cleanly preserves the `tseslint.config(...)` call's argument list. No commas elsewhere need adjustment.

**Verification command** (per D-11 commit 6 acceptance): `npm run lint` exits 0 with this block removed.

---

### Pattern 7: `07-HUMAN-UAT.md` template (D-12)

**Target site in Phase 7:** New file `.planning/phases/07-lifecycle-compatibility/07-HUMAN-UAT.md`.

**Closest in-tree analog:** `.planning/phases/06-dom-api-refactor/06-HUMAN-UAT.md` (verified to exist; 8.2KB; established the no-screenshot live-walkthrough precedent per CONTEXT.md `<canonical_refs>` and D-12).

**Excerpt — Phase 6 top-level structure (planner mirrors this shape):**
```markdown
---
phase: 06-dom-api-refactor
date: 2026-05-14
status: complete
---

# Phase 6 — Human UAT Evidence

This file is the verification-of-record for Phase 6 (DOM API Refactor), consistent
with Phases 1-5 practice. It captures the acceptance evidence for ROADMAP Phase 6
success criterion #5 (visual parity with v1.14.0 baseline) and closes the
DIR-02 / DIR-03 / DIR-04 visual-acceptance leg.

Per CONTEXT D-15, no PNG screenshots are committed; the walkthrough is live and the
evidence is text inline.

---

## Pre-Conditions

- Plans 01-04 of Phase 6 are merged.
- `npm run lint` exits 0 (recorded in 06-04-SUMMARY.md).
- ...

---

## UAT Step 1 — Sidebar Calendar

**Verifies:** D-04 dynamic-color path through `setCssProps`; D-05 height application; ...

**Steps:**
1. Open the sidebar calendar view...
2. ...

**Result:** [x] Pass
**Notes:** No deviation observed.

---

## UAT Step 2 — ...
```

**What differs / what to mirror:**
- **Frontmatter** — change `phase` to `07-lifecycle-compatibility` and `status` initially to `pending` (set to `complete` only after UAT runs).
- **Title + intro** — replace DIR-02/03/04 references with DIR-05/06/07/08 + BUG-07; ROADMAP success criterion changes from #5 (visual parity) to #5 (modal persistence on plugin toggle) and #6 (popout window walkthrough).
- **Pre-Conditions block** — mirror the structure; replace the per-plan refs with Phase 7's commit list (per D-11: 5 or 6 commits depending on BUG-07 fold-in).
- **Steps 1-6** — mirror the "Verifies / Steps / Result / Notes" 4-section shape per step. The six steps are dictated by D-12 step list verbatim:
  1. Popout window full walkthrough (SC #6)
  2. Daily-note open path (DIR-07 verification — 3 sites: agenda, embedded calendar, embedded agenda)
  3. Settings-modal persistence on plugin toggle (SC #5 / BUG-07)
  4. Sidebar parity vs v1.14.0
  5. Embedded-view parity (verifies `EmbeddedCalendarView`/`EmbeddedAgendaView` async-lifecycle rewrite from D-10)
  6. Lint clean: `npm run lint` exits 0 with override block deleted
- **Mobile UAT footer** — add per D-13: "Desktop-only verification; mobile audit deferred to v1.16 if regression reported" (Phase 6 D-15 precedent).
- **Status field updates** to `complete` when steps 1-6 all pass.
- **NO PNG screenshots** committed under `.planning/phases/07-*/` — text inline only (D-12 / Phase 6 D-15 precedent).

## Shared Patterns

### Error normalization
**Source:** `src/utils/errors.ts:8-10` — `errorMessage(err: unknown): string`
**Apply to:** Every `.catch` callback in DIR-08 fixes (Pattern 4) and every new `try/catch` in the `MarkdownRenderChild` `initialize()` helpers (Pattern 5).
**Import path:** `import { errorMessage } from "../utils/errors"` (already imported in 18 sites including all 3 Phase 7 view files — confirmed by grep).
```typescript
// src/utils/errors.ts:8-10
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```

### User-visible Notice for errors
**Source:** Established Obsidian pattern; no single-line analog in this codebase but seen at `CalendarView.ts:832-833` (post-`.catch` Notice), `EmbeddedCalendarView.ts:238-239`, `EmbeddedAgendaView.ts:387-388` — three existing daily-note error Notices.
**Apply to:** D-09 bucket 2 `.catch` handlers AND the new `initialize()` try/catch in D-10.
```typescript
// Phase 7 .catch shape (D-09 bucket 2):
.catch((error) => new Notice(errorMessage(error)));

// Phase 7 initialize() try/catch shape (D-10):
private async initialize(): Promise<void> {
  try {
    await this.render();
  } catch (error) {
    new Notice(errorMessage(error));
  }
}
```

### `window.*` timer prefix (per A2)
**Source:** `src/main.ts:202, 210, 227, 235` — already correct (Phase 1 IN-02 / WR-01 owned-handle pattern).
**Apply to:** `CalendarView.ts:79` (likely already correct per CONTEXT.md A2 — confirm at execution time); `SettingsTab.ts:1381, 1783` (bare `setTimeout` — add `window.` prefix); `CalendarView.ts:967` and `EmbeddedAgendaView.ts:425` (bare `requestAnimationFrame` — add `window.` prefix; surfaced by research).
```typescript
// src/main.ts:202 — canonical owned-handle shape (UNCHANGED in Phase 7)
this.refreshTimer = window.setInterval(
  () => this.refreshCalendarView(),
  intervalMs
);

// src/main.ts:227 — canonical setTimeout owned-handle (UNCHANGED in Phase 7)
this.backgroundRefreshTimer = window.setTimeout(() => {
  this.backgroundRefreshTimer = null;
  callback();
}, delayMs);
```
A2 is explicit: `main.ts:202` and `main.ts:227` need NO change. The pattern is already correct.

## No Analog Found

Two Phase 7 patterns have no precedent in this codebase. The planner should flag both as NEW idioms in the relevant plan:

| Pattern | Files Introducing | Why It's Net-New | Mitigation |
|---------|-------------------|------------------|------------|
| `activeDocument` global usage | All 14 `getComputedStyle` sites + any future popout-aware DOM read | First Phase to require popout-window compatibility | Rule auto-fix shape is the template; one-token swap from `document` → `activeDocument`. No abstraction needed. |
| Synchronous `onload` wrapper around `void this.helper()` for `MarkdownRenderChild` | `EmbeddedCalendarView.ts`, `EmbeddedAgendaView.ts` | First sync-wrapper-for-async-lifecycle in this codebase. The standalone `void this.X()` inside a callback at `CalendarView.ts:342` is the nearest sibling but lives inside a then-callback, not as a method body. | Document the idiom in the plan's "Pattern Decision" section. Planner: include a 2-line comment above the `onload(): void { ... }` declaration explaining the supertype `void` contract. |

## Cross-Phase References

- **Phase 1 (TD-03/TD-04):** Established the `onunload` timer-cleanup pattern (`clearRefreshTimer`, `clearBackgroundRefreshTimer`). Phase 7 A1 removes the `detachLeavesOfType` line but leaves both `clearRefreshTimer()` and `clearBackgroundRefreshTimer()` calls intact.
- **Phase 2 (BUG-02 / D-12):** Introduced `void` + `.catch` + `errorMessage` pattern at `CalendarView.ts:315-346`. Phase 7 D-09 reuses this verbatim.
- **Phase 5 (DOC-01 / D-04):** Created `eslint.config.mjs` with per-phase override blocks. Phase 7 D-11 commit 6 deletes the Phase 7 block.
- **Phase 6 (D-15 / D-16):** Established no-screenshot HUMAN-UAT precedent (`06-HUMAN-UAT.md` is the template); set requirement-then-cleanup-then-UAT commit ordering. Phase 7 D-11/D-12 mirror both.

## Metadata

- **Analog search scope:** `src/` (all `.ts` files), `eslint.config.mjs`, `.planning/phases/06-*/`
- **Files scanned:** 19 (7 source files to modify + 1 lint config + 11 sibling source files searched for analogs)
- **Grep audits run:** `instanceof TFile`, `instanceof ` (general), `.catch`, `errorMessage`, `void ` (statement-level), `getComputedStyle`, `setTimeout|setInterval|requestAnimationFrame`
- **Pattern extraction date:** 2026-05-15
