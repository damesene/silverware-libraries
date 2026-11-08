// The peek's look of an item: its icon and its color, over its name (as
// Notion's page), each a button opening its picker under it in the panel
// (views/popover.ts): the emoji choice; the palette's colors, its own color,
// None. What is picked is handed to `write` (the core's `setLook` through the
// panel), the look as a whole.
import { el } from "../../../../shared/elements.ts";
import type { ModuleHost } from "../../core/module.ts";
import { COLORS, isColor } from "../../domain/colors.ts";
import type { Item, ItemLook } from "../../model/database.ts";
import { emojiChoice, popovers } from "../../views/popover.ts";

export type LookControls = {
  /** The row of the two buttons, over the name */
  readonly row: HTMLElement;
  /** A picker closed (the item drawn anew, the panel closing) */
  close(): void;
};

/**
 * The icon's and the color's buttons of `item`, their pickers opened in
 * `panel` under them; `write` given the item's look as it is to be (`{}`:
 * none) and the button to focus again once drawn anew
 */
export function lookControls(host: ModuleHost, panel: HTMLElement, item: Item, write: (look: ItemLook, refocus: string) => void): LookControls {
  const doc = host.document;
  const look = item.look ?? {};
  const pickers = popovers(doc);
  // (In the panel's top, held there as it scrolls: the picker stays under its button)
  const holderOf = (button: HTMLElement) => button.closest<HTMLElement>(".swd-peek-top") ?? panel;
  const done = (next: ItemLook, refocus: string) => {
    pickers.close();
    write(next, refocus);
  };

  // The icon: the item's own, larger, else a quiet button to add one
  const icon = el(
    doc,
    "button",
    {
      class: `swd-peek-icon${look.icon ? "" : " swd-peek-icon-none"}`,
      title: look.icon ? "Change the icon" : "Add an icon",
      attrs: { "aria-label": look.icon ? "Change the icon" : "Add an icon", "aria-haspopup": "dialog", "aria-expanded": "false" },
      run: () =>
        pickers.open(icon, holderOf(icon), "Icon", (box) =>
          emojiChoice(
            doc,
            box,
            "Icon",
            (emoji) => done(withPart(look, "icon", emoji), ".swd-peek-icon"),
            look.icon ? () => done(withPart(look, "icon", undefined), ".swd-peek-icon") : undefined,
          ),
        ),
    },
    host.look.icon(item) ?? el(doc, "span", { class: "swd-peek-icon-add", text: "☺ Add icon" }),
  );

  // The color: its swatch and name
  const swatch = el(doc, "span", "swd-peek-swatch");
  host.look.item(item, swatch);
  const color = el(
    doc,
    "button",
    {
      class: `swd-peek-color${look.color ? "" : " swd-peek-color-none"}`,
      title: "Color",
      attrs: { "aria-label": `Color: ${look.color ?? "none"}`, "aria-haspopup": "dialog", "aria-expanded": "false" },
      run: () =>
        pickers.open(color, holderOf(color), "Color", (box) => {
          const pick = (value: string | undefined) => done(withPart(look, "color", value), ".swd-peek-color");
          const option = (value: string | undefined, label: string) => {
            const dot = el(doc, "span", "swd-peek-swatch");
            host.look.item({ ...item, look: value ? { color: value } : {} }, dot);
            return el(doc, "button", { class: "swd-peek-pop-color", title: label, attrs: { "aria-label": label, "aria-pressed": String(look.color === value) }, run: () => pick(value) }, dot);
          };
          // (Its own color: the browser's picker, kept as #rrggbb)
          const own = el(doc, "input", { class: "swd-peek-pop-own", attrs: { type: "color", "aria-label": "Own color", title: "Own color", value: look.color?.startsWith("#") ? look.color : "#4a6cf7" } });
          own.addEventListener("change", () => isColor(own.value) && pick(own.value.toLowerCase()));
          box.append(
            el(doc, "div", "swd-pop-head", el(doc, "span", { class: "swd-pop-title", text: "Color" })),
            el(doc, "div", "swd-peek-pop-colors", option(undefined, "None"), ...COLORS.map((name) => option(name, name[0]!.toUpperCase() + name.slice(1))), own),
          );
          box.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
        }),
    },
    swatch,
    el(doc, "span", { class: "swd-peek-color-name", text: look.color ? (look.color.startsWith("#") ? "Own color" : look.color[0]!.toUpperCase() + look.color.slice(1)) : "Color" }),
  );
  return { row: el(doc, "div", "swd-peek-look", icon, color), close: () => pickers.close() };
}

/** A look with one part set (undefined: taken off), the other kept */
function withPart(look: ItemLook, part: keyof ItemLook, value: string | undefined): ItemLook {
  const next = { ...look };
  if (value === undefined) delete next[part];
  else next[part] = value;
  return next;
}
