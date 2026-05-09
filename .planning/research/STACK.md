# Stack Research

**Domain:** Obsidian plugin — calendar/iCal integration, stabilization milestone
**Researched:** 2026-05-09
**Confidence:** HIGH (all API signatures verified against obsidian-api master and luxon Context7 docs)

---

## Scope

This document does NOT re-research the existing stack. The stack is fixed:
TypeScript 4.7.4 / esbuild 0.17.3 / ical.js 1.5.0 / luxon 3.6.1 / obsidian-daily-notes-interface 0.9.4 / Obsidian Plugin API.

This document answers: **how to use the existing stack correctly** for the five concern areas in this stabilization milestone.

---

## 1. Lifecycle Hygiene

**Concern items addressed:** TD-03, TD-04 (tracked timeouts, drag listener cleanup, view disposal)

### The Pattern

The Obsidian `Component` class (base of `Plugin` and `ItemView`) exposes four lifecycle-aware registration methods. All are verified against the `obsidian.d.ts` master source.

#### `this.registerInterval(id: number): number`

Wraps `window.setInterval`. The returned ID is tracked internally and cleared automatically on `unload()`. Use this in `Plugin.onload()` for the auto-refresh timer.

**Current code (wrong):**
```typescript
// main.ts — stored manually, cleared manually in onunload
this.refreshTimer = window.setInterval(() => this.refreshCalendarView(), intervalMs);
```

**Correct pattern:**
```typescript
// main.ts — no manual clearInterval needed; Component.unload() handles it
this.registerInterval(
  window.setInterval(() => this.refreshCalendarView(), intervalMs)
);
```

`refreshTimer` field and `clearRefreshTimer()` method can be removed entirely. `setupAutoRefresh()` must call `registerInterval` each time, but first cancel any previous interval — since `registerInterval` does not return a handle suitable for manual cancellation, keep a field for the registered id and use `window.clearInterval(id)` before re-registering when settings change, **then** call `registerInterval` on the new id.

**Preferred approach for a cancellable-and-re-registerable interval:**
```typescript
private refreshTimerId: number | null = null;

private setupAutoRefresh(): void {
  if (this.refreshTimerId !== null) {
    window.clearInterval(this.refreshTimerId);
    this.refreshTimerId = null;
  }
  const id = window.setInterval(() => this.refreshCalendarView(), intervalMs);
  this.refreshTimerId = id;
  this.registerInterval(id); // registers for auto-cleanup on unload
}
```

Confidence: HIGH — verified against `obsidian.d.ts`.

#### `this.register(cb: () => any): void`

Registers an arbitrary cleanup callback that runs when the component unloads. Use this for tracked `setTimeout` calls that cannot be wrapped by `registerInterval`.

**Current code (wrong — TD-03):**
```typescript
// CalendarService.ts — untracked setTimeout
setTimeout(() => this.fetchCalendars(sources, true), 100);

// CalendarView.ts — untracked setTimeout
setTimeout(() => { ... }, 50);
```

**Correct pattern for tracked timeouts:**
```typescript
// In a Plugin or Component subclass:
private scheduleTrackedTimeout(callback: () => void, delayMs: number): number {
  const id = window.setTimeout(callback, delayMs);
  this.register(() => window.clearTimeout(id));
  return id;
}
```

For `CalendarService` (not a Component subclass), the plugin must own the timeout id:
```typescript
// main.ts — track the background-refresh timeout
private backgroundRefreshTimeoutId: number | null = null;

// Called from CalendarService instead of bare setTimeout:
scheduleBackgroundRefresh(cb: () => void): void {
  if (this.backgroundRefreshTimeoutId !== null) {
    window.clearTimeout(this.backgroundRefreshTimeoutId);
  }
  this.backgroundRefreshTimeoutId = window.setTimeout(cb, 100);
  this.register(() => {
    if (this.backgroundRefreshTimeoutId !== null) {
      window.clearTimeout(this.backgroundRefreshTimeoutId);
    }
  });
}
```

