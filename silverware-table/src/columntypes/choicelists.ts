// The lists of the choice column type (builtin/choice.ts): a table keeps each
// in its metadata row by its name, a JSON list of texts
// (`columntypes.choice.status='["open","in progress","done"]'`), a column
// names the one it takes in its hashtag (`#choice-status`). Pure: the column
// types module reads and writes them through its host.

/** What a list's name may be: lower case ASCII letters and digits, words joined by single dashes, starting with a letter */
export const LIST_NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** The key of a list's name in the choice type's data in a table (ModelHost.setMeta) */
export function listKey(name: string): string {
  return `choice.${name}`;
}

/** The names of the lists a table keeps, from its column types' data (ModelHost.metaOf), in the order written */
export function listNames(stored: ReadonlyMap<string, string>): string[] {
  return [...stored.keys()].filter((key) => key.startsWith("choice.")).map((key) => key.slice("choice.".length));
}

// Lists read, by their text: a table's looks read the same lists for every cell
const read = new Map<string, readonly string[] | undefined>();

/** A list's values as stored, or undefined where it is not a list of texts */
export function readChoiceList(text: string | undefined): readonly string[] | undefined {
  if (text === undefined) return undefined;
  if (read.has(text)) return read.get(text);
  let list: readonly string[] | undefined;
  try {
    const value: unknown = JSON.parse(text);
    list = Array.isArray(value) && value.every((v) => typeof v === "string") ? value : undefined;
  } catch {
    list = undefined;
  }
  if (read.size > 200) read.clear();
  read.set(text, list);
  return list;
}

/** A list's values as stored */
export function writeChoiceList(values: readonly string[]): string {
  return JSON.stringify(values);
}

/** Where a value is in a list, its case ignored; -1: not in it */
export function choiceIndex(list: readonly string[], value: string): number {
  const lower = value.trim().toLowerCase();
  return list.findIndex((v) => v.toLowerCase() === lower);
}

/** Values each once (as first written, their case ignored), in the alphabet's order: what a column without a list offers */
export function distinctValues(values: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) if (!seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * A name for a new list from its column's name (`Task status` → task-status),
 * not one of `taken` (a number after it where it would be); `list` where the
 * name gives no letters
 */
export function listNameFor(columnName: string, taken: readonly string[]): string {
  const words = columnName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  while (words.length && !/^[a-z]/.test(words[0]!)) words.shift();
  const base = words.join("-") || "list";
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`;
}
