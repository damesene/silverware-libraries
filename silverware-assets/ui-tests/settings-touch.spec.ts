// The settings window on a phone (the "touch" project, against SilverBullet): over the whole screen, as the other
// plugins' dialogs, its tabs a row that scrolls sideways, each reached.
import { ASSETS_SETTINGS, expect, runCommand, test } from "./helpers.ts";

test("the settings window on a phone covers the screen; its last tab reached in its row and shown; a label's property tapped shows its name and ×", async ({ page, space }) => {
  await space.open({ Page: "# Page\n" }, "Page");
  await runCommand(page, ASSETS_SETTINGS);
  const dialog = page.locator(".swa-dialog");
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  const view = page.viewportSize()!;
  expect([Math.round(box.x), Math.round(box.width)]).toEqual([0, view.width]);
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(view.height - 1);
  // The tabs' row scrolls: the last, Markdown, tapped and shown
  const last = dialog.getByRole("tab", { name: "Markdown" });
  await last.scrollIntoViewIfNeeded();
  await last.tap();
  await expect(dialog.getByText("Hide embedded files in this view")).toBeVisible();
  // Files: a type's row tapped open, its settings each under its name, within the screen
  await dialog.getByRole("tab", { name: "Files" }).tap();
  const pdf = dialog.locator('.swa-file-types [data-swa-row-type="pdf"] .swa-type-head');
  await pdf.scrollIntoViewIfNeeded();
  await pdf.tap();
  const shiftField = dialog.getByLabel("PDF: Shift+click");
  await shiftField.scrollIntoViewIfNeeded();
  const shift = (await shiftField.boundingBox())!;
  // (A type's Shown as within the screen too)
  const shown = (await dialog.getByLabel("PDF: shown as").boundingBox())!;
  expect(shown.x + shown.width).toBeLessThanOrEqual(view.width);
  expect(shift.x + shift.width).toBeLessThanOrEqual(view.width);
  // Preview's label: a property tapped, chosen: its name and its × over it; the × hides it
  await dialog.getByRole("tab", { name: "Appearance" }).tap();
  // (The preview's view: a full file's has a label of its own)
  const alt = dialog.locator('[data-swa-look="preview"] .swa-sample-item[data-swa-field="alt"]');
  await alt.scrollIntoViewIfNeeded();
  await alt.tap();
  await expect(alt).toHaveAttribute("aria-selected", "true");
  await expect(alt.locator(".swa-sample-tag")).toBeVisible();
  await alt.locator(".swa-sample-remove").tap();
  await expect(dialog.locator('[data-swa-look="preview"] [data-swa-place="off"] [data-swa-field="alt"]')).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).tap();
  await expect(dialog).toBeHidden();
});
