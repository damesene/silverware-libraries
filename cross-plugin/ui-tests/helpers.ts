/// <reference types="node" />
// What the cross-plugin interaction tests share: the plugins together in one SilverBullet, what one lays over another's
// (docs/silverware-core-work.md, step S). Every plugin is deployed in the test servers' spaces, so these run against a
// real SilverBullet only and are skipped on the playground. A test's pages are written into its worker's space
// (UiCross/<test>/<name>), the first opened, and removed after; Library/Config is put back as it was.
import { test as base, expect, type Page } from "@playwright/test";
import { boxOf, expectNoPageErrorsYet, ON_TOP, onTopAt, pageErrors, runSilverBulletCommand, type Space, withSpace } from "../../scripts/ui-test-helpers.ts";

export { boxOf, expect, expectNoPageErrorsYet, ON_TOP, onTopAt, runSilverBulletCommand, type Space };

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
