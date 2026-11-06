// The view module: a view is a table whose body is one formula's result
// (`view.formula` in its metadata row), written into the page as any table.
// The formulas calculate it, in their order (a table reading a view follows it
// in the same edit), through what this module offers: a view's formula, the
// formula written anew as its sources' edits follow, and the result written
// over its body, the headers the user renamed kept (`view.headers`, by what
// each column stands for: src/calculated/). This module holds the rest: the
// dialog (Insert view…, the command and /view, View settings…), its cells
// read-only and its shape fixed, what it is and whether it is out of date in
// its tab, Refresh view in its toolbar. Turned off, no table is a view: views
// keep their values.
import type { Feature, ModelHost, PageCommand, TableBadge, TableInfo, ToolbarButton } from "../core/feature.ts";
import { type Calculated, calculatedTable, readRenames, renamedIn, renamedViewIds, sameCells, storedRenames, viewCalculated } from "../calculated/index.ts";
import type { FormulaHelpers } from "../formulafield.ts";
import { choiceText, FormulaError, type FormulasOffer, type Grid, referredTableNames, tokenize, type ViewsOffer, withEquals } from "../formulas/index.ts";
import { ICONS } from "../icons.ts";
import { locateBySource, pageTablesOf, parseTable, type Table } from "../markdown.ts";
import { sameTableName, tableNameProblem } from "../namerules.ts";
import { openViewDialog } from "./viewdialog.ts";

// What the dialog says first while the formulas module, which calculates views, is off
const FORMULAS_OFF = "A view is calculated by the formulas module, which is off: turn it on in Silverware Table's settings (the Silverware Table: Settings command), then reload.";

// What a name offered while the formula is typed is (the list says so beside it)
const CHOICE_KINDS: Readonly<Record<string, string>> = { function: "function", column: "column", cell: "named cell", row: "named row", table: "table" };

export class Views implements Feature {
  // Whether a view shown is out of date (or why it cannot be calculated), as last checked
  private readonly stale = new WeakMap<TableInfo, string | boolean>();

  constructor(private readonly host: ModelHost) {
    host.offer({
      viewFormula: (table) => this.formulaOf(table),
      withViewFormula: (table, formula) => host.setMeta(table, "formula", formula),
      written: (table, result, options) => this.written(table, result, options),
    } satisfies ViewsOffer);
  }

  private formulas(): FormulasOffer | undefined {
    return this.host.offered<FormulasOffer>("formulas");
  }

  /** A view's formula, with its "=" (it may be written without) */
  private formulaOf(table: Table): string | undefined {
    const formula = this.host.getMeta(table, "formula")?.trim();
    if (!formula) return undefined;
    return formula.startsWith("=") ? formula : `=${formula}`;
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

  // ---- what a view is, and whether it is up to date ------------------------------------

  /** A view's cells are its formula's: its header alone is the user's (its names) */
  readOnly(table: Table, cell: { readonly row: number }): string | undefined {
    if (cell.row === 0) return undefined;
    const formula = this.formulaOf(table);
    return formula === undefined ? undefined : `this table is a view: its values are its formula's result (${formula}). Change what it reads, or its formula`;
  }

  /** A cell of a view edited: its formula is changed in its settings, opened instead */
  editRefused(info: TableInfo, cell: { readonly row: number }): void {
    if (cell.row > 0 && this.formulaOf(parseTable(info.source)) !== undefined) this.settings(info);
  }

  /** A view's rows and columns are its formula's */
  fixedShape(table: Table): string | undefined {
    const formula = this.formulaOf(table);
    return formula === undefined ? undefined : `this table is a view: its rows and columns are its formula's result (${formula})`;
  }

  /** A view shown: whether it is as its formula makes it now; another table shown anew (edited by hand): the views reading it */
  enhanced(info: TableInfo): void {
    const table = parseTable(info.source);
    if (this.formulaOf(table) !== undefined) this.check(info);
    else {
      this.stale.delete(info);
      const name = this.host.tableName(table)?.trim().toLowerCase();
      const cells = this.formulas()?.cells;
      if (!name || !cells) return;
      for (const other of this.host.shownTables()) {
        if (other.key !== info.key && referredTableNames(cells, parseTable(other.source)).has(name)) this.check(other);
      }
    }
    this.host.toolbarChanged();
  }

  /** Other pages read anew, custom functions defined anew: every view shown checked again */
  tablesChanged(): void {
    for (const info of this.host.shownTables()) this.check(info);
    this.host.toolbarChanged();
  }

  /** Whether a view shown is as its formula makes it now (nothing written), or why it cannot be calculated */
  private check(info: TableInfo): void {
    const table = parseTable(info.source);
    const formula = this.formulaOf(table);
    if (formula === undefined) return void this.stale.delete(info);
    const result = this.formulas()?.view(formula, table);
    // Not calculated (the formulas off, a page not read yet): as written
    if (result === undefined) return void this.stale.set(info, false);
    if (result instanceof FormulaError) return void this.stale.set(info, `This view cannot be calculated: ${result.code} ${result.detail}`);
    this.stale.set(info, !sameCells(this.written(table, result), table));
  }

  /** What a view is, at a glance; out of date, or not calculated at all, said so */
  tableBadges(info: TableInfo): TableBadge[] {
    if (this.formulaOf(parseTable(info.source)) === undefined) return [];
    const what = { icon: ICONS.view, text: "View" };
    const state = this.stale.get(info);
    if (!state) return [what];
    return [what, { icon: ICONS.recalculate, text: typeof state === "string" ? "Cannot be calculated" : "Out of date", attention: true }];
  }

  /** Insert view… in any table's ⋯ menu; a view's settings and Refresh view in its toolbar, highlighted where it is out of date */
  toolbarButtons(info: TableInfo): ToolbarButton[] {
    const table = parseTable(info.source);
    const insert: ToolbarButton = { label: "Insert view…", place: "menu", icon: ICONS.view, title: "A table made by a formula under this one: its rows filtered, sorted, picked…", run: () => this.insert(info) };
    if (this.formulaOf(table) === undefined) return [insert];
    const state = this.stale.get(info);
    return [
      insert,
      { label: "View settings…", place: "icon", icon: ICONS.view, title: "The view's formula and name", run: () => this.settings(info) },
      {
        label: "Refresh view",
        place: "icon",
        icon: ICONS.recalculate,
        attention: !!state,
        title: typeof state === "string" ? state : state ? "Refresh view: it is out of date (what it reads was changed outside Silverware Table)" : "Refresh view (it is up to date)",
        // A write of the view calculates it anew (the formulas module's write step)
        run: () => void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => t),
      },
    ];
  }

