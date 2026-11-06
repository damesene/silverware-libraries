// The column types module's Choices dialog, opened as a column's type is set
// to Choice and by the pencil of its Type row: whether the column offers the
// values it has (`#choice`, nothing checked) or takes a list
// (`#choice-<name>`), kept in the table's metadata row by its name: values of
// its own, or a formula (`=SORT(UNIQUE(tasks![status]))`), its values
// calculated as the column shows; a source of the space picked over its field
// writes the source's formula into it (`=@projects`). A value of a list of its own renamed is
// renamed in the cells of every column taking the list, the list renamed in
// their headers, all in one write; a value deleted leaves its cells, marked
// as not of the list. In the core's dialog (ModelHost.openDialog).
import { reorder } from "../../../shared/drag.ts";
import { el } from "../../../shared/elements.ts";
import { columnIdOf } from "../columns.ts";
import {
  choiceListOf,
  columnTypeOf,
  distinctValues,
  isChoice,
  LIST_NAME_RE,
  listFormula,
  listKey,
  listNameFor,
  listNames,
  type ListRead,
  readChoiceList,
  withColumnType,
  writeChoiceList,
} from "../columntypes/index.ts";
import type { Dialog, ModelHost, TableInfo } from "../core/feature.ts";
import { formulaField } from "../formulafield.ts";
import { type FormulasOffer, referencedColumn, sourceFormulaOf, sourceRefText, withEquals } from "../formulas/index.ts";
import { ICONS } from "../icons.ts";
import { escapeCell, parseTable, type Table, unescapeCell } from "../markdown.ts";
import { setCell } from "../ops.ts";
import type { SourcesOffer } from "../sources.ts";
import { withoutTags } from "../tags.ts";

/** Where a choice column's values come from: its own values, a list of the table's own, a formula (a source's among them) */
type Way = "column" | "list" | "formula";

/** A value's row in the dialog: the value it was (none: added here) and its field */
type ValueRow = { readonly original: string | undefined; readonly field: HTMLInputElement; readonly element: HTMLElement };

/** How many of the values a formula gives the dialog shows */
const SHOWN = 200;

/** A cell's text as a value: without its hidden tags, unescaped, trimmed */
const textOf = (cell: string): string => unescapeCell(withoutTags(cell)).trim();

// Why the ways that need formulas cannot be picked while the formulas module is off
const FORMULAS_OFF = "it is calculated by the formulas module, which is off: turn it on in the settings";

export class ChoicesDialog {
  private dialog: Dialog | undefined;

  constructor(
    private readonly host: ModelHost,
    // A list's formula read for a table as the column checks it (the column types module's)
    private readonly read: (table: Table, formula: string) => ListRead,
  ) {}

  close(): void {
    this.dialog?.close();
  }

