// The favourites as the settings dialog edits them: rows of items, each change
// a new value (the dialog draws it again). An item is at a row and an index.
// Touch's own are edited with each row's pinned items at its ends (`pinOrdered`,
// `placeItem`), as the docked toolbar shows each row a line of its own.

import { type FavoriteItem, type Favorites, iconOf, isKindItem, type SlotRef, slotItemOf, slotOf, isSeparator, type KindItem, type Pin, type Show, type SeparatorItem } from "../core/favorites.ts";

export type At = { readonly row: number; readonly index: number };

const copy = (rows: Favorites): FavoriteItem[][] => rows.map((row) => [...row]);

/** The item at `from` moved to `to` (its place counted without it: in its own row, the index it ends at) */
export function moveItem(rows: Favorites, from: At, to: At): FavoriteItem[][] {
  const next = copy(rows);
  const item = next[from.row]?.[from.index];
  const target = next[to.row];
  if (!item || !target) return next;
  next[from.row]!.splice(from.index, 1);
  target.splice(Math.max(0, Math.min(to.index, target.length)), 0, item);
  return next;
}

/** Where an item goes with Alt+arrows: ← → within its row, ↑ ↓ into the row above or below (at the same index, else its end); undefined: nowhere */
export function stepOf(rows: Favorites, at: At, key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"): At | undefined {
  const row = rows[at.row];
  if (!row) return undefined;
  if (key === "ArrowLeft") return at.index > 0 ? { row: at.row, index: at.index - 1 } : undefined;
  if (key === "ArrowRight") return at.index < row.length - 1 ? { row: at.row, index: at.index + 1 } : undefined;
  const other = at.row + (key === "ArrowUp" ? -1 : 1);
  const target = rows[other];
  return target ? { row: other, index: Math.min(at.index, target.length) } : undefined;
}

