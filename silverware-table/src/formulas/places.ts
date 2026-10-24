// Formulas written in a page's text outside its tables (a host's: a page's
// scripts that calculate a formula), found where the host's finder says they
// are: what the domain knows of them is only their places. Their references to
// a table follow its edits as other tables' formulas do (the formulas module's
// otherTextWritten). None without a finder.

/** Where a formula is written in a page's text: its first character and the one after its last */
export type FormulaPlace = { readonly from: number; readonly to: number };

/** Finds the formulas written in a page's text, in the order of the text */
export type FormulaPlaces = (text: string) => readonly FormulaPlace[];

let finder: FormulaPlaces | undefined;

/** The host's finder (a later one replaces it; none: no formula is written outside tables) */
export function defineFormulaPlaces(find: FormulaPlaces | undefined): void {
  finder = find;
}

/**
 * The places of the formulas written in `text`, as the host's finder gives
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
    const { from, to } = (place ?? {}) as Partial<FormulaPlace>;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from! < end || to! < from! || to! > text.length) continue;
    places.push({ from: from!, to: to! });
    end = to!;
  }
  return places;
}
