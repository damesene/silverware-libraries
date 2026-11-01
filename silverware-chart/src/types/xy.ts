// Charts of series over labels on two axes: bar, line, area, scatter. A
// series may say its own kind (bars with a line over them, as Mermaid's
// xychart has them).
import type { Axis, ChartModel } from "../core/model.ts";
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

/** A chart of bars and lines, the base kind its series take where they say none */
function xyConfig(model: ChartModel, theme: Theme, base: "bar" | "line", fill: boolean): ChartConfig {
  const stacked = !!model.stacked;
  const datasets = model.series.map((series, i) => {
    const color = colorAt(model, theme, i);
    const kind = series.kind ?? base;
    return {
      type: kind,
      label: series.name ?? `Series ${i + 1}`,
      data: values(series.values),
      backgroundColor: kind === "line" ? translucent(color) : color,
      borderColor: color,
      fill: kind === "line" && fill ? (stacked && i > 0 ? "-1" : "origin") : false,
      tension: model.smooth ? 0.35 : 0,
      // Lines over bars
      order: kind === "line" ? 0 : 1,
    };
  });
  // The labels' axis and the values' axis: x and y, swapped for horizontal bars
  const [labels, valuesAxis] = model.horizontal ? (["y", "x"] as const) : (["x", "y"] as const);
  return {
    type: base,
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
  config: (model, theme) => xyConfig(model, theme, "bar", false),
};

export const LINE: ChartType = {
  name: "line",
  label: "Line",
  icon: icon('<path d="M3 17l6-6 4 4 8-8"/>'),
  config: (model, theme) => xyConfig(model, theme, "line", false),
};

export const AREA: ChartType = {
  name: "area",
  label: "Area",
  icon: icon('<path d="M3 17l6-6 4 4 8-8v13H3z"/>'),
  config: (model, theme) => xyConfig(model, theme, "line", true),
};

export const SCATTER: ChartType = {
  name: "scatter",
  label: "Scatter",
  icon: icon('<circle cx="7" cy="15" r="1.5"/><circle cx="11" cy="9" r="1.5"/><circle cx="16" cy="13" r="1.5"/><circle cx="19" cy="6" r="1.5"/>'),
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
