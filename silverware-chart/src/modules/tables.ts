// The tables module: a named table of Silverware Table as a chart's source,
// read through its public API (a formula per column: `sales![revenue]`), so
// a column is found by its name as formulas find it, whatever its place.
import type { Source, Unreadable } from "../core/model.ts";
import type { ChartModule, ModuleHost, SourceData, TableApi } from "../core/module.ts";

/** A column's values as evaluate gives them: one value as its text, several as a JSON list of texts */
export function textsOf(evaluated: string): string[] {
  if (evaluated.startsWith("[")) {
    try {
      const list: unknown = JSON.parse(evaluated);
      if (Array.isArray(list)) return list.map(String);
    } catch {
      // Not a list: one value that starts with [
    }
  }
  return [evaluated];
}

/** A cell's text as a number: as written, or with its unit and spaces left out (12,99 € is 12.99); else no value */
export function numberOf(text: string): number | null {
  const plain = Number(text);
  if (text.trim() !== "" && Number.isFinite(plain)) return plain;
  let digits = text.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(digits)) return null;
  // A comma alone the decimal one, as written in much of Europe
  if (digits.includes(",") && !digits.includes(".")) digits = digits.replace(",", ".");
  const n = Number(digits.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// A formula's error, as evaluate gives it (#REF!, #NAME?, #N/A…)
const ERROR_RE = /^#[A-Z/0-9]+[!?]?$/;

/** The source's columns read from the table: the labels' (else 1, 2, …) and each series' */
async function readTable(table: TableApi, source: Source, page: string, text: string): Promise<SourceData | Unreadable> {
  const column = async (name: string): Promise<string[] | Unreadable> => {
    const formula = `=${source.table}![${name}]`;
    const value = await table.evaluate(formula, text, page);
    if (ERROR_RE.test(value)) return { problem: `${source.table}![${name}] is ${value}${value === "#REF!" || value === "#NAME?" ? ` (is there a table named ${source.table} with a column ${name}?)` : ""}` };
    return textsOf(value);
  };
  if (!source.series.length) return { problem: `the table ${source.table} has no columns to draw: say them with series` };
  const series: (number | null)[][] = [];
  for (const name of source.series) {
    const texts = await column(name);
    if (!Array.isArray(texts)) return texts;
    series.push(texts.map(numberOf));
  }
  let labels: string[];
  if (source.x) {
    const texts = await column(source.x);
    if (!Array.isArray(texts)) return texts;
    labels = texts;
  } else labels = (series[0] ?? []).map((_, i) => String(i + 1));
  return { labels, series };
}

export function tablesModule(host: ModuleHost): ChartModule {
  return {
    sources: () => {
      const table = host.table;
      return table ? [{ id: "table", read: (source, page, text) => readTable(table, source, page, text) }] : [];
    },
  };
}
