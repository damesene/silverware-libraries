import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize }: Helpers): ConditionDefinition<{ text: string }> => ({
  name: "notContains",
  label: "Text does not contain",
  description: "Cells whose text does not contain a text, case and diacritics ignored",
  params: { text: { kind: "text", label: "Text", default: "" } },
  test: (cell, { params }) => !normalize(cell.text).includes(normalize(params.text)),
});
