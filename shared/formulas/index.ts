// Formulas: their language (references, functions, dates), what they read and how
// they are calculated, on tables of the model (shared/table/), whoever's rows those
// are (docs/silverware-formulas-shared.md). `=SUM(A1:A3)`, `[qty]`, `[@qty]`,
// `prices!B2`, `@tasks[due]`: what a formula reads is given (`TableSource`: other
// tables, pages, sources), and so is how its cells hold formulas and names
// (`FormulaCells`), so a plugin keeping rows its own way calculates them alike.
// Silverware Table keeps a formula in its cell (`<meta formulas.f='…'>`,
// silverware-table/src/formulas/CLAUDE.md).
//
// This is the formulas' API; the parts are the files beside it, the functions in
// builtin/ (only functions: what a formula can call), custom functions in
// custom.ts, which exist in registry.ts.
export { type CalculatedBy, type CalculatedRead, type HeldFormulas, type CellNameAt, cellResult, resultContent, PLAIN_CELLS, withEquals, cellsByName, errorCodeIn, type FormulaCells, formulaCount, forFormulas, hasFormulas, isErrorText, isFormulaInput, type RowName, rowsByName, type StoredFormula } from "./cell.ts";

export { type Area, areaText, callsCustomFunctions, callsPureFunctionsOnly, columnIdText, formulaPages, formulaTableNames, type Fixed, cellName, cellNamesOf, columnLetters, columnRangeText, columnRefText, formulaSources, type NamedReference, namedReferences, type Reference, referencedColumn, referencedColumnId, references, referredPages, referredSources, referredTableNames, type SourceRef, type TableRef, withColumnKeys } from "./references.ts";
export { autofixFormula, type FormulaFix, qualifyCellNames } from "./autofix.ts";
export { type Calculation, cellWholeResult, evaluateFormula, formulaErrors, givesList, listResult, type NamedCell, recalculate, rowValues, scalarText, tableValue, type TableSource, totalRows, calculatedNow, viewGrid, viewResult } from "./evaluate.ts";
export { type Node as FormulaNode, parse as parseFormula } from "./parser.ts";
export { parseDate, toUnit, type Unit } from "./dates.ts";
export { asGrid, ERROR_CODES, type ErrorCode, FormulaError, Grid, parseClock, type Result, type Scalar, type Value } from "./values.ts";
export { withAreasWritten, type WrittenArea, writtenArea } from "./frame.ts";
export { REF_ERROR, type Token, tokenize } from "./tokens.ts";
export { tablesWritten } from "./page.ts";
export { calculatedFormula, filledFormula, followFormula, followOwnFormula, followTable, type Following, formulasAfterEdit, shiftReferences, withCalculatedCells, withoutFormulas } from "./edits.ts";
export { argumentSpan, type ColumnChoice, columnChoicesOf, type FormulaChoice, type FormulaChoices, choiceText, cycleFixed, findFunctions, type FormulaHelp, formulaChoices, formulaHelp, functionHelp, nameTyped, needsOperator, type PointedSpan, REFERENCE_HELP, referenceSlot, sourceChoices } from "./help.ts";
export { FUNCTION_CATEGORIES, type AnyFunction, type FormulaFunction, type FunctionCategory } from "./function.ts";
export { functionNamed, isCustomFunction } from "./registry.ts";
export type { IndexMap } from "../table/ops.ts";
