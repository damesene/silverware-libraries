// The parts the modules' dialogs are made of: a field with its label, a check
// box, a line saying what will happen or what is wrong.
import { el } from "./elements.ts";

/** A field with its label above it */
export function labelled(doc: Document, label: string, control: HTMLElement, hint?: string): HTMLElement {
  return el(doc, "label", "swg-form-row", el(doc, "span", { class: "swg-form-label", text: label }), control, hint ? el(doc, "span", { class: "swg-form-hint", text: hint }) : null);
}

/** A check box with its label after it */
export function checkbox(doc: Document, label: string, checked: boolean, changed?: (on: boolean) => void): { readonly element: HTMLElement; readonly box: HTMLInputElement } {
  const box = el(doc, "input", { attrs: { type: "checkbox" } });
  box.checked = checked;
  box.addEventListener("change", () => changed?.(box.checked));
  return { element: el(doc, "label", "swg-check", box, el(doc, "span", { text: label })), box };
}

/** One of several with its label before it: a list, or (`buttons`) radio buttons */
export function choice(doc: Document, label: string, choices: readonly string[], chosen: number, changed: (index: number) => void, buttons = false): HTMLElement {
  const name = el(doc, "span", { class: "swg-form-label", text: label });
  if (!buttons) {
    const select = el(doc, "select", { class: "swg-field swg-select", attrs: { "aria-label": label } }, ...choices.map((text, i) => el(doc, "option", { text, attrs: { value: String(i) } })));
    select.value = String(chosen);
    select.addEventListener("change", () => changed(Number(select.value)));
    return el(doc, "label", "swg-choice", name, select);
  }
  const group = `swg-choice-${Math.random().toString(36).slice(2)}`;
  return el(
    doc,
    "div",
    { class: "swg-choice", attrs: { role: "radiogroup", "aria-label": label } },
    name,
    el(
      doc,
      "div",
      "swg-choice-buttons",
      ...choices.map((text, i) => {
        const radio = el(doc, "input", { attrs: { type: "radio", name: group, value: String(i) } });
        radio.checked = i === chosen;
        radio.addEventListener("change", () => radio.checked && changed(i));
        return el(doc, "label", "swg-check", radio, el(doc, "span", { text }));
      }),
    ),
  );
}

/** A line under a form:what will happen, or (`error`) what is wrong */
export function note(doc: Document): { readonly element: HTMLElement; say(text: string, error?: boolean): void } {
  const element = el(doc, "p", { class: "swg-note", attrs: { "aria-live": "polite" } });
  return {
    element,
    say: (text, error = false) => {
      element.textContent = text;
      element.classList.toggle("swg-error", error);
    },
  };
}
