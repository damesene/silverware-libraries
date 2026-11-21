// Tables kept as markdown in pages (docs/silverware-table-store-plan.md,
// *Stores*): a page's tables read from its text, keyed by the register
// (core/tables.ts, which matches a page's tables to keys as its text
// changes), each model parsed by markdown.ts (its cache by text makes a read
// of the same text free); written through the page writer (shared/pages/),
// by the parts of tableparts.ts (step 4b).
import { findTables, minimalEdit, parseTable, type Table, type TableRange } from "../../markdown.ts";
import { decode, decodedFrom, encode, encodeOver } from "./codec.ts";
import { metadataOf, withoutMetadata } from "./metadata.ts";
import type { TablePlatform } from "../../core/platform.ts";
import {
  type InsertAt,
  type MetadataPart,
  type StoredMetadata,
  type PageFormula,
  type PageFormulaStore,
  type StoredTable,
  type TablePlan,
  type TableReport,
  type TableRevision,
  type TableSkip,
  type TableStore,
  type TableTransaction,
  type TableWriteEdit,
  validateTransaction,
} from "../../core/store.ts";
import { pageFormulasIn } from "./pageformulas.ts";
import { cursorPlace, found, newTableMarkdown, newTablePlace, type NewTablePlace, tableAt, tableEdits, type TableInsert, type TableWrite } from "./tableparts.ts";
import { pageFormulaPlace } from "./pageformulas.ts";
import { mapPosition, type TableWritten, type TextEdit, withWriteListeners } from "./writelisteners.ts";
import { written as textWritten } from "../../../../shared/pages/parts.ts";
import type { EditResult } from "../../../../shared/pages/tags/edit.ts";
import type { TableModel } from "../../model/model.ts";
import { type PageBuilder, pageChanges } from "../../../../shared/pages/changes.ts";
import { type ApplyReport, type PagePlan, type PageWriter, pageWriter } from "../../../../shared/pages/writer.ts";
import type { Space } from "../../../../shared/platform.ts";
import type { TableKey, TableRegister } from "../../core/tables.ts";

/** A table's revision in a page: its markdown, which is all its model is made of (the same text, the same model) */
export function revisionOf(markdown: string): TableRevision {
  return markdown as TableRevision;
}

/** A page's text read as the platform has it: the editor's for the page open, else the space's; undefined: not there */
async function textOf(platform: Pick<TablePlatform, "editor" | "space">, document: string): Promise<string | undefined> {
  if ((await platform.editor.documentName()) === document) return platform.editor.text();
  if (!platform.space) return undefined;
  try {
    return await platform.space.read(document);
  } catch {
    return undefined;
  }
}

// A platform with no space: only the page open is there
const NO_SPACE: Space = {
  read: (name) => {
    throw new Error(`no page ${name} but the one open`);
  },
  write: (name) => {
    throw new Error(`no page ${name} but the one open`);
  },
  list: () => [],
};

/**
 * Before a write of the open page, once it is planned: the text as read, the
 * span of its tables (the history marker goes outside it), the range the edit
 * changes; what it gives is run once the write is made, told where a place of
 * the text read went (SilverBullet's binding: the history marker, by the
 * adapter's modules)
 */
export type BeforeWrite = (
  text: string,
  span: { readonly from: number; readonly to: number },
  edit: { readonly from: number; readonly to: number },
) => Promise<((moved: (position: number, after: boolean) => number) => void) | undefined>;

/**
 * A table plan's own: the writer's plan of its page, the new tables' markdown
 * (their keys made as it is applied, or the caller's), the keys it writes, and
 * the open page's write as BeforeWrite sees it
 */
type PlanOwn = {
  readonly page: PagePlan;
  readonly inserted: readonly { readonly markdown: string; readonly key: TableKey | undefined }[];
  readonly written: readonly TableKey[];
  readonly open?: OpenWrite;
  // What the write is made of, for its open write made anew on the page changed since (the writer plans it anew)
  readonly of: WriteOf;
};

/** The open page's write as BeforeWrite sees it: the text it is made on, the span of its tables, the text it makes, where places go */
type OpenWrite = { readonly text: string; readonly span: { readonly from: number; readonly to: number }; readonly made: string; readonly moved: (position: number, after: boolean) => number };

/** A transaction as the writer's changes: its tables written and new, its page formulas, what other plugins are told */
type WriteOf = { readonly tables: readonly TableWrite[]; readonly inserts: readonly TableInsert[]; readonly formulas: readonly PageFormula[]; readonly told: readonly TableWritten[] };

