// The codec against the markdown's operations main wrote with (testing/markdownops.ts): random tables of every form
// the codec reads (escapes, hidden tags, row names, cells past the header, a metadata row with columns' attributes and
// ones of no column, padding, an indent, columns of one name), random edits made both ways, the markdown written
// compared. A difference is a bug or a change made on purpose (listed where the edits are made, left out).
import { describe, expect, it } from "vitest";
import { type ColumnId, columnKey, findColumn } from "../../../../shared/table/columns.ts";
import { headsOf } from "../../columns.ts";
import { escapeCell, parseTable, serializeTable, type Table } from "../../markdown.ts";
import * as model from "../../../../shared/table/ops.ts";
import type { Align, TableModel } from "../../../../shared/table/model.ts";
import { columnsMetaOf, parseColumnAttribute } from "../../meta.ts";
import { cellTags, withoutTags } from "../../tags.ts";
import * as old from "../../testing/markdownops.ts";
import { decode, encode } from "./codec.ts";

/** A random source, the same for a seed (mulberry32) */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ["a", "Pear", "10", "x y", "a \\| b", "\\#n", "**b**", "`c`", "", "3.5", "[[P]]"];
const NAMES = ["Item", "Qty", "Draft", "(draft)", "Qty"];
const ALIGNS = ["---", ":--", "--:", ":-:"];

/** A random table's markdown, and whether a row's name is in a column (main dropped it with its column: left out) */
function tableText(rnd: () => number): { readonly text: string; readonly nameColumns: ReadonlySet<number> } {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)]!;
  const columns = 1 + Math.floor(rnd() * 4);
  const headers = Array.from({ length: columns }, (_, c) => (c > 0 && rnd() < 0.2 ? NAMES[c - 1]! : NAMES[c]!) + (rnd() < 0.15 ? " #currency-usd" : "") + (rnd() < 0.1 ? " <meta note='h'>" : ""));
  // A column's fixed name (one of the table's)
  const fixed = rnd() < 0.15 ? Math.floor(rnd() * columns) : undefined;
  if (fixed !== undefined) headers[fixed] = `${headers[fixed]} <meta core.n='price'>`;
  // A column named in the metadata row: by its fixed name, its key, its key and number, or its text as written
  const id = (c: number): string => {
    const word = headers[c]!.split(" ")[0]!;
    const forms = [columnKey(word), `${columnKey(word)}:1`, word.toLowerCase().replace(/[()]/g, "")];
    if (c === fixed) forms.push("price");
    return pick(forms);
  };
  const nameColumns = new Set<number>();
  const rows = Array.from({ length: Math.floor(rnd() * 5) }, (_, r) => {
    const cells = Array.from({ length: columns }, () => {
      let cell = pick(WORDS);
      if (rnd() < 0.15) cell = `${cell} <meta formulas.f='=1+${r}'>`.trim();
      return cell;
    });
    if (rnd() < 0.25) {
      const c = Math.floor(rnd() * columns);
      cells[c] = `${cells[c]} <meta core.n='r${r}'>`.trim();
      nameColumns.add(c);
    }
    if (rnd() < 0.15) cells.push("extra");
    return cells;
  });
  const meta: string[] = [];
  if (rnd() < 0.5) {
    meta.push("core.table");
    if (rnd() < 0.5) meta.push(`core.-c-${id(0)}.sort='asc'`);
    if (rnd() < 0.4) meta.push(`widths.-c-${id(columns - 1)}.size='90'`);
    if (rnd() < 0.3) meta.push("widths.-c-gone.size='9'");
    if (rnd() < 0.3) meta.push("core.name='t'");
  }
  const indent = rnd() < 0.2 ? "  " : "";
  const pad = rnd() < 0.3;
  const line = (cells: readonly string[]) => `${indent}| ${cells.join(pad ? "  | " : " | ")} |`;
  const lines = [line(headers), `${indent}|${Array.from({ length: columns }, () => pick(ALIGNS)).join("|")}|`, ...rows.map(line)];
  if (meta.length) lines.push(`${indent}| <meta ${meta.join(" ")}> |`);
  return { text: lines.join("\n"), nameColumns };
}

