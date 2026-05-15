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

  // ---------------------------------------------------------------------------
  // Phase 8 — DIR-01 / DIR-09 / DIR-10 will remove these when type-hygiene
  // and console-discipline land.
  // ---------------------------------------------------------------------------
  {
    files: ["src/**/*.ts"],
    rules: {
      // Recommended config gates no-console via obsidianmd/rule-custom-message
      // and ALLOWS console.warn/.error/.debug. DIR-01 wants ALL console.*
      // either removed or gated. Override `rule-custom-message` to no-op,
      // then enforce no-console: "error".
      "obsidianmd/rule-custom-message": "off",
      "no-console": "off", // Re-tightened in Phase 8 to "error"

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "no-case-declarations": "off",
      "no-useless-escape": "off",
    },
  },
  // Phase 8 — DIR-01 will remove these when type-hygiene lands. Narrow `files`
  // list (not `src/**/*.ts`) so any NEW unused-var introduced outside this
  // closed set fails the gate — preserves DOC-01 acceptance for new code.
  {
    files: [
      "src/services/CalendarService.ts",
      "src/services/IcsImportService.ts",
      "src/settings/SettingsTab.ts",
      "src/settings/types.ts",
      "src/utils/viewRenderers.ts",
      "src/views/CalendarView.ts",
      "src/views/EmbeddedCalendarView.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
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
