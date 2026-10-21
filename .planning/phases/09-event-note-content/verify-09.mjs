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
import YAML from "yaml";
import jsyaml from "js-yaml";

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
 * Bundle NoteService (+ DEFAULT_SETTINGS, getEventDateVariables and the
 * frontmatterTags helpers) with the obsidian import stubbed. When baselineRef is given, NoteService.ts is read
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
        'export { mergeCalendarTags, normalizeTag, yamlSafeTag } from "./src/utils/frontmatterTags.ts";',
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

/** Text between the opening `---` line and the next `---` line. */
function frontmatterOf(content) {
  const lines = content.split("\n");
  assert.equal(lines[0], "---", "content does not start with a frontmatter delimiter");
  const close = lines.indexOf("---", 1);
  assert.notEqual(close, -1, "content has no closing frontmatter delimiter");
  return lines.slice(1, close).join("\n");
}

/**
 * Create a note on the 2026-05-04 12:00 Work event with the given default
 * frontmatter body, global default tags, Work calendar tags and optional
 * per-calendar notesSettings; return the generated frontmatter body.
 */
async function fmFor(body, defaultTags, sourceTags, notesSettings) {
  const mod = await loadBundle();
  const calendar = workCalendar({ tags: sourceTags });
  if (notesSettings !== undefined) calendar.notesSettings = notesSettings;
  const note = await createNote(
    mod,
    {
      calendarUrls: [calendar],
      defaultFrontmatter: `---\n${body}\n---`,
      defaultTags,
    },
    makeEvent(2026, 4, 4, 12, 0)
  );
  return frontmatterOf(note.content);
}

