// Silverware Table entry point, loaded by the library page's Space Lua:
//   js.importFromSpace("Library/damesene/silverware-table.js").init({ ... editor functions ... })
import { customSeries, customSeriesAnew, defineCustomSeries } from "./autofill/index.ts";
import { type Bridge, missingBridgeFunctions } from "./bridge.ts";
import { Controller } from "./controller.ts";
import { customTypes } from "./columntypes/custom.ts";
import { customTypesAnew, defineCustomTypes } from "./columntypes/registry.ts";
import { customFunctions } from "./formulas/custom.ts";
import { choiceText, type FormulasOffer, functionNamed, scalarText } from "./formulas/index.ts";
import { isRange, single } from "./formulas/values.ts";
import { customFunctionsAnew, defineCustomFunctions } from "./formulas/registry.ts";

export const version = "0.1.0";

// One controller per window, even if the module is loaded again (e.g. after an update)
const GLOBAL_KEY = "__silverwareTable";

/** Called by the library page on SilverBullet's `page:index` event */
export function pageIndexed(name: string): void {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  void controller?.pageIndexed(name);
}

/** Called by the library page on SilverBullet's `editor:pageLoaded` event */
export function pageLoaded(): void {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  void controller?.pageLoaded();
}

/** The "Silverware Table: Settings" command */
export function openSettings(): void {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  void controller?.openSettings();
}

/** The "Silverware Table: Remove table metadata" command */
export function removeAllMetadata(): void {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  void controller?.removeAllMetadata();
}

/**
 * `silverware.table.evaluate` (the library page's Space Lua): a formula
 * calculated on the page shown, in none of its tables, so what it reads it
 * names by a table's name (`=prices!vat`, `=SUM(prices![qty])`,
 * `=[[Other]]prices!B2`). One value as its text, as a cell shows it; several
 * (a range) as a JSON list of their texts, `["a","b"]`; an error by its code
 * (#N/A while Silverware Table has not started or the formulas module is off).
 * `text`: the page's, as the library page's Lua reads it (editor.getText, so
 * SilverBullet shows the `${…}` anew when the page changes); `pages`: the
 * other pages it read, which the Lua reads through SilverBullet too, for the same.
 */
export async function evaluated(formula: string, text?: string): Promise<{ readonly value: string; readonly pages: readonly string[] }> {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  const formulas = controller?.offered<FormulasOffer>("formulas");
  if (!controller || !formulas) return { value: "#N/A", pages: [] };
  const { value, pages } = await formulas.evaluate(String(formula), text ?? (await controller.bridge.getText()));
  return { value: isRange(value) && value.length !== 1 ? JSON.stringify(value.map(scalarText)) : scalarText(single(value)), pages };
}

// A call of silverware.table.evaluate before the caret, its formula's text typed so far (in either quotes)
const EVALUATE_CALL_RE = /silverware\.table\.evaluate\(\s*(["'])((?:(?!\1).)*)$/;

/** A completion SilverBullet offers (a CodeMirror completion: what shows, what it inserts) */
export type Completion = { readonly label: string; readonly apply: string; readonly detail?: string; readonly info?: string; readonly type: string };

/**
 * The library page's `editor:complete` listener: in a formula given to
 * silverware.table.evaluate (`linePrefix`, the line before the caret at
 * `pos`), what the name typed may be, as a cell's editor offers it (functions,
 * the page's named tables, after `table!` its named cells); undefined elsewhere
 */
export function completion(linePrefix: string, pos: number, text: string): { readonly from: number; readonly options: readonly Completion[] } | undefined {
  const controller = (globalThis as unknown as Record<string, Controller | undefined>)[GLOBAL_KEY];
  const formulas = controller?.offered<FormulasOffer>("formulas");
  const typed = EVALUATE_CALL_RE.exec(String(linePrefix))?.[2];
  if (!formulas || typed === undefined) return undefined;
  // A formula without its "=" (it is optional) read as one with it
  const lead = typed.trimStart().startsWith("=") ? "" : "=";
  const found = formulas.complete(lead + typed, String(text));
  if (!found || found.choices.length === 0) return undefined;
  const options = found.choices.map((choice): Completion => {
    const fn = choice.kind === "function" ? functionNamed(choice.name) : undefined;
    return {
      label: choiceText(choice),
      apply: choiceText(choice),
      type: choice.kind === "function" ? "function" : choice.kind === "table" ? "class" : "variable",
      ...(fn ? { detail: fn.syntax, info: fn.description } : { detail: choice.kind }),
    };
  });
  return { from: pos - (lead.length + typed.length - found.from), options };
}

/** As `evaluated`, its value only */
export async function evaluate(formula: string): Promise<string> {
  return (await evaluated(formula)).value;
}

/**
 * What a notification says of definitions refused: which and why (the library
 * page's Lua adds where they come from: the definitions do not say)
 */
function notDefined(what: string, problems: readonly string[]): string | undefined {
  return problems.length ? `Silverware Table: ${what} not defined: ${problems.join("; ")}.` : undefined;
}

/**
 * `silverware.table.defineFunctions` (the library page's Space Lua): custom functions
 * for formulas, a list (or a function given the helpers that
 * returns one), usually a JS module of the space. The others defined, what is
 * wrong with any of them, which the library page shows as a notification (an
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

/** Space Lua is loaded (again): the custom definitions are made anew, replacing those of before */
export function resetDefinitions(): void {
  customFunctionsAnew();
  customTypesAnew();
  customSeriesAnew();
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
