// When a page opened in SilverBullet is loaded, for the interaction tests (each
// plugin's helpers.ts): its widgets ready is not yet the end. In a browser that
// has no index of the space yet (every test's), SilverBullet's first index,
// once complete, dispatches `editor:reloadState`: the client takes the index as
// complete, and `clientSystem.reloadState()` loads the scripts again, which
// makes the widgets ready (`widgetsReady` resolved within it), then loads the
// styles and builds the editor's state anew (2.12.1's client.js, seen on
// 2026-11-03): the page's tables and lines rendered anew 20 to 60 ms after its
// widgets were ready locally, later in CI. A test begun before measured an
// element about to be replaced (no box), or set a style on it. SilverBullet after 2.12.1 draws widgets before its
// first index and, once the index is complete, runs `clientSystem.afterIndexCompleted()` instead (the editor's state
// built anew): waited for alike, else a test acted before the index had its pages (a rename found no links to follow).
import type { Page } from "@playwright/test";

type Loading = {
  client?: { widgetsReady?: Promise<unknown>; fullIndexCompleted?: boolean; clientSystem?: { reloadState?: () => Promise<unknown>; afterIndexCompleted?: () => Promise<unknown> } };
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
      if (!system?.reloadState) return void setTimeout(watch, 5);
      // SB-2.12-COMPAT: `reloadState` is what 2.12.1 runs once its first index is complete; after it,
      // `afterIndexCompleted` (below). Once 2.12.1 is dropped: that one alone, waited for (and `reloadState` no more)
      const reload = system.reloadState.bind(system);
      system.reloadState = () => {
        const done = reload();
        reloads.push(done);
        return done;
      };
      const completed = system.afterIndexCompleted?.bind(system);
      if (completed) {
        system.afterIndexCompleted = () => {
          const done = completed();
          reloads.push(done);
          return done;
        };
      }
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
    // (The first index complete, as the client tells it: after 2.12.1 the widgets are ready before it)
    while (w.client?.fullIndexCompleted === false) await new Promise((resolve) => setTimeout(resolve, 20));
    await Promise.all(w.silverwareTestReloads ?? []);
  });
}
