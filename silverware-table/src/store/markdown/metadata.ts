// What a markdown table stores beyond its content, as Remove metadata sees it
// (core/metadata.ts asks; docs/silverware-table-store-plan.md, step 6): its
// metadata row and the hidden tags in its cells (tags.ts: formulas, whose
// cells keep their results, names), whatever module keeps them, those of no
// column too, which no model holds. A part of a table is cells (a header
// cell's own tags, not its column's attributes in the metadata row) and whole
// columns (their attributes in the metadata row too).
import type { MetadataPart, StoredMetadata } from "../../core/store.ts";
import { type Table, writesMetaRow, writtenMeta } from "../../markdown.ts";
import { columnsAttributes } from "../../meta.ts";
import { CORE, splitAttributeName } from "../../metanames.ts";
import { attributesOf, cellTags, withoutTags } from "../../tags.ts";

const hasTags = (cell: string) => cellTags(cell).length > 0;

/** A table without its metadata row and without the hidden tags in its cells (formula cells keep their results) */
function withoutAll(table: Table): Table {
  const { meta: _meta, metaSource: _source, attributes: _attributes, ...rest } = table;
  return { ...rest, rows: table.rows.map((row) => (row.cells.some(hasTags) ? { ...row, cells: row.cells.map(withoutTags) } : row)) };
}

/** What a part holds, as a table of its own: its cells in one row, its columns' attributes as its metadata */
function partOf(table: Table, part: MetadataPart): Table {
  const { meta: _meta, metaSource: _source, attributes: _attributes, ...rest } = table;
  const names = columnsAttributes(table, part.columns);
  const cells = { cells: part.cells.map((ref) => table.rows[ref.row]?.cells[ref.column] ?? "") };
  return { ...rest, rows: [cells], ...(names.length ? { meta: Object.fromEntries(names.map((name) => [name, table.meta![name]!])) } : {}) };
}

/** A table without the metadata of a part of it: its cells' hidden tags (formula cells keep their results), its columns' attributes */
function withoutPart(table: Table, part: MetadataPart): Table {
  const names = new Set(columnsAttributes(table, part.columns));
  const taken = new Map<number, Set<number>>();
  for (const ref of part.cells) taken.set(ref.row, (taken.get(ref.row) ?? new Set()).add(ref.column));
  const rows = table.rows.map((row, r) => {
    const columns = taken.get(r);
    return columns && row.cells.some((cell, c) => columns.has(c) && hasTags(cell)) ? { ...row, cells: row.cells.map((cell, c) => (columns.has(c) ? withoutTags(cell) : cell)) } : row;
  });
  if (names.size === 0) return { ...table, rows };
  return { ...table, rows, meta: Object.fromEntries(Object.entries(table.meta ?? {}).filter(([name]) => !names.has(name))) };
}

/** A table without the metadata of a part of it, or all of it */
export function withoutMetadata(table: Table, part: MetadataPart | "all"): Table {
  return part === "all" ? withoutAll(table) : withoutPart(table, part);
}

/** Whose an attribute is, by its name ("": no owner's) */
const ownerOf = (name: string): string => splitAttributeName(name).owner;

/** What a table, or a part of it, stores beyond its content: whose it is (the core first, then as found), whether any, whether settings */
export function metadataOf(table: Table, part: MetadataPart | "all"): StoredMetadata {
  const of = part === "all" ? table : partOf(table, part);
  const owners = new Map<string, number>([[CORE, 0]]);
  const seen = new Set<string>();
  for (const name of Object.keys(writtenMeta(of))) {
    seen.add(ownerOf(name));
    if (!owners.has(ownerOf(name))) owners.set(ownerOf(name), 0);
  }
  for (const row of of.rows) {
    for (const cell of row.cells) {
      for (const owner of new Set(cellTags(cell).flatMap(attributesOf).map(ownerOf))) {
        seen.add(owner);
        owners.set(owner, (owners.get(owner) ?? 0) + 1);
      }
    }
  }
  return {
    owners: [...owners].filter(([owner]) => seen.has(owner)).map(([owner, cells]) => ({ owner, cells })),
    any: writesMetaRow(of) || of.rows.some((row) => row.cells.some(hasTags)),
    // (A table's: its metadata row, a sorting stored there; a part's: its columns' attributes there)
    settings: part === "all" ? writesMetaRow(table) : columnsAttributes(table, part.columns).length > 0,
  };
}
