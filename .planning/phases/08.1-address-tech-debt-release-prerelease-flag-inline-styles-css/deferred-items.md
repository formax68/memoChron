# Deferred discoveries — 08.1-03

2026-10-30: Pre-existing documentation inconsistencies found during the scoped bookkeeping pass; not caused by this plan and not changed.

- `.planning/codebase/CONVENTIONS.md`, Release & Docs attestation rule names `actions/attest-build-provenance@v2`, while the existing release workflow uses `@v3`. Reconcile in a later documentation pass; this plan only adds the requested prerelease rule.
- `.planning/phases/08-type-hygiene-conventions/08-VERIFICATION.md` body still says `human_needed`, although its frontmatter is passed and its explicit SC6 lint-as-proxy override is resolved. Preserve historical evidence; reconcile the stale body label separately if needed. The actual directory scorecard run remains deferred.
- `.planning/PROJECT.md` still has unchecked DIR-11/DIR-12/DOC-01 entries despite recorded satisfaction in Phase 5 verification. PROJECT.md is outside this plan's write scope; milestone archival should reconcile it.
- Installed progress tooling reported 78% in stdout while persisting 89% (8/9 verified phases) during Task 3. Preserve tool-owned values and investigate upstream separately; neither implies Phase 08.1 passed verification.

The eight scoped audit deferrals and their routes are recorded verbatim in `08.1-03-SUMMARY.md`.
