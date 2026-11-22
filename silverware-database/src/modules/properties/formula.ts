// A formula property's details in the properties' dialog (docs/silverware-database-formulas.md, *How it is used*,
// decided 1 to 4, the panel decided again 2026-11-22): its formula's field (shared/formulafield.ts: the properties and
// the functions offered as a name is typed, the function the caret is in, why it cannot be); under it a panel: its
// result for one item as it is typed (a preview: nothing kept), and the database's properties, each with its value for
// that item, filtered by the name typed, a press putting it in for this item, its Σ for every item; the type it is
// shown as.
import { el } from "../../../../shared/elements.ts";
import { suggestionList } from "../../../../shared/suggest.ts";
import { formulaField } from "../../../../shared/formulafield.ts";
import { columnReference, formulaCompletion, formulaFunctionHelp, formulaNameTyped, formulaPreview, formulaTypedProblem, propertyReference, propertyStarts } from "../../domain/formulas/help.ts";
import { typeIcon } from "../../views/icons.ts";
import { FORMULA_RESULT_TYPES } from "../../domain/types/builtin/formula.ts";
import type { TypeRegistry } from "../../domain/types/registry.ts";
import { type Database, isEmpty, type Item, NAME_KEY, type Params, type Property } from "../../model/database.ts";

const BASE = "swd-settings";

// How long typing pauses before the result is calculated again (over the whole database: a large one takes a moment)
const PREVIEW_DELAY = 300;

// The items offered to show the result for, found by name among them all: those whose names start so first
const PREVIEW_OFFERED = 10;

/** The items' keys offered for a name typed: those starting with it, then those holding it (ignoring case), the first ones with nothing typed */
export function itemsOffered(items: readonly Item[], typed: string): string[] {
  const text = typed.trim().toLowerCase();
  if (!text) return items.slice(0, PREVIEW_OFFERED).map((item) => item.key);
  const starting: string[] = [];
  const holding: string[] = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    if (name.startsWith(text)) starting.push(item.key);
    else if (name.includes(text)) holding.push(item.key);
    if (starting.length >= PREVIEW_OFFERED) break;
  }
  return [...starting, ...holding].slice(0, PREVIEW_OFFERED);
}

/** What each result's type changes, said under its choice */
const SHOWN_AS: Readonly<Record<string, string>> = {
  "": "Each value as it is: a number, a text, a logical value",
  text: "Shown, sorted and filtered as text, a number too",
  number: "Sorted and filtered as numbers",
  checkbox: "Shown as a box, ticked where the result is TRUE",
  date: "Shown, sorted and filtered as dates",
  datetime: "Shown, sorted and filtered as dates with their time",
};

/** What the formula's details are given by the dialog */
export type FormulaDetails = {
  readonly doc: Document;
  readonly types: TypeRegistry;
  /** The formula property as the draft has it, `key` the one it is calculated under (a new one's own) */
  readonly property: Property;
  readonly key: string;
  /** The database as the draft has it (its other properties as edited: those a formula reads), the property among them */
  readonly database: Database;
  /** The items, read once the details are shown */
  readonly items: () => Promise<readonly Item[]>;
  /** The item the result is shown for (none: the first), kept by the dialog as it is drawn anew */
  readonly shownFor: { item: string | undefined };
  /** Its params as typed (the formula: nothing drawn anew, the focus stays) and as picked (its type: drawn anew) */
  readonly typed: (params: Params) => void;
  readonly picked: (params: Params) => void;
  /** A property's icon as the dialog draws it (its own, else its type's: a formula's ƒ) */
  readonly iconOf: (property: Property) => HTMLElement;
};

/** An example of a formula of the database's own properties, what an empty field shows */
export function formulaExample(database: Database, key: string): string {
  const numbers = database.properties.filter((one) => one.type === "number" && one.key !== key);
  if (numbers.length >= 2) return `=${propertyReference(numbers[0]!)} * ${propertyReference(numbers[1]!)}`;
  if (numbers.length === 1) return `=${propertyReference(numbers[0]!)} * 2`;
  return `=UPPER(${propertyReference({ key: NAME_KEY })})`;
}

