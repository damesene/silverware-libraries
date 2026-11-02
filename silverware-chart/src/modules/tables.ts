// The tables module: a markdown table as a chart's source, found by its
// place and read by the chart itself (no other plugin needed): `above` /
// `below` the chart, `#Heading` (the first table under it), `[[Page]]#Heading`
// on another page. Columns by their names or keys (sources/markdown.ts). It
// offers the page's tables to the Data menu, and a command putting a chart of
// a table under it.
import type { ChartModel, Source, Unreadable } from "../core/model.ts";
import type { Candidate, ChartModule, ModuleHost, SourceContext, SourceData } from "../core/module.ts";
import { dataOf, headingsOf, numberOf, pageOf, tableByPlace, tablesOf, type TextTable } from "../sources/markdown.ts";

export const INSERT_COMMAND = "Silverware Chart: Insert chart of the table";

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
  return dataOf(table, source, `the table ${source.table}`);
}

/** A table's columns, each with whether its cells are numbers (most of those not empty) */
function columnsOf(table: TextTable): Candidate["columns"] {
  return table.columns.map((column, i) => {
    const cells = table.rows.map((row) => row[i] ?? "").filter((cell) => cell !== "");
    return { name: column.name, numeric: cells.length > 0 && cells.filter((cell) => numberOf(cell) !== null).length * 2 > cells.length };
  });
}

/** The page's tables a chart can name by their place: the one above it, the one below, each first under its heading */
function candidates(context: SourceContext): Candidate[] {
  const tables = tablesOf(context.text);
  const describe = (table: TextTable) => table.columns.map((c) => c.name).join(", ");
  const out: Candidate[] = [];
  const at = (table: TextTable | undefined, reference: string, label: string) => {
    if (table && !out.some((c) => c.table === reference)) out.push({ label: `${label} (${describe(table)})`, table: reference, columns: columnsOf(table) });
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

/** The table the cursor is in, else the nearest above it */
function tableAtCursor(text: string, cursor: number): TextTable | undefined {
  const tables = tablesOf(text);
  return tables.find((t) => cursor >= t.from && cursor <= t.to) ?? tables.filter((t) => t.to <= cursor).at(-1);
}

/** A chart of the table at the cursor, put right under it: bars of its number columns over its first other column */
async function insertChart(host: ModuleHost): Promise<void> {
  const { text, cursor } = await host.page();
  const table = tableAtCursor(text, cursor);
  if (!table) {
    host.flash("Silverware Chart: put the cursor in a table, or below one, to insert a chart of it", "error");
    return;
  }
  const columns = columnsOf(table);
  const x = columns.find((c) => !c.numeric)?.name;
  const series = columns.filter((c) => c.numeric && c.name !== x).map((c) => c.name);
  if (!series.length) {
    host.flash("Silverware Chart: the table has no column of numbers to draw", "error");
    return;
  }
  const source: Source = { table: "above", ...(x ? { x } : {}), series };
  const data = dataOf(table, source, "the table");
  if ("problem" in data) {
    host.flash(`Silverware Chart: ${data.problem}`, "error");
    return;
  }
  const model: ChartModel = { type: "bar", labels: data.labels, series: data.series.map((values, i) => ({ name: series[i], values })), source };
  let block: string;
  try {
    block = host.newBlock(model);
  } catch (e) {
    host.flash(`Silverware Chart: ${e instanceof Error ? e.message : String(e)}`, "error");
    return;
  }
  // Right under the table, a blank line between: the table above it is that one
  await host.replaceRange(table.to, table.to, `\n\n${block}`);
}

export function tablesModule(host: ModuleHost): ChartModule {
  return {
    commands: () => [{ name: INSERT_COMMAND, run: () => insertChart(host) }],
    sources: () => [
      {
        id: "tables",
        read: (source, context) => read(host, source, context),
        candidates: async (context) => candidates(context),
      },
    ],
  };
}
