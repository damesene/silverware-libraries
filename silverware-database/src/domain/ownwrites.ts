// What a place or the item's panel writes of an item, one write after
// another for that item, each on the item as its own writes before it left
// it. A view draws an item and writes against it as drawn, and the core
// refuses a write whose item changed since it was read: right for a change
// made elsewhere, wrong for the view's own (a name typed and left, a status
// picked at once: the status went on the item as named before, refused as
// changed since it was read, seen 2026-11-09 in the table and the panel alike).
// So a write goes on the item as the writes before it from the same drawing
// left it, but only where nothing of it changed beside what they wrote: a
// change made elsewhere meanwhile leaves the item as drawn, and the write is
// refused as before. Writes of one caller only: the panel's and a place's do
// not see each other's (a name typed in the panel, a value picked at once in
// the table behind it is refused), nor does a move or a look written beside
// them; the core checking its own last revisions itself would cover all of it
// (docs/silverware-database.md, *The review before the merge*).
import type { Item, ItemKey } from "../model/database.ts";

/** What a write gives back: refused where it has a `problem` (the core's `isRefused`, which this layer may not import) */
type Written = object;
const refused = (result: Written) => "problem" in result;

/** What one write writes of an item: a value by its key, its name, its look */
export type ItemPart = { readonly key: string } | "name" | "look";

/** Whether two readings of an item are alike in all but `part` (its name, values, look and place in the order) */
export function sameBeside(one: Item, other: Item, part: ItemPart): boolean {
  const beside = (item: Item) => {
    const values: Record<string, unknown> = { ...item.values };
    if (typeof part === "object") delete values[part.key];
    const sorted = Object.entries(values).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return JSON.stringify([part === "name" ? null : item.name, sorted, part === "look" ? null : (item.look ?? null), item.rank ?? null]);
  };
  return beside(one) === beside(other);
}

export class ItemWrites {
  // By item: the write going on (the next of that item waits for it; other items' do not)
  private readonly queues = new Map<ItemKey, Promise<unknown>>();
  // By item: the revision it was drawn with, and the item as the writes from that drawing left it
  private readonly left = new Map<ItemKey, { readonly drawn: string; readonly now: Item }>();

  /** `latest` the item as the store has it now, by its key (none: gone) */
  constructor(private readonly latest: (key: ItemKey) => Promise<Item | undefined>) {}

  /** The item a write from `drawn` goes on: as the writes from that drawing left it, else as drawn (a drawing as new as that, or newer, its own) */
  base(drawn: Item): Item {
    const one = this.left.get(drawn.key);
    if (one && one.drawn === drawn.revision && one.now.revision !== drawn.revision) return one.now;
    // (Drawn anew since, or a drawing no write of which is kept: let go)
    if (one && one.drawn !== drawn.revision) this.left.delete(drawn.key);
    return drawn;
  }

  /** `write` of `part` once the item's writes before it are done, given the item it goes on (`base`) */
  write<R extends Written>(drawn: Item, part: ItemPart, write: (base: Item) => Promise<R>): Promise<R> {
    const key = drawn.key;
    const run = (this.queues.get(key) ?? Promise.resolve()).then(async () => {
      const base = this.base(drawn);
      const done = await write(base);
      if (refused(done)) return done;
      const now = await this.latest(key).catch(() => undefined);
      // (Only its own part changed: what the next write from this drawing goes on; else, a change made elsewhere among, the drawing)
      if (now && sameBeside(base, now, part)) this.left.set(key, { drawn: drawn.revision, now });
      else this.left.delete(key);
      return done;
    });
    const kept = run.catch(() => undefined);
    this.queues.set(key, kept);
    // (Let go once nothing came after it)
    void kept.then(() => {
      if (this.queues.get(key) === kept) this.queues.delete(key);
    });
    return run;
  }
}