Simpler alternative: expose a `cancelBackgroundRefresh()` method on `CalendarService`, call it in `onunload()`.

Confidence: HIGH — `register(cb)` API verified against `obsidian.d.ts`.

#### `this.registerDomEvent(el, type, callback, options?)`

Three overloads (Window, Document, HTMLElement). Verified signatures:

```typescript
registerDomEvent<K extends keyof WindowEventMap>(
  el: Window, type: K,
  callback: (this: HTMLElement, ev: WindowEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions
): void;

registerDomEvent<K extends keyof HTMLElementEventMap>(
  el: HTMLElement, type: K,
  callback: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions
): void;
```

**Current code (wrong — TD-04):**
```typescript
// CalendarView.ts:1055-1056 — raw window listeners added during drag
window.addEventListener("mousemove", this.handleDragMoveBound);
window.addEventListener("mouseup", this.handleDragEndBound);
// Removed in handleDragEnd, but NOT removed if view is closed mid-drag
```

**Correct pattern — defensive cleanup in `onClose()`:**
```typescript
// CalendarView.ts
async onClose(): Promise<void> {
  // Defensive drag cleanup — handles view-close-during-drag
  window.removeEventListener("mousemove", this.handleDragMoveBound);
  window.removeEventListener("mouseup", this.handleDragEndBound);
}
```

Why not use `registerDomEvent` for the drag listeners? `registerDomEvent` is for listeners added once at initialization. The drag listeners are added and removed dynamically per-drag. The correct fix is `onClose()` defensive cleanup, not `registerDomEvent`. The `mousedown` initiator on `resizeHandle` is a permanent listener and **should** use `registerDomEvent`:

```typescript
// CalendarView.createUI() — replace:
this.resizeHandle.addEventListener("mousedown", (e) => this.handleDragStart(e));
// With:
this.registerDomEvent(this.resizeHandle, "mousedown", (e) => this.handleDragStart(e));
```

Similarly, the permanent `addEventListener` calls on day cells, agenda, etc. (lines 611–901) should use `registerDomEvent` when the element is long-lived. For elements created fresh on each `renderCalendar()` call, the listeners are naturally discarded with the element when `container.empty()` is called — those do not need migration.

**CalendarView.ts permanent listeners that should use `registerDomEvent`:**
- `resizeHandle` mousedown (line 189)
- `agenda` dragover, dragleave, drop (lines 886–901) — these live for the view lifetime

Confidence: HIGH — API verified against `obsidian.d.ts`.

#### `this.registerEvent(eventRef: EventRef): void`

For Obsidian workspace/vault events. Already used correctly in the codebase for plugin-level events. No changes needed here.

### View Disposal in `onunload()`

**Current code (wrong):**
```typescript
// main.ts:94-96
onunload() {
  this.clearRefreshTimer(); // clears interval — but leaves background setTimeout, services, views
}
```

**Correct pattern:**
```typescript
onunload(): void {
  // Cancel any pending background-refresh timeout
  if (this.backgroundRefreshTimeoutId !== null) {
    window.clearTimeout(this.backgroundRefreshTimeoutId);
    this.backgroundRefreshTimeoutId = null;
  }
  // Explicitly close the calendar view if Obsidian hasn't already
  const leaves = this.app.workspace.getLeavesOfType(MEMOCHRON_VIEW_TYPE);
  leaves.forEach(leaf => leaf.detach());
}
```

Note: `registerInterval` auto-cleanup makes the manual `clearRefreshTimer()` call redundant once the timer is migrated to `registerInterval`.

Confidence: HIGH — `WorkspaceLeaf.detach()` verified against `obsidian.d.ts`.

---

## 2. innerHTML Alternatives for SVG in Settings

**Concern items addressed:** SEC-01, and the static-help-text `innerHTML` calls

### For User-Controlled Color Values (SEC-01 — Critical)

