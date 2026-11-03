// Charts of series over labels on two axes: bar, line, area, scatter. A
// series may say its own kind (a line over bars, as Mermaid's xychart has
// them; an area, points alone, steps).
import type { Axis, ChartModel, SeriesKind } from "../core/model.ts";
import type { ChartConfig, ChartType, Theme } from "../core/type.ts";
import { colorAt, icon, plugins, translucent, values } from "./common.ts";

function axis(theme: Theme, model: ChartModel, own: Axis | undefined, stacked: boolean): Record<string, unknown> {
  return {
    title: { display: !!own?.title, text: own?.title, color: theme.text, font: { family: theme.font } },
    ticks: { color: theme.text, font: { family: theme.font } },
    grid: { color: theme.grid },
    border: { color: theme.grid },
    stacked,
    ...(own?.min !== undefined ? { min: own.min } : {}),
    ...(own?.max !== undefined ? { max: own.max } : {}),
  };
}

/** A series drawn as its kind says, in Chart.js's terms: bars, or a line (filled for an area, without the line for points, stepped) */
function dataset(kind: SeriesKind, color: string, stacked: boolean, first: boolean, smooth: boolean): Record<string, unknown> {
  if (kind === "bar") return { type: "bar", backgroundColor: color, borderColor: color, order: 1 };
  return {
    type: "line",
    backgroundColor: kind === "area" ? translucent(color) : color,
    borderColor: color,
    fill: kind === "area" ? (stacked && !first ? "-1" : "origin") : false,
    tension: smooth && kind !== "step" ? 0.35 : 0,
    ...(kind === "point" ? { showLine: false, pointRadius: 4 } : {}),
    ...(kind === "step" ? { stepped: true } : {}),
    // Lines over bars
    order: 0,
  };
}

/** A chart of series on two axes, the base kind its series take where they say none */
function xyConfig(model: ChartModel, theme: Theme, base: SeriesKind): ChartConfig {
  const stacked = !!model.stacked;
  const datasets = model.series.map((series, i) => ({
    label: series.name ?? `Series ${i + 1}`,
    data: values(series.values),
    ...dataset(series.kind ?? base, colorAt(model, theme, i), stacked, i === 0, !!model.smooth),
  }));
  // The labels' axis and the values' axis: x and y, swapped for horizontal bars
  const [labels, valuesAxis] = model.horizontal ? (["y", "x"] as const) : (["x", "y"] as const);
  return {
    type: base === "bar" ? "bar" : "line",
    data: { labels: [...model.labels], datasets },
    options: {
      indexAxis: model.horizontal ? "y" : "x",
      maintainAspectRatio: false,
      plugins: plugins(model, theme, datasets.length),
      scales: { [labels]: axis(theme, model, model.x, stacked), [valuesAxis]: axis(theme, model, model.y, stacked) },
    },
  };
}

export const BAR: ChartType = {
  name: "bar",
  label: "Bar",
  icon: icon('<path d="M6 20V10M12 20V4M18 20v-7"/>'),
  config: (model, theme) => xyConfig(model, theme, "bar"),
  capabilities: ["series", "axes", "stacked", "horizontal"],
  kinds: ["bar", "line", "area", "point", "step"],
  variants: [
    { label: "Stacked bar", icon: icon('<path d="M6 20v-6M6 14v-4M12 20v-9M12 11V4M18 20v-4M18 16v-3"/><path d="M4 14h4M10 11h4M16 16h4"/>'), stacked: true },
    { label: "Horizontal bar", icon: icon('<path d="M4 6h10M4 12h16M4 18h7"/>'), horizontal: true },
  ],
};

export const LINE: ChartType = {
  name: "line",
  label: "Line",
  icon: icon('<path d="M3 17l6-6 4 4 8-8"/>'),
  config: (model, theme) => xyConfig(model, theme, "line"),
  capabilities: ["series", "axes", "stacked", "lines"],
  kinds: ["line", "bar", "area", "point", "step"],
};

export const AREA: ChartType = {
  name: "area",
  label: "Area",
  icon: icon('<path d="M3 17l6-6 4 4 8-8v13H3z"/>'),
  config: (model, theme) => xyConfig(model, theme, "area"),
  capabilities: ["series", "axes", "stacked", "lines"],
  kinds: ["area", "line", "bar", "point", "step"],
  variants: [{ label: "Stacked area", icon: icon('<path d="M3 20l6-5 4 3 8-6v8z"/><path d="M3 14l6-6 4 4 8-7"/>'), stacked: true }],
};

export const SCATTER: ChartType = {
  name: "scatter",
  label: "Scatter",
  icon: icon('<circle cx="7" cy="15" r="1.5"/><circle cx="11" cy="9" r="1.5"/><circle cx="16" cy="13" r="1.5"/><circle cx="19" cy="6" r="1.5"/>'),
  capabilities: ["series", "axes"],
  // The labels as numbers on the x axis, each series' values the points' y
  config: (model, theme) => {
    const xs = model.labels.map(Number);
    return {
      type: "scatter",
      data: {
        datasets: model.series.map((series, i) => ({
          label: series.name ?? `Series ${i + 1}`,
          data: series.values.map((y, j) => ({ x: xs[j], y })),
          backgroundColor: colorAt(model, theme, i),
          borderColor: colorAt(model, theme, i),
        })),
      },
      options: {
        maintainAspectRatio: false,
        plugins: plugins(model, theme, model.series.length),
        scales: { x: axis(theme, model, model.x, false), y: axis(theme, model, model.y, false) },
      },
    };
  },
};
