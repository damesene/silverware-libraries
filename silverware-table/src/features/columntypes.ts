// Column types in the table: a column whose header has a type's hashtag
// (`| Price #currency |`) shows its cells as that type (columntypes/), hides that
// hashtag, and marks the cells that are not values of the type. The markdown
// keeps the values as written: sorting, filters and copying use them. A
// choice list made by a formula (`columntypes.choice.projects='=@projects'`)
// is calculated by the formulas module (its offer `list`) as the column shows,
// never written.
import { type CellEditor, type CellLook, type CellRef, type Feature, HEADER_ICON_ORDER, type HeaderLook, type Panel, type ModelHost, type TableLooks, type TableInfo } from "../core/feature.ts";
import type { LineMenuBuilder, LineMenuGroup, LineMenuTarget } from "../core/feature.ts";
import { ICONS } from "../icons.ts";
import type { MenuDetail, MenuEntry } from "../menu.ts";
import { setCell } from "../ops.ts";
import { escapeCell, parseTable, type Table, unescapeCell } from "../markdown.ts";
import { withoutTags } from "../tags.ts";
import {
  type Choice,
  type ColumnType,
  columnTypeOf,
  type TypedColumn,
  typeOfTag,
  allTypes,
  type ColumnTypesOffer,
  listFormula,
  listKey,
  listNames,
  listOfValues,
  type ListRead,
  readChoiceList,
  choiceListOf,
  isChoice,
  typeTagPatterns,
  type TypeTable,
  withColumnType,
} from "../columntypes/index.ts";
import { FormulaError, formulaSources, formulaTableNames, type FormulasOffer, type HeldFormulas, type HeldFormulasOffer } from "../formulas/index.ts";
import { sameTableName } from "../namerules.ts";
import { ChoicesDialog } from "./choicesdialog.ts";

/** A type's icon, or a tag for a type without one */
function iconOf(type: ColumnType): string {
  return type.icon ?? ICONS.columnType;
}

/** A column's icon: its type's for its parameters (a choice of a list), else its type's */
function columnIcon(typed: TypedColumn): string {
  try {
    return typed.type.iconFor?.(typed.params) ?? iconOf(typed.type);
  } catch {
    return iconOf(typed.type);
  }
}

/** A type's name for menus: stars is Stars */
function typeLabel(name: string): string {
  return name[0]!.toUpperCase() + name.slice(1);
}

/** A type in the menu's bubble: how it is written, what it shows, and MdTableRender's hashtags for it */
function typeDetail(type: ColumnType, tag?: string): MenuDetail {
  const aliases = Object.keys(type.aliases ?? {}).map((alias) => `#${alias}`);
  return {
    title: tag ? `${typeLabel(type.name)}: #${tag}` : typeLabel(type.name),
    code: type.syntax.split(",").map((form) => form.trim()),
    text: type.description,
    notes: aliases.length ? [`Also written as ${aliases.join(", ")}`] : undefined,
  };
}

/**
 * What a type's method gives for a column, or why it failed: a custom type is
 * the user's code, and one that throws (or gives what a type does not) marks
 * the cell instead of breaking the table
 */
