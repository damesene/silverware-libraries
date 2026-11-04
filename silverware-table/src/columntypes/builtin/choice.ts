import { lineIcon } from "../../icons.ts";
import { choiceIndex, distinctValues, LIST_NAME_RE, listKey, readChoiceList } from "../choicelists.ts";
import { columnType, type TypeTable } from "../type.ts";

/**
 * The values of the list a column names: as its table keeps them, else the
 * space's list of that name (Space Lua's, as last read); undefined: none (no
 * name, or no such list, or the space's not read yet)
 */
function listOf(name: string | undefined, table: TypeTable | undefined): readonly string[] | undefined {
  if (name === undefined || !table) return undefined;
  const key = name.toLowerCase();
  return readChoiceList(table.stored.get(listKey(key))) ?? table.spaceList(key);
}

export default columnType({
  name: "choice",
  syntax: "#choice, #choice-name",
  description:
    "One of a list's values: the list named after the dash, kept in the table (picking Choice opens a dialog to set it up) or given by Space Lua for the whole space. A value not in the list is marked, and the column sorts in the list's order. Without a list the editor offers the values the column has.",
  icon: lineIcon('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>'),
  // A column of a list: the list in a box, as kept in the table
  iconFor: ({ name }) => (name === undefined ? undefined : lineIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M10 8h7M10 12h7M10 16h7"/><path d="M7 8h.01M7 12h.01M7 16h.01" stroke-width="3"/>')),
  params: { name: { kind: "text", pattern: new RegExp(LIST_NAME_RE.source, "i") } },
  check: (text, { name }, table) => {
    const list = listOf(name, table);
    return !list || choiceIndex(list, text) >= 0 ? undefined : `"${text}" is not one of the choices of ${name!.toLowerCase()}`;
  },
  format: (text) => text,
  // Its place in the list; a value not in it after them all
  rank: (text, { name }, table) => {
    const list = listOf(name, table);
    if (!list) return undefined;
    const index = choiceIndex(list, text);
    return index < 0 ? list.length : index;
  },
  // The list's values in order; without one the column's values, each once, in the alphabet's order
  choices: ({ name }, table) => (listOf(name, table) ?? distinctValues(table?.values() ?? [])).map((value) => ({ value, label: value })),
});
