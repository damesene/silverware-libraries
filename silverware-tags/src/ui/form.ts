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

/** A line under a form: what will happen, or (`error`) what is wrong */
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
