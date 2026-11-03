// The column types module's Choices dialog: the list of values a choice
// column takes (`#choice-<name>`), kept in the table's metadata row by its
// name. A value renamed is renamed in the cells of every column taking the
// list, the list renamed in their headers, all in one write; a value deleted
// leaves its cells, marked as not of the list. In the core's dialog
// (ModelHost.openDialog).
import { el } from "../../../shared/elements.ts";
import { choiceListOf, distinctValues, LIST_NAME_RE, listKey, listNameFor, listNames, readChoiceList, withColumnType, writeChoiceList } from "../columntypes/index.ts";
import type { Dialog, ModelHost, TableInfo } from "../core/feature.ts";
import { ICONS } from "../icons.ts";
import { escapeCell, parseTable, type Table, unescapeCell } from "../markdown.ts";
import { setCell } from "../ops.ts";
import { withoutTags } from "../tags.ts";

/** A value's row in the dialog: the value it was (none: added here) and its field */
type ValueRow = { readonly original: string | undefined; readonly field: HTMLInputElement; readonly element: HTMLElement };

/** A cell's text as a value: without its hidden tags, unescaped, trimmed */
const textOf = (cell: string): string => unescapeCell(withoutTags(cell)).trim();

export class ChoicesDialog {
  private dialog: Dialog | undefined;

  constructor(private readonly host: ModelHost) {}

  close(): void {
    this.dialog?.close();
  }

  /** Opens the dialog for a choice column's list (one made for it where it has none) */
  open(info: TableInfo, column: number): void {
    const { doc } = this.host;
    const table = parseTable((this.host.tableFor(info.key) ?? info).source);
    const header = table.rows[0]?.cells[column] ?? "";
    const columnName = unescapeCell(withoutTags(withColumnType(header, undefined)));
    const stored = this.host.metaOf(table);
    const was = choiceListOf(unescapeCell(header));
    // The list the column names, kept in the table (one that does not read is replaced: its values start from the column's)
    const kept = was !== undefined && stored.has(listKey(was));
    const list = kept ? readChoiceList(stored.get(listKey(was!))) : undefined;
    const taken = listNames(stored).filter((name) => name !== was || !kept);
    // The column's values, each once
    const present = (): string[] => distinctValues(table.rows.slice(1).map((row) => textOf(row.cells[column] ?? "")).filter((text) => text !== ""));

    const rows: ValueRow[] = [];
    const values = el(doc, "div", "swt-choices-values");
    const note = el(doc, "span", "swt-dialog-note");
    const nameField = el(doc, "input", { class: "swt-choices-name", attrs: { spellcheck: "false", "aria-label": "Name of the list" } });
    nameField.value = was ?? listNameFor(columnName, taken);
    const tagHint = el(doc, "span", "swt-choices-tag");
    const showTag = () => (tagHint.textContent = `#choice-${nameField.value.trim().toLowerCase()}`);
    nameField.addEventListener("input", showTag);
    showTag();

    const addRow = (value: string, original: string | undefined, after?: ValueRow): ValueRow => {
      const field = el(doc, "input", { class: "swt-choices-value", attrs: { spellcheck: "false", "aria-label": "Value" } });
      field.value = value;
      const element = el(doc, "div", "swt-choices-row", field);
      const row: ValueRow = { original, field, element };
      const move = (by: number) => {
        const i = rows.indexOf(row);
        const j = i + by;
        if (j < 0 || j >= rows.length) return;
        rows.splice(i, 1);
        rows.splice(j, 0, row);
        values.replaceChildren(...rows.map((r) => r.element));
        field.focus();
      };
      element.append(
        el(doc, "button", { class: "swt-choices-icon", html: ICONS.arrowUp, title: "Move up", run: () => move(-1) }),
        el(doc, "button", { class: "swt-choices-icon", html: ICONS.arrowDown, title: "Move down", run: () => move(1) }),
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
      // Enter adds a value after this one, Alt+↑ ↓ moves it
      field.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          addRow("", undefined, row).field.focus();
        } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          move(e.key === "ArrowUp" ? -1 : 1);
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

    const save = () => {
      const name = nameField.value.trim().toLowerCase();
      const problem = this.problem(table, name, taken, rows);
      if (problem) {
        note.textContent = problem;
        note.classList.add("swt-choices-problem");
        return;
      }
      const listed = rows.map((r) => r.field.value.trim()).filter((v) => v !== "");
      // Values renamed: by what they were, their case ignored
      const renamed = new Map(
        rows.filter((r) => r.original !== undefined && r.field.value.trim() !== "" && r.field.value.trim() !== r.original).map((r) => [r.original!.toLowerCase(), r.field.value.trim()]),
      );
      this.dialog?.close();
      void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => this.written(t, column, was, kept, name, listed, renamed));
    };
    const saveButton = el(doc, "button", { class: "swt-dialog-primary", text: "Save", run: save });
    const cancel = el(doc, "button", { class: "swt-dialog-button", text: "Cancel", run: () => this.close() });
    note.textContent = "Renaming a value renames it in the cells; a value removed leaves its cells marked.";

    const content = el(
      doc,
      "div",
      "swt-choices-form",
      el(doc, "label", "swt-choices-label", el(doc, "span", "", "Name"), nameField, tagHint),
      el(doc, "div", "swt-choices-label", "Values"),
      values,
      el(doc, "div", "swt-choices-actions", addButton, takeButton),
    );
    const footer = el(doc, "div", "swt-choices-foot", note, cancel, saveButton);
    this.dialog = this.host.openDialog({
      title: "Choices",
      subtitle: columnName || undefined,
      className: "swt-choices-dialog",
      content,
      footer,
      focus: rows[0]?.field ?? nameField,
      closed: () => {
        this.dialog = undefined;
      },
    });
  }

  /** Why the list cannot be saved so, or undefined */
  private problem(table: Table, name: string, taken: readonly string[], rows: readonly ValueRow[]): string | undefined {
    if (!LIST_NAME_RE.test(name)) return "A list's name is lower case letters (a to z) and digits, words joined by dashes, starting with a letter.";
    if (taken.includes(name)) return `The table has a list named ${name} already.`;
    if (!this.host.canStoreMeta(table, listKey(name))) return "Lists are kept in the table's metadata: turn on Store table metadata in the settings to save one.";
    const seen = new Set<string>();
    for (const row of rows) {
      const value = row.field.value.trim().toLowerCase();
      if (value === "") continue;
      if (seen.has(value)) return `"${row.field.value.trim()}" is in the list twice.`;
      seen.add(value);
    }
    return seen.size ? undefined : "The list has no values.";
  }

  /**
   * The table with the list saved: under its name (the one it had gone), the
   * headers of the columns that took it (and the column's own) naming it, the
   * values renamed in their cells (but a cell a feature computes: a formula's)
   */
  private written(
    t: Table,
    column: number,
    was: string | undefined,
    kept: boolean,
    name: string,
    listed: readonly string[],
    renamed: ReadonlyMap<string, string>,
  ): Table {
    let table = t;
    if (was !== undefined && kept && was !== name) table = this.host.setMeta(table, listKey(was), undefined);
    table = this.host.setMeta(table, listKey(name), writeChoiceList(listed));
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
