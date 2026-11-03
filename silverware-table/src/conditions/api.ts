// The public API of conditional formatting: what a condition or a format is,
// what its functions get and give. The built-in definitions (builtin/) and the
// user's (silverware.table.defineConditions / defineFormats) are written
// against this file alone: a built-in one imports only its types (`import
// type`, gone from the bundle), and gets the helpers as its argument, as a
// user's file does. So a built-in definition copied into the space works
// there unchanged, and a user's can do whatever a built-in one does.
import type { HELPERS } from "./helpers.ts";

/**
 * A color: a name of the palette (`red`, `green`…: a tint where it fills a
 * cell, a dark shade where it colors text, a strong one for bars and icons;
 * each with its light and dark look), any CSS color (`#e8f0ff`,
 * `rgb(…)`, `color-mix(…)`), or a color for each look
 */
export type Color = string | { readonly light: string; readonly dark: string };

/** How a cell looks: data, never CSS text; only what changes is given */
export type Style = {
  readonly fill?: Color;
  readonly color?: Color;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strike?: boolean;
  // A bar under the cell's content, `share` of its width (0 to 1): a data bar
  readonly bar?: { readonly share: number; readonly color?: Color };
  // A short text before the cell's content (an arrow, a dot: ▲ ●), in `iconColor`
  readonly icon?: string;
  readonly iconColor?: Color;
};

/** A cell as a definition gets it: its value read already */
export type Cell = {
  // What it shows (a formula's result, a link's text)
  readonly text: string;
  // What sorting compares (a column type's value, else the text)
  readonly value: string;
  // The value as a number, where it reads as one (12,99 €, 1 000, 15 %)
  readonly number?: number;
  // The value as a date (2025-11-06, 2025-11-06 14:30), in milliseconds of a clock without time zone
  readonly date?: number;
  // Its column's key (unit_price)
  readonly column: string;
};

/**
 * What the cells a definition applies to have together (a condition's: the
 * rule's scope; a format's: the cells the condition picked). Computed only
 * as asked, once per table and rule.
 */
export type Scope = {
  // How many cells
  readonly size: number;
  // The cells' numbers, smallest first (cells that are no number left out)
  readonly numbers: readonly number[];
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly average: number | undefined;
  readonly sum: number;
  /** Where the cell's number is from the minimum (0) to the maximum (1); undefined: no number */
  position(cell: Cell): number | undefined;
  /** The cell's number as a share of the largest (from the smaller of 0 and the minimum): a bar's length */
  share(cell: Cell): number | undefined;
  /** The cell's place by its number, 1 the largest (`ascending`: 1 the smallest); undefined: no number */
  rank(cell: Cell, ascending?: boolean): number | undefined;
  /** The number at a percentile (0 to 100) of the numbers, between two of them where it falls between (as PERCENTILE.INC) */
  percentile(p: number): number | undefined;
  /** The cell's place among the numbers, from 0 (the smallest) to 1 (the largest): equal counts */
  quantile(cell: Cell): number | undefined;
  /** How many cells have the cell's value (case ignored) */
  count(cell: Cell): number;
};

/** What a condition's `test` and a format's `look` get besides the cell */
export type Context<P = Params> = {
  readonly params: P;
  readonly scope: Scope;
  // The other cells of its row, by their column's key
  readonly row: Readonly<Record<string, Cell>>;
  /**
   * A formula of one row (`[@due] < TODAY()`) calculated for the cell's row;
   * undefined: it cannot be (the formulas module is off)
   */
  formula(text: string): string | number | boolean | undefined;
};

/**
 * A parameter of a definition: what the dialog asks for (its field built from
 * this), what the rule stores, what the definition gets. `label` names it in
 * the dialog (else its key); no `default`: undefined until set. `line`: the
 * params of one line, side by side under its name (a point of a scale: its
 * kind, its value, its color); `visible`: whether the dialog shows it, by the
 * params as set (a point's value only for a number).
 */
