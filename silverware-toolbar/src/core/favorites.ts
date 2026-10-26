// The favourites: what the toolbar shows, rows one under another, each a
// list of items: an action (by its id: `formats.bold`, `actions.turnInto`) shown
// as its icon, or its icon and label (`show: "label"`), or a separator
// (`type: "separator"`; an item's type is "action" by default).
// Decided: docs/silverware-toolbar.md. An action no module gives (turned off,
// a format renamed or not defined) is left out of the toolbar; a test keeps
// the defaults equal to the library page's config.define.

export type FavoriteItem = { readonly type?: "action"; readonly id: string; readonly show?: "icon" | "label" } | { readonly type: "separator" };
export type Favorites = readonly (readonly FavoriteItem[])[];

export const DEFAULT_FAVORITES: Favorites = [
  [{ id: "actions.turnInto", show: "label" }],
  [{ id: "formats.bold" }, { id: "formats.italic" }, { id: "formats.code" }, { type: "separator" }, { id: "formats.link" }, { id: "formats.highlight" }],
];

/** An item as configured, if it is one (`{ id, show }`, its type "action" by default, or `{ type = "separator" }`); else undefined */
export function favoriteItemOf(value: unknown): FavoriteItem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const { type, id, show, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length) return undefined;
  if (type === "separator") return id === undefined && show === undefined ? { type: "separator" } : undefined;
  if ((type !== undefined && type !== "action") || typeof id !== "string" || !id) return undefined;
  if (show !== undefined && show !== "icon" && show !== "label") return undefined;
  return show ? { id, show } : { id };
}
