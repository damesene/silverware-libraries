// The markdown codec: a markdown table (markdown.ts' `Table`) read into the
// model (model/model.ts) and the model written back
// (docs/silverware-table-store-plan.md, step 3). The one place that knows
// where the model's parts are in markdown:
// - a column's header is its header cell's text without its hidden tags and
//   hashtags, unescaped; its hashtags are its attribute `core.hashtags`, its
//   hidden tags' attributes (its own name, `core.n`) and the metadata row's
//   attributes of it (`widths.-c-qty.size`, by its name) are its attributes;
// - a row's name (`core.n` in a body cell's tag) is the row's attribute;
// - a cell's content is its text without its tags, unescaped (`\|` is `|`),
//   its tags' attributes are its attributes;
// - the table's attributes are its metadata row's of no column.
//
// Written back, what the model did not change is written as it was read,
// byte for byte; an attribute changed is written into the tags it was read
// from, as the writers before the model wrote it (withTagValue; a name as
// names.ts writes it), so a changed table reads as before. What the metadata
// row has of no column found (a header renamed by hand) is kept as written,
// but of an attribute the model set on a column (orphansKept).
import { HASHTAGS_KEY, headerHashtags, headerText, headsOf, typedHeader, withoutHashtags } from "../../columns.ts";
import { escapeCell, type Row, serializeTable, type Table, type TableMeta, unescapeCell } from "../../markdown.ts";
import { columnsAttributes, columnsMetaNamed, columnsMetaOf, parseColumnAttribute } from "../../meta.ts";
import { attributeName, CORE, escapedForRegExp, splitAttributeName } from "../../metanames.ts";
import {
  type Align,
  attributeChangeOf,
  type Attributes,
  type AttributeChange,
  attributeIn,
  type ModelCell,
  type ModelColumn,
  type ModelRow,
  NO_ATTRIBUTES,
  type TableModel,
} from "../../model/model.ts";
import { CELL_NAME_KEY, LINE_NAME, LINE_NAME_KEY, rowNameIn, withCellName, withName } from "../../names.ts";
import { cellTags, withoutTags } from "../../tags.ts";
import { currentTag, tagAttributes, withTagValue } from "../../tagvalues.ts";

// What the codec read each part of the model from, so what is unchanged is
// written as it was: a table's model; a row's markdown; a cell's markdown; a
// header cell's markdown; the tags a set of attributes was read from (a cell's
// or a header's: with the markdown's text before them)
const models = new WeakMap<Table, TableModel>();
// Each model decoded, the table it was read from (its form: padding, cells as written)
const bases = new WeakMap<TableModel, Table>();
const rows = new WeakMap<ModelRow, Row>();
// A row's cells past its header's (no column's: SilverBullet shows none of them), kept as written when the row changes
const beyond = new WeakMap<Row, readonly string[]>();
// The row a row's attributes were read with (one with cells past its header: a set of its own), so a row whose every
// cell an edit made anew is still told as the row it was (its attributes go with it through the model's operations)
const rowOfAttributes = new WeakMap<Attributes, Row>();
const cells = new WeakMap<ModelCell, { readonly cell: string; readonly row: Row }>();
const headers = new WeakMap<ModelColumn, string>();
const tagsRead = new WeakMap<Attributes, { readonly cell: string; readonly inTags: ReadonlySet<string> }>();

/**
 * Attributes by owner and key of whole names (`formulas.f`) and values, those
 * of `left` out; of tags, a set of their own even if none is left (a cell
 * holding only its row's name: what it was read from is kept by it)
 */
function attributesOf(named: ReadonlyMap<string, string>, left: ReadonlySet<string> = new Set()): Attributes {
  if (named.size === 0) return NO_ATTRIBUTES;
  const all = new Map<string, Map<string, string>>();
  for (const [name, value] of named) {
    if (left.has(name)) continue;
    const { owner, key } = splitAttributeName(name);
    let own = all.get(owner);
    if (!own) all.set(owner, (own = new Map()));
    own.set(key, value);
  }
  return all;
}

