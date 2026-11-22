// How many items a view draws of each group (docs/silverware-database-load-more.md): its first `pageSize`, as many
// more each Load more, and any item added, changed or moved past them (+ New at the end of thousands), after them in
// their order. Kept for the window by database, view and listing (its filter, sort and grouping), as a place's scroll is
// (a block written makes a new place, which takes it back), never written into the block; as presses, so a larger page's
// size shows more. A listing of another filter, sort or grouping starts from its first items: two blocks of one view
// listing otherwise each keep their own.
import { moreParts } from "../views/more.ts";
import type { Item } from "../model/database.ts";

/**
 * A view's state: Load more pressed by group (`""` its one list), the items shown wherever they are past a cut (added
 * or moved there), the item a press gives the focus to once drawn, the listing it belongs to
 */
type ViewShown = { readonly signature: string; readonly presses: Map<string, number>; readonly revealed: Set<string>; focus?: Focus };

/** The item a press gives the focus to, in its group (an item of several values may be in several groups) */
export type Focus = { readonly item: string; readonly group: string };

// By database, view and listing, for the window: the latest used last, the oldest let go past KEPT
const shownByView = new Map<string, ViewShown>();
const KEPT = 50;

/** How much of a group a view draws, and the row under it where more are listed */
export type ViewLimit = {
  /** The items of a group (none: the view's) to draw: its first page's size times the presses, then those shown past them */
  shown(items: readonly Item[], group?: string): readonly Item[];
  /** The row's parts under a group's items drawn (Load N more, how many are shown), none where all are */
  more(items: readonly Item[], group?: string): HTMLElement[] | undefined;
};

/** Where a view's limit is kept (its database and view) and the listing it belongs to (its filter, sort and grouping) */
export type LimitKey = { readonly key: string; readonly signature: () => string };

/** What a view's limit is made of besides: the page's size, the document, the view drawn anew */
export type LimitOptions = LimitKey & { readonly size: number; readonly document: Document; readonly refresh: () => void };

/** The state of a view's listing (its signature's), made where it has none: another listing starts every group anew */
function viewShown({ key, signature }: LimitKey): ViewShown {
  const now = signature();
  const at = `${key}\u0000${now}`;
  let shown = shownByView.get(at);
  if (shown) shownByView.delete(at);
  else shown = { signature: now, presses: new Map(), revealed: new Set() };
  // (Used last: the last let go)
  shownByView.set(at, shown);
  if (shownByView.size > KEPT) shownByView.delete(shownByView.keys().next().value!);
  return shown;
}

/** A view's limit, by its options */
export function viewLimit(options: LimitOptions): ViewLimit {
  const cut = (items: readonly Item[], group: string) => {
    const view = viewShown(options);
    const count = Math.min(items.length, options.size * ((view.presses.get(group) ?? 0) + 1));
    const past = view.revealed.size ? items.slice(count).filter((item) => view.revealed.has(item.key)) : [];
    // (What a press draws: the next page's items, but for those shown already past the cut; pages of those alone gone
    // past, so a press draws something)
    let pages = 1;
    let next: Item[] = [];
    for (; count + (pages - 1) * options.size < items.length; pages++) {
      next = items.slice(count, count + pages * options.size).filter((item) => !view.revealed.has(item.key));
      if (next.length) break;
    }
    return { view, count, past, next, pages };
  };
  return {
    shown(items, group = "") {
      const { count, past } = cut(items, group);
      return count >= items.length ? items : [...items.slice(0, count), ...past];
    },
    more(items, group = "") {
      const { count, past, next, pages } = cut(items, group);
      if (count + past.length >= items.length) return undefined;
      return moreParts(options.document, count + past.length, items.length, next.length, () => {
        const now = viewShown(options);
        // (The first of those it draws has the focus once drawn: the keys go on from there)
        const first = next[0];
        now.focus = first && { item: first.key, group };
        now.presses.set(group, (now.presses.get(group) ?? 0) + pages);
        options.refresh();
      });
    },
  };
}

/** An item added, changed or moved shown in its view wherever it lands, past a group's cut too, until the listing changes */
export function revealItem(limit: LimitKey, item: string): void {
  viewShown(limit).revealed.add(item);
}

/**
 * The item a Load more pressed gives the focus to and its group (`""`: the view's one list), handed to `give` till it
 * takes it (true): a drawing put off (a cell being edited) leaves it to the next
 */
export function takeFocus(limit: LimitKey, give: (focus: Focus) => boolean): void {
  const view = shownByView.get(`${limit.key}\u0000${limit.signature()}`);
  if (view?.focus && give(view.focus)) delete view.focus;
}

/** A limit drawing everything (a view's group already cut by the place) */
export const NO_LIMIT: ViewLimit = { shown: (items) => items, more: () => undefined };
