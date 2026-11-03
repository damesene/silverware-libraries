import type { FormatDefinition, Helpers, Style } from "../../api.ts";

export default ({ palette }: Helpers): FormatDefinition<{ rows: readonly { from?: number; to?: number; style: Style }[] }> => ({
  name: "byRange",
  label: "By number ranges",
  category: "By values",
  description: "A style for each range of numbers (from, up to but not including to; either end left open); the first range a cell's number is in styles it",
  params: {
    rows: {
      kind: "list",
      label: "Ranges",
      of: { from: { kind: "number", label: "From" }, to: { kind: "number", label: "To" }, style: { kind: "style", label: "Style", default: { fill: palette.yellow } } },
      default: [
        { to: 50, style: { fill: palette.red } },
        { from: 50, to: 80, style: { fill: palette.yellow } },
        { from: 80, style: { fill: palette.green } },
      ],
    },
  },
  look: (cell, { params }) => {
    const n = cell.number;
    if (n === undefined) return undefined;
    return params.rows.find((row) => (row.from === undefined || n >= row.from) && (row.to === undefined || n < row.to))?.style;
  },
  excel: (params, at) => ({
    kind: "rules",
    rules: params.rows.map((row) => ({
      formula: `AND(ISNUMBER(${at})${row.from !== undefined ? `,${at}>=${row.from}` : ""}${row.to !== undefined ? `,${at}<${row.to}` : ""})`,
      style: row.style,
    })),
  }),
});
