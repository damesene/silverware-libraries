// The view module's dialog: a view's formula, typed with the help formulas
// have (names offered, the function the caret is in, why it does not read, fx
// for the Functions dialog), its name, and the table it makes shown under them
// as they change, from the same calculation that writes it (the module's
// `preview`). It knows nothing of tables or writing: Insert (Save) hands the
// module the formula and the name. The dialog is the core's (ModelHost.openDialog).
import { el, type ElementChild } from "../../../shared/elements.ts";
import type { Calculated } from "../calculated/index.ts";
import type { Dialog, ModelHost } from "../core/feature.ts";
import { formulaField, type FormulaHelpers } from "../formulafield.ts";

export type ViewDialogOptions = {
  readonly formula: string;
  readonly name: string;
  // What the formula's field offers as it is typed; none while the formulas module is off
  readonly helpers?: FormulaHelpers;
  // The Functions dialog (over this one), for the formula with its caret: `picked` gets the formula with the function
  // picked put in, and its caret
  readonly functions?: (formula: string, caret: number, picked: (made: { readonly formula: string; readonly caret: number }) => void) => void;
  // The table the formula makes, or why it makes none
  readonly preview: (formula: string) => Calculated | string;
  // Why a name cannot be the view's with the formula (another table's), if so
  readonly validateName: (name: string, formula: string) => string | undefined;
  readonly submit: (formula: string, name: string) => void;
  readonly submitLabel: string;
  // Why it cannot be submitted at all (the metadata setting off, the formulas module off)
  readonly blocked?: string;
  // What it says first, above its fields (a module it needs off)
  readonly notice?: string;
};

// What the preview shows of a view, and past how many rows writing it is worth a word
const PREVIEW_ROWS = 50;
const PREVIEW_COLUMNS = 12;
const LARGE_ROWS = 1000;

