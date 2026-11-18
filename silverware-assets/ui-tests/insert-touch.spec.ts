// Files inserted on a phone (the "touch" project: Pixel 7), against SilverBullet: File: Upload's dialog over the
// whole screen, Files and Camera, the camera's picker asking a photo.
import { expect, runCommand, test } from "./helpers.ts";

test("File: Upload on a phone: the dialog over the screen, Browse… its picker (a phone's offers its camera itself)", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nHere\n" }, "Page");
  await page.locator("#sb-main .cm-line", { hasText: "Here" }).tap();
  // (Replaced once Silverware Assets' init page ran: before, SilverBullet's own)
  await page.waitForFunction(() => {
    // (As SilverBullet runs a command by its name: the commands its UI was told of last, a moment after Space Lua loads)
    const client = (window as unknown as { client?: { ui?: { viewState?: { commands?: Map<string, { run?: unknown }> } } } }).client;
    const command = client?.ui?.viewState?.commands?.get("File: Upload");
    return !!command && !/\binvoke\(/.test(String(command.run));
  });
  await runCommand(page, "File: Upload");
  const dialog = page.locator(".swa-dialog.swa-insert-window");
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  const view = page.viewportSize()!;
  expect(Math.round(box.width)).toBe(view.width);
  await expect(dialog.getByRole("button", { name: "Camera…" })).toHaveCount(0);
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "Browse…" }).tap();
  const picked = await chooser;
  expect(picked.isMultiple()).toBe(true);
  await picked.setFiles([{ name: "image.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }]);
  await expect(dialog.locator(".swa-insert-path")).toHaveValue(`${space.folder}/image.jpg`);
});
