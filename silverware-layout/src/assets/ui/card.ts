// An asset's card (docs/silverware-layout-assets.md, *The icon card*): drawn here for every type, its icon the type's
// (a URL drawn as <img>, SVG text inlined so it takes the theme's colour), its fields as the user chose them. And the
// mark of an asset that failed to render: an icon over it, the error as its tooltip.
import { el } from "../../../../shared/elements.ts";

export type CardField = { readonly name: string; readonly text: string };

/** A type's icon: SVG text inlined, else an image of its URL */
export function iconElement(doc: Document, icon: string): HTMLElement {
  if (icon.trimStart().startsWith("<svg")) {
    const holder = el(doc, "span", { class: "swl-asset-icon", attrs: { "aria-hidden": "true" } });
    // The type's own markup (its icon), as registered
    holder.innerHTML = icon;
    return holder;
  }
  const holder = el(doc, "span", { class: "swl-asset-icon", attrs: { "aria-hidden": "true" } });
  holder.append(el(doc, "img", { attrs: { src: icon, alt: "" } }));
  return holder;
}

/** A card: the icon where the user shows it, then each field */
export function drawCard(doc: Document, icon: string | undefined, fields: readonly CardField[], title: string): HTMLElement {
  const card = el(doc, "div", { class: "swl-asset-card", title, attrs: { role: "button", tabindex: 0 } });
  if (icon !== undefined) card.append(iconElement(doc, icon));
  const text = el(doc, "span", { class: "swl-asset-card-text" });
  for (const field of fields) text.append(el(doc, "span", { class: `swl-asset-card-${field.name}`, text: field.text }));
  card.append(text);
  return card;
}

/** An asset marked as failed to render: an icon over it, the message its tooltip */
export function markFailed(doc: Document, element: HTMLElement, message: string): void {
  element.querySelector(":scope > .swl-asset-failed")?.remove();
  element.classList.add("swl-asset-has-error");
  element.append(el(doc, "span", { class: "swl-asset-failed", text: "!", title: message, attrs: { role: "img", "aria-label": `Not rendered: ${message}` } }));
}
