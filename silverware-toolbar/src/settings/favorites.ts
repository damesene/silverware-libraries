// The favourites as the settings dialog edits them: rows of items, each change
// a new value (the dialog draws it again). An item is at a row and an index.

import { type FavoriteItem, type Favorites, isKindItem, isSeparator, type KindItem, type SeparatorItem } from "../core/favorites.ts";

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

/** An item added at a row's end */
export function addItem(rows: Favorites, row: number, item: FavoriteItem): FavoriteItem[][] {
  const next = copy(rows);
  next[row]?.push(item);
  return next;
}

export function removeItem(rows: Favorites, at: At): FavoriteItem[][] {
  const next = copy(rows);
  next[at.row]?.splice(at.index, 1);
  return next;
}

/** An item shown the other way (an action's, a kind's): its icon, or its icon and label */
export function toggleShow(rows: Favorites, at: At): FavoriteItem[][] {
  const next = copy(rows);
  const item = next[at.row]?.[at.index];
  if (!item || isSeparator(item)) return next;
  const { show, ...rest } = item as Exclude<FavoriteItem, SeparatorItem>;
  next[at.row]![at.index] = (show === "label" ? rest : { ...rest, show: "label" }) as FavoriteItem;
  return next;
}

/** A kind's item with an action's id in one of its slots (undefined: none there) */
export function setSlot(rows: Favorites, at: At, key: string, id: string | undefined): FavoriteItem[][] {
  const next = copy(rows);
  const item = next[at.row]?.[at.index];
  if (!item || !isKindItem(item)) return next;
  const { [key]: _, ...rest } = item;
  next[at.row]![at.index] = (id === undefined ? rest : { ...rest, [key]: id }) as KindItem;
  return next;
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
