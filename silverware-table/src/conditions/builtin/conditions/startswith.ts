import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize, excelText }: Helpers): ConditionDefinition<{ text: string }> => ({
  name: "startsWith",
  label: "Text starts with",
  category: "Text",
  description: "Cells whose text starts with a text, case and diacritics ignored",
  params: { text: { kind: "text", label: "Text", default: "" } },
  test: (cell, { params }) => params.text !== "" && normalize(cell.text).startsWith(normalize(params.text)),
  excel: (params, at) => (params.text === "" ? "an empty text picks no cells" : { type: "beginsWith", attrs: { operator: "beginsWith", text: params.text }, formulas: [`LEFT(${at},LEN(${excelText(params.text)}))=${excelText(params.text)}`] }),
});
