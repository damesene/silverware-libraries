// The tables module: a markdown table as a chart's source, found by its
// place and read by the chart itself (no other plugin needed): `above` /
// `below` the chart, `#Heading` (the first table under it), `[[Page]]#Heading`
// on another page. Columns by their names or keys (sources/markdown.ts).
import type { Source, Unreadable } from "../core/model.ts";
import type { ChartModule, ModuleHost, SourceContext, SourceData } from "../core/module.ts";
import { dataOf, pageOf, tableByPlace } from "../sources/markdown.ts";

/** Whether a reference is one this module reads: a place, or a heading */
const byPlace = (rest: string) => rest === "above" || rest === "below" || rest.startsWith("#");

async function read(host: ModuleHost, source: Source, context: SourceContext): Promise<SourceData | Unreadable | undefined> {
  const { page, rest } = pageOf(source.table);
  if (!byPlace(rest)) return undefined;
  // Above and below are the chart's own page's
  if (page && (rest === "above" || rest === "below")) return { problem: `${source.table}: above and below are this page's; on another page say a heading (#Title)` };
  const text = page && page !== context.page ? await host.readPage(page).catch(() => undefined) : context.text;
  if (text === undefined) return { problem: `no page ${page}` };
  const table = tableByPlace(text, rest, page && page !== context.page ? undefined : context.block);
  if (!table) return { problem: rest === "above" ? "no table above the chart" : rest === "below" ? "no table below the chart" : `no table under the heading ${source.table}` };
  return dataOf(table, source.x, source.series, `the table ${source.table}`);
}

export function tablesModule(host: ModuleHost): ChartModule {
  return { sources: () => [{ id: "tables", read: (source, context) => read(host, source, context) }] };
}
