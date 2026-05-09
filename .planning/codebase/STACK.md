# Technology Stack

**Analysis Date:** 2026-05-09

## Languages

**Primary:**
- TypeScript 4.7.4 - All plugin source code under `src/`

**Secondary:**
- JavaScript (ESM) - Build tooling (`esbuild.config.mjs`, `version-bump.mjs`)
- CSS - UI styling (`styles.css`, 27KB)

## Runtime

**Environment:**
- Electron (Obsidian desktop) and mobile WebView (Obsidian mobile)
- Plugin is not desktop-only (`isDesktopOnly: false` in `manifest.json`)
- Targets ES2018 output (esbuild target), with ES6/ES7 lib in TypeScript

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Obsidian Plugin API (`obsidian` latest) - Plugin host, views, file system, HTTP requests, UI primitives

**Build/Dev:**
- esbuild 0.17.3 - Bundler; entry `src/main.ts` → `main.js` (CJS format); watch mode for dev, minify + tree-shake for production
- TypeScript 4.7.4 - Type checking only (`tsc -noEmit`); esbuild does actual transpilation
- tslib 2.4.0 - TypeScript import helpers

**Testing:**
- No test framework detected. No test files found.

## Key Dependencies

**Critical (runtime):**
- `ical.js` ^1.5.0 - iCalendar (RFC 5545) parsing; parses remote/local `.ics` feeds into event objects. Used in `src/services/CalendarService.ts` and `src/services/IcsImportService.ts`. Custom type declarations in `src/types/ical.d.ts`.
- `luxon` ^3.6.1 - Date/time manipulation with IANA timezone support; used exclusively in `src/utils/timezoneUtils.ts` for Windows→IANA timezone conversion.
- `obsidian-daily-notes-interface` ^0.9.4 - Community utility package for interacting with Obsidian's Daily Notes plugin; provides `getAllDailyNotes`, `getDailyNote`, `createDailyNote`. Used in `src/views/CalendarView.ts`, `src/views/EmbeddedCalendarView.ts`, `src/views/EmbeddedAgendaView.ts`.

**Dev-only:**
- `@types/luxon` ^3.6.2 - Type definitions for luxon
- `@types/node` ^16.11.6 - Node.js type definitions for build scripts
- `@typescript-eslint/eslint-plugin` 5.29.0 / `@typescript-eslint/parser` 5.29.0 - ESLint TypeScript support (configured but no `.eslintrc` detected at root)
- `builtin-modules` 3.3.0 - Provides list of Node built-ins to mark as external in esbuild

## Configuration

**TypeScript (`tsconfig.json`):**
- `module: ESNext`, `target: ES6`
- `noImplicitAny: true`, `strictNullChecks: true`, `isolatedModules: true`
- `moduleResolution: node`
- `inlineSourceMap: true` (source maps embedded in output during dev)
- No path aliases configured

**Build (`esbuild.config.mjs`):**
- Entry: `src/main.ts` → `main.js` (CJS)
- Externals: `obsidian`, `electron`, all `@codemirror/*`, all `@lezer/*`, Node built-ins
- Dev mode: watch + inline source maps
- Production mode: minify, tree-shake, no source maps

**Version Management:**
- `version-bump.mjs` — npm `version` script hook; syncs `manifest.json` and `versions.json` from `package.json` version
- `versions.json` — maps plugin version → minimum Obsidian app version (all currently require `1.8.9`)
- `manifest.json` — Obsidian reads this directly; current version `1.13.1`, `minAppVersion: 1.8.9`

## Platform Requirements

**Development:**
- Node.js (CI uses 18.x; local environment running 26.x)
- npm for dependency management
- No `.nvmrc` or `.node-version` file — version is only enforced in CI

**Production:**
- Obsidian >= 1.8.9
- Desktop (Electron) and mobile supported
- Bundled output: `main.js`, `manifest.json`, `styles.css`
- No server-side component; fully client-side plugin

---

*Stack analysis: 2026-05-09*
