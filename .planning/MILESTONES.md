# Milestones

## v1.15 Directory Compliance (Shipped: 2026-10-31)

**Delivered:** Closed every Obsidian community-plugin Review scorecard finding from v1.13.1 and installed lint/CI/release guardrails so the same violations cannot regrow.

**Phases completed:** 6 phases (05, 06, 07, 08, 08.1, 08.2), 27 plans, 74 tasks
**Requirements:** 15/15 (DIR-01..DIR-12, BUG-07, DOC-01, DOC-02)
**Timeline:** 2026-05-13 → 2026-10-31 (196 commits, `d49d752..7661649`)
**Code changes (excluding `.planning/`):** 26 files, +4,575 / −1,497; `src/` is now 7,073 lines of TypeScript
**Closeout:** override_closeout. All phases verified; the open-artifact audit was acknowledged (see below)

**Key accomplishments:**
- **Lint guardrails (DOC-01, Phases 05 + 08.2):** `eslint.config.mjs` now enforces the directory scorecard rules. `npm run lint` fails on any warning or on an inline rule bypass that is not authorized. CI lints every push and PR, and tag-triggered releases stop at Lint before build, attestation and publish (gate confirmed live on `1.16.0-beta.1`).
- **Release provenance (DIR-11, DIR-12):** the manifest description now ends with terminating punctuation. `actions/attest-build-provenance@v3` attests `main.js`, `manifest.json` and `styles.css` on every release, checked with `gh attestation verify`.
- **DOM API refactor (DIR-02/03/04, Phases 06 + 08.1):** no `innerHTML`/`outerHTML` writes, `element.style.*` assignments or raw `document.createElement` remain. All views use `createEl`/`createDiv`/`setText`, and dynamic colors use CSS custom properties through `setCssProps`.
- **Lifecycle and popout compatibility (DIR-05..08, BUG-07, Phase 07):** the `registerView` callback is now a pure factory with a lazy `getCalendarView()`. View code uses `activeDocument`, and every `as TFile` cast became an `instanceof TFile` check. Floating and misused promises were classified and fixed. BUG-07 was closed on the Obsidian side with a written explanation.
- **Type hygiene and conventions (DIR-01/09/10, DOC-02, Phase 08):** console logging was removed or gated, the `any`, `case`-declaration, escape-character and unused-variable findings were cleared, and the Directory Compliance do/don't rules were added to `CONVENTIONS.md` and `CLAUDE.md`.
- **Release flow (Phase 08.1):** hyphenated beta/RC tags publish as BRAT-visible prereleases, stable tags stay manual-publish drafts, and both use a Node 20.x lockfile build.

**Audit:** `milestones/v1.15-MILESTONE-AUDIT.md` (2026-10-30) recorded `gaps_found` for DOC-01 (B1: release builds bypassed lint; B2: some required rules were not fatal). Inserted Phase 08.2 closed both gaps, and it passed verification and UAT (2/2) on 2026-10-31.

**Known verification overrides:** 3 newly acknowledged, 0 carried forward from a prior close (see STATE.md Deferred Items)
- Phase 02 `02-VERIFICATION.md` is `human_needed` (v1.14.0 work)
- Quick task `260515-l3j` (manifest revert to 1.14.0) has unknown status
- Phase 08.1 deferred doc inconsistencies (CONVENTIONS.md still names attestation `@v2`, 08-VERIFICATION.md body label is stale, progress tooling counter drift)

**Tech debt carried forward:**
- `## Logging` sections in CONVENTIONS.md and CLAUDE.md still describe raw `console.*`
- The release gate's failing-lint path has not been tested live on GitHub (a local simulation only)
- 05-VALIDATION.md and 08.1-VALIDATION.md remain draft; no automated tests (by scope decision)
- The re-submission to the directory and the scorecard re-check have not been run yet

**Note:** phases 01–04 (v1.14.0 Stabilization, shipped 2026-05-12) were never archived as a milestone. They remain in `.planning/phases/`.

---
