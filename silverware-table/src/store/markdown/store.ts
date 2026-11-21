// Tables kept as markdown in pages (docs/silverware-table-store-plan.md,
// *Stores*): a page's tables read from its text, keyed by the register
// (core/tables.ts, which matches a page's tables to keys as its text
// changes), each model parsed by markdown.ts (its cache by text makes a read
// of the same text free); written through the page writer (shared/pages/),
// by the parts of tableparts.ts (step 4b).
import { findTables, parseTable, type Table } from "../../markdown.ts";
import { decode, encode } from "./codec.ts";
import type { TablePlatform } from "../../core/platform.ts";
import type { PageFormula, PageFormulaStore, StoredTable, TablePlan, TableReport, TableRevision, TableSkip, TableStore, TableTransaction } from "../../core/store.ts";
import { pageFormulasIn } from "./pageformulas.ts";
import { newTableMarkdown, tableAt, type TableInsert, type TableWrite } from "./tableparts.ts";
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

/** What a write of a page did: written, nothing to write, or not written and why */
export type PageWritten = { readonly result: "written" | "unchanged" } | { readonly result: "failed"; readonly reason: string };

/** A table plan's own: the writer's plan of its page, the new tables' markdown (their keys made as it is applied) */
type PlanOwn = { readonly page: PagePlan; readonly inserted: readonly string[] };

/** A skip of the writer's as the store's (its causes are the same) */
const skipOf = (skipped: { readonly cause: TableSkip["cause"]; readonly reason: string }): TableSkip => ({ cause: skipped.cause, reason: skipped.reason });

export class MarkdownStore implements TableStore, PageFormulaStore {
  // The writer over the platform as it is (a writer keeps what it planned and wrote, for apply and undo)
  private writing: { readonly platform: Pick<TablePlatform, "editor" | "space">; readonly writer: PageWriter } | undefined;
  private readonly plans = new WeakMap<TablePlan, PlanOwn>();
  private readonly reports = new WeakMap<TableReport, ApplyReport>();

  constructor(
    private readonly platform: () => Pick<TablePlatform, "editor" | "space">,
    private readonly register: TableRegister,
    // How a table is written (the formatting setting's: autoFormat)
    private readonly serializer: () => Promise<(table: Table) => string>,
  ) {}

  private writer(): PageWriter {
    const platform = this.platform();
    if (this.writing?.platform !== platform) this.writing = { platform, writer: pageWriter({ editor: platform.editor, space: platform.space ?? NO_SPACE }) };
    return this.writing.writer;
  }

  async tables(document: string): Promise<readonly StoredTable[] | null> {
    const text = await textOf(this.platform(), document);
    return text === undefined ? null : tablesIn(this.register, document, text);
  }

  documentOf(key: TableKey): string | undefined {
    return this.register.pageOf(key);
  }

  /**
   * A page's tables and the formulas in its text changed by the writer's
   * changes `make` makes (the tables' parts: `p.tables`; others with them, a
   * plugin's text edits: `p.editText`), as one write: one edit where the page
   * is open, planned anew there where it changed since it was read; into the
   * space where it is not, left where it changed
   */
  async write(document: string, make: (page: PageBuilder) => unknown): Promise<PageWritten> {
    const report = await this.writer().write(pageChanges().page(document, make).build(), { replanOpenPage: true });
    if (report.written.length) return { result: "written" };
    const left = report.skipped[0];
    return left ? { result: "failed", reason: left.reason } : { result: "unchanged" };
  }

  async plan(transaction: TableTransaction): Promise<TablePlan> {
    const { document } = transaction;
    const left = (skipped: TableSkip): TablePlan => ({ document, changes: 0, skipped });
    const text = await textOf(this.platform(), document);
    if (text === undefined) return left({ cause: "missing", reason: "the document is not there" });
    const ranges = findTables(text);
    const keys = this.register.keysOf(document, text);
    const serialize = await this.serializer();
    const writes: TableWrite[] = [];
    const inserts: TableInsert[] = [];
    for (const edit of transaction.edits) {
      if (edit.kind === "insert") {
        const after = edit.after === undefined ? undefined : ranges[keys.indexOf(edit.after)];
        if (edit.after !== undefined && !after) return left({ cause: "changed", reason: "the table a new one goes after is not there" });
        const markdown = newTableMarkdown(edit.model, after ? parseTable(after.text).indent : "", serialize);
        inserts.push({ markdown, ...(after ? { place: { after: tableAt(text, after) } } : {}) });
        continue;
      }
      const range = ranges[keys.indexOf(edit.key)];
      if (!range) return left({ cause: "changed", reason: "a table of it is not there" });
      if (revisionOf(range.text) !== edit.expects) return left({ cause: "changed", reason: "a table of it changed since it was read" });
      const read = parseTable(range.text);
      writes.push({ ...tableAt(text, range), markdown: edit.kind === "remove" ? undefined : serialize(encode(edit.model, read)) });
    }
    const page = await this.writer().plan(pageChanges().page(document, (p) => p.tables.write(writes, inserts)).build(), { replanOpenPage: true });
    const skipped = page.skipped[0];
    if (skipped) return left(skipOf(skipped));
    const plan: TablePlan = { document, changes: page.pages.length ? transaction.edits.length : 0 };
    this.plans.set(plan, { page, inserted: inserts.map((one) => one.markdown) });
    return plan;
  }

  async apply(plan: TablePlan): Promise<TableReport> {
    const { document } = plan;
    const own = this.plans.get(plan);
    if (plan.skipped || !own) return { document, written: false, inserted: [], skipped: plan.skipped ?? { cause: "refused", reason: "not planned by this store" } };
    // The new tables' keys, made before they are written (the register gives each the table of its text)
    const inserted = own.inserted.map((markdown) => {
      const key = this.register.reserve(document);
      this.register.writing(key, markdown.trimEnd());
      return key;
    });
    const page = await this.writer().apply(own.page);
    const skipped = page.skipped[0];
    if (skipped) {
      for (const key of inserted) this.register.release(key);
      return { document, written: false, inserted: [], skipped: skipOf(skipped) };
    }
    const report: TableReport = { document, written: page.written.length > 0, inserted };
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
    this.plans.set(plan, { page, inserted: [] });
    return plan;
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
