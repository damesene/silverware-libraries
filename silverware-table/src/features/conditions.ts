// The conditional formatting module: cells of a column, a named row or the
// whole table look different where their values meet a condition (a fill, a
// text color, bold, a bar, an icon), by rules in the table's metadata row
// (conditions/rule.ts: a column's on its column, so the core keeps them with
// it; the table's and named rows' on the table). The header and pinned rows
// and columns are never formatted. Viewing never writes: a rule only changes
// what a cell looks like (the core's looks: a mark and --swt-cf-… custom
// properties, which the style page's one rule reads).
//
// Values are what sorting compares (the column types module's offer: a typed
// column's value), formulas' results as written; a formula condition is the
// formulas module's (its offer, `rowValues`). Rules are edited in a dialog
// (conditionsdialog.ts), from the table's ⋯ menu, its toolbar's icon (a table
// with rules), a column's menu (quick rules, the column's rules cleared) and
// the cell menu; every change shows in the table before it is saved.
import { columnKey, columnName } from "../columns.ts";
import { CELL_MENU_ORDER, type CellLook, type CellMenuGroup, type CellRef, type Feature, type ModelHost, type TableInfo, type TableKey, type TableLooks, type ToolbarButton } from "../core/feature.ts";
import type { ColumnTypesOffer } from "../columntypes/index.ts";
import {
  cellOf,
  type ConditionsOffer,
  sampleOf,
  definitionsVersion,
  evaluateRules,
  inOrder,
  isUnread,
  numbered,
  type Placed,
  type Rule,
  type RuleCells,
  rulesOf,
  rulesText,
  type RuleScope,
  type StoredRule,
  styleLook,
} from "../conditions/index.ts";
import { FormulaError, type FormulasOffer, isErrorText, type Scalar, scalarText } from "../formulas/index.ts";
import { ICONS } from "../icons.ts";
import { parseTable, type Table, unescapeCell } from "../markdown.ts";
import type { MenuEntry } from "../menu.ts";
import { withoutTags } from "../tags.ts";
import { openConditionsDialog, type RuleSample, type ScopeColumn } from "./conditionsdialog.ts";

// The lines of a rule's preview (a whole table's rule column by column: one a column)
const PREVIEW_LINES = 6;

// The attribute the rules are stored in (the module's: conditions.rules, conditions.-c-<column>.rules)
const RULES = "rules";

const NEEDS_METADATA = "Needs the Store table metadata setting";

/** Quick rules of a column's menu: a condition (or none) and the format it starts with, as Excel's ribbon offers them */
const QUICK: readonly { readonly label: string; readonly when?: string; readonly format: string }[] = [
  { label: "Greater than…", when: "greater", format: "redFill" },
  { label: "Less than…", when: "less", format: "redFill" },
  { label: "Between…", when: "between", format: "yellowFill" },
  { label: "Equal to…", when: "equal", format: "yellowFill" },
  { label: "Text contains…", when: "contains", format: "redFill" },
  { label: "Date occurring…", when: "dateIn", format: "redFill" },
  { label: "Duplicate values", when: "duplicate", format: "redFill" },
  { label: "Top 10", when: "top", format: "greenFill" },
  { label: "Above average", when: "aboveAverage", format: "greenFill" },
  { label: "By keywords…", format: "byPattern" },
  { label: "By number ranges…", format: "byRange" },
  { label: "Color scale", format: "colorScale" },
  { label: "Levels…", format: "levels" },
  { label: "Data bar", format: "dataBar" },
  { label: "Arrows", format: "arrows" },
];

type Evaluated = { readonly version: number; readonly preview: readonly StoredRule[] | undefined; readonly looks: TableLooks | undefined };

export class Conditions implements Feature {
  // Rules shown in a table instead of its own while the dialog (one at a time: the page's) edits them
  private preview: { readonly key: TableKey; readonly rules: readonly StoredRule[] } | undefined;
  // What a table's rules made of it, by the table (parsed tables are kept, so a table's text is one object)
  private evaluated = new WeakMap<Table, Evaluated>();
  // What went wrong, said once per page visit
  private readonly said = new Set<string>();

