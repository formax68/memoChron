# Testing Patterns

**Analysis Date:** 2026-05-09

## Test Framework

**Runner:** Not configured — no test runner is present in this codebase.

**Detection results:**
- No `jest.config.*` file found
- No `vitest.config.*` file found
- No `*.test.ts` or `*.spec.ts` files found anywhere in the repository
- No test-related scripts in `package.json` (`scripts` contains only `dev`, `build`, `version`)
- No test libraries in `devDependencies` (`package.json` lists only TypeScript, esbuild, and TypeScript ESLint tooling)

**Assertion Library:** None

**Run Commands:** None — there are no test commands.

## Test File Organization

**Location:** No test files exist in this codebase.

**Naming:** Not applicable.

**Structure:** Not applicable.

## Test Structure

No tests exist. The codebase has no test infrastructure.

## Mocking

**Framework:** None installed.

**Patterns:** Not applicable.

## Fixtures and Factories

**Test Data:** None.

**Location:** Not applicable.

## Coverage

**Requirements:** None enforced — no coverage tooling is configured.

**View Coverage:** Not possible without test runner.

## Test Types

**Unit Tests:** None.

**Integration Tests:** None.

**E2E Tests:** None.

## Build Verification (Current Quality Gate)

The only automated quality check is TypeScript compilation. The build script performs a type-check before bundling:

```bash
npm run build   # runs: tsc -noEmit -skipLibCheck && node esbuild.config.mjs production
npm run dev     # runs: node esbuild.config.mjs  (hot-reload, no type check)
```

TypeScript strict options active (`tsconfig.json`):
- `noImplicitAny: true`
- `strictNullChecks: true`
- `isolatedModules: true`

This means the only current regression protection is that the TypeScript compiler must succeed. There are no runtime behavior tests.

## Critical Areas Without Test Coverage

Given the absence of tests, the following areas carry the highest risk of undetected regression:

**`src/utils/timezoneUtils.ts`** — Complex Windows-to-IANA timezone mapping and `convertIcalTimeToDate` logic. Timezone bugs are silent and hard to reproduce manually. Contains multiple fallback paths.

**`src/services/CalendarService.ts`** — iCalendar parsing, recurrence expansion, exception handling, cache read/write logic, and source mismatch detection. Correctness depends on ical.js behavior combined with custom logic.

**`src/services/NoteService.ts`** — Template variable substitution, folder path template rendering (`parseFolderTemplate`), filename sanitization, and frontmatter generation. Edge cases in user-defined templates will not be caught.

**`src/utils/pathUtils.ts`** — Path type detection for HTTP URLs, file URLs, absolute paths, and vault-relative paths across Windows and Unix. Platform-specific edge cases are untested.

**`src/services/IcsImportService.ts`** — Single-event ICS parsing with VTIMEZONE registration. Errors propagate as thrown exceptions with no safety net.

## Recommendations for Adding Tests

The codebase's pure utility functions and service classes are the best candidates for first tests because they have no DOM or Obsidian API dependencies:

**Suggested first test targets (high value, low setup cost):**
1. `src/utils/pathUtils.ts` — `detectPathType`, `normalizeFilePath`, `getPathInfo` are pure functions with clear inputs/outputs
2. `src/utils/timezoneUtils.ts` — `convertIcalTimeToDate`, `normalizeTimezone` (private but testable via exported functions)
3. `src/services/NoteService.ts` — `sanitizeFileName`, `formatDate`, `applyTemplateVariables`, `parseFolderTemplate` (private but extractable)

**Suggested framework:** Vitest — compatible with ESNext modules, fast, and minimal config. Add to `package.json`:
```bash
npm install --save-dev vitest
```

Add script to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Obsidian API mocking:** Tests for service logic that touches `this.plugin.app` will require mocking the Obsidian vault/workspace. A minimal mock object is sufficient since none of the business logic in `NoteService` or `CalendarService` depends on Obsidian DOM rendering.

---

*Testing analysis: 2026-05-09*
