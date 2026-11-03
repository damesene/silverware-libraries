// When a page opened in SilverBullet is loaded, for the interaction tests (each
// plugin's helpers.ts): its widgets ready is not yet the end. In a browser that
// has no index of the space yet (every test's), SilverBullet's first index,
// once complete, dispatches `editor:reloadState`: the client takes the index as
// complete, and `clientSystem.reloadState()` loads the scripts again, which
// makes the widgets ready (`widgetsReady` resolved within it), then loads the
// styles and builds the editor's state anew (2.12.1's client.js, seen on
// 2026-11-03): the page's tables and lines rendered anew 20 to 60 ms after its
// widgets were ready locally, later in CI. A test begun before measured an
// element about to be replaced (no box), or set a style on it.
import type { Page } from "@playwright/test";

type Loading = {
  client?: { widgetsReady?: Promise<unknown>; clientSystem?: { reloadState?: () => Promise<unknown> } };
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
      const reload = system.reloadState.bind(system);
      system.reloadState = () => {
        const done = reload();
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
    await Promise.all(w.silverwareTestReloads ?? []);
  });
}