  constructor(private readonly host: ModelHost) {
    host.offer({ ranges: (table) => this.ranges(table) } satisfies ConditionsOffer);
  }

  /** A table's rules with the cells each applies to: body rows and columns, the pinned ones left out (ConditionsOffer) */
  private ranges(table: Table): ReturnType<ConditionsOffer["ranges"]> {
    const pins = this.host.pinsOf(table);
    const columns = table.rows[0]?.cells.length ?? 0;
    const rows: readonly [number, number] = [1 + pins.top, table.rows.length - 1 - pins.bottom];
    const all: readonly [number, number] = [pins.left, columns - 1 - pins.right];
    const named = new Map(this.host.rowNames(table).map((r) => [r.name.toLowerCase(), r.row]));
    return this.rulesIn(table).flatMap((rule) => {
      if (isUnread(rule)) return [];
      if (rule.scope.kind === "column") {
        const c = rule.scope.column;
        return c >= all[0] && c <= all[1] ? [{ rule, rows, columns: [c, c] as const }] : [];
      }
      if (rule.scope.kind === "row") {
        const row = named.get(rule.scope.name.toLowerCase());
        return row !== undefined && row >= rows[0] && row <= rows[1] ? [{ rule, rows: [row, row] as const, columns: all }] : [];
      }
      // Each column on its own where the rule says so, else the columns as one range
      if (rule.perColumn) return Array.from({ length: Math.max(0, all[1] - all[0] + 1) }, (_, i) => ({ rule, rows, columns: [all[0] + i, all[0] + i] as const }));
      return [{ rule, rows, columns: all }];
    });
  }

  /** Custom conditions or formats defined anew: tables with rules look as they say now */
  tablesChanged(): void {
    for (const info of this.host.shownTables()) if (this.rulesIn(parseTable(info.source)).length) this.host.looksChanged(info);
  }

  pageLoaded(): void {
    this.said.clear();
  }

  // ---- the rules of a table ----------------------------------------------------------------

  /** A table's rules in the order they apply: the table's and named rows', each column's */
  private rulesIn(table: Table): StoredRule[] {
    const own = rulesOf(this.host.getMeta(table, RULES), { kind: "table" });
    const columns = [...this.host.columnsMeta(table, RULES)].flatMap(([column, text]) => rulesOf(text, { kind: "column", column }));
    return inOrder([...own, ...columns]);
  }

  /** The table with these rules (in this order) stored: the table's and rows' on it, each column's on its column */
  private withRules(table: Table, rules: readonly StoredRule[]): Table {
    const ordered = rules.length > 1 ? numbered(rules) : rules.map((r) => (isUnread(r) ? r : (({ at: _, ...rest }) => rest)(r)));
    const own = ordered.filter((r) => r.scope.kind !== "column");
    const columns = new Map<number, StoredRule[]>();
    for (const rule of ordered) if (rule.scope.kind === "column") columns.set(rule.scope.column, [...(columns.get(rule.scope.column) ?? []), rule]);
    const texts = new Map<number, string>();
    for (const [column, list] of columns) texts.set(column, rulesText(list)!);
    return this.host.setColumnsMeta(this.host.setMeta(table, RULES, rulesText(own)), RULES, texts);
  }

  private canStore(table: Table): boolean {
    return this.host.canStoreMeta(table, RULES);
  }

  // ---- looks ------------------------------------------------------------------------------------

  looks(info: TableInfo, table: Table): TableLooks | undefined {
    const preview = this.preview?.key === info.key ? this.preview.rules : undefined;
    const version = definitionsVersion();
    const known = this.evaluated.get(table);
    // A table with `${…}` cells shows what its expressions give: not kept, they change without its text
    if (known && known.version === version && known.preview === preview && !table.rows.some((r) => r.cells.some((c) => c.includes("${")))) return known.looks;
    const looks = this.evaluate(info, table, preview ?? this.rulesIn(table));
    this.evaluated.set(table, { version, preview, looks });
    return looks;
  }

