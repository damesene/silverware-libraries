// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the init
// page again on the module already loaded. After it a file's preview is drawn as before, its menu one; File: Upload
// opens one dialog, its file put in once.
import { appendToPage, cursorAfter, expect, insertDialog, insertRows, reloadSpaceLua, runCommand, test, uploadReplaced } from "./helpers.ts";

// A pixel of PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("after System: Reload a file put in is drawn once, its menu one", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/a.png|A||{ view: preview }]]\n` }, "Page", { "a.png": PNG });
  const frames = page.locator("#sb-main [data-swa-type='image'][data-swa-view='preview']");
  await expect(frames).toHaveCount(1);
  await reloadSpaceLua(page);
  await appendToPage(page, `\nAgain\n\n![[${space.folder}/a.png|B||{ view: preview }]]\n`);
  await expect(frames).toHaveCount(2);
  await frames.last().hover();
  await frames.last().locator(".swa-more").click();
  await expect(page.locator(".swa-popup:visible")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".swa-popup:visible")).toHaveCount(0);
});

test("after System: Reload File: Upload opens one dialog, the file picked put in once, nothing told", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nHere\n" }, "Page");
  await uploadReplaced(page);
  await reloadSpaceLua(page);
  // (The command defined anew by the init page run again, not the one of before)
  await uploadReplaced(page, true);
  await cursorAfter(page, "Here");
  await page.keyboard.press("Enter");
  await runCommand(page, "File: Upload");
  await expect(insertDialog(page)).toHaveCount(1);
  const chooser = page.waitForEvent("filechooser");
  await insertDialog(page).getByRole("button", { name: "Browse…" }).click();
  await (await chooser).setFiles([{ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") }]);
  await expect(insertRows(page)).toHaveCount(1);
  await insertRows(page).first().locator(".swa-insert-choice", { hasText: "Link" }).click();
  await insertDialog(page).getByRole("button", { name: "Insert" }).click();
  await expect(insertDialog(page)).toHaveCount(0);
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\nHere\n[[${space.folder}/notes.txt]]\n`);
  expect(space.hasFile("notes.txt")).toBe(true);
  // (No notification by then: none of an upload done twice or of a command missing)
  await expect(page.locator(".sb-notifications > *")).toHaveCount(0);
});
