/// <reference types="node" />
// What Silverware Assets PDF's interaction tests share. PDFs are drawn in files SilverBullet embeds, decorated by Silverware
// Assets, which the playground has not: these tests run against a real SilverBullet only (npm run test:ui:sb), the
// committed bundles deployed, and are skipped on the playground. A test's pages and files are written into its
// worker's space (UiPdf/<test>/<name>), the first page opened, and removed after.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { appendToPage, commandDefined, reloadSpaceLua } from "../../scripts/ui-test-helpers.ts";
import { configFile, silverbulletServer } from "../../scripts/silverbullet-servers.ts";
import { silverBulletsOwnError } from "../../scripts/silverbullet-noise.ts";

export { appendToPage, expect, reloadSpaceLua };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
const FOLDER = "UiPdf";
// Where Silverware Assets keeps previews (silverware-assets/src/core/stored.ts)
const PREVIEWS = "_silverware-assets-previews";

export type Space = {
  /** The folder of this test's pages in the space (`UiPdf/<test>`) */
  readonly folder: string;
  /** Pages written (by their names under the folder), and files beside them, the page `open` of them opened, Silverware Assets and PDF started */
  open(pages: Readonly<Record<string, string>>, open: string, files?: Readonly<Record<string, Uint8Array | string>>): Promise<void>;
  /** When a file's preview kept by Silverware Assets (`_silverware-assets-previews/<folder>/<name>`) was written, in ms; none: not kept */
  kept(name: string): Promise<number | undefined>;
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
        const path = await keptPath(join(server().space, PREVIEWS, folder), name);
        // (Taken away between found and read: a preview regenerated is deleted, then kept again; none kept that moment)
        return path ? await stat(path).then((one) => one.mtimeMs, () => undefined) : undefined;
      },
    });
    await page.close();
    await rm(join(server().space, folder), { recursive: true, force: true });
    await rm(join(server().space, PREVIEWS, folder), { recursive: true, force: true });
    if (configBefore === undefined) await rm(configPath, { force: true });
    else await writeFile(configPath, configBefore);
  },
});

// (Silverware Assets' command: defined once its init page ran, Silverware Assets PDF's after it)
const ASSETS_SETTINGS = "Silverware Assets: Settings";

/**
 * A PDF of pages 200 × 300 pt, each filled with a rectangle of its colour 20 pt in from each edge (no font: pdf.js
 * draws it alone, its colour checked in the image), its cross-reference table right
 */
export function pdfOf(colours: readonly (readonly [number, number, number])[]): string {
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${colours.map((_, i) => `${3 + 2 * i} 0 R`).join(" ")}] /Count ${colours.length} >>`];
  colours.forEach(([r, g, b], i) => {
    const content = `${r} ${g} ${b} rg 20 20 160 260 re f`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents ${4 + 2 * i} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  return `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

export const RED = [1, 0, 0] as const;
export const BLUE = [0, 0, 1] as const;

/** The colour (RGB) of an image's or a canvas' middle pixel */
/** Whether a colour is another within a few levels (a preview kept as WebP, which is lossy) */
export function nearColour(colour: readonly number[], expected: readonly number[]): boolean {
  return colour.length === expected.length && colour.every((level, index) => Math.abs(level - expected[index]!) < 8);
}

export async function middleColour(page: Page, selector: string): Promise<number[]> {
  return page.locator(selector).first().evaluate((element: HTMLImageElement | HTMLCanvasElement) => {
    const width = element instanceof HTMLImageElement ? element.naturalWidth : element.width;
    const height = element instanceof HTMLImageElement ? element.naturalHeight : element.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    context.drawImage(element, 0, 0);
    return [...context.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data].slice(0, 3);
  });
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

/** A command run as the palette would, once Space Lua has defined it */
export async function runCommand(page: Page, name: string): Promise<void> {
  await commandDefined(page, name);
  await page.evaluate((command) => void (window as unknown as { client: { runCommandByName(name: string): Promise<void> } }).client.runCommandByName(command), name);
}
