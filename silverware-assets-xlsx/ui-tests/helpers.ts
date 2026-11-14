/// <reference types="node" />
// What Silverware Assets XLSX's interaction tests share. Excel workbooks are drawn in files SilverBullet embeds, decorated by
// Silverware Assets, which the playground has not: these tests run against a real SilverBullet only (npm run test:ui:sb), the
// committed bundles deployed, and are skipped on the playground. A test's pages and files are written into its
// worker's space (UiXlsx/<test>/<name>), the first page opened, and removed after.
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { silverbulletServer } from "../../scripts/silverbullet-servers.ts";

export { expect };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
const FOLDER = "UiXlsx";

export type Space = {
  /** The folder of this test's pages in the space (`UiXlsx/<test>`) */
  readonly folder: string;
  /** Pages written (by their names under the folder), and files beside them, the page `open` of them opened, Silverware Assets and XLSX started */
  open(pages: Readonly<Record<string, string>>, open: string, files?: Readonly<Record<string, Uint8Array | string>>): Promise<void>;
};

/** Tests get `page` and `space`: an error in the page fails the test */
export const test = base.extend<{ space: Space }>({
  page: async ({ page }, use) => {
    test.skip(!onSilverBullet, "files are drawn by SilverBullet: tested against SilverBullet only");
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
        await commandDefined(page, ASSETS_SETTINGS);
      },
    });
    await page.close();
    await rm(join(server().space, folder), { recursive: true, force: true });
    if (configBefore === undefined) await rm(configPath, { force: true });
    else await writeFile(configPath, configBefore);
  },
});

// (Silverware Assets' command: defined once its init page ran, Silverware Assets XLSX's after it)
const ASSETS_SETTINGS = "Silverware Assets: Settings";

type Client = { clientSystem: { commandHook: { buildAllCommands(): Map<string, unknown> } } };

/** Waits until Space Lua has defined a command (it loads after the page): its plugin started */
async function commandDefined(page: Page, name: string): Promise<void> {
  await page.waitForFunction((command) => (window as unknown as { client: Client }).client.clientSystem.commandHook.buildAllCommands().has(command), name);
}

/** A workbook made with ExcelJS in Node, as `build` fills it */
export async function xlsxOf(build: (workbook: ExcelJS.Workbook) => void): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
