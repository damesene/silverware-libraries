// The pivot module's dialog: a pivot's fields picked (its source, what
// groups its rows and columns, its values, which rows count, its order, its
// totals) with the pivot it makes shown under them as they change, from the
// same calculation that writes it (the module's `preview`). A source on
// another page is picked by its page, whose tables the module reads
// (`readPage`), and the dialog says what such a pivot does not do. It edits Fields
// (pivot/fields.ts) and knows nothing of tables or writing: Insert (Save)
// hands the module the definition. The dialog is the core's (ModelHost.openDialog).
import { el, type ElementChild } from "../../../shared/elements.ts";
import { columnKey } from "../columns.ts";
import type { Dialog, ModelHost } from "../core/feature.ts";
import { type PivotDefinition, type Show, SHOWS, sourceRef, sourceText, type Totals } from "../pivot/definition.ts";
import {
  type Condition,
  definitionOf,
  type Fields,
  FUNCTION_LABELS,
  FUNCTIONS,
  type Fn,
  type GroupField,
  GROUPING_LABELS,
  GROUPINGS,
  type Grouping,
  groupText,
  OPERATOR_LABELS,
  OPERATORS,
  type Operator,
  SHOW_LABELS,
  type ValueField,
  valueFormula,
  valueText,
} from "../pivot/fields.ts";
import type { Pivot } from "../pivot/pivot.ts";

/** A table a pivot can summarize, by its name, its columns' names */
type Source = { readonly name: string; readonly columns: readonly string[] };

export type PivotDialogOptions = {
  // The page's tables a pivot can summarize
  readonly sources: readonly Source[];
  // Another page's, read, or why there are none; without it no other page is offered
  readonly readPage?: (page: string) => Promise<readonly Source[] | string>;
  // The space's other pages, offered as one is typed
  readonly pages?: () => Promise<readonly string[]>;
  readonly fields: Fields;
  // The pivot the definition makes, or why it makes none
  readonly preview: (definition: PivotDefinition) => Pivot | string;
  readonly submit: (definition: PivotDefinition) => void;
  readonly submitLabel: string;
  // Why it cannot be submitted at all (the metadata setting off)
  readonly blocked?: string;
};

// What the preview shows of a pivot, and where it is too large to be read as a table
const PREVIEW_ROWS = 20;
const PREVIEW_COLUMNS = 8;
const LARGE_COLUMNS = 30;
const LARGE_ROWS = 500;

// The Source's choice of another page, apart from the page's tables' names
const ANOTHER = "\u0000another";
const ANOTHER_NOTE = "On another page: the pivot is not written anew as that page changes. Once SilverBullet has indexed it, Refresh pivot in the pivot's toolbar is highlighted where the pivot is out of date.";

