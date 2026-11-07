// The host's side of the sources of the space, apart from the rest of
// Silverware Table, which knows nothing of Lua: `silverware.table.defineSource`
// (the API page) gives a Space Lua function by a name; it is called (a Lua
// function called from JS gives a Promise: it may await SilverBullet) as it is
// defined, and again REFRESH_MS after the last page SilverBullet indexed (the
// index it reads may have changed), all side by side. What it gives, a Lua
// table of records or of values, is made plain data here (`sourceData`), and
// the rest reads it through `SourceProvider` (src/sources.ts).
import { listOf } from "../bridge.ts";
import { tableNameProblem } from "../namerules.ts";
import type { SourceData, SourceProvider } from "../sources.ts";

/** How long after the last page indexed the sources are read again; after Space Lua loaded, how long its definitions of before stay */
export const REFRESH_MS = 1000;

type Definition = { readonly name: string; readonly fn: () => unknown; readonly columns?: readonly string[] };

/** A value of a source's cell as text: numbers and texts as they are, TRUE/FALSE, a list its values joined by ", ", nil and an object empty */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (typeof value === "object") {
    const items = listOf(value);
    // A list (tags, people): its values; an object (no form a cell could show) or a list of them: empty
    return items
      .filter((item) => item !== null && item !== undefined && typeof item !== "object")
      .map(cellText)
      .filter((text) => text !== "")
      .join(", ");
  }
  return "";
}

/** Whether a value is a record: a Lua table of keys (an empty one too), not a list */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && listOf(value).length === 0;
}

/**
 * A source's data from what its function gave: a list (a Lua table) of
 * records, each a row, its columns the first record's keys then those new in
 * later ones (Space Lua keeps a table's keys in the order they were set), or
 * `columns` where given; or a list of values, one column `value`. Why not,
 * where it is neither.
 */
export function sourceData(given: unknown, columns?: readonly string[]): SourceData | { readonly problem: string } {
  const notList = { problem: "gave no list (return a query's result, or a list of values)" };
  if (!Array.isArray(given) && (!given || typeof given !== "object")) return notList;
  const items = listOf(given).filter((item) => item !== null && item !== undefined);
  if (!items.length && Object.keys(given as object).length) return notList;
  const records = items.filter(isRecord);
  if (records.length && records.length < items.length) return { problem: "gave a list of both records and values (select { … } for every row, or one field)" };
  if (records.length) {
    const keys = columns ?? [...new Set(records.flatMap((record) => Object.keys(record)))];
    return { columns: keys, rows: records.map((record) => keys.map((key) => cellText(record[key]))) };
  }
  if (items.some((item) => typeof item === "object")) return { problem: "gave a list of lists (select { … } for every row, or one field)" };
  // (Nothing given: no columns known, but those asked for)
  if (!items.length) return { columns: columns ?? [], rows: [] };
  return { columns: columns ?? ["value"], rows: items.map((item) => [cellText(item)]) };
}

/** Whether two sources' data are the same */
function sameData(a: SourceData, b: SourceData): boolean {
  return (
    a.columns.length === b.columns.length &&
    a.columns.every((c, i) => c === b.columns[i]) &&
    a.rows.length === b.rows.length &&
    a.rows.every((row, r) => row.length === b.rows[r]!.length && row.every((cell, c) => cell === b.rows[r]![c]))
  );
}

/** The sources Space Lua defines, read through SilverBullet: SilverBullet's SourceProvider */
export class LuaSources implements SourceProvider {
  // By the name in lower case (names are compared ignoring case)
  private readonly definitions = new Map<string, Definition>();
  // What each source read last, kept where its function fails (a mistake in it, the index not ready)
  private readonly lastRead = new Map<string, SourceData>();
  // The problem last said for each source: said again only when it changes
  private readonly said = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  // Space Lua loaded again and no script has defined a source since: the definitions of before still read
  // (else a reading meanwhile dropped every source and the formulas reading them showed errors for a moment)
  private stale = false;
  // Once a script of the new load defines one: the names of before not defined again yet, unread (not gone) until
  // they are or REFRESH_MS has passed since the load, so a table reading one keeps its results meanwhile
  private previous = new Map<string, string>();
  private staleTimer: ReturnType<typeof setTimeout> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private reading: Promise<void> | undefined;
  private again = false;
  // Who a problem is said to: none before init (said then, as the sources are read again)
  private problem: ((message: string) => void) | undefined;

  /** A problem of a source is said through `problem` from now on; every source is read again */
  connect(problem: (message: string) => void): void {
    this.problem = problem;
    if (this.definitions.size) this.schedule(0);
  }

  names(): readonly string[] {
    const names = new Map([...this.previous, ...[...this.definitions].map(([key, d]): [string, string] => [key, d.name])]);
    return [...names.values()];
  }

  read(name: string): SourceData | undefined {
    return this.definitions.has(name.toLowerCase()) ? this.lastRead.get(name.toLowerCase()) : undefined;
  }

