// What tables keep, by whose it is: the core's (its name, pins, sorting, the
// names of columns, rows and cells) and each module's. The core makes every
// attribute's name from its owner and key (metanames.ts; for a column's, the
// column too), so a module gives only its key and value through its host,
// never a whole name, and cannot write another's. An attribute of a column
// names it as columns.ts names columns (its key or fixed name, with its
// occurrence where several share it), so it survives moves and renames, which
// every edit follows here whatever the attribute is for.
import { type ColumnId, columnIdOf, findColumn, matchColumns, type ColumnHead, headsOf } from "./columns.ts";
import type { Row, Table, TableMeta } from "./markdown.ts";
import { attributeName, COLUMN_ATTRIBUTE_RE, COLUMN_MARK, CORE, type Owner, splitAttributeName } from "./metanames.ts";
import { type Attributes, attributeIn, NO_ATTRIBUTES, type TableModel, withAttributeIn } from "./model/model.ts";
import { validateTableName } from "./namerules.ts";
import type { SortDirection } from "../../shared/compare.ts";
import { NO_PINS, type Pins } from "./view.ts";

export { attributeName, CORE, type Owner } from "./metanames.ts";

export type MetaSort = { readonly column: number; readonly direction: SortDirection };


/** Sets or (with undefined) removes an attribute by its whole name, a table's or a column's; unchanged: the same table */
export function withMeta(table: Table, name: string, value: string | undefined): Table {
  if (!parseColumnAttribute(name)) {
    const { owner, key } = splitAttributeName(name);
    return withMetaValue(table, owner, key, value);
  }
  const current = table.meta ?? {};
  if (current[name] === value) return table;
  const meta: Record<string, string> = { ...current };
  if (value === undefined) delete meta[name];
  else meta[name] = value;
  return { ...table, meta };
}

/** An owner's attribute of the table */
export function metaValue(table: Table, owner: Owner, key: string): string | undefined {
  return attributeIn(table.attributes ?? NO_ATTRIBUTES, owner, key);
}

/** The table with an owner's attribute set (undefined: removed); unchanged: the same table */
export function withMetaValue(table: Table, owner: Owner, key: string, value: string | undefined): Table {
  const current = table.attributes ?? NO_ATTRIBUTES;
  const attributes = withAttributeIn(current, owner, key, value);
  return attributes === current ? table : { ...table, attributes };
}

/** Whether the table has the attribute of this whole name (of the table's, or of a column's as the metadata row names it) */
export function hasMetaNamed(table: Table, name: string): boolean {
  if (parseColumnAttribute(name)) return name in (table.meta ?? {});
  const { owner, key } = splitAttributeName(name);
  return metaValue(table, owner, key) !== undefined;
}

/** An owner's attributes of the table (not of its columns), by key */
export function metaValuesOf(table: Table, owner: Owner): Map<string, string> {
  return new Map(table.attributes?.get(owner));
}

// ---- attributes of columns ------------------------------------------------------


function parseColumnAttribute(name: string): { readonly what: string; readonly id: ColumnId } | undefined {
  const match = COLUMN_ATTRIBUTE_RE.exec(name);
  return match ? { what: `${match[1]!}.${match[4]!}`, id: { name: match[2]!, nth: Number(match[3] ?? 1) } } : undefined;
}

/** The name of the attribute `what` (its owner and key) of a column, as the headers name the column */
function columnAttributeName(headers: readonly ColumnHead[], what: string, column: number): string | undefined {
  const id = columnIdOf(headers, column);
  const dot = what.indexOf(".");
  return id && `${what.slice(0, dot)}.${COLUMN_MARK}${id.name}${id.shared ? `:${id.nth}` : ""}.${what.slice(dot + 1)}`;
}

/** An owner's attribute of each column that has it, by the column, in the order they are written */
export function columnValues(table: Table, owner: Owner, key: string): Map<number, string> {
  const what = attributeName(owner, key);
  const headers = headsOf(table.rows[0]?.cells ?? []);
  const values = new Map<number, string>();
  for (const [name, value] of Object.entries(table.meta ?? {})) {
    const attribute = parseColumnAttribute(name);
    const column = attribute?.what === what ? findColumn(headers, attribute.id) : undefined;
    if (column !== undefined && !values.has(column)) values.set(column, value);
  }
  return values;
}