/** A cell's content set as main's editor set it: the text escaped, the cell's tags kept after it */
function oldContent(table: Table, row: number, column: number, content: string): Table {
  const tags = cellTags(table.rows[row]?.cells[column] ?? "");
  return old.setCell(table, row, column, [escapeCell(content), ...tags].filter((part) => part !== "").join(" "));
}

/**
 * The table both ways, where each column of the table read first is now (none: deleted), and where the last edit took
 * each column of the table before it, as the store's `columnMap`
 */
type Both = { old: Table; model: TableModel; columnOf: (column: number) => number | undefined; map?: (column: number) => number | undefined };

/** Where a table is written once after all its edits: the metadata of no column it was read with (none: written after each) */
type Batch = { readonly orphans: readonly ColumnId[] } | undefined;

/** An edit made both ways; none where it cannot be made on this table */
function edit(rnd: () => number, both: Both, nameColumns: ReadonlySet<number>, batch: Batch): { readonly name: string; readonly made: Both } | undefined {
  const t = both.old;
  const m = both.model;
  const columns = m.columns.length;
  const body = m.rows.length;
  const int = (n: number) => Math.floor(rnd() * n);
  const kind = int(10);
  const keep = (made: Table, after: TableModel, map?: (c: number) => number | undefined): Both => ({
    old: map ? old.followColumnMeta(t, made, map) : made,
    model: after,
    columnOf: map ? (c) => { const now = both.columnOf(c); return now === undefined ? undefined : map(now); } : both.columnOf,
    ...(map ? { map } : {}),
  });
  switch (kind) {
    case 0: {
      if (!body) return undefined;
      const r = 1 + int(body);
      const c = int(columns);
      const value = ["z", "new value", "a | b", "#t", "5"][int(5)]!;
      return { name: `content ${r},${c} "${value}"`, made: keep(oldContent(t, r, c, value), model.withContentAt(m, r, c, value)) };
    }
    case 1: {
      const at = 1 + int(body + 1);
      return { name: `insert row ${at}`, made: keep(old.insertRow(t, at), model.insertRow(m, at)) };
    }
    case 2: {
      if (!body) return undefined;
      const r = 1 + int(body);
      return { name: `delete row ${r}`, made: keep(old.deleteRow(t, r), model.deleteRow(m, r)) };
    }
    case 3: {
      if (body < 2) return undefined;
      const from = 1 + int(body);
      const to = 1 + int(body);
      return { name: `move row ${from}→${to}`, made: keep(old.moveRow(t, from, to), model.moveRow(m, from, to)) };
    }
    case 4: {
      if (!body) return undefined;
      const r = 1 + int(body);
      // (A copy of a named row: main kept its name in both; the unique names' rule is the write pipeline's, not here)
      if (/core\.n=/.test(t.rows[r]?.cells.join("") ?? "")) return undefined;
      return { name: `duplicate row ${r}`, made: keep(old.duplicateRow(t, r), model.duplicateRow(m, r)) };
    }
    case 5: {
      const at = int(columns + 1);
      const map = (c: number) => (c >= at ? c + 1 : c);
      const name = old.newColumnName(t);
      return { name: `insert column ${at}`, made: keep(old.insertColumn(t, at), model.withHeader(model.insertColumn(m, at), at, name), map) };
    }
    case 6: {
      if (columns < 2) return undefined;
      const c = int(columns);
      // (A row's name in it: main dropped it with the column, the model keeps it in the row: a change on purpose)
      if ([...nameColumns].some((read) => both.columnOf(read) === c)) return undefined;
      // (A row with cells past the header: main took the deleted column's index of all its cells, past the header too)
      if (t.rows.some((row) => row.cells.length > t.align.length)) return undefined;
      const map = (x: number) => (x === c ? undefined : x > c ? x - 1 : x);
      return { name: `delete column ${c}`, made: keep(old.deleteColumn(t, c), model.deleteColumn(m, c), map) };
    }
    case 7: {
      if (columns < 2) return undefined;
      const from = int(columns);
      const to = int(columns);
      if (from === to) return undefined;
      if (t.rows.some((row) => row.cells.length > t.align.length)) return undefined;
      const map = (c: number) => model.columnAfterMove(c, from, to);
      return { name: `move column ${from}→${to}`, made: keep(old.moveColumn(t, from, to), model.moveColumn(m, from, to), map) };
    }
    case 8: {
      const c = int(columns);
      const align = (["", "left", "right", "center"] as Align[])[int(4)]!;
      return { name: `align ${c} ${align}`, made: keep(old.setAlign(t, c, align), model.withAlign(m, c, align)) };
    }
    default: {
      // A header renamed: one with nothing but its name (its tags and hashtags another edit's)
      const c = int(columns);
      const header = t.rows[0]?.cells[c] ?? "";
      if (withoutTags(header) !== header || header.includes("#")) return undefined;
      const name = ["Cost", "Draft", "Item", "(draft)"][int(4)]!;
      // (Named as metadata of no column of the table read names it: main gave it to the column, the codec writes it
      // against the table read, where it is no column's (it keeps it as written); written after each edit, alike)
      if (batch?.orphans.some((id) => findColumn(headsOf([name]), id) === 0)) return undefined;
      return { name: `rename ${c} "${name}"`, made: keep(old.setCell(t, 0, c, name), model.withHeader(m, c, name), (x) => x) };
    }
  }
}

