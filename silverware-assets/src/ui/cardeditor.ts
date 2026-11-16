// The editors of a card and of a link's icon in the settings' Appearance tab, in the spirit of a preview's label
// (ui/labeleditor.ts, ui/sample.ts): a sample of each as the page draws it, its properties shown in it (pointed at,
// focused or chosen: their name and a × over them), those not shown a row of chips over it. Neither moves anything: a
// card is laid out as it is (its icon at the left, its name, its size and date under it), a link has its icon alone.
// A card's name is always shown (a card without it would be an icon, which a link already is).
import { el } from "../../../shared/elements.ts";
import type { CardField } from "../model/settings.ts";
import { dateText, iconElement, menuMarker } from "./card.ts";
import { hiddenRow, sampleChip, sampleFile, sampleItem, sampleStage } from "./sample.ts";

// What a card may show besides its name, in the order it shows them
const CARD_PARTS = ["icon", "size", "modified"] as const;
type CardPart = (typeof CARD_PARTS)[number];
const CARD_NAMES: Readonly<Record<CardPart, string>> = { icon: "Icon", size: "Size", modified: "Date changed" };
const CARD_HINTS: Readonly<Record<CardPart, string>> = { icon: "The file type's icon", size: "The file's size", modified: "The date the file was last changed" };

/** A card's fields as a card keeps them: its icon where on, its name, its size and date where on */
export const cardFields = (on: ReadonlySet<CardPart>): CardField[] => [...(on.has("icon") ? (["icon"] as const) : []), "name", ...(on.has("size") ? (["size"] as const) : []), ...(on.has("modified") ? (["modified"] as const) : [])];

/** One editor's frame: the row of those not shown, the sample's ground; a change told by a `change` event too */
function editorFrame(doc: Document, base: string, stage: HTMLElement, off: HTMLElement, hint: string): HTMLElement {
  return el(doc, "div", `swa-sample-editor ${base}`, hiddenRow(doc, off), sampleStage(doc, stage), el(doc, "div", "swa-sample-hint", hint));
}

