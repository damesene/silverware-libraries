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

/**
 * Whether this device is worked by a finger (its main pointer coarse: a phone,
 * a tablet), which shows the favourites for touch where they are set; a
 * laptop's touch screen is not (its touchpad is its main pointer)
 */
export function byTouch(win: Window | null | undefined): boolean {
  return !!win?.matchMedia?.("(pointer: coarse)").matches;
}

export const isSeparator = (item: FavoriteItem): item is SeparatorItem => item.type === "separator";
export const isActionItem = (item: FavoriteItem): item is ActionItem => item.type === undefined || item.type === "action";
/** An item of a kind a module gives (neither an action nor a separator) */
export const isKindItem = (item: FavoriteItem): item is KindItem => !isSeparator(item) && !isActionItem(item);

/** The favourites for a mouse (Click, and the default): a row of each kind of action */
export const DEFAULT_FAVORITES: Favorites = [
  [{ id: "actions.turnInto", show: "label" }],
  [{ id: "formats.bold" }, { id: "formats.italic" }, { id: "formats.highlight" }, { id: "formats.underline" }, { id: "formats.strikethrough" }],
  [{ id: "formats.link" }, { id: "formats.wikiLink" }, { id: "formats.code" }, { id: "formats.codeBlock" }],
  [{ id: "actions.emoji", show: "label" }, { type: "separator" }, { id: "actions.more" }],
];

/** The favourites for a finger (Touch): the same actions, the kin of one a swipe of its gesture button, so the bar at the bottom is short */
export const DEFAULT_TOUCH_FAVORITES: Favorites = [
  [{ id: "actions.turnInto", show: "label" }],
  [
    { type: "gesture", tap: "formats.bold", up: "formats.italic", down: "formats.highlight" },
    { type: "gesture", tap: "formats.strikethrough", down: "formats.underline" },
  ],
  [
    { type: "gesture", tap: "formats.link", up: "formats.wikiLink" },
    { type: "gesture", tap: "formats.code", up: "formats.codeBlock" },
  ],
  [{ id: "actions.emoji" }, { id: "actions.more" }],
];

/**
 * Whether favourites have an action (`actions.more`, which the toolbar must
 * have) anywhere: an action's item, or any slot of an item of a kind given
 * (the kind's slots read, nothing of what they are for; a kind no module on
 * gives shows nothing, so it counts for nothing)
 */
export function hasAction(rows: Favorites, id: string, kinds: readonly { readonly type: string; readonly slots: readonly { readonly key: string }[] }[]): boolean {
  return rows.some((row) =>
    row.some((item) => {
      if (isSeparator(item)) return false;
      if (isActionItem(item)) return item.id === id;
      const kind = kinds.find((k) => k.type === item.type);
      return !!kind && kind.slots.some((slot) => item[slot.key] === id);
    }),
  );
}

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
