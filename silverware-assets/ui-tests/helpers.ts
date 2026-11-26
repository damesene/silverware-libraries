/// <reference types="node" />
// What Silverware Assets' interaction tests share. Files are drawn by SilverBullet (its embeds, its links), which the
// playground has not: these tests run against a real SilverBullet only (npm run test:ui:sb), the committed bundles
// deployed (every plugin: a file in a grid is Silverware Layout's grid and Silverware Assets' file), and are skipped on
// the playground. A test's pages and files are written into its worker's space (UiAssets/<test>/<name>), the first
// page opened, and removed after; Library/Config is put back as it was.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { appendToPage, commandDefined, reloadSpaceLua } from "../../scripts/ui-test-helpers.ts";
import { configFile, silverbulletServer } from "../../scripts/silverbullet-servers.ts";
import { loaded, watchReloads } from "../../scripts/silverbullet-loaded.ts";
import { silverBulletsOwnError } from "../../scripts/silverbullet-noise.ts";

export { appendToPage, expect, reloadSpaceLua };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
const FOLDER = "UiAssets";

export type Space = {
  /** The folder of this test's pages in the space (`UiAssets/<test>`) */
  readonly folder: string;
  /** Pages written (by their names under the folder), and files beside them (an image: its name with its extension), the page `open` of them opened, Silverware Assets started */
  open(pages: Readonly<Record<string, string>>, open: string, files?: Readonly<Record<string, Uint8Array | string>>): Promise<void>;
  /**
   * Whether a preview is kept of a file of the test's folder (`doc.pdf.webp`: of any version; a name with its version,
   * that one), in the default previews' folder or another (`MOVED_PREVIEWS`)
   */
  kept(name: string, root?: string): Promise<boolean>;
  /** A preview written as kept, of a file of the test's folder, by its whole name (`gone.pdf.1-1.webp`) */
  writeKept(name: string, content: string): Promise<void>;
  /** A page's text as saved (its name under the folder) */
  saved(name: string): Promise<string | undefined>;
  /** The space's configuration page as saved */
  config(): Promise<string | undefined>;
  /** Whether a file is in the space (its name under the folder, with its extension) */
  hasFile(name: string): boolean;
};

/** Tests get `page` and `space`: an error in the page fails the test */
export const test = base.extend<{ space: Space }>({
  page: async ({ page }, use) => {
    test.skip(!onSilverBullet, "files are drawn by SilverBullet: tested against SilverBullet only");
    const errors: string[] = [];
    // (Read by its stack: SilverBullet's own, as it starts, thrown in its client alone)
    page.on("pageerror", (e) => void (silverBulletsOwnError(e.stack ?? e.message) || errors.push(e.message)));
    page.on("console", (m) => {
      // (SilverBullet answers what it looks for and does not find with a 404, which the page logs. Its edge, 2026-11,
      // indexes a file deleted or renamed after it is gone, its index plug's `indexDocument` failing to read it: its
      // own, not ours)
      if (m.type() === "error" && !/404/.test(m.text()) && !silverBulletsOwnError(m.text())) errors.push(m.text());
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
        await watchReloads(page);
        await page.goto(`http://127.0.0.1:${server().port}/${folder}/${open}`);
        await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
        // (Its first index complete: a rename follows links the index has)
        await loaded(page);
        await commandDefined(page, ASSETS_SETTINGS);
        await commandDefined(page, LAYOUT_SETTINGS);
      },
      kept: async (name, root = "_silverware-assets-previews") => !!(await stat(join(server().space, root, folder, name)).catch(() => undefined)) || !!(await keptPath(join(server().space, root, folder), name)),
      writeKept: async (name, content) => {
        const file = join(server().space, "_silverware-assets-previews", folder, name);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, content);
      },
      saved: async (name) => (existsSync(path(name)) ? (await readFile(path(name), "utf8")).replace(/\r\n/g, "\n") : undefined),
      hasFile: (name) => existsSync(join(server().space, folder, name)),
      config: async () => (existsSync(configPath) ? (await readFile(configPath, "utf8")).replace(/\r\n/g, "\n") : undefined),
    });
    // (The page closed first: an open client would take Library/Config written under it for a change of its own)
    await page.close();
    await rm(join(server().space, folder), { recursive: true, force: true });
    // (Previews Silverware Assets kept of its files: silverware-assets/src/core/stored.ts)
    await rm(join(server().space, "_silverware-assets-previews", folder), { recursive: true, force: true });
    await rm(join(server().space, MOVED_PREVIEWS, folder), { recursive: true, force: true });
    if (configBefore === undefined) await rm(configPath, { force: true });
    else await writeFile(configPath, configBefore);
  },
});

export const ASSETS_SETTINGS = "Silverware Assets: Settings";
// The previews' folder a test moves them to (taken away after it, as the default's)
export const MOVED_PREVIEWS = "UiMovedPreviews";
// (Silverware Layout's, for the cases where the two meet: a file in a grid, its width by Layout's handle)
export const LAYOUT_SETTINGS = "Silverware Layout: Settings";

type Client = { runCommandByName(name: string): Promise<void> };

/** A command run as the palette would */
export async function runCommand(page: Page, name: string): Promise<void> {
  await commandDefined(page, name);
  await page.evaluate((command) => void (window as unknown as { client: Client }).client.runCommandByName(command), name);
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
      // (Still there a moment later: SilverBullet may draw the page anew once more as it loads its scripts, a grid
      // drawn before its custom syntax is active gone again)
      await page.waitForTimeout(700);
      await expect(page.locator("#sb-main .swl-grid:not(.swl-grid-shown)")).toHaveCount(count, { timeout: 1000 });
      return;
    } catch {
      await page.reload();
      await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
    }
  }
  await expect(page.locator("#sb-main .swl-grid:not(.swl-grid-shown)")).toHaveCount(count);
}

/**
 * Where Silverware Assets keeps a file's preview of a kind (`name`: the file's name and the kind's extension,
 * `doc.pdf.webp`), whatever version of the file it is named by (`doc.pdf.<time>-<size>.webp`); none: not kept
 */
async function keptPath(dir: string, name: string): Promise<string | undefined> {
  const dot = name.lastIndexOf(".");
  const [base, extension] = [name.slice(0, dot), name.slice(dot + 1)];
  const files = await readdir(dir).catch(() => [] as string[]);
  const found = files.find((file) => file.startsWith(`${base}.`) && file.endsWith(`.${extension}`) && /^\d+-\d+$/.test(file.slice(base.length + 1, -extension.length - 1)));
  return found && join(dir, found);
}
