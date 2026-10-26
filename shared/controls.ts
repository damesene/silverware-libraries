// A settings dialog's controls, for any of the plugins, by a class base
// (`swt-settings`, the toolbar's `swb-settings`): a setting's row
// (`${base}-row`: its name and hint, `${base}-label` / `-name` / `-hint`, left;
// its control right) and a switch (`${base}-switch`: a checkbox drawn as one,
// `${base}-knob`).

const el = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = doc.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** A setting's name, and under it what it does where it says more than its name */
export function settingLabel(doc: Document, base: string, name: string, hint?: string): HTMLElement {
  const label = el(doc, "span", `${base}-label`);
  label.append(el(doc, "span", `${base}-name`, name));
  if (hint) label.append(el(doc, "span", `${base}-hint`, hint));
  return label;
}

/** A setting's row: its name (and hint) left, its control right; a label, so a click on the name works the control */
export function settingRow(doc: Document, base: string, name: string, hint: string | undefined, control: HTMLElement): HTMLLabelElement {
  const row = el(doc, "label", `${base}-row`);
  row.append(settingLabel(doc, base, name, hint), control);
  return row;
}

/** A switch: a checkbox drawn as one */
export function switchControl(doc: Document, base: string, on: boolean, changed: (on: boolean) => void): HTMLElement {
  const wrap = el(doc, "span", `${base}-switch`);
  const box = doc.createElement("input");
  box.type = "checkbox";
  box.setAttribute("role", "switch");
  box.checked = on;
  box.addEventListener("change", () => changed(box.checked));
  wrap.append(box, el(doc, "span", `${base}-knob`));
  return wrap;
}
