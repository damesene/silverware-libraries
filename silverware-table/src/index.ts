// Silverware Table entry point, loaded by the init page's Space Lua:
//   js.importFromSpace("Library/damesene/silverware-table.js").init({ ... editor functions ... })
import { customSeries, customSeriesAnew, defineCustomSeries } from "./autofill/index.ts";
import { type Bridge, listOf, missingBridgeFunctions } from "./bridge.ts";
import { Controller } from "./controller.ts";
import { customTypes } from "./columntypes/custom.ts";
import { customTypesAnew, defineCustomTypes } from "./columntypes/registry.ts";
import { checkedConditions, checkedFormats, customDefinitionsAnew, defineCustomConditions, defineCustomFormats } from "./conditions/index.ts";
import { customFunctions } from "./formulas/custom.ts";
import { cellResult, choiceText, type FormulasOffer, functionNamed, givesList, scalarText, withEquals } from "./formulas/index.ts";
import { defineFormulaPlaces as defineFormulaPlacesIn, type FormulaPlaces } from "./formulas/places.ts";
import { isError, isRange, type Scalar, single, TimeValue, type Value } from "./formulas/values.ts";
import { customFunctionsAnew, defineCustomFunctions } from "./formulas/registry.ts";
import { addWriteListener, type WriteListener, writeListenersAnew } from "./core/writelisteners.ts";
import { pageTablesOf } from "./markdown.ts";
import { metaName } from "./meta.ts";
import { columnNameIn } from "./names.ts";
import { type TableData, tableData } from "./tabledata.ts";
import { customMenuEntries, customMenuEntriesAnew, defineCustomMenuEntries } from "./menus/custom.ts";

export const version = "0.1.0";

// One controller per window, even if the module is loaded again (e.g. after an update)
const GLOBAL_KEY = "__silverwareTable";

/** Called by the init page on SilverBullet's `page:index` event */
export function pageIndexed(name: string): void {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  void controller?.pageIndexed(name);
}

/** Called by the init page on SilverBullet's `editor:pageLoaded` event */
export function pageLoaded(): void {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  void controller?.pageLoaded();
}

/** The "Silverware Table: Settings" command */
export function openSettings(): void {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  void controller?.openSettings();
}

/** The modules' commands (those turned on), for the init page to define them and their slash commands, once the modules started */
export async function commandList(): Promise<{ name: string; description: string; slash?: string }[]> {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  return ((await controller?.commands()) ?? []).map(({ name, description, slash }) => ({ name, description, ...(slash ? { slash } : {}) }));
}

/** A module's command run (its command or slash command) */
export async function runCommand(name: string): Promise<void> {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  await (await controller?.commands())?.find((command) => command.name === name)?.run();
}

/** The "Silverware Table: Remove table metadata" command */
export function removeAllMetadata(): void {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  void controller?.removeAllMetadata();
}

/** An error as `evaluated` gives it: its code (plain, `#REF!`) and why */
export type EvaluatedError = { readonly code: string; readonly detail: string };
/** One value as `evaluated` gives it: a number, a logical value, a text (a date, a time as written), none */
export type EvaluatedScalar = number | boolean | string | null;

/** What Silverware Table gives while it has not started or the formulas module is off */
const FORMULAS_OFF: EvaluatedError = { code: "#N/A", detail: "formulas are off" };

/**
 * A formula calculated on a page, in none of its tables, so what it reads it
 * names by a table's name (`=prices!vat`, `=SUM(prices![qty])`,
 * `=[[Other]]prices!B2`): its value, whether it is a list (a range written as
 * one: a list however many values), and the other pages it read, for a caller
 * that follows their changes. Undefined: Silverware Table has not started or
 * the formulas module is off. `text`: the page's text (else the editor's),
 * `page` its name (else the page shown).
 */
