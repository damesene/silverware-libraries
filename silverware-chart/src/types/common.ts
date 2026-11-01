// What the built-in types share: colors by place, the title and the legend,
// as Chart.js takes them.
import type { ChartModel } from "../core/model.ts";
import type { Theme } from "../core/type.ts";

/** The color of the series (or slice) at `index`: the model's, else the theme's palette */
export function colorAt(model: ChartModel, theme: Theme, index: number): string {
  const colors = model.colors?.length ? model.colors : theme.palette;
  return colors[index % colors.length] ?? "#888";
}

/** A color a little transparent (an area's fill), where it is written #rgb or #rrggbb; else as it is */
export function translucent(color: string, alpha = 0.33): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return color;
  const digits = hex[1] ?? "";
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join("") : digits;
  return `#${full}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

/** The plugins' options every type has: the title, the legend (shown by default where there is more than one thing to tell apart) */
export function plugins(model: ChartModel, theme: Theme, items: number, place: "top" | "right" = "top"): Record<string, unknown> {
  const legend = model.legend ?? place;
  return {
    title: { display: !!model.title, text: model.title, color: theme.text, font: { family: theme.font, size: 14 } },
    // In the series' order (Chart.js sorts it by their drawing order: lines over bars)
    legend: { display: legend !== "none" && items > 1, position: legend === "none" ? place : legend, labels: { color: theme.text, font: { family: theme.font }, sort: (a: { datasetIndex: number }, b: { datasetIndex: number }) => a.datasetIndex - b.datasetIndex } },
  };
}

/** A series' values as Chart.js draws them (no value: a gap) */
export const values = (list: readonly (number | null)[]): (number | null)[] => [...list];

/** A line icon, 16 px, in the text's color */
export const icon = (paths: string): string =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
