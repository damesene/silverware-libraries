// The markdown store's parts of the page writer (shared/pages/, docs/silverware-table-store-plan.md,
// step 4b): a page's tables and its page formulas written as the writer's
// changes, data that finds what it changes in the page's text as it is when
// written (a table by its text and its order among the tables alike, as the
// writer finds a code block; a page formula by its key), so the writer can
// plan a write anew on the open page changed since it was read
// (`replanOpenPage`). The tables of one write are one change, each found in
// the text before any of them is written: two tables alike written in one
// edit are each the one it was. The codec stays the table's: the markdown written is
// made by it, these parts only put it in its place. Registered with this
// plugin's writer as this module loads (each plugin bundles shared/ of its own).
import { definePluginPart, registerPart } from "../../../../shared/pages/parts.ts";
import type { PageBuilder } from "../../../../shared/pages/changes.ts";
import type { PageFormula } from "../../core/store.ts";
import { findTables, type Table, tablePlace, type TableRange } from "../../markdown.ts";
import type { TableModel } from "../../../../shared/table/model.ts";
import { encode } from "./codec.ts";
import { pageFormulaPlace } from "./pageformulas.ts";

/** A table of a page as a change finds it: its text as read, its order among the page's tables of that text (from 0), and how many there were */
type TableAt = { readonly text: string; readonly occurrence: number; readonly of: number };

/** Where a new table goes: after a table, or where the cursor was (its offset, and its line as read: changed since, refused); none: the page's end */
export type NewTablePlace = { readonly after: TableAt } | { readonly cursor: { readonly position: number; readonly line: string } };

/** A table of a write: found as read, written as this markdown (none: taken out, with the empty line after it) */
export type TableWrite = TableAt & { readonly markdown: string | undefined };

/** A new table of a write: its markdown and where it goes (none: the page's end), an empty line around it */
export type TableInsert = { readonly markdown: string; readonly place?: NewTablePlace };

/** The changes the tables' part writes: tables of the page written in one change */
type WriteTables = { readonly kind: "writeTables"; readonly tables: readonly TableWrite[]; readonly inserts: readonly TableInsert[] };
/** The change the page formulas' part writes: a formula written in the page's text */
type SetPageFormula = { readonly kind: "setPageFormula"; readonly formula: PageFormula; readonly document: string };

/**
 * A new table's markdown: the model written as a table of its own (none read),
 * indented as the table it goes after (`indent`), each row anew (a line read
 * elsewhere, a table made from markdown, is not its line nor indented as it)
 */
export function newTableMarkdown(model: TableModel, indent: string, serialize: (table: Table) => string): string {
  const encoded = encode(model, { indent, align: [], rows: [], padded: false });
  return serialize({ ...encoded, rows: encoded.rows.map((row) => ({ cells: row.cells })) });
}

/** A table range of a page as a change finds it again */
export function tableAt(text: string, range: TableRange): TableAt {
  const alike = findTables(text).filter((one) => one.text === range.text);
  return { text: range.text, occurrence: alike.findIndex((one) => one.from === range.from), of: alike.length };
}

/** The table a change names in the text as it is now; undefined: changed since it was read (another of its text made, or it gone) */
export function found(text: string, at: TableAt): TableRange | undefined {
  const alike = findTables(text).filter((one) => one.text === at.text);
  return alike.length === at.of ? alike[at.occurrence] : undefined;
}

/**
 * What a table taken out of a page takes with it: its range and the empty
 * line after it; the page's last, the empty line before it (one line break
 * kept). At the page's start one line break stays: the editor's cursor goes
 * there, not into what follows (a table)
 */
export function removedSpan(text: string, range: TableRange): { readonly from: number; readonly to: number } {
  let from = range.from;
  let to = range.to;
  const next = /^[ \t]*(\r?\n)+/.exec(text.slice(to))?.[0] ?? "";
  if (to + next.length < text.length) to += from === 0 && next.length ? next.length - (next.endsWith("\r\n") ? 2 : 1) : next.length;
  else {
    to = text.length;
    const previous = /(\r?\n)+$/.exec(text.slice(0, from))?.[0] ?? "";
    from -= Math.max(0, previous.length - (previous.endsWith("\r\n") ? 2 : 1));
  }
  return { from, to };
}

