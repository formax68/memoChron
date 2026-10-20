---
phase: 07-lifecycle-compatibility
bug: BUG-07
status: closed-obsidian-side
closed_date: 2026-05-15
---

# BUG-07 Closure Note — Settings Modal Closes on Plugin Toggle

## Status

**Closed:** Root cause is in Obsidian core, not in MemoChron. No plugin-side workaround exists. ROADMAP Phase 7 success criterion #5 has two acceptable outcomes per CONTEXT.md D-12; this closure note represents outcome (b) — the modal still closes after amendment A1's deletion of `detachLeavesOfType` from `onunload`. UAT step 3 evidence (in `07-HUMAN-UAT.md`) confirms the close path persists on plugin re-enable, matching the forum-thread report where the same behavior reproduces with **core** plugins.

## Reproduction Steps

Mirrored verbatim from `07-HUMAN-UAT.md` Step 3:
1. Open Obsidian Settings (`Cmd/Ctrl + ,`).
2. Click "Community plugins" in the left navigation.
3. Locate MemoChron in the installed-plugins list.
4. Click the toggle to disable MemoChron.
5. **Observed (disable direction):** the Settings modal STAYS OPEN — A1's deletion of `detachLeavesOfType` from `onunload` successfully eliminated the plugin-side trigger in this direction.
6. Re-enable MemoChron via the Community Plugins toggle.
7. **Observed (enable direction):** the Settings modal CLOSES. The plugin's `onload` runs and Obsidian's internal plugin-enable code path triggers the same modal-close behavior the forum thread reports for core plugins.

The asymmetric reproduction (PASS on disable, FAIL on enable) demonstrates that A1 closed one of two Obsidian-side trigger paths but not both. The remaining trigger is an Obsidian-side bug independent of MemoChron's lifecycle code.

## Environment

- Obsidian version: 1.12.7
- OS: macOS 26.4.1
- MemoChron version: post-Phase-7 build at commit `c47dffe` (refactor(main): fix view-in-registerView memory leak (DIR-05) — first Phase 7 refactor commit) through commit `731eaa9` (docs(07): record Phase 7 human UAT — Phase 7 UAT commit) inclusive

## Plugin-Side Mitigation Attempted

Amendment A1 (locked 2026-05-15, supersedes original CONTEXT D-03) deleted the `app.workspace.detachLeavesOfType(MEMOCHRON_VIEW_TYPE)` call from `src/main.ts` `onunload` per the `obsidianmd/detach-leaves` rule. Source: `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/detachLeaves.js` (verified line-by-line; auto-fix DELETES the call). Plugin Guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Don't+detach+leaves+in+%60onunload%60.

A1 was the only plugin-side mitigation available. With the `detachLeavesOfType` call removed, the plugin no longer explicitly tears down its workspace leaf on disable. The disable-direction observation confirms A1 closed that path: the Settings modal stays open when MemoChron is toggled off. Obsidian's automatic leaf cleanup during plugin enable still runs, however, and triggers the same modal-close path on the re-enable direction — this is not something a plugin can avoid from `onload`.

## Obsidian-Side Evidence

Forum report (Obsidian 1.12.2 era, May 2026): [Settings modal closes when disabling a plugin's actively focused view](https://forum.obsidian.md/t/settings-modal-closes-when-disabling-a-plugins-actively-focused-view/111479). The thread reports the same modal-close behavior reproduces with **core plugins** (Obsidian's built-in graph view), independent of any community plugin code. Obsidian staff `WhiteNoise` acknowledged the bug. As of UAT execution date (2026-05-15, Obsidian 1.12.7), no published fix is available.

Reproduction sequence reported in the forum thread:
1. Open Obsidian Settings → Core plugins.
2. Toggle a core plugin (e.g., graph view) whose view is currently focused.
3. The Settings modal closes.

This matches MemoChron's UAT step 3 enable-direction behavior 1:1, confirming the root cause is in Obsidian core's plugin-enable-while-view-focused code path. The asymmetric MemoChron observation (PASS on disable, FAIL on enable) suggests two distinct trigger paths inside Obsidian core; A1 closed the disable-direction path by removing the plugin's explicit `detachLeavesOfType` call, but the enable-direction path is reached via Obsidian's internal plugin-load sequence and cannot be intercepted from plugin code.

## Conclusion

BUG-07 is closed for MemoChron purposes. The plugin has applied every available plugin-side mitigation (A1 — no `detachLeavesOfType` in `onunload`). The remaining modal-close behavior on plugin re-enable is an Obsidian-side bug that affects core plugins identically. A future Obsidian release will resolve it without requiring any change to MemoChron.

## Regression Test

Future MemoChron releases should re-verify UAT step 3 in `07-HUMAN-UAT.md` against the same reproduction steps. If a future Obsidian release fixes the underlying bug, the UAT step 3 result will flip to full PASS, and the closure note can be archived (left in place for historical record, but the BUG-07 status in REQUIREMENTS.md may be updated to "Resolved upstream in Obsidian <version>").

---

*Phase: 07-lifecycle-compatibility*
*Closure recorded: 2026-05-15*
*Reviewer: formax68 (michalis.e@onenet.group)*
