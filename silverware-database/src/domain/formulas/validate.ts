// Why a formula of a database's property cannot be (docs/silverware-database-formulas.md, decided 2): it does not
// parse, or it reads outside the database, which formulas of a database do not do yet (another database, a table of a
// page, a page, a source of the space come after the first release). Checked as the property's params are, so such a
// formula is never kept through Properties; one written into the root page by hand is calculated as its error, saying
// so (model.ts), never read as something else.
import { FormulaError, formulaPages, formulaSources, formulaTableNames, parseFormula, withEquals } from "../../../../shared/formulas/index.ts";

const LATER = "a database's formulas read only its own items for now";

/** What a formula reads outside the database, said for its error, undefined where it reads only the database */
export function outsideReading(text: string): string | undefined {
  const { formula } = withEquals(text);
  const tables = formulaTableNames(formula);
  if (tables.length) return `its formula reads the table ${tables[0]}: ${LATER}`;
  const sources = formulaSources(formula);
  if (sources.length) return `its formula reads @${sources[0]}: ${LATER}`;
  const pages = formulaPages(formula);
  if (pages.length) return `its formula reads the page ${pages[0]}: ${LATER}`;
  return undefined;
}

/** Why a formula's text is no formula a database's property can have, undefined where it is one */
export function validateFormula(text: string): string | undefined {
  const tree = parseFormula(withEquals(text).formula);
  if (tree instanceof FormulaError) return `its formula: ${tree.detail}`;
  return outsideReading(text);
}
