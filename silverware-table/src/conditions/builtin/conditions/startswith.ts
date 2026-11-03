import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize, excelText }: Helpers): ConditionDefinition<{ text: string }> => ({
  name: "startsWith",
  label: "Text starts with",
  description: "Cells whose text starts with a text, case and diacritics ignored",
  params: { text: { kind: "text", label: "Text", default: "" } },
  test: (cell, { params }) => normalize(cell.text).startsWith(normalize(params.text)),
  excel: (params, at) => ({ type: "beginsWith", attrs: { operator: "beginsWith", text: params.text }, formulas: [`LEFT(${at},LEN(${excelText(params.text)}))=${excelText(params.text)}`] }),
});
