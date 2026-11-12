// A settings dialog's controls, for any of the plugins, by a class base
// (`swt-settings`, the toolbar's `swb-settings`): a setting's row
// (`${base}-row`: its name and hint, `${base}-label` / `-name` / `-hint`, left;
// its control right) and a switch (`${base}-switch`: a checkbox drawn as one,
// `${base}-knob`). And joined buttons, one pressed (`segmentedControl`), by the
// plugin's own base (`swl`): `${base}-segments`, `${base}-segment`, the look of
// a menu's segmented entry (shared/segments.css, the same classes).

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

/** A choice of a segmented control: its value, what it shows (text or an icon's markup) and says */
export type Segment<T extends string> = { readonly value: T; readonly label: string; readonly html?: string; readonly title?: string };

/** What a segmented control gives: its element, and a way to press another of its choices (none told) */
export type SegmentedControl<T extends string> = { readonly element: HTMLElement; set(value: T): void };

/**
 * Joined buttons side by side, one pressed: a radio group (`role="radiogroup"`, each button `role="radio"` with
 * `aria-checked`), the arrow keys moving the choice. Not in a settingRow's label: a click on the name would press its
 * first button
 */
export function segmentedControl<T extends string>(doc: Document, base: string, name: string, segments: readonly Segment<T>[], value: T, changed: (value: T) => void): SegmentedControl<T> {
  const group = el(doc, "span", `${base}-segments`);
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", name);
  const buttons = segments.map((segment) => {
    const button = el(doc, "button", `${base}-segment`);
    button.type = "button";
    button.setAttribute("role", "radio");
    button.dataset.value = segment.value;
    button.setAttribute("aria-label", segment.title ?? segment.label);
    if (segment.title) button.title = segment.title;
    if (segment.html) button.innerHTML = segment.html;
    else button.textContent = segment.label;
    return button;
  });
  let now = value;
  const show = () => {
    for (const [i, button] of buttons.entries()) {
      const on = segments[i]!.value === now;
      button.setAttribute("aria-checked", String(on));
      button.tabIndex = on ? 0 : -1;
    }
  };
  const pick = (to: T, focus: boolean) => {
    const changes = to !== now;
    now = to;
    show();
    if (focus) buttons[segments.findIndex((segment) => segment.value === to)]?.focus();
    if (changes) changed(to);
  };
  for (const [i, button] of buttons.entries()) {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      pick(segments[i]!.value, false);
    });
    button.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      pick(segments[(i + step + segments.length) % segments.length]!.value, true);
    });
  }
  group.append(...buttons);
  show();
  return {
    element: group,
    set: (to) => {
      now = to;
      show();
    },
  };
}
