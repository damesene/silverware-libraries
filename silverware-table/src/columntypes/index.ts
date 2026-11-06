// Column types: a hashtag in a column's header (`| Price #currency |`) shows
// its cells as that type. This is the column types' API for the rest of
// Silverware Table; the types are in builtin/ (only types), custom types in custom.ts,
// which exist in registry.ts.
export { allTypes, columnTypeOf, type TypedColumn, typeNamed, typeOfTag, typeTagPatterns, withColumnType } from "./registry.ts";
export { type Choice, type ColumnType, type Params, type Shown, type TypeTable } from "./type.ts";
export { choiceListOf, isChoice } from "./choicecolumn.ts";
export { choiceIndex, distinctValues, LIST_NAME_RE, listFormula, listKey, listNameFor, listNames, listOfValues, readChoiceList, writeChoiceList } from "./choicelists.ts";

/**
 * What the column types module offers other modules (ModelHost.offered("columnTypes")): a cell's value as its
 * column's type compares it (sorting, filters), from the column's header and the cell's text as shown; the text
 * where the column has no type or the text is not a value of it
 */
export type ColumnTypesOffer = { readonly valueOf: (header: string, text: string) => string };
