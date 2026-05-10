---
phase: 01
slug: foundation
status: approved
nyquist_compliant: false
nyquist_compliant_reason: "No behavioral test framework in repo. Per REQUIREMENTS.md, test-suite work is deferred to v2 (QA-01). All requirements verified via static-analysis (grep), build gates (tsc + esbuild), and one manual UAT (iOS WKWebView). Reconstructed retroactively."
wave_0_complete: true
created: 2026-05-10
reconstructed_from: [01-01..01-10 PLANs and SUMMARYs, 01-VERIFICATION.md, 01-HUMAN-UAT.md]
---

# Phase 01 — Validation Strategy (Reconstructed)

> Retroactive validation contract for phase 01-foundation. Phase shipped 2026-05-10 against grep-based static-analysis gates plus tsc + esbuild builds. No behavioral test framework exists in the repository, by milestone-scope decision (REQUIREMENTS.md → QA-01 deferred to v2).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no jest/vitest/pytest config in repo) |
| **Config file** | None — explicit milestone scope decision (QA-01 → v2) |
| **Static-analysis tool** | `grep -rnE` against `src/` for invariant patterns |
| **Type-check command** | `node ./node_modules/typescript/lib/tsc.js -noEmit -skipLibCheck` |
| **Build command** | `node esbuild.config.mjs production` |
| **Quick run command** | `npm run build` (runs tsc + esbuild together) |
| **Full suite command** | `npm run build` (no test target exists) |
| **Estimated runtime** | ~3 seconds |

**Why no test framework:** REQUIREMENTS.md → "Out of Scope" → "Test suite | Significant work, deserves a dedicated milestone." QA-01 is a v2 requirement. Phase 01 is a stabilization milestone that explicitly excludes bootstrapping Vitest/Jest/Obsidian-API mocks.

---

## Sampling Rate

- **After every task commit:** Run plan-specific `grep` invariant + `npm run build`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Build must be green; all `grep` gates from plans pass
- **Max feedback latency:** ~3 seconds (tsc + esbuild)

---

## Per-Task Verification Map

