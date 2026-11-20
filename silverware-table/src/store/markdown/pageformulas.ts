// Formulas written in a page's text, not as a table's formula cells
// (docs/silverware-table-store-plan.md, *Decided (2026-11-20)* 7): found where
// the binding's finder says they are (a formula given to
// silverware.table.evaluate in the page's Space Lua, a table cell's text among
// them: host/lua.ts), each kept by the markdown store as a page formula
// (core/store.ts, PageFormulaStore). A page formula's key holds its page, its
// order among the page's formulas and its text as read, so a write finds it
// again in the page's text and refuses one changed since. What a place is in
// the text (offsets) is this file's alone.
import type { PageFormula, PageFormulaKey } from "../../core/store.ts";

/**
 * Where a formula is written in a page's text: its first character and the
 * one after its last; `holds`: whether a text can be written there in its
 * place (none: any)
 */
export type FormulaPlace = { readonly from: number; readonly to: number; readonly holds?: (text: string) => boolean };

/** Finds the formulas written in a page's text, in the order of the text */
export type FormulaPlaces = (text: string) => readonly FormulaPlace[];

let finder: FormulaPlaces | undefined;

/** The binding's finder (a later one replaces it; none: no formula is written in a page's text) */
export function defineFormulaPlaces(find: FormulaPlaces | undefined): void {
  finder = find;
}

/**
 * The places of the formulas written in `text`, as the binding's finder gives
 * them, those that are places of it only: within the text, in order, apart;
 * none where the finder throws or there is none
 */
export function formulaPlacesIn(text: string): FormulaPlace[] {
  if (!finder) return [];
  let found: readonly FormulaPlace[];
  try {
    found = finder(text);
  } catch (e) {
    console.error("Silverware Table: finding the formulas written in the page failed", e);
    return [];
  }
  const places: FormulaPlace[] = [];
  let end = 0;
  for (const place of Array.isArray(found) ? found : []) {
    const { from, to, holds } = (place ?? {}) as Partial<FormulaPlace>;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from! < end || to! < from! || to! > text.length) continue;
    places.push({ from: from!, to: to!, ...(typeof holds === "function" ? { holds } : {}) });
    end = to!;
  }
  return places;
}

const keyOf = (document: string, order: number, text: string) => JSON.stringify([document, order, text]) as PageFormulaKey;

/** What a key says: its page, its order among the page's formulas, its text as read; undefined: no key of this file's */
function readKey(key: PageFormulaKey): { readonly document: string; readonly order: number; readonly text: string } | undefined {
  try {
    const [document, order, text] = JSON.parse(key) as unknown[];
    return typeof document === "string" && Number.isInteger(order) && typeof text === "string" ? { document, order: order as number, text } : undefined;
  } catch {
    return undefined;
  }
}

/** A page's formulas written in its text, in the order of the text */
export function pageFormulasIn(document: string, text: string): PageFormula[] {
  return formulaPlacesIn(text).map((place, order) => {
    const written = text.slice(place.from, place.to);
    return { key: keyOf(document, order, written), text: written };
  });
}

/**
 * Where a page formula is in the page's text now, to write its text there;
 * or why it cannot be written: not this page's, changed since it was read,
 * or its text one its place cannot hold (a quote in a string literal)
 */
export function pageFormulaPlace(document: string, text: string, formula: PageFormula): { readonly from: number; readonly to: number } | { readonly problem: string } {
  const read = readKey(formula.key);
  if (!read || read.document !== document) return { problem: "it is not this page's" };
  const place = formulaPlacesIn(text)[read.order];
  if (!place || text.slice(place.from, place.to) !== read.text) return { problem: "it changed since it was read" };
  if (place.holds && !place.holds(formula.text)) return { problem: `its new text cannot be written where it is: ${formula.text}` };
  return { from: place.from, to: place.to };
}
