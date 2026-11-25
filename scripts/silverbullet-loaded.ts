// When a page opened in SilverBullet is loaded, for the interaction tests (each
// plugin's helpers.ts): its widgets ready is not yet the end. In a browser that
// has no index of the space yet (every test's), SilverBullet draws widgets before
// its first index and, once the index is complete, runs
// `clientSystem.afterIndexCompleted()`: the editor's state built anew, the page's
// tables and lines rendered anew. A test begun before measured an element about
// to be replaced (no box), or acted before the index had its pages (a rename
// found no links to follow): that is waited for.
import type { Page } from "@playwright/test";

type Loading = {
  client?: { widgetsReady?: Promise<unknown>; fullIndexCompleted?: boolean; clientSystem?: { afterIndexCompleted?: () => Promise<unknown> } };
  silverwareTestReloads?: Promise<unknown>[];
};

/** Before the page is opened: SilverBullet's reloads of its state are kept, for `loaded` to wait for */
export async function watchReloads(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Loading;
    const reloads: Promise<unknown>[] = (w.silverwareTestReloads = []);
    // As soon as the client is made: its index is complete some seconds later
    const watch = () => {
      const system = w.client?.clientSystem;
      if (!system?.afterIndexCompleted) return void setTimeout(watch, 5);
      const completed = system.afterIndexCompleted.bind(system);
      system.afterIndexCompleted = () => {
        const done = completed();
        reloads.push(done);
        return done;
      };
    };
    watch();
  });
}

/**
 * The page loaded: its widgets ready, and the reload that made them so done
 * (begun by then where there is one: the widgets wait for the index it follows)
 */
export async function loaded(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as Loading).client);
  await page.evaluate(async () => {
    const w = window as unknown as Loading;
    await w.client?.widgetsReady;
    // (The first index complete, as the client tells it: the widgets are ready before it. Said so where it
    // never is, before the test's own time runs out in whatever step waited)
    const until = Date.now() + 30_000;
    while (w.client?.fullIndexCompleted === false) {
      if (Date.now() > until) throw new Error("SilverBullet's first index was not complete in 30 s");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await Promise.all(w.silverwareTestReloads ?? []);
  });
}