  private evaluate(info: TableInfo, table: Table, stored: readonly StoredRule[]): TableLooks | undefined {
    const rules = stored.filter((r): r is Rule => !isUnread(r));
    if (!rules.length) return undefined;
    const { inputsOf } = this.reader(info, table);
    const { styles, problems } = evaluateRules(rules.flatMap(inputsOf), this.rowFormula(table));
    for (const problem of problems) {
      const said = `${info.key}\u0000${problem}`;
      if (this.said.has(said)) continue;
      this.said.add(said);
      void this.host.bridge.flash(`Silverware Table: conditional formatting: ${problem}`, "error");
    }
    if (!styles.size) return undefined;
    const looks: (CellRef & CellLook)[] = [];
    for (const [key, style] of styles) {
      const [row, column] = key.split(":").map(Number) as [number, number];
      const look = styleLook(style);
      looks.push({ row, column, marks: look.marks, vars: look.vars });
    }
    return { cells: looks };
  }

  /**
   * A table's cells as rules read them, each read once: `inputsOf` a rule's cells (body only, pinned rows and
   * columns out; a whole table's as one range, or a range for each column where the rule says so)
   */
  private reader(info: TableInfo, table: Table): { readonly inputsOf: (rule: Rule) => RuleCells[]; readonly columnLabel: (column: number) => string } {
    const rowCount = table.rows.length;
    const header = table.rows[0]?.cells ?? [];
    const pins = this.host.pinsOf(table);
    const bodyRows = Array.from({ length: Math.max(0, rowCount - 1 - pins.top - pins.bottom) }, (_, i) => i + 1 + pins.top);
    const bodyColumns = header.map((_, c) => c).filter((c) => c >= pins.left && c < header.length - pins.right);
    const keys = header.map((h) => columnKey(columnName(unescapeCell(h))));
    const types = this.host.offered<ColumnTypesOffer>("columnTypes");
    // Each cell read once, as asked
    const cells = new Map<string, Placed>();
    const rowCells = new Map<number, Record<string, ReturnType<typeof cellOf>>>();
    const cellAt = (row: number, column: number) => {
      const raw = table.rows[row]?.cells[column] ?? "";
      const text = this.host.shownText(info, { row, column }) ?? unescapeCell(withoutTags(raw)).trim();
      const value = types ? types.valueOf(header[column] ?? "", text) : text;
      return cellOf(text, value, keys[column] ?? "");
    };
    const rowOf = (row: number) => {
      let cellsOfRow = rowCells.get(row);
      if (!cellsOfRow) {
        cellsOfRow = {};
        header.forEach((_, c) => (cellsOfRow![keys[c] ?? ""] ??= cellAt(row, c)));
        rowCells.set(row, cellsOfRow);
      }
      return cellsOfRow;
    };
    const placed = (row: number, column: number): Placed => {
      const key = `${row}:${column}`;
      let p = cells.get(key);
      if (!p) {
        p = { row, column, cell: cellAt(row, column), rowCells: rowOf(row) };
        cells.set(key, p);
      }
      return p;
    };
    const named = new Map(this.host.rowNames(table).map((r) => [r.name.toLowerCase(), r.row]));
    const cellsOf = (scope: RuleScope): Placed[] => {
      if (scope.kind === "column") return bodyColumns.includes(scope.column) ? bodyRows.map((r) => placed(r, scope.column)) : [];
      if (scope.kind === "row") {
        const row = named.get(scope.name.toLowerCase());
        return row !== undefined && bodyRows.includes(row) ? bodyColumns.map((c) => placed(row, c)) : [];
      }
      return bodyRows.flatMap((r) => bodyColumns.map((c) => placed(r, c)));
    };
    // A whole table's rule applies to its columns as one range (as a spreadsheet's), or to each on its own where it says so
    const inputsOf = (rule: Rule): RuleCells[] =>
      rule.scope.kind === "table" && rule.perColumn ? bodyColumns.map((c) => ({ rule, cells: cellsOf({ kind: "column", column: c }) })) : [{ rule, cells: cellsOf(rule.scope) }];
    return { inputsOf, columnLabel: (column) => columnName(unescapeCell(header[column] ?? "")) || `${column + 1}` };
  }

