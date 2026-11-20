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
import type { Align } from "../markdown.ts";

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
  return all;
}

/** Whether two sets of attributes hold the same values */
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
