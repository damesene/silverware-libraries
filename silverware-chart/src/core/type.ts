// A type of chart (bar, line, pie…): how Chart.js draws a model of it. The
// built-in ones are a module's (types/), the core knows none of them.
import type { ChartModel, SeriesKind } from "./model.ts";
import type { Setting } from "./setting.ts";

/** What a chart's colors and text are drawn with: SilverBullet's look, read as the chart is made */
export type Theme = {
  readonly text: string;
  readonly grid: string;
  readonly font: string;
  // The size of a chart's text (px): its labels, ticks and legend; a title a little larger. In proportion to the
  // page's text, so a chart follows its font as it is set larger or smaller (Chart.js's 12 px by SilverBullet's 18)
  readonly fontSize: number;
  // A series' (or a slice's) color by its place, where the model gives none
  readonly palette: readonly string[];
};

/** Chart.js's configuration ({ type, data, options }), as plain data: the core hands it over as it is */
export type ChartConfig = {
  readonly type: string;
  readonly data: { labels?: unknown[]; datasets: Record<string, unknown>[] };
  readonly options?: Record<string, unknown>;
};

export type ChartType = {
  // The model's `type` it draws (letters, digits)
  readonly name: string;
  readonly label: string;
  // A line icon (an SVG), for the menu's gallery
  readonly icon: string;
  readonly config: (model: ChartModel, theme: Theme) => ChartConfig;
  // Its kinds the menu offers apart (stacked bars, horizontal bars): the model's flags set for each
  readonly variants?: readonly { readonly label: string; readonly icon: string; readonly stacked?: boolean; readonly horizontal?: boolean }[];
  // What it has, which settings ask for (`needs`): series, slices, axes, stacked, horizontal, lines
  readonly capabilities?: readonly string[];
  // How many series it draws (a pie one): of a source's columns the first so many; left out: any
  readonly seriesLimit?: number;
  // How its series may be drawn among each other (its own kind first); left out: as it draws them
  readonly kinds?: readonly SeriesKind[];
  // Settings of its own, shown with the common ones
  readonly settings?: readonly Setting[];
};
