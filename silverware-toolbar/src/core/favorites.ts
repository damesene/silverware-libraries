// The favourites: what the toolbar shows, rows one under another, each a
// list of items: an action (by its id: `formats.bold`, `actions.turnInto`) shown
// as its icon, or its icon and label (`show: "label"`), or a separator
// (`type: "separator"`; an item's type is "action" by default), or an item of
// a kind a module gives (its `type`: core/items.ts), whose other fields only
// that kind reads. Decided: docs/silverware-toolbar.md. An action no module
// gives (turned off, a format renamed or not defined), or a kind none gives, is
// left out of the toolbar; a test keeps the defaults equal to the library
// page's config.define.

export type Show = "icon" | "label";
export type ActionItem = { readonly type?: "action"; readonly id: string; readonly show?: Show };
export type SeparatorItem = { readonly type: "separator" };
/** An item of a kind a module gives: its type, its look, and its own fields (its slots' ids, what else its kind reads) */
export type KindItem = { readonly type: string; readonly show?: Show; readonly [field: string]: unknown };

export type FavoriteItem = ActionItem | SeparatorItem | KindItem;
export type Favorites = readonly (readonly FavoriteItem[])[];

export const isSeparator = (item: FavoriteItem): item is SeparatorItem => item.type === "separator";
export const isActionItem = (item: FavoriteItem): item is ActionItem => item.type === undefined || item.type === "action";
/** An item of a kind a module gives (neither an action nor a separator) */
export const isKindItem = (item: FavoriteItem): item is KindItem => !isSeparator(item) && !isActionItem(item);

export const DEFAULT_FAVORITES: Favorites = [
  [{ id: "actions.turnInto", show: "label" }],
  [{ id: "formats.bold" }, { id: "formats.italic" }, { id: "formats.code" }, { type: "separator" }, { id: "formats.link" }, { id: "formats.highlight" }],
];

/**
 * An item as configured, if it is one (`{ id, show }`, its type "action" by
 * default; `{ type = "separator" }`; or `{ type = <a kind>, show, … }`, its
 * other fields kept for its kind to read); else undefined
 */
export function favoriteItemOf(value: unknown): FavoriteItem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const { type, id, show, ...rest } = value as Record<string, unknown>;
  if (show !== undefined && show !== "icon" && show !== "label") return undefined;
  if (type === "separator") return id === undefined && show === undefined && !Object.keys(rest).length ? { type: "separator" } : undefined;
  if (type === undefined || type === "action") {
    if (Object.keys(rest).length || typeof id !== "string" || !id) return undefined;
    return show ? { id, show } : { id };
  }
  if (typeof type !== "string" || !type) return undefined;
  return { ...(value as Record<string, unknown>), type } as KindItem;
}
