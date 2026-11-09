// Tags: labels a document has, a list of texts each once (`[work, urgent]`),
// none of them an option to pick from: shown as quiet labels, filtered and
// sorted by their text joined by ", ". The system property Tags's (an item's
// page's tags): not offered for a property of the user's (a list to pick
// from is a multi-select).
import { isEmpty } from "../../../model/database.ts";
import { keptText, type PropertyType } from "../type.ts";

export const tags: PropertyType = {
  name: "tags",
  label: "Tags",
  offered: false,
  lists: true,
  look: "labels",
  validate: (value) => (isEmpty(value) || (Array.isArray(value) && value.every((one) => typeof one === "string")) ? undefined : "no list of tags"),
  text: keptText,
  parse: (typed) => {
    const parts = [...new Set(typed.split(",").map((one) => one.trim()).filter((one) => one !== ""))];
    return { value: parts.length ? parts : null };
  },
};
