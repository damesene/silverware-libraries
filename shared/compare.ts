// How values are compared for sorting, shared by the plugins: Silverware
// Table's sorting and pivots, Silverware Database's views. Pure, on texts as
// they show: numbers by their value (a unit or a currency around them read as
// filters read it, shared/filter.ts), the rest by the locale's collation with
// numbers in it compared as numbers (`Item 2` before `Item 10`, ISO dates in
// their order), case and diacritics left out.
import { asNumber } from "./filter.ts";

export type SortDirection = "asc" | "desc";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareValues(a: string, b: string): number {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== undefined && nb !== undefined) return na - nb;
  return collator.compare(a.trim(), b.trim());
}

/**
 * Two values in a sorted order: empty ones last in both directions, the
 * others by `compareValues` in the direction. 0 for a tie, which the caller
 * breaks (Silverware Table keeps the rows' order in the markdown).
 */
export function compareForSort(a: string, b: string, direction: SortDirection): number {
  const ea = a.trim() === "";
  const eb = b.trim() === "";
  if (ea !== eb) return ea ? 1 : -1;
  return (direction === "asc" ? 1 : -1) * compareValues(a, b);
}
