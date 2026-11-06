// The views module: a view is a table whose body is one formula's result
// (`view.formula` in its metadata row), written into the page as any table.
// The formulas calculate it, in their order (a table reading a view follows it
// in the same edit), through what this module offers: a view's formula, the
// formula written anew as its sources' edits follow, and the result written
// over its body, the headers the user renamed kept (`view.headers`, by what
// each column stands for: src/calculated/). Turned off, no table is a view:
// views keep their values.
import type { Feature, ModelHost } from "../core/feature.ts";
import { calculatedTable, readRenames, renamedIn, renamedViewIds, storedRenames, viewCalculated } from "../calculated/index.ts";
import type { Grid, ViewsOffer } from "../formulas/index.ts";
import type { Table } from "../markdown.ts";

export class Views implements Feature {
  constructor(private readonly host: ModelHost) {
    host.offer({
      viewFormula: (table) => this.formulaOf(table),
      withViewFormula: (table, formula) => host.setMeta(table, "formula", formula),
      written: (table, result, options) => this.written(table, result, options),
    } satisfies ViewsOffer);
  }

  /** A view's formula, with its "=" (it may be written without) */
  private formulaOf(table: Table): string | undefined {
    const formula = this.host.getMeta(table, "formula")?.trim();
    if (!formula) return undefined;
    return formula.startsWith("=") ? formula : `=${formula}`;
  }

  /** A view's cells are its formula's: its header alone is the user's (its names) */
  readOnly(table: Table, cell: { readonly row: number }): string | undefined {
    if (cell.row === 0) return undefined;
    const formula = this.formulaOf(table);
    return formula === undefined ? undefined : `this table is a view: its values are its formula's result (${formula}). Change what it reads, or its formula`;
  }

  /** A view's rows and columns are its formula's */
  fixedShape(table: Table): string | undefined {
    const formula = this.formulaOf(table);
    return formula === undefined ? undefined : `this table is a view: its rows and columns are its formula's result (${formula})`;
  }

  /** The view with its result written over its body (src/calculated/), its renamed headers kept by their columns' ids */
  private written(table: Table, result: Grid, options: { readonly before?: Table; readonly renamed?: ReadonlyMap<string, string> } = {}): Table {
    const calculated = viewCalculated(result);
    let renames = renamedViewIds(readRenames(this.host.getMeta(table, "headers")), options.renamed ?? new Map());
    // A header renamed in this edit: the user's name for its column from now on
    if (options.before) renames = renamedIn(options.before, table, calculated, renames);
    const made = calculatedTable(table, calculated, renames, { pinsOf: this.host.pinsOf, withPins: this.host.withPins });
    return this.host.setMeta(made, "headers", storedRenames(renames, calculated));
  }
}
