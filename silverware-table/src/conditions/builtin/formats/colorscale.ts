import type { Color, FormatDefinition, Helpers, Params, Scope } from "../../api.ts";

// What a point of the scale is: the smallest or largest value, a number, a percent of the range, a percentile; the midpoint none
type Point = "min" | "max" | "none" | "number" | "percent" | "percentile";

type ScaleParams = {
  readonly minType: Point;
  readonly minValue: number;
  readonly minColor: Color;
  readonly midType: Point;
  readonly midValue: number;
  readonly midColor: Color;
  readonly maxType: Point;
  readonly maxValue: number;
  readonly maxColor: Color;
};

/** Where a point is among the numbers (undefined: none, or no numbers) */
const pointAt = (scope: Scope, type: Point, value: number | undefined): number | undefined => {
  const { min, max } = scope;
  if (min === undefined || max === undefined) return undefined;
  switch (type) {
    case "min":
      return min;
    case "max":
      return max;
    case "number":
      return value;
    case "percent":
      return value === undefined ? undefined : min + ((max - min) * value) / 100;
    case "percentile":
      return value === undefined ? undefined : scope.percentile(value);
    default:
      return undefined;
  }
};

// A point's kinds, its own end first (Min value, Max value; None for the midpoint)
const kinds = (own: "min" | "max" | "none") => ({
  values: [own, "number", "percent", "percentile"],
  labels: [own === "min" ? "Min value" : own === "max" ? "Max value" : "None", "Number", "Percent", "Percentile"],
});
// A point's value: asked for a number, a percent or a percentile only
const valued = (key: string) => (params: Params) => params[key] === "number" || params[key] === "percent" || params[key] === "percentile";

export default ({ palette, mix }: Helpers): FormatDefinition<ScaleParams> => ({
  name: "colorScale",
  label: "Color scale",
  description:
    "A fill along two or three colors: at the minpoint, the midpoint (or none) and the maxpoint, each the smallest or largest value, a number, a percent of the range or a percentile; a cell past a point has its color",
  params: {
    minType: { kind: "choice", line: "Minpoint", label: "Minpoint", ...kinds("min"), default: "min" },
    minValue: { kind: "number", line: "Minpoint", label: "Minpoint's value", default: 0, visible: valued("minType") },
    minColor: { kind: "color", line: "Minpoint", label: "Minpoint's color", default: palette.red },
    midType: { kind: "choice", line: "Midpoint", label: "Midpoint", ...kinds("none"), default: "percentile" },
    midValue: { kind: "number", line: "Midpoint", label: "Midpoint's value", default: 50, visible: valued("midType") },
    midColor: { kind: "color", line: "Midpoint", label: "Midpoint's color", default: palette.yellow, visible: (p) => p.midType !== "none" },
    maxType: { kind: "choice", line: "Maxpoint", label: "Maxpoint", ...kinds("max"), default: "max" },
    maxValue: { kind: "number", line: "Maxpoint", label: "Maxpoint's value", default: 100, visible: valued("maxType") },
    maxColor: { kind: "color", line: "Maxpoint", label: "Maxpoint's color", default: palette.green },
  },
  look: (cell, { scope, params }) => {
    const n = cell.number;
    const low = pointAt(scope, params.minType, params.minValue);
    const high = pointAt(scope, params.maxType, params.maxValue);
    if (n === undefined || low === undefined || high === undefined) return undefined;
    const mid = params.midType === "none" ? undefined : pointAt(scope, params.midType, params.midValue);
    // How far n is from a to b, 0 to 1 (past either end: that end)
    const along = (a: number, b: number) => (b === a ? (n >= b ? 1 : 0) : Math.min(1, Math.max(0, (n - a) / (b - a))));
    if (mid === undefined || mid <= low || mid >= high) return { fill: mix([params.minColor, params.maxColor], along(low, high)) };
    return n <= mid ? { fill: mix([params.minColor, params.midColor], along(low, mid)) } : { fill: mix([params.midColor, params.maxColor], along(mid, high)) };
  },
});
