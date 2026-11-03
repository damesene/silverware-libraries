import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize }: Helpers): ConditionDefinition<{ text: string }> => ({
  name: "endsWith",
  label: "Text ends with",
  description: "Cells whose text ends with a text, case and diacritics ignored",
  params: { text: { kind: "text", label: "Text", default: "" } },
  test: (cell, { params }) => normalize(cell.text).endsWith(normalize(params.text)),
});
