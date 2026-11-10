import { readFile } from "node:fs/promises";
import type { Download, Page } from "@playwright/test";
import { cell, expect, hoverCell, menu, setPage, table, test } from "./helpers.ts";

const dialog = (page: Page) => page.locator(".swt-excel-dialog");

/** The file the browser saved: an .xlsx is a zip, "PK" its first bytes */
async function savedFile(download: Download): Promise<{ name: string; zip: boolean }> {
  const bytes = await readFile(await download.path());
  return { name: download.suggestedFilename(), zip: bytes.subarray(0, 2).toString() === "PK" };
}

test("Export to Excel's Download gives the browser the file, under the name typed, Enter in its field too", async ({ page }) => {
  await setPage(page, "# Test\n\n| Fruit | Qty |\n|---|--:|\n| Pear | 3 |\n| Apple | 10 |\n| <meta core.table core.name='shop'> |\n");
  await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(2);
  await hoverCell(page, cell(page, 1, 0));
  await page.locator(".swt-bar.swt-visible .swt-bar-more").click();
  await menu(page).locator(".swt-menu-item", { hasText: "Export to Excel…" }).click();
  await expect(dialog(page)).toBeVisible();

  // The dialog stays open over the page while the file is downloaded: its click must not be taken for one beside it
  const first = page.waitForEvent("download");
  await dialog(page).getByRole("button", { name: "Download", exact: true }).click();
  expect(await savedFile(await first)).toEqual({ name: "shop.xlsx", zip: true });
  await expect(dialog(page).locator(".swt-excel-status")).toHaveText("Downloaded shop.xlsx.");

  const name = dialog(page).getByLabel("File name");
  await name.fill("Fruit 2025");
  const second = page.waitForEvent("download");
  await name.press("Enter");
  expect(await savedFile(await second)).toEqual({ name: "Fruit 2025.xlsx", zip: true });
});
