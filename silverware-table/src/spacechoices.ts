// The choice lists Space Lua gives (`silverware.table.defineChoices(name, fn)`,
// the API page): each a Lua function giving the values (a query's, usually),
// run as it is defined and again once SilverBullet has indexed a page (the
// index it reads may have changed), a while after the last such page. Their
// lists are the column types' space lists (columntypes/spacelists.ts). A Lua
// function called from JS gives a Promise (it may await SilverBullet), so the
// lists are read here, apart, and the type reads the last ones.
import { listOf } from "./bridge.ts";
import { LIST_NAME_RE } from "./columntypes/choicelists.ts";
import { setSpaceListNames, setSpaceLists } from "./columntypes/spacelists.ts";

/** How long after the last page indexed the lists are read again; after Space Lua loaded, how long its definitions of before stay */
export const REFRESH_MS = 1000;

type Source = () => unknown;

const sources = new Map<string, Source>();
// Space Lua loaded again and no script has defined a list since: the definitions of before still read
// (else a reading meanwhile dropped every list and the tables showed them unchecked for a moment)
let stale = false;
let staleTimer: ReturnType<typeof setTimeout> | undefined;
// What each list read last, kept where its function fails (a mistake in it, the index not ready)
const lastRead = new Map<string, readonly string[]>();
// The problem last said for each name: said again only when it changes
const said = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let reading: Promise<void> | undefined;
let again = false;

/** What spacechoices tells: a problem to show the user, the lists changed (tables to look again) */
export type ChoicesHost = { readonly problem: (message: string) => void; readonly changed: () => void };
let host: ChoicesHost | undefined;

export function setChoicesHost(given: ChoicesHost): void {
  host = given;
  // Read again: a problem found before had no one to be said to, and the tables are told of the lists
  if (sources.size) schedule(0);
}

/**
 * A list's values from what its function gave: a list (a Lua table) of texts
 * or numbers, each once (its case ignored, the first kept), in its order,
 * empty ones left out; a problem where it is no list, or holds items that are
 * no values (objects: a query selecting no field)
 */
export function choiceValues(given: unknown): { readonly values: string[] } | { readonly problem: string } {
  const notList = { problem: "are not a list of values" };
  if (!Array.isArray(given) && (!given || typeof given !== "object")) return notList;
  const items = listOf(given);
  if (!items.length && Object.keys(given as object).length) return notList;
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of items) {
    if (item === null || item === undefined) continue;
    if (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") {
      return { problem: "hold items that are not texts (select a field: select p.name)" };
    }
    const value = String(item).trim();
    if (value === "" || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    values.push(value);
  }
  return { values };
}

/** `silverware.table.defineChoices`: a list of the space by its name, its values what `fn` gives; why not, else undefined */
export function defineChoices(name: unknown, fn: unknown): string | undefined {
  const list = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (!LIST_NAME_RE.test(list)) {
    return `Silverware Table: choices not defined: "${String(name)}" is no list's name (lower case letters and digits, words joined by dashes, starting with a letter).`;
  }
  if (typeof fn !== "function") return `Silverware Table: choices ${list} not defined: give a function that returns the values.`;
  // The first definition of a new load of Space Lua: those of before go
  if (stale) endStale();
  sources.set(list, fn as Source);
  setSpaceListNames(sources.keys());
  schedule(0);
  return undefined;
}

/**
 * Space Lua is loaded again: its scripts define the lists anew. The
 * definitions of before read until the first of them, or for REFRESH_MS
 * where no script defines one any more (then the lists go)
 */
export function choicesAnew(): void {
  stale = true;
  if (staleTimer !== undefined) clearTimeout(staleTimer);
  staleTimer = setTimeout(() => {
    if (!stale) return;
    endStale();
    setSpaceListNames([]);
    schedule(0);
  }, REFRESH_MS);
}

function endStale(): void {
  stale = false;
  if (staleTimer !== undefined) clearTimeout(staleTimer);
  staleTimer = undefined;
  sources.clear();
}

/** SilverBullet indexed a page: the lists are read again, a while after the last one */
export function choicesIndexed(): void {
  if (sources.size) schedule(REFRESH_MS);
}

function schedule(delay: number): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void refreshChoices();
  }, delay);
}

/** Every list read anew (one reading at a time: one asked for meanwhile follows it) */
export function refreshChoices(): Promise<void> {
  if (reading) {
    again = true;
    return reading;
  }
  reading = (async () => {
    do {
      again = false;
      await readAll();
    } while (again);
  })().finally(() => (reading = undefined));
  return reading;
}

/** What one list's function gave: its values, or why none */
async function readOne(name: string, fn: Source): Promise<{ readonly values: string[] } | { readonly problem: string }> {
  try {
    const read = choiceValues(await fn());
    return "values" in read ? read : { problem: `Silverware Table: the choices ${name} ${read.problem}.` };
  } catch (e) {
    return { problem: `Silverware Table: the choices ${name} failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function readAll(): Promise<void> {
  // The functions are independent: run side by side
  const defined = [...sources];
  const results = await Promise.all(defined.map(([name, fn]) => readOne(name, fn)));
  const read = new Map<string, readonly string[]>();
  defined.forEach(([name], i) => {
    const result = results[i]!;
    if ("values" in result) {
      read.set(name, result.values);
      said.delete(name);
      return;
    }
    const kept = lastRead.get(name);
    if (kept) read.set(name, kept);
    // Said once until it changes; not counted as said before there is anyone to say it to (init not run yet)
    if (host && said.get(name) !== result.problem) {
      host.problem(result.problem);
      said.set(name, result.problem);
    }
  });
  lastRead.clear();
  for (const [name, values] of read) lastRead.set(name, values);
  if (setSpaceLists(read)) host?.changed();
}

/** Tests: nothing defined, nothing read */
export function resetChoicesForTests(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  reading = undefined;
  again = false;
  endStale();
  lastRead.clear();
  said.clear();
  setSpaceListNames([]);
  setSpaceLists(new Map());
}