/**
 * Other plugins' edits of a write (silverware.table.onWrite) as the page
 * writer's text edit, after the tables' changes: what they made (`listened`)
 * of the text the write made (`made`); made again where the writer plans the
 * write anew on a text changed meanwhile (the open page)
 */
function listenersEdit(made: string, listened: { readonly text: string }, told: readonly TableWritten[]): (text: string) => Promise<EditResult> {
  return async (text) => {
    const now = text === made ? listened : await withWriteListeners(text, told);
    return { text: now.text, changes: now.text === text ? 0 : 1 };
  };
}

/** Whether two ranges of a text overlap */
const overlaps = (a: { readonly from: number; readonly to: number }, b: { readonly from: number; readonly to: number }) => a.from < b.to && a.to > b.from;

/** A skip of the writer's as the store's (its causes are the same) */
const skipOf = (skipped: { readonly cause: TableSkip["cause"]; readonly reason: string }): TableSkip => ({ cause: skipped.cause, reason: skipped.reason });

export class MarkdownStore implements TableStore, PageFormulaStore {
  // The writer over the platform as it is (a writer keeps what it planned and wrote, for apply and undo)
  private writing: { readonly platform: Pick<TablePlatform, "editor" | "space">; readonly writer: PageWriter } | undefined;
  private readonly plans = new WeakMap<TablePlan, PlanOwn>();
  private readonly reports = new WeakMap<TableReport, ApplyReport>();
  // The tables the store made of a table read (withoutMetadata): written as they are, over the one they were made of
  private readonly made = new WeakSet<Table>();
  // Each document's tables as last read, by revision: a write encodes a model over the very table it was decoded from
  // (the codec tells a column the model keeps from one gone by what it read), which a parse again need not be
  private readonly read = new Map<string, ReadonlyMap<TableRevision, Table>>();
  // Where each table was in the page's text as last read, and that text
  private readonly places = new Map<string, ReadonlyMap<TableKey, { readonly from: number; readonly to: number }>>();
  private readonly texts = new Map<string, string>();
  private readonly tablesRead = new Map<string, readonly StoredTable[]>();

  /** Where a table is in its page's text as it is now, with that text; undefined: the page or the table not there */
  async rangeNow(document: string, key: TableKey): Promise<{ readonly text: string; readonly range: TableRange } | undefined> {
    const text = await textOf(this.platform(), document);
    if (text === undefined) return undefined;
    const range = findTables(text)[this.register.keysOf(document, text).indexOf(key)];
    return range && { text, range };
  }

  /** The keys of a page's tables in a text of it, in order (the register's) */
  keysOf(document: string, text: string): readonly TableKey[] {
    return this.register.keysOf(document, text);
  }

  /** A page's text as last read (its tables': tables, tablesOfText); undefined: not read */
  lastText(document: string): string | undefined {
    return this.texts.get(document);
  }

  /** Where a table is in its page's text as last read (a custom menu's table's `from`, `to`); undefined: not read */
  placeOf(document: string, key: TableKey): { readonly from: number; readonly to: number } | undefined {
    return this.places.get(document)?.get(key);
  }

  constructor(
    private readonly platform: () => Pick<TablePlatform, "editor" | "space">,
    private readonly register: TableRegister,
    // How a table is written (the formatting setting's: autoFormat)
    private readonly serializer: () => Promise<(table: Table) => string>,
    // Before a write of the open page (the binding's: the history marker)
    private readonly beforeWrite?: BeforeWrite,
  ) {}

  private writer(): PageWriter {
    const platform = this.platform();
    if (this.writing?.platform !== platform) this.writing = { platform, writer: pageWriter({ editor: platform.editor, space: platform.space ?? NO_SPACE }) };
    return this.writing.writer;
  }

  async tables(document: string): Promise<readonly StoredTable[] | null> {
    const text = await textOf(this.platform(), document);
    return text === undefined ? null : this.tablesOfText(document, text);
  }

  /**
   * A page's tables in its text as read (by its binding: a rendered table
   * paired with one), kept as the last read of the page: what a write encodes
   * over, where each is (placeOf)
   */
  tablesOfText(document: string, text: string): readonly StoredTable[] {
    // (The page's text as read last again, every rendered table paired with it: its tables as read then)
    const kept = this.texts.get(document) === text ? this.tablesRead.get(document) : undefined;
    if (kept) return kept;
    const keys = this.register.keysOf(document, text);
    const read = new Map<TableRevision, Table>();
    const places = new Map<TableKey, { readonly from: number; readonly to: number }>();
    // A table of the same text as read before is the table then (the same object, parsed once: what the models read
    // of it are written over; parseTable keeps a few only)
    const before = this.read.get(document);
    const tables = findTables(text).map((range): StoredTable => {
      const table = before?.get(revisionOf(range.text)) ?? parseTable(range.text);
      const key = keys[range.ordinal]!;
      read.set(revisionOf(range.text), table);
      places.set(key, { from: range.from, to: range.to });
      return { key, revision: revisionOf(range.text), model: decode(table) };
    });
    this.read.set(document, read);
    this.places.set(document, places);
    this.texts.set(document, text);
    this.tablesRead.set(document, tables);
    return tables;
  }