/** The table with an owner's attribute of the columns as `values` (by column), and of no other */
export function withColumnValues(table: Table, owner: Owner, key: string, values: ReadonlyMap<number, string>): Table {
  const what = attributeName(owner, key);
  const headers = headsOf(table.rows[0]?.cells ?? []);
  const meta: Record<string, string> = {};
  for (const [name, value] of Object.entries(table.meta ?? {})) {
    if (parseColumnAttribute(name)?.what !== what) meta[name] = value;
  }
  for (const [column, value] of values) {
    const name = columnAttributeName(headers, what, column);
    if (name) meta[name] = value;
  }
  const current = table.meta ?? {};
  const same = Object.keys(meta).length === Object.keys(current).length && Object.entries(meta).every(([n, v]) => current[n] === v);
  return same ? table : { ...table, meta };
}

/**
 * Every attribute of the table's columns in its metadata row, by column (by
 * owner and key), and those naming no column (a header renamed by hand: kept
 * as written, for the column's name to come back)
 */
export function columnsMetaOf(table: Table): { readonly byColumn: readonly Attributes[]; readonly orphans: TableMeta } {
  const headers = headsOf(table.rows[0]?.cells ?? []);
  const byColumn = table.align.map(() => new Map<string, Map<string, string>>());
  const orphans: Record<string, string> = {};
  for (const [name, value] of Object.entries(table.meta ?? {})) {
    const attribute = parseColumnAttribute(name);
    const column = attribute && findColumn(headers, attribute.id);
    const own = column === undefined ? undefined : byColumn[column];
    if (!attribute || !own) {
      orphans[name] = value;
      continue;
    }
    const { owner, key } = splitAttributeName(attribute.what);
    let values = own.get(owner);
    if (!values) own.set(owner, (values = new Map()));
    // (The first of a name counts, as columnValues reads it)
    if (!values.has(key)) values.set(key, value);
  }
  return { byColumn, orphans };
}

/** Columns' attributes (by column) as a metadata row names them by these headers, then those kept as written */
export function columnsMetaNamed(headers: readonly ColumnHead[], byColumn: readonly Attributes[], orphans: TableMeta): TableMeta {
  const meta: Record<string, string> = {};
  byColumn.forEach((attributes, column) => {
    for (const [owner, own] of attributes) {
      for (const [key, value] of own) {
        const name = columnAttributeName(headers, attributeName(owner, key), column);
        if (name) meta[name] = value;
      }
    }
  });
  for (const [name, value] of Object.entries(orphans)) if (!(name in meta)) meta[name] = value;
  return meta;
}

/** The whole name of an owner's attribute of one column, as the headers name it (undefined: no such column) */
export function columnAttributeOf(table: Table, owner: Owner, key: string, column: number): string | undefined {
  return columnAttributeName(headsOf(table.rows[0]?.cells ?? []), attributeName(owner, key), column);
}

/** The whole names of the attributes of `columns` in the metadata row, whoever's they are */
export function columnsAttributes(table: Table, columns: ReadonlySet<number>): string[] {
  const headers = headsOf(table.rows[0]?.cells ?? []);
  return Object.keys(table.meta ?? {}).filter((name) => {
    const attribute = parseColumnAttribute(name);
    const column = attribute && findColumn(headers, attribute.id);
    return column !== undefined && columns.has(column);
  });
}

/**
 * Keeps the columns' attributes on their columns through an edit: each one
 * the table before had, unchanged by the edit, names its column as moved and
 * as the table after names it, so renamed, moved and duplicate-named columns
 * are followed, in the place it was written. Attributes the edit set are its
 * own. How the columns moved: `map`, the edit's (undefined: deleted, and the
 * attribute goes); without one, as `matchColumns` pairs the headers, an
 * attribute of a column it finds nowhere kept as written (a calculated table
 * without that column now: it comes back with it), never put on another
 */
export function followColumnMeta(before: Table, after: Table, map?: (column: number) => number | undefined): Table {
  const old = before.meta ?? {};
  const current = after.meta ?? {};
  const beforeHeaders = headsOf(before.rows[0]?.cells ?? []);
  const afterHeaders = headsOf(after.rows[0]?.cells ?? []);
  const moves = map ?? matchColumns(beforeHeaders, afterHeaders);
  let changed = false;
  const meta: Record<string, string> = {};
  for (const [name, value] of Object.entries(current)) {
    const attribute = old[name] === value ? parseColumnAttribute(name) : undefined;
    const column = attribute && findColumn(beforeHeaders, attribute.id);
    if (!attribute || column === undefined) {
      meta[name] = value;
      continue;
    }
    const moved = moves(column);
    // (Found nowhere, the edit not saying it went: kept as written)
    if (moved === undefined && !map) {
      meta[name] = value;
      continue;
    }
    const renamed = moved === undefined ? undefined : columnAttributeName(afterHeaders, attribute.what, moved);
    if (renamed !== name) changed = true;
    if (renamed !== undefined) meta[renamed] = value;
  }
  return changed ? { ...after, meta } : after;
}

