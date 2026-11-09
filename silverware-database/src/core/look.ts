// How an item's look shows, the one place of it (ItemLook in the model): a
// view says only which of its elements is the item and where its icon goes,
// through its host (`look.icon`, `look.item`), never reading the look itself.
// The icon a span of its own, its size the CSS of where it is (1em: as the
// text around it); the color a mark on the item's element (`data-swd-item-color`,
// the palette's place or `own`) and `--swd-item` (`r, g, b`), which each
// view's CSS uses its way (a card tinted, a row's stripe). Its color: its own
// (set in its peek), else, where the view colors its items by a property
// (Color by in ⋯), the color of its value's option there.
import { colorShown, isColor } from "../domain/colors.ts";
import { validateIcon } from "../domain/look.ts";
import { optionColor } from "../domain/types/options.ts";
import type { PropertyType } from "../domain/types/type.ts";
import type { Item, Property } from "../model/database.ts";
import { readableColor } from "../views/values.ts";

/** What a view colors its items by: a property whose values are options, each with its color (Color by in ⋯) */
export type ColorBy = { readonly property: Property; readonly type: PropertyType };

/** The properties a view may color its items by: those whose values are options of colors (a select's, a multi-select's) */
export function colorable(properties: readonly Property[], typeOf: (property: Property) => PropertyType): Property[] {
  return properties.filter((one) => typeOf(one).look === "options");
}

/** An item's icon as drawn, hidden from a screen reader (its name says the item); none where it has none */
export function itemIcon(doc: Document, item: Item): HTMLElement | undefined {
  const icon = item.look?.icon;
  if (!icon || validateIcon(icon)) return undefined;
  const made = doc.createElement("span");
  made.className = "swd-item-icon";
  made.setAttribute("aria-hidden", "true");
  made.textContent = icon;
  return made;
}

/** The color an item shows: its own, else its value's option's where the view colors by a property (a list's first value); none */
export function itemColor(item: Item, by?: ColorBy): number | `#${string}` | undefined {
  const own = item.look?.color;
  if (own && isColor(own)) return colorShown(own);
  if (!by) return undefined;
  const value = item.values[by.property.key];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first ? optionColor(by.property.params, first) : undefined;
}

/** An item's color on the element that draws it; an item without one: what an element drawn before had of one taken off */
export function itemLook(item: Item, element: HTMLElement, by?: ColorBy): void {
  const shown = itemColor(item, by);
  if (shown === undefined) {
    delete element.dataset.swdItemColor;
    element.style.removeProperty("--swd-item");
  } else if (typeof shown === "number") {
    element.dataset.swdItemColor = String(shown);
    element.style.removeProperty("--swd-item");
  } else {
    element.dataset.swdItemColor = "own";
    element.style.setProperty("--swd-item", readableColor(shown));
  }
}
