// The silverwareTable module: what Silverware Table adds where it is
// installed, through its public API only (it knows nothing of charts):
// - a table it named as a chart's source (`sales`, `[[Page]]sales`), found by
//   its name in silverware.table.tables, so the chart reads none of its
//   metadata;
// - the charts' data written with its writes (silverware.table.onWrite): each
//   write of a table brings the blocks of the page's charts up to their
//   sources, in the same edit (one undo step).
import type { Source, Unreadable } from "../core/model.ts";
import type { ChartModule, ModuleHost, SourceContext, SourceData, TableApi } from "../core/module.ts";
import { dataOf, pageOf } from "../sources/markdown.ts";

// A table's name as Silverware Table allows it: what is not a place (above, below) nor a heading
const NAME_RE = /^[A-Za-z_][\w.-]*$/;

async function read(host: ModuleHost, table: TableApi, source: Source, context: SourceContext): Promise<SourceData | Unreadable | undefined> {
  const { page, rest } = pageOf(source.table);
  if (!NAME_RE.test(rest) || rest === "above" || rest === "below") return undefined;
  const text = page && page !== context.page ? await host.readPage(page).catch(() => undefined) : context.text;
  if (text === undefined) return { problem: `no page ${page}` };
  // Names as Silverware Table compares them: any case
  const found = (await table.tables(text)).find((t) => t.name?.toLowerCase() === rest.toLowerCase());
  if (!found) return { problem: `no table named ${rest}${page ? ` on ${page}` : ""} (named in Silverware Table's ⋯ menu)` };
  return dataOf(found, source.x, source.series, `the table ${source.table}`);
}

export function silverwareTableModule(host: ModuleHost): ChartModule {
  const table = host.table;
  if (!table) return {};
  table.onWrite((text) => host.dataEdits(text));
  return { sources: () => [{ id: "silverwareTable", read: (source, context) => read(host, table, source, context) }] };
}
