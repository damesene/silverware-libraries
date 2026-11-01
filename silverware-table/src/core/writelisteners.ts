// What other plugins write with Silverware Table's writes (silverware.table.onWrite
// on the API page): functions given the page's text as a write leaves it and
// a context to ask what the write did, each giving edits of the text outside
// the tables, written in the same edit (one undo step). Silverware Table knows
// nothing of what they are for (a chart's data, Silverware Chart's). An edit
// that would touch a table, reach past the text or overlap another is left
// out and logged: it never fails the table's write.
//
// The context is functions, not data: what a listener may ask (a table's name
// now, a column's name now) is the contract, how the write keeps it is not,
// so it can change without breaking a listener.
import { columnName } from "../columns.ts";
import { findTables, type Table } from "../markdown.ts";
import { metaName } from "../meta.ts";
import { columnNameIn } from "../names.ts";

export type TextEdit = { readonly from: number; readonly to: number; readonly text: string };

/** A table written, as a listener asks about it */
export type WrittenTable = {
  /** Its name now (undefined: it has none) */
  readonly name: string | undefined;
  /** The name a column has now that had `before` before the write (any case); undefined where it was deleted or there was none */
  column(before: string): string | undefined;
};

/** What a write did, as a listener asks about it */
export type WriteContext = {
  /** Whether a table or a column was renamed in the write */
  renamed(): boolean;
  /** The table that had this name before the write, if the write wrote it (any case) */
  table(before: string): WrittenTable | undefined;
  /** The table written that is at `at` in the text the listener is given, if the write wrote one there */
  tableAt(at: number): WrittenTable | undefined;
};

export type WriteListener = (text: string, context: WriteContext) => unknown;

/** A table a write changed: as it was and as it is written (its markdown), and where each column went (undefined: deleted) */
export type TableWritten = {
  readonly before: Table;
  readonly after: Table;
  readonly markdown: string;
  readonly columnMap?: (column: number) => number | undefined;
};

/** A column's name as names are compared: its fixed name, else its header's */
function nameOfColumn(table: Table, column: number): string {
  return columnNameIn(table, column) ?? columnName(table.rows[0]?.cells[column] ?? "");
}

const same = (a: string | undefined, b: string | undefined) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/** The context of a write of these tables, for listeners each given `text` */
export function writeContext(written: readonly TableWritten[], text: () => string): WriteContext {
  const tables = written.map(({ before, after, markdown, columnMap }) => {
    const width = before.rows[0]?.cells.length ?? 0;
    // Where each column went: as the write says, else (a cell or a header written) each where it was
    const went = (column: number) => (columnMap ? columnMap(column) : column < (after.rows[0]?.cells.length ?? 0) ? column : undefined);
    const columns = Array.from({ length: width }, (_, i) => {
      const now = went(i);
      return { before: nameOfColumn(before, i), after: now === undefined ? undefined : nameOfColumn(after, now) };
    });
    const nameBefore = metaName(before);
    const nameAfter = metaName(after);
    const view: WrittenTable = {
      name: nameAfter,
      column: (name) => columns.find((c) => same(c.before, name))?.after,
    };
    return { markdown: markdown.trimEnd(), nameBefore, view, renamed: !same(nameBefore, nameAfter) || columns.some((c) => c.after !== undefined && c.after !== c.before) };
  });
  return {
    renamed: () => tables.some((t) => t.renamed),
    table: (name) => tables.find((t) => t.nameBefore !== undefined && same(t.nameBefore, name))?.view,
    tableAt: (at) => {
      const found = findTables(text()).find((range) => at >= range.from && at <= range.to);
      return found ? tables.find((t) => t.markdown === found.text.trimEnd())?.view : undefined;
    },
  };
}

let listeners: WriteListener[] = [];
let fresh = true;

/** A function told of every write (replacing those of before on the first after Space Lua loaded again) */
export function addWriteListener(listener: WriteListener): void {
  if (fresh) {
    listeners = [];
    fresh = false;
  }
  listeners.push(listener);
}

/** Space Lua loads (again): the listeners given anew, those of before kept until the first of them */
export function writeListenersAnew(): void {
  fresh = true;
}

/** A list as handed over from Space Lua: an array, or a Lua table as an object with its items under 1, 2, … */
function listOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.every(([key], i) => key === String(i + 1)) ? entries.map(([, item]) => item) : [];
}

function editOf(value: unknown): TextEdit | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { from, to, text } = value as Record<string, unknown>;
  if (!Number.isInteger(from) || !Number.isInteger(to) || typeof text !== "string") return undefined;
  return { from: from as number, to: to as number, text };
}

/**
 * The text a write leaves with the listeners' edits in it: each told the
 * text as the tables were written (in turn, each seeing the edits of those
 * before it) and what the write did to them, its edits checked against that
 * text and its tables
 */
export async function withWriteListeners(written: string, tablesWritten: readonly TableWritten[] = []): Promise<string> {
  let text = written;
  const context = writeContext(tablesWritten, () => text);
  for (const listener of listeners) {
    let given: unknown;
    try {
      given = await listener(text, context);
    } catch (e) {
      console.error("Silverware Table: a write listener failed", e);
      continue;
    }
    const tables = findTables(text);
    const edits: TextEdit[] = [];
    for (const item of listOf(given)) {
      const edit = editOf(item);
      const problem = !edit
        ? "not { from, to, text }"
        : edit.from < 0 || edit.to > text.length || edit.to < edit.from
          ? "outside the text"
          : tables.some((t) => edit.from < t.to && edit.to > t.from)
            ? "in a table"
            : edits.some((e) => edit.from < e.to && edit.to > e.from)
              ? "over another edit"
              : undefined;
      if (problem) console.error(`Silverware Table: a write listener's edit left out (${problem})`, item);
      else edits.push(edit!);
    }
    for (const edit of [...edits].sort((a, b) => b.from - a.from)) text = text.slice(0, edit.from) + edit.text + text.slice(edit.to);
  }
  return text;
}
