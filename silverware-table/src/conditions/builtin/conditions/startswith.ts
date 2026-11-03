import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize }: Helpers): ConditionDefinition<{ text: string }> => ({
  name: "startsWith",
  label: "Text starts with",
  description: "Cells whose text starts with a text, case and diacritics ignored",
  params: { text: { kind: "text", label: "Text", default: "" } },
  test: (cell, { params }) => normalize(cell.text).startsWith(normalize(params.text)),
});
