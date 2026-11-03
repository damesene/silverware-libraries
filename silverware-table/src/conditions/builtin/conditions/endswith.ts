import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize, excelText }: Helpers): ConditionDefinition<{ text: string }> => ({
  name: "endsWith",
  label: "Text ends with",
  category: "Text",
  description: "Cells whose text ends with a text, case and diacritics ignored",
  params: { text: { kind: "text", label: "Text", default: "" } },
  test: (cell, { params }) => params.text !== "" && normalize(cell.text).endsWith(normalize(params.text)),
  excel: (params, at) => (params.text === "" ? "an empty text picks no cells" : { type: "endsWith", attrs: { operator: "endsWith", text: params.text }, formulas: [`RIGHT(${at},LEN(${excelText(params.text)}))=${excelText(params.text)}`] }),
});
