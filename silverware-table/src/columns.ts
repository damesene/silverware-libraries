// How metadata names a column: attributes of columns in the metadata row
// (sort.qty="desc", meta.ts) and formula references ([qty]) name it by its header, so the name
// survives the column being moved, and both write it as SilverBullet's index
// keys table columns (`Unit price` is `unit_price`, as in a query). Any
// spelling with the same key names the same column ([Unit price] is
// [unit_price]). Of several columns with the same key, the occurrence tells
// which one (the second qty is qty:2). A column with a fixed name in its
// header (`<meta core.n='price'>`, names.ts) is named by it instead, so renaming
// the header changes nothing.
import { type Align, unescapeCell } from "./markdown.ts";
import { type Attributes, attributeIn, type ModelColumn, NO_ATTRIBUTES, type TableModel, withAttributeIn } from "./model/model.ts";
import { CORE } from "./metanames.ts";
import { LINE_NAME_KEY, nameOf } from "./names.ts";
import { metaTagPattern } from "./tags.ts";

export type ColumnId = { readonly name: string; readonly nth: number };

/**
 * A column as its name tells it: its header's text (as markdown writes it or
 * as the model has it: its tags, hashtags and emphasis are no part of its key
 * either way) and its fixed name, if it has one
 */
export type ColumnHead = { readonly text: string; readonly fixed: string | undefined };

/** Markdown header cells as their columns' heads: a fixed name read from the cell's tag (names.ts) */
export function headsOf(headers: readonly string[]): ColumnHead[] {
  return headers.map((text) => ({ text, fixed: nameOf(text) }));
}

/** A column's hashtags (its header's), as text: its type among them (the core's attribute; the column types' module reads it) */
export const HASHTAGS_KEY = "hashtags";

/** A column's header as it is written: its text with its hashtags */
export function headerText(column: ModelColumn): string {
  const hashtags = attributeIn(column.attributes, CORE, HASHTAGS_KEY);
  return hashtags ? `${column.header} ${hashtags}` : column.header;
}

/** A column of a header as written (its hashtags its attribute), with these attributes besides */
export function columnOfHeader(text: string, align: Align, attributes: Attributes = NO_ATTRIBUTES): ModelColumn {
  const hashtags = headerHashtags(text);
  return { header: withoutHashtags(text), align, attributes: withAttributeIn(attributes, CORE, HASHTAGS_KEY, hashtags.length ? hashtags.join(" ") : undefined) };
}

/** A column with the header of `header` (its text, its hashtags) and its alignment, its other attributes its own */
export function withHeaderOf(column: ModelColumn, header: ModelColumn): ModelColumn {
  return { header: header.header, align: header.align, attributes: withAttributeIn(column.attributes, CORE, HASHTAGS_KEY, attributeIn(header.attributes, CORE, HASHTAGS_KEY)) };
}

/** A model's columns as their heads: each header, and the column's own name */
export function modelHeads(model: TableModel): ColumnHead[] {
  return model.columns.map((column) => ({ text: column.header, fixed: attributeIn(column.attributes, CORE, LINE_NAME_KEY) }));
}

// A hashtag in a header (`Price #euro`): SilverBullet leaves it out of the column's key
const HASHTAG_RE = /(^|\s)#[^\s#]+/g;

/** A header's hashtags (`Price #currency-usd #x`: `#currency-usd`, `#x`), in their order */
export function headerHashtags(header: string): string[] {
  return Array.from(header.matchAll(HASHTAG_RE), (match) => match[0].trim());
}

/** A header without its hashtags, its spaces between words one */
export function withoutHashtags(header: string): string {
  return withoutHashtagsWhere(header, () => true);
}

/** A header (or a column's hashtags) without the hashtags `drop` takes (given as written, with its #), its spaces between words one */
export function withoutHashtagsWhere(header: string, drop: (tag: string) => boolean): string {
  return header.replace(HASHTAG_RE, (whole, space: string) => (drop(whole.trim()) ? space : whole)).replace(/\s+/g, " ").trim();
}

/**
 * A header cell as a column name: markdown escapes, hashtags and the
 * emphasis around it (**Qty**) dropped
 */
export function columnName(header: string): string {
  return unescapeCell(header)
    // Tags are not part of it either: SilverBullet leaves <meta> out of the key
    .replace(metaTagPattern(), "")
    .replace(HASHTAG_RE, "$1")
    .trim()
    .replace(/^[*_`]+|[*_`]+$/g, "")
    .trim();
}

