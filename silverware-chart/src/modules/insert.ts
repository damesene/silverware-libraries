// The insert module: a chart put into the page, its table picked in the
// host's own picker (SilverBullet's):
// - the command *Silverware Chart: Insert chart*: every table of the page, the
//   chart put right under the one picked (its source the table above it);
// - the slash command `/chart`: the tables a chart at the cursor can name (the
//   one above, below, under a heading, the named ones), or an example of its
//   own numbers, the chart put at the cursor.
// Bars of the table's columns of numbers over its first other column.
import { isUnreadable, type ChartModel, type Source } from "../core/model.ts";
import { type Candidate, type ChartModule, type ModuleHost, sourceOfColumns } from "../core/module.ts";
import { columnsOf, headingsOf, tablesOf } from "../sources/markdown.ts";

export const INSERT_COMMAND = "Silverware Chart: Insert chart";
export const SLASH_COMMAND = "chart";

const EXAMPLE: ChartModel = { type: "bar", title: "Example", labels: ["A", "B", "C"], series: [{ name: "Values", values: [3, 5, 2] }] };

/** A table's columns as the chart's source, where it has a column of numbers to draw */
function sourceOf(table: string, columns: Candidate["columns"]): Source | undefined {
  return columns.some((c) => c.numeric) ? sourceOfColumns(table, columns) : undefined;
}

/** A chart's block written into the page at `at`, apart from what is around it by a blank line */
async function insert(host: ModuleHost, text: string, at: number, model: ChartModel): Promise<void> {
  let block: string;
  try {
    block = host.newBlock(model);
  } catch (e) {
    host.flash(`Silverware Chart: ${e instanceof Error ? e.message : String(e)}`, "error");
    return;
  }
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = before === "" ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = after === "" ? "\n" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  await host.replaceRange(at, at, `${lead}${block}${trail}`);
}

/** A chart of a source drawn at a place of the page, or why not (said) */
async function chartAt(host: ModuleHost, source: Source, page: string, text: string, at: number): Promise<ChartModel | undefined> {
  const model = await host.chartOf(source, { page, text, block: { language: "", from: at, to: at, bodyFrom: at, bodyTo: at, body: "" } });
  if (isUnreadable(model)) {
    host.flash(`Silverware Chart: ${model.problem}`, "error");
    return undefined;
  }
  return model;
}

/** The command: a table of the page picked (by its name where it has one, the heading it is under), the chart put under it */
async function insertUnderTable(host: ModuleHost): Promise<void> {
  const { name, text } = await host.page();
  const tables = tablesOf(text);
  if (!tables.length) {
    host.flash("Silverware Chart: this page has no table to draw", "error");
    return;
  }
  const headings = headingsOf(text);
  // The tables the sources name (Silverware Table's, by their names): a table named is drawn by its name
  const end = { language: "", from: text.length, to: text.length, bodyFrom: text.length, bodyTo: text.length, body: "" };
  const named = (await host.candidates({ page: name, text, block: end })).filter((c) => c.table !== "above" && c.table !== "below" && !c.table.startsWith("#"));
  const picked = await host.pick(
    "Chart of which table?",
    tables.map((table) => {
      const own = named.find((c) => c.at === table.from)?.table;
      const under = headings.filter((h) => h.end < table.from).at(-1)?.title;
      return { label: [own, `(${table.columns.map((c) => c.name).join(", ")})`, under ? `under ${under}` : undefined].filter(Boolean).join(" ") };
    }),
  );
  const table = picked === undefined ? undefined : tables[picked];
  if (!table) return;
  const source = sourceOf(named.find((c) => c.at === table.from)?.table ?? "above", columnsOf(table));
  if (!source) {
    host.flash("Silverware Chart: the table has no column of numbers to draw", "error");
    return;
  }
  // Right under the table: the table above the chart is that one
  const model = await chartAt(host, source, name, text, table.to);
  if (model) await insert(host, text, table.to, model);
}

/** The slash command: a table the chart at the cursor can name picked (or an example), the chart put at the cursor */
async function insertAtCursor(host: ModuleHost): Promise<void> {
  const { name, text, cursor } = await host.page();
  const block = { language: "", from: cursor, to: cursor, bodyFrom: cursor, bodyTo: cursor, body: "" };
  const candidates = await host.candidates({ page: name, text, block });
  const picked = await host.pick("Chart of which table?", [...candidates.map((candidate) => ({ label: candidate.label })), { label: "An example of its own numbers" }]);
  if (picked === undefined) return;
  const candidate = candidates[picked];
  if (!candidate) {
    await insert(host, text, cursor, EXAMPLE);
    return;
  }
  const source = sourceOf(candidate.table, candidate.columns);
  if (!source) {
    host.flash("Silverware Chart: the table has no column of numbers to draw", "error");
    return;
  }
  const model = await chartAt(host, source, name, text, cursor);
  if (model) await insert(host, text, cursor, model);
}

export function insertModule(host: ModuleHost): ChartModule {
  return {
    commands: () => [{ name: INSERT_COMMAND, description: "A chart of a table of the page, put under it", run: () => insertUnderTable(host) }],
    slashCommands: () => [{ name: SLASH_COMMAND, description: "A chart of a table, or an example", run: () => insertAtCursor(host) }],
  };
}