async function calculated(formula: string, text?: string, page?: string): Promise<{ readonly value: Value; readonly list: boolean; readonly pages: readonly string[] } | undefined> {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  const formulas = controller?.offered<FormulasOffer>("formulas");
  if (!controller || !formulas) return undefined;
  const written = String(formula);
  const { value, pages } = await formulas.evaluate(written, text ?? (await controller.bridge.getText()), page === undefined ? undefined : String(page));
  const list = isRange(value) && (value.length !== 1 || givesList(withEquals(written).formula.trim()));
  return { value: list ? value : single(value), list, pages };
}

/** A value as Lua takes it: a time as its text, an error its code and why */
function luaValue(value: Scalar): EvaluatedScalar | EvaluatedError {
  if (isError(value)) return { code: value.code, detail: value.detail };
  if (value instanceof TimeValue) return scalarText(value);
  return value;
}

/**
 * `silverware.table.evaluate`: a formula's values, for Lua. One value as a
 * number, a logical value, a text (a date, a time as written) or null where
 * empty; a list (a range) as a list, empty cells "" in it, an error of one of
 * its cells as `{ code, detail }` in its place. An error of the formula as
 * `error` (and `value` null).
 */
export async function evaluated(
  formula: string,
  text?: string,
  page?: string,
): Promise<{ readonly value: EvaluatedScalar | readonly (EvaluatedScalar | EvaluatedError)[]; readonly error?: EvaluatedError; readonly pages: readonly string[] }> {
  const result = await calculated(formula, text, page);
  if (!result) return { value: null, error: FORMULAS_OFF, pages: [] };
  const { value, pages } = result;
  if (isRange(value)) return { value: value.map((v) => (v === null ? "" : luaValue(v))), pages };
  const one = luaValue(value as Scalar);
  return one !== null && typeof one === "object" ? { value: null, error: one, pages } : { value: one, pages };
}

/**
 * `silverware.table.evaluateText`: a formula's result as text for a page, as
 * a cell shows it: several values joined by ", "; an error as a cell holds
 * it, `\#REF!`, so it shows as written and is no hashtag (`cellResult`).
 */
export async function evaluatedText(formula: string, text?: string, page?: string): Promise<{ readonly value: string; readonly pages: readonly string[] }> {
  const result = await calculated(formula, text, page);
  if (!result) return { value: cellResult(FORMULAS_OFF.code), pages: [] };
  const shown = (v: Scalar) => cellResult(scalarText(v));
  return { value: isRange(result.value) ? result.value.map(shown).join(", ") : shown(result.value as Scalar), pages: result.pages };
}

/** A formula cell showing an error, as `silverware.table.errors` gives it */
export type FormulaErrorRecord = {
  readonly page: string;
  readonly ref: string;
  readonly table?: string;
  readonly cell: string;
  readonly column: string;
  readonly code: string;
  readonly detail: string;
  readonly formula: string;
};

/**
 * `silverware.table.errors`: the errors formula cells show on these pages,
 * calculated now ({ page, text } each, as the API page's Lua read them), in
 * the pages' order and each page's cells' order: each page's and its row's
 * place (`ref`, `Page@offset`), its table's name, its cell, its column's key,
 * the error's code and why, its formula; the other pages read. With the
 * formulas module off: `error`, and no records.
 */
export async function formulaErrorsIn(pages: unknown): Promise<{ readonly errors: readonly FormulaErrorRecord[]; readonly error?: EvaluatedError; readonly pages: readonly string[] }> {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  const formulas = controller?.offered<FormulasOffer>("formulas");
  if (!formulas) return { errors: [], error: FORMULAS_OFF, pages: [] };
  const errors: FormulaErrorRecord[] = [];
  const read = new Set<string>();
  for (const item of listOf(pages)) {
    const { page, text } = (item ?? {}) as { page?: unknown; text?: unknown };
    if (typeof page !== "string" || typeof text !== "string") continue;
    const found = await formulas.errors(text, page);
    for (const other of found.pages) read.add(other);
    for (const { at, ...error } of found.errors) errors.push({ page, ref: `${page}@${at}`, ...error });
  }
  return { errors, pages: [...read] };
}

/**
 * `silverware.table.errorsText`: the same errors as records of markdown, which
 * a `${…}` shows as a table: the page and the cell as links (the cell's to its
 * row), the error's code escaped so it is no hashtag, why. None: a line saying so.
 */
