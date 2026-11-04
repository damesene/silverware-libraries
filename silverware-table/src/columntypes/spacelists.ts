// Lists of the choice column type for the whole space: given by Space Lua
// (`silverware.table.defineChoices`, spacechoices.ts runs them), each by its
// name, as a table keeps its own (choicelists.ts). A column naming one
// (`#choice-projects`) takes it where its table keeps no list of that name.
// The column types module hands them to the choice type (TypeTable.spaceList).

let lists = new Map<string, readonly string[]>();
// The names defined, read or not yet (a list is known as the space's before its function has given it)
let defined = new Set<string>();

/** The values of the space's list of that name (lower case), as last read; undefined: none, or not read yet */
export function spaceList(name: string): readonly string[] | undefined {
  return lists.get(name);
}

/** The names of the space's lists, those defined and not read yet too, in the alphabet's order */
export function spaceListNames(): string[] {
  return [...new Set([...defined, ...lists.keys()])].sort();
}

/** The names Space Lua defines lists by (their values given later, `setSpaceLists`) */
export function setSpaceListNames(names: Iterable<string>): void {
  defined = new Set(names);
}

/** The space's lists as now read; whether any differs from before */
export function setSpaceLists(next: ReadonlyMap<string, readonly string[]>): boolean {
  const same =
    next.size === lists.size &&
    [...next].every(([name, values]) => {
      const was = lists.get(name);
      return was !== undefined && was.length === values.length && was.every((v, i) => v === values[i]);
    });
  if (!same) lists = new Map(next);
  return !same;
}
