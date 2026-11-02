// The chart's settings dialog: the settings the modules and the chart's type
// give (core/setting.ts), on tabs in the order their first setting comes,
// each shown where the chart has what it needs and offered where the block's
// format can write it; a setting of each item a row of controls per item
// (series, the source's columns, a pie's labels). Nothing is written until
// Save, then one edit of the block, the changes applied in the settings'
// order (a column drawn before its color is set). It knows no setting by name.
import { Dialogs } from "../../../shared/dialog.ts";
import { settingRow, switchControl } from "../../../shared/controls.ts";
import { tabs } from "../../../shared/tabs.ts";
import type { ChartFormat } from "./format.ts";
import type { ChartModel, Condition } from "./model.ts";
import { choicesOf, type ItemSetting, type Setting, type SettingChoice, type SettingContext, type SettingValue, settingShown } from "./setting.ts";
import type { ChartType } from "./type.ts";

const BASE = "swc-settings";
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

/** A change made in the dialog, applied to the block's model as it is when saved */
type Change = (model: ChartModel) => ChartModel;

export type SettingsDialogOptions = {
  readonly model: ChartModel;
  readonly type: ChartType;
  readonly format: ChartFormat;
  readonly settings: readonly Setting[];
  // The source's columns, where the chart has a source the page offers
  readonly columns?: SettingContext["columns"];
  // The tab shown first (else the first)
  readonly tab?: string;
  /** The changes saved (one edit of the block) */
  readonly save: (change: Change) => Promise<void>;
};

/** What a format cannot write, said by a setting it does not support */
const unsupported = (format: ChartFormat, setting: Setting) => (format.supports && !format.supports(setting.key) ? `${format.label} cannot write this` : undefined);

// The operators a condition is written with, as the -IFS functions' criteria start
const OPERATORS: readonly (readonly [string, string])[] = [["=", "is"], ["<>", "is not"], [">", ">"], [">=", "≥"], ["<", "<"], ["<=", "≤"]];

/** A list of conditions: a row each (a column, an operator, a value, ×), + another; `changed` told the list as it is */
function conditionsControl(doc: Document, columns: readonly SettingChoice[], value: readonly Condition[], changed: (value: readonly Condition[]) => void): HTMLElement {
  const box = doc.createElement("div");
  box.className = `${BASE}-conditions`;
  const list = box.appendChild(doc.createElement("div"));
  const read = () =>
    changed(
      [...list.children].map((row) => {
        const [column, op] = [...row.querySelectorAll("select")] as HTMLSelectElement[];
        const text = row.querySelector("input")!.value.trim();
        return { column: column!.value, criterion: `${op!.value} ${text}`.trim() };
      }),
    );
  const add = (condition: Condition) => {
    const row = list.appendChild(doc.createElement("div"));
    row.className = `${BASE}-condition`;
    const column = row.appendChild(doc.createElement("select"));
    column.setAttribute("aria-label", "Column");
    for (const choice of columns) column.append(new Option(choice.label, choice.value));
    column.value = columns.find((c) => c.value.toLowerCase() === condition.column.toLowerCase())?.value ?? columns[0]?.value ?? "";
    const op = row.appendChild(doc.createElement("select"));
    op.setAttribute("aria-label", "Operator");
    for (const [o, label] of OPERATORS) op.append(new Option(label, o));
    const criterion = condition.criterion.trim();
    const written = OPERATORS.map(([o]) => o)
      .sort((a, b) => b.length - a.length)
      .find((o) => criterion.startsWith(o));
    op.value = written ?? "=";
    const text = row.appendChild(doc.createElement("input"));
    text.type = "text";
    text.placeholder = "value, app*";
    text.setAttribute("aria-label", "Value");
    text.value = written ? criterion.slice(written.length).trim() : criterion;
    const remove = row.appendChild(doc.createElement("button"));
    remove.type = "button";
    remove.className = `${BASE}-remove`;
    remove.textContent = "×";
    remove.title = "Remove this condition";
    remove.addEventListener("click", () => {
      row.remove();
      read();
    });
    for (const field of [column, op]) field.addEventListener("change", read);
    text.addEventListener("input", read);
  };
  for (const condition of value) add(condition);
  const more = box.appendChild(doc.createElement("button"));
  more.type = "button";
  more.className = `${BASE}-add`;
  more.textContent = "+ Add a condition";
  more.addEventListener("click", () => {
    add({ column: columns[0]?.value ?? "", criterion: "=" });
    read();
  });
  return box;
}

/** A control of a setting's value: changed, `changed` told the value */
function control(doc: Document, setting: Setting, value: SettingValue, context: SettingContext, model: ChartModel, changed: (value: SettingValue) => void): HTMLElement {
  switch (setting.control) {
    case "switch":
      return switchControl(doc, BASE, !!value, (on: boolean) => changed(on));
    case "radio": {
      // (One of a setting's items: its radios share a name, the dialog's alone)
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = `${BASE}-${setting.key}`;
      input.checked = !!value;
      input.addEventListener("change", () => input.checked && changed(true));
      return input;
    }
    case "choice": {
      const select = doc.createElement("select");
      for (const choice of choicesOf(setting, context, model)) select.append(new Option(choice.label, choice.value));
      select.value = String(value ?? "");
      select.addEventListener("change", () => changed(select.value));
      return select;
    }
    case "conditions":
      return conditionsControl(doc, choicesOf(setting, context, model), Array.isArray(value) ? (value as readonly Condition[]) : [], changed);
    case "color": {
      const input = doc.createElement("input");
      input.type = "color";
      // (A color input takes #rrggbb only: one written otherwise shows as black until one is picked)
      input.value = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
      input.addEventListener("input", () => changed(input.value));
      return input;
    }
    case "number": {
      const input = doc.createElement("input");
      input.type = "number";
      input.step = "any";
      input.value = typeof value === "number" ? String(value) : "";
      input.addEventListener("input", () => changed(input.value.trim() === "" ? undefined : Number(input.value)));
      return input;
    }
    default: {
      const input = doc.createElement("input");
      input.type = "text";
      input.value = String(value ?? "");
      input.addEventListener("input", () => changed(input.value));
      return input;
    }
  }
}