/** The line a position is on (its text, no line break) */
function lineAt(text: string, position: number): string {
  const start = text.lastIndexOf("\n", position - 1) + 1;
  const end = text.indexOf("\n", position);
  return text.slice(start, end < 0 ? text.length : end);
}

/** The place where the cursor is in a page's text, for a new table (insertTable) */
export function cursorPlace(text: string, position: number): NewTablePlace {
  return { cursor: { position, line: lineAt(text, position) } };
}

/** Where a new table goes in a page's text and what goes around it; or why it cannot go there (the table it goes after changed, the cursor's line) */
export function newTablePlace(text: string, place: NewTablePlace | undefined): { readonly at: number; readonly before: string; readonly after: string } | { readonly problem: string } {
  if (!place) return tablePlace(text);
  if ("after" in place) {
    const range = found(text, place.after);
    return range ? tablePlace(text, { after: range }) : { problem: "the table it goes after changed since it was read" };
  }
  const { position, line } = place.cursor;
  if (position > text.length || lineAt(text, position) !== line) return { problem: "the page changed where the cursor was" };
  return tablePlace(text, { position });
}

const CHANGED = "a table changed since it was read";

/** A write's tables in a page's text as it is: the edits they make, or why they cannot be made (the store's too: where places go) */
export function tableEdits(text: string, change: { readonly tables: readonly TableWrite[]; readonly inserts: readonly TableInsert[] }): { readonly from: number; readonly to: number; readonly text: string }[] | { readonly problem: string } {
  const edits: { from: number; to: number; text: string }[] = [];
  for (const one of change.tables) {
    const range = found(text, one);
    if (!range) return { problem: CHANGED };
    edits.push(one.markdown === undefined ? { ...removedSpan(text, range), text: "" } : { from: range.from, to: range.to, text: one.markdown });
  }
  for (const insert of change.inserts) {
    const where = newTablePlace(text, insert.place);
    if ("problem" in where) return { problem: where.problem };
    edits.push({ from: where.at, to: where.at, text: where.before + insert.markdown + where.after });
  }
  return edits;
}

/**
 * The tables of a page (a page's builder: `p.part(TABLES).write(…)`): tables written in one change, each found as
 * read (its text, which of those alike) before any is written, written as its markdown or taken out (the empty line
 * after it with it; the page's last, the one before); `inserts`: new tables, each put where its place says (found in
 * the text as read too)
 */
export const TABLES = definePluginPart<WriteTables, { write(tables: readonly TableWrite[], inserts?: readonly TableInsert[]): PageBuilder }>({
  name: "tables",
  kinds: ["writeTables"],
  section: (add) => ({ write: (tables, inserts = []) => add({ kind: "writeTables", tables, inserts }) }),
  write: (text, change) => {
    const edits = tableEdits(text, change);
    if ("problem" in edits) return { text, changes: 0, problem: edits.problem };
    // From the last up, so each edit's place is as found (a new table after one written: after it, as it is written);
    // new tables at one place the last given first, so each goes before the one after it, in the order given
    let written = text;
    const order = edits.map((edit, index) => ({ edit, index })).sort((a, b) => b.edit.from - a.edit.from || b.edit.to - a.edit.to || b.index - a.index);
    for (const { edit } of order) written = written.slice(0, edit.from) + edit.text + written.slice(edit.to);
    return { text: written, changes: written === text ? 0 : edits.length };
  },
});

/** The formulas written in a page's text (a page's builder: `p.part(PAGE_FORMULAS).set(…)`), each by its key, given its new text */
export const PAGE_FORMULAS = definePluginPart<SetPageFormula, { set(document: string, formula: PageFormula): PageBuilder }>({
  name: "pageFormulas",
  kinds: ["setPageFormula"],
  section: (add) => ({ set: (document, formula) => add({ kind: "setPageFormula", document, formula }) }),
  write: (text, change) => {
    const place = pageFormulaPlace(change.document, text, change.formula);
    if ("problem" in place) return { text, changes: 0, problem: `a formula written in the page: ${place.problem}` };
    return { text: text.slice(0, place.from) + change.formula.text + text.slice(place.to), changes: 1 };
  },
});

registerPart(TABLES);
registerPart(PAGE_FORMULAS);