type ParamCommon = { readonly label?: string; readonly line?: string; readonly visible?: (params: Params) => boolean };
export type ParamSpec = ParamCommon &
  (
    | { readonly kind: "number"; readonly integer?: boolean; readonly min?: number; readonly max?: number; readonly default?: number }
    | { readonly kind: "choice"; readonly values: readonly string[]; readonly labels?: readonly string[]; readonly default?: string }
    | { readonly kind: "text"; readonly default?: string }
    // Text in the filter row's syntax: plain words found anywhere, /regex/flags, =a|b, >10, !…
    | { readonly kind: "pattern"; readonly default?: string }
    // A formula of one row ([@due] < TODAY()): the dialog offers the functions and the table's columns as it is
    // typed, the function's syntax, and says where it does not read
    | { readonly kind: "formula"; readonly default?: string }
    | { readonly kind: "color"; readonly default?: Color }
    | { readonly kind: "boolean"; readonly default?: boolean }
    | { readonly kind: "style"; readonly default?: Style }
    // Rows of fields of their own, as many as the user adds (keywords and their styles)
    | { readonly kind: "list"; readonly of: ParamSpecs; readonly default?: readonly Readonly<Record<string, unknown>>[] }
  );

export type ParamSpecs = Readonly<Record<string, ParamSpec>>;

/** The parameters a definition gets, by key, read as their specs say */
export type Params = Readonly<Record<string, any>>;

/**
 * How Excel writes a condition (its .xlsx file's cfRule): its type, attributes and formulas, in Excel's
 * English, relative to the first cell of the rule's range (`at`, B2)
 */
export type ExcelTest = { readonly type: string; readonly attrs?: Readonly<Record<string, string>>; readonly formulas?: readonly string[] };

/** A point of a color scale in Excel: the smallest or largest value, a number, a percent of the range, a percentile */
export type ExcelPoint = { readonly type: "min" | "max" | "num" | "percent" | "percentile"; readonly value?: number; readonly color: Color };

/**
 * How Excel shows a format that has a look of its own (one with a `style` needs none: its style is the cell
 * format): tests of its own each with a style (keywords, ranges), a color scale, a data bar, an icon set
 */
export type ExcelLook =
  // A style of each formula (true for the cells it styles, relative to `at`): the first that holds styles a cell
  | { readonly kind: "rules"; readonly rules: readonly { readonly formula: string; readonly style: Style }[] }
  | { readonly kind: "colorScale"; readonly points: readonly ExcelPoint[] }
  | { readonly kind: "dataBar"; readonly color: Color }
  | { readonly kind: "iconSet"; readonly set: string };

/** What a condition and a format have in common */
type Definition = {
  // Letters, digits and _, starting with a letter: how rules store it
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  // Its group in the dialog's lists (Numbers, Text, Scales…; one of its own is a group too); none: Other, last
  readonly category?: string;
  readonly params?: ParamSpecs;
};

/** Which cells a rule formats */
export type ConditionDefinition<P = Params> = Definition & {
  test(cell: Cell, context: Context<P>): boolean;
  /** Its form in an Excel file, or why it has none (none given: not written) */
  excel?(params: P, at: string): ExcelTest | string;
};

/**
 * How the cells look: one `style` for every cell (or one made of the params),
 * or a `look` of each cell (undefined: as it is)
 */
export type FormatDefinition<P = Params> = Definition &
  (
    | { readonly style: Style | ((params: P) => Style); readonly look?: undefined; readonly excel?: undefined }
    | {
        readonly look: (cell: Cell, context: Context<P>) => Style | undefined;
        readonly style?: undefined;
        /** Its form in an Excel file, or why it has none (none given: not written) */
        readonly excel?: (params: P, at: string) => ExcelLook | string;
      }
  );

/** The helpers every definition gets (HELPERS in helpers.ts) */
export type Helpers = typeof HELPERS;

/** A built-in definition's form, as a user's file gives one: a function of the helpers */
export type Defined<T> = (helpers: Helpers) => T;
