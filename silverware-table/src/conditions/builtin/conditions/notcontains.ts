import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize, excelText }: Helpers): ConditionDefinition<{ text: string }> => ({
  name: "notContains",
  label: "Text does not contain",
  description: "Cells whose text does not contain a text, case and diacritics ignored",
  params: { text: { kind: "text", label: "Text", default: "" } },
  test: (cell, { params }) => !normalize(cell.text).includes(normalize(params.text)),
  excel: (params, at) => ({ type: "notContainsText", attrs: { operator: "notContains", text: params.text }, formulas: [`ISERROR(SEARCH(${excelText(params.text)},${at}))`] }),
});
