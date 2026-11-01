// The silverwareTable module: what Silverware Table adds where it is
// installed, through its public API only (it knows nothing of charts):
// - a table it named as a chart's source (`sales`, `[[Page]]sales`), found by
//   its name in silverware.table.tables, so the chart reads none of its
//   metadata;
// - the charts' data written with its writes (silverware.table.onWrite): each
//   write of a table brings the blocks of the page's charts up to their
//   sources, in the same edit (one undo step), their references following
//   what the write renamed (a column, the table), as its context tells.
import type { Block } from "../core/blocks.ts";
import type { Source, Unreadable } from "../core/model.ts";
import type { ChartModule, ModuleHost, SourceContext, SourceData, TableApi, WriteContext } from "../core/module.ts";
import { dataOf, pageOf, tableByPlace } from "../sources/markdown.ts";

// A table's name as Silverware Table allows it: what is not a place (above, below) nor a heading
const NAME_RE = /^[A-Za-z_][\w.-]*$/;
const isName = (rest: string) => NAME_RE.test(rest) && rest !== "above" && rest !== "below";

async function read(host: ModuleHost, table: TableApi, source: Source, context: SourceContext): Promise<SourceData | Unreadable | undefined> {
  const { page, rest } = pageOf(source.table);
  if (!isName(rest)) return undefined;
  const text = page && page !== context.page ? await host.readPage(page).catch(() => undefined) : context.text;
  if (text === undefined) return { problem: `no page ${page}` };
  // Names as Silverware Table compares them: any case
  const found = (await table.tables(text)).find((t) => t.name?.toLowerCase() === rest.toLowerCase());
  if (!found) return { problem: `no table named ${rest}${page ? ` on ${page}` : ""} (named in Silverware Table's ⋯ menu)` };
  return dataOf(found, source, `the table ${source.table}`);
}

/**
 * A chart's reference as a write left the table it names (by its name, or by
 * its place: above, below, a heading): the table's name and its columns' as
 * they are now; another page's, the same (that page was not written)
 */
function followed(context: WriteContext, source: Source, block: Block, text: string): Source {
  const { page, rest } = pageOf(source.table);
  if (page) return source;
  const byName = isName(rest);
  const place = byName ? undefined : tableByPlace(text, rest, block);
  const written = byName ? context.table(rest) : place ? context.tableAt(place.from) : undefined;
  if (!written) return source;
  const column = (name: string) => written.column(name) ?? name;
  return {
    table: byName ? (written.name ?? rest) : source.table,
    ...(source.x !== undefined ? { x: column(source.x) } : {}),
    series: source.series.map(column),
  };
}

export function silverwareTableModule(host: ModuleHost): ChartModule {
  const table = host.table;
  if (!table) return {};
  // (Most writes rename nothing: the references are looked at only where one did)
  table.onWrite((text, context) => host.dataEdits(text, context.renamed() ? (source, block, at) => followed(context, source, block, at) : undefined));
  return { sources: () => [{ id: "silverwareTable", read: (source, context) => read(host, table, source, context) }] };
}
