import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize, excelSearchText }: Helpers): ConditionDefinition<{ text: string }> => ({
  name: "contains",
  label: "Text contains",
  category: "Text",
  description: "Cells whose text contains a text, case and diacritics ignored",
  params: { text: { kind: "text", label: "Text", default: "" } },
  test: (cell, { params }) => params.text !== "" && normalize(cell.text).includes(normalize(params.text)),
  excel: (params, at) => (params.text === "" ? "an empty text picks no cells" : { type: "containsText", attrs: { operator: "containsText", text: params.text }, formulas: [`NOT(ISERROR(SEARCH(${excelSearchText(params.text)},${at})))`] }),
});