// ---- sorting ------------------------------------------------------------------

/** The sorting stored in the table, if its column still exists */
export function metaSort(table: Table): MetaSort | undefined {
  for (const [column, direction] of columnValues(table, CORE, "sort")) {
    if (direction === "asc" || direction === "desc") return { column, direction };
  }
  return undefined;
}

/** Stores (or, with undefined, removes) the sorting */
export function withMetaSort(table: Table, sort: MetaSort | undefined): Table {
  return withColumnValues(table, CORE, "sort", new Map(sort ? [[sort.column, sort.direction]] : []));
}

// ---- pins -----------------------------------------------------------------------

const PIN_KEYS = { top: "pin-top", bottom: "pin-bottom", left: "pin-left", right: "pin-right" } as const;

/** The pins stored in the table, limited to what it has room for */
export function metaPins(table: Table): Pins {
  const count = (key: string) => {
    const n = Number(metaValue(table, CORE, key));
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  const bodyRows = Math.max(0, table.rows.length - 1);
  const columns = table.align.length;
  const top = Math.min(count(PIN_KEYS.top), bodyRows);
  const left = Math.min(count(PIN_KEYS.left), columns);
  return {
    top,
    bottom: Math.min(count(PIN_KEYS.bottom), bodyRows - top),
    left,
    right: Math.min(count(PIN_KEYS.right), columns - left),
  };
}

/** Stores the pins; a count of 0 removes its attribute */
export function withMetaPins(table: Table, pins: Pins): Table {
  let result = table;
  for (const edge of ["top", "bottom", "left", "right"] as const) {
    result = withMetaValue(result, CORE, PIN_KEYS[edge], pins[edge] > 0 ? String(pins[edge]) : undefined);
  }
  return result;
}

export function hasMetaPins(table: Table): boolean {
  return Object.values(PIN_KEYS).some((key) => metaValue(table, CORE, key) !== undefined);
}

// ---- the table's name ---------------------------------------------------------------

/** The table's name, if it has a valid one */
export function metaName(table: Table): string | undefined {
  const name = metaValue(table, CORE, "name")?.trim();
  return name && !validateTableName(name) ? name : undefined;
}

/** A model's name, if it has a valid one */
export function modelTableName(model: TableModel): string | undefined {
  const name = attributeIn(model.attributes, CORE, "name")?.trim();
  return name && !validateTableName(name) ? name : undefined;
}

/** The table's name as written, valid or not */
export function writtenName(table: Table): string | undefined {
  return metaValue(table, CORE, "name");
}

/** Names (or, with undefined, unnames) the table */
export function withMetaName(table: Table, name: string | undefined): Table {
  return withMetaValue(table, CORE, "name", name);
}

// ---- keeping the metadata through edits ------------------------------------------

/**
 * The step every table edit goes through for the metadata row: the columns'
 * attributes follow their columns (`columnMap`), and edits that change the
 * pins store them, at the edges they may be stored at (`canPin`: the metadata
 * setting off, only where the table has pins already). (Pins are counts at
 * the edges: the edits that change them set them.)
 */
export function metadataAfterEdit(
  before: Table,
  after: Table,
  edit: { readonly columnMap?: (column: number) => number | undefined; readonly pins?: Pins },
  canPin: (edge: keyof typeof PIN_KEYS) => boolean = () => true,
): Table {
  const followed = followColumnMeta(before, after, edit.columnMap);
  if (!edit.pins) return followed;
  const kept = metaPins(followed);
  const pins = edit.pins;
  return withMetaPins(followed, {
    top: canPin("top") ? pins.top : kept.top,
    bottom: canPin("bottom") ? pins.bottom : kept.bottom,
    left: canPin("left") ? pins.left : kept.left,
    right: canPin("right") ? pins.right : kept.right,
  });
}

export { NO_PINS };
export type { Row };
