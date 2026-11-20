// The names of what tables keep: each attribute's whole name, made of its
// owner's (a module's name in lowercase, or the core's) and its key. Nothing
// else: the parts that read and write tables (meta.ts, names.ts) take their
// names from here.
// - an attribute of a table: `<owner>.<key>` (`core.name`, `sheet.at`)
// - an attribute of a column: `<owner>.-c-<column>.<key>` (`core.-c-qty.sort`),
//   the column as columns.ts names it, with its occurrence where several share
//   it (`-c-qty:2`); a segment starting `-x-` marks what the key is of (`-c-`:
//   a column), which no owner, key or column name starts with
// - an attribute in a cell's hidden tags: `<owner>.<key>` (`formulas.f`)
// The metadata row carries `core.table`, by which it is told from a last row
// whose one cell holds only a tag.

import type { Owner } from "./model/model.ts";

export type { Owner };
export const CORE: Owner = "core";

/** The mark of a table's metadata row (an attribute without a value) */
export const TABLE_MARKER = `${CORE}.table`;

/** The segment before a column's name in an attribute of a column */
export const COLUMN_MARK = "-c-";

// `<owner>.-c-<column>.<key>` and `<owner>.-c-<column>:<occurrence>.<key>`: a
// column's key or fixed name has no "." or ":"; it is empty for a header with
// only hashtags (`#stars`). Its groups: the owner, the column, its occurrence, the key
export const COLUMN_ATTRIBUTE_RE = new RegExp(String.raw`^([^.]+)\.${COLUMN_MARK}([^.:]*)(?::(\d+))?\.(.+)$`);

/** Whether a whole name is of a column's attribute (else of a table's) */
export function isColumnAttributeName(name: string): boolean {
  return COLUMN_ATTRIBUTE_RE.test(name);
}

/**
 * The name of an owner's attribute: of a table, in a cell's hidden tags, and,
 * with the column between them (meta.ts), of a column; no owner's (`""`, a tag
 * typed by hand), its key alone
 */
export function attributeName(owner: Owner, key: string): string {
  return owner === "" ? key : `${owner}.${key}`;
}

/** An attribute's name (of a table's, or in a cell's tags) as its owner and key: before and after its first dot; without one, no owner's */
export function splitAttributeName(name: string): { readonly owner: Owner; readonly key: string } {
  const dot = name.indexOf(".");
  return dot < 0 ? { owner: "", key: name } : { owner: name.slice(0, dot), key: name.slice(dot + 1) };
}

/** A text to find as it is in a regular expression */
export function escapedForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
