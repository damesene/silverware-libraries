/// <reference types="node" />
// What the cross-plugin interaction tests share: the plugins together in one SilverBullet, what one lays over another's
// (docs/silverware-core-work.md, step S). Every plugin is deployed in the test servers' spaces, so these run against a
// real SilverBullet only and are skipped on the playground. A test's pages are written into its worker's space
// (UiCross/<test>/<name>), the first opened, and removed after; Library/Config is put back as it was.
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { boxOf, expectNoPageErrorsYet, pageErrors, runSilverBulletCommand, type Space, withSpace } from "../../scripts/ui-test-helpers.ts";

export { boxOf, expect, expectNoPageErrorsYet, runSilverBulletCommand, type Space };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";

// The plugins started: a command of each that defines one (Silverware Chart, Editor, Icons and the viewers define none,
// loaded in the same load of Space Lua)
const STARTED = ["Silverware Assets: Settings", "Silverware Database: Settings", "Silverware Layout: Settings", "Silverware Table: Settings", "Silverware Tags: Manager", "Silverware Toolbar: Settings"];

/** Tests get `page` and `space`: an error in the page fails the test */
export const test = base.extend<{ space: Space }>({
  page: async ({ page }, use) => {
    test.skip(!onSilverBullet, "the plugins together are SilverBullet's: tested against SilverBullet only");
    const errors = pageErrors(page);
    try {
      await use(page);
      expect(errors, "errors in the page").toEqual([]);
    } finally {
      await page.close();
    }
  },
  space: async ({ page }, use) => withSpace(page, "UiCross", STARTED, use),
});

/** A database's root page, of the version the store writes, its properties' lines given (`    key: { … }`) */
export const root = (id: string, name: string, properties: string) => `---\ntags: [db-root]\n_database:\n  id: ${id}\n  name: ${name}\n  version: 1\n  properties:\n${properties}\n---\n`;

/** An entry of a menu of Silverware Database's by its label */
export const chooseIn = (page: Page, label: string) => page.locator(".swd-menu .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: new RegExp(`^${label}$`) }) }).first();

/**
 * What the document has on top at an element's middle and inside each of its corners: whether each is the element or
 * in it (in a shadow root too), named by where it fails; a point outside the window `"outside view"` (the document has
 * nothing there to hit), not taken for one covered. What lies over it there by its stacking (another plugin's control,
 * a panel of the page) shows; visibility alone would not. The corners `inset` px in: past a rounded corner of up to
 * about three times that (today's overlays: 6 to 8 px)
 */
export async function onTopAt(target: Locator, inset = 3): Promise<Record<string, boolean | "outside view">> {
  await boxOf(target);
  return target.evaluate((element, inset) => {
    const box = element.getBoundingClientRect();
    const points: Record<string, [number, number]> = {
      middle: [box.left + box.width / 2, box.top + box.height / 2],
      "top left": [box.left + inset, box.top + inset],
      "top right": [box.right - inset, box.top + inset],
      "bottom left": [box.left + inset, box.bottom - inset],
      "bottom right": [box.right - inset, box.bottom - inset],
    };
    const within = (node: Element | null): boolean => {
      for (let at: Node | null = node; at; at = at.parentNode ?? (at instanceof ShadowRoot ? at.host : null)) if (at === element) return true;
      return false;
    };
    const deepest = (x: number, y: number) => {
      let found = document.elementFromPoint(x, y);
      while (found?.shadowRoot) {
        const inner = found.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === found) break;
        found = inner;
      }
      return found;
    };
    const outside = (x: number, y: number) => x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight;
    return Object.fromEntries(Object.entries(points).map(([name, [x, y]]) => [name, outside(x, y) ? "outside view" : within(deepest(x, y))]));
  }, inset);
}

/** Every point `onTopAt` reads on top */
export const ON_TOP = { middle: true, "top left": true, "top right": true, "bottom left": true, "bottom right": true };