/** A table's markdown, its cells' padding aside */
function spacesAside(markdown: string): string {
  // (A line's indent kept: the codec writes a row of the table read with its indent)
  return markdown
    .split("\n")
    .map((line) => line.replace(/^( *)(.*)$/, (_, indent: string, rest: string) => indent + rest.replace(/ *\| */g, "|")))
    .join("\n");
}

/** Two tables alike but for how their metadata rows are written, which mean the same: each column's attributes, the rest */
function sameButMeta(a: string, b: string): boolean {
  const [x, y] = [parseTable(a), parseTable(b)];
  const meaning = (table: Table) => {
    const { byColumn, orphans } = columnsMetaOf(table);
    const sorted = (entries: [string, string][]) => entries.sort(([m], [n]) => m.localeCompare(n));
    return JSON.stringify({ byColumn: byColumn.map((attributes) => sorted([...attributes].flatMap(([owner, own]) => [...own].map(([key, value]): [string, string] => [`${owner}.${key}`, value])))), orphans: sorted(Object.entries(orphans)) });
  };
  return serializeTable({ ...x, meta: undefined }) === serializeTable({ ...y, meta: undefined }) && meaning(x) === meaning(y);
}

describe("the codec against main's markdown operations", () => {
  it.each([
    ["written once after all its edits, against the table read", true],
    ["written after each edit and read again, as the store writes", false],
  ])("writes what main wrote for random tables and edits: %s", (_, once) => {
    const failures: string[] = [];
    let edits = 0;
    for (let seed = 1; seed <= 5_000 && failures.length < 5; seed++) {
      const rnd = random(seed);
      const { text, nameColumns } = tableText(rnd);
      const read = parseTable(text);
      const orphans = Object.keys(columnsMetaOf(read).orphans).flatMap((name) => parseColumnAttribute(name)?.id ?? []);
      let both: Both = { old: read, model: decode(read), columnOf: (c) => c };
      let base = read;
      const steps: string[] = [];
      for (let n = 1 + Math.floor(rnd() * 4); n > 0; n--) {
        const made = edit(rnd, both, nameColumns, once ? { orphans } : undefined);
        if (!made) continue;
        steps.push(made.name);
        edits++;
        both = made.made;
        if (once) continue;
        const { map } = both;
        base = parseTable(serializeTable(encode(both.model, base, (c) => !!map && map(c) === undefined)));
        // (Main wrote each edit too: its table read again)
        both = { ...both, old: parseTable(serializeTable(both.old)), model: decode(base) };
      }
      const { columnOf } = both;
      const written = once ? serializeTable(encode(both.model, read, (c) => columnOf(c) === undefined)) : serializeTable(base);
      const expected = serializeTable(both.old);
      // Differences made on purpose: a cell's padding (the codec writes a copied row as its row was written, main wrote
      // it anew; the codec's form kept is codec.test.ts'), and a metadata row's names written as they were where they
      // mean the same (`-c-item` for `-c-item:1`; main named them all anew)
      if (written === expected || sameButMeta(spacesAside(written), spacesAside(expected))) continue;
      failures.push(`seed ${seed}: ${steps.join(", ")}\n${text}\n--- main:\n${expected}\n--- codec:\n${written}`);
    }
    expect(failures.join("\n\n")).toBe("");
    expect(edits).toBeGreaterThan(5_000);
  });
});