/**
 * The key SilverBullet's index gives a column (cleanHeaderFieldName in
 * plugs/index/table.ts): lower case, every run of characters other than
 * A-Z, a-z and 0-9 one "_". Letters with diacritics count as such characters,
 * as there: `Množství` is `mno_stv_`.
 */
export function columnKey(name: string): string {
  return columnName(name).replace(/[\W_]+/g, "_").toLowerCase();
}

/** The column `id` names, or undefined if the table has none of that name (and occurrence) */
export function findColumn(headers: readonly ColumnHead[], id: ColumnId): number | undefined {
  // A fixed name first: it is the column's whatever the headers say
  const fixed = fixedColumn(headers, id.name);
  if (fixed >= 0 && id.nth === 1) return fixed;
  // A name written as a key is that key first: its _ at an end is a character the key stands for (`Množství` is
  // `mno_stv_`); else as a header names it (markdown's emphasis dropped: `_Draft_` is `draft`)
  const asKey = /^\w+$/.test(id.name) ? id.name.replace(/_+/g, "_").toLowerCase() : undefined;
  const find = (wanted: string) => {
    // The column with the fixed name is the first of that name, the headers of that key follow it
    let seen = fixed >= 0 ? 1 : 0;
    const index = headers.findIndex((header, c) => c !== fixed && columnKey(header.text) === wanted && ++seen === id.nth);
    return index < 0 ? undefined : index;
  };
  return (asKey === undefined ? undefined : find(asKey)) ?? find(columnKey(id.name));
}

/** The column whose fixed name is `name`, or -1 */
function fixedColumn(headers: readonly ColumnHead[], name: string): number {
  const wanted = name.toLowerCase();
  return headers.findIndex((header) => header.fixed?.toLowerCase() === wanted);
}

/**
 * How metadata names a column (its key), and whether other columns share its
 * key (then the occurrence must be written to tell them apart)
 */
export function columnIdOf(
  headers: readonly ColumnHead[],
  column: number,
): (ColumnId & { readonly shared: boolean }) | undefined {
  const header = headers[column];
  if (header === undefined) return undefined;
  if (header.fixed) return { name: header.fixed, nth: 1, shared: false };
  const wanted = columnKey(header.text);
  // Another column with this key as its fixed name comes first (findColumn)
  const fixedOther = fixedColumn(headers, wanted);
  const counted = (h: ColumnHead, c: number) => c !== fixedOther && columnKey(h.text) === wanted;
  const before = fixedOther >= 0 ? 1 : 0;
  const same = before + headers.filter(counted).length;
  const nth = before + headers.slice(0, column + 1).filter(counted).length;
  return { name: wanted, nth, shared: same > 1 };
}

/**
 * Where each column of a header row went in another, for an edit that does
 * not say (no column map: a table built anew, a calculated one): the column of
 * the same name where that name is one column's on both sides (its fixed name,
 * else its key), then, for the columns left, the one at the same place none
 * took (a header renamed; headers sharing a name, whose occurrences an edit
 * renumbers, go by place too); undefined: neither (a column gone, or another
 * in its place)
 */
export function matchColumns(before: readonly ColumnHead[], after: readonly ColumnHead[]): (column: number) => number | undefined {
  const moved = new Map<number, number>();
  const taken = new Set<number>();
  before.forEach((_, column) => {
    const id = columnIdOf(before, column);
    if (!id || id.shared) return;
    const to = findColumn(after, id);
    if (to === undefined || taken.has(to) || columnIdOf(after, to)?.shared) return;
    moved.set(column, to);
    taken.add(to);
  });
  before.forEach((_, column) => {
    if (moved.has(column) || column >= after.length || taken.has(column)) return;
    moved.set(column, column);
    taken.add(column);
  });
  return (column) => moved.get(column);
}

/**
 * The name of a column after an edit: the column `id` named in `before`,
 * moved by `map`, named as in `after`, so a rename or a move is followed.
 * Null: the column was deleted; undefined: `before` had no such column.
 */
export function followColumn(
  before: readonly ColumnHead[],
  after: readonly ColumnHead[],
  id: ColumnId,
  map: (column: number) => number | undefined = (c) => c,
): ColumnId | null | undefined {
  const column = findColumn(before, id);
  if (column === undefined) return undefined;
  const moved = map(column);
  if (moved === undefined) return null;
  return columnIdOf(after, moved) ?? null;
}

/** Whether two ids name the same column the same way */
export function sameColumnId(a: ColumnId, b: ColumnId): boolean {
  return columnKey(a.name) === columnKey(b.name) && a.nth === b.nth;
}
