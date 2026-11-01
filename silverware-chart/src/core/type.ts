// A type of chart (bar, line, pie…): how Chart.js draws a model of it. The
// built-in ones are a module's (types/), the core knows none of them.
import type { ChartModel } from "./model.ts";

/** What a chart's colors and text are drawn with: SilverBullet's look, read as the chart is made */
export type Theme = {
  readonly text: string;
  readonly grid: string;
  readonly font: string;
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
};