  documentOf(key: TableKey): string | undefined {
    return this.register.pageOf(key);
  }

  async plan(transaction: TableTransaction): Promise<TablePlan> {
    const { document } = transaction;
    const left = (skipped: TableSkip): TablePlan => ({ document, changes: 0, skipped });
    const invalid = validateTransaction(transaction);
    if (invalid) return left({ cause: "refused", reason: invalid });
    const platform = this.platform();
    const text = await textOf(platform, document);
    if (text === undefined) return left({ cause: "missing", reason: "the document is not there" });
    const ranges = findTables(text);
    const keys = this.register.keysOf(document, text);
    const serialize = await this.serializer();
    const writes: TableWrite[] = [];
    const inserts: (TableInsert & { readonly key?: TableKey })[] = [];
    // What other plugins are told of the tables written, the tables' spans (what a history marker goes outside of), the keys written
    const told: TableWritten[] = [];
    const spans: { readonly from: number; readonly to: number }[] = [];
    const written: TableKey[] = [];
    // Where each table written or taken out is in the text read (a page formula in one is the table's)
    const placesRead = new Map<TableKey, { readonly from: number; readonly to: number }>();
    for (const edit of transaction.edits) {
      if (edit.kind === "insert") {
        const after = edit.after === undefined ? undefined : ranges[keys.indexOf(edit.after)];
        if (edit.after !== undefined && !after) return left({ cause: "changed", reason: "the table a new one goes after is not there" });
        const markdown = newTableMarkdown(edit.model, after ? parseTable(after.text).indent : "", serialize);
        const place: NewTablePlace | undefined = after ? { after: tableAt(text, after) } : (edit.at as NewTablePlace | undefined);
        const where = newTablePlace(text, place);
        if ("problem" in where) return left({ cause: "changed", reason: where.problem });
        inserts.push({ markdown, ...(place ? { place } : {}), ...(edit.key ? { key: edit.key } : {}) });
        spans.push({ from: after ? after.from : where.at, to: where.at });
        continue;
      }
      const range = ranges[keys.indexOf(edit.key)];
      if (!range) return left({ cause: "changed", reason: "a table of it is not there" });
      if (revisionOf(range.text) !== edit.expects) return left({ cause: "changed", reason: "a table of it changed since it was read" });
      spans.push(range);
      written.push(edit.key);
      placesRead.set(edit.key, range);
      if (edit.kind === "remove") {
        writes.push({ ...tableAt(text, range), markdown: undefined });
        continue;
      }
      const read = this.tableRead(document, edit.expects, range.text);
      const { columnMap } = edit;
      const after = this.encoded(edit.model, read, edit);
      const markdown = serialize(after);
      writes.push({ ...tableAt(text, range), markdown });
      told.push({ before: read, after, markdown, ...(columnMap ? { columnMap } : {}) });
    }
    // The page formulas: each where it is in the text as read; one in a table written is the table's
    const formulas: PageFormula[] = [];
    const formulaEdits: TextEdit[] = [];
    const formulasLeft: string[] = [];
    for (const formula of transaction.formulas ?? []) {
      const place = pageFormulaPlace(document, text, formula);
      if ("problem" in place) {
        formulasLeft.push(place.problem);
        continue;
      }
      if (written.some((key) => overlaps(placesRead.get(key)!, place)) || formulaEdits.some((one) => place.from < one.to && place.to > one.from)) continue;
      formulas.push(formula);
      formulaEdits.push({ from: place.from, to: place.to, text: formula.text });
    }
    // The text the tables and formulas make (as the writer's parts make it), then what other plugins write with it
    const tablesChange = { tables: writes, inserts };
    const of: WriteOf = { ...tablesChange, formulas, told };
    const write = await this.openWrite(document, text, of);
    if ("problem" in write) return left({ cause: "changed", reason: write.problem });
    const { made, listened } = write;
    const page = await this.writer().plan(
      pageChanges()
        .page(document, (p) => {
          this.tablesChanges(p, document, formulas, tablesChange);
          p.editText(listenersEdit(made, listened, told));
        })
        .build(),
      { replanOpenPage: true },
    );
    const skipped = page.skipped[0];
    if (skipped) return left(skipOf(skipped));
    const plan: TablePlan = { document, changes: page.pages.length ? transaction.edits.length + formulas.length : 0, ...(formulasLeft.length ? { formulasLeft } : {}) };
    // The open page's write as the binding's hook sees it
    const open = (await platform.editor.documentName()) === document && spans.length ? write.open : undefined;
    this.plans.set(plan, { page, inserted: inserts.map((one) => ({ markdown: one.markdown, key: one.key })), written, of, ...(open ? { open } : {}) });
    return plan;
  }

