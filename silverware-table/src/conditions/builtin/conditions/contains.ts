import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize, excelText }: Helpers): ConditionDefinition<{ text: string }> => ({
  name: "contains",
  label: "Text contains",
  description: "Cells whose text contains a text, case and diacritics ignored",
  params: { text: { kind: "text", label: "Text", default: "" } },
  test: (cell, { params }) => params.text !== "" && normalize(cell.text).includes(normalize(params.text)),
  excel: (params, at) => ({ type: "containsText", attrs: { operator: "containsText", text: params.text }, formulas: [`NOT(ISERROR(SEARCH(${excelText(params.text)},${at})))`] }),
});
