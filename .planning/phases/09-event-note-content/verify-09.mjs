// Phase 09 verification harness.
//
// Drives the REAL NoteService.createEventNote code path in Node: the service is
// esbuild-bundled with the `obsidian` import stubbed, every check runs once per
// timezone in a child process, and parity checks diff the output against the
// NoteService shipped in git tag 1.15.0.
//
// Usage: node .planning/phases/09-event-note-content/verify-09.mjs
//
// This file is plain ESM JavaScript and lives outside src/ on purpose, so that
// `eslint src/` and `tsc` (include **/*.ts) never pick it up.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), "..", "..", "..");

const TIMEZONES = [
  "Europe/Athens",
  "America/Los_Angeles",
  "Pacific/Auckland",
  "UTC",
];

const OBSIDIAN_STUB = `
export class TFile {}
export class TFolder {}
export function normalizePath(p) {
  const collapsed = String(p).replace(/\\/+/g, "/").replace(/^\\/+|\\/+$/g, "");
  return collapsed === "" ? "/" : collapsed;
}
`;

const bundleCache = new Map();

/**
 * Bundle NoteService (+ DEFAULT_SETTINGS and getEventDateVariables) with the
 * obsidian import stubbed. When baselineRef is given, NoteService.ts is read
 * from that git ref instead of the working tree.
 */
async function loadBundle(baselineRef) {
  const cacheKey = baselineRef ?? "<working-tree>";
  if (bundleCache.has(cacheKey)) return bundleCache.get(cacheKey);

  const plugins = [
    {
      name: "obsidian-stub",
      setup(build) {
        build.onResolve({ filter: /^obsidian$/ }, () => ({
          path: "obsidian",
          namespace: "obsidian-stub",
        }));
        build.onLoad({ filter: /.*/, namespace: "obsidian-stub" }, () => ({
          contents: OBSIDIAN_STUB,
          loader: "js",
        }));
      },
    },
  ];

  if (baselineRef) {
    plugins.push({
      name: "baseline-noteservice",
      setup(build) {
        build.onLoad({ filter: /src[\\/]services[\\/]NoteService\.ts$/ }, () => ({
          contents: execFileSync(
            "git",
            ["-C", ROOT, "show", `${baselineRef}:src/services/NoteService.ts`],
            { encoding: "utf8" }
          ),
          loader: "ts",
          resolveDir: path.join(ROOT, "src", "services"),
        }));
      },
    });
  }

  const result = await esbuild.build({
    stdin: {
      contents: [
        'export { NoteService } from "./src/services/NoteService.ts";',
        'export { DEFAULT_SETTINGS } from "./src/settings/types.ts";',
        'export { getEventDateVariables } from "./src/utils/eventDateVariables.ts";',
      ].join("\n"),
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    logLevel: "silent",
    plugins,
  });

  const code = result.outputFiles[0].text;
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
  bundleCache.set(cacheKey, mod);
  return mod;
}

/** Create a note through the public createEventNote path; return { path, content }. */
async function createNote(mod, settingsPatch, event) {
  const created = [];
  const plugin = {
    settings: { ...structuredClone(mod.DEFAULT_SETTINGS), ...settingsPatch },
    app: {
      vault: {
        getAbstractFileByPath: () => null,
        create: async (p, content) => {
          created.push({ path: p, content });
          return { path: p };
        },
        createFolder: async () => {},
      },
    },
  };
  await new mod.NoteService(plugin).createEventNote(event);
  assert.equal(created.length, 1, "expected exactly one vault.create call");
  return created[0];
}

function workCalendar(extra = {}) {
  return {
    name: "Work",
    url: "https://example.invalid/work.ics",
    enabled: true,
    tags: [],
    ...extra,
  };
}

/** Settings patch that always carries the single Work calendar source. */
function patch(extra = {}) {
  return { calendarUrls: [workCalendar()], ...extra };
}

function makeEvent(y, m0, d, hh, mm, extra = {}) {
  const start = new Date(y, m0, d, hh, mm);
  return {
    id: "e1",
    title: "Standup",
    start,
    end: new Date(start.getTime() + 60 * 60 * 1000),
    isAllDay: false,
    description: "",
    location: "",
    attendees: [],
    source: "Work",
    sourceId: "work",
    ...extra,
  };
}

/** Text after the closing frontmatter delimiter. */
function bodyOf(content) {
  const marker = "\n---\n";
  const idx = content.indexOf(marker);
  assert.notEqual(idx, -1, "content has no closing frontmatter delimiter");
  return content.slice(idx + marker.length);
}

function basename(p) {
  return p.slice(p.lastIndexOf("/") + 1);
}

// ---------------------------------------------------------------------------
// Checks. Each is a top-level `async function checkName()` at column 0.
// ---------------------------------------------------------------------------

async function checkTracer() {
  const mod = await loadBundle();

  assert.deepEqual(mod.getEventDateVariables(new Date(2026, 4, 4, 12)), {
    week: "19",
    dd: "04",
    d: "4",
    year: "2026",
  });
  assert.deepEqual(mod.getEventDateVariables(new Date(2027, 0, 1, 12)), {
    week: "53",
    dd: "01",
    d: "1",
    year: "2027",
  });

  const settings = patch({
    noteTitleFormat: "{{year}}-W{{week}} {{dd}} {{d}} {{event_title}}",
    noteTemplate: "{{d}}|{{dd}}|{{week}}|{{year}}",
    defaultFrontmatter: "---\nweek: {{week}}\nyear: {{year}}\n---",
  });

  const may = await createNote(mod, settings, makeEvent(2026, 4, 4, 12, 0));
  assert.equal(basename(may.path), "2026-W19 04 4 Standup.md");
  assert.equal(
    may.content,
    [
      "---",
      "week: 19",
      "year: 2026",
      "tags:",
      "  - event",
      "  - meeting",
      "---",
      "4|04|19|2026",
    ].join("\n")
  );

  const jan = await createNote(mod, settings, makeEvent(2027, 0, 1, 12, 0));
  assert.equal(basename(jan.path), "2027-W53 01 1 Standup.md");
  const janLines = jan.content.split("\n");
  assert.ok(janLines.includes("week: 53"), "missing frontmatter line week: 53");
  assert.ok(janLines.includes("year: 2027"), "missing frontmatter line year: 2027");
  assert.equal(bodyOf(jan.content), "1|01|53|2027");
}

const CHECKS = [checkTracer];

// ---------------------------------------------------------------------------
// Runner: parent fans out one child per timezone; child runs CHECKS.
// ---------------------------------------------------------------------------

if (process.env.VERIFY09_TZ_CHILD !== "1") {
  for (const zone of TIMEZONES) {
    const child = spawnSync(process.execPath, [SELF], {
      env: { ...process.env, TZ: zone, VERIFY09_TZ_CHILD: "1" },
      stdio: "inherit",
    });
    if (child.status !== 0) {
      console.log(`verify-09: FAILED in ${zone}`);
      process.exit(1);
    }
  }
  console.log("verify-09: all checks passed (4 timezones)");
  process.exit(0);
} else {
  const zone = process.env.TZ;
  for (const check of CHECKS) {
    try {
      await check();
    } catch (error) {
      console.error(`verify-09 [${zone}]: ${check.name} failed`);
      console.error(error);
      process.exit(1);
    }
  }
  console.log(`verify-09 [${zone}]: ok`);
}
