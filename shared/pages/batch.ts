// Work over many pages: a few at a time (each read or write is a call into
// the platform), in their order, the progress told after each, the browser
// given its turns. A tag may be on hundreds of pages; a space whose reads and
// writes answer at once (in memory, a playground's) would otherwise run them
// all in one task, painting nothing meanwhile.

/** Told after each page: how many are done of how many */
export type Progress = (done: number, of: number) => void;

// Pages read or written at once
const AT_ONCE = 6;

// How long work runs before it gives the browser a turn (to paint the progress, to take a click)
const TURN_MS = 30;

/** A turn given to the browser where the work has run TURN_MS since the last one (a macrotask: painting comes first) */
export function breather(): () => Promise<void> {
  let since = performance.now();
  return async () => {
    if (performance.now() - since < TURN_MS) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    since = performance.now();
  };
}

/** `work` for each item, AT_ONCE at a time; the results in the items' order, `progress` after each */
export async function inBatches<T, R>(items: readonly T[], work: (item: T) => Promise<R>, progress?: Progress): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const breathe = breather();
  const worker = async () => {
    while (next < items.length) {
      const at = next++;
      results[at] = await work(items[at]!);
      progress?.(++done, items.length);
      await breathe();
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));
  return results;
}