  // ---- the dialog: Insert view…, the command, View settings… ------------------------------

  /** Insert view, the command (and /view): the dialog for a view of the page's first named table (none: an empty formula), inserted at the cursor */
  commands(): PageCommand[] {
    return [{ name: "Silverware Table: Insert view", slash: "view", description: "A view at the cursor: a table made by a formula (FILTER, SORT, UNIQUE…)", run: () => this.insertAtCursor() }];
  }

  /** The table to insert: the formula and the name in its metadata row, its body the result */
  private made(formula: string, name: string, indent: string, result: Grid): Table {
    const empty: Table = { indent, align: [], rows: [{ cells: [""] }], padded: false };
    const named = this.host.withTableName(this.host.setMeta(empty, "formula", formula), name || undefined);
    return this.written(named, result);
  }

  /** The result of a formula in the dialog, or why there is none (the formulas off, a page not read yet) */
  private result(formula: string, table?: Table, replace?: { readonly from: number; readonly table: Table }): Grid | string {
    const formulas = this.formulas();
    if (!formulas) return "It needs the formulas module, which is off";
    const problem = formulas.problem(withEquals(formula).formula.trim());
    if (problem) return problem;
    const result = formulas.view(formula, table, replace);
    if (result === undefined) return "It reads another page, which is not read yet";
    return result instanceof FormulaError ? `${result.code} ${result.detail}` : result;
  }

  /** Why a name cannot be a view's: no table's name, or another table's of the page (`own`: the view itself) */
  private nameProblem(name: string, own?: Table): string | undefined {
    const problem = tableNameProblem(name);
    if (problem) return problem;
    const taken = pageTablesOf(this.host.pageText).some(({ table }) => {
      const other = this.host.tableName(table);
      return !!other && sameTableName(other, name) && !(own && sameTableName(this.host.tableName(own) ?? "", name));
    });
    return taken ? `Another table of the page is named ${name}` : undefined;
  }