  /**
   * How a rule looks on the table's own cells, for the dialog's preview: a sample of each of its ranges (a line
   * each, at most PREVIEW_LINES), how many cells it formats of how many; the rule alone, as no other is before it
   */
  private ruleSample(shownInfo: TableInfo, rule: Rule): RuleSample {
    const info = this.host.tableFor(shownInfo.key) ?? shownInfo;
    const table = this.host.tableOf(info);
    const { inputsOf, columnLabel } = this.reader(info, table);
    const inputs = inputsOf(rule);
    const { styles } = evaluateRules(inputs, this.rowFormula(table));
    const several = inputs.length > 1;
    return {
      lines: inputs.slice(0, PREVIEW_LINES).map((input) => ({
        ...(several ? { label: columnLabel(input.cells[0]?.column ?? 0) } : {}),
        cells: sampleOf(input.cells, styles),
      })),
      more: Math.max(0, inputs.length - PREVIEW_LINES),
      formatted: inputs.reduce((n, input) => n + input.cells.filter((p) => styles.has(`${p.row}:${p.column}`)).length, 0),
      total: inputs.reduce((n, input) => n + input.cells.length, 0),
    };
  }

  /** A formula of one row for a row of the table, through the formulas module (off: none) */
  private rowFormula(table: Table): (row: number, formula: string) => string | number | boolean | undefined {
    const formulas = this.host.offered<FormulasOffer>("formulas");
    const values = new Map<string, readonly Scalar[]>();
    return (row, formula) => {
      if (!formulas) return undefined;
      let list = values.get(formula);
      if (!list) {
        list = formulas.rowValues(table, formula);
        values.set(formula, list);
      }
      const value = list[row - 1];
      if (value === undefined || value === null || value instanceof FormulaError) return undefined;
      if (typeof value === "boolean" || typeof value === "number") return value;
      const text = scalarText(value);
      return isErrorText(text) ? undefined : text;
    };
  }

  // ---- the dialog ---------------------------------------------------------------------------------

  /** The table's rules edited in the dialog; `added`: a new rule, its editor open */
  private openDialog(shownInfo: TableInfo, added?: Rule): void {
    const info = this.host.tableFor(shownInfo.key) ?? shownInfo;
    const table = parseTable(info.source);
    const header = table.rows[0]?.cells ?? [];
    const pins = this.host.pinsOf(table);
    const columns: ScopeColumn[] = header
      .map((h, column) => ({ column, name: columnName(unescapeCell(h)) || `${column + 1}` }))
      .filter(({ column }) => column >= pins.left && column < header.length - pins.right);
    const shown = () => this.host.tableFor(info.key) ?? info;
    // The table in view, so a look under the dialog finds it
    this.host.revealCell(info, { row: Math.min(1, Math.max(0, info.rows - 1)), column: columns[0]?.column ?? 0 });
    openConditionsDialog(this.host, {
      title: this.host.tableName(table) ? `Conditional formatting: ${this.host.tableName(table)}` : "Conditional formatting",
      columns,
      rows: this.host.rowNames(table).map((r) => r.name),
      rules: this.rulesIn(table),
      ...(added ? { added } : {}),
      preview: (rules) => {
        this.preview = rules ? { key: info.key, rules } : undefined;
        this.host.looksChanged(shown());
      },
      save: (rules) => void this.save(shown(), rules),
      sample: (rule) => this.ruleSample(shown(), rule),
      ...(this.canStore(table) ? {} : { blocked: NEEDS_METADATA }),
    });
  }

  private async save(info: TableInfo, rules: readonly StoredRule[]): Promise<void> {
    await this.host.writeTable(info, (table) => this.withRules(table, rules));
    if (this.preview?.key === info.key) this.preview = undefined;
    this.host.toolbarChanged();
  }

  // ---- where it is offered --------------------------------------------------------------------------