The vulnerability is in `SettingsTab.ts` lines 589 and 675:
```typescript
// VULNERABLE — currentColor comes from persisted settings (untrusted source)
customLabel.innerHTML = `<svg ... fill="${currentColor}" ...`;
```

**Option A — Validate and keep innerHTML (simplest fix):**
```typescript
const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const safeColor = COLOR_REGEX.test(currentColor) ? currentColor : "#888888";
customLabel.innerHTML = `<svg ... fill="${safeColor}" ...`;
```

This matches the SEC-01 fix approach exactly. Confidence: HIGH. Keeps the code familiar.

**Option B — Build SVG via `document.createElementNS` (Obsidian-preferred):**
```typescript
const NS = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(NS, "svg");
svg.setAttribute("width", "24");
svg.setAttribute("height", "24");
svg.setAttribute("viewBox", "0 0 24 24");
const circle = document.createElementNS(NS, "circle");
circle.setAttribute("cx", "12");
circle.setAttribute("cy", "12");
circle.setAttribute("r", "10");
circle.setAttribute("fill", currentColor);  // setAttribute is safe — no HTML context
circle.setAttribute("stroke", "#888");
circle.setAttribute("stroke-width", "2");
svg.appendChild(circle);
customLabel.empty();
customLabel.appendChild(svg);
```

`setAttribute` on a DOM element does NOT create an HTML injection vector — the value is stored as a string attribute, not parsed as HTML. This is the approach recommended by Obsidian plugin guidelines (verified against developer docs).

**Recommendation:** Use Option A (validation guard) for minimum-diff safety, Option B for full Obsidian compliance. Both are valid. For the Obsidian directory review, Option B (or `sanitizeHTMLToDom()`) is what reviewers expect.

Note: `sanitizeHTMLToDom(html)` from the Obsidian API provides a safe DocumentFragment but strips SVG namespace elements — it is appropriate for HTML but not for SVG. Use `createElementNS` for SVG, not `sanitizeHTMLToDom`.

### For Static Help-Text innerHTML (Low risk, but flagged by reviewers)

Lines 1817, 1834, 1855–1857 use `innerHTML` for static strings with `<strong>` tags. No injection risk at runtime, but the pattern violates Obsidian guidelines and will be flagged.

**Current code:**
```typescript
gcalSteps.createEl("li").innerHTML = "Copy the <strong>Secret address in iCal format</strong>";
```

**Correct pattern:**
```typescript
const li = gcalSteps.createEl("li");
li.appendText("Copy the ");
li.createEl("strong", { text: "Secret address in iCal format" });
```

`appendText()` is available on all `HTMLElement` in Obsidian (it appends a text node, no injection risk). Alternative: use `createSpan({ text: "..." })` for inline spans.

Confidence: HIGH — `createEl` and `appendText` verified against Obsidian developer docs.

---

## 3. Live Settings Propagation

**Concern items addressed:** TD-01 (stale `refreshMinutes`), TD-02 (stale `NoteService` settings reference)

### The Pattern

The authoritative Obsidian plugin pattern (verified via Context7) stores settings on the plugin instance as `this.settings` and has `PluginSettingTab` and services read it via the plugin reference. Services should never cache a copy of settings at construction time.

**TD-01 — CalendarService stale `refreshMinutes`:**

```typescript
// CURRENT — stale after settings change
constructor(private plugin: MemoChron, private refreshMinutes: number) {}

private needsRefresh(...): boolean {
  const cacheExpired = now - this.lastFetch >= this.refreshMinutes * 60 * 1000;
  // ...
}
```

**Fix — read live from plugin:**
```typescript
// Remove refreshMinutes constructor parameter entirely
constructor(private plugin: MemoChron) {}

private needsRefresh(...): boolean {
  const cacheExpired =
    now - this.lastFetch >= this.plugin.settings.refreshInterval * 60 * 1000;
  // ...
}
```