/** A card's editor: a sample card (a PDF's, as the page draws it), its icon, size and date shown or hidden */
export function cardEditor(doc: Document, card: readonly CardField[], icon: string, changed: (card: CardField[]) => void, date = dateText(Date.now()) ?? ""): HTMLElement {
  const on = new Set<CardPart>(CARD_PARTS.filter((part) => card.includes(part)));
  let selected: CardPart | "marker" | undefined;
  const sample = sampleFile("pdf");
  const off = el(doc, "div", { attrs: { "data-swa-place": "off", role: "list", "aria-label": "Not shown" } });
  const stage = el(doc, "div", "swa-sample-card-holder");
  const element = editorFrame(doc, "swa-card-edit", stage, off, "Click a hidden part to show it, × to hide one. The icon (or the arrow, if the icon is hidden) opens the file's menu.");
  const tell = () => {
    changed(cardFields(on));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const itemOf = (part: CardPart, content: HTMLElement) =>
    sampleItem(doc, {
      field: part,
      name: CARD_NAMES[part],
      hint: `${CARD_HINTS[part]}. × to hide it`,
      content,
      selected: selected === part,
      hide: () => {
        on.delete(part);
        selected = undefined;
        draw();
        tell();
        off.querySelector<HTMLElement>(`[data-swa-field="${part}"]`)?.focus();
      },
      choose: (chosen) => {
        selected = chosen ? part : undefined;
        draw();
        element.querySelector<HTMLElement>(`.swa-sample-item[data-swa-field="${part}"]`)?.focus();
      },
    });
  const draw = () => {
    // The card as the page draws it (ui/card.ts' classes), its parts shown as items
    const meta = el(doc, "span", "swa-card-meta");
    if (on.has("size")) meta.append(itemOf("size", el(doc, "span", { class: "swa-card-size", text: sample.size })));
    if (on.has("modified")) meta.append(itemOf("modified", el(doc, "span", { class: "swa-card-modified", text: date })));
    const text = el(doc, "span", "swa-card-text", el(doc, "span", { class: "swa-card-name", text: sample.name }));
    if (meta.childElementCount) text.append(meta);
    const marker = () => {
      const one = menuMarker(doc, "card");
      one.setAttribute("aria-hidden", "true");
      return sampleItem(doc, {
        field: "marker",
        name: "Menu",
        hint: "A small arrow after a card's name, its menu's way in where its icon is hidden; it cannot be hidden itself",
        content: one,
        selected: selected === "marker",
        choose: (chosen) => {
          selected = chosen ? "marker" : undefined;
          draw();
          element.querySelector<HTMLElement>('.swa-sample-item[data-swa-field="marker"]')?.focus();
        },
      });
    };
    stage.replaceChildren(el(doc, "div", "swa-card swa-sample-card", ...(on.has("icon") ? [itemOf("icon", iconElement(doc, icon))] : []), text, ...(on.has("icon") ? [] : [marker()])));
    off.replaceChildren(
      ...CARD_PARTS.filter((part) => !on.has(part)).map((part) =>
        sampleChip(doc, {
          field: part,
          name: CARD_NAMES[part],
          hint: `${CARD_HINTS[part]}. Click to show it`,
          show: () => {
            on.add(part);
            draw();
            tell();
            element.querySelector<HTMLElement>(`.swa-sample-item[data-swa-field="${part}"]`)?.focus();
          },
        }),
      ),
    );
  };
  draw();
  return element;
}

/**
 * A link's editor: a sentence with a link to a file (a PDF's), its icon shown or hidden; hidden, the small arrow after
 * the link is shown in its place (the menu's way in, which cannot be hidden)
 */
export function linkEditor(doc: Document, shown: boolean, icon: string, changed: (shown: boolean) => void): HTMLElement {
  let on = shown;
  let selected = false;
  const sample = sampleFile("pdf");
  const off = el(doc, "div", { attrs: { "data-swa-place": "off", role: "list", "aria-label": "Not shown" } });
  const stage = el(doc, "p", "swa-sample-sentence");
  const element = editorFrame(doc, "swa-link-edit", stage, off, "The icon (or the arrow, if the icon is hidden) opens the file's menu. × hides the icon.");
  const set = (to: boolean) => {
    on = to;
    selected = false;
    draw();
    changed(on);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.querySelector<HTMLElement>('[data-swa-field="icon"]')?.focus();
  };
  const draw = () => {
    const iconOf = () => {
      const one = iconElement(doc, icon);
      one.classList.add("swa-link-icon");
      return one;
    };
    const link = el(doc, "span", "swa-sample-link");
    if (on)
      link.append(
        sampleItem(doc, {
          field: "icon",
          name: "Icon",
          hint: "The file type's icon before a link to a file (its menu on the page). × to hide it",
          content: iconOf(),
          selected,
          hide: () => set(false),
          choose: (chosen) => {
            selected = chosen;
            draw();
            element.querySelector<HTMLElement>('.swa-sample-item[data-swa-field="icon"]')?.focus();
          },
        }),
      );
    link.append(sample.name);
    if (!on) {
      const marker = menuMarker(doc, "link");
      marker.setAttribute("aria-hidden", "true");
      link.append(
        sampleItem(doc, {
          field: "marker",
          name: "Menu",
          hint: "A small arrow after a link to a file, its menu's way in where the icon is hidden; it cannot be hidden itself",
          content: marker,
          selected,
          choose: (chosen) => {
            selected = chosen;
            draw();
            element.querySelector<HTMLElement>('.swa-sample-item[data-swa-field="marker"]')?.focus();
          },
        }),
      );
    }
    stage.replaceChildren("See ", link, " for the numbers.");
    off.replaceChildren(...(on ? [] : [sampleChip(doc, { field: "icon", name: "Icon", hint: "The file type's icon before a link to a file. Click to show it", show: () => set(true) })]));
  };
  draw();
  return element;
}