Each row maps a plan/requirement to its automated grep+build gate (the only automated verification available in this milestone). Status reflects post-execution state per `01-VERIFICATION.md` (passed) and the SUMMARY for each plan.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | TD-01 | T-01-01 / T-01-02 | Settings refreshInterval read live; no cached constructor copy | static-analysis + build | `grep -c "refreshMinutes" src/services/CalendarService.ts \| grep -E '^0$' && grep -cE "this\.plugin\.settings\.refreshInterval" src/services/CalendarService.ts \| grep -vE '^0$' && grep -cE "new CalendarService\(this\)" src/main.ts \| grep -vE '^0$' && npm run build` | N/A (no test file) | ✅ green |
| 01-02 | 02 | 1 | TD-02 | T-02-01..04 | NoteService reads live settings via getter; no this.app refs | static-analysis + build | `grep -c "this\\.app\\b" src/services/NoteService.ts \| grep -E '^0$' && grep -cE "private get settings\\(\\): MemoChronSettings" src/services/NoteService.ts \| grep -E '^1$' && grep -cE "new NoteService\\(this\\)" src/main.ts \| grep -E '^1$' && npm run build` | N/A | ✅ green |
| 01-03 | 03 | 1 | TD-03 | T-03-01..02 | All setTimeout/setInterval tracked + cancelled; detachLeavesOfType in onunload | static-analysis + build | `grep -cE "detachLeavesOfType\(MEMOCHRON_VIEW_TYPE\)" src/main.ts \| grep -E '^1$' && ! grep -nE "^\\s*setTimeout\\(\|^\\s*setInterval\\(" src/main.ts src/services/CalendarService.ts src/views/CalendarView.ts && npm run build` | N/A | ✅ green (refined by 01-06/07) |
| 01-04 | 04 | 1 | TD-04 | T-04-01..02 | isDragging flag + onClose drag-listener cleanup; D-09 honored | static-analysis + build | `grep -cE "private isDragging\\s*=\\s*false" src/views/CalendarView.ts \| grep -E '^1$' && grep -cE "protected async onClose\\(\\): Promise<void>" src/views/CalendarView.ts \| grep -E '^1$' && awk '/protected async onClose/,/^\\}/' src/views/CalendarView.ts \| grep -c 'this\\.handleDragEnd(' \| grep -E '^0$' && npm run build` | N/A | ✅ green |
| 01-05 | 05 | 1 | CLEAN-01 | (none) | Dead code removed; renderAgendaList function preserved per D-11 | static-analysis | `! grep -rnE "calculateEndDate\|DEFAULT_TEMPLATE_PATH\|TEMPLATE_VARIABLES" src/ && ! grep -nE "\\bApp\\b" src/views/EmbeddedCalendarView.ts && ! grep -nE "\\bTFile\\b\|renderAgendaList" src/views/EmbeddedAgendaView.ts && grep -cE "export function renderAgendaList" src/utils/viewRenderers.ts \| grep -E '^1$'` | N/A | ✅ green |
| 01-06a | 06 | 2 | CR-01 | T-06-01 (iOS WKWebView API mismatch) | Plugin-owned 100ms setTimeout cancelled with window.clearTimeout | static-analysis + build | `! grep -n "registerInterval(window\\.setTimeout" src/services/CalendarService.ts && grep -cE "private backgroundRefreshTimer: number \\\| null = null" src/main.ts \| grep -E '^1$' && grep -cE "window\\.clearTimeout" src/main.ts \| grep -vE '^0$' && grep -cE "this\\.plugin\\.setBackgroundRefreshTimer\\(" src/services/CalendarService.ts \| grep -E '^1$' && npm run build` | N/A | ✅ green (code-level); see Manual-Only for iOS runtime UAT |
| 01-06b | 06 | 2 | IN-02 | T-06-02 | View-owned 50ms setTimeout cancelled with window.clearTimeout in onClose | static-analysis + build | `! grep -n "this\\.registerInterval\\(" src/views/CalendarView.ts && grep -cE "private startupTimer: number \\\| null = null" src/views/CalendarView.ts \| grep -E '^1$' && grep -cE "window\\.clearTimeout\\(this\\.startupTimer\\)" src/views/CalendarView.ts \| grep -E '^1$' && npm run build` | N/A | ✅ green |
| 01-07 | 07 | 2 | WR-01 | T-07-01 (DoS via unbounded list growth) | Direct setInterval assignment; no registerInterval wrap; clearRefreshTimer in both reset+unload | static-analysis + build | `! grep -n "this\\.registerInterval\\(" src/main.ts && grep -cE "this\\.refreshTimer = window\\.setInterval" src/main.ts \| grep -E '^1$' && [ "$(grep -c 'this\\.clearRefreshTimer\\(\\)' src/main.ts)" -ge 2 ] && npm run build` | N/A | ✅ green |
| 01-08 | 08 | 2 | WR-02 | T-08-01..02 | First-colon split preserves titles + ISO datetimes verbatim | static-analysis + build | `! grep -n 'line\\.split(":")\\.map' src/views/EmbeddedAgendaView.ts src/views/EmbeddedCalendarView.ts && [ "$(grep -c 'line\\.indexOf(":")' src/views/EmbeddedAgendaView.ts src/views/EmbeddedCalendarView.ts \| awk -F: '{s+=$2} END{print s}')" = "2" ] && npm run build` | N/A | ✅ green |
| 01-09 | 09 | 2 | WR-03 | (none) | Static daily-notes-interface import; no dynamic await import | static-analysis + build | `! grep -n 'await import("obsidian-daily-notes-interface")' src/views/EmbeddedCalendarView.ts && grep -cE 'from "obsidian-daily-notes-interface"' src/views/EmbeddedCalendarView.ts \| grep -E '^1$' && npm run build` | N/A | ✅ green |
| 01-10 | 10 | 2 | IN-01 | T-10-01 (strictNullChecks gap) | Drag-handler binding fields typed nullable; compound onClose guard | static-analysis + build | `grep -cE "((e: MouseEvent) => void) \\\| undefined = undefined" src/views/CalendarView.ts \| grep -E '^2$' && grep -cE "if \\(this\\.isDragging && this\\.handleDragMoveBound && this\\.handleDragEndBound\\)" src/views/CalendarView.ts \| grep -E '^1$' && npm run build` | N/A | ✅ green |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 🔧 manual-only*

**Cross-checks already executed in 01-VERIFICATION.md (Behavioral Spot-Checks table):** every row of that table is a grep+build invariant against the implemented code. All rows PASS at verification time (2026-05-09T22:00:00Z).

---

## Wave 0 Requirements

Wave 0 in this phase = the static-analysis + build gates. No test files installed.

- [x] `grep` invariants per plan — embedded in each PLAN's `<verify>` and `<acceptance_criteria>` blocks
- [x] `tsc -noEmit -skipLibCheck` — passes
- [x] `node esbuild.config.mjs production` — passes
- [x] `01-VERIFICATION.md` Behavioral Spot-Checks table — all 17 rows PASS