/** Two sets of attributes merged, `b`'s over `a`'s */
function merged(a: Attributes, b: Attributes): Attributes {
  if (b.size === 0) return a;
  if (a.size === 0) return b;
  const all = new Map<string, Map<string, string>>([...a].map(([owner, own]) => [owner, new Map(own)]));
  for (const [owner, own] of b) for (const [key, value] of own) {
    let values = all.get(owner);
    if (!values) all.set(owner, (values = new Map()));
    values.set(key, value);
  }
  return all;
}


/** A table read into the model (the same model for the same table) */
export function decode(table: Table): TableModel {
  const known = models.get(table);
  if (known) return known;
  const [header, ...body] = table.rows;
  const { byColumn } = columnsMetaOf(table);
  const columns = table.align.map((align, c): ModelColumn => {
    const raw = header?.cells[c] ?? "";
    const tags = tagAttributes(raw);
    const text = withoutTags(raw);
    const hashtags = headerHashtags(text);
    let attributes = merged(attributesOf(tags), byColumn[c] ?? NO_ATTRIBUTES);
    if (hashtags.length) attributes = merged(attributes, new Map([[CORE, new Map([[HASHTAGS_KEY, hashtags.join(" ")]])]]));
    // (The column's attributes as read, its header's tags among them: what a change of one is written into, its header
    // as read with them; a set of its own where it has none, so a column changed is still told by what it was read as)
    if (attributes === NO_ATTRIBUTES) attributes = new Map();
    tagsRead.set(attributes, { cell: raw, inTags: new Set(tags.keys()) });
    const column: ModelColumn = { header: unescapeCell(withoutHashtags(text)), align, attributes };
    headers.set(column, raw);
    return column;
  });
  const modelRows = body.map((row): ModelRow => {
    if (row.cells.length > table.align.length) beyond.set(row, row.cells.slice(table.align.length));
    // A row's name is the row's, in whichever of its cells holds it
    const named = rowNameIn(row.cells);
    const rowCells = table.align.map((_, c): ModelCell => {
      const raw = row.cells[c] ?? "";
      const tags = tagAttributes(raw);
      const attributes = attributesOf(tags, new Set([LINE_NAME]));
      if (tags.size) tagsRead.set(attributes, { cell: raw, inTags: new Set(tags.keys()) });
      const cell: ModelCell = { content: unescapeCell(withoutTags(raw)), attributes };
      cells.set(cell, { cell: raw, row });
      return cell;
    });
    const attributes: Attributes = named ? new Map([[CORE, new Map([[LINE_NAME_KEY, named.name]])]]) : beyond.has(row) ? new Map() : NO_ATTRIBUTES;
    if (attributes !== NO_ATTRIBUTES) rowOfAttributes.set(attributes, row);
    const modelRow: ModelRow = { cells: rowCells, attributes };
    rows.set(modelRow, row);
    return modelRow;
  });
  const model: TableModel = { columns, rows: modelRows, attributes: table.attributes ?? NO_ATTRIBUTES };
  models.set(table, model);
  bases.set(model, table);
  return model;
}

/**
 * The changes `attributes` was made by from attributes the codec read (oldest
 * first), with those read; none read: every attribute it has, as changes from none
 */
function changesSinceRead(attributes: Attributes): { readonly read: { readonly cell: string; readonly inTags: ReadonlySet<string> } | undefined; readonly changes: readonly AttributeChange[] } {
  const changes: AttributeChange[] = [];
  for (let at: Attributes | undefined = attributes; at; ) {
    const read = tagsRead.get(at);
    if (read) return { read, changes: changes.reverse() };
    const change = attributeChangeOf(at);
    if (!change) {
      // Made whole: every attribute it holds, set on nothing
      for (const [owner, own] of at) for (const [key, value] of own) changes.push({ from: NO_ATTRIBUTES, owner, key, value });
      return { read: undefined, changes: changes.reverse() };
    }
    changes.push(change);
    at = change.from;
  }
  return { read: undefined, changes: changes.reverse() };
}

/** An attribute set in a cell's markdown as the writers before the model set it: a name in the names' one tag, else in the tag that has it */
function withTagged(cell: string, owner: string, key: string, value: string | undefined): string {
  if (owner === CORE && key === LINE_NAME_KEY) return withName(cell, value);
  if (owner === CORE && key === CELL_NAME_KEY) return withCellName(cell, value);
  return withTagValue(cell, attributeName(owner, key), value);
}

