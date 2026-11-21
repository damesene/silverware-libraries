// A table SilverBullet rendered paired with a table of the page (docs/silverware-table-store-plan.md,
// step 6, A2): found in the page's text by where SilverBullet says it starts
// (`data-pos`, which may be stale: the shape decides among the tables near it)
// and its rendered shape (rows, columns, headers), its key the register's
// for its place among the page's tables. The core gets the table by its key,
// model and revision; nothing of the text.
import { cellText, positionHint, renderedTable } from "../../dom.ts";
import { locateByShape, locateWithEmptyHeaders, parseTable, writesMetaRow } from "../../markdown.ts";
import type { PairedTable, PairingContext, Unpaired } from "../../core/adapter.ts";
import type { MarkdownStore } from "../../store/markdown/store.ts";
import type { TableRows } from "../../core/rows.ts";

/**
 * The table of the page a rendered table is; why none is (no place given,
 * or none of the page's tables is it: in a block quote; one whose empty
 * headers a fix would name); undefined: rendered anew meanwhile, asked again
 * by the next scan
 */
export async function pairTable(widget: HTMLElement, table: HTMLTableElement, rows: TableRows, context: PairingContext, store: MarkdownStore): Promise<PairedTable | Unpaired | undefined> {
  const hint = positionHint(table);
  if (hint === undefined) return { unpaired: "unplaced" };
  const rendered = rows.renderedRows(table);
  const header = rendered[0]!;
  const shape = { rows: rendered.length, columns: header.cells.length, headers: Array.from(header.cells).map(cellText) };
  const { editor } = context.platform();
  const text = await editor.text();
  if (renderedTable(widget) !== table) return undefined;
  const range = locateByShape(text, hint, shape);
  const broken = range ? undefined : locateWithEmptyHeaders(text, hint, shape);
  if (!range && !broken) return { unpaired: "unfound" };
  const document = await editor.documentName();
  if (renderedTable(widget) !== table) return undefined;
  const tables = store.tablesOfText(document, text);
  if (!range) {
    const named = tables[broken!.ordinal]!;
    return { unpaired: "unfound", emptyHeaders: { document, key: named.key, revision: named.revision } };
  }
  const stored = tables[range.ordinal]!;
  const markdown = parseTable(range.text);
  return {
    key: stored.key,
    model: stored.model,
    revision: stored.revision,
    document,
    tables,
    metaRow: writesMetaRow(markdown),
  };
}