  /** A name for a new table not taken on the page: view1, view2… (table1… for a source) */
  private freeName(prefix: string): string {
    const taken = new Set(pageTablesOf(this.host.pageText).map((t) => this.host.tableName(t.table)?.toLowerCase()));
    let n = 1;
    while (taken.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }

  /** What the formula's field offers as it is typed: the formulas module's help, the page's names (a view has no columns of its own) */
  private helpers(): FormulaHelpers | undefined {
    const formulas = this.formulas();
    if (!formulas) return undefined;
    return {
      complete: (text, caret) => {
        const { formula, shift } = withEquals(text);
        const made = formulas.complete(formula, caret + shift, this.host.pageText);
        if (!made) return undefined;
        return {
          from: made.from - shift,
          to: made.to - shift,
          choices: made.choices.map((choice) => ({ label: choiceText(choice).replace(/[([!]$/, ""), insert: choiceText(choice), kind: CHOICE_KINDS[choice.kind] ?? choice.kind })),
        };
      },
      help: (text, caret) => {
        const { formula, shift } = withEquals(text);
        return formulas.help(formula, caret + shift);
      },
      problem: (text) => (text.trim() ? formulas.problem(withEquals(text).formula.trim()) : undefined),
    };
  }

  /** Why no view can be inserted or saved (its metadata not stored, the formulas off), if so */
  private blocked(table: Table): string | undefined {
    if (!this.formulas()) return FORMULAS_OFF;
    return this.host.canStoreMeta(table, "formula") ? undefined : "A view is kept in its table's metadata: turn on Store table metadata in the settings";
  }

  /** The dialog, its preview calculated as a write would calculate the view */
  private dialog(formula: string, name: string, submitLabel: string, preview: (formula: string) => Grid | string, submit: (formula: string, name: string) => void, blocked: string | undefined, own?: Table, naming?: (formula: string) => string | undefined): void {
    const formulas = this.formulas();
    openViewDialog(this.host, {
      formula,
      name,
      submitLabel,
      submit,
      ...(blocked ? { blocked } : {}),
      ...(formulas ? { helpers: this.helpers()!, functions: formulas.functions } : { notice: FORMULAS_OFF }),
      preview: (f): Calculated | string => {
        const result = preview(f);
        return typeof result === "string" ? result : viewCalculated(result);
      },
      // (`naming`: the name a table gets in the same edit with the formula, taken as well)
      nameProblem: (n, f) => {
        const named = naming?.(f);
        return named && sameTableName(n, named) ? `Another table of the page is named ${n}` : this.nameProblem(n, own);
      },
    });
  }

  /** Insert view… of a table: its whole body to start from, the table named in the same edit where it has none; inserted under it */
  private insert(info: TableInfo): void {
    const table = parseTable(info.source);
    const own = this.host.tableName(table)?.trim();
    const source = own ?? this.freeName("table");
    // A table to be named so: the view's formula reads it as it will be written
    const range = own ? undefined : locateBySource(this.host.pageText, info.hint, info.source);
    const replace = range ? { from: range.from, table: this.host.withTableName(table, source) } : undefined;
    const naming = (formula: string) => !own && tokenize(formula).tokens.some((t) => t.kind === "table" && t.page === undefined && sameTableName(t.name, source));
    const preview = (formula: string) => this.result(formula, undefined, naming(formula) ? replace : undefined);
    const empty: Table = { indent: table.indent, align: [], rows: [{ cells: [""] }], padded: false };
    this.dialog(`=${source}![#Data]`, this.freeName("view"), "Insert", preview, (formula, name) => {
      const result = preview(formula);
      if (typeof result === "string") return void this.host.bridge.flash(`Silverware Table: ${result}`, "error");
      const made = this.made(withEquals(formula).formula, name, table.indent, result);
      void this.host.insertTable(made, info, naming(formula) ? { target: info, change: (t) => this.host.withTableName(t, source) } : undefined);
    }, this.blocked(empty), undefined, (formula) => (naming(formula) ? source : undefined));
  }

  /** Insert view at the cursor: the page's first named table's body to start from, else an empty formula */
  private insertAtCursor(): void {
    const first = pageTablesOf(this.host.pageText)
      .map(({ table }) => this.host.tableName(table)?.trim())
      .find((name): name is string => !!name);
    const empty: Table = { indent: "", align: [], rows: [{ cells: [""] }], padded: false };
    const preview = (formula: string) => this.result(formula);
    this.dialog(first ? `=${first}![#Data]` : "", this.freeName("view"), "Insert", preview, (formula, name) => {
      const result = preview(formula);
      if (typeof result === "string") return void this.host.bridge.flash(`Silverware Table: ${result}`, "error");
      const made = this.made(withEquals(formula).formula, name, "", result);
      // The cursor as it is now: the editor moved it with any edit made while the dialog was open
      void (async () => {
        const position = (await this.host.bridge.getCursor?.()) ?? (await this.host.bridge.getText()).length;
        await this.host.insertTable(made, { position });
      })();
    }, this.blocked(empty));
  }

  /** View settings…: the view's formula and name in the dialog, saved into its metadata row (the write calculates it) */
  private settings(info: TableInfo): void {
    const table = parseTable(info.source);
    const formula = this.formulaOf(table);
    if (formula === undefined) return;
    this.dialog(formula, this.host.tableName(table) ?? "", "Save", (f) => this.result(f, table), (changed, name) => {
      void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => this.host.withTableName(this.host.setMeta(t, "formula", withEquals(changed).formula), name || undefined));
    }, this.blocked(table), table);
  }
}
