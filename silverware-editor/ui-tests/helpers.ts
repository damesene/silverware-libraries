/// <reference types="node" />
// What Silverware Editor's interaction tests share. Its editor is no surface of its own: it is used in Silverware
// Layout's grid cells and Silverware Database's peek, so these tests run against a real SilverBullet only (npm run
// test:ui:sb, every plugin deployed in the test servers' spaces) and are skipped on the playground. A test's pages are
// written into its worker's space (UiEditor/<test>/<name>), the first opened, and removed after; Library/Config is put back as
// it was.
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { configFile, silverbulletServer } from "../../scripts/silverbullet-servers.ts";
import { loaded, watchReloads } from "../../scripts/silverbullet-loaded.ts";
import { boxOf, commandDefined } from "../../scripts/ui-test-helpers.ts";
import { silverBulletsOwnError } from "../../scripts/silverbullet-noise.ts";

export { boxOf, expect };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
const FOLDER = "UiEditor";

export type Space = {
  /** The folder of this test's pages in the space (`UiEditor/<test>`) */
  readonly folder: string;
  /** Pages written (by their names under the folder), and files beside them (an image: its name with its extension), the page `open` of them opened, the plugins started */
  open(pages: Readonly<Record<string, string>>, open: string, files?: Readonly<Record<string, Uint8Array | string>>): Promise<void>;
  /** Another of the pages written opened, the plugins started */
  goTo(name: string): Promise<void>;
};

/** Tests get `page` and `space`: an error in the page fails the test */
export const test = base.extend<{ space: Space }>({
  page: async ({ page }, use) => {
    test.skip(!onSilverBullet, "Silverware Editor's surfaces are other plugins' in SilverBullet: tested against SilverBullet only");
    const errors: string[] = [];
    // (Read by its stack: SilverBullet's own, as it starts, thrown in its client alone)
    page.on("pageerror", (e) => void (silverBulletsOwnError(e.stack ?? e.message) || errors.push(e.message)));
    page.on("console", (m) => {
      // (SilverBullet answers what it looks for and does not find with a 404, which the page logs; its own gesture of two
      // fingers prevents the default in a passive listener of the window, which Chrome logs: client/editor_ui.tsx)
      if (m.type() === "error" && !/404|Unable to preventDefault inside passive event listener/.test(m.text()) && !silverBulletsOwnError(m.text())) errors.push(m.text());
    });
    try {
      await use(page);
      expect(errors, "errors in the page").toEqual([]);
    } finally {
      await page.close();
    }
  },
  space: async ({ page }, use) => {
    const folder = `${FOLDER}/${test.info().title.replace(/[^\w ]/g, "").slice(0, 40).trim()}`;
    const path = (name: string) => join(server().space, folder, `${name}.md`);
    const configPath = configFile(server().space);
    const configBefore = existsSync(configPath) ? await readFile(configPath, "utf8") : undefined;
    let watching = false;
    const goTo = async (name: string) => {
      // (SilverBullet's first index, complete, builds the editor's state anew: its view back at the cursor, its widgets
      // drawn again; waited for, as what a test does before it would be undone: scripts/silverbullet-loaded.ts)
      if (!watching) await watchReloads(page);
      watching = true;
      await page.goto(`http://127.0.0.1:${server().port}/${folder}/${name}`);
      await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
      await loaded(page);
      await commandDefined(page, "Silverware Layout: Settings");
      await commandDefined(page, "Silverware Database: Settings");
    };
    await use({
      folder,
      open: async (pages, open, files = {}) => {
        // (The files first: a page indexed before what it embeds is there drew it missing)
        for (const [name, content] of Object.entries(files)) {
          const file = join(server().space, folder, name);
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, content);
        }
        for (const [name, text] of Object.entries(pages)) {
          await mkdir(dirname(path(name)), { recursive: true });
          await writeFile(path(name), text);
        }
        await goTo(open);
      },
      goTo,
    });
    // (The page closed first: an open client would take Library/Config written under it for a change of its own)
    await page.close();
    await rm(join(server().space, folder), { recursive: true, force: true });
    // (Previews Silverware Assets kept of its files: silverware-assets/src/core/stored.ts)
    await rm(join(server().space, "_silverware-assets-previews", folder), { recursive: true, force: true });
    if (configBefore === undefined) await rm(configPath, { force: true });
    else await writeFile(configPath, configBefore);
  },
});

/**
 * A grid drawn: SilverBullet's custom syntax becomes active a moment after the page loads, a grid drawn before it gone
 * again; the page loaded again until the grid stays (as Silverware Layout's tests do)
 */
export async function gridsDrawn(page: Page, count = 1): Promise<void> {
  const grids = page.locator("#sb-main .swl-grid:not(.swl-grid-shown)");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await expect(grids).toHaveCount(count, { timeout: 5000 });
      // (Still there a moment later: SilverBullet may draw the page anew once more as it loads its scripts)
      await page.waitForTimeout(700);
      await expect(grids).toHaveCount(count, { timeout: 1000 });
      return;
    } catch {
      await page.reload();
      await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
    }
  }
  await expect(grids).toHaveCount(count);
}

/** A grid's cell's field as it is edited (Silverware Editor's editor, its element marked by the grid) */
export const cellField = (page: Page): Locator => page.locator("#sb-main .swl-grid-editor");

/** A database's peek's content field */
export const peekField = (page: Page): Locator => page.locator(".swd-peek .swd-peek-body");

/** A database's root page, of the version the store writes */
export const root = (id: string, name: string) =>
  `---\ntags: [db-root]\n_database:\n  id: ${id}\n  name: ${name}\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n---\n`;

/** A database's item's page */
export const item = (status: string, rank: string) => `---\ntags: [db]\nstatus: ${status}\n_database:\n  rank: ${rank}\n---\n`;

/** Whether a markdown field takes typing: not read only, its content read (`data-reading` gone) */
export function fieldReady(field: Locator): Promise<boolean> {
  return field.evaluate((root: HTMLElement) => root.dataset.reading === undefined && !(root instanceof HTMLTextAreaElement && root.readOnly));
}
