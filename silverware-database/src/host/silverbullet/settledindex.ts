// SilverBullet's index as the platform gives it: consistent only while its
// index queue is empty. SilverBullet indexes a page anew by clearing its
// objects, reading and parsing the page, then putting them back
// (plugs/index/queue.ts `indexFile`): a query meanwhile has none of the page
// (seen 2026-11-08: an item's content written from the peek, its page missing
// from a few queries in a row; the store read the item as removed, the peek
// closed, the views lost its row). Its queue counts a page being indexed as
// well as one queued (`mq.getQueueStats`), so an empty queue is an index with
// no page half done, and it says so when it empties (`mq:emptyQueue:indexQueue`).
//
// So a tag's objects are queried while the queue is empty and kept as read
// then; while it is busy the last such reading answers (the first, before any:
// the index as it is); and the changes told meanwhile are told again once it
// is empty, the readings read anew first, so what reads them reads the index
// whole. A page deleted queues nothing (SilverBullet clears it on
// `file:deleted`, after `page:deleted`): final, it is left out of every answer
// from then on and told whole at once, until it is indexed again. What
// SilverBullet does is this binding's to know: nothing beyond the platform
// knows of it.
import type { IndexChange, IndexedObject } from "../../../../shared/platform.ts";

export type SettledIndex = {
  /** The index's objects of a tag as of the last moment no page was being indexed */
  objects(tag: string): Promise<readonly IndexedObject[]>;
  /** A change the index told: told on at once as early, and again whole once the queue is empty */
  changed(change: IndexChange): void;
  /** The index queue emptied: the readings read anew, the changes told since told again (still empty then; else at the next) */
  settled(): Promise<void>;
};

/**
 * The index answered as settled: `query` a tag's objects, `idle` whether no
 * page is queued or being indexed (none: SilverBullet says nothing of its
 * queue, its index taken as whole), `tell` the platform's listeners told a change
 */
export function settledIndex(query: (tag: string) => Promise<readonly IndexedObject[]>, idle: (() => Promise<boolean>) | undefined, tell: (change: IndexChange) => void): SettledIndex {
  const lastSettled = new Map<string, readonly IndexedObject[]>();
  // Pages told changed while the queue was busy, by name (indexed anew: none deleted here)
  const pending = new Map<string, IndexChange>();
  // Pages told deleted, left out of every answer until told indexed again
  const deleted = new Set<string>();
  const present = (object: IndexedObject) => !deleted.has(String(object.name)) && !(typeof object.page === "string" && deleted.has(object.page));
  const read = async (tag: string) => {
    const found = await query(tag);
    lastSettled.set(tag, found);
    return found;
  };
  return {
    async objects(tag) {
      const kept = lastSettled.get(tag);
      const found = kept && idle && !(await idle()) ? kept : await read(tag);
      return deleted.size ? found.filter(present) : found;
    },
    changed(change) {
      tell({ ...change, early: true });
      // Deleted: final, left out from now on, told whole at once
      if (change.deleted) {
        deleted.add(change.document);
        pending.delete(change.document);
        return tell({ document: change.document, deleted: true });
      }
      deleted.delete(change.document);
      // (Indexed anew: whole once its queue is empty, or at once where its queue is not known)
      if (idle) pending.set(change.document, change);
      else tell({ document: change.document, deleted: false });
    },
    async settled() {
      if (!pending.size) return;
      // (The readings read anew while the queue is still empty: else a reader told now would get one of before)
      if (idle && !(await idle())) return;
      const changes = [...pending.values()];
      pending.clear();
      for (const tag of [...lastSettled.keys()]) await read(tag);
      for (const change of changes) tell({ document: change.document, deleted: false });
    },
  };
}