  /** Conditional formatting… in the ⋯ menu always; an icon in the toolbar too where the table has rules */
  toolbarButtons(info: TableInfo): ToolbarButton[] {
    const table = parseTable(info.source);
    const count = this.rulesIn(table).length;
    const title = count ? `Conditional formatting: ${count} ${count === 1 ? "rule" : "rules"} (cells that look different by their values)` : "Conditional formatting: cells that look different by their values";
    const menu: ToolbarButton = { label: "Conditional formatting…", title, icon: ICONS.conditions, run: () => this.openDialog(info), ...(count ? { value: `${count}` } : {}) };
    return count ? [{ label: "Conditional formatting", title, icon: ICONS.conditions, place: "icon", pressed: true, run: () => this.openDialog(info) }, menu] : [menu];
  }

  /** Conditional formatting in a column's menu: quick rules for the column, the table's rules, the column's cleared */
  columnMenuEntries(info: TableInfo, column: number, open: (title: string, entries: readonly MenuEntry[]) => void): MenuEntry[] {
    const table = parseTable(info.source);
    const pins = this.host.pinsOf(table);
    const columns = table.rows[0]?.cells.length ?? 0;
    if (column < pins.left || column >= columns - pins.right) return [];
    const own = this.rulesIn(table).filter((r) => r.scope.kind === "column" && r.scope.column === column);
    const scope: RuleScope = { kind: "column", column };
    const quick = (q: (typeof QUICK)[number]): MenuEntry => ({
      kind: "item",
      label: q.label,
      icon: "",
      run: () => this.openDialog(info, { scope, ...(q.when ? { when: { name: q.when, params: {} } } : {}), format: { name: q.format, params: {} } }),
    });
    const blocked = this.canStore(table) ? undefined : NEEDS_METADATA;
    const entries = (): MenuEntry[] => [
      ...QUICK.slice(0, 9).map(quick),
      { kind: "separator" },
      ...QUICK.slice(9).map(quick),
      { kind: "separator" },
      { kind: "item", label: "Manage rules…", icon: ICONS.conditions, run: () => this.openDialog(info) },
      {
        kind: "item",
        label: own.length ? `Clear rules of this column (${own.length})` : "Clear rules of this column",
        icon: ICONS.clear,
        danger: true,
        run: () => void this.save(info, this.rulesIn(parseTable((this.host.tableFor(info.key) ?? info).source)).filter((r) => !(r.scope.kind === "column" && r.scope.column === column))),
        ...(own.length ? {} : { disabled: "The column has no rules" }),
      },
    ];
    return [
      {
        kind: "item",
        label: "Conditional formatting",
        icon: ICONS.conditions,
        submenu: true,
        ...(own.length ? { value: { text: `${own.length}` } } : {}),
        ...(blocked && !own.length ? { disabled: blocked } : {}),
        run: () => open("Conditional formatting", entries()),
      },
    ];
  }

  /** Conditional formatting… in the cell menu: a new rule for the cells' column (all in one), else the table */
  cellMenuEntries(info: TableInfo, cells: readonly CellRef[]): CellMenuGroup | undefined {
    if (!cells.length) return undefined;
    const table = parseTable(info.source);
    const pins = this.host.pinsOf(table);
    const columns = table.rows[0]?.cells.length ?? 0;
    const column = cells.every((c) => c.column === cells[0]!.column) ? cells[0]!.column : undefined;
    const scope: RuleScope = column !== undefined && column >= pins.left && column < columns - pins.right ? { kind: "column", column } : { kind: "table" };
    return {
      order: CELL_MENU_ORDER.viewing,
      entries: [
        {
          kind: "item",
          label: "Conditional formatting…",
          icon: ICONS.conditions,
          // A table with rules: they are shown (a rule is added in the dialog); without: a first one for the cells' column
          run: () => (this.rulesIn(table).length ? this.openDialog(info) : this.openDialog(info, { scope, when: { name: "greater", params: {} }, format: { name: "redFill", params: {} } })),
          ...(this.canStore(table) ? {} : { disabled: NEEDS_METADATA }),
        },
      ],
    };
  }
}
