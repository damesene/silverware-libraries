import type { FormatDefinition, Helpers, Style } from "../../api.ts";

export default ({ matches, palette, excelFilter }: Helpers): FormatDefinition<{ rows: readonly { pattern: string; style: Style }[] }> => ({
  name: "byPattern",
  label: "By keywords",
  category: "By values",
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
  // A rule for each keyword: its filter syntax as a formula (plain words by SEARCH, a regular expression by REGEXTEST)
  excel: (params, at) => ({
    kind: "rules",
    rules: params.rows.flatMap((row) => {
      const pattern = row.pattern.trim();
      const formula = excelFilter(pattern, at);
      return formula ? [{ formula, style: row.style }] : [];
    }),
  }),
});
