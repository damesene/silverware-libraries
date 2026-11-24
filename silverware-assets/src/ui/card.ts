// An asset's card (docs/silverware-assets.md, *The icon card*): drawn here for every type, its icon the type's
// (a URL drawn as <img>, SVG text inlined so it takes the theme's colour), its fields as the user chose them. And the
// mark of an asset that failed to render: an icon over it, the error as its tooltip.
import { el } from "../../../shared/elements.ts";

export type CardField = { readonly name: string; readonly text: string };

/** A menu's marker where a file's icon is hidden (its menu's way in, after a link or a card's name): a small arrow down, drawn by the text's colour */
const MENU_MARKER_SVG = '<svg viewBox="0 0 10 10" width="1em" height="1em" aria-hidden="true"><path d="M2.5 4 5 6.5 7.5 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** A menu's marker as the page and the settings' samples draw it: `where` it is, a link's (after its text) or a card's (after its name) */
export function menuMarker(doc: Document, where: "link" | "card"): HTMLElement {
  const marker = el(doc, "span", { class: `swa-menu-marker swa-${where}-marker` });
  marker.innerHTML = MENU_MARKER_SVG;
  return marker;
}

/**
 * A type's icon: SVG text inlined, else an image of its URL. Its size the text's where it gives none, until the style
 * page's rules size it (a rule wins over the attributes): drawn as a page loads, before those rules apply, an SVG of
 * no size of its own took the whole width of what it was in (a preview's label: its file icon as wide as the page)
 */
export function iconElement(doc: Document, icon: string): HTMLElement {
  const holder = el(doc, "span", { class: "swa-icon", attrs: { "aria-hidden": "true" } });
  if (icon.trimStart().startsWith("<svg")) {
    // The type's own markup (its icon), as registered
    holder.innerHTML = icon;
    const svg = holder.querySelector("svg");
    if (svg && !svg.hasAttribute("width") && !svg.hasAttribute("height")) {
      svg.setAttribute("width", "1em");
      svg.setAttribute("height", "1em");
    }
    return holder;
  }
  holder.append(el(doc, "img", { attrs: { src: icon, alt: "", width: "16", height: "16" } }));
  return holder;
}

/** A card: the icon where the user shows it, then each field */
export function drawCard(doc: Document, icon: string | undefined, fields: readonly CardField[], title: string): HTMLElement {
  const card = el(doc, "div", { class: "swa-card", title, attrs: { role: "button", tabindex: 0 } });
  if (icon !== undefined) card.append(iconElement(doc, icon));
  const text = el(doc, "span", { class: "swa-card-text" });
  for (const field of fields) text.append(el(doc, "span", { class: `swa-card-${field.name}`, text: field.text }));
  card.append(text);
  return card;
}

/** Fields added to a card a moment after it was drawn (a file's size and date), on a line of their own under its name */
export function addCardFields(doc: Document, card: HTMLElement, fields: readonly CardField[]): void {
  if (!fields.length) return;
  const line = el(doc, "span", { class: "swa-card-meta" });
  for (const field of fields) line.append(el(doc, "span", { class: `swa-card-${field.name}`, text: field.text }));
  (card.querySelector(".swa-card-text") ?? card).append(line);
}

/** A size in bytes as read: B, KB, MB, GB (1024 a step), one decimal under 10 */
export function sizeText(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${unit === 0 || size >= 10 ? Math.round(size) : Math.round(size * 10) / 10} ${units[unit]}`;
}

/** A time (an ISO text or milliseconds) as a date in the browser's language; none where it is no time */
export function dateText(time: string | number, locale?: string): string | undefined {
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * What stands in a picture's place where its file could not be loaded (not in the space, or not reached): a box of the
 * view's size with the type's icon, the file's name and why, so the file keeps its place, its size and its menu
 */
export function drawMissing(doc: Document, icon: string, name: string): HTMLElement {
  const missing = el(doc, "div", { class: "swa-missing", title: `${name}: the file was not found`, attrs: { role: "img", "aria-label": `${name}: the file was not found` } });
  missing.append(iconElement(doc, icon), el(doc, "span", { class: "swa-missing-name", text: name }), el(doc, "span", { class: "swa-missing-note", text: "File not found" }));
  return missing;
}

/** An asset marked as failed to render: an icon over it, the message its tooltip */
export function markFailed(doc: Document, element: HTMLElement, message: string): void {
  element.querySelector(":scope > .swa-failed")?.remove();
  element.classList.add("swa-has-error");
  element.append(el(doc, "span", { class: "swa-failed", text: "!", title: message, attrs: { role: "img", "aria-label": `Not rendered: ${message}` } }));
}
