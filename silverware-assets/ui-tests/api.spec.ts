// Silverware Assets' API for another plugin's files (shared/assets.ts: drawPreview, showFile, insertFiles, deleteFiles;
// docs/silverware-database-files.md), against SilverBullet: called as a plugin calls it, through the module SilverBullet
// loaded.
import type { Page } from "@playwright/test";
import { expect, PIXEL_PNG, test } from "./helpers.ts";

const PNG = PIXEL_PNG.toString("base64");
const MODULE = "/.fs/Library/damesene/silverware-assets.js";
const dialog = (page: Page) => page.locator(".swa-dialog.swa-insert-window");

/** Files uploaded through the API, as a plugin would on a drop (`given`: a PNG of each name), its answer kept as `window.uploaded` once it comes */
async function upload(page: Page, folder: string, names: readonly string[]): Promise<void> {
  await page.evaluate(
    async ({ module, folder, names, png }) => {
      type Api = { insertFiles(given: unknown, place: unknown): Promise<readonly unknown[] | undefined> };
      const { api } = (await import(module)) as { api: Api };
      const files = names.map((name) => new File([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], name, { type: "image/png" }));
      const answer = window as unknown as { uploaded?: readonly unknown[] | null };
      delete answer.uploaded;
      void api.insertFiles({ files, source: "drop" }, { folder }).then((paths) => (answer.uploaded = paths ?? null));
    },
    { module: MODULE, folder, names, png: PNG },
  );
}

const uploaded = (page: Page) => page.evaluate(() => (window as unknown as { uploaded?: readonly unknown[] | null }).uploaded);

test("another plugin's upload: the dialog asks the names alone, as its companion; resolved with the paths once written, nothing put in the page", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nText\n" }, "Page");
  await upload(page, `${space.folder}/files`, ["photo.png"]);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toHaveAttribute("data-silverware-editor-companion", "");
  // (No choice of how it is shown: the plugin writes its own link)
  await expect(dialog(page).locator(".swa-insert-choices:visible")).toHaveCount(0);
  await expect(dialog(page)).not.toContainText("how it is put in the page");
  await expect(dialog(page).locator(".swa-insert-path")).toHaveValue(`${space.folder}/files/photo.png`);
  await dialog(page).getByRole("button", { name: "Add" }).click();
  await expect.poll(() => uploaded(page)).toEqual([{ target: `${space.folder}/files/photo.png` }]);
  expect(space.hasFile("files/photo.png")).toBe(true);
  expect(await space.saved("Page")).toBe("# Page\n\nText\n");
  // Cancelled: nothing written, its answer none
  await upload(page, `${space.folder}/files`, ["other.png"]);
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => uploaded(page)).toBeNull();
  expect(space.hasFile("files/other.png")).toBe(false);
});

test("another plugin's file: its preview drawn, shown in the side panel, deleted with nothing asked", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nText\n" }, "Page", { "photo.png": PIXEL_PNG, "notes.swatest": "x" });
  const target = `${space.folder}/photo.png`;
  const drawn = await page.evaluate(
    async ({ module, target, page }) => {
      type Api = { drawPreview(target: string, page: string, box: unknown, signal: AbortSignal): Promise<HTMLElement | null> };
      const { api } = (await import(module)) as { api: Api };
      const image = await api.drawPreview(target, page, { width: 84, height: 28 }, new AbortController().signal);
      const none = await api.drawPreview(target.replace("photo.png", "notes.swatest"), page, { width: 84, height: 28 }, new AbortController().signal);
      return { image: image?.localName, src: image?.getAttribute("src"), none };
    },
    { module: MODULE, target, page: `${space.folder}/Page` },
  );
  expect(drawn.image).toBe("img");
  expect(drawn.src).toContain("photo.png");
  expect(drawn.none).toBeNull();
  await page.evaluate(
    async ({ module, target, page }) => {
      const { api } = (await import(module)) as { api: { showFile(target: string, page: string): void } };
      api.showFile(target, page);
    },
    { module: MODULE, target, page: `${space.folder}/Page` },
  );
  await expect(page.locator(".swa-side-panel .swa-panel-body img")).toBeVisible();
  await expect(page.locator(".swa-side-panel .swa-panel-title")).toHaveText("photo.png");
  await page.keyboard.press("Escape");
  await expect(page.locator(".swa-side-panel")).toHaveCount(0);
  const left = await page.evaluate(
    async ({ module, paths }) => {
      const { api } = (await import(module)) as { api: { deleteFiles(paths: readonly string[]): Promise<readonly string[]> } };
      return api.deleteFiles(paths);
    },
    { module: MODULE, paths: [target] },
  );
  expect(left).toEqual([]);
  // (No question asked: SilverBullet's confirm never shown)
  await expect(page.locator(".sb-modal-box")).toHaveCount(0);
  await expect.poll(() => space.hasFile("photo.png")).toBe(false);
});
