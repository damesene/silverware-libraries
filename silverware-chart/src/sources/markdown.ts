// Markdown tables as a chart's data, read by the chart itself (no other
// plugin needed): the tables of a text (outside code blocks), its headings,
// columns found by their names as SilverBullet's index keys them. Pure.
import type { Block } from "../core/blocks.ts";
import { meets } from "./criteria.ts";
import { numberOf, plainNumberOf } from "./values.ts";

export { numberOf, plainNumberOf };
import type { Source, Unreadable } from "../core/model.ts";

/** A table as the sources read it: where it is, its columns, its body's cells as they show */
export type TextTable = {
  readonly from: number;
  readonly to: number;
  readonly columns: readonly { readonly name: string; readonly key: string }[];
  readonly rows: readonly (readonly string[])[];
};

const DELIMITER_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const FENCE_RE = /^\s*(`{3,}|~{3,})/;
// HTML tags in a cell show nothing (a hidden <meta>): left out of its text
const TAG_RE = /<[A-Za-z][^>]*>/g;
// A hashtag in a header: SilverBullet leaves it out of the column's key
const HASHTAG_RE = /(^|\s)#[^\s#]+/g;

/** A row's cells: split on pipes not escaped, the outer ones dropped */
export function cellsOf(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").replace(TAG_RE, "").trim());
}

/** A header as a column's name: its hashtags and the emphasis around it left out */
export function columnName(header: string): string {
  return header
    .replace(HASHTAG_RE, "$1")
    .trim()
    .replace(/^[*_`]+|[*_`]+$/g, "")
    .trim();
}

/** The key SilverBullet's index gives a column (lower case, each run of other than A-Z, a-z, 0-9 one "_") */
export function columnKey(name: string): string {
  return columnName(name).replace(/[\W_]+/g, "_").toLowerCase();
}

/** The tables of a text, outside fenced code */
export function tablesOf(text: string): TextTable[] {
  const tables: TextTable[] = [];
  const lines = text.split("\n");
  const starts: number[] = [];
  let at = 0;
  for (const line of lines) {
    starts.push(at);
    at += line.length + 1;
  }
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const f = FENCE_RE.exec(line);
    if (f) {
      if (!fence) fence = f[1]?.[0];
      else if (line.trim().startsWith(fence)) fence = undefined;
      continue;
    }
    if (fence || !line.includes("|") || !DELIMITER_RE.test(lines[i + 1] ?? "")) continue;
    const header = cellsOf(line);
    let end = i + 2;
    while (end < lines.length && (lines[end] ?? "").includes("|") && (lines[end] ?? "").trim() !== "") end++;
    const rows = lines
      .slice(i + 2, end)
      .map(cellsOf)
      // A row that shows nothing (Silverware Table's metadata row, a hidden tag alone) is no data
      .filter((cells) => cells.some((cell) => cell !== ""));
    const last = end - 1;
    tables.push({
      from: starts[i] ?? 0,
      to: (starts[last] ?? 0) + (lines[last] ?? "").replace(/\r$/, "").length,
      columns: header.map((cell) => ({ name: columnName(cell), key: columnKey(cell) })),
      rows,
    });
    i = last;
  }
  return tables;
}

/** The headings of a text, outside fenced code: their text and where their line ends */
export function headingsOf(text: string): { readonly title: string; readonly level: number; readonly end: number }[] {
  const out: { title: string; level: number; end: number }[] = [];
  let at = 0;
  let fence: string | undefined;
  for (const line of text.split("\n")) {
    const f = FENCE_RE.exec(line);
    if (f) {
      if (!fence) fence = f[1]?.[0];
      else if (line.trim().startsWith(fence)) fence = undefined;
    } else if (!fence) {
      const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (m) out.push({ title: m[2] ?? "", level: (m[1] ?? "#").length, end: at + line.length });
    }
    at += line.length + 1;
  }
  return out;
}

/** The table a reference finds by place: `above` / `below` the block, or the first under the heading `#Title` */
export function tableByPlace(text: string, reference: string, block: Pick<Block, "from" | "to"> | undefined): TextTable | undefined {
  const tables = tablesOf(text);
  if (reference === "above") return block ? tables.filter((t) => t.to <= block.from).at(-1) : undefined;
  if (reference === "below") return block ? tables.find((t) => t.from >= block.to) : undefined;
  if (reference.startsWith("#")) {
    const title = reference.slice(1).trim().toLowerCase();
    const headings = headingsOf(text);
    const at = headings.findIndex((h) => h.title.toLowerCase() === title);
    if (at < 0) return undefined;
    // Its section's: up to the next heading of its level or above (a table under a subheading of it is its)
    const heading = headings[at]!;
    const end = headings.slice(at + 1).find((h) => h.level <= heading.level)?.end ?? Infinity;
    return tables.find((t) => t.from > heading.end && t.from < end);
  }
  return undefined;
}

/** A table's columns, each with whether its cells are numbers (most of those not empty) */
export function columnsOf(table: Pick<TextTable, "columns" | "rows">): { name: string; numeric: boolean }[] {
  return table.columns.map((column, i) => {
    const cells = table.rows.map((row) => row[i] ?? "").filter((cell) => cell !== "");
    return { name: column.name, numeric: cells.length > 0 && cells.filter((cell) => plainNumberOf(cell) !== null).length * 2 > cells.length };
  });
}

/** The column a name says: its name (any case) or its key */
export function columnIndex(columns: TextTable["columns"], wanted: string): number {
  const w = wanted.trim();
  const byName = columns.findIndex((c) => c.name.toLowerCase() === w.toLowerCase());
  if (byName >= 0) return byName;
  const key = columnKey(w);
  return columns.findIndex((c) => c.key === w || c.key === key);
}


/**
 * A table's columns as a chart's data, of the rows the source keeps (where
 * its conditions hold, the first or last so many): the labels' (else 1, 2, …)
 * and each series'; or what is missing, with the table's columns offered in
 * its place
 */
export function dataOf(table: Pick<TextTable, "columns" | "rows">, source: Source, what: string): { labels: string[]; series: (number | null)[][] } | Unreadable {
  const { x, series } = source;
  if (!series.length) return { problem: `${what}: say the columns to draw with series` };
  const index = (name: string) => columnIndex(table.columns, name);
  const missing = [...(x ? [x] : []), ...series].filter((name) => index(name) < 0);
  if (missing.length) {
    const first = missing[0]!;
    // The first reference that finds no column, each column of the table in its place (a column renamed by hand)
    const choices = table.columns
      .filter((c) => c.name !== "")
      .map((c) => ({ label: c.name, source: { ...source, ...(x === first ? { x: c.name } : {}), series: series.map((name) => (name === first && x !== first ? c.name : name)) } }));
    return { problem: `${what} has no column ${missing.join(", ")} (it has ${table.columns.map((c) => c.name).join(", ")})`, choices };
  }
  const where = source.where ?? [];
  const lost = where.filter((c) => index(c.column) < 0).map((c) => c.column);
  if (lost.length) return { problem: `${what} has no column ${lost.join(", ")} to filter by (it has ${table.columns.map((c) => c.name).join(", ")})` };
  // The rows where every condition holds, then the first or the last so many of them
  let rows = table.rows.filter((row) => where.every((c) => meets(row[index(c.column)] ?? "", c.criterion)));
  if (source.rows) rows = source.rows.from === "first" ? rows.slice(0, source.rows.count) : rows.slice(Math.max(0, rows.length - source.rows.count));
  const xi = x ? index(x) : -1;
  return {
    labels: rows.map((row, i) => (xi >= 0 ? (row[xi] ?? "") : String(i + 1))),
    series: series.map((name) => {
      const i = index(name);
      return rows.map((row) => numberOf(row[i] ?? ""));
    }),
  };
}

/** A reference to another page's: `[[Page]]rest` as the page and the rest; else the rest alone */
export function pageOf(reference: string): { readonly page?: string; readonly rest: string } {
  const m = /^\[\[([^\]]+)\]\](.*)$/.exec(reference.trim());
  return m ? { page: m[1]!.trim(), rest: (m[2] ?? "").trim() } : { rest: reference.trim() };
}