export async function formulaErrorsTextIn(pages: unknown): Promise<{ readonly errors: string | readonly Readonly<Record<string, string>>[]; readonly pages: readonly string[] }> {
  const found = await formulaErrorsIn(pages);
  if (found.error) return { errors: `${cellResult(found.error.code)} ${found.error.detail}`, pages: [] };
  if (found.errors.length === 0) return { errors: "No formula errors", pages: found.pages };
  return {
    errors: found.errors.map((e) => ({ page: `[[${e.page}]]`, table: e.table ?? "", cell: `[[${e.ref}|${e.cell}]]`, error: cellResult(e.code), reason: e.detail })),
    pages: found.pages,
  };
}

/** A name a formula typed so far may go on with: the text it inserts, what it is, and for a function its syntax and description */
export type FormulaCompletion = {
  readonly text: string;
  readonly kind: "function" | "cell" | "row" | "table" | "column";
  readonly syntax?: string;
  readonly description?: string;
};

/**
 * What the name typed before `caret` (its place in `formula`, else its end;
 * the `=` optional) may be, on the page's `text`, as a cell's editor offers
 * it: functions, the page's named tables, after `table!` that table's named
 * cells; none in the middle of a name. `typed`: how many characters before
 * the caret the name is, the ones a completion replaces. Undefined when
 * nothing completes there.
 */
export function completions(formula: string, text: string, caret?: number): { readonly typed: number; readonly choices: readonly FormulaCompletion[] } | undefined {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  const formulas = controller?.offered<FormulasOffer>("formulas");
  if (!formulas) return undefined;
  const written = String(formula);
  // A formula without its "=" read as one with it
  const lead = written.trimStart().startsWith("=") ? "" : "=";
  const at = lead.length + Math.max(0, Math.min(written.length, caret ?? written.length));
  const found = formulas.complete(lead + written, at, String(text));
  if (!found || found.choices.length === 0) return undefined;
  const choices = found.choices.map((choice): FormulaCompletion => {
    const fn = choice.kind === "function" ? functionNamed(choice.name) : undefined;
    return { text: choiceText(choice), kind: choice.kind, ...(fn ? { syntax: fn.syntax, description: fn.description } : {}) };
  });
  return { typed: at - found.from, choices };
}

/**
 * Where formulas are written in a page's text outside its tables: a finder
 * of their places (text → [{ from, to }]), whose formulas' references then
 * follow the edits of the tables they name, in the same edit. A later one
 * replaces it; anything but a function takes it away.
 */
export function defineFormulaPlaces(finder: unknown): void {
  defineFormulaPlacesIn(typeof finder === "function" ? (finder as FormulaPlaces) : undefined);
}

// The finder of formulas given to Space Lua calls (silverware.table.evaluate and its aliases), which the
// library's init page registers: host/lua.ts, apart from the rest, which knows nothing of Lua
export { luaCallPlaces } from "./host/lua.ts";

/**
 * `silverware.table.onWrite`: a function told of each write of tables, the
 * page's text as the write leaves it and a context to ask what the write did
 * (`renamed()`, `table(name)`, `tableAt(at)`: a table's `name` now and
 * `column(name)` a column's name now), giving edits of the text outside the
 * tables (`{ from, to, text }`), written in the same edit. Another plugin's
 * (Silverware Chart writes its charts' data and follows renames so);
 * Silverware Table knows nothing of what they are for.
 */
export function onWrite(listener: unknown): void {
  if (typeof listener === "function") addWriteListener(listener as WriteListener);
}

/** One table of a text as `tables` gives it */
export type TableOfText = TableData;

/**
 * `silverware.table.tables`: the tables of a markdown text (a page's, as the
 * caller has it), each with its name, its place, its columns and its body's
 * cells: what another plugin reads tables by, without reading their metadata
 */
export function tables(text: string): TableOfText[] {
  return pageTablesOf(String(text)).map(({ range, table }) => tableData(table, range, metaName(table), (column) => columnNameIn(table, column)));
}

