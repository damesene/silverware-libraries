// System properties: values no one types, given by where an item is kept and
// by the database itself (decided with the user 2026-11-08): when its page was
// made and last changed, its place in the order by hand as a number (1, 2,
// 3…, the same whatever a view filters or sorts), its page, its page's tags.
// A property says which it is (`system`, its kind); it is read only always,
// its values never kept in an item (a store reads none of its key from a page
// and writes none), made here from what the store knows of each item.
import { capitalized, type Noun } from "./noun.ts";
import { inRankOrder } from "./rank.ts";
import type { Database, Item, Value } from "../model/database.ts";

/** What a store knows of an item beside its values: its page's dates (local ISO text), its page, its page's tags */
export type SystemFacts = {
  readonly created?: string;
  readonly modified?: string;
  readonly page?: string;
  readonly tags?: readonly string[];
  // Its page's tasks: how many, how many done (none: not known, or not asked: the database has no Task progress)
  readonly tasks?: { readonly done: number; readonly total: number };
};

/** A kind of system property: its name (a property's `system`), its label and key when added, the type its values are */
export type SystemProperty = { readonly kind: string; readonly label: string; readonly key: string; readonly type: string; readonly hint: string };

/** The system properties, in the order offered, said in the word of the place the items are kept in (`noun`: an item's page) */
export function systemProperties(noun: Noun): readonly SystemProperty[] {
  const its = `the item's ${noun.one}`;
  return [
    { kind: "createdAt", label: "Created", key: "created_at", type: "datetime", hint: `When ${its} was made` },
    { kind: "modifiedAt", label: "Modified", key: "modified_at", type: "datetime", hint: `When ${its} was last written (moving it in the order too)` },
    { kind: "order", label: "Order", key: "order", type: "number", hint: "Its place in the order by hand: 1, 2, 3…" },
    { kind: "page", label: capitalized(noun.one), key: "page", type: "text", hint: capitalized(its) },
    { kind: "tags", label: "Tags", key: "page_tags", type: "multi-select", hint: `The tags of ${its}, but the database's own` },
    { kind: "taskProgress", label: "Task progress", key: "task_progress", type: "progress", hint: `How much of the tasks in ${its} is done (none where it has no task)` },
  ];
}

/** Whether a database has a system property of a kind (a store asks what it needs to read: its pages' tasks) */
export const hasSystem = (database: Database, kind: string) => database.properties.some((one) => one.system === kind);

/** A system property's kind by its name; undefined where there is none of that name */
export function systemKind(name: string | undefined, noun: Noun): SystemProperty | undefined {
  return name === undefined ? undefined : systemProperties(noun).find((one) => one.kind === name);
}

/** The tasks of a markdown text (`- [ ] …`, `- [x] …`, as SilverBullet's index counts them, x or X done): where a store has a page's text, not the index's tasks */
export function tasksIn(text: string): { readonly done: number; readonly total: number } {
  let done = 0;
  let total = 0;
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    // (Not in a fenced block of code)
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const m = fenced ? null : TASK_RE.exec(line);
    if (!m) continue;
    total++;
    if (m[1] === "x" || m[1] === "X") done++;
  }
  return { done, total };
}

// A task's line: in a quote or not, a list item's marker (or a number), its state in brackets, a space after it
const TASK_RE = /^(?:\s*>)*\s*(?:[-*+]|\d+[.)])\s+\[([^\]]+)\]\s/;

/** A moment as local ISO text, as SilverBullet's index writes a page's dates (`2026-11-08T14:30:05.123`) */
export function localStamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

/** One system property's value of an item; undefined where the store does not know it */
function systemValue(kind: string, facts: SystemFacts, order: number | undefined): Value | undefined {
  switch (kind) {
    case "createdAt":
      return facts.created || undefined;
    case "modifiedAt":
      return facts.modified || undefined;
    case "order":
      return order;
    case "page":
      return facts.page || undefined;
    case "tags":
      return facts.tags ? [...facts.tags] : undefined;
    case "taskProgress":
      // (A share to 4 places; none where the page has no task)
      return facts.tasks && facts.tasks.total > 0 ? Math.round((facts.tasks.done / facts.tasks.total) * 10000) / 10000 : undefined;
    default:
      return undefined;
  }
}

/**
 * The items with their system properties' values (those the database has),
 * each from what the store knows of it (`facts`); the order counted over every
 * item of the database. An item without system properties stays the object it
 * was; a value under a system property's key the item holds is not its own
 * (no store reads one): replaced, or taken off where unknown
 */
export function withSystemValues(items: readonly Item[], database: Database, facts: (item: Item) => SystemFacts): Item[] {
  const system = database.properties.filter((one) => one.system !== undefined);
  if (!system.length) return [...items];
  const orders = system.some((one) => one.system === "order") ? new Map(inRankOrder(items).map((item, at) => [item.key, at + 1])) : undefined;
  return items.map((item) => {
    const known = facts(item);
    const values: Record<string, Value> = { ...item.values };
    for (const property of system) {
      const value = systemValue(property.system!, known, orders?.get(item.key));
      if (value === undefined) delete values[property.key];
      else values[property.key] = value;
    }
    return { ...item, values };
  });
}
