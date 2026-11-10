/// <reference types="node" />
// What Silverware Icons' interaction tests share. On the playground its page
// (icons.html): the picker in a panel, as a plugin opens it, and the icon
// picked drawn as the plugins draw it. Against SilverBullet (the committed
// silverware-icons.js deployed) a page of its worker's space, written for the
// test (UiIcons/<name>) and removed after: the API page's API from Space Lua.
// The picker in a plugin's own place is tested by that plugin's tests.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { silverbulletServer } from "../../scripts/silverbullet-servers.ts";

export { expect };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
const FOLDER = "UiIcons";

/**
 * Tests get `page` (on the playground its page open, the browser's storage of
 * before cleared) and `open(text)` (against SilverBullet: a page of that text
 * opened); an error in the page fails the test
 */
export const test = base.extend<{ open: (text: string) => Promise<void> }>({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // (SilverBullet answers what it looks for and does not find with a 404, which the page logs)
      if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text());
    });
    try {
      if (!onSilverBullet) {
        await page.goto("icons.html");
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await expect(picker(page).locator(".swi-item").first()).toBeVisible();
      }
      await use(page);
      expect(errors, "errors in the page").toEqual([]);
    } finally {
      await page.close();
      if (onSilverBullet) await rm(join(server().space, FOLDER), { recursive: true, force: true });
    }
  },
  open: async ({ page }, use) => {
    await use(async (text) => {
      const name = `${FOLDER}/${test.info().title.replace(/[^\w ]/g, "").slice(0, 40).trim()}`;
      const path = join(server().space, `${name}.md`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text);
      await page.goto(`http://127.0.0.1:${server().port}/${name}`);
    });
  },
});

/** The playground's picker */
export const picker = (page: Page): Locator => page.locator("#picker .swi-picker");

/** The values of the icons shown, in order */
export function shownValues(page: Page): Promise<string[]> {
  return picker(page).locator(".swi-item").evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.swiValue ?? ""));
}
