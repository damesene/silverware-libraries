// The tables module: a markdown table as a chart's source, found by its
// place and read by the chart itself (no other plugin needed): `above` /
// `below` the chart, `#Heading` (the first table under it), `[[Page#Heading]]`
// on another page, as SilverBullet links to a heading. Columns by their names or keys (sources/markdown.ts). It
// offers the page's tables to the Data menu (and to inserting a chart).
import type { Source, Unreadable } from "../core/model.ts";
import type { Candidate, ChartModule, ModuleHost, SourceContext, SourceData } from "../core/module.ts";
import { columnsOf, dataOf, headingsOf, pageOf, tableByPlace, tablesOf, type TextTable } from "../sources/markdown.ts";

/** Whether a reference is one this module reads: a place, or a heading */
const byPlace = (rest: string) => rest === "above" || rest === "below" || rest.startsWith("#");

async function read(host: ModuleHost, source: Source, context: SourceContext): Promise<SourceData | Unreadable | undefined> {
  const { page, rest } = pageOf(source.table);
  if (!byPlace(rest)) return undefined;
  // Above and below are the chart's own page's; a heading of another page in the link, as SilverBullet writes it
  if (page && (rest === "above" || rest === "below")) return { problem: `${source.table}: above and below are this page's; on another page say a heading ([[${page}#Title]])` };
  if (page && /\]\]\s*#/.test(source.table)) return { problem: `${source.table}: a heading of another page goes in its link, [[${page}${rest}]]` };
  const text = page && page !== context.page ? await host.readPage(page).catch(() => undefined) : context.text;
  if (text === undefined) return { problem: `no page ${page}` };
  const table = tableByPlace(text, rest, page && page !== context.page ? undefined : context.block);
  if (!table) return { problem: rest === "above" ? "no table above the chart" : rest === "below" ? "no table below the chart" : `no table under the heading ${source.table}` };
  return dataOf(table, source, `the table ${source.table}`);
}

/** The page's tables a chart can name by their place: the one above it, the one below, each first under its heading */
function candidates(context: SourceContext): Candidate[] {
  const tables = tablesOf(context.text);
  const describe = (table: TextTable) => table.columns.map((c) => c.name).join(", ");
  const out: Candidate[] = [];
  const at = (table: TextTable | undefined, reference: string, label: string) => {
    if (table && !out.some((c) => c.table === reference)) out.push({ label: `${label} (${describe(table)})`, table: reference, at: table.from, columns: columnsOf(table) });
  };
  if (context.block) {
    at(tables.filter((t) => t.to <= context.block!.from).at(-1), "above", "Table above");
    at(tables.find((t) => t.from >= context.block!.to), "below", "Table below");
  }
  for (const heading of headingsOf(context.text)) {
    const table = tables.find((t) => t.from > heading.end);
    if (table && headingsOf(context.text).filter((h) => h.end > heading.end && h.end < table.from).length === 0) at(table, `#${heading.title}`, `Under ${heading.title}`);
  }
  return out;
}

export function tablesModule(host: ModuleHost): ChartModule {
  return {
    sources: () => [
      {
        id: "tables",
        read: (source, context) => read(host, source, context),
        candidates: async (context) => candidates(context),
      },
    ],
  };
}
