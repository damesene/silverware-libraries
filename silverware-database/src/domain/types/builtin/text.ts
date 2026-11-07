// Text: any text, as typed (only spaces: empty, as the other types read it).
import { isEmpty } from "../../../model/database.ts";
import { keptText, type PropertyType } from "../type.ts";

export const text: PropertyType = {
  name: "text",
  label: "Text",
  validate: (value) => (isEmpty(value) || typeof value === "string" ? undefined : "no text"),
  text: keptText,
  parse: (typed) => ({ value: typed.trim() === "" ? null : typed }),
};