/**
 * What a notification says of definitions refused: which and why (the API
 * page's Lua adds where they come from: the definitions do not say)
 */
function notDefined(what: string, problems: readonly string[]): string | undefined {
  return problems.length ? `Silverware Table: ${what} not defined: ${problems.join("; ")}.` : undefined;
}

/**
 * `silverware.table.defineFunctions` (the API page's Space Lua): custom functions
 * for formulas, a list (or a function given the helpers that
 * returns one), usually a JS module of the space. The others defined, what is
 * wrong with any of them, which the API page shows as a notification (an
 * error there would stop the rest of the user's script).
 */
export function defineFunctions(definitions: unknown): string | undefined {
  const { functions, problems } = customFunctions(definitions);
  defineCustomFunctions(functions);
  definitionsChanged();
  return notDefined("custom functions", problems);
}

/**
 * `silverware.table.defineTypes`: custom column types, as `defineFunctions` takes
 * functions. Tables rendered from now on show them (Space Lua defines them
 * before a page shows); what is wrong with any of them, for a notification.
 */
export function defineTypes(definitions: unknown): string | undefined {
  const { types, problems } = customTypes(definitions);
  defineCustomTypes(types);
  definitionsChanged();
  return notDefined("custom column types", problems);
}

/**
 * `silverware.table.defineSeries`: custom series for AutoFill (lists of words to go
 * round, or series as the built-in ones), as `defineFunctions` takes
 * functions. The next fill uses them (no table shows them); what is wrong with
 * any of them, for a notification.
 */
export function defineSeries(definitions: unknown): string | undefined {
  const { series, problems } = customSeries(definitions);
  defineCustomSeries(series);
  return notDefined("custom series", problems);
}

/**
 * `silverware.table.defineConditions`: custom conditions of conditional formatting, as `defineTypes` takes
 * types; tables with rules look as they say at once; what is wrong with any of them, for a notification
 */
export function defineConditions(definitions: unknown): string | undefined {
  const { list, problems } = checkedConditions(definitions);
  defineCustomConditions(list);
  definitionsChanged();
  return notDefined("custom conditions", problems);
}

/** `silverware.table.defineFormats`: custom formats of conditional formatting, as `defineConditions` */
export function defineFormats(definitions: unknown): string | undefined {
  const { list, problems } = checkedFormats(definitions);
  defineCustomFormats(list);
  definitionsChanged();
  return notDefined("custom formats", problems);
}

/**
 * `silverware.table.defineMenuEntries`: entries of a user's or another plugin's in a row's or a column's
 * menu, each definition a name and its lineMenu(context, menu) (menus/custom.ts); the calls of one load of
 * Space Lua add up, a name given again replacing its definition. They show as a menu opens; what is wrong
 * with any of them, for a notification
 */
export function defineMenuEntries(definitions: unknown): string | undefined {
  const { list, problems } = customMenuEntries(definitions);
  defineCustomMenuEntries(list);
  return notDefined("menu entries", problems);
}

/** Space Lua is loaded (again): the custom definitions are made anew, replacing those of before */
export function resetDefinitions(): void {
  customMenuEntriesAnew();
  customFunctionsAnew();
  customTypesAnew();
  customSeriesAnew();
  customDefinitionsAnew();
  writeListenersAnew();
}

// Tables are checked again once for definitions made in one go (a script's calls one after another)
let checkQueued = false;
function definitionsChanged(): void {
  if (checkQueued) return;
  checkQueued = true;
  setTimeout(() => {
    checkQueued = false;
    const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
    controller?.tablesChanged();
  });
}

export function init(bridge: Bridge): void {
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Table: missing editor functions: ${missing.join(", ")}`);
    return;
  }
  const global = globalThis as unknown as Record<string, Controller | undefined>;
  const existing = global[GLOBAL_KEY];
  if (existing) {
    existing.setBridge(bridge);
    return;
  }
  const controller = new Controller(document, bridge);
  global[GLOBAL_KEY] = controller;
  controller.start();
}
