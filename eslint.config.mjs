// eslint.config.mjs — Phase 5 (DOC-01) — MemoChron v1.15 Directory Compliance
//
// This config enforces the directory-scorecard rule list. The per-file
// "override" blocks below silence findings that exist on the v1.15 starting
// tree; each block names the phase that will remove it. NO inline
// `eslint-disable` comments are used for scorecard violations — all
// suppression is here so the closing-phase diff is a single block delete.
//
// Sources:
//   https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/eslint.config.mts
//   https://typescript-eslint.io/getting-started/typed-linting/
//   https://github.com/obsidianmd/eslint-plugin

import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "manifest.json"],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },

  // Recommended config from eslint-plugin-obsidianmd brings:
  //   - @eslint/js recommended
  //   - typescript-eslint recommended-type-checked (51 rules incl.
  //     no-floating-promises, no-explicit-any, no-unused-vars)
  //   - eslint-plugin-no-unsanitized recommended (innerHTML / outerHTML)
  //   - @microsoft/sdl/no-inner-html + no-document-write
  //   - 26 obsidianmd/* rules (DOM, lifecycle, TFile, registerView, etc.)
  //   - Obsidian globals (createEl, activeDocument, activeWindow, ...)
  ...obsidianmd.configs.recommended,

  // Phase 5 tightens these defaults to satisfy DOC-01's wording:
  {
    files: ["src/**/*.ts"],
    rules: {
      // DOC-01 lists no-unused-vars explicitly; recommended config makes
      // it "warn" — bump to error so it actually blocks the build.
      "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],

      // DIR-04: catch `document.createElement` — the obsidianmd plugin
      // version 0.3.0 does NOT yet register `prefer-create-el`.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name='createElement']",
          message:
            "DIR-04: Use Obsidian's createEl/createDiv/createSpan helpers instead of document.createElement.",
        },
      ],
    },
  },

  // D-08 — Ambient .d.ts shims are excluded from no-explicit-any. Hand-typing
  // untyped third-party libraries (ical.js) is out of scope; the cheapest
  // correct close per CONTEXT.md D-08.
  {
    files: ["**/*.d.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  // D-08-extension — `no-unsafe-*` typed-linting cascade from ical.js's
  // untyped APIs (`parse`, `getFirstPropertyValue`, `getFirstValue`,
  // constructor, `fromData`). Same root cause as the existing
  // `**/*.d.ts` `no-explicit-any: off` exclusion: ical.js is
  // fundamentally untyped, hand-typing is deferred to FRAG-02. This
  // silences the consumption-site cascade at the call sites in
  // CalendarService, IcsImportService, NoteService, CalendarView,
  // and main.ts. NOT tied to a scorecard finding — `no-unsafe-*`
  // is not a DIR-NN rule.
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },

  globalIgnores([
    "node_modules",
    "main.js",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "versions.json",
  ]),
);
