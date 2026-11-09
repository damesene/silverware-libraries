// The order by hand: an item's `rank`, a text compared by code point, so that
// an item moves by a rank between its new neighbours' (a fractional index:
// the library `fractional-indexing`, CC0, as the plan says, a known algorithm
// over one of our own). A query of the index orders the same texts the same
// way (docs/silverware-database.md, probe 5).
import { generateKeyBetween } from "fractional-indexing";
import type { Item, ItemKey } from "../model/database.ts";

/** Whether a rank is one this order can place another beside (a rank typed by hand may be none) */
export function isRank(rank: string | undefined): rank is string {
  if (rank === undefined) return false;
  try {
    generateKeyBetween(rank, null);
    return true;
  } catch {
    return false;
  }
}

/** Two ranks compared as the order has them: by code point, an item without one (or with one it cannot read) after the ranked */
export function compareRanks(a: string | undefined, b: string | undefined): number {
  const [hasA, hasB] = [isRank(a), isRank(b)];
  if (!hasA || !hasB) return hasA === hasB ? 0 : hasA ? -1 : 1;
  return a! < b! ? -1 : a! > b! ? 1 : 0;
}

/** Items in the order by hand: by rank, an item without one (or with one it cannot read) after the ranked, those by name */
export function inRankOrder(items: readonly Item[]): Item[] {
  // Each rank checked once, not in every comparison (a check makes a key: thousands of items sorted on every refresh)
  const ranked = new Map(items.map((item) => [item, isRank(item.rank)] as const));
  return [...items].sort((a, b) => {
    const [hasA, hasB] = [ranked.get(a)!, ranked.get(b)!];
    const byRank = !hasA || !hasB ? (hasA === hasB ? 0 : hasA ? -1 : 1) : a.rank! < b.rank! ? -1 : a.rank! > b.rank! ? 1 : 0;
    return byRank || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  });
}

/** Where an item goes: its rank, and the ranks other items need first for it to be there (none where the order allows it) */
export type Placing = { readonly rank: string; readonly others: ReadonlyMap<ItemKey, string> };

/**
 * The ranks placing an item at `index` of `ordered` (the items in rank order,
 * `inRankOrder`, without the item; its length: the end). Its rank goes between
 * its neighbours'; where they do not allow it (an item above without a rank,
 * which sorts after every ranked one; two of one rank; a rank it cannot
 * read), those items get ranks first, in their order: they move nowhere, so
 * the order shown stays, and nothing else of them changes.
 */
export function placeAt(ordered: readonly Item[], index: number): Placing {
  const others = new Map<ItemKey, string>();
  let last: string | null = null;
  // The first rank after position `from` that is greater than the last one given
  const above = (from: number) => {
    for (let j = from; j < ordered.length; j++) {
      const rank = ordered[j]!.rank;
      if (isRank(rank) && (last === null || rank > last)) return rank;
    }
    return null;
  };
  for (let j = 0; j < index; j++) {
    const { key, rank } = ordered[j]!;
    if (isRank(rank) && (last === null || rank > last)) last = rank;
    else others.set(key, (last = generateKeyBetween(last, above(j + 1))));
  }
  const rank = generateKeyBetween(last, above(index));
  last = rank;
  // Items below of a rank not after it now (one of the rank above it) follow it as they did
  for (let j = index; j < ordered.length; j++) {
    const { key, rank: own } = ordered[j]!;
    if (!isRank(own) || own > last) break;
    others.set(key, (last = generateKeyBetween(last, above(j + 1))));
  }
  return { rank, others };
}
