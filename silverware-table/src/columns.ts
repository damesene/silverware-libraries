// A column's header as Silverware Table writes and edits it: its text and its
// hashtags (the core's attribute `hashtags`), a header made of a text typed,
// headers left empty named; and markdown's header cells read as the model's
// heads (`headsOf`). How a column is named is shared/table/columns.ts.
import { type ColumnHead, headerHashtags, withoutHashtags } from "../../shared/table/columns.ts";
import { type Align, type Attributes, attributeIn, CORE, type ModelCell, type ModelColumn, NO_ATTRIBUTES, type TableModel, withAttributeIn } from "../../shared/table/model.ts";
import { LINE_NAME_KEY } from "../../shared/table/names.ts";
import { unescapeCell } from "./markdown.ts";
import { nameOf } from "./names.ts";
import { metaTagPattern } from "./tags.ts";

/** Markdown header cells as their columns' heads: their text as the model's, a fixed name read from the cell's tag (names.ts) */
export function headsOf(headers: readonly string[]): ColumnHead[] {
  return headers.map((cell) => ({ text: markdownHeaderText(cell), fixed: nameOf(cell) }));
}

/** A markdown header cell's text as the model has a header's: unescaped, its tags out (SilverBullet leaves `<meta>` out of a column's key) */
export function markdownHeaderText(cell: string): string {
  return unescapeCell(cell).replace(metaTagPattern(), "").trim();
}

/** A column's hashtags (its header's), as text: its type among them (the core's attribute; the column types' module reads it) */
export const HASHTAGS_KEY = "hashtags";

/** A column's header as it is written: its text with its hashtags */
export function headerText(column: ModelColumn): string {
  const hashtags = attributeIn(column.attributes, CORE, HASHTAGS_KEY);
  return hashtags && column.header ? `${column.header} ${hashtags}` : (hashtags ?? column.header);
}

/** A column's header as a cell: its text as written (its hashtags with it), the column's attributes (what a header's editor edits) */
export function headerCell(model: TableModel, column: number): ModelCell | undefined {
  const at = model.columns[column];
  return at && { content: headerText(at), attributes: at.attributes };
}

/** The table with a column's header written so: its name the text without hashtags, its hashtags the text's */
export function withHeaderText(model: TableModel, column: number, text: string): TableModel {
  const at = model.columns[column];
  if (!at || headerText(at) === text) return model;
  const made = columnOfHeader(text, at.align, at.attributes);
  return { ...model, columns: model.columns.map((c, i) => (i === column ? made : c)) };
}

// Each column made of a header as written, that text (its hashtags where they were written, its spaces): what a store
// writes where the column is as made (typedHeader)
const typed = new WeakMap<ModelColumn, string>();

/** A column of a header as written (its hashtags its attribute), with these attributes besides */
export function columnOfHeader(text: string, align: Align, attributes: Attributes = NO_ATTRIBUTES): ModelColumn {
  const hashtags = headerHashtags(text);
  const column: ModelColumn = { header: withoutHashtags(text), align, attributes: withAttributeIn(attributes, CORE, HASHTAGS_KEY, hashtags.length ? hashtags.join(" ") : undefined) };
  typed.set(column, text.trim());
  return column;
}

/**
 * A column's header as it was written, where the column was made of it and its
 * text and hashtags are still that text's (columnOfHeader); undefined: none
 */
export function typedHeader(column: ModelColumn): string | undefined {
  const text = typed.get(column);
  return text !== undefined && headerText(column) === headerText(columnOfHeader(text, column.align)) ? text : undefined;
}

/**
 * Whether a column's header is empty: no text, no hashtags, no name of its own
 * (an empty header cell, which SilverBullet renders none of, the header then
 * shifted against the data)
 */
function emptyHeader(column: ModelColumn): boolean {
  return headerText(column) === "" && attributeIn(column.attributes, CORE, LINE_NAME_KEY) === undefined;
}

/** Names every column with an empty header "Column N" (N its place, or the next free number) */
export function nameEmptyHeaders(model: TableModel): TableModel {
  if (!model.columns.some(emptyHeader)) return model;
  const names = new Set(model.columns.map((c) => c.header));
  const columns = model.columns.map((column, i): ModelColumn => {
    if (!emptyHeader(column)) return column;
    let n = i + 1;
    while (names.has(`Column ${n}`)) n++;
    const header = `Column ${n}`;
    names.add(header);
    return { ...column, header };
  });
  return { ...model, columns };
}

/** A column with the header of `header` (its text, its hashtags) and its alignment, its other attributes its own (the column itself where they are the same) */
export function withHeaderOf(column: ModelColumn, header: ModelColumn): ModelColumn {
  const attributes = withAttributeIn(column.attributes, CORE, HASHTAGS_KEY, attributeIn(header.attributes, CORE, HASHTAGS_KEY));
  return column.header === header.header && column.align === header.align && attributes === column.attributes ? column : { header: header.header, align: header.align, attributes };
}