/**
 * A cell's text (`content` in markdown: as read where unchanged) with these
 * attributes' tags, written into those read; `edited` what the cell read
 * becomes before (a header's hashtags changed)
 */
function cellMarkdown(
  content: string,
  attributes: Attributes,
  inTags: (owner: string, key: string, read: ReadonlySet<string> | undefined) => boolean,
  edited: (cell: string) => string = (cell) => cell,
): string {
  const { read: asRead, changes } = changesSinceRead(attributes);
  const read = asRead && { ...asRead, cell: edited(asRead.cell) };
  // Its content as read: the cell as read, whole; else its content with the tags read after it, in today's form (a
  // cell written anew: tags written in double quotes before 2026-10-22 written in apostrophes, as the writers did)
  const asWritten = read !== undefined && unescapeCell(withoutTags(read.cell)) === content;
  let cell = asWritten ? read.cell : [escapeCell(content), ...(read ? cellTags(read.cell).map(currentTag) : [])].filter((part) => part !== "").join(" ");
  for (const { owner, key, value } of changes) if (inTags(owner, key, read?.inTags)) cell = withTagged(cell, owner, key, value);
  return cell;
}

/**
 * A header cell's markdown with these hashtags, as the column types' module
 * wrote a type before the model: those it no longer has taken out (its spaces
 * then one), those it has not yet put at its end
 */
function withHashtags(cell: string, hashtags: readonly string[]): string {
  const had = headerHashtags(withoutTags(cell));
  if (had.length === hashtags.length && had.every((tag, i) => tag === hashtags[i])) return cell;
  const kept = had.reduce((text, tag) => (hashtags.includes(tag) ? text : text.replace(new RegExp(String.raw`(^|\s)${escapedForRegExp(tag)}(?=\s|$)`), "$1")), cell);
  const added = hashtags.filter((tag) => !had.includes(tag));
  return [kept.replace(/\s+/g, " ").trim(), ...added].join(" ");
}

/**
 * A body cell read alone (a cell a hook gives, apart from its table): its
 * content, and every attribute its tags hold, its row's name among them (no
 * row to hold it)
 */
export function decodeCell(raw: string): ModelCell {
  const tags = tagAttributes(raw);
  const attributes = attributesOf(tags);
  if (tags.size) tagsRead.set(attributes, { cell: raw, inTags: new Set(tags.keys()) });
  return { content: unescapeCell(withoutTags(raw)), attributes };
}

/** The table a model was read from (decode's), undefined: one made otherwise */
export function decodedFrom(model: TableModel): Table | undefined {
  return bases.get(model);
}

/**
 * A model written as the markdown of the table another was read from
 * (`read`, decoded: its form, indent and rows as written); none read: as a
 * table of its own
 */
export function encodeOver(model: TableModel, read: TableModel): Table {
  return encode(model, bases.get(read) ?? { indent: "", align: [], rows: [], padded: false });
}

/** A cell read alone (decodeCell) written back as a cell of encode's: as read where unchanged */
export function encodeCell(cell: ModelCell): string {
  return cellMarkdown(cell.content, cell.attributes, () => true);
}

/** A table's header and `rows` (its rows, the first 1, in that order) as plain markdown: no attribute, no metadata row */
export function plainMarkdown(model: TableModel, rows: readonly number[], read?: TableModel): string {
  // Written as it is in the page (a header's hashtags where they are, padding: the form of the table it was read from,
  // or of `read`, the table as the page has it, where it was made of that with edits held), its tags then left out
  const table = encode(model, bases.get(model) ?? (read && bases.get(read)) ?? NO_TABLE);
  const plain = (row: number) => ({ cells: (table.rows[row]?.cells ?? []).map(withoutTags) });
  return serializeTable({ indent: "", align: table.align, padded: table.padded, rows: [plain(0), ...rows.map(plain)] });
}

// What a model no table was read for is written against: no form of its own
const NO_TABLE: Table = { indent: "", align: [], rows: [], padded: false };