  /**
   * A write in a page's text: the text its tables and page formulas make (as
   * the writer's parts make it), what other plugins write with it, and the
   * open page's write as BeforeWrite sees it (the span of its tables, where
   * places go); or why it cannot be made there
   */
  private async openWrite(
    document: string,
    text: string,
    of: WriteOf,
  ): Promise<{ readonly made: string; readonly listened: { readonly text: string; readonly edits: TextEdit[][] }; readonly open: OpenWrite } | { readonly problem: string }> {
    const change = { tables: of.tables, inserts: of.inserts };
    const edits = tableEdits(text, change);
    if ("problem" in edits) return { problem: edits.problem };
    // Where the tables are in this text: those written and taken out, the place of each new one (after its table)
    const spans: { readonly from: number; readonly to: number }[] = [];
    for (const one of of.tables) {
      const range = found(text, one);
      if (range) spans.push(range);
    }
    for (const insert of of.inserts) {
      const where = newTablePlace(text, insert.place);
      if ("problem" in where) continue;
      const after = insert.place && "after" in insert.place ? found(text, insert.place.after) : undefined;
      spans.push({ from: after ? after.from : where.at, to: where.at });
    }
    const formulaEdits: TextEdit[] = [];
    for (const formula of of.formulas) {
      const place = pageFormulaPlace(document, text, formula);
      if (!("problem" in place)) formulaEdits.push({ from: place.from, to: place.to, text: formula.text });
    }
    let made = text;
    for (const one of pageChanges().page(document, (p) => this.tablesChanges(p, document, of.formulas, change)).build()[0]!.changes) made = (await textWritten(made, one, {})).text;
    const listened = await withWriteListeners(made, of.told);
    const span = spans.length ? { from: Math.min(...spans.map((one) => one.from)), to: Math.max(...spans.map((one) => one.to)) } : { from: 0, to: 0 };
    return {
      made,
      listened,
      open: { text, span, made: listened.text, moved: (position, after) => mapPosition(position, after, [[...formulaEdits, ...edits], ...listened.edits]) },
    };
  }

  /** A transaction's changes of the writer's: its page formulas first (found by their order, which a table written first could change), its tables */
  private tablesChanges(p: PageBuilder, document: string, formulas: readonly PageFormula[], tables: { readonly tables: readonly TableWrite[]; readonly inserts: readonly TableInsert[] }): void {
    for (const formula of formulas) p.tables.setPageFormula(document, formula);
    if (tables.tables.length || tables.inserts.length) p.tables.write(tables.tables, tables.inserts);
  }

  async apply(plan: TablePlan): Promise<TableReport> {
    const { document } = plan;
    const own = this.plans.get(plan);
    const none = new Map<TableKey, TableRevision>();
    if (plan.skipped || !own) return { document, written: false, inserted: [], revisions: none, skipped: plan.skipped ?? { cause: "refused", reason: "not planned by this store, or applied already" } };
    // (Once: applied again on the open page, it would be planned anew on what it wrote, a new table made twice)
    this.plans.delete(plan);
    // The new tables' keys, made before they are written (the register gives each the table of its text): one reserved
    // by the caller, else the store's own
    const inserted = own.inserted.map(({ markdown, key }) => {
      const made = key ?? this.register.reserve(document);
      this.register.writing(made, markdown.trimEnd());
      return { key: made, own: !key };
    });
    // Not written (left, or failed: an exception), the keys the store made for its new tables go: no table gets one
    const release = () => {
      for (const one of inserted) if (one.own) this.register.release(one.key);
    };
    let page: ApplyReport;
    let then: ((moved: (position: number, after: boolean) => number) => void) | undefined;
    // The open page changed since it was planned (the writer plans it anew on it): its write as it is made on it now
    let open = own.open;
    if (open) {
      const now = await this.platform().editor.text();
      if (now !== open.text) {
        const anew = await this.openWrite(document, now, own.of);
        open = "problem" in anew ? undefined : anew.open;
      }
    }
    try {
      then = open && (await this.beforeWrite?.(open.text, open.span, minimalEdit(open.text, open.made)));
      page = await this.writer().apply(own.page);
    } catch (e) {
      release();
      throw e;
    }
    const skipped = page.skipped[0];
    if (skipped) {
      release();
      return { document, written: false, inserted: [], revisions: none, skipped: skipOf(skipped) };
    }
    if (then && open) then(open.moved);
    // Each table written or made, as it is now
    const keys = new Set([...own.written, ...inserted.map((one) => one.key)]);
    const now = keys.size ? ((await this.tables(document)) ?? []) : [];
    const revisions = new Map(now.filter((table) => keys.has(table.key)).map((table) => [table.key, table.revision]));
    const report: TableReport = { document, written: page.written.length > 0, inserted: inserted.map((one) => one.key), revisions };
    this.reports.set(report, page);
    return report;
  }