`CalendarService` already holds `private plugin: MemoChron`, so the fix is a one-line change in `needsRefresh()` and constructor signature cleanup.

**TD-02 — NoteService stale settings reference:**

```typescript
// CURRENT — settings object reference from construction time
constructor(private app: App, private settings: MemoChronSettings) {}
// If loadSettings() replaces this.settings with a new object, NoteService still
// holds the old reference
```

**Fix — pass the plugin instance:**
```typescript
// main.ts
this.noteService = new NoteService(this.app, this);

// NoteService.ts
constructor(private app: App, private plugin: MemoChron) {}

private get settings(): MemoChronSettings {
  return this.plugin.settings;
}
```

The getter approach means all existing `this.settings.x` calls in NoteService continue to work unchanged — the `settings` getter is a transparent bridge. Zero churn in the body of NoteService.

**Alternative (also valid):** Pass a getter function `() => this.settings`:
```typescript
constructor(private app: App, private getSettings: () => MemoChronSettings) {}
// Usage: this.getSettings().noteLocation
```

This is more explicit but requires updating every `this.settings.x` to `this.getSettings().x`. The private getter approach is lower churn.

Confidence: HIGH — pattern derived from official Obsidian plugin settings documentation (Context7 verified).

---

## 4. Timezone-Correct Parsing of YYYY-MM-DD Filename → Local Date

**Concern items addressed:** BUG-01 (off-by-one date in non-UTC timezones)

### The Bug

In `viewRenderers.ts:parseDateFromFilename()`, the YYYY-MM-DD branch does:
```typescript
const date = new Date(dateStr); // e.g. new Date("2024-05-15")
```

`new Date("2024-05-15")` (ISO date-only string) is parsed by the spec as **UTC midnight**, not local midnight. A user in UTC-5 will get `2024-05-14T19:00:00` local — one day behind.

This is confirmed by the ECMAScript spec: date-only ISO strings without a time component or offset are treated as UTC. This is distinct from date-time strings (e.g., `"2024-05-15T00:00:00"`), which are treated as local time.

### The Fix Using Luxon (already in the dependency tree)

Luxon's `DateTime.fromISO("2024-05-15")` with no zone option also parses as UTC midnight for a date-only string (same spec behavior). The correct incantation is:

```typescript
import { DateTime } from "luxon";

// CORRECT — parse as local calendar date, not UTC instant
const dt = DateTime.fromISO(dateStr, { zone: "local" });
// OR equivalently:
const dt = DateTime.fromObject({ year, month, day }); // where components are extracted from the string
```

`DateTime.fromISO("2024-05-15", { zone: "local" })` interprets the date as midnight in the local timezone — the correct behavior for a filename representing a local calendar day.

**Recommended implementation for `parseDateFromFilename`:**

```typescript
import { DateTime } from "luxon";

// For the YYYY-MM-DD branch:
if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
  const dt = DateTime.fromISO(dateStr, { zone: "local" });
  if (dt.isValid) return dt.toJSDate();
}

// For YYYY_MM_DD and YYYY.MM.DD (normalize separator first):
const normalized = dateStr.replace(/[_\.]/g, "-");
const dt = DateTime.fromISO(normalized, { zone: "local" });
if (dt.isValid) return dt.toJSDate();

// For YYYYMMDD:
if (/^\d{8}$/.test(dateStr)) {
  const iso = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
  const dt = DateTime.fromISO(iso, { zone: "local" });
  if (dt.isValid) return dt.toJSDate();
}

// For DD-MM-YYYY: parse components explicitly to avoid ambiguity
if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
  const [d, m, y] = dateStr.split("-").map(Number);
  const dt = DateTime.fromObject({ year: y, month: m, day: d });
  if (dt.isValid) return dt.toJSDate();
}
```

`DateTime.fromObject({ year, month, day })` with no zone option uses the local system zone — this is the canonical Luxon way to create a local-date-only value.