/**
 * The metadata row's attributes of the columns of `base` none of the model's
 * columns comes from (their attributes made from those read: renamed, moved,
 * written over as a calculated table's are): kept as written, the column to
 * come back (a calculated table's, matched by its name), unless `deleted`
 * says it went (a write's column map)
 */
function metaOfColumnsGone(model: TableModel, base: Table, deleted: (column: number) => boolean): Record<string, string> {
  const read = models.get(base);
  if (!read || !base.meta) return {};
  const reached = new Set<Attributes>();
  for (const column of model.columns) {
    for (let at: Attributes | undefined = column.attributes; at; at = attributeChangeOf(at)?.from) {
      if (!tagsRead.has(at)) continue;
      reached.add(at);
      break;
    }
  }
  const gone = new Set(read.columns.flatMap((column, c) => (column.attributes.size === 0 || reached.has(column.attributes) || deleted(c) ? [] : [c])));
  return Object.fromEntries(columnsAttributes(base, gone).map((name) => [name, base.meta![name]!]));
}

/**
 * The metadata row's attributes of `base` naming no column (a column renamed
 * by hand) that a write keeps: all but those of an attribute the model set on
 * a column since it was read, which it writes whole (as a writer of the
 * markdown setting every column's values of one did: a sorting stored leaves
 * none of a column renamed since)
 */
function orphansKept(model: TableModel, base: Table): Record<string, string> {
  const { orphans } = columnsMetaOf(base);
  const set = new Set<string>();
  for (const column of model.columns) {
    for (let change = attributeChangeOf(column.attributes); change; change = attributeChangeOf(change.from)) set.add(attributeName(change.owner, change.key));
  }
  return set.size ? Object.fromEntries(Object.entries(orphans).filter(([name]) => !set.has(parseColumnAttribute(name)?.what ?? ""))) : orphans;
}

/** Whether a row's name was set or taken off by a change of its attributes since they were read */
function nameChanged(attributes: Attributes): boolean {
  for (let change = attributeChangeOf(attributes); change; change = attributeChangeOf(change.from)) if (change.owner === CORE && change.key === LINE_NAME_KEY) return true;
  return false;
}

/**
 * A metadata row as the codec names it, read by these headers (what it means by them, its names' form aside: a
 * column of a name others share named with its number)
 */
function namedBy(meta: TableMeta, headerCells: readonly string[]): Record<string, string> {
  const { byColumn, orphans } = columnsMetaOf({ indent: "", padded: false, align: headerCells.map((): Align => ""), rows: [{ cells: headerCells }], meta });
  return columnsMetaNamed(headsOf(headerCells), byColumn, orphans);
}

/** The row of `baseRows` a row's attributes were read with, through the changes made to them since */
function readRowOf(attributes: Attributes, baseRows: ReadonlySet<Row>): Row | undefined {
  for (let at: Attributes | undefined = attributes; at; at = attributeChangeOf(at)?.from) {
    const row = rowOfAttributes.get(at);
    if (row) return baseRows.has(row) ? row : undefined;
  }
  return undefined;
}

/**
 * A model written back as a markdown table, `base` the table it was read from
 * (its form: indent, padding, its rows as written); `deleted`: the columns of
 * `base` that went, their attributes with them (metaOfColumnsGone)
 */
