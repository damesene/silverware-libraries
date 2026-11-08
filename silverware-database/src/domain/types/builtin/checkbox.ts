// Checkbox: ticked or not, so no empty value of its own: unticked is false,
// and an item without the property reads unticked. Typed as true / false,
// yes / no, 1 / 0, x.
import { isEmpty } from "../../../model/database.ts";
import { keptText, type PropertyType } from "../type.ts";

const TICKED = new Set(["true", "yes", "1", "x"]);
const CLEAR = new Set(["false", "no", "0"]);

export const checkbox: PropertyType = {
  name: "checkbox",
  label: "Checkbox",
  editor: "toggle",
  look: "check",
  validate: (value) => (isEmpty(value) || typeof value === "boolean" ? undefined : "neither ticked nor not"),
  text: (value) => (typeof value === "boolean" ? String(value) : isEmpty(value) ? "false" : keptText(value)),
  parse: (typed) => {
    const word = typed.trim().toLowerCase();
    if (word === "") return { value: false };
    if (TICKED.has(word)) return { value: true };
    if (CLEAR.has(word)) return { value: false };
    return { problem: `"${typed.trim()}" is neither true nor false` };
  },
};
