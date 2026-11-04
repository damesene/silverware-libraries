// The column types module's Choices dialog, opened as a column's type is set
// to Choice and by the pencil of its Type row: whether the column offers the
// values it has (`#choice`, nothing checked) or takes a list of its own
// (`#choice-<name>`), kept in the table's metadata row by its name, or takes
// one of the space's lists (Space Lua's, `silverware.table.defineChoices`),
// which the dialog shows and does not change. A value renamed is renamed in the cells of every column taking the
// list, the list renamed in their headers, all in one write; a value deleted
// leaves its cells, marked as not of the list. In the core's dialog
// (ModelHost.openDialog).
import { reorder } from "../../../shared/drag.ts";
import { el } from "../../../shared/elements.ts";
import {
  choiceListOf,
  columnTypeOf,
  distinctValues,
  isChoice,
  LIST_NAME_RE,
  listKey,
  listNameFor,
  listNames,
  readChoiceList,
  spaceList,
  spaceListNames,
  withColumnType,
  writeChoiceList,
} from "../columntypes/index.ts";
import type { Dialog, ModelHost, TableInfo } from "../core/feature.ts";
import { ICONS } from "../icons.ts";
import { escapeCell, parseTable, type Table, unescapeCell } from "../markdown.ts";
import { setCell } from "../ops.ts";
import { withoutTags } from "../tags.ts";

/** Where a choice column's values come from: its own values, a list the table keeps, a list of the space */
type Way = "column" | "list" | "space";

/** How many of a space's list's values the dialog shows */
const SPACE_SHOWN = 200;

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

  /** Opens the dialog for a column: a choice column's, or one to become one (nothing written until Save) */
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
    // A list of its own needs the metadata setting, but where the column's is kept already
    const storable = kept || this.host.canStoreMeta(table, listKey(nameField.value));
    // A column of a list (or one becoming a choice column, where a list can be kept) starts on its list, `#choice` on the column's values
    const plainChoice = was === undefined && isChoice(columnTypeOf(unescapeCell(header)));
    // The space's lists the table keeps none of the name of; the column's where it names one
    const spaceNames = spaceListNames().filter((name) => !listNames(stored).includes(name));
    // (A list Space Lua defines counts as the space's before its function has given its values)
    const fromSpace = was !== undefined && !kept && spaceNames.includes(was);
    let way: Way = fromSpace ? "space" : storable && !plainChoice ? "list" : "column";
    let own = way === "list";
    const tagHint = el(doc, "span", "swt-choices-tag");
    const showTag = () => (tagHint.textContent = `#choice-${nameField.value.trim().toLowerCase()}`);
    nameField.addEventListener("input", showTag);
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

    // The space's list picked, its values shown as Space Lua last gave them
    const spaceField = el(doc, "select", { class: "swt-choices-space", attrs: { "aria-label": "The space's list" } });
    for (const name of spaceNames) spaceField.append(el(doc, "option", { text: name, attrs: { value: name } }));
    if (fromSpace) spaceField.value = was!;
    // As the list of its own shows its values, one a row, but to read only
    const spaceValues = el(doc, "div", "swt-choices-space-values");
    const spaceCount = el(doc, "span", "swt-choices-count");
    const showSpace = () => {
      const read = spaceList(spaceField.value);
      spaceCount.textContent = read ? `· ${read.length}` : "";
      // A query's list may be long: the first SPACE_SHOWN, the rest counted
      const more = (read?.length ?? 0) - SPACE_SHOWN;
      spaceValues.replaceChildren(
        ...(read?.length
          ? read.slice(0, SPACE_SHOWN).map((value) => el(doc, "div", "swt-choices-row", el(doc, "span", "swt-choices-readonly", value)))
          : [el(doc, "span", "swt-choices-empty", read ? "No values" : "Not read yet")]),
        ...(more > 0 ? [el(doc, "span", "swt-choices-empty", `… and ${more} more`)] : []),
      );
    };
    spaceField.addEventListener("change", showSpace);
    showSpace();
    const spacePart = el(
      doc,
      "div",
      "swt-choices-from-space",
      el(doc, "label", "swt-choices-label", el(doc, "span", "", "List"), spaceField),
      el(doc, "div", "swt-choices-label", "Values", spaceCount),
      spaceValues,
    );

    const save = () => {
      if (way === "space") {
        const name = spaceField.value;
        this.dialog?.close();
        if (name) void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => setCell(t, 0, column, withColumnType(t.rows[0]?.cells[column] ?? "", `choice-${name}`)));
        return;
      }
      if (!own) {
        this.dialog?.close();
        void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => setCell(t, 0, column, withColumnType(t.rows[0]?.cells[column] ?? "", "choice")));
        return;
      }
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

    // The two ways, as radio buttons; the list's fields only for a list of its own
    const listPart = el(
      doc,
      "div",
      "swt-choices-list",
      el(doc, "label", "swt-choices-label", el(doc, "span", "", "Name"), nameField, tagHint),
      el(doc, "div", "swt-choices-label", "Values"),
      values,
      el(doc, "div", "swt-choices-actions", addButton, takeButton),
    );
    // The ways as one row of segments (radio buttons, so the keys and a screen reader know them), what the one
    // picked does in a line under them
    const HINTS: Record<Way, string> = {
      column: "The editor offers the values the column has; nothing is checked. #choice",
      list: "Kept in this table: values not in it are marked, the column sorts in its order. A value renamed is renamed in the cells; one removed leaves its cells marked.",
      space: "From a Space Lua script (silverware.table.defineChoices), read anew as the space changes; changed in the script.",
    };
    const hint = el(doc, "p", "swt-choices-hint");
    // Why Own list cannot be picked, shown (not only as a tooltip: a touch screen has none)
    const unstorable = "Own list: lists are kept in the table's metadata; turn on Store table metadata in the settings.";
    const reason = el(doc, "p", { class: "swt-choices-hint", text: unstorable });
    reason.hidden = storable;
    const wayOption = (value: Way, title: string, disabled?: string) => {
      const radio = el(doc, "input", { attrs: { type: "radio", name: "swt-choices-way", value } });
      radio.checked = way === value;
      radio.disabled = disabled !== undefined;
      radio.addEventListener("change", () => {
        way = value;
        own = value === "list";
        show();
      });
      return el(doc, "label", { class: "swt-choices-way", title: disabled ?? HINTS[value] }, radio, el(doc, "span", "", title));
    };
    const ways = el(
      doc,
      "div",
      { class: "swt-choices-ways", attrs: { role: "radiogroup", "aria-label": "Values" } },
      wayOption("column", "Column's values"),
      wayOption("list", "Own list", storable ? undefined : unstorable),
      // Only where Space Lua defines a list
      ...(spaceNames.length ? [wayOption("space", "Space list")] : []),
    );
    const show = () => {
      listPart.hidden = way !== "list";
      spacePart.hidden = way !== "space";
      hint.textContent = HINTS[way];
      note.classList.remove("swt-choices-problem");
      note.textContent = "";
    };
    show();
    const content = el(doc, "div", "swt-choices-form", ways, hint, reason, listPart, spacePart);
    const footer = el(doc, "div", "swt-choices-foot", note, cancel, saveButton);
    this.dialog = this.host.openDialog({
      title: "Choices",
      subtitle: columnName || undefined,
      className: "swt-choices-dialog",
      content,
      footer,
      focus: way === "list" ? (rows[0]?.field ?? nameField) : way === "space" ? spaceField : ways.querySelector<HTMLInputElement>("input:checked") ?? undefined,
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