export function encode(model: TableModel, base: Table, deleted: (column: number) => boolean = () => false): Table {
  if (models.get(base) === model) return base;
  // A header cell: as read, else its text and hashtags with its own tags (its own name, tags typed into it)
  const inHeader = (owner: string, key: string, read: ReadonlySet<string> | undefined) => (owner === CORE && key === LINE_NAME_KEY) || !!read?.has(attributeName(owner, key));
  const headerCells = model.columns.map((column) => {
    const read = headers.get(column);
    if (read !== undefined) return read;
    const hashtags = attributeIn(column.attributes, CORE, HASHTAGS_KEY);
    const edited = (cell: string) => withHashtags(cell, hashtags ? hashtags.split(" ") : []);
    // Its text as read where its header's text is the same (its hashtags where they are written, its spaces): only an
    // attribute of it changed, or its hashtags (put at its end)
    // Its text as typed where it was made of one (its hashtags where they were typed), else as read where its text is the
    // same (its hashtags where they are written, its spaces): only an attribute of it changed, or its hashtags (put at
    // its end)
    const typed = typedHeader(column);
    const asRead = changesSinceRead(column.attributes).read?.cell;
    const sameText = asRead !== undefined && unescapeCell(withoutHashtags(withoutTags(asRead))) === column.header;
    return cellMarkdown(typed ?? (sameText ? unescapeCell(withoutTags(edited(asRead))) : headerText(column)), column.attributes, inHeader, edited);
  });
  // The rest of a column's attributes: the metadata row's (its own name and its hashtags are its header's)
  const byColumn = model.columns.map((column): Attributes => {
    const read = changesSinceRead(column.attributes).read?.inTags;
    const rest = new Map<string, Map<string, string>>();
    for (const [owner, own] of column.attributes) {
      for (const [key, value] of own) {
        if (inHeader(owner, key, read) || (owner === CORE && key === HASHTAGS_KEY)) continue;
        let values = rest.get(owner);
        if (!values) rest.set(owner, (values = new Map()));
        values.set(key, value);
      }
    }
    return rest;
  });
  // A row as it was read only where it is the base's (a row of another table, read with its indent, is written anew)
  const baseRows = new Set(base.rows);
  // The rows' names (any case): a name typed into a cell's text is the row's once written, where no other row has it
  const names = new Set(model.rows.flatMap((row) => attributeIn(row.attributes, CORE, LINE_NAME_KEY)?.toLowerCase() ?? []));
  const bodyRows = model.rows.map((row): Row => {
    const read = rows.get(row);
    if (read && baseRows.has(read)) return read;
    const rowCells = row.cells.map((cell) => cells.get(cell)?.cell ?? cellMarkdown(cell.content, cell.attributes, () => true));
    // As an edit of the row it was read from (its first cell read's, else its attributes'): written as it was where its
    // cells are (markdown.ts), its cells past the header kept
    const from = row.cells.map((cell) => cells.get(cell)?.row).find((r) => r !== undefined && baseRows.has(r)) ?? readRowOf(row.attributes, baseRows);
    // Its name in the cell holding it, else its first: where the row has one, had one, or an edit set it (a name tag
    // typed into a cell's text, the row having none, is the text's: read as the row's name once written)
    const name = attributeIn(row.attributes, CORE, LINE_NAME_KEY);
    const at = rowNameIn(rowCells);
    const named = name !== undefined || (from !== undefined && rowNameIn(from.cells.slice(0, base.align.length)) !== undefined) || nameChanged(row.attributes);
    // (A name typed that another row has already, a copy of a row with it: taken off, as a name is unique)
    const typed = !named && at !== undefined;
    const taken = typed && names.has(at.name.toLowerCase());
    if (typed && !taken) names.add(at.name.toLowerCase());
    if (at?.name !== name && rowCells.length && (named || taken)) {
      const column = at?.column ?? 0;
      rowCells[column] = withName(rowCells[column]!, name);
    }
    return from ? { ...from, cells: [...rowCells, ...(beyond.get(from) ?? [])] } : { cells: rowCells };
  });
  const baseHeader = base.rows[0];
  const headerRow: Row = !baseHeader ? { cells: headerCells } : headerCells.length === baseHeader.cells.length && headerCells.every((cell, c) => cell === baseHeader.cells[c]) ? baseHeader : { ...baseHeader, cells: headerCells };
  const meta = columnsMetaNamed(headsOf(headerCells), byColumn, { ...orphansKept(model, base), ...metaOfColumnsGone(model, base, deleted) });
  const same = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>> | undefined) =>
    !!b && Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
  return {
    ...base,
    align: model.columns.map((column) => column.align),
    rows: [headerRow, ...bodyRows],
    attributes: model.attributes === (base.attributes ?? NO_ATTRIBUTES) ? base.attributes : model.attributes,
    // (No metadata row read and none to write: none; one meaning by the headers written what the one read means,
    // though named another way (a column of a name others share without its number): as read)
    meta: same(meta, base.meta) || (base.meta && same(meta, namedBy(base.meta, headerCells))) ? base.meta : Object.keys(meta).length || base.meta ? meta : undefined,
  };
}
