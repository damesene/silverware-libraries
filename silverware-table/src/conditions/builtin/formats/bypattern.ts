import type { FormatDefinition, Helpers, Style } from "../../api.ts";

export default ({ matches, palette }: Helpers): FormatDefinition<{ rows: readonly { pattern: string; style: Style }[] }> => ({
  name: "byPattern",
  label: "By keywords",
  description: "A style for each keyword or pattern (as a filter takes them: words found anywhere, /regular expression/, =a|b); the first that matches a cell styles it",
  params: {
    rows: {
      kind: "list",
      label: "Keywords",
      of: { pattern: { kind: "pattern", label: "Keyword or pattern", default: "" }, style: { kind: "style", label: "Style", default: { fill: palette.yellow } } },
      default: [
        { pattern: "done", style: { fill: palette.green, color: palette.green } },
        { pattern: "blocked", style: { fill: palette.red, color: palette.red } },
      ],
    },
  },
  look: (cell, { params }) => params.rows.find((row) => row.pattern.trim() !== "" && matches(row.pattern)(cell.text))?.style,
});
