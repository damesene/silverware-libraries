/// <reference types="node" />
// What Silverware Layout's interaction tests share. The text's width is SilverBullet's own (its `--editor-width`),
// which the playground has not: these tests run against a real SilverBullet only (npm run test:ui:sb), the committed
// silverware-layout.js deployed, and are skipped on the playground. A test's pages are written into its worker's space
// (UiLayout/<test>/<name>), the first opened, and removed after; CONFIG is put back as it was.
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { silverbulletServer } from "../../scripts/silverbullet-servers.ts";

export { expect };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
const FOLDER = "UiLayout";

export type Space = {
  /** The folder of this test's pages in the space (`UiLayout/<test>`) */
  readonly folder: string;
  /** Pages written (by their names under the folder), and files beside them (an image: its name with its extension), the page `open` of them opened, Silverware Layout started */
  open(pages: Readonly<Record<string, string>>, open: string, files?: Readonly<Record<string, Uint8Array | string>>): Promise<void>;
  /** A page's text as saved (its name under the folder) */
  saved(name: string): Promise<string | undefined>;
  /** The space's CONFIG page as saved */
  config(): Promise<string | undefined>;
};

/** Tests get `page` and `space`: an error in the page fails the test */
export const test = base.extend<{ space: Space }>({
  page: async ({ page }, use) => {
    test.skip(!onSilverBullet, "the text's width is SilverBullet's own: tested against SilverBullet only");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // (SilverBullet answers what it looks for and does not find with a 404, which the page logs)
      if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text());
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
    const configPath = join(server().space, "CONFIG.md");
    const configBefore = existsSync(configPath) ? await readFile(configPath, "utf8") : undefined;
    await use({
      folder,
      open: async (pages, open, files = {}) => {
        for (const [name, text] of Object.entries(pages)) {
          await mkdir(dirname(path(name)), { recursive: true });
          await writeFile(path(name), text);
        }
        for (const [name, content] of Object.entries(files)) {
          const file = join(server().space, folder, name);
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, content);
        }
        await page.goto(`http://127.0.0.1:${server().port}/${folder}/${open}`);
        await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
        await commandDefined(page, PAGE_LAYOUT);
      },
      saved: async (name) => (existsSync(path(name)) ? (await readFile(path(name), "utf8")).replace(/\r\n/g, "\n") : undefined),
      config: async () => (existsSync(configPath) ? (await readFile(configPath, "utf8")).replace(/\r\n/g, "\n") : undefined),
    });
    // (The page closed first: an open client would take CONFIG written under it for a change of its own)
    await page.close();
    await rm(join(server().space, folder), { recursive: true, force: true });
    if (configBefore === undefined) await rm(configPath, { force: true });
    else await writeFile(configPath, configBefore);
  },
});

export const PAGE_LAYOUT = "Silverware Layout: Page layout";

type Client = { clientSystem: { commandHook: { buildAllCommands(): Map<string, unknown> } }; runCommandByName(name: string): Promise<void> };

/** Waits until Space Lua has defined a command (it loads after the page): Silverware Layout started */
async function commandDefined(page: Page, name: string): Promise<void> {
  await page.waitForFunction((command) => (window as unknown as { client: Client }).client.clientSystem.commandHook.buildAllCommands().has(command), name);
}

/** A command run as the palette would */
export async function runCommand(page: Page, name: string): Promise<void> {
  await commandDefined(page, name);
  await page.evaluate((command) => void (window as unknown as { client: Client }).client.runCommandByName(command), name);
}

/** The text's width (px) and the top bar's (its page name lines up with the text), as shown */
export function widths(page: Page): Promise<{ text: number; topBar: number }> {
  return page.evaluate(() => {
    const width = (selector: string) => Math.round(document.querySelector(selector)?.getBoundingClientRect().width ?? 0);
    return { text: width("#sb-main .cm-content"), topBar: width("#sb-top .main .inner") };
  });
}

/** The text width Silverware Layout sets (the root's inline `--editor-width`); empty: none */
export function widthSet(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.style.getPropertyValue("--editor-width"));
}

/** Waits until the index has a page's layout (`_layout`): a page written for a test is indexed a moment after it is opened */
export async function waitForIndexedLayout(page: Page, name: string): Promise<void> {
  type Indexed = { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } };
  await expect
    .poll(async () => {
      const pages = await page.evaluate(() => (window as unknown as { client: Indexed }).client.clientSystem.localSyscall("index.queryLuaObjects", ["page", {}]));
      return Array.isArray(pages) && pages.some((one: { name?: string; _layout?: unknown }) => one.name === name && !!one._layout);
    })
    .toBe(true);
}

/** A PNG of one pixel: an image of the space, drawn as large as its embed says */
export const PIXEL_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/**
 * Waits until the page shows a grid drawn (`count` of them): SilverBullet's custom syntax is active once the page is
 * loaded again after it is first defined, so a page shown before that has its grid as text: loaded again then
 */
export async function gridsDrawn(page: Page, count = 1): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await expect(page.locator("#sb-main .swl-grid:not(.swl-grid-shown)")).toHaveCount(count, { timeout: 5000 });
      return;
    } catch {
      await page.reload();
      await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
    }
  }
  await expect(page.locator("#sb-main .swl-grid:not(.swl-grid-shown)")).toHaveCount(count);
}

/** Where SilverBullet's cursor is (an offset of the page's text) */
export function cursorAt(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { client: { editorView: { state: { selection: { main: { head: number } } } } } }).client.editorView.state.selection.main.head);
}

/** The page's text in the editor now */
export function editorText(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { client: { editorView: { state: { doc: { toString(): string } } } } }).client.editorView.state.doc.toString());
}
