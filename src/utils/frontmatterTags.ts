// Line-scanning merger for calendar tags in user-authored default frontmatter.
//
// User frontmatter is never parsed and re-serialized: only the lines that belong
// to the top-level `tags` key may change, so key order, comments, quoting and
// every other value stay byte-identical. Any `tags` shape this scanner cannot
// edit safely is left untouched and the calendar tags are skipped, so a second
// `tags` key is never emitted (a duplicate key is invalid YAML).

// Module-private regex matching a column-0 `tags` key, optionally wrapped in a
// matching pair of quotes ("tags": / 'tags':). Groups: 1 = key part up to and
// including the colon, 2 = the quote character (or ""), 3 = the raw value.
// It deliberately does not match `tag:`, `Tags:` or indented (nested) keys.
const TAGS_KEY_LINE = /^((["']?)tags\2[ \t]*:)(.*)$/;

// Module-private set of scalar values YAML reads as null or empty. A `tags` key
// holding one of these is treated like an empty key and receives a block list.
const NULL_VALUES = new Set(["~", "null", "Null", "NULL", '""', "''"]);

// Module-private regex for plain scalars that YAML resolves to a non-string
// type (null, boolean, integer, float, infinity/NaN) under the core schema, or
// to a timestamp under js-yaml's default schema. A calendar tag matching it
// must be quoted so it stays a string.
const NON_STRING_SCALAR =
  /^(?:~|null|Null|NULL|true|True|TRUE|false|False|FALSE|[-+]?(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][-+]?\d+)?|[-+]?0b[01_]+|[-+]?0o[0-7_]+|[-+]?0x[0-9a-fA-F_]+|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN)|\d{4}-\d\d?-\d\d?(?:[Tt ].*)?)$/;

// Module-private regex for a block sequence item: indent, dash, optional value.
const BLOCK_ITEM_LINE = /^([ \t]*)-(?:[ \t]+(.*))?$/;

// Module-private regex for lines that still belong to the `tags` value: blank,
// indented, a column-0 "- " item (indentless list) or a column-0 comment.
const TAGS_REGION_LINE = /^(\s*$|[ \t]|-(\s|$)|#)/;

/** Result of merging calendar tags into a frontmatter body. */
export interface TagMergeResult {
  /** true when a top-level `tags` key exists (merged, already complete, or left untouched as unsafe) */
  found: boolean;
  /** The frontmatter body, merged or unchanged */
  content: string;
}

/**
 * Normalize a tag for duplicate detection: trim, strip one matching pair of
 * surrounding quotes, strip leading `#` characters, trim again and lowercase.
 * @param tag The tag as written by the user or configured on the calendar
 * @returns The normalized comparison key
 */
export function normalizeTag(tag: string): string {
  let t = tag.trim();
  if (
    t.length >= 2 &&
    (t[0] === '"' || t[0] === "'") &&
    t[t.length - 1] === t[0]
  ) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/^#+/, "").trim().toLowerCase();
}

/**
 * Split a YAML value into its body and trailing comment. A comment starts at a
 * `#` that is at index 0 or preceded by whitespace, outside quotes.
 * @param value The raw value text after the key's colon
 * @returns [body (right-trimmed), comment (including the leading `#`, or "")]
 */
export function splitComment(value: string): [string, string] {
  let quote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) {
      if (quote === '"' && c === "\\") {
        // Backslash escape inside a double-quoted scalar: skip the next char.
        i++;
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
      return [value.slice(0, i).trimEnd(), value.slice(i)];
    }
  }
  return [value.trimEnd(), ""];
}

/**
 * Split flow-sequence text on commas outside single or double quotes. Items are
 * trimmed and empty items dropped, which also absorbs a trailing comma.
 * @param text The text inside the brackets, or a plain scalar value
 * @returns The items, or null on an unquoted [ ] { } or an unterminated quote
 */
function splitFlowItems(text: string): string[] | null {
  const items: string[] = [];
  let quote: string | null = null;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      current += c;
      if (quote === '"' && c === "\\") {
        // Backslash escape inside a double-quoted scalar: keep the escaped
        // character as-is so an escaped `"` does not close the string.
        if (i + 1 < text.length) {
          current += text[i + 1];
          i++;
        }
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      current += c;
      continue;
    }
    if ("[]{}".includes(c)) {
      return null;
    }
    if (c === ",") {
      items.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  if (quote) {
    return null;
  }
  items.push(current.trim());
  return items.filter((item) => item.length > 0);
}

/**
 * Quote a calendar tag only when it would not parse as a plain YAML string
 * (indicator characters, `: `/trailing `:`, ` #`, or a null/bool/number form).
 * Ordinary tags are returned unchanged.
 * @param tag The calendar tag to write
 * @param flow true when the tag is written inside a flow sequence ([a, b])
 * @returns The tag, or its JSON (double-quoted) form when quoting is required
 */
export function yamlSafeTag(tag: string, flow: boolean): string {
  const needsQuote =
    tag !== tag.trim() ||
    NON_STRING_SCALAR.test(tag) ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(tag) ||
    /:(\s|$)|\s#/.test(tag) ||
    (flow && /[,[\]{}]/.test(tag));
  return needsQuote ? JSON.stringify(tag) : tag;
}

/**
 * Merge calendar tags into an existing top-level `tags` key of a frontmatter
 * body (the text between the `---` delimiters). User tags keep their written
 * form and order; calendar tags that are new after normalization are appended
 * in their given order. Only the `tags` key's own lines are edited.
 * @param frontmatter The frontmatter body, after template-variable substitution
 * @param calendarTags The event's calendar tags, in getTagsForEvent order
 * @returns found=false when there is no top-level `tags` key (content unchanged)
 */
export function mergeCalendarTags(
  frontmatter: string,
  calendarTags: string[]
): TagMergeResult {
  const lines = frontmatter.split("\n");
  const keyIdx: number[] = [];
  lines.forEach((line, idx) => {
    if (TAGS_KEY_LINE.test(line)) {
      keyIdx.push(idx);
    }
  });
  if (keyIdx.length === 0) {
    return { found: false, content: frontmatter };
  }
  const untouched: TagMergeResult = { found: true, content: frontmatter };
  if (keyIdx.length > 1) {
    // The user already has duplicate keys: never add another one.
    return untouched;
  }

  const i = keyIdx[0];
  const match = TAGS_KEY_LINE.exec(lines[i]);
  if (!match) {
    return untouched;
  }
  const keyPart = match[1];
  const rawValue = match[3];
  const leadingWs = rawValue.slice(
    0,
    rawValue.length - rawValue.trimStart().length
  );
  const [body0, comment] = splitComment(rawValue.slice(leadingWs.length));
  const body = body0.trim();
  const commentSuffix = comment ? ` ${comment}` : "";

  let end = i + 1;
  while (end < lines.length && TAGS_REGION_LINE.test(lines[end])) {
    end++;
  }
  const region = lines.slice(i + 1, end);

  const seen = new Set<string>();
  const pickNew = (existing: string[]): string[] => {
    existing.forEach((tag) => seen.add(normalizeTag(tag)));
    const out: string[] = [];
    for (const tag of calendarTags) {
      const normalized = normalizeTag(tag);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      out.push(tag);
    }
    return out;
  };

  if (body === "" || NULL_VALUES.has(body)) {
    // Block list or empty key.
    let indent: string | null = null;
    let lastItem = -1;
    const existing: string[] = [];
    for (let k = 0; k < region.length; k++) {
      const line = region[k];
      if (/^\s*$/.test(line) || /^\s*#/.test(line)) {
        continue;
      }
      const item = BLOCK_ITEM_LINE.exec(line);
      if (!item) {
        // Continuation, nested mapping or another unknown shape.
        return untouched;
      }
      if (indent === null) {
        indent = item[1];
      }
      if (item[1] !== indent || body !== "") {
        // Mixed item indents, or a null value followed by items (already invalid).
        return untouched;
      }
      existing.push(splitComment(item[2] ?? "")[0]);
      lastItem = i + 1 + k;
    }
    const add = pickNew(existing);
    if (add.length === 0) {
      return untouched;
    }
    const out = [...lines];
    if (lastItem === -1) {
      // Drop the null-ish value but keep a trailing comment on the key line.
      out[i] = `${keyPart}${commentSuffix}`;
      out.splice(
        i + 1,
        0,
        ...add.map((tag) => `  - ${yamlSafeTag(tag, false)}`)
      );
    } else {
      out.splice(
        lastItem + 1,
        0,
        ...add.map((tag) => `${indent ?? ""}- ${yamlSafeTag(tag, false)}`)
      );
    }
    return { found: true, content: out.join("\n") };
  }

  // A scalar or flow value followed by non-comment lines is a multi-line value.
  if (region.some((line) => !/^\s*$/.test(line) && !/^\s*#/.test(line))) {
    return untouched;
  }
  // Flow mapping, block scalar, anchor, alias or explicit tag.
  if (/^[{|>&*!]/.test(body)) {
    return untouched;
  }

  if (body.startsWith("[")) {
    // Inline array: insert new tags before the closing bracket.
    if (!body.endsWith("]")) {
      return untouched;
    }
    const inner = body.slice(1, -1);
    const items = splitFlowItems(inner);
    if (items === null) {
      return untouched;
    }
    const add = pickNew(items);
    if (add.length === 0) {
      return untouched;
    }
    const head = inner.trimEnd();
    const sep = head.trim() === "" ? "" : head.endsWith(",") ? " " : ", ";
    const added = add.map((tag) => yamlSafeTag(tag, true)).join(", ");
    const out = [...lines];
    out[i] = `${keyPart}${leadingWs}[${head}${sep}${added}]${commentSuffix}`;
    return { found: true, content: out.join("\n") };
  }

  // Scalar, including the legacy comma form: rewrite as an inline array.
  const items = splitFlowItems(body);
  if (items === null) {
    return untouched;
  }
  const add = pickNew(items);
  if (add.length === 0) {
    return untouched;
  }
  const merged = [...items, ...add.map((tag) => yamlSafeTag(tag, true))];
  const out = [...lines];
  out[i] = `${keyPart} [${merged.join(", ")}]${commentSuffix}`;
  return { found: true, content: out.join("\n") };
}
