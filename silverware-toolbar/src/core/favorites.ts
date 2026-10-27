// The favourites: what the toolbar shows, rows one under another, each a
// list of items: an action (by its id: `formats.bold`, `actions.turnInto`) shown
// as its icon, or its icon and label (`show: "label"`), or a separator
// (`type: "separator"`; an item's type is "action" by default), or an item of
// a kind a module gives (its `type`: core/items.ts), whose other fields only
// that kind reads. An action's or a kind's item may have a fixed `width` of
// its label (in characters, MIN_WIDTH to MAX_WIDTH: a longer one cut with an
// ellipsis, a shorter one leaving the room, so what comes after it keeps its
// place), and be pinned (`pin`: "left" or "right") at an end of the toolbar
// docked at the bottom, out of what scrolls, wherever it is in its rows. An
// action's item may have its own `icon` (a character, an emoji) and `label`
// in place of the action's, as a text snippet has (its label also its
// tooltip; an action offering choices shows the choice on, its own label its
// tooltip only).
// Decided: docs/silverware-toolbar.md. An action no module
// gives (turned off, a format renamed or not defined), or a kind none gives, is
// left out of the toolbar; a test keeps the defaults equal to the library
// page's config.define.

export type Show = "icon" | "label";
export type Pin = "left" | "right";
/** What an action's and a kind's item have alike: how it shows, its label's width, where it is pinned */
export type Look = { readonly show?: Show; readonly width?: number; readonly pin?: Pin };
export type ActionItem = Look & { readonly type?: "action"; readonly id: string; readonly icon?: string; readonly label?: string };
export type SeparatorItem = { readonly type: "separator" };
/** An item of a kind a module gives: its type, its look, and its own fields (its slots' ids, what else its kind reads) */
export type KindItem = Look & { readonly type: string; readonly [field: string]: unknown };

// A label's fixed width, in characters: narrower, it would hide the label; wider, the toolbar would run off a phone
export const MIN_WIDTH = 3;
export const MAX_WIDTH = 30;

// An item's own icon: as many characters at most (an emoji of several code points one), so a button stays a button
export const MAX_ICON = 3;

/** An own icon as configured or typed: its first MAX_ICON characters (graphemes), its spaces at the ends left out; undefined: none (empty) */
export function iconOf(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const Segmenter = (Intl as { Segmenter?: new (locale?: string, options?: { granularity: string }) => { segment(t: string): Iterable<{ segment: string }> } }).Segmenter;
  const characters = Segmenter ? Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed), (s) => s.segment) : Array.from(trimmed);
  return characters.slice(0, MAX_ICON).join("");
}

/**
 * A kind's slot as configured: an action's id, or the same with an icon and a
 * label of its own (`{ id, icon, label }`, as an action's item has them); what
 * it holds, else undefined (none, or not of that shape)
 */
export type SlotRef = { readonly id: string; readonly icon?: string; readonly label?: string };
export function slotOf(value: unknown): SlotRef | undefined {
  if (typeof value === "string") return value ? { id: value } : undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const { id, icon, label } = value as Record<string, unknown>;
  if (typeof id !== "string" || !id) return undefined;
  const glyph = typeof icon === "string" ? iconOf(icon) : undefined;
  const name = typeof label === "string" ? label.trim() : "";
  return { id, ...(glyph ? { icon: glyph } : {}), ...(name ? { label: name } : {}) };
}

/** An own icon as HTML, as an action's icon is (an SVG): its characters as they are */
export function ownIconHtml(icon: string): string {
  const text = icon.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<span class="swb-own-icon">${text}</span>`;
}

/** A width as configured or typed, kept within MIN_WIDTH and MAX_WIDTH, whole; undefined: none (not a number) */
export function widthOf(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
}

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
  [{ id: "actions.turnInto", show: "label", width: 9, pin: "left" }],
  [
    { type: "gesture", tap: "formats.bold", up: "formats.italic", down: "formats.highlight" },
    { type: "gesture", tap: "formats.strikethrough", down: "formats.underline" },
  ],
  [
    { type: "gesture", tap: "formats.link", up: "formats.wikiLink" },
    { type: "gesture", tap: "formats.code", up: "formats.codeBlock" },
  ],
  [{ id: "actions.emoji" }, { id: "actions.more", pin: "right" }],
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
      return !!kind && kind.slots.some((slot) => slotOf(item[slot.key])?.id === id);
    }),
  );
}

/**
 * An item as configured, if it is one (`{ id, show, width, pin }`, its type
 * "action" by default; `{ type = "separator" }`; or `{ type = <a kind>, show,
 * width, pin, … }`, its other fields kept for its kind to read); else
 * undefined. A width out of its bounds is kept within them.
 */
export function favoriteItemOf(value: unknown): FavoriteItem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const { type, id, show, width, pin, ...rest } = value as Record<string, unknown>;
  if (show !== undefined && show !== "icon" && show !== "label") return undefined;
  if (width !== undefined && widthOf(width) === undefined) return undefined;
  if (pin !== undefined && pin !== "left" && pin !== "right") return undefined;
  if (type === "separator") return id === undefined && show === undefined && width === undefined && pin === undefined && !Object.keys(rest).length ? { type: "separator" } : undefined;
  const look = { ...(show ? { show } : {}), ...(width !== undefined ? { width: widthOf(width) } : {}), ...(pin ? { pin } : {}) } as Look;
  if (type === undefined || type === "action") {
    const { icon, label, ...more } = rest;
    if (Object.keys(more).length || typeof id !== "string" || !id) return undefined;
    if ((icon !== undefined && typeof icon !== "string") || (label !== undefined && typeof label !== "string")) return undefined;
    // (An empty one: none)
    const glyph = icon === undefined ? undefined : iconOf(icon);
    const own = { ...(glyph ? { icon: glyph } : {}), ...(label?.trim() ? { label: label.trim() } : {}) };
    return { id, ...look, ...own };
  }
  if (typeof type !== "string" || !type) return undefined;
  return { ...rest, ...(id !== undefined ? { id } : {}), type, ...look } as KindItem;
}
