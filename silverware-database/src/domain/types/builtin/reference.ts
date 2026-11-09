// Reference: other documents of the space (in SilverBullet its pages), one
// or several, each a wiki link in a list (`[[Projects/Alpha]]`,
// domain/types/reference.ts), so the space keeps them as links: listed on
// the documents they name, renamed with them. Picked from the space's
// documents, shown as links that open them; filtered and sorted by their
// names, joined by ", "; grouped by the document each names, whatever text
// its link shows.
import { isEmpty } from "../../../model/database.ts";
import { readReference, readReferences, typedReferences, writeReference } from "../reference.ts";
import { keptText, type PropertyType } from "../type.ts";

export const reference: PropertyType = {
  name: "reference",
  label: "Reference",
  editor: "documents",
  look: "documents",
  lists: true,
  validate: (value) => {
    if (isEmpty(value)) return undefined;
    const read = readReferences(value);
    if (!read) return "no list of links ([[Name]])";
    return new Set(read.map((one) => one.target)).size === read.length ? undefined : "one named twice";
  },
  text: (value) => readReferences(value)?.map((one) => one.text ?? one.target).join(", ") ?? keptText(value),
  // (A link by the document it names: `[[B|bee]]` in the group of `[[B]]`)
  groupValue: (value) => {
    const one = typeof value === "string" ? readReference(value) : undefined;
    return one ? writeReference(one.target) : value;
  },
  parse: (typed) => {
    const read = typedReferences(typed);
    if ("problem" in read) return read;
    return { value: read.written.length ? [...read.written] : null };
  },
};
