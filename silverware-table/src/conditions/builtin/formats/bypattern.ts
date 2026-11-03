import type { FormatDefinition, Helpers, Style } from "../../api.ts";

export default ({ matches, palette, excelText, plainPattern }: Helpers): FormatDefinition<{ rows: readonly { pattern: string; style: Style }[] }> => ({
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
  excel: (params, at) => {
    const rows = params.rows.filter((row) => row.pattern.trim() !== "");
    if (rows.some((row) => !plainPattern(row.pattern))) return "a keyword written as a pattern (a regular expression, =a|b, >10, !…) has no Excel form";
    return {
      kind: "rules",
      rules: rows.map((row) => ({
        test: { type: "containsText", attrs: { operator: "containsText", text: row.pattern.trim() }, formulas: [`NOT(ISERROR(SEARCH(${excelText(row.pattern.trim())},${at})))`] },
        style: row.style,
      })),
    };
  },
});
