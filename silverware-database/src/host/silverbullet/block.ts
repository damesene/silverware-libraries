// A `silverware-database` block's text: a place's state (docs/silverware-database.md,
// *The pages store*, the block), one key a line: `id: tasks`, `view: board`,
// `board.groupBy: status`; a value a YAML scalar, or JSON where it is a list
// or a map (`board.filter: {"status": "!=Done"}`), so the block stays
// readable and a diff of it small. A line it does not read (typed by hand) is
// kept as written, as are the lines of keys a write leaves alone.
import { readScalar, yamlString } from "../../../../shared/yaml/scalar.ts";
import type { ViewStateStore } from "../../core/store.ts";

/** The block's language: the code widget it is shown by */
export const BLOCK_LANGUAGE = "silverware-database";

// A line of the block: a key's (its value read) or one kept as written (blank, a comment, one not read)
type Line = { readonly raw: string; readonly key?: string; readonly value?: unknown };

const LINE_RE = /^([A-Za-z_][\w.-]*)\s*:\s?(.*)$/;

/** A line's value: JSON where it is a list or a map, else a YAML scalar; undefined where it reads as neither */
function valueOf(text: string): { readonly value: unknown } | undefined {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return { value: JSON.parse(trimmed) };
    } catch {
      return undefined;
    }
  }
  const read = readScalar(trimmed);
  return read && { value: read.value };
}

/** A block's lines read */
function linesOf(body: string): Line[] {
  if (!body.trim()) return [];
  return body.split(/\r?\n/).map((raw): Line => {
    const match = LINE_RE.exec(raw.trim());
    if (!match || /^\s*#/.test(raw)) return { raw };
    const read = valueOf(match[2]!);
    return read ? { raw, key: match[1]!, value: read.value } : { raw };
  });
}

/** A value as the block writes it */
function written(key: string, value: unknown): string {
  if (value !== null && typeof value === "object") return `${key}: ${JSON.stringify(value)}`;
  return `${key}: ${typeof value === "string" ? yamlString(value) : String(value)}`;
}

/** The block's values by key (a key written twice: its first line) */
export function readBlock(body: string): ReadonlyMap<string, unknown> {
  const values = new Map<string, unknown>();
  for (const line of linesOf(body)) if (line.key !== undefined && !values.has(line.key)) values.set(line.key, line.value);
  return values;
}

/**
 * The block with `values` written (undefined: the key's line goes), every other line as it was, new keys at its end; a key
 * written there twice (typed by hand) written once, in its first line's place, its other lines gone (else one left would
 * be read back: a key taken away coming back with its old value)
 */
export function writeBlock(body: string, values: Readonly<Record<string, unknown>>): string {
  const lines = linesOf(body);
  const done = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (line.key === undefined || !(line.key in values)) {
      out.push(line.raw);
      continue;
    }
    if (done.has(line.key)) continue;
    done.add(line.key);
    const value = values[line.key];
    if (value !== undefined) out.push(written(line.key, value));
  }
  for (const [key, value] of Object.entries(values)) if (!done.has(key) && value !== undefined) out.push(written(key, value));
  return out.join("\n");
}

/**
 * A place's state as its block keeps it: read from the block's text as
 * rendered, written by `write` (the page writer: the block written anew where
 * it is still as read), which renders the place anew in SilverBullet
 */
export class BlockState implements ViewStateStore {
  private values: ReadonlyMap<string, unknown>;

  constructor(
    private body: string,
    private readonly write: (body: string, text: string) => Promise<boolean>,
  ) {
    this.values = readBlock(body);
  }

  get(key: string): unknown {
    return this.values.get(key);
  }

  keys(): readonly string[] {
    return [...this.values.keys()];
  }

  async set(values: Readonly<Record<string, unknown>>): Promise<void> {
    const text = writeBlock(this.body, values);
    if (text === this.body) return;
    // Written, the block is what it holds now (a block changed meanwhile is left, and so is this state)
    if (await this.write(this.body, text)) {
      this.body = text;
      this.values = readBlock(text);
    }
  }
}
