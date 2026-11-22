/// <reference types="node" />
// What Silverware Assets XLSX's interaction tests share. Excel workbooks are drawn in files SilverBullet embeds, decorated by
// Silverware Assets, which the playground has not: these tests run against a real SilverBullet only (npm run test:ui:sb), the
// committed bundles deployed, and are skipped on the playground. A test's pages and files are written into its
// worker's space (UiXlsx/<test>/<name>), the first page opened, and removed after.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect } from "@playwright/test";
import { commandDefined } from "../../scripts/ui-test-helpers.ts";
import ExcelJS from "exceljs";
import { configFile, silverbulletServer } from "../../scripts/silverbullet-servers.ts";
import { silverBulletsOwnError } from "../../scripts/silverbullet-noise.ts";

export { expect };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
const FOLDER = "UiXlsx";

export type Space = {
  /** The folder of this test's pages in the space (`UiXlsx/<test>`) */
  readonly folder: string;
  /** Pages written (by their names under the folder), and files beside them, the page `open` of them opened, Silverware Assets and XLSX started */
  open(pages: Readonly<Record<string, string>>, open: string, files?: Readonly<Record<string, Uint8Array | string>>): Promise<void>;
  /** A file's preview as Silverware Assets keeps it (`_silverware-assets-previews/<folder>/<name>`): its text, none where none is kept */
  kept(name: string): Promise<string | undefined>;
  /** A file's kept preview written over (as anyone who can write the space can) */
  writeKept(name: string, text: string): Promise<void>;
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
      // own, not ours; a preview kept is taken away and written again by Regenerate preview, as Silverware Assets' tests allow)
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
        await page.goto(`http://127.0.0.1:${server().port}/${folder}/${open}`);
        await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
        await commandDefined(page, ASSETS_SETTINGS);
      },
      kept: async (name) => {
        const path = await keptPath(join(server().space, "_silverware-assets-previews", folder), name);
        // (Taken away between found and read: a preview regenerated is deleted, then kept again; none kept that moment)
        return path ? readFile(path, "utf8").catch(() => undefined) : undefined;
      },
      writeKept: async (name, text) => {
        const path = await keptPath(join(server().space, "_silverware-assets-previews", folder), name);
        if (!path) throw new Error(`no preview kept as ${name}`);
        await writeFile(path, text);
      },
    });
    await page.close();
    await rm(join(server().space, folder), { recursive: true, force: true });
    // (Previews Silverware Assets kept of its files: silverware-assets/src/core/stored.ts)
    await rm(join(server().space, "_silverware-assets-previews", folder), { recursive: true, force: true });
    if (configBefore === undefined) await rm(configPath, { force: true });
    else await writeFile(configPath, configBefore);
  },
});

// (Silverware Assets' command: defined once its init page ran, Silverware Assets XLSX's after it)
const ASSETS_SETTINGS = "Silverware Assets: Settings";

/** A workbook made with ExcelJS in Node, as `build` fills it */
export async function xlsxOf(build: (workbook: ExcelJS.Workbook) => void): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
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