export function openPivotDialog(host: ModelHost, options: PivotDialogOptions): Dialog {
  const doc = host.doc;
  const e = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Parameters<typeof el>[2], ...children: ElementChild[]) => el(doc, tag, props, ...children);
  let fields: Fields = options.fields;
  // The page of a source on another page, as picked ("" while none is typed yet); undefined: a source of this page
  let otherPage = options.readPage ? sourceRef(fields.source).page : undefined;
  // Other pages' sources as read (or why there are none), those being read
  const read = new Map<string, readonly Source[] | string>();
  const reading = new Set<string>();
  const readOther = (page: string) => {
    if (!page || read.has(page) || reading.has(page) || !options.readPage) return;
    reading.add(page);
    void options.readPage(page).then((sources) => {
      reading.delete(page);
      read.set(page, sources);
      // A page picked: its first table, until another is picked
      if (otherPage === page && !fields.source && typeof sources !== "string" && sources[0]) fields = { ...fields, source: sourceText({ page, name: sources[0].name }) };
      render();
    });
  };
  // A list's source by its name, ignoring case
  const named = (list: readonly Source[] | string | undefined, name: string) => (typeof list === "object" ? list.find((s) => s.name.toLowerCase() === name.toLowerCase()) : undefined);
  const columnsOf = () => {
    const ref = sourceRef(fields.source);
    return named(ref.page === undefined ? options.sources : read.get(ref.page), ref.name)?.columns ?? [];
  };
  // A list's names, the one written first where none of them is (a table gone, renamed), as a column is offered
  const withWritten = (names: readonly string[], written: string) => (!written || names.some((n) => n.toLowerCase() === written.toLowerCase()) ? names : [written, ...names]);
  // The space's pages, as the page is typed (read once)
  const pageList = e("datalist", { attrs: { id: "swt-pivot-pages" } });
  let pagesRead = false;

  const form = e("div", "swt-pivot-form");
  const preview = e("div", "swt-pivot-preview");
  const submit = e("button", { class: "swt-dialog-primary", text: options.submitLabel });

  const select = <T extends string>(values: readonly T[], label: (v: T) => string, value: string, changed: (v: T) => void, aria: string): HTMLSelectElement => {
    const s = e("select", { attrs: { "aria-label": aria, "data-focus": aria } });
    for (const v of values) s.append(new Option(label(v), v));
    s.value = value;
    s.addEventListener("change", () => changed(s.value as T));
    return s;
  };
  // A column of the source, as the definition writes it (its name or its key, as formulas write them): picked by its header's name;
  // one the source has not (renamed in its markdown) offered as it is written
  const columnSelect = (value: string, changed: (column: string) => void, aria: string): HTMLSelectElement => {
    const columns = columnsOf();
    const shown = columns.find((c) => c === value) ?? columns.find((c) => columnKey(c) === columnKey(value));
    return select(shown ? columns : [value, ...columns], (c) => c, shown ?? value, changed, aria);
  };
  const remove = (run: () => void) => e("button", { class: "swt-pivot-remove", text: "×", title: "Remove", attrs: { "aria-label": "Remove" }, run });
  const add = (label: string, run: () => void) => e("button", { class: "swt-pivot-add", text: `+ ${label}`, run });
  const set = (next: Partial<Fields>) => {
    fields = { ...fields, ...next };
    render();
  };
  const replaced = <T>(list: readonly T[], i: number, item: T) => list.map((x, j) => (j === i ? item : x));

  // A group: a column and how it is grouped, or its formula as text
  // (`typed`: its formula as typed, kept without making the form anew, which would leave the field)
  const groupRow = (field: GroupField, change: (f: GroupField | undefined) => void, typed: (f: GroupField) => void, aria: string) => {
    if ("formula" in field) {
      const text = e("input", { attrs: { type: "text", "aria-label": `${aria} formula`, "data-focus": `${aria} formula` } });
      text.value = field.formula;
      text.addEventListener("input", () => {
        typed({ formula: text.value });
        previewSoon();
      });
      return e("div", "swt-pivot-row", text, remove(() => change(undefined)));
    }
    const group = field;
    return e(
      "div",
      "swt-pivot-row",
      columnSelect(group.column, (column) => change({ column, grouping: group.grouping }), `${aria} column`),
      select(GROUPINGS, (g) => GROUPING_LABELS[g], group.grouping, (grouping: Grouping) => change({ column: group.column, grouping }), `${aria} grouping`),
      e("button", { class: "swt-pivot-formula", text: "fx", title: "Write it as a formula", run: () => change({ formula: groupText(group) }) }),
      remove(() => change(undefined)),
    );
  };
  // How a value shows: a share of a row's or a column's total only where columns are grouped (else the row's is the value itself, the column's all rows')
  const showSelect = (field: ValueField, change: (f: ValueField) => void, i: number) => {
    const shows = fields.columns.length ? SHOWS : SHOWS.filter((s) => s === "" || s === "total" || s === field.show);
    return select(shows, (s) => SHOW_LABELS[s], field.show, (show: Show) => change({ ...field, show }), `Value ${i + 1} shown`);
  };
  // A value: a function of a column, or its formula as text; as calculated or its share of a total
  const valueRow = (field: ValueField, change: (f: ValueField | undefined) => void, i: number) => {
    if ("formula" in field) {
      const text = e("input", { attrs: { type: "text", "aria-label": "Value formula", "data-focus": `value ${i} formula` } });
      text.value = field.formula;
      text.addEventListener("input", () => {
        fields = { ...fields, values: replaced(fields.values, i, { ...fields.values[i]!, formula: text.value }) };
        previewSoon();
      });
      return e("div", "swt-pivot-row", text, showSelect(field, (f) => change({ ...f, formula: text.value }), i), remove(() => change(undefined)));
    }
    return e(
      "div",
      "swt-pivot-row",
      select(FUNCTIONS, (f) => FUNCTION_LABELS[f], field.fn, (fn: Fn) => change({ ...field, fn }), `Value ${i + 1} function`),
      e("span", "swt-pivot-of", "of"),
      columnSelect(field.column, (column) => change({ ...field, column }), `Value ${i + 1} column`),
      showSelect(field, change, i),
      e("button", { class: "swt-pivot-formula", text: "fx", title: "Write it as a formula", run: () => change({ formula: valueFormula(field), show: field.show }) }),
      remove(() => change(undefined)),
    );
  };
  // A condition: a column, an operator, a value typed
  const conditionRow = (condition: Condition, i: number) => {
    const value = e("input", { attrs: { type: "text", placeholder: condition.op === "matches" ? "a pattern: ^EU-\\d+" : "value", "aria-label": `Condition ${i + 1} value`, "data-focus": `condition ${i} value` } });
    value.value = condition.value;
    value.addEventListener("input", () => {
      fields = { ...fields, conditions: replaced(fields.conditions, i, { ...condition, value: value.value }) };
      condition = fields.conditions[i]!;
      previewSoon();
    });
    return e(
      "div",
      "swt-pivot-row",
      columnSelect(condition.column, (column) => set({ conditions: replaced(fields.conditions, i, { ...condition, column }) }), `Condition ${i + 1} column`),
      select(OPERATORS, (o) => OPERATOR_LABELS[o], condition.op, (op: Operator) => set({ conditions: replaced(fields.conditions, i, { ...condition, op }) }), `Condition ${i + 1} operator`),
      value,
      remove(() => set({ conditions: fields.conditions.filter((_, j) => j !== i) })),
    );
  };
  const section = (title: string, hint: string, ...children: ElementChild[]) => e("div", "swt-pivot-section", e("div", "swt-pivot-label", e("span", { class: "swt-pivot-name", text: title }), e("span", { class: "swt-pivot-hint", text: hint })), e("div", "swt-pivot-fields", ...children));

  function render(): void {
    // The field focused stays focused as the form is made anew (a select changed)
    const focused = (doc.activeElement as HTMLElement | null)?.dataset?.focus;
    const columns = columnsOf();
    const first = columns[0] ?? "";
    const groups = (key: "rows" | "columns", aria: string) =>
      fields[key].map((field, i) =>
        groupRow(
          field,
          (f) => set({ [key]: f ? replaced(fields[key], i, f) : fields[key].filter((_, j) => j !== i) } as Partial<Fields>),
          (f) => (fields = { ...fields, [key]: replaced(fields[key], i, f) }),
          `${aria} ${i + 1}`,
        ),
      );
    const sortKeys = ["", ...fields.rows.map(groupText), ...fields.values.map(valueText)];
    const sort = fields.sort[0];
    form.replaceChildren(
      sourceSection(),
      section("Rows", "A row for each value of", ...groups("rows", "Row"), add("Group rows", () => set({ rows: [...fields.rows, { column: first, grouping: "" }] }))),
      section("Columns", "A column for each value of (optional)", ...groups("columns", "Column"), fields.columns.length ? null : add("Group columns", () => set({ columns: [{ column: first, grouping: "" }] }))),
      section("Values", "What each shows", ...fields.values.map((v, i) => valueRow(v, (f) => set({ values: f ? replaced(fields.values, i, f) : fields.values.filter((_, j) => j !== i) }), i)), add("Value", () => set({ values: [...fields.values, { fn: "SUM", column: columns.find((c) => c !== first) ?? first, show: "" }] }))),
      section(
        "Only rows where",
        fields.where ? "A formula of one row" : "Its conditions",
        ...(fields.where
          ? [
              (() => {
                const text = e("input", { attrs: { type: "text", "aria-label": "Condition formula", "data-focus": "where" } });
                text.value = fields.where;
                text.addEventListener("input", () => {
                  fields = { ...fields, where: text.value };
                  previewSoon();
                });
                return e("div", "swt-pivot-row", text, remove(() => set({ where: undefined })));
              })(),
            ]
          : fields.conditions.map(conditionRow)),
        fields.conditions.length > 1 ? select(["all", "any"], (m) => (m === "all" ? "All of them hold" : "Any of them holds"), fields.any ? "any" : "all", (m) => set({ any: m === "any" }), "Conditions") : null,
        fields.where ? null : add("Condition", () => set({ conditions: [...fields.conditions, { column: first, op: "=", value: "" }] })),
      ),
      section(
        "Order",
        "The rows sorted by",
        e(
          "div",
          "swt-pivot-row",
          select(sortKeys, (k) => k || "their groups", sort?.by ?? "", (by) => set({ sort: by ? [{ by, descending: sort?.descending ?? false }] : [] }), "Sort by"),
          sort ? select(["asc", "desc"], (d) => (d === "asc" ? "ascending" : "descending"), sort.descending ? "desc" : "asc", (d) => set({ sort: [{ by: sort.by, descending: d === "desc" }] }), "Sort direction") : null,
        ),
      ),
      section(
        "Totals",
        "",
        e("div", "swt-pivot-row", toggle("Total row", fields.totals === "both" || fields.totals === "rows", (on) => set({ totals: totals(on, hasColumn(fields.totals)) })), fields.columns.length ? toggle("Total column", hasColumn(fields.totals), (on) => set({ totals: totals(hasRow(fields.totals), on) })) : null),
      ),
    );
    if (focused) form.querySelector<HTMLElement>(`[data-focus="${focused}"]`)?.focus();
    showPreview();
  }

  // The table summarized: one of the page's, or of another page (its page typed, then one of its tables), said what that does not do
  function sourceSection(): HTMLElement {
    const names = otherPage === undefined ? withWritten(options.sources.map((s) => s.name), fields.source) : options.sources.map((s) => s.name);
    const picked = select(
      [...names, ...(options.readPage ? [ANOTHER] : [])],
      (n) => (n === ANOTHER ? "Another page…" : n),
      otherPage === undefined ? fields.source : ANOTHER,
      (value) => {
        otherPage = value === ANOTHER ? "" : undefined;
        set({ source: value === ANOTHER ? "" : value });
        if (value === ANOTHER) form.querySelector<HTMLElement>('[data-focus="source page"]')?.focus();
      },
      "Source",
    );
    if (otherPage === undefined) return section("Source", "The table summarized", picked);
    const page = otherPage;
    if (!pagesRead && options.pages) {
      pagesRead = true;
      void options.pages().then((pages) => pageList.replaceChildren(...pages.map((p) => e("option", { attrs: { value: p } }))));
    }
    const pageField = e("input", { attrs: { type: "text", list: "swt-pivot-pages", placeholder: "Page", "aria-label": "Source page", "data-focus": "source page" } });
    pageField.value = page;
    pageField.addEventListener("change", () => {
      const typed = pageField.value.trim();
      if (typed === otherPage) return;
      otherPage = typed;
      readOther(typed);
      set({ source: "" });
    });
    const sources = read.get(page);
    const table = !page
      ? null
      : typeof sources === "object"
        ? select(withWritten(sources.map((s) => s.name), sourceRef(fields.source).name), (n) => n, sourceRef(fields.source).name, (name) => set({ source: sourceText({ page, name }) }), "Source table")
        : e("span", { class: "swt-pivot-hint", text: sources ?? "Reading…" });
    readOther(page);
    return section("Source", "The table summarized", picked, e("div", "swt-pivot-row", pageField, pageList, table), e("p", { class: "swt-pivot-info", text: ANOTHER_NOTE }));
  }

  const toggle = (label: string, on: boolean, changed: (on: boolean) => void) => {
    const box = e("input", { attrs: { type: "checkbox", "data-focus": label } });
    box.checked = on;
    box.addEventListener("change", () => changed(box.checked));
    return e("label", "swt-pivot-toggle", box, label);
  };

  // The pivot as it would be written, its first rows and columns; why there is none; where it would be large
  function showPreview(): void {
    const definition = definitionOf(fields);
    const made = !definition.source.trim()
      ? "Pick the table summarized"
      : definition.values.length && (definition.rows.length || definition.columns.length)
        ? options.preview(definition)
        : "Pick what groups the rows and a value";
    const problem = options.blocked ?? (typeof made === "string" ? made : undefined);
    submit.disabled = !!problem;
    submit.title = problem ?? "";
    if (typeof made === "string") {
      preview.replaceChildren(e("p", { class: "swt-pivot-none", text: made }));
      return;
    }
    const rows = made.body.length;
    const columns = made.columns.length;
    const shown = made.columns.slice(0, PREVIEW_COLUMNS);
    const table = e(
      "table",
      "swt-pivot-table",
      e("thead", undefined, e("tr", undefined, ...shown.map((c) => e("th", { text: c.header })))),
      e("tbody", undefined, ...made.body.slice(0, PREVIEW_ROWS).map((row) => e("tr", undefined, ...row.slice(0, PREVIEW_COLUMNS).map((cell, i) => e("td", { text: cell, ...(made.columns[i]?.numeric ? { class: "swt-pivot-number" } : {}) }))))),
    );
    const size = e("p", { class: "swt-pivot-size", text: `${rows} ${rows === 1 ? "row" : "rows"} × ${columns} ${columns === 1 ? "column" : "columns"}${rows > PREVIEW_ROWS || columns > PREVIEW_COLUMNS ? ", the first shown" : ""}` });
    // A grouping that makes too many columns (dates as they are): what would help
    const date = fields.columns.find((f): f is { column: string; grouping: Grouping } => "column" in f && f.grouping === "");
    const large = columns > LARGE_COLUMNS || rows > LARGE_ROWS;
    const warning = large
      ? e(
          "p",
          "swt-pivot-warning",
          `A pivot of ${columns} columns and ${rows} rows: large to write into the page, and written anew with each edit of its source.`,
          date && columns > LARGE_COLUMNS ? e("button", { class: "swt-pivot-add", text: `Group ${date.column} by month`, run: () => set({ columns: [{ column: date.column, grouping: "yearMonth" }] }) }) : null,
        )
      : null;
    preview.replaceChildren(...(warning ? [warning] : []), e("div", "swt-pivot-scroll", table), size);
  }

  // A formula typed: the preview once typing pauses
  let typing: ReturnType<typeof setTimeout> | undefined;
  const previewSoon = () => {
    clearTimeout(typing);
    typing = setTimeout(showPreview, 150);
  };

  render();
  const cancel = e("button", { class: "swt-dialog-button", text: "Cancel" });
  const footer = e("div", "swt-pivot-foot", e("span", { class: "swt-pivot-note", text: options.blocked ?? "" }), cancel, submit);
  const dialog = host.openDialog({
    title: "Pivot table",
    subtitle: "A summary of a table, written into the page and calculated anew as the table changes",
    className: "swt-pivot-dialog",
    content: e("div", "swt-pivot", form, e("div", { class: "swt-pivot-label swt-pivot-preview-title", text: "Preview" }), preview),
    footer,
    closed: () => clearTimeout(typing),
  });
  cancel.addEventListener("click", () => dialog.close());
  submit.addEventListener("click", () => {
    const definition = definitionOf(fields);
    if (submit.disabled) return;
    const made = options.preview(definition);
    if (typeof made !== "string" && (made.columns.length > LARGE_COLUMNS || made.body.length > LARGE_ROWS) && !doc.defaultView?.confirm(`The pivot has ${made.columns.length} columns and ${made.body.length} rows. Write it into the page all the same?`)) return;
    dialog.close();
    options.submit(definition);
  });
  return dialog;
}

const hasRow = (t: Totals) => t === "both" || t === "rows";
const hasColumn = (t: Totals) => t === "both" || t === "columns";
const totals = (row: boolean, column: boolean): Totals => (row && column ? "both" : row ? "rows" : column ? "columns" : "none");

