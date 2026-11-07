// Custom menu entries (`silverware.table.defineMenuEntries`): the user's or
// another plugin's, each a name and its `lineMenu(context, menu)` giving
// groups of entries for a row's or a column's menu, as a module's lineMenu
// does (Feature.lineMenu; `menu` the same builder, its slots and entries).
// Checked as they are defined (a list, or a module whose default export is
// one); what a lineMenu gives is checked as it is called (the customMenus
// module). The calls of one load of Space Lua add up (a plugin's and the
// user's alike), a name given again replacing its definition; a load of
// Space Lua anew starts them over, those of before kept until its first call.
import type { LineMenuBuilder, LineMenuGroup } from "../core/feature.ts";
import type { TableData } from "../tabledata.ts";

/** What a definition's entries are for: the menu's line and its table, as data */
export type MenuEntriesContext = {
  readonly axis: "row" | "column";
  // The line of the menu: a row's place in the markdown (the header 0, so table.rows[at - 1]), or a column's (0 first)
  readonly at: number;
  // The lines its actions act on: the lines selected whole that hold it, else it alone
  readonly lines: readonly number[];
  // The page shown, the table's
  readonly page: string;
  readonly table: TableData;
};

export type MenuEntriesDefinition = {
  readonly name: string;
  readonly lineMenu: (context: MenuEntriesContext, menu: LineMenuBuilder) => readonly LineMenuGroup[];
};

const NAME_RE = /^[a-z][a-z0-9_-]*$/i;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Why a definition is none; undefined: it is one */
function validateDefinition(d: unknown): string | undefined {
  if (!isObject(d)) return "is no definition (an object with a name and a lineMenu)";
  if (typeof d.name !== "string" || !NAME_RE.test(d.name)) return "has no name (letters, digits, - and _, starting with a letter)";
  if (typeof d.lineMenu !== "function") return `${d.name}: has no lineMenu(context, menu)`;
  return undefined;
}

/** The definitions given (a module, a list), checked: those that are ones, and what is wrong with the others */
export function customMenuEntries(definitions: unknown): { readonly list: MenuEntriesDefinition[]; readonly problems: string[] } {
  let list = definitions;
  if (isObject(list) && !Array.isArray(list) && "default" in list) list = list.default;
  if (!Array.isArray(list)) return { list: [], problems: ["the definitions are not a list of menu entries' definitions"] };
  const out: MenuEntriesDefinition[] = [];
  const problems: string[] = [];
  for (const d of list) {
    const problem = validateDefinition(d);
    if (problem) problems.push(problem);
    else out.push(d as MenuEntriesDefinition);
  }
  return { list: out, problems };
}

let custom = new Map<string, MenuEntriesDefinition>();
let anew = false;

/** The definitions added (a name given again replaces its definition) */
export function defineCustomMenuEntries(list: readonly MenuEntriesDefinition[]): void {
  custom = new Map([...(anew ? [] : custom), ...list.map((d) => [d.name, d] as const)]);
  anew = false;
}

/** Space Lua is loaded again: the definitions are made anew by its first call, those of before kept until then */
export function customMenuEntriesAnew(): void {
  anew = true;
}

/** Forgets every definition (tests) */
export function clearCustomMenuEntries(): void {
  custom = new Map();
  anew = false;
}

/** The definitions, as they were added */
export function menuEntriesDefinitions(): readonly MenuEntriesDefinition[] {
  return [...custom.values()];
}
