// Charts of one series as parts of a whole, a label each: pie, doughnut,
// polar area; and the radar, its labels round a circle.
import type { ChartModel } from "../core/model.ts";
import type { ChartConfig, ChartType, Theme } from "../core/type.ts";
import { colorAt, icon, plugins, translucent, values } from "./common.ts";

/** The first series' values, a slice per label, each its own color */
function roundConfig(model: ChartModel, theme: Theme, type: string): ChartConfig {
  const series = model.series[0] ?? { values: [] };
  return {
    type,
    data: {
      labels: [...model.labels],
      datasets: [
        {
          label: series.name,
          data: values(series.values),
          backgroundColor: model.labels.map((_, i) => (type === "polarArea" ? translucent(colorAt(model, theme, i), 0.6) : colorAt(model, theme, i))),
          borderColor: theme.grid,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: plugins(model, theme, model.labels.length, "right"),
      ...(type === "polarArea" ? { scales: { r: { grid: { color: theme.grid }, ticks: { color: theme.text, backdropColor: "transparent" } } } } : {}),
    },
  };
}

export const PIE: ChartType = {
  name: "pie",
  label: "Pie",
  icon: icon('<path d="M12 3v9h9"/><circle cx="12" cy="12" r="9"/>'),
  config: (model, theme) => roundConfig(model, theme, "pie"),
  capabilities: ["slices"],
};

export const DOUGHNUT: ChartType = {
  name: "doughnut",
  label: "Doughnut",
  icon: icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5"/>'),
  config: (model, theme) => roundConfig(model, theme, "doughnut"),
  capabilities: ["slices"],
};

export const POLAR_AREA: ChartType = {
  name: "polarArea",
  label: "Polar area",
  icon: icon('<circle cx="12" cy="12" r="9"/><path d="M12 12l6-6M12 12l-4 7M12 12H4"/>'),
  config: (model, theme) => roundConfig(model, theme, "polarArea"),
  capabilities: ["slices"],
};

export const RADAR: ChartType = {
  name: "radar",
  label: "Radar",
  icon: icon('<path d="M12 3l8 6-3 10H7L4 9z"/><path d="M12 8l4 3-1 4H9l-1-4z"/>'),
  capabilities: ["series", "lines"],
  // Each series a closed line round the labels
  config: (model, theme) => ({
    type: "radar",
    data: {
      labels: [...model.labels],
      datasets: model.series.map((series, i) => ({
        label: series.name ?? `Series ${i + 1}`,
        data: values(series.values),
        backgroundColor: translucent(colorAt(model, theme, i), 0.2),
        borderColor: colorAt(model, theme, i),
      })),
    },
    options: {
      maintainAspectRatio: false,
      plugins: plugins(model, theme, model.series.length),
      scales: { r: { grid: { color: theme.grid }, angleLines: { color: theme.grid }, pointLabels: { color: theme.text }, ticks: { color: theme.text, backdropColor: "transparent" } } },
    },
  }),
};