  changed(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /**
   * `silverware.table.defineSource({ name, data, columns })`: a source by its
   * name, its rows what the function `data` gives, `columns` (optional) its
   * columns; why not, else undefined (`query` would not do: Space Lua reads
   * `query = …` as its query syntax, a syntax error)
   */
  define(definition: unknown): string | undefined {
    const usage = 'give a table: { name = "tasks", data = function() … end, columns = { "name", "due" } } (columns optional)';
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) return `Silverware Table: source not defined: ${usage}.`;
    const { name, data, columns: list, ...rest } = definition as Record<string, unknown>;
    const given = typeof name === "string" ? name.trim() : "";
    const problem = given ? tableNameProblem(given) : "it is empty";
    if (problem) return `Silverware Table: source not defined: "${String(name ?? "")}" is no source's name: ${problem}.`;
    const unknown = Object.keys(rest);
    if (unknown.length) return `Silverware Table: source ${given} not defined: it knows no ${unknown.join(", ")} (name, data, columns).`;
    if (typeof data !== "function") return `Silverware Table: source ${given} not defined: its data is a function that returns its rows.`;
    let columns: string[] | undefined;
    if (list !== undefined && list !== null) {
      const items = listOf(list);
      if (!items.length || items.some((item) => typeof item !== "string" || !item.trim())) {
        return `Silverware Table: source ${given} not defined: its columns are their names in their order, { "name", "due" }.`;
      }
      columns = (items as string[]).map((c) => c.trim());
    }
    const fn = data;
    // The first definition of a new load of Space Lua: those of before go (their names unread meanwhile)
    if (this.stale) {
      this.previous = new Map([...this.definitions].map(([key, d]) => [key, d.name]));
      this.stale = false;
      this.definitions.clear();
    }
    this.previous.delete(given.toLowerCase());
    this.definitions.set(given.toLowerCase(), { name: given, fn: fn as () => unknown, ...(columns ? { columns } : {}) });
    this.tell();
    this.schedule(0);
    return undefined;
  }

  /**
   * Space Lua is loaded again: its scripts define the sources anew. The
   * definitions of before read until the first of them, or for REFRESH_MS
   * where no script defines one any more (then the sources go)
   */
  anew(): void {
    this.stale = true;
    if (this.staleTimer !== undefined) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      this.staleTimer = undefined;
      // No script defined one: those of before go; else the names of before not defined again
      if (this.stale) this.endStale();
      this.previous.clear();
      for (const key of [...this.lastRead.keys()]) if (!this.definitions.has(key)) this.lastRead.delete(key);
      this.tell();
    }, REFRESH_MS);
  }

  /** SilverBullet indexed a page: the sources are read again, a while after the last one */
  indexed(): void {
    if (this.definitions.size) this.schedule(REFRESH_MS);
  }

  /** Every source read anew (one reading at a time: one asked for meanwhile follows it) */
  refresh(): Promise<void> {
    if (this.reading) {
      this.again = true;
      return this.reading;
    }
    this.reading = (async () => {
      do {
        this.again = false;
        await this.readAll();
      } while (this.again);
    })().finally(() => (this.reading = undefined));
    return this.reading;
  }

  /** Tests: nothing defined, nothing read */
  reset(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.reading = undefined;
    this.again = false;
    this.endStale();
    this.previous.clear();
    this.lastRead.clear();
    this.said.clear();
    this.listeners.clear();
    this.problem = undefined;
  }

  private endStale(): void {
    this.stale = false;
    if (this.staleTimer !== undefined) clearTimeout(this.staleTimer);
    this.staleTimer = undefined;
    this.definitions.clear();
  }

  private tell(): void {
    for (const listener of this.listeners) listener();
  }

  private schedule(delay: number): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.refresh();
    }, delay);
  }

  /** What one source's function gave: its data, or why none */
  private async readOne({ name, fn, columns }: Definition): Promise<SourceData | { readonly problem: string }> {
    try {
      const read = sourceData(await fn(), columns);
      return "problem" in read ? { problem: `Silverware Table: the source ${name} ${read.problem}.` } : read;
    } catch (e) {
      return { problem: `Silverware Table: the source ${name} failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  private async readAll(): Promise<void> {
    // The functions are independent: run side by side
    const defined = [...this.definitions];
    const results = await Promise.all(defined.map(([, definition]) => this.readOne(definition)));
    let changed = false;
    defined.forEach(([key], i) => {
      let result = results[i]!;
      // Defined anew meanwhile (another load of Space Lua): its own reading follows
      if (this.definitions.get(key) !== defined[i]![1]) return;
      if (!("problem" in result)) {
        this.said.delete(key);
        const was = this.lastRead.get(key);
        // Nothing given now: the columns read before kept (a query that may give no rows: its columns still known)
        if (!result.rows.length && !defined[i]![1].columns && was) result = { columns: was.columns, rows: [] };
        if (!was || !sameData(was, result)) {
          this.lastRead.set(key, result);
          changed = true;
        }
        return;
      }
      // Said once until it changes; not counted as said before there is anyone to say it to (init not run yet)
      if (this.problem && this.said.get(key) !== result.problem) {
        this.problem(result.problem);
        this.said.set(key, result.problem);
      }
    });
    // What no source of these names reads any more goes
    for (const key of [...this.lastRead.keys()]) {
      if (!this.definitions.has(key)) {
        this.lastRead.delete(key);
        changed = true;
      }
    }
    if (changed) this.tell();
  }
}