/** A row moved to `to` (its place counted without it) */
export function moveRow(rows: Favorites, from: number, to: number): FavoriteItem[][] {
  const next = copy(rows);
  const row = next[from];
  if (!row || to < 0 || to >= next.length) return next;
  next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

/** An item added at a row's end, or at `index` */
export function addItem(rows: Favorites, row: number, item: FavoriteItem, index?: number): FavoriteItem[][] {
  const next = copy(rows);
  next[row]?.splice(index ?? next[row]!.length, 0, item);
  return next;
}

export function removeItem(rows: Favorites, at: At): FavoriteItem[][] {
  const next = copy(rows);
  next[at.row]?.splice(at.index, 1);
  return next;
}

/**
 * An item's look (an action's, a kind's): its icon, or its icon and label, and
 * that label's fixed width (undefined: as wide as it is); shown as its icon,
 * it has no width
 */
export function setLook(rows: Favorites, at: At, show: Show, width: number | undefined): FavoriteItem[][] {
  const next = copy(rows);
  const item = next[at.row]?.[at.index];
  if (!item || isSeparator(item)) return next;
  const { show: _, width: __, ...rest } = item as Exclude<FavoriteItem, SeparatorItem>;
  next[at.row]![at.index] = { ...rest, ...(show === "label" ? { show } : {}), ...(show === "label" && width !== undefined ? { width } : {}) } as FavoriteItem;
  return next;
}

/** An action's item (or a kind's whose items have their own) with its own icon or label (undefined, or empty: none, the action's or the kind's) */
export function setOwn(rows: Favorites, at: At, key: "icon" | "label", value: string | undefined): FavoriteItem[][] {
  const next = copy(rows);
  const item = next[at.row]?.[at.index];
  if (!item || isSeparator(item)) return next;
  const { [key]: _, ...rest } = item;
  // An icon: its first characters only
  const own = value === undefined ? undefined : key === "icon" ? iconOf(value) : value.trim();
  next[at.row]![at.index] = (own ? { ...rest, [key]: own } : rest) as FavoriteItem;
  return next;
}

/**
 * A kind's slot with its action's own icon or label (undefined, or empty:
 * none, the action's): the slot `{ id, icon, label }`, or its id alone where
 * nothing of its own is left
 */
export function setSlotOwn(rows: Favorites, at: At, slot: string, key: "icon" | "label", value: string | undefined): FavoriteItem[][] {
  const next = copy(rows);
  const item = next[at.row]?.[at.index];
  if (!item || !isKindItem(item)) return next;
  const ref = slotOf(item[slot]);
  if (!ref) return next;
  const { [key]: _, ...rest } = ref;
  const own = value === undefined ? undefined : key === "icon" ? iconOf(value) : value.trim();
  const updated: SlotRef = own ? { ...rest, [key]: own } : rest;
  next[at.row]![at.index] = { ...item, [slot]: updated.icon || updated.label ? updated : updated.id } as KindItem;
  return next;
}

/**
 * Rows ordered by hand where the toolbar is not docked (its pins only order a row there): an item pinned left
 * that no longer leads the row, or pinned right that no longer ends it, unpinned, so the order stays as made
 */
export function unpinnedOutOfOrder(rows: Favorites): FavoriteItem[][] {
  return rows.map((row) => {
    const out = [...row];
    const unpin = (i: number) => {
      const { pin: _, ...rest } = out[i] as Exclude<FavoriteItem, SeparatorItem>;
      out[i] = rest as FavoriteItem;
    };
    let leading = true;
    out.forEach((item, i) => {
      if (pinOf(item) !== "left") leading = false;
      else if (!leading) unpin(i);
    });
    let trailing = true;
    for (let i = out.length - 1; i >= 0; i--) {
      if (pinOf(out[i]!) !== "right") trailing = false;
      else if (!trailing) unpin(i);
    }
    return out;
  });
}

/** Where an item is pinned in its row (a separator: nowhere) */
export function pinOf(item: FavoriteItem): Pin | undefined {
  return isSeparator(item) ? undefined : item.pin;
}

const ZONES: readonly (Pin | undefined)[] = ["left", undefined, "right"];

/**
 * The favourites each row in the order the docked toolbar shows it: its items
 * pinned left, the others, those pinned right (each in their order), as
 * Touch's are edited: a row's pinned items in boxes at its ends
 */
export function pinOrdered(rows: Favorites): FavoriteItem[][] {
  return rows.map((row) => ZONES.flatMap((zone) => row.filter((item) => pinOf(item) === zone)));
}

/** The index in a row (pin ordered) where the items of a zone start (left, the others: undefined, right) */
function zoneStart(row: readonly FavoriteItem[], zone: Pin | undefined): number {
  const before = ZONES.slice(0, ZONES.indexOf(zone));
  return row.filter((item) => before.includes(pinOf(item))).length;
}

/**
 * An item moved into a zone of a row (pinned left, not pinned, pinned right),
 * at an index among that zone's items, pinned so or not; the rows pin
 * ordered. A separator is not pinned: into a pinned zone, nothing moves.
 * Where it lands too.
 */
export function placeItem(rows: Favorites, from: At, to: { readonly row: number; readonly zone: Pin | undefined; readonly index: number }): { readonly rows: FavoriteItem[][]; readonly at: At } {
  const next = pinOrdered(rows);
  const item = next[from.row]?.[from.index];
  if (!item || !next[to.row] || (to.zone && isSeparator(item))) return { rows: next, at: from };
  next[from.row]!.splice(from.index, 1);
  const { pin: _, ...rest } = item as Exclude<FavoriteItem, SeparatorItem>;
  const placed = (isSeparator(item) ? item : to.zone ? { ...rest, pin: to.zone } : rest) as FavoriteItem;
  const target = next[to.row]!;
  const start = zoneStart(target, to.zone);
  const size = target.filter((other) => pinOf(other) === to.zone).length;
  const index = start + Math.max(0, Math.min(to.index, size));
  target.splice(index, 0, placed);
  return { rows: next, at: { row: to.row, index } };
}

/** An item pinned at an end of its row, or not (undefined); the rows pin ordered, and where it is then */
export function setPin(rows: Favorites, at: At, pin: Pin | undefined): { readonly rows: FavoriteItem[][]; readonly at: At } {
  const item = rows[at.row]?.[at.index];
  if (!item || isSeparator(item)) return { rows: pinOrdered(rows), at };
  const ordered = pinOrdered(rows);
  const from = { row: at.row, index: ordered[at.row]!.indexOf(item) };
  // Pinned left: at the end of the items pinned left; right or none: at the start of theirs
  return placeItem(ordered, from, { row: at.row, zone: pin, index: pin === "left" ? Infinity : 0 });
}

/**
 * A kind's item with a value in one of its fields (undefined: none there): a
 * slot's action's id, or an item of a kind that is one action; a field's text
 */
export function setSlot(rows: Favorites, at: At, key: string, value: unknown): FavoriteItem[][] {
  const next = copy(rows);
  const item = next[at.row]?.[at.index];
  if (!item || !isKindItem(item)) return next;
  const { [key]: _, ...rest } = item;
  next[at.row]![at.index] = (value === undefined ? rest : { ...rest, [key]: value }) as KindItem;
  return next;
}

/**
 * A field of the item a kind's slot holds (a snippet in a gesture button's
 * swipe: its text, its own icon or label), undefined or empty taking it off;
 * an icon its first characters only, a label trimmed
 */
export function setSlotField(rows: Favorites, at: At, slot: string, key: string, value: string | undefined): FavoriteItem[][] {
  const item = rows[at.row]?.[at.index];
  const inner = item && isKindItem(item) ? slotItemOf(item[slot]) : undefined;
  if (!inner) return copy(rows);
  const { [key]: _, ...rest } = inner;
  const own = value === undefined ? undefined : key === "icon" ? iconOf(value) : key === "label" ? value.trim() : value;
  return setSlot(rows, at, slot, own ? { ...rest, [key]: own } : rest);
}

/** The favourites as saved: rows left empty left out */
export function savedRows(rows: Favorites): FavoriteItem[][] {
  return copy(rows).filter((row) => row.length > 0);
}

/** Whether two values of the favourites are the same */
export function sameRows(a: Favorites, b: Favorites): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A row removed, its items with it */
export function removeRow(rows: Favorites, row: number): FavoriteItem[][] {
  return copy(rows).filter((_, i) => i !== row);
}