/** The formula's field, its properties' buttons, its result for an item, Show as */
export function formulaDetails(details: FormulaDetails): HTMLElement[] {
  const { doc, property, key, database, types } = details;
  let params = property.params;
  const formulaText = typeof params.formula === "string" ? params.formula : "";
  // The result for an item: calculated after a pause in typing, the items read once
  const result = el(doc, "span", { class: "swd-formula-result", attrs: { "aria-live": "polite" } });
  // The item it is shown for: its name typed, the items of such a name offered (a database of thousands too)
  const which = el(doc, "input", { class: "swd-formula-result-item", attrs: { type: "text", autocomplete: "off", spellcheck: "false", "aria-label": "The item the preview is for", placeholder: "Pick an item…" } });
  let items: readonly Item[] | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const shownItem = () => (items ? (items.find((one) => one.key === details.shownFor.item) ?? items[0]) : undefined);
  let byKey = new Map<string, Item>();
  const picker = suggestionList(doc, which, {
    base: "swd",
    whenEmpty: true,
    suggest: (typed) => (items ? itemsOffered(items, typed) : []),
    label: (key) => byKey.get(key)?.name || "(no name)",
    take: (key) => {
      details.shownFor.item = key;
      which.value = byKey.get(key)?.name ?? "";
      show();
    },
  });
  // (Left with a name typed that was not taken: the item shown named again)
  which.addEventListener("blur", () => (which.value = shownItem()?.name ?? ""));
  // The list over the dialog, under the field (fixed: the dialog's body scrolls and would cut it), kept under it as that
  // body scrolls while the field has the focus
  const placePicker = () => {
    const box = which.getBoundingClientRect();
    picker.style.left = `${box.left}px`;
    picker.style.top = `${box.bottom + 2}px`;
    picker.style.minWidth = `${box.width}px`;
  };
  which.addEventListener("focus", () => {
    placePicker();
    doc.addEventListener("scroll", placePicker, { capture: true, passive: true });
  });
  which.addEventListener("input", placePicker);
  which.addEventListener("blur", () => doc.removeEventListener("scroll", placePicker, { capture: true }));
  const show = () => {
    if (!items) return;
    showValues();
    const item = shownItem();
    if (!item) return void (result.textContent = "No item yet");
    if (typeof params.formula !== "string" || !params.formula.trim() || formulaTypedProblem(params.formula)) return void result.replaceChildren();
    const { value, problem } = formulaPreview({ ...database, properties: database.properties.map((one) => (one.key === key ? { ...one, params } : one)) }, items, key, params, item);
    result.classList.toggle("swd-formula-result-error", !!problem);
    result.title = problem?.detail ?? "";
    result.textContent = problem ? `${problem.code}: ${problem.detail}` : value === null ? "(empty)" : types.of(property.type, params)!.text(value, params);
  };
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(show, PREVIEW_DELAY);
  };
  void details.items().then((read) => {
    items = read;
    byKey = new Map(read.map((item) => [item.key as string, item]));
    which.value = shownItem()?.name ?? "";
    which.hidden = !read.length;
    show();
  });
  const field = formulaField(
    doc,
    { complete: (text, caret) => formulaCompletion(database, text, caret, key), help: formulaFunctionHelp, validate: formulaTypedProblem },
    formulaText,
    (text) => {
      params = { ...params, formula: text };
      details.typed(params);
      later();
    },
    { base: "swd", label: `Formula of ${property.label}`, focus: "formula", placeholder: formulaExample(database, key) },
  );
  const input = field.querySelector<HTMLInputElement>("input")!;
  // What is being typed of a property at the caret (none while text is selected: the selection is what a press replaces)
  const typedNow = () => (input.selectionStart === input.selectionEnd ? formulaNameTyped(input.value, input.selectionStart ?? input.value.length, database, key) : undefined);
  // A reference written in place of the selection, else of the name being typed (`Est` of Estimate, `[es`), else at the
  // caret; the field's focus kept
  const put = (text: string) => {
    const typed = typedNow();
    const from = typed?.from ?? input.selectionStart ?? input.value.length;
    const to = typed?.to ?? input.selectionEnd ?? from;
    input.value = input.value.slice(0, from) + text + input.value.slice(to);
    input.setSelectionRange(from + text.length, from + text.length);
    input.focus();
    input.dispatchEvent(new Event("input"));
  };
  // The properties a formula reads, the item's name first (not this one: it would read itself)
  const named: { readonly key: string; readonly label: string; readonly property?: Property }[] = [
    { key: NAME_KEY, label: "Name" },
    ...database.properties.filter((one) => one.key !== key).map((one) => ({ key: one.key, label: one.label || one.key, property: one })),
  ];
  const valueText = (one: (typeof named)[number], item: Item | undefined): string => {
    if (!item) return "";
    if (!one.property) return item.name;
    const value = item.values[one.key];
    if (value === undefined || isEmpty(value)) return "";
    return types.of(one.property.type, one.property.params)?.text(value, one.property.params) ?? String(value);
  };
  // A press keeps the field's focus and its caret
  const keep = { mousedown: (event: Event) => event.preventDefault() };
  const rows = named.map((one) => {
    const value = el(doc, "span", "swd-formula-property-value");
    const row = el(
      doc,
      "div",
      { class: "swd-formula-property-row", attrs: { role: "listitem", "data-key": one.key } },
      el(
        doc,
        "button",
        { class: "swd-formula-property", title: `Insert ${propertyReference(one)}: this item's ${one.label}`, attrs: { "aria-label": `Insert ${one.label}` }, on: keep, run: () => put(propertyReference(one)) },
        one.property ? details.iconOf(one.property) : el(doc, "span", { class: "swd-formula-property-icon", html: typeIcon("text") }),
        el(doc, "span", { class: "swd-formula-property-name", text: one.label }),
        value,
      ),
      el(doc, "button", {
        class: "swd-formula-property-all",
        text: "Σ",
        title: `Insert ${columnReference(one)}: every item's ${one.label}, for SUM, COUNT, AVERAGE…`,
        attrs: { "aria-label": `Insert every item's ${one.label}` },
        on: keep,
        run: () => put(columnReference(one)),
      }),
    );
    return { one, row, value };
  });
  const showValues = () => {
    const item = shownItem();
    for (const { one, value } of rows) {
      const text = valueText(one, item);
      value.textContent = text || "empty";
      // (Said with its value for the item shown, as it reads)
      value.parentElement?.setAttribute("aria-label", `Insert ${one.label}, ${text || "empty"} for ${item?.name ?? "the item"}`);
      value.classList.toggle("swd-formula-property-empty", !text);
    }
  };
  // Filtered by the name being typed: those it starts, all where none is typed (or none starts so)
  const list = el(doc, "div", { class: "swd-formula-properties", attrs: { role: "list", "aria-label": "Properties to insert into the formula" } }, ...rows.map(({ row }) => row));
  const filter = () => {
    const typed = typedNow()?.typed ?? "";
    const matching = rows.filter(({ one }) => propertyStarts(one, typed));
    for (const { row } of rows) row.hidden = matching.length > 0 && !matching.some((one) => one.row === row);
  };
  for (const event of ["input", "keyup", "click"]) input.addEventListener(event, filter);
  const panel = el(
    doc,
    "div",
    "swd-formula-panel",
    // (A preview: the result for one item as the formula is typed, nothing of it kept)
    el(
      doc,
      "div",
      { class: "swd-formula-panel-head", title: "A preview: the result for one item as you type; nothing is saved" },
      el(doc, "span", { class: "swd-formula-result-equals", text: "=", attrs: { "aria-hidden": "true" } }),
      result,
      el(doc, "span", { class: "swd-formula-result-for", text: "for" }),
      el(doc, "div", "swd-suggest-field swd-formula-result-item-box", which, picker),
    ),
    list,
    el(doc, "p", { class: "swd-formula-panel-foot", text: "A property: this item's value · Σ: every item's, for SUM, COUNT, AVERAGE…" }),
  );
  const shownAs = el(
    doc,
    "select",
    { class: "swd-formula-shown-as", attrs: { "aria-label": `${property.label} shown as` } },
    new Option("Auto", "", false, params.resultType === undefined),
    ...FORMULA_RESULT_TYPES.map((name) => new Option(types.named(name)?.label ?? name, name, false, params.resultType === name)),
  );
  shownAs.addEventListener("change", () => {
    const { resultType: _was, ...rest } = params;
    details.picked(shownAs.value ? { ...rest, resultType: shownAs.value } : rest);
  });
  const fieldRow = (name: string, control: HTMLElement, hint?: string, cls = "") =>
    el(doc, "div", `swd-prop-field ${cls}`.trim(), el(doc, "span", "swd-prop-field-name", name, ...(hint ? [el(doc, "span", { class: `${BASE}-hint`, text: hint })] : [])), control);
  return [
    fieldRow("Formula", el(doc, "div", "swd-formula-box", field, panel), undefined, "swd-prop-formula"),
    fieldRow("Show as", shownAs, SHOWN_AS[typeof params.resultType === "string" ? params.resultType : ""] ?? "", "swd-prop-formula-shown-as"),
  ];
}