**Why not `new Date(year, month - 1, day)`?** This also creates local midnight and is correct for the timezone, but it requires extracting components manually and uses the zero-indexed month convention. The Luxon approach is less error-prone and is consistent with the codebase's existing Luxon usage in `timezoneUtils.ts`.

Confidence: HIGH — `DateTime.fromISO` zone behavior verified against Luxon Context7 docs and official zone documentation.

---

## 5. Localized Day/Month Names via Luxon

**Concern items addressed:** ENH-05 (`{{day}}` → `Monday`, `{{month}}` → `January`)

### The Pattern

Luxon's `DateTime` instance exposes `.weekdayLong` and `.monthLong` properties directly — no format string needed.

```typescript
import { DateTime } from "luxon";

const dt = DateTime.fromJSDate(event.start); // or fromObject(...)

// Written-out names (English, system locale)
const dayName: string = dt.weekdayLong;    // "Monday", "Tuesday", ...
const monthName: string = dt.monthLong;    // "January", "February", ...

// Abbreviated
const dayShort: string = dt.weekdayShort;  // "Mon", "Tue", ...
const monthShort: string = dt.monthShort;  // "Jan", "Feb", ...
```

These properties use the `Intl.DateTimeFormat` API under the hood and reflect the locale set on the DateTime object (default: system locale). Since ENH-05 requires English names only (the out-of-scope locale milestone would handle locale customization), the system default is correct for English-locale Obsidian users.

**If explicit English is required** (defensive for non-English OS locales):
```typescript
const dt = DateTime.fromJSDate(event.start).setLocale("en");
const dayName = dt.weekdayLong;   // always "Monday" etc.
const monthName = dt.monthLong;   // always "January" etc.
```

**Alternatively via `toFormat`** (also correct, but more verbose):
```typescript
const dayName = dt.toFormat("cccc");   // full weekday name: "Wednesday"
const monthName = dt.toFormat("LLLL"); // full month name: "May"
```

Token reference (verified against Luxon Context7 docs):
- `cccc` — full weekday name (locale-aware standalone form)
- `LLLL` — full month name (locale-aware standalone form)
- `ccc` / `LLL` — abbreviated forms

**Where to add in NoteService:**

`getEventTemplateVariables()` already populates an `EventTemplateVariables` object. Add `day` and `month` fields:

```typescript
interface EventTemplateVariables {
  // ...existing fields...
  day: string;   // "Monday"
  month: string; // "January"
}

// In getEventTemplateVariables():
import { DateTime } from "luxon";
const dt = DateTime.fromJSDate(event.start).setLocale("en");
return {
  // ...existing fields...
  day: dt.weekdayLong,
  month: dt.monthLong,
};
```

The existing `applyTemplateVariables()` will handle `{{day}}` and `{{month}}` automatically since it iterates all keys in the variables object.

**Note on `FolderTemplateVariables`:** That type already has `DDDD` (full weekday name) and `MMMM` (full month name) but uses a static English array instead of Luxon. For consistency, the folder template variables could be migrated to Luxon too, but that is not required for ENH-05. ENH-05 only touches the note content template, not the folder path template.

Confidence: HIGH — `weekdayLong`, `monthLong`, `toFormat("cccc")`, `toFormat("LLLL")` all verified against Luxon Context7 docs.

---

## 6. Consistent Error Handling in Catch Blocks

**Concern items addressed:** SEC-02

### The Pattern

TypeScript's `useUnknownInCatchVariables` (TS 4.4+) makes `error` typed as `unknown` in strict mode. The existing codebase accesses `error.message` without guarding, which is a type error in strict mode and throws at runtime for non-Error thrown values.

**Required guard (verify before each `.message` access):**
```typescript
const message = error instanceof Error ? error.message : String(error);
```