  /** Opens the dialog for a column: a choice column's, or one to become one (nothing written until Save) */
  open(info: TableInfo, column: number): void {
    const { doc } = this.host;
    const table = parseTable((this.host.tableFor(info.key) ?? info).source);
    const header = table.rows[0]?.cells[column] ?? "";
    const columnName = unescapeCell(withoutTags(withColumnType(header, undefined)));
    const stored = this.host.metaOf(table);
    const formulas = this.host.offered<FormulasOffer>("formulas");
    const sources = this.host.offered<SourcesOffer>("sources");
    const sourceNames = sources?.names() ?? [];
    const was = choiceListOf(unescapeCell(header));
    // The list the column names, kept in the table (one that does not read is replaced: its values start from the column's)
    const kept = was !== undefined && stored.has(listKey(was));
    const keptFormula = kept ? listFormula(stored.get(listKey(was!))) : undefined;
    const list = kept && keptFormula === undefined ? readChoiceList(stored.get(listKey(was!))) : undefined;
    const taken = listNames(stored).filter((name) => name !== was || !kept);
    // The column's values, each once
    const present = (): string[] => distinctValues(table.rows.slice(1).map((row) => textOf(row.cells[column] ?? "")).filter((text) => text !== ""));

    const rows: ValueRow[] = [];
    const values = el(doc, "div", "swt-choices-values");
    const note = el(doc, "span", "swt-dialog-note");
    const nameField = el(doc, "input", { class: "swt-choices-name", attrs: { spellcheck: "false", "aria-label": "Name of the list" } });
    nameField.value = was ?? listNameFor(columnName, taken);
    // A name not typed nor kept follows the source picked (=@projects: projects)
    let nameTyped = was !== undefined;
    // A list needs the metadata setting, but where the column's is kept already
    const storable = kept || this.host.canStoreMeta(table, listKey(nameField.value));
    // A column of a list (or one becoming a choice column, where a list can be kept) starts on its list, `#choice` on the column's values
    const plainChoice = was === undefined && isChoice(columnTypeOf(unescapeCell(header)));
    let way: Way = keptFormula !== undefined ? "formula" : storable && !plainChoice ? "list" : "column";
    const tagHint = el(doc, "span", "swt-choices-tag");
    const showTag = () => (tagHint.textContent = `#choice-${nameField.value.trim().toLowerCase()}`);
    nameField.addEventListener("input", () => {
      nameTyped = true;
      showTag();
    });
    showTag();

    const addRow = (value: string, original: string | undefined, after?: ValueRow): ValueRow => {
      const field = el(doc, "input", { class: "swt-choices-value", attrs: { spellcheck: "false", "aria-label": "Value" } });
      field.value = value;
      // Dragged by its grip, left of its field (the field stays a field to type in)
      const grip = el(doc, "button", { class: "swt-choices-icon swt-choices-grip", html: ICONS.grip, title: "Move (drag, or Alt+↑ ↓)" });
      const element = el(doc, "div", "swt-choices-row", grip, field);
      const row: ValueRow = { original, field, element };
      const move = (by: number, focus: HTMLElement) => {
        const i = rows.indexOf(row);
        const j = i + by;
        if (j < 0 || j >= rows.length) return;
        rows.splice(i, 1);
        rows.splice(j, 0, row);
        values.replaceChildren(...rows.map((r) => r.element));
        focus.focus();
      };
      grip.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        // (No text selected by the drag; the grip focused, so Alt+↑ ↓ then moves its value)
        e.preventDefault();
        grip.focus();
        reorder(e, {
          element,
          base: "swt-choices",
          layer: this.dialog?.element,
          flow: "block",
          containers: () => [values],
          items: (container) => Array.from(container.querySelectorAll<HTMLElement>(":scope > .swt-choices-row")),
          // Let go: the value at its new place; cancelled (or let go where it was): the rows as the values are
          done: (to) => {
            if (to) {
              rows.splice(rows.indexOf(row), 1);
              rows.splice(to.index, 0, row);
            }
            if (rows.some((r, i) => values.children[i] !== r.element)) values.replaceChildren(...rows.map((r) => r.element));
          },
        });
      });
      // Alt+↑ ↓ moves the value, from its field or its grip
      element.addEventListener("keydown", (e) => {
        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        move(e.key === "ArrowUp" ? -1 : 1, e.target as HTMLElement);
      });
      element.append(
        el(doc, "button", {
          class: "swt-choices-icon",
          html: ICONS.clear,
          title: original === undefined ? "Remove" : "Remove (its cells stay, marked as not of the list)",
          run: () => {
            const i = rows.indexOf(row);
            rows.splice(i, 1);
            element.remove();
            (rows[i] ?? rows[i - 1])?.field.focus();
          },
        }),
      );
      // Enter adds a value after this one
      field.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          addRow("", undefined, row).field.focus();
        }
      });
      const at = after ? rows.indexOf(after) + 1 : rows.length;
      rows.splice(at, 0, row);
      values.insertBefore(element, rows[at + 1]?.element ?? null);
      return row;
    };
    // A list kept: its values; a new one: the column's values to start from
    for (const value of list ?? present()) addRow(value, list ? value : undefined);

    const addButton = el(doc, "button", { class: "swt-dialog-button", text: "Add value", run: () => addRow("", undefined).field.focus() });
    const takeButton = el(doc, "button", {
      class: "swt-dialog-button",
      text: "Take values from the column",
      title: "Add the values the column has that the list has not",
      run: () => {
        const listed = new Set(rows.map((r) => r.field.value.trim().toLowerCase()));
        for (const value of present()) if (!listed.has(value.toLowerCase())) addRow(value, undefined);
      },
    });

    // A formula, and over its field a source of the space to pick (its column where it has several), which writes the
    // source's formula into the field (=@projects, =@users[name]); a formula typed that reads a source alone shows it there
    let formula = keptFormula ?? "";
    const sourceField = el(doc, "select", { class: "swt-choices-source", attrs: { "aria-label": "Source" } });
    sourceField.append(el(doc, "option", { text: "None: a formula of my own", attrs: { value: "" } }), ...sourceNames.map((name) => el(doc, "option", { text: name, attrs: { value: name } })));
    const columnField = el(doc, "select", { class: "swt-choices-source", attrs: { "aria-label": "Source's column" } });
    const columnLabel = el(doc, "label", "swt-choices-label", el(doc, "span", "", "Column"), columnField);
    // A source's columns as it gives them (none where it is not read yet), each an option by its place
    const sourceColumns = (name: string) => (name ? (sources?.columns(name) ?? []) : []);
    const fillColumns = (name: string, at: number | undefined) => {
      const columns = sourceColumns(name);
      columnField.replaceChildren(...columns.map((column, c) => el(doc, "option", { text: column, attrs: { value: String(c) } })));
      if (at !== undefined) columnField.value = String(at);
      // One column, or a source not read yet: the source alone
      columnLabel.hidden = columns.length < 2;
    };
    // The source (and column) a formula reads alone, in the pickers; "None" for any other formula
    const showSource = (text: string) => {
      const read = sourceFormulaOf(withEquals(text.trim()).formula);
      const name = (read && sourceNames.find((n) => n.toLowerCase() === read.source.toLowerCase())) ?? "";
      sourceField.value = name;
      // Its column found as formulas find it (by its key)
      fillColumns(name, read?.column === undefined ? undefined : referencedColumn(sourceColumns(name), read.column));
    };
    const formulaPart = formulas
      ? formulaField(doc, formulas.fieldHelpers(() => table), formula, (v) => {
          formula = v;
          showSource(v);
          showPreview();
        }, { label: "Formula", focus: "formula", placeholder: "=SORT(UNIQUE(tasks![status]))" })
      : el(doc, "span");
    const formulaInput = formulaPart.querySelector<HTMLInputElement>('[data-focus="formula"]');
    // A source or its column picked: its formula written into the field, the list named after it where no name was typed
    const sourcePicked = (column: number) => {
      const name = sourceField.value;
      if (!name) return;
      const columns = sourceColumns(name);
      formula = `=${sourceRefText(name, columns.length > 1 ? columnIdOf(columns, column) : undefined)}`;
      if (formulaInput) formulaInput.value = formula;
      if (!nameTyped) {
        nameField.value = listNameFor(name, taken);
        showTag();
      }
      showPreview();
    };
    sourceField.addEventListener("change", () => {
      fillColumns(sourceField.value, 0);
      sourcePicked(0);
    });
    columnField.addEventListener("change", () => sourcePicked(Number(columnField.value)));
    showSource(formula);

    // The values the formula gives, or why it gives none
    const previewValues = el(doc, "div", "swt-choices-preview-values");
    const previewCount = el(doc, "span", "swt-choices-count");
    const written = () => withEquals(formula.trim()).formula;
    const showPreview = () => {
      if (way !== "formula") return;
      const made = this.preview(table, written(), formulas);
      previewCount.textContent = typeof made === "string" ? "" : `· ${made.length}`;
      const more = typeof made === "string" ? 0 : made.length - SHOWN;
      previewValues.replaceChildren(
        ...(typeof made === "string"
          ? [el(doc, "span", "swt-choices-empty", made)]
          : made.length
            ? made.slice(0, SHOWN).map((value) => el(doc, "div", "swt-choices-row", el(doc, "span", "swt-choices-readonly", value)))
            : [el(doc, "span", "swt-choices-empty", "No values")]),
        ...(more > 0 ? [el(doc, "span", "swt-choices-empty", `… and ${more} more`)] : []),
      );
    };

    const save = () => {
      if (way === "column") {
        this.dialog?.close();
        void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => setCell(t, 0, column, withColumnType(t.rows[0]?.cells[column] ?? "", "choice")));
        return;
      }
      const name = nameField.value.trim().toLowerCase();
      const value = way === "list" ? undefined : written();
      const problem = this.nameProblem(table, name, taken) ?? (value === undefined ? this.valuesProblem(rows) : this.formulaProblem(value, formulas));
      if (problem) {
        note.textContent = problem;
        note.classList.add("swt-choices-problem");
        return;
      }
      const listed = rows.map((r) => r.field.value.trim()).filter((v) => v !== "");
      // Values renamed (a list of its own's): by what they were, their case ignored
      const renamed =
        value === undefined
          ? new Map(
              rows.filter((r) => r.original !== undefined && r.field.value.trim() !== "" && r.field.value.trim() !== r.original).map((r) => [r.original!.toLowerCase(), r.field.value.trim()]),
            )
          : new Map<string, string>();
      this.dialog?.close();
      void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => this.written(t, column, was, kept, name, value ?? writeChoiceList(listed), renamed));
    };
    const saveButton = el(doc, "button", { class: "swt-dialog-primary", text: "Save", run: save });
    const cancel = el(doc, "button", { class: "swt-dialog-button", text: "Cancel", run: () => this.close() });

    // The name and, under its field, the hashtag it makes: the field keeps its width as the name is typed
    const namePart = el(doc, "label", "swt-choices-label swt-choices-name-row", el(doc, "span", "", "Name"), nameField, tagHint);
    const listPart = el(doc, "div", "swt-choices-list", el(doc, "div", "swt-choices-label", "Values"), values, el(doc, "div", "swt-choices-actions", addButton, takeButton));
    // The source to pick only where the space has sources (and formulas read them)
    const sourceRow = el(doc, "label", "swt-choices-label", el(doc, "span", "", "Source"), sourceField);
    sourceRow.hidden = !sourceNames.length;
    const formulaWay = el(doc, "div", "swt-choices-part swt-choices-formula", sourceRow, columnLabel, el(doc, "div", "swt-choices-label", "Formula"), formulaPart);
    const previewPart = el(doc, "div", "swt-choices-part swt-choices-preview", el(doc, "div", "swt-choices-label", "Values", previewCount), previewValues);
    // The ways as one row of segments (radio buttons, so the keys and a screen reader know them), what the one
    // picked does in a line under them
    const HINTS: Record<Way, string> = {
      column: "The editor offers the values the column has; nothing is checked. #choice",
      list: "Kept in this table: values not in it are marked, the column sorts in its order. A value renamed is renamed in the cells; one removed leaves its cells marked.",
      formula:
        "A formula's values (a list, or one column), kept in this table and calculated as the column shows: a source of the space picked (silverware.table.defineSource in Space Lua: =@projects, read anew as the space changes) or a formula of your own. Values not in it are marked, the column sorts in its order.",
    };
    // Why a way cannot be picked, shown (not only as a tooltip: a touch screen has none)
    const unstorable = storable ? undefined : "lists are kept in the table's metadata; turn on Store table metadata in the settings";
    const DISABLED: Record<Way, string | undefined> = { column: undefined, list: unstorable, formula: unstorable ?? (formulas ? undefined : FORMULAS_OFF) };
    const TITLES: Record<Way, string> = { column: "Column's values", list: "Own list", formula: "Formula" };
    // A list kept as a way that cannot be picked now (the formulas module off): the column's values, until Save
    if (DISABLED[way]) way = "column";
    const hint = el(doc, "p", "swt-choices-hint");
    const reasons = (Object.keys(DISABLED) as Way[]).filter((w) => DISABLED[w]).map((w) => `${TITLES[w]}: ${DISABLED[w]}.`);
    const reason = el(doc, "p", { class: "swt-choices-hint", text: reasons.join(" ") });
    reason.hidden = !reasons.length;
    const wayOption = (value: Way) => {
      const radio = el(doc, "input", { attrs: { type: "radio", name: "swt-choices-way", value } });
      radio.checked = way === value;
      radio.disabled = DISABLED[value] !== undefined;
      radio.addEventListener("change", () => {
        way = value;
        show();
      });
      return el(doc, "label", { class: "swt-choices-way", title: DISABLED[value] ?? HINTS[value] }, radio, el(doc, "span", "", TITLES[value]));
    };
    const ways = el(doc, "div", { class: "swt-choices-ways", attrs: { role: "radiogroup", "aria-label": "Values" } }, ...(["column", "list", "formula"] as const).map(wayOption));
    const show = () => {
      namePart.hidden = way === "column";
      listPart.hidden = way !== "list";
      formulaWay.hidden = way !== "formula";
      previewPart.hidden = way !== "formula";
      hint.textContent = HINTS[way];
      note.classList.remove("swt-choices-problem");
      note.textContent = "";
      showPreview();
    };
    show();
    const content = el(doc, "div", "swt-choices-form", ways, hint, reason, namePart, listPart, formulaWay, previewPart);
    const footer = el(doc, "div", "swt-choices-foot", note, cancel, saveButton);
    this.dialog = this.host.openDialog({
      title: "Choices",
      subtitle: columnName || undefined,
      className: "swt-choices-dialog",
      content,
      footer,
      focus: way === "list" ? (rows[0]?.field ?? nameField) : way === "formula" ? (formulaInput ?? undefined) : (ways.querySelector<HTMLInputElement>("input:checked") ?? undefined),
      closed: () => {
        this.dialog = undefined;
      },
    });
  }

  /** The values a list's formula gives the table now (as the column will check them), or why it gives none */
  private preview(table: Table, formula: string, formulas: FormulasOffer | undefined): readonly string[] | string {
    if (!formulas) return `No values: ${FORMULAS_OFF}`;
    if (formula.trim() === "=" || formula.trim() === "=@") return "Type a formula, or pick a source";
    const read = this.read(table, formula);
    return read.values ?? `The column checks nothing: its formula ${read.problem ?? "gives no values"}`;
  }

  /** Why a list cannot be named so, or undefined */
  private nameProblem(table: Table, name: string, taken: readonly string[]): string | undefined {
    if (!LIST_NAME_RE.test(name)) return "A list's name is lower case letters (a to z) and digits, words joined by dashes, starting with a letter.";
    if (taken.includes(name)) return `The table has a list named ${name} already.`;
    if (!this.host.canStoreMeta(table, listKey(name))) return "Lists are kept in the table's metadata: turn on Store table metadata in the settings to save one.";
    return undefined;
  }

  /** Why a list of its own's values cannot be saved so, or undefined */
  private valuesProblem(rows: readonly ValueRow[]): string | undefined {
    const seen = new Set<string>();
    for (const row of rows) {
      const value = row.field.value.trim().toLowerCase();
      if (value === "") continue;
      if (seen.has(value)) return `"${row.field.value.trim()}" is in the list twice.`;
      seen.add(value);
    }
    return seen.size ? undefined : "The list has no values.";
  }

  /** Why a list's formula cannot be saved so (none typed, one that does not read), or undefined: one giving no values now may later */
  private formulaProblem(formula: string, formulas: FormulasOffer | undefined): string | undefined {
    if (!formulas) return `The list's formula: ${FORMULAS_OFF}.`;
    if (formula.trim() === "=" || formula.trim() === "=@") return "Type a formula, or pick a source.";
    return formulas.problem(formula);
  }

  /**
   * The table with the list saved (`value`: its values as stored, or its
   * formula): under its name (the one it had gone), the headers of the columns
   * that took it (and the column's own) naming it, the values renamed in their
   * cells (but a cell a feature computes: a formula's)
   */
  private written(t: Table, column: number, was: string | undefined, kept: boolean, name: string, value: string, renamed: ReadonlyMap<string, string>): Table {
    let table = t;
    if (was !== undefined && kept && was !== name) table = this.host.setMeta(table, listKey(was), undefined);
    table = this.host.setMeta(table, listKey(name), value);
    const columns = (table.rows[0]?.cells ?? []).flatMap((header, c) => (c === column || (was !== undefined && choiceListOf(unescapeCell(header)) === was) ? [c] : []));
    for (const c of columns) {
      table = setCell(table, 0, c, withColumnType(table.rows[0]?.cells[c] ?? "", `choice-${name}`));
      if (!renamed.size) continue;
      for (let r = 1; r < table.rows.length; r++) {
        const raw = table.rows[r]!.cells[c] ?? "";
        const to = renamed.get(textOf(raw).toLowerCase());
        if (to !== undefined && !this.host.cellKeptBy(raw)) table = setCell(table, r, c, this.host.keepTags(escapeCell(to), raw));
      }
    }
    return table;
  }
}