  async planUndo(report: TableReport): Promise<TablePlan> {
    const { document } = report;
    const written = this.reports.get(report);
    if (!written) return { document, changes: 0, skipped: { cause: "refused", reason: "not written by this store" } };
    const page = await this.writer().planUndo(written);
    const skipped = page.skipped[0];
    if (skipped) return { document, changes: 0, skipped: skipOf(skipped) };
    const plan: TablePlan = { document, changes: page.pages.length };
    this.plans.set(plan, { page, inserted: [], written: [], of: { tables: [], inserts: [], formulas: [], told: [] } });
    return plan;
  }

  metadataOf(table: TableModel, part: MetadataPart | "all"): StoredMetadata {
    // (Its markdown as read: what it stores is written there, the metadata of no column too)
    return metadataOf(encodeOver(table, table), part);
  }

  withoutMetadata(table: TableModel, part: MetadataPart | "all"): TableModel {
    // (Read back from its markdown without it: written as that markdown is, the metadata of no column gone too)
    const made = withoutMetadata(encodeOver(table, table), part);
    this.made.add(made);
    return decode(made);
  }

  async writesSame(document: string, read: StoredTable, model: TableModel, options: Pick<TableWriteEdit, "tidy" | "columnMap"> = {}): Promise<boolean> {
    const serialize = await this.serializer();
    return serialize(this.encoded(model, this.tableRead(document, read.revision, read.revision), options)) === read.revision;
  }

  /** A table of a page as last read by its revision (its text: parsed again where not kept) */
  private tableRead(document: string, revision: TableRevision, text: string): Table {
    return this.read.get(document)?.get(revision) ?? parseTable(text);
  }

  /**
   * A model written as a table of a page over `read`, the table it replaces:
   * over the very table its model was read from (the codec knows what it
   * read of it), the table read or one the store made of it (a table without
   * its metadata, written as it is), never another table (of this page or
   * another, read before); tidy:
   * every row written anew, padded; the columns the column map deletes taking
   * their metadata with them
   */
  private encoded(model: TableModel, read: Table, options: Pick<TableWriteEdit, "tidy" | "columnMap">): Table {
    const from = decodedFrom(model);
    const over = from && (from === read || this.made.has(from)) ? from : read;
    const { columnMap } = options;
    // (Encoded over the table itself, which the codec knows: the metadata of a column gone kept; padded once written)
    const encoded = encode(model, over, columnMap && ((column) => columnMap(column) === undefined));
    return options.tidy ? { ...encoded, padded: true } : encoded;
  }

  asRead(model: TableModel): TableModel {
    return decode(encode(model, { indent: "", align: [], rows: [], padded: false }));
  }

  /** Where a new table goes in the open page: where its cursor is (insert's `at`); undefined: not open, or no cursor */
  async insertAtCursor(document: string): Promise<InsertAt | undefined> {
    const { editor } = this.platform();
    if ((await editor.documentName()) !== document || !editor.cursor) return undefined;
    // The cursor as it is with the text (the editor moved it with any edit made meanwhile)
    const text = await editor.text();
    return cursorPlace(text, await editor.cursor()) as unknown as InsertAt;
  }

  async pageFormulas(document: string): Promise<readonly PageFormula[] | null> {
    const text = await textOf(this.platform(), document);
    return text === undefined ? null : pageFormulasIn(document, text);
  }
}

/** A page's tables in its text, in order, keyed by the register */
export function tablesIn(register: TableRegister, document: string, text: string): readonly StoredTable[] {
  const keys = register.keysOf(document, text);
  return findTables(text).map((range) => ({ key: keys[range.ordinal]!, revision: revisionOf(range.text), model: decode(parseTable(range.text)) }));
}
