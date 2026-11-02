// The chart's settings dialog: the settings the modules and the chart's type
// give (core/setting.ts), on tabs in the order their first setting comes,
// each shown where the chart's type has what it needs and offered where the
// block's format can write it; a setting of each series a row of controls per
// series. Nothing is written until Save, then one edit of the block. It knows
// no setting by name.
import { Dialogs } from "../../../shared/dialog.ts";
import { settingRow, switchControl } from "../../../shared/controls.ts";
import { tabs } from "../../../shared/tabs.ts";
import type { ChartFormat } from "./format.ts";
import type { ChartModel } from "./model.ts";
import { choicesOf, type ItemSetting, type Setting, type SettingValue, settingShown } from "./setting.ts";
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
  /** The changes saved (one edit of the block) */
  readonly save: (change: Change) => Promise<void>;
};

/** What a format cannot write, said by a setting it does not support */
const unsupported = (format: ChartFormat, setting: Setting) => (format.supports && !format.supports(setting.key) ? `${format.label} cannot write this` : undefined);

/** A control of a setting's value: changed, `changed` told the value */
function control(doc: Document, setting: Setting, value: SettingValue, type: ChartType, model: ChartModel, changed: (value: SettingValue) => void): HTMLElement {
  switch (setting.control) {
    case "switch":
      return switchControl(doc, BASE, !!value, (on) => changed(on));
    case "choice": {
      const select = doc.createElement("select");
      for (const choice of choicesOf(setting, type, model)) select.append(new Option(choice.label, choice.value));
      select.value = String(value ?? "");
      select.addEventListener("change", () => changed(select.value));
      return select;
    }
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
  for (const field of element.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")) field.disabled = true;
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) element.disabled = true;
  element.title = why;
  return element;
}

/** The rows of the settings of each series (or label): a row per item, a control per setting */
function itemsPanel(doc: Document, settings: readonly ItemSetting[], options: SettingsDialogOptions, changes: Map<string, Change>): HTMLElement {
  const { model, type, format } = options;
  const each = settings[0]!.each;
  const count = each === "series" ? model.series.length : model.labels.length;
  const card = doc.createElement("div");
  card.className = `${BASE}-card`;
  for (let i = 0; i < count; i++) {
    const row = card.appendChild(doc.createElement("div"));
    row.className = `${BASE}-row ${BASE}-item`;
    const title = row.appendChild(doc.createElement("span"));
    title.className = `${BASE}-item-name`;
    title.textContent = each === "series" ? `${i + 1}` : (model.labels[i] ?? "");
    for (const setting of settings) {
      const field = control(doc, setting, setting.get(model, i), type, model, (value) => changes.set(`${setting.key}:${i}`, (m) => setting.set(m, i, value)));
      field.setAttribute("aria-label", setting.label);
      if (field instanceof HTMLElement) field.classList.add(`${BASE}-item-${setting.control}`);
      row.append(offered(field, unsupported(format, setting)));
    }
  }
  return card;
}

/** The dialog over the page, with the chart's settings */
export function openSettings(doc: Document, options: SettingsDialogOptions): void {
  const { model, type, format } = options;
  const shown = [...options.settings, ...(type.settings ?? [])].filter((setting) => settingShown(setting, type, model));
  const changes = new Map<string, Change>();
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
        const field = control(doc, setting, setting.get(model), type, model, (value) => changes.set(setting.key, (m) => setting.set(m, value)));
        card.append(settingRow(doc, BASE, setting.label, setting.hint ?? unsupported(format, setting), offered(field, unsupported(format, setting))));
      }
    }
    if (items.length) panel.append(itemsPanel(doc, items, options, changes));
    return { id: name, title: name, panel };
  });
  const tabbed = tabs(doc, BASE, "swc", list);
  const body = doc.createElement("div");
  body.append(...tabbed.panels);
  // (The dialog puts these in its foot)
  const foot = doc.createDocumentFragment();
  const note = foot.appendChild(doc.createElement("span"));
  note.className = `${BASE}-note`;
  note.textContent = `Written into the chart's block (${format.label})`;
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
    if (changes.size) void options.save((m) => [...changes.values()].reduce((next, change) => change(next), m));
  });
}