function attempt<T>(typed: TypedColumn, call: () => T): T | string {
  try {
    return call();
  } catch (e) {
    return `#${typed.tag} failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** The values the open cell editor offers: the type's, those shown for what is typed, the one the arrows are on */
type Picking = {
  readonly editor: CellEditor;
  readonly choices: readonly Choice[];
  shown: readonly Choice[];
  active: number;
};

export class ColumnTypes implements Feature {
  // A list of the type's values under the cell editor (a datalist would offer
  // only the values that start with what the field holds: none to change to)
  private readonly picker: Panel;
  private picking: Picking | undefined;
  private readonly choicesDialog: ChoicesDialog;
  // The lists read, by table and name, as of the page's text (a formula's reads the page's other tables); emptied
  // as what formulas read outside the page changes (tablesChanged)
  private lists: { readonly text: string; readonly byTable: WeakMap<Table, Map<string, ListRead>> } | undefined;

  constructor(private readonly host: ModelHost) {
    this.choicesDialog = new ChoicesDialog(host, (table, formula) => this.formulaList(table, formula));
    // The type hashtags of headers hidden from the start (a table shows before its looks apply)
    host.hideHeaderTags("types", typeTagPatterns());
    this.picker = host.panel("swt-choices");
    this.picker.element.setAttribute("role", "listbox");
    host.offer({ valueOf: (header, text) => this.valueOf(header, text), held: (table) => this.held(table) } satisfies ColumnTypesOffer & HeldFormulasOffer);
  }

  /** A cell's value as its column's type compares it, as its looks give it (`value`): the text where it is none of the type's */
  private valueOf(header: string, text: string): string {
    const typed = columnTypeOf(unescapeCell(header));
    if (!typed || text === "") return text;
    // A custom type's method that throws: the text, as its cell shows marked
    try {
      // Its table unknown: a value whose check needs the table (a choice's list) is taken as one, its value its text
      if (typed.type.check(text, typed.params) !== undefined) return text;
      const value = typed.type.sortValue?.(text, typed.params);
      return typeof value === "string" ? value : text;
    } catch {
      return text;
    }
  }

  stop(): void {
    this.picker.remove();
    this.choicesDialog.close();
  }

  /** What a column's type reads of its table: the column types' data there, the column's values */
  private typeTable(table: Table, column: number): TypeTable {
    let values: string[] | undefined;
    let stored: ReadonlyMap<string, string> | undefined;
    const host = this.host;
    // Read only by a type that asks (a choice's list): most types never do
    return {
      list: (name) => this.listOf(table, name, (stored ??= host.metaOf(table))).values,
      values: () =>
        (values ??= table.rows
          .slice(1)
          .map((r) => unescapeCell(withoutTags(r.cells[column] ?? "")).trim())
          .filter((text) => text !== "")),
    };
  }

  /**
   * A choice list of the table, read once per table and page text: kept as a list of texts, or made by a formula
   * (its leading "="), calculated by the formulas module on the page shown; undefined values where it gives none, with why
   */
  private listOf(table: Table, name: string, stored = this.host.metaOf(table)): ListRead {
    const text = this.host.pageText;
    if (this.lists?.text !== text) this.lists = { text, byTable: new WeakMap() };
    let read = this.lists.byTable.get(table);
    if (!read) this.lists.byTable.set(table, (read = new Map()));
    let list = read.get(name);
    if (!list) read.set(name, (list = this.readList(table, stored.get(listKey(name)))));
    return list;
  }

  private readList(table: Table, stored: string | undefined): ListRead {
    const formula = listFormula(stored);
    if (formula === undefined) return { values: readChoiceList(stored) };
    const read = this.formulaList(table, formula);
    return read.problem ? { problem: `its formula (${formula}) ${read.problem}` } : read;
  }

  /** The values a list's formula gives a table now (the formulas module's), as the column checks them; or why none (also the Choices dialog's) */
  private formulaList(table: Table, formula: string): ListRead {
    const formulas = this.host.offered<FormulasOffer>("formulas");
    if (!formulas) return { problem: "is calculated by the formulas module, which is off" };
    const problem = formulas.problem(formula);
    if (problem) return { problem: `does not read: ${problem}` };
    const result = formulas.list(table, formula);
    if (result === undefined) {
      const off = !this.host.offered("sources") && formulaSources(formula).length;
      return { problem: off ? "reads a source of the space, and the sources module is off" : "reads a page or a source not read yet" };
    }
    if (result instanceof FormulaError) return { problem: `gives ${result.code} ${result.detail}` };
    return { values: listOfValues(result) };
  }

  /**
   * A table's lists made by formulas, for the formulas module: what the table reads, followed through the edits of
   * the tables they read (a column renamed, a table renamed) and written back in the same write
   */
  private held(table: Table): HeldFormulas | undefined {
    const stored = this.host.metaOf(table);
    const lists = listNames(stored).flatMap((name) => {
      const formula = listFormula(stored.get(listKey(name)));
      return formula === undefined ? [] : [{ name, formula }];
    });
    if (!lists.length) return undefined;
    return {
      formulas: lists.map((list) => list.formula),
      follow: (follow) =>
        lists.reduce((t, { name, formula }) => {
          const followed = follow(formula);
          return followed === formula ? t : this.host.setMeta(t, listKey(name), followed);
        }, table),
    };
  }

  /** The formulas of a table's choice lists (none where it has no list made by one) */
  private listFormulas(table: Table): readonly string[] {
    return this.held(table)?.formulas ?? [];
  }

  /**
   * Custom types were defined anew: their hashtags are hidden too (tables rendered from now on show them typed);
   * what formulas read outside the page changed (a source read anew, another page): lists made by formulas read again
   */
  tablesChanged(): void {
    this.host.hideHeaderTags("types", typeTagPatterns());
    this.lists = undefined;
    for (const info of this.host.shownTables()) if (this.listFormulas(parseTable(info.source)).length) this.host.looksChanged(info);
  }

  /** A table shown anew (edited): the tables whose lists' formulas read it look as their lists are now */
  enhanced(info: TableInfo): void {
    const name = this.host.tableName(parseTable(info.source))?.trim();
    if (!name) return;
    for (const other of this.host.shownTables()) {
      if (other.key === info.key) continue;
      const reads = this.listFormulas(parseTable(other.source)).some((formula) => formulaTableNames(formula).some((read) => sameTableName(read, name)));
      if (reads) this.host.looksChanged(other);
    }
  }

  // ---- the column menu ----------------------------------------------------------

  /** "Type: …" in a column's menu (what the column is): picks the column's type, written as a hashtag in its header */
  lineMenu(info: TableInfo, { axis, at: column }: LineMenuTarget, menu: LineMenuBuilder): LineMenuGroup[] {
    if (axis !== "column") return [];
    const table = parseTable(info.source);
    const header = table.rows[0]?.cells[column] ?? "";
    const current = columnTypeOf(unescapeCell(header));
    const setType = (tag: string | undefined) => () =>
      void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => setCell(t, 0, column, withColumnType(t.rows[0]?.cells[column] ?? "", tag)));
    const choices: MenuEntry[] = [
      { kind: "item", label: "No type", icon: ICONS.clear, checked: !current, run: setType(undefined) },
      { kind: "separator" },
      ...allTypes().flatMap((type): MenuEntry[] => {
        // The type's first form where it names the type (#unit-kg: #unit needs its unit; a
        // custom type's syntax is free text), else its name; the same type keeps its parameters
        const first = type.syntax.split(",")[0]!.trim().replace(/^#/, "");
        const tag = typeOfTag(first)?.type === type ? first : type.name;
        // Choice opens the Choices dialog, the column's values or a list of its own; a list of the table is
        // picked in the rows under it, which mark it (Choice checked for #choice alone)
        const choice = isChoice({ type });
        const same = current?.type === type && !(choice && current.params.name !== undefined);
        const item: MenuEntry = {
          kind: "item",
          label: typeLabel(type.name),
          icon: iconOf(type),
          checked: same,
          detail: typeDetail(type),
          run: choice ? () => this.choicesDialog.open(info, column) : setType(current?.type === type ? current.tag : tag),
        };
        return choice ? [item, ...this.listEntries(info, table, column, type)] : [item];
      }),
    ];
    // As Filter: the type's name after Type, its icon opening the list of types, a × removing it
    return [
      menu.slot.columnType([
        menu.segmented({
          label: current ? `Type: ${typeLabel(current.type.name)}` : "Type",
          options: [
            {
              icon: current ? columnIcon(current) : ICONS.columnType,
              title: current ? `Change the column's type (${typeLabel(current.type.name)})` : "Choose how the column's cells show",
              run: () => menu.open("Column type", choices),
            },
            // A choice column's values: its own list or the column's (the Choices dialog)
            ...(isChoice(current) ? [{ icon: ICONS.rename, title: "Edit the column's choices", run: () => this.choicesDialog.open(info, column) }] : []),
            {
              icon: ICONS.clear,
              title: "Remove the column's type",
              run: setType(undefined),
              ...(current ? {} : { disabled: "The column has no type" }),
            },
          ],
        }),
      ]),
    ];
  }

  /**
   * The lists of choices the table keeps (values or a formula, its hint showing
   * it), under the Choice type in the Type menu: each taken for the column, or
   * deleted where no column takes it (a list no column takes stays until
   * deleted so)
   */
  private listEntries(info: TableInfo, table: Table, column: number, choice: ColumnType): MenuEntry[] {
    const users = new Map<string, string[]>();
    table.rows[0]?.cells.forEach((cell) => {
      const name = choiceListOf(unescapeCell(cell));
      if (name !== undefined) users.set(name, [...(users.get(name) ?? []), unescapeCell(withoutTags(withColumnType(cell, undefined))) || "(no name)"]);
    });
    const taken = choiceListOf(unescapeCell(table.rows[0]?.cells[column] ?? ""));
    const write = (change: (t: Table) => Table) => void this.host.writeTable(this.host.tableFor(info.key) ?? info, change);
    // The list taken for the column: its header naming it
    const take = (name: string) => () => write((t) => setCell(t, 0, column, withColumnType(t.rows[0]?.cells[column] ?? "", `choice-${name}`)));
    const stored = this.host.metaOf(table);
    return listNames(stored).map((name): MenuEntry => {
      const used = users.get(name);
      // A list made by a formula: its formula first, as where its values come from
      const formula = listFormula(stored.get(listKey(name)));
      const usedBy = used ? `Used by ${used.join(", ")}` : "Used by no column";
      return {
        kind: "segmented",
        label: `Choice: ${name}`,
        hint: formula === undefined ? usedBy : `${formula} · ${usedBy}`,
        options: [
          {
            icon: choice.iconFor?.({ name }) ?? iconOf(choice),
            title: `Take the list ${name} for this column`,
            active: taken === name,
            run: take(name),
          },
          {
            icon: ICONS.trash,
            title: `Delete the list ${name}`,
            run: () => void this.deleteList(info, name, used),
          },
        ],
      };
    });
  }

  /**
   * Deletes a list of the table; one columns take asked first, those columns
   * then left without a type, in the same write (their cells stay as written)
   */
  private async deleteList(info: TableInfo, name: string, used: readonly string[] | undefined): Promise<void> {
    if (used) {
      const columns = used.length === 1 ? `the column ${used[0]}` : `the columns ${used.join(", ")}`;
      if (!(await this.host.ask(`Delete the list ${name}? ${columns[0]!.toUpperCase()}${columns.slice(1)} take${used.length === 1 ? "s" : ""} it and will have no type; the cells stay as written.`))) return;
    }
    void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => {
      let table = this.host.setMeta(t, listKey(name), undefined);
      table.rows[0]?.cells.forEach((cell, c) => {
        if (choiceListOf(unescapeCell(cell)) === name) table = setCell(table, 0, c, withColumnType(cell, undefined));
      });
      return table;
    });
  }

  // ---- the cell editor ------------------------------------------------------------

  /** A header is edited as the column's name: its type's hashtag is the menu's business */
  editorText(info: TableInfo, cell: CellRef, original: string): string | undefined {
    if (cell.row !== 0 || !columnTypeOf(unescapeCell(original))) return undefined;
    return unescapeCell(withoutTags(withColumnType(original, undefined)));
  }

  /** The type of the edited cell's column, if any (header cells have none), and what it reads of its table */
  private typeOfEdited(editor: CellEditor): (TypedColumn & { readonly table: TypeTable }) | undefined {
    if (editor.row === 0) return undefined;
    const table = parseTable(this.host.tableFor(editor.key)?.source ?? "");
    const header = table.rows[0]?.cells[editor.column];
    const typed = header === undefined ? undefined : columnTypeOf(unescapeCell(header));
    return typed && { ...typed, table: this.typeTable(table, editor.column) };
  }

  /** A type with values to offer: a list of them under the cell, picked with the mouse or the arrows and Enter */
  editorOpened(editor: CellEditor): void {
    const typed = this.typeOfEdited(editor);
    const choices = typed && attempt(typed, () => typed.type.choices?.(typed.params, typed.table));
    if (!choices || typeof choices === "string" || !choices.length) return;
    this.picking = { editor, choices, shown: [], active: -1 };
    this.showChoices();
  }

  editorInput(editor: CellEditor): void {
    if (this.picking?.editor === editor) this.showChoices();
  }

  editorClosed(): void {
    this.picking = undefined;
    this.picker.hide();
  }

  /** Arrows move along the list, Enter takes the value they are on (and then saves as Enter does) */
  editorKeyDown(e: KeyboardEvent, editor: CellEditor): boolean {
    const picking = this.picking;
    if (!picking || picking.editor !== editor || !this.picker.shown) return false;
    if (e.ctrlKey || e.altKey || e.metaKey) return false;
    const count = picking.shown.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      picking.active = e.key === "ArrowDown" ? (picking.active + 1) % count : (picking.active - 1 + count) % count;
      this.renderChoices();
      return true;
    }
    if (e.key === "Enter" && !e.shiftKey && picking.active >= 0) editor.setText(picking.shown[picking.active]!.value);
    return false;
  }

  /**
   * The values for what the field holds: all of them while it holds what the
   * cell had (even a value not of the type), is empty or is one of them (to
   * change it to another), else those that contain what is typed
   */
  private showChoices(): void {
    const picking = this.picking;
    if (!picking) return;
    const text = picking.editor.text;
    const typed = text.trim().toLowerCase();
    const isChoice = picking.choices.some((c) => c.value.toLowerCase() === typed);
    picking.shown =
      typed === "" || isChoice || text === picking.editor.initial
        ? picking.choices
        : picking.choices.filter((c) => c.value.toLowerCase().includes(typed) || c.label.toLowerCase().includes(typed));
    // The arrows start from the cell's value: ↓ is the next one
    picking.active = picking.shown.findIndex((c) => c.value.toLowerCase() === typed);
    // A formula is not one of the values: its own help shows there
    if (!picking.shown.length || typed.startsWith("=")) {
      this.picker.hide();
      return;
    }
    this.renderChoices();
    // Under the cell, or above it where the window has no room below
    this.picker.show({ kind: "editor" }, { minWidth: "anchor" });
  }

  private renderChoices(): void {
    const picking = this.picking;
    if (!picking) return;
    const typed = picking.editor.text.trim().toLowerCase();
    const list = this.picker.element;
    list.replaceChildren(
      ...picking.shown.map((choice, index) => {
        const option = this.host.doc.createElement("div");
        option.className = "swt-choice";
        option.setAttribute("role", "option");
        option.textContent = choice.label;
        option.classList.toggle("swt-current", choice.value.toLowerCase() === typed);
        option.classList.toggle("swt-active", index === picking.active);
        option.setAttribute("aria-selected", String(index === picking.active));
        // Picking saves the value as Enter would
        option.addEventListener("click", () => {
          if (this.picking !== picking) return;
          this.picker.hide();
          picking.editor.setText(choice.value);
          picking.editor.commit();
        });
        return option;
      }),
    );
    // The value the arrows are on stays in the list's view (the list alone scrolls, not the page)
    const active = list.querySelector<HTMLElement>(".swt-active");
    if (active && active.offsetTop < list.scrollTop) list.scrollTop = active.offsetTop;
    else if (active && active.offsetTop + active.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = active.offsetTop + active.offsetHeight - list.clientHeight;
    }
  }

  /**
   * A header keeps its type's hashtag after the name typed (an emptied name
   * stays the old one: a column needs a name). A value that is not of the
   * column's type is saved as typed, and said so.
   */
  editorValue(editor: CellEditor, typed: string): string | undefined {
    if (editor.row === 0) {
      const kept = columnTypeOf(unescapeCell(editor.original));
      return kept && typed.trim() !== "" ? withColumnType(escapeCell(typed), kept.tag) : undefined;
    }
    const column = this.typeOfEdited(editor);
    const text = typed.trim();
    if (!column || text === "" || text.startsWith("=")) return undefined;
    const error = attempt(column, () => column.type.check(text, column.params, column.table));
    if (error) void this.host.bridge.flash(`Silverware Table: ${error} (#${column.tag}); saved as typed`, "info");
    return undefined;
  }

  // A header renamed by a paste keeps its type's hashtag, as one renamed in its editor
  headerRenamed(name: string, original: string): string | undefined {
    const kept = columnTypeOf(unescapeCell(original));
    return kept && name.trim() !== "" ? withColumnType(name, kept.tag) : undefined;
  }

  /**
   * A typed column: its header without the type's hashtag, the type's icon
   * after its name; its cells shown as the type formats them (their value for
   * sorting the type's), those that are not values of the type marked with why
   */
  looks(info: TableInfo, table: Table): TableLooks | undefined {
    const headers: ({ column: number } & HeaderLook)[] = [];
    const cells: (CellRef & CellLook)[] = [];
    table.rows[0]?.cells.forEach((name, column) => {
      const typed = columnTypeOf(unescapeCell(name));
      if (!typed) return;
      const typeTable = this.typeTable(table, column);
      // A choice list that gives no values (its formula's error): the column checks nothing, its icon says why
      const list = isChoice(typed) && typed.params.name !== undefined ? this.listOf(table, String(typed.params.name).toLowerCase()) : undefined;
      const why = list?.problem ? `
The list ${String(typed.params.name).toLowerCase()} checks nothing: ${list.problem}` : "";
      headers.push({
        column,
        hidesTag: (tag) => !!typeOfTag(tag),
        icons: [{ svg: columnIcon(typed), title: `${typeLabel(typed.type.name)} (#${typed.tag}): ${typed.type.description}${why}`, className: "swt-type-icon", order: HEADER_ICON_ORDER.kind }],
      });
      table.rows.forEach((r, row) => {
        const raw = r.cells[column];
        if (row === 0 || raw === undefined) return;
        // The cell's text: a formula's result, without the hidden tags
        const text = unescapeCell(withoutTags(raw)).trim();
        // Only plain values: a cell with markup (a link, emphasis) is left as it is
        if (text === "" || this.host.shownText(info, { row, column }) !== text) return;
        const { type, params } = typed;
        // What the cell shows, or why it is not a value of the type (or why the type failed on it)
        const shown = attempt(typed, () => {
          const error = type.check(text, params, typeTable);
          return error === undefined ? { value: type.sortValue?.(text, params) ?? text, shown: type.format(text, params) } : error;
        });
        // Where sorting puts it: its rank first (numbers of one width, so they compare as text does), then its value
        const rank = attempt(typed, () => type.rank?.(text, params, typeTable));
        const value = typeof shown === "string" ? text : shown.value;
        const sortKey = typeof rank === "number" ? { sortKey: `${String(rank).padStart(6, "0")} ${value}` } : {};
        if (typeof shown === "string") cells.push({ row, column, value: text, marks: ["type-invalid"], title: shown, ...sortKey });
        else cells.push({ row, column, value: shown.value, display: shown.shown, ...sortKey });
      });
    });
    return headers.length ? { headers, cells } : undefined;
  }
}