/** Valid under two strict YAML parsers and exactly one top-level tags key. */
function assertSingleTagsKey(fm, label = "") {
  assert.doesNotThrow(
    () => YAML.parse(fm, { uniqueKeys: true }),
    `yaml (uniqueKeys) rejects ${label}:\n${fm}`
  );
  assert.doesNotThrow(() => jsyaml.load(fm), `js-yaml rejects ${label}:\n${fm}`);
  const keys = fm.split("\n").filter((l) => /^(["']?)tags\1[ \t]*:/.test(l));
  assert.equal(keys.length, 1, `expected one top-level tags key ${label}:\n${fm}`);
}

/** Calendar tags [event, meeting, Work] unless a fixture overrides them. */
const CAL = { defaultTags: ["event", "meeting"], sourceTags: ["Work"] };

/**
 * Run one tag fixture: input body lines -> expected frontmatter body lines.
 * opts: { defaultTags, sourceTags, notesSettings, single (default true) }.
 */
async function expectTags(label, input, expected, opts = {}) {
  const { defaultTags, sourceTags, notesSettings, single = true } = {
    ...CAL,
    ...opts,
  };
  const fm = await fmFor(input.join("\n"), defaultTags, sourceTags, notesSettings);
  assert.equal(fm, expected.join("\n"), `tag fixture ${label}`);
  if (single) assertSingleTagsKey(fm, label);
  return fm;
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

// [y, monthIndex, d, h, min] -> expected getEventDateVariables output (local time).
const BOUNDARY_CASES = [
  [[2026, 11, 31, 12, 0], { week: "53", dd: "31", d: "31", year: "2026" }],
  [[2027, 0, 3, 12, 0], { week: "53", dd: "03", d: "3", year: "2027" }],
  [[2027, 0, 4, 12, 0], { week: "1", dd: "04", d: "4", year: "2027" }],
  [[2025, 11, 29, 12, 0], { week: "1", dd: "29", d: "29", year: "2025" }],
  [[2026, 0, 1, 12, 0], { week: "1", dd: "01", d: "1", year: "2026" }],
  [[2021, 0, 3, 12, 0], { week: "53", dd: "03", d: "3", year: "2021" }],
  [[2026, 4, 3, 23, 30], { week: "18", dd: "03", d: "3", year: "2026" }],
  [[2026, 4, 4, 0, 0], { week: "19", dd: "04", d: "4", year: "2026" }],
  [[2026, 4, 4, 0, 30], { week: "19", dd: "04", d: "4", year: "2026" }],
  [[2026, 4, 9, 12, 0], { week: "19", dd: "09", d: "9", year: "2026" }],
  [[2026, 4, 10, 12, 0], { week: "19", dd: "10", d: "10", year: "2026" }],
];

const TRACER_DATES = [
  [2026, 4, 4, 12, 0],
  [2027, 0, 1, 12, 0],
];

async function checkBoundaries() {
  const mod = await loadBundle();
  for (const [[y, m0, d, h, min], expected] of BOUNDARY_CASES) {
    assert.deepEqual(
      mod.getEventDateVariables(new Date(y, m0, d, h, min)),
      expected,
      `boundary case ${y}-${m0 + 1}-${d} ${h}:${min}`
    );
  }
}

async function checkPrecision() {
  const mod = await loadBundle();
  const dates = [...BOUNDARY_CASES.map(([parts]) => parts), ...TRACER_DATES];
  for (const [y, m0, d, h, min] of dates) {
    const label = `${y}-${m0 + 1}-${d} ${h}:${min}`;
    const v = mod.getEventDateVariables(new Date(y, m0, d, h, min));
    assert.match(v.week, /^[1-9][0-9]*$/, `week precision ${label}`);
    assert.match(v.d, /^[1-9][0-9]*$/, `d precision ${label}`);
    assert.match(v.dd, /^[0-9]{2}$/, `dd precision ${label}`);
    assert.match(v.year, /^[0-9]{4}$/, `year precision ${label}`);
  }
}

async function checkAdjacency() {
  const mod = await loadBundle();
  const event = makeEvent(2026, 4, 4, 12, 0);
  // Pre-existing UTC-based {{date}} value (A-UTC): expected unchanged, not "fixed".
  const iso = event.start.toISOString().split("T")[0];

  const body = await createNote(
    mod,
    patch({
      defaultFrontmatter: "",
      defaultTags: [],
      noteTemplate:
        "{{d}} {{dd}} {{date}}|{{d}}{{dd}}|{{ d }} {{D}} {{ddd}}|{{week}}{{year}}",
    }),
    event
  );
  assert.equal(
    bodyOf(body.content),
    `4 04 ${iso}|404|{{ d }} {{D}} {{ddd}}|192026`
  );

  const fm = await createNote(
    mod,
    patch({
      defaultFrontmatter: "---\nline: {{d}}{{dd}} {{week}}\n---",
      defaultTags: [],
      noteTemplate: "",
    }),
    event
  );
  assert.ok(
    fm.content.split("\n").includes("line: 404 19"),
    `frontmatter adjacency line missing in:\n${fm.content}`
  );
}

async function checkSanitizedTitle() {
  const mod = await loadBundle();
  const note = await createNote(
    mod,
    patch({ noteTitleFormat: "{{year}}-W{{week}} {{dd}} {{event_title}}" }),
    makeEvent(2026, 4, 4, 12, 0, { title: "a/b:c*?" })
  );
  const name = basename(note.path);
  assert.equal(name, "2026-W19 04 a-b-c--.md");
  assert.doesNotMatch(name, /[\\/:*?"<>|]/);
}

// WR-05 / IN-04: remote values are inserted literally in one pass, so `$`
// replacement patterns are not expanded and `{{...}}` inside a value is kept.
async function checkLiteralSubstitution() {
  const mod = await loadBundle();
  const note = await createNote(
    mod,
    patch({
      noteTitleFormat: "{{event_title}} {{dd}}",
      noteTemplate: "{{event_title}}|{{description}}\nEND",
      defaultFrontmatter: "---\ntitle: {{event_title}}\n---",
      defaultTags: [],
    }),
    makeEvent(2026, 4, 4, 12, 0, {
      title: "Budget $$5 and $& {{week}}",
      description: "see $' here",
    })
  );
  assert.equal(basename(note.path), "Budget $$5 and $& {{week}} 04.md");
  assert.equal(
    bodyOf(note.content),
    "Budget $$5 and $& {{week}}|see $' here\nEND"
  );
  assert.ok(
    note.content.split("\n").includes("title: Budget $$5 and $& {{week}}"),
    `frontmatter title not literal in:\n${note.content}`
  );
}

async function checkDateFormatIndependence() {
  const mod = await loadBundle();
  const event = makeEvent(2026, 4, 4, 12, 0);
  const template = "{{dd}}|{{d}}|{{year}}|{{week}}";
  const us = await createNote(
    mod,
    patch({ noteDateFormat: "US", noteTemplate: template }),
    event
  );
  const iso = await createNote(
    mod,
    patch({ noteDateFormat: "ISO", noteTemplate: template }),
    event
  );
  assert.equal(bodyOf(us.content), "04|4|2026|19");
  assert.equal(bodyOf(iso.content), bodyOf(us.content));
}

async function checkParity() {
  const current = await loadBundle();
  const baseline = await loadBundle("1.15.0");

  const tokenText = {
    description: "Agenda {{week}} {{d}}",
    location: "Room {{year}}",
    attendees: ["Ann {{dd}}"],
  };

  const corpus = [
    { name: "a-defaults", settings: patch(), extra: {} },
    {
      name: "b-existing-vars-with-token-text",
      settings: patch({
        noteTitleFormat: "{{start_date}} {{day}} {{month}} {{event_title}}",
        noteTemplate:
          "{{date}} {{date-iso}} {{start_time}}-{{end_time}} {{day}} {{month}} {{source}} {{description}} {{location}} {{attendees}}",
      }),
      extra: tokenText,
    },
    {
      name: "c-per-calendar-override",
      settings: {
        calendarUrls: [
          workCalendar({
            notesSettings: {
              useCustomSettings: true,
              noteTitleFormat: "{{event_title}} {{source}}",
              defaultFrontmatter: "---\nkind: meeting\n---",
            },
          }),
        ],
      },
      extra: {},
    },
  ];

  // No top-level tags key (D-02, D-08): output must stay byte-identical to
  // 1.15.0, with and without calendar tags on the Work source.
  const noKeyBodies = [
    ["d-empty", null],
    ["e-type-only", "type: event"],
    ["f-tag-Tags-nested", "tag: a\nTags: b\nnested:\n  tags: c"],
    ["g-commented-tags", "a: 1\n# tags: x\nb: 2"],
  ];
  for (const [label, body] of noKeyBodies) {
    for (const sourceTags of [[], ["x"]]) {
      corpus.push({
        name: `${label} sourceTags=[${sourceTags.join(",")}]`,
        settings: {
          calendarUrls: [workCalendar({ tags: sourceTags })],
          defaultFrontmatter: body === null ? "" : `---\n${body}\n---`,
        },
        extra: {},
      });
    }
  }

  for (const { name, settings, extra } of corpus) {
    for (const [y, m0, d, h, min] of TRACER_DATES) {
      const ev = () => makeEvent(y, m0, d, h, min, extra);
      assert.deepEqual(
        await createNote(current, settings, ev()),
        await createNote(baseline, settings, ev()),
        `parity ${name} ${y}-${m0 + 1}-${d}`
      );
    }
  }
}

async function checkTagsTracer() {
  const mod = await loadBundle();

  // T1: block list, items appended after the last item with the same indent.
  await expectTags(
    "T1",
    ["type: event", "tags:", "  - a", "  - b", "date: 2026-05-04"],
    [
      "type: event",
      "tags:",
      "  - a",
      "  - b",
      "  - event",
      "  - meeting",
      "  - Work",
      "date: 2026-05-04",
    ]
  );
  // T2: indentless (column-0) block list.
  await expectTags(
    "T2",
    ["type: event", "tags:", "- a", "date: x"],
    ["type: event", "tags:", "- a", "- event", "- meeting", "- Work", "date: x"]
  );
  // T3: empty key at the end.
  await expectTags(
    "T3",
    ["type: event", "tags:"],
    ["type: event", "tags:", "  - event", "  - meeting", "  - Work"]
  );
  // T4: empty key directly followed by another key.
  await expectTags(
    "T4",
    ["tags:", "date: x"],
    ["tags:", "  - event", "  - meeting", "  - Work", "date: x"]
  );
  // T5: every calendar tag dedups against a user tag (quotes, #, case).
  await expectTags(
    "T5",
    ["tags:", '  - "Event"', "  - '#meeting'", "  - work"],
    ["tags:", '  - "Event"', "  - '#meeting'", "  - work"]
  );
  // T6: comments and blank lines inside the block are kept.
  await expectTags(
    "T6",
    ["tags:", "  - a # mine", "", "  # c", "  - b", "next: 1"],
    ["tags:", "  - a # mine", "", "  # c", "  - b", "  - c", "next: 1"],
    { defaultTags: ["c"], sourceTags: [] }
  );

  // T7: the shipped 1.15.0 defaults (no tags key) keep the appended block.
  const event = makeEvent(2026, 4, 4, 12, 0);
  const iso = event.start.toISOString().split("T")[0];
  const t7 = frontmatterOf(
    (
      await createNote(
        mod,
        patch({
          defaultFrontmatter: mod.DEFAULT_SETTINGS.defaultFrontmatter,
          defaultTags: ["event", "meeting"],
        }),
        event
      )
    ).content
  );
  assert.equal(
    t7,
    ["type: event", `date: ${iso}`, "tags:", "  - event", "  - meeting"].join("\n"),
    "tag fixture T7"
  );
  assertSingleTagsKey(t7, "T7");

  // T8: no tags key -> 1.15.0 append.
  await expectTags(
    "T8",
    ["type: event", "date: x"],
    ["type: event", "date: x", "tags:", "  - event", "  - meeting", "  - Work"]
  );
  // T8b (WR-03, D-02 amendment): the no-key append quotes tags that are not
  // plain YAML strings; ordinary tags stay unquoted as in 1.15.0.
  const t8b = await expectTags(
    "T8b",
    ["type: event"],
    ["type: event", "tags:", '  - "#meeting"', '  - "a: b"', "  - work"],
    { defaultTags: ["#meeting", "a: b", "work"], sourceTags: [] }
  );
  assert.deepEqual(YAML.parse(t8b).tags, ["#meeting", "a: b", "work"]);
  assert.deepEqual(jsyaml.load(t8b).tags, ["#meeting", "a: b", "work"]);
  // T9: per-calendar default frontmatter replaces the global one (D-09).
  await expectTags("T9", ["tags: [g]"], ["tags:", "  - p", "  - event"], {
    defaultTags: ["event"],
    sourceTags: [],
    notesSettings: {
      useCustomSettings: true,
      defaultFrontmatter: "---\ntags:\n  - p\n---",
    },
  });
  // T10: no calendar tags -> frontmatter untouched.
  await expectTags("T10", ["tags:", "  - a"], ["tags:", "  - a"], {
    defaultTags: [],
    sourceTags: [],
  });
  // T11: calendar tags that are not plain-safe are quoted in a block list.
  await expectTags(
    "T11",
    ["tags:", "  - a"],
    ["tags:", "  - a", '  - "#urgent"', '  - "a: b"'],
    { defaultTags: ["#urgent", "a: b"], sourceTags: [] }
  );
  // T12 (WR-01): tags YAML would read as a mapping, boolean or number are quoted
  // in both block and flow form, and every merged tag parses as a string.
  const typed = { defaultTags: ["foo:", "true", "123"], sourceTags: [] };
  const t12 = await expectTags(
    "T12",
    ["tags:", "  - a"],
    ["tags:", "  - a", '  - "foo:"', '  - "true"', '  - "123"'],
    typed
  );
  const t12f = await expectTags(
    "T12f",
    ["tags: [a]"],
    ['tags: [a, "foo:", "true", "123"]'],
    typed
  );
  for (const fm of [t12, t12f]) {
    assert.deepEqual(YAML.parse(fm).tags, ["a", "foo:", "true", "123"]);
    assert.deepEqual(jsyaml.load(fm).tags, ["a", "foo:", "true", "123"]);
  }

  // Direct unit sanity on the exported helpers.
  assert.equal(mod.normalizeTag(' "#Work" '), "work");
  assert.equal(mod.yamlSafeTag("work", true), "work");
  assert.equal(mod.yamlSafeTag("a,b", true), '"a,b"');
  assert.equal(mod.yamlSafeTag("a,b", false), "a,b");
  assert.deepEqual(mod.mergeCalendarTags("type: event", ["x"]), {
    found: false,
    content: "type: event",
  });
}

async function checkTagsShapes() {
  const one = (tags) => ({ defaultTags: tags, sourceTags: [] });

  // Inline arrays (D-01): new tags inserted before the closing bracket.
  await expectTags(
    "F1",
    ["type: event", "tags: [a, b]", "date: x"],
    ["type: event", "tags: [a, b, event, meeting, Work]", "date: x"]
  );
  await expectTags(
    "F2",
    ["tags: []", "date: x"],
    ["tags: [event, meeting, Work]", "date: x"]
  );
  await expectTags("F3", ["tags: [a, b,]"], ["tags: [a, b, event, meeting, Work]"]);
  await expectTags(
    "F4",
    ['tags: ["x, y", b] # c'],
    ['tags: ["x, y", b, event, meeting, Work] # c']
  );

  // Scalars and legacy comma scalars become an inline array (D-01).
  await expectTags(
    "F5",
    ["tags: a", "date: x"],
    ["tags: [a, event, meeting, Work]", "date: x"]
  );
  await expectTags("F6", ["tags: a, b"], ["tags: [a, b, event, meeting, Work]"]);

  // Null-ish values and a comment-only value become a block list.
  await expectTags(
    "F7",
    ["tags: ~", "date: x"],
    ["tags:", "  - event", "  - meeting", "  - Work", "date: x"]
  );
  await expectTags("F8", ["tags: ''"], ["tags:", "  - c"], one(["c"]));
  await expectTags(
    "F9",
    ["tags: #a", "date: x"],
    ["tags: #a", "  - event", "  - meeting", "  - Work", "date: x"]
  );

  // Dedup against user tags (D-05) and quoted keys (A3).
  await expectTags(
    "F10",
    ["tags: [event, meeting, work]"],
    ["tags: [event, meeting, work]"]
  );
  await expectTags(
    "F11",
    ['"tags": [a]'],
    ['"tags": [a, event, meeting, Work]']
  );
  await expectTags("F12", ["'tags' : a"], ["'tags' : [a, c]"], one(["c"]));

  // Order and user form are kept (D-04, D-06).
  await expectTags("F13", ["tags: [Work, a]"], ["tags: [Work, a, event, meeting]"], {
    defaultTags: ["event", "meeting"],
    sourceTags: ["work"],
  });
  await expectTags(
    "F14",
    [`tags: ["a", 'b']`],
    [`tags: ["a", 'b', c]`],
    one(["A", "B", "c"])
  );

  // Calendar tags that are not plain-safe are quoted in flow form (A2).
  const unsafe = one(["#urgent", "a: b"]);
  await expectTags("F15a", ["tags: [a]"], ['tags: [a, "#urgent", "a: b"]'], unsafe);
  await expectTags("F15b", ["tags: a"], ['tags: [a, "#urgent", "a: b"]'], unsafe);

  // Leading whitespace kept; whitespace before a trailing comment collapses (D-10).
  await expectTags(
    "F16",
    ["tags:   [a]   # keep"],
    ["tags:   [a, b] # keep"],
    one(["b"])
  );

  // Only a column-0 `tags` key merges: `tag:` keeps the 1.15.0 append (D-08).
  await expectTags(
    "F17",
    ["tag: a"],
    ["tag: a", "tags:", "  - event", "  - meeting", "  - Work"]
  );

  // The merge runs after template-variable substitution (D-07).
  await expectTags("F18", ["tags: [{{source}}]"], ["tags: [Work, event]"], {
    defaultTags: ["event"],
    sourceTags: ["work"],
  });

  // Backslash escapes inside double quotes do not end the string (WR-02).
  await expectTags(
    "F19",
    ['tags: "a\\" #b"'],
    ['tags: ["a\\" #b", c]'],
    one(["c"])
  );
  await expectTags(
    "F20",
    ['tags: ["a\\", b", x]'],
    ['tags: ["a\\", b", x, c]'],
    one(["c"])
  );
  await expectTags(
    "F21",
    ["tags:", '  - "a\\" #b" # note'],
    ["tags:", '  - "a\\" #b" # note', "  - c"],
    one(["c"])
  );

  // Shapes the merger cannot edit safely stay byte-identical (D-03).
  const unsafeShapes = [
    ["U1", ["tags: [a,", "  b]", "date: x"]],
    ["U2", ["tags: {a: 1}"]],
    ["U3", ["tags: |", "  a"]],
    ["U4", ["tags: &x [a]"]],
    ["U5", ["tags:", "  - a", "    - b"]],
  ];
  for (const [label, lines] of unsafeShapes) {
    await expectTags(label, lines, lines);
  }
  const u6 = ["tags: a", "x: 1", "tags: b"];
  const u6fm = await expectTags("U6", u6, u6, { single: false });
  assert.equal(
    u6fm.split("\n").filter((l) => /^(["']?)tags\1[ \t]*:/.test(l)).length,
    2,
    "U6 keeps exactly its two user-written tags lines"
  );
}

const CHECKS = [
  checkTracer,
  checkBoundaries,
  checkPrecision,
  checkAdjacency,
  checkSanitizedTitle,
  checkLiteralSubstitution,
  checkDateFormatIndependence,
  checkParity,
  checkTagsTracer,
  checkTagsShapes,
];

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
  // Optional debugging filter: VERIFY09_ONLY=checkBoundaries,checkParity
  const only = (process.env.VERIFY09_ONLY ?? "").split(",").filter(Boolean);
  const selected = only.length
    ? CHECKS.filter((check) => only.includes(check.name))
    : CHECKS;
  for (const check of selected) {
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
