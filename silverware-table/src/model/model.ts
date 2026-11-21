// A table as Silverware Table works on it, apart from where it is kept
// (docs/silverware-table-store-plan.md, *The model*): columns, body rows and
// cells, each with its content and its attributes. Nothing of a store's form
// is here (escapes, hidden tags, a metadata row, lines, places): a store's
// codec reads its form into a model and writes a model back
// (store/markdown/codec.ts), and is the one place that knows that form.
//
// Immutable: an edit makes a new version, sharing what it did not change, so
// a write, an undo and a module may each hold a version that never changes
// under them.

/** A column's alignment */
export type Align = "" | "left" | "center" | "right";

/** Whose an attribute is: a module's name in lowercase, the core's (`core`), or none (`""`: a tag typed by hand without one) */
export type Owner = string;

/**
 * Attributes by owner, then key, each value text: what a value means is its
 * owner's (a list's JSON, a formula), so a module turned off passes its
 * attributes on untouched and every store keeps text alike
 */
export type Attributes = ReadonlyMap<Owner, ReadonlyMap<string, string>>;

export const NO_ATTRIBUTES: Attributes = new Map();

/** A cell: its content in the cell language (inline markdown, unescaped: `|` is `|`), and its attributes */
export type ModelCell = { readonly content: string; readonly attributes: Attributes };

/** A body row: its cells by column, and its attributes (its name) */
export type ModelRow = { readonly cells: readonly ModelCell[]; readonly attributes: Attributes };

/** A column: its header (its name as shown, the cell language), its alignment, and its attributes (its type, its own name) */
export type ModelColumn = { readonly header: string; readonly align: Align; readonly attributes: Attributes };

/**
 * A table: its columns, its body rows (the first is row 1: the header is no
 * row, it is the columns'), and its attributes
 */
export type TableModel = {
  readonly columns: readonly ModelColumn[];
  readonly rows: readonly ModelRow[];
  readonly attributes: Attributes;
};

/**
 * A table told apart from the others of its document by its key (a store's:
 * the core's TableKey), with its model: what the domains and the core hand
 * each other a page's tables as
 */
export type KeyedModel<Key extends string = string> = { readonly key: Key; readonly model: TableModel };

/** An attribute set on attributes: what they were made from, and the change */
export type AttributeChange = { readonly from: Attributes; readonly owner: Owner; readonly key: string; readonly value: string | undefined };

// What each set of attributes was made from, so a store writes the change into
// its form as it was written (a codec keeps a cell's tags as they were, one
// attribute changed in place)
const madeFrom = new WeakMap<Attributes, AttributeChange>();

/** An attribute's value; undefined: none */
export function attributeIn(attributes: Attributes, owner: Owner, key: string): string | undefined {
  return attributes.get(owner)?.get(key);
}

/** The attributes with one set (undefined: removed); the same object where nothing changes */
export function withAttributeIn(attributes: Attributes, owner: Owner, key: string, value: string | undefined): Attributes {
  const own = attributes.get(owner);
  if (own?.get(key) === value) return attributes;
  const changed = new Map(own);
  if (value === undefined) changed.delete(key);
  else changed.set(key, value);
  const all = new Map(attributes);
  if (changed.size) all.set(owner, changed);
  else all.delete(owner);
  madeFrom.set(all, { from: attributes, owner, key, value });
  return all;
}

/**
 * As withAttributeIn, but a new set recorded as the change even where the
 * value stays: an attribute an edit sets explicitly (a formula typed again),
 * which the rules of an edit tell from one the edit left (model/rules.ts)
 */
export function withAttributeSet(attributes: Attributes, owner: Owner, key: string, value: string | undefined): Attributes {
  const changed = withAttributeIn(attributes, owner, key, value);
  if (changed !== attributes) return changed;
  const all = new Map(attributes);
  madeFrom.set(all, { from: attributes, owner, key, value });
  return all;
}

/** The change a set of attributes was made by (withAttributeIn), undefined: made otherwise (read, or made whole) */
export function attributeChangeOf(attributes: Attributes): AttributeChange | undefined {
  return madeFrom.get(attributes);
}

/** Whether two sets of attributes hold the same attributes */
export function sameAttributes(a: Attributes, b: Attributes): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [owner, own] of a) {
    const other = b.get(owner);
    if (!other || other.size !== own.size) return false;
    for (const [key, value] of own) if (other.get(key) !== value) return false;
  }
  return true;
}

/** Whether two cells are the same: their content and their attributes */
export function sameCell(a: ModelCell, b: ModelCell): boolean {
  return a === b || (a.content === b.content && sameAttributes(a.attributes, b.attributes));
}

/** Whether two tables are the same: their columns (header, alignment, attributes), rows and cells, and attributes */
export function sameTable(a: TableModel, b: TableModel): boolean {
  if (a === b) return true;
  if (a.columns.length !== b.columns.length || a.rows.length !== b.rows.length || !sameAttributes(a.attributes, b.attributes)) return false;
  const sameColumns = a.columns.every((column, c) => {
    const other = b.columns[c]!;
    return column === other || (column.header === other.header && column.align === other.align && sameAttributes(column.attributes, other.attributes));
  });
  return (
    sameColumns &&
    a.rows.every((row, r) => {
      const other = b.rows[r]!;
      return row === other || (row.cells.length === other.cells.length && sameAttributes(row.attributes, other.attributes) && row.cells.every((cell, c) => sameCell(cell, other.cells[c]!)));
    })
  );
}

/** Where an attribute is: a column's (`column`), a body row's (`row`, the first 1), a cell's (both); none: the table's */
export type AttributePlace = { readonly column: number; readonly row?: undefined } | { readonly row: number; readonly column?: number };

/** The attributes at a place of the table; undefined: no such place */
export function attributesAt(model: TableModel, at?: AttributePlace): Attributes | undefined {
  if (!at) return model.attributes;
  if (at.row === undefined) return model.columns[at.column]?.attributes;
  const row = model.rows[at.row - 1];
  return at.column === undefined ? row?.attributes : row?.cells[at.column]?.attributes;
}

/** The table with the attributes at a place made by `change` (no such place: as it was); unchanged: the same table */
export function withAttributesAt(model: TableModel, at: AttributePlace | undefined, change: (attributes: Attributes) => Attributes): TableModel {
  const current = attributesAt(model, at);
  if (!current) return model;
  const attributes = change(current);
  if (attributes === current) return model;
  if (!at) return { ...model, attributes };
  if (at.row === undefined) return { ...model, columns: model.columns.map((c, i) => (i === at.column ? { ...c, attributes } : c)) };
  const rows = model.rows.map((row, i) => {
    if (i !== at.row - 1) return row;
    if (at.column === undefined) return { ...row, attributes };
    return { ...row, cells: row.cells.map((cell, c) => (c === at.column ? { ...cell, attributes } : cell)) };
  });
  return { ...model, rows };
}
