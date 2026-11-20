// Tables kept as markdown in pages (docs/silverware-table-store-plan.md,
// *Stores*): a page's tables read from its text, keyed by the register
// (core/tables.ts, which matches a page's tables to keys as its text
// changes), each model parsed by markdown.ts (its cache by text makes a read
// of the same text free). For now a façade over that code (the plan's step
// 2); the codec and the register move in here with step 3.
import { findTables, parseTable } from "../../markdown.ts";
import type { TablePlatform } from "../../core/platform.ts";
import type { StoredTable, TableRevision, TableStore } from "../../core/store.ts";
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

export class MarkdownStore implements TableStore {
  constructor(
    private readonly platform: () => Pick<TablePlatform, "editor" | "space">,
    private readonly register: TableRegister,
  ) {}

  async tables(document: string): Promise<readonly StoredTable[]> {
    const text = await textOf(this.platform(), document);
    return text === undefined ? [] : tablesIn(this.register, document, text);
  }

  documentOf(key: TableKey): string | undefined {
    return this.register.pageOf(key);
  }
}

/** A page's tables in its text, in order, keyed by the register */
export function tablesIn(register: TableRegister, document: string, text: string): readonly StoredTable[] {
  const keys = register.keysOf(document, text);
  return findTables(text).map((range) => ({ key: keys[range.ordinal]!, revision: revisionOf(range.text), model: parseTable(range.text) }));
}