/** A setting offered or not (its format cannot write it: disabled, said why) */
function offered(element: HTMLElement, why: string | undefined): HTMLElement {
  if (!why) return element;
  for (const field of element.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")) field.disabled = true;
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) element.disabled = true;
  element.title = why;
  return element;
}

/** Which item a row is: a series' number, a column's name, a label */
function itemsOf(each: ItemSetting["each"], model: ChartModel, context: SettingContext): string[] {
  if (each === "columns") return (context.columns ?? []).map((c) => c.name);
  if (each === "labels") return [...model.labels];
  return model.series.map((_, i) => String(i + 1));
}

/** The rows of the settings of each item: a row per item, a control per setting */
function itemsPanel(doc: Document, settings: readonly ItemSetting[], options: SettingsDialogOptions, context: SettingContext, changed: (setting: Setting, index: number, change: Change) => void): HTMLElement {
  const { model, format } = options;
  const card = doc.createElement("div");
  card.className = `${BASE}-card`;
  itemsOf(settings[0]!.each, model, context).forEach((item, i) => {
    const row = card.appendChild(doc.createElement("div"));
    row.className = `${BASE}-row ${BASE}-item`;
    const title = row.appendChild(doc.createElement("span"));
    title.className = `${BASE}-item-name`;
    title.textContent = item;
    title.title = item;
    for (const setting of settings) {
      const field = control(doc, setting, setting.get(model, i, context), context, model, (value) => changed(setting, i, (m) => setting.set(m, i, value, context)));
      field.setAttribute("aria-label", setting.label);
      field.classList.add(`${BASE}-item-${setting.control}`);
      row.append(offered(field, unsupported(format, setting)));
    }
  });
  return card;
}

/** The dialog over the page, with the chart's settings */
export function openSettings(doc: Document, options: SettingsDialogOptions): void {
  const { model, type, format } = options;
  const context: SettingContext = { type, ...(options.columns ? { columns: options.columns } : {}) };
  const shown = [...options.settings, ...(type.settings ?? [])].filter((setting) => settingShown(setting, context, model));
  // The changes by setting and item, applied in the settings' order when saved
  const changes = new Map<Setting, Map<number, Change>>();
  const changed = (setting: Setting, index: number, change: Change) => {
    // (An item picked of all: the one picked last the change, not each picked before it)
    const own = (setting.control !== "radio" && changes.get(setting)) || new Map<number, Change>();
    own.set(index, change);
    changes.set(setting, own);
  };
  const names = [...new Set(shown.map((setting) => setting.tab))];
  const list = names.map((name) => {
    const panel = doc.createElement("div");
    const own = shown.filter((setting) => setting.tab === name);
    const whole = own.filter((setting): setting is Exclude<Setting, ItemSetting> => setting.each === undefined);
    const items = own.filter((setting): setting is ItemSetting => setting.each !== undefined);
    if (whole.length) {
      const card = panel.appendChild(doc.createElement("div"));
      card.className = `${BASE}-card`;
      for (const setting of whole) {
        const field = control(doc, setting, setting.get(model, context), context, model, (value) => changed(setting, 0, (m) => setting.set(m, value, context)));
        const row = settingRow(doc, BASE, setting.label, setting.hint ?? unsupported(format, setting), offered(field, unsupported(format, setting)));
        // (A list of controls of its own: its row a block, not a label working one control)
        if (setting.control === "conditions") row.classList.add(`${BASE}-row-wide`);
        card.append(row);
      }
    }
    // Item settings of one kind of item a card each (a chart has one kind shown)
    for (const each of ["columns", "series", "labels"] as const) {
      const of = items.filter((setting) => setting.each === each);
      if (of.length) panel.append(itemsPanel(doc, of, options, context, changed));
    }
    return { id: name, title: name, panel };
  });
  const tabbed = tabs(doc, BASE, "swc", list);
  if (options.tab && names.includes(options.tab)) tabbed.select(options.tab);
  const body = doc.createElement("div");
  body.append(...tabbed.panels);
  // (The dialog puts these in its foot)
  const foot = doc.createDocumentFragment();
  const note = foot.appendChild(doc.createElement("span"));
  note.className = `${BASE}-note`;
  note.textContent = model.source ? `Drawn from ${model.source.table}, written into the chart's block (${format.label})` : `Written into the chart's block (${format.label})`;
  const cancel = foot.appendChild(doc.createElement("button"));
  cancel.type = "button";
  cancel.className = `${BASE}-cancel`;
  cancel.textContent = "Cancel";
  const save = foot.appendChild(doc.createElement("button"));
  save.type = "button";
  save.className = `${BASE}-save`;
  save.textContent = "Save";
  const dialog = new Dialogs(doc, { base: BASE, closeIcon: CLOSE_ICON }).open({
    title: "Chart settings",
    subtitle: model.title,
    bar: names.length > 1 ? tabbed.bar : undefined,
    content: body,
    footer: foot,
  });
  cancel.addEventListener("click", () => dialog.close());
  save.addEventListener("click", () => {
    dialog.close();
    if (!changes.size) return;
    const ordered = shown.flatMap((setting) => [...(changes.get(setting)?.entries() ?? [])].sort(([a], [b]) => a - b).map(([, change]) => change));
    void options.save((m) => ordered.reduce((next, change) => change(next), m));
  });
}
