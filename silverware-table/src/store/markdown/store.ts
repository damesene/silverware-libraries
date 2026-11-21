// Tables kept as markdown in pages (docs/silverware-table-store-plan.md,
// *Stores*): a page's tables read from its text, keyed by the register
// (core/tables.ts, which matches a page's tables to keys as its text
// changes), each model parsed by markdown.ts (its cache by text makes a read
// of the same text free); written through the page writer (shared/pages/),
// by the parts of tableparts.ts (step 4b).
import { findTables, parseTable } from "../../markdown.ts";
import { decode } from "./codec.ts";
import type { TablePlatform } from "../../core/platform.ts";
import type { PageFormula, PageFormulaStore, StoredTable, TableRevision, TableStore } from "../../core/store.ts";
import { pageFormulasIn } from "./pageformulas.ts";
import "./tableparts.ts";
import { type PageBuilder, pageChanges } from "../../../../shared/pages/changes.ts";
import { pageWriter } from "../../../../shared/pages/writer.ts";
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

export class MarkdownStore implements TableStore, PageFormulaStore {
  constructor(
    private readonly platform: () => Pick<TablePlatform, "editor" | "space">,
    private readonly register: TableRegister,
  ) {}

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
    const { editor, space } = this.platform();
    const writer = pageWriter({ editor, space: space ?? NO_SPACE });
    const report = await writer.write(pageChanges().page(document, make).build(), { replanOpenPage: true });
    if (report.written.length) return { result: "written" };
    const left = report.skipped[0];
    return left ? { result: "failed", reason: left.reason } : { result: "unchanged" };
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