*No test framework install. Existing infrastructure (grep + tsc + esbuild) covers every Phase-01 success-criterion at the level achievable without bootstrapping a behavioral test runner. The remaining behavioral gap (real-device iOS WKWebView lifecycle) is captured below as manual-only.*

---

## Manual-Only Verifications

The following behaviors cannot be falsified by static-analysis or by `tsc + esbuild` alone — they require runtime exercise. Each is documented either in `01-HUMAN-UAT.md` or below.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS rapid plugin disable/enable does not crash with "undefined is not an object" | TD-03, CR-01, IN-02 | The pre-fix risk was a `clearInterval(setTimeout-id)` API mismatch on WKWebView whose setTimeout/setInterval ID pools may not be shared. CR-01 / IN-02 fixes (plan 01-06) eliminate the mismatch at the source, but only a real iOS device confirms no residual callback fires into a torn-down view. Captured in `01-HUMAN-UAT.md`. | 1. Install plugin on Obsidian iOS via BRAT. 2. From Settings → Community plugins, disable MemoChron, then immediately re-enable it. 3. Repeat 10 times in rapid succession. **Pass:** No crash dialog, no "undefined is not an object" error in iOS Console. |
| Live refresh-interval propagation without Obsidian reload | TD-01 | Settings change must flow into next cache-expiry check. Static grep confirms the live-read pattern; runtime confirms behavior. | 1. Set refreshInterval to 60 minutes; let one cycle elapse. 2. Without reloading Obsidian, change refreshInterval to 1 minute. 3. **Pass:** Next cache-expiry fires at 1-minute boundary, not 60. |
| Live settings reflect in newly-created event notes | TD-02 | NoteService getter must resolve `this.plugin.settings` live at note-creation time. | 1. Create an event note. 2. Without reloading, change template/path settings. 3. Click another event to create a second note. **Pass:** Second note reflects new template/path; first note unchanged. |
| Mid-drag plugin disable leaves no orphan window listeners | TD-04 | Listener cleanup is in `View.onClose`; verifying absence of orphan listeners requires runtime inspection. Static grep only confirms `removeEventListener` calls exist. | 1. Open MemoChron sidebar. 2. Begin a drag-resize on the calendar pane (mousedown on the resize handle, hold). 3. While still holding, disable the plugin from Settings. 4. **Pass:** No JavaScript errors on `window` after teardown. (Optional: in DevTools, run `getEventListeners(window)` to confirm absence of mousemove/mouseup listeners attributed to MemoChron.) |
| Code-block params with embedded colons render correctly | WR-02 | First-colon split is verifiable in code, but visual confirmation in Obsidian preview is the user-facing test. | 1. Drop the spot-check block from `01-08-SUMMARY.md` (`title: My Meeting: Q2 Review`, `date: 2026-05-09T10:30`) into a vault note. 2. **Pass:** Title renders as the full string `My Meeting: Q2 Review`; date parses as the full ISO datetime. |

---

## Validation Sign-Off

- [x] All tasks have an automated grep/build verify command (Wave 0 dependencies satisfied for this milestone's scope)
- [x] Sampling continuity: each commit is followed by `npm run build`; no 3 consecutive tasks lack a verify
- [x] Wave 0 covers all gaps achievable without bootstrapping a test framework (deferred to v2 / QA-01)
- [x] No watch-mode flags (build is one-shot)
- [x] Feedback latency < 5s (tsc + esbuild ≈ 3s)
- [ ] `nyquist_compliant: true` — **NOT SET.** Behavioral test coverage requires a test framework, deferred to QA-01. Static-analysis + build gates documented above are the agreed automated-gate substitute for this milestone only.

**Approval:** approved 2026-05-10 (retroactive reconstruction; user accepted manual-only path on 2026-05-10).

---

## Audit Trail

### Validation Audit 2026-05-10 (Initial Reconstruction — State B)

| Metric | Count |
|--------|-------|
| Requirements in phase | 11 (TD-01..04, CLEAN-01, CR-01, IN-02, WR-01..03, IN-01) |
| Plans executed | 10 (01-01..01-10; 01-06 covers two requirements) |
| Behavioral tests written | 0 (test framework deferred to v2/QA-01) |
| Static-analysis gates documented | 11 |
| Build gates documented | 1 (tsc + esbuild) |
| Manual-only items | 5 |
| Gaps escalated to Manual-Only | 5 (iOS UAT + 4 behavioral checks not falsifiable by grep) |
| Gaps resolved with new tests | 0 |