export function openViewDialog(host: ModelHost, options: ViewDialogOptions): Dialog {
  const doc = host.doc;
  const e = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Parameters<typeof el>[2], ...children: ElementChild[]) => el(doc, tag, props, ...children);
  let formula = options.formula;
  let name = options.name;
  const preview = e("div", "swt-view-preview");
  const nameNote = e("span", "swt-view-problem");
  const submit = e("button", { class: "swt-dialog-primary", text: options.submitLabel });

  const field = options.helpers
    ? formulaField(doc, options.helpers, formula, (v) => {
        formula = v;
        previewSoon();
      }, { label: "Formula", focus: "formula", placeholder: "=SORT(FILTER(tasks![#Data], tasks![done] = FALSE))" })
    : (() => {
        const input = e("input", { class: "swt-formulafield-text", attrs: { type: "text", "aria-label": "Formula", "data-focus": "formula", spellcheck: "false", autocomplete: "off" } });
        input.value = formula;
        input.addEventListener("input", () => {
          formula = input.value;
          previewSoon();
        });
        return input;
      })();
  const input = field instanceof HTMLInputElement ? field : field.querySelector<HTMLInputElement>("input")!;
  const fx = options.functions
    ? e("button", {
        class: "swt-view-fx",
        text: "fx",
        title: "Functions: find one by its name or what it does, and put it in at the caret",
        attrs: { "aria-label": "Functions" },
        run: () =>
          options.functions!(formula, input.selectionStart ?? formula.length, (made) => {
            // Put in as typing would: the field's help and the preview follow
            input.value = made.formula;
            input.focus();
            input.setSelectionRange(made.caret, made.caret);
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }),
      })
    : null;

  const nameField = e("input", { attrs: { type: "text", "aria-label": "Name", "data-focus": "name", spellcheck: "false", autocomplete: "off", placeholder: "none: no formula reads it" } });
  nameField.value = name;
  nameField.addEventListener("input", () => {
    name = nameField.value;
    check();
  });

  const section = (title: string, hint: string, ...children: ElementChild[]) =>
    e("div", "swt-view-section", e("div", "swt-view-label", e("span", { class: "swt-view-name", text: title }), e("span", { class: "swt-view-hint", text: hint })), e("div", "swt-view-fields", ...children));

  // Its result calculated once per formula: the name changed alone does not calculate it again
  let made: { readonly formula: string; readonly result: Calculated | string } | undefined;
  const result = (): Calculated | string => {
    if (made?.formula !== formula) made = { formula, result: formula.trim() ? options.preview(formula) : "Type the formula the view shows" };
    return made.result;
  };

  // The submit button: disabled with why, where the view cannot be written
  function check(): void {
    const problem = name.trim() ? options.validateName(name.trim(), formula) : undefined;
    nameNote.textContent = problem ?? "";
    const why = options.blocked ?? (typeof result() === "string" ? (result() as string) : problem);
    submit.disabled = !!why;
    submit.title = why ?? "";
  }

  // The view as it would be written: its first rows and columns, its size; why there is none; a word where it is large
  function showPreview(): void {
    const calculated = result();
    check();
    if (typeof calculated === "string") {
      preview.replaceChildren(e("p", { class: "swt-view-none", text: calculated }));
      return;
    }
    const rows = calculated.body.length;
    const columns = calculated.columns.length;
    const shown = calculated.columns.slice(0, PREVIEW_COLUMNS);
    const table = e(
      "table",
      "swt-view-table",
      e("thead", undefined, e("tr", undefined, ...shown.map((c) => e("th", { text: c.header })))),
      e("tbody", undefined, ...calculated.body.slice(0, PREVIEW_ROWS).map((row) => e("tr", undefined, ...row.slice(0, PREVIEW_COLUMNS).map((cell, i) => e("td", { text: cell, ...(calculated.columns[i]?.numeric ? { class: "swt-view-number" } : {}) }))))),
    );
    const size = e("p", {
      class: "swt-view-size",
      text: `${rows.toLocaleString("en")} ${rows === 1 ? "row" : "rows"} × ${columns} ${columns === 1 ? "column" : "columns"}${rows > PREVIEW_ROWS || columns > PREVIEW_COLUMNS ? ", the first shown" : ""}`,
    });
    const warning = rows > LARGE_ROWS ? e("p", { class: "swt-view-warning", text: `${rows.toLocaleString("en")} rows: each is written into the page, and written anew with each edit of what the view reads.` }) : null;
    preview.replaceChildren(...(warning ? [warning] : []), e("div", "swt-view-scroll", table), size);
  }

  // Typing: the preview once it pauses
  let typing: ReturnType<typeof setTimeout> | undefined;
  const previewSoon = () => {
    clearTimeout(typing);
    // Not submitted while its preview is not the formula's yet
    submit.disabled = true;
    typing = setTimeout(showPreview, 150);
  };

  const form = e(
    "div",
    "swt-view-form",
    section("Formula", "What the table shows: its result, a value, a list or rows and columns", e("div", "swt-view-row", field, fx)),
    section("Name", "Other formulas read the view by it", e("div", "swt-view-row", nameField, nameNote)),
  );
  showPreview();
  const cancel = e("button", { class: "swt-dialog-button", text: "Cancel" });
  const footer = e("div", "swt-view-foot", e("span", { class: "swt-view-note", text: options.blocked ?? "" }), cancel, submit);
  const dialog = host.openDialog({
    title: "View",
    subtitle: "A table made by a formula, written into the page and calculated anew as what it reads changes",
    className: "swt-view-dialog",
    content: e("div", "swt-view", options.notice ? e("p", { class: "swt-view-warning", text: options.notice }) : null, form, e("div", { class: "swt-view-label swt-view-preview-title", text: "Preview" }), preview),
    footer,
    closed: () => clearTimeout(typing),
  });
  cancel.addEventListener("click", () => dialog.close());
  submit.addEventListener("click", () => {
    clearTimeout(typing);
    showPreview();
    if (submit.disabled) return;
    dialog.close();
    options.submit(formula.trim(), name.trim());
  });
  // The formula's field focused, its caret at its end
  input.focus();
  input.setSelectionRange(formula.length, formula.length);
  return dialog;
}