**Recommended utility (add to `src/utils/errorUtils.ts`):**
```typescript
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

Import and use in every catch block in `CalendarService.ts`, `NoteService.ts`, `CalendarView.ts`.

`IcsImportService.ts` already implements `error instanceof Error` — use that as the model.

Confidence: HIGH — TypeScript spec behavior, no external API dependency.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `window.setInterval` without `registerInterval` | Leaks when plugin is disabled; requires manual cleanup that `onunload` may miss | `this.registerInterval(window.setInterval(...))` |
| Raw `setTimeout` without tracking | Cannot be cancelled on plugin unload; fires into detached plugin state | `window.setTimeout(...)` with id stored + `this.register(() => clearTimeout(id))` |
| `element.addEventListener` for permanent listeners | Leaks if `onClose`/`onunload` is not called | `this.registerDomEvent(element, ...)` |
| `innerHTML` with any variable interpolation | XSS vector in Obsidian's plugin sandbox; flagged by directory reviewers | `createElementNS` for SVG; `createEl`/`appendText` for HTML |
| `new Date("YYYY-MM-DD")` for filename parsing | ECMAScript parses date-only ISO strings as UTC midnight, causing off-by-one in negative-offset timezones | `DateTime.fromISO(str, { zone: "local" })` or `DateTime.fromObject({year, month, day})` |
| Storing `this.settings` as a constructor copy in services | Becomes stale when the plugin replaces its settings object after `loadData()` | Store `private plugin: MemoChron` and read `this.plugin.settings` at call-time |
| `sanitizeHTMLToDom()` for SVG elements | Strips SVG namespace; elements lose their namespace and render as unknown HTML | `document.createElementNS("http://www.w3.org/2000/svg", ...)` |

---

## Alternatives Considered

| Pattern | Recommended | Alternative | Why Not |
|---------|-------------|-------------|---------|
| Tracked timeout cleanup | `register(cb)` + manual cancel | Custom `trackedSetTimeout` wrapper | Adds a helper class; `register()` is simpler for one-off timeouts |
| Drag listener cleanup | Defensive `onClose()` removal | `registerDomEvent(window, ...)` at drag-start | `registerDomEvent` on `window` registers for the lifetime of the component, not just one drag; using it per-drag would pile up registrations |
| Settings propagation | Plugin instance reference + getter | Getter function `() => this.settings` | Both work; private getter on the service is lower churn since existing `this.settings.x` references stay valid |
| SVG color-circle | `createElementNS` | Color-regex validation guard on `innerHTML` | Both fix the security issue; `createElementNS` is the Obsidian-preferred pattern; validation guard is the minimum-diff option |
| Date-from-filename | `DateTime.fromISO(str, { zone: "local" })` | `new Date(year, month-1, day)` via regex extraction | Both produce local midnight; Luxon is already imported and handles validation via `.isValid` |

---

## Sources

- `/obsidianmd/obsidian-api` (Context7 + raw `obsidian.d.ts`) — `Component` class, `registerDomEvent`, `registerInterval`, `register(cb)`, `WorkspaceLeaf.detach()` signatures — HIGH confidence
- `/obsidianmd/obsidian-developer-docs` (Context7) — `createEl`, `appendText`, `innerHTML` guidelines, `sanitizeHTMLToDom`, `registerEvent` patterns, `View.onClose()` — HIGH confidence
- `/moment/luxon` (Context7) — `DateTime.fromISO` with `zone` option, `DateTime.fromObject`, `weekdayLong`, `monthLong`, `toFormat("cccc"/"LLLL")` — HIGH confidence
- `https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/obsidian.d.ts` — exact TypeScript method signatures for all three `registerDomEvent` overloads, `registerInterval`, `register(cb)` — HIGH confidence
- Codebase inspection (`/Users/mike/code/memoChron/src/`) — current usage patterns in `CalendarView.ts`, `SettingsTab.ts`, `NoteService.ts`, `CalendarService.ts`, `viewRenderers.ts` — confirms bugs and identifies precise fix locations

---
*Stack research for: MemoChron Obsidian plugin stabilization milestone*
*Researched: 2026-05-09*
