// The model of a chart: what a format reads from its block and writes back,
// and what everything else (drawing, sources, the menu) works on. It knows no
// format: Mermaid's comments and Obsidian Charts' keys are their formats' own.

/** How a series is drawn among others on the same axes: bars, a line, an area, points alone, steps */
export const SERIES_KINDS = ["bar", "line", "area", "point", "step"] as const;
export type SeriesKind = (typeof SERIES_KINDS)[number];

/** One series of values, by the labels' order (null: no value there) */
export type Series = {
  readonly name?: string;
  // Drawn so among the chart's other series (left out: as the chart's type draws its series)
  readonly kind?: SeriesKind;
  readonly values: readonly (number | null)[];
};

/** How a type of chart draws a series that says no kind of its own (undefined: a type that has no kinds, a pie) */
export function baseKind(type: string): SeriesKind | undefined {
  return type === "bar" || type === "line" || type === "area" ? type : undefined;
}

export type Axis = {
  readonly title?: string;
  readonly min?: number;
  readonly max?: number;
};

/**
 * Where the chart's data come from instead of the block: a named table
 * (`sales`, `[[Page]]sales` on another page), its labels' column and its
 * values' columns, by their names as formulas read them
 */
export type Source = {
  readonly table: string;
  // The column whose cells label the values (not an axis: horizontal bars have them on y)
  readonly labels?: string;
  readonly series: readonly string[];
  // Only the rows where every condition holds (a column, and a criterion as Excel's -IFS functions write it: "> 100", "done", "<>", "app*")
  readonly where?: readonly Condition[];
  // Of those, only the first or the last so many
  readonly rows?: RowsTaken;
};

export type Condition = { readonly column: string; readonly criterion: string };
export type RowsTaken = { readonly from: "first" | "last"; readonly count: number };

export const LEGEND_PLACES = ["top", "bottom", "left", "right", "none"] as const;
export type LegendPlace = (typeof LEGEND_PLACES)[number];

export type ChartModel = {
  // The chart type's name (the registry's: bar, line, area, pie, doughnut…)
  readonly type: string;
  readonly title?: string;
  readonly labels: readonly string[];
  readonly series: readonly Series[];
  readonly x?: Axis;
  readonly y?: Axis;
  // Bars along the y axis
  readonly horizontal?: boolean;
  // Series stacked on each other
  readonly stacked?: boolean;
  // Lines curved through their points
  readonly smooth?: boolean;
  readonly colors?: readonly string[];
  readonly legend?: LegendPlace;
  // The chart's height as CSS has it (280px, 20em)
  readonly height?: string;
  readonly source?: Source;
  // What the format read that the model has no field for, kept so it is written back as it was (by key)
  readonly extra?: Readonly<Record<string, string>>;
  // Silverware Layout's entries (shared/layout.ts: `width`), kept by the format as it can (Mermaid: `%% layout.<key>`),
  // never read here: a format without a place for them drops them, and a write of them says so
  readonly layout?: Readonly<Record<string, string>>;
};

/**
 * A block a format knows as its chart but cannot read, or a source that
 * cannot be read: why, shown in its place; `choices` the sources the chart
 * could have instead (a column renamed by hand: the table's columns), offered
 * there to write into the block
 */
export type Unreadable = { readonly problem: string; readonly choices?: readonly { readonly label: string; readonly source: Source }[] };

export function isUnreadable(value: unknown): value is Unreadable {
  return !!value && typeof value === "object" && typeof (value as Unreadable).problem === "string";
}
