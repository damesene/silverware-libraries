// Files inserted through Silverware Assets' dialog (docs/silverware-assets-insert.md), against SilverBullet: a paste,
// a drop, File: Upload, a name taken, Cancel, a paste left to SilverBullet (text, a fenced block), the setting off, a
// grid's cell's field.
import type { Locator, Page } from "@playwright/test";
import { expect, gridsDrawn, PIXEL_PNG, runCommand, test } from "./helpers.ts";

const PNG = PIXEL_PNG.toString("base64");
type Given = { readonly name: string; readonly type: string };

/** Files pasted into an element (the page's text, a field), as a browser's paste carries them; `extra` the clipboard's other types */
async function paste(target: Locator, files: readonly Given[], extra: Readonly<Record<string, string>> = {}): Promise<void> {
  await target.evaluate(
    (element, { files, extra, png }) => {
      const data = new DataTransfer();
      for (const file of files) data.items.add(new File([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], file.name, { type: file.type }));
      for (const [type, value] of Object.entries(extra)) data.setData(type, value);
      element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
    },
    { files, extra, png: PNG },
  );
}

/** Files dropped at a point of the page, as a browser's drop carries them */
async function drop(page: Page, x: number, y: number, files: readonly Given[]): Promise<void> {
  await page.evaluate(
    ({ x, y, files, png }) => {
      const data = new DataTransfer();
      for (const file of files) data.items.add(new File([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], file.name, { type: file.type }));
      const target = document.elementFromPoint(x, y)!;
      for (const type of ["dragenter", "dragover", "drop"]) target.dispatchEvent(new DragEvent(type, { dataTransfer: data, clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true }));
    },
    { x, y, files, png: PNG },
  );
}

const dialog = (page: Page) => page.locator(".swa-dialog.swa-insert-window");
const rows = (page: Page) => dialog(page).locator(".swa-insert-row");
const pageText = (page: Page) => page.locator("#sb-main .cm-content");

/** File: Upload as Silverware Assets replaces it: a command of Space Lua, once its init page ran (before: SilverBullet's own) */
async function uploadReplaced(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    // (As SilverBullet runs a command by its name: the commands its UI was told of last, a moment after Space Lua loads)
    const client = (window as unknown as { client?: { ui?: { viewState?: { commands?: Map<string, { run?: unknown }> } } } }).client;
    const command = client?.ui?.viewState?.commands?.get("File: Upload");
    // (SilverBullet's own invokes its plug)
    return !!command && !/\binvoke\(/.test(String(command.run));
  });
}

/** The cursor at the end of a line of the page's text */
async function cursorAfter(page: Page, text: string): Promise<void> {
  const line = page.locator("#sb-main .cm-line", { hasText: text });
  await line.click();
  await page.keyboard.press("End");
}

test("an image pasted: the dialog, its name the time's in the page's folder, inserted as chosen, written into the space", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nBefore\n\nAfter\n" }, "Page");
  await cursorAfter(page, "Before");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await paste(pageText(page), [{ name: "image.png", type: "image/png" }]);
  await expect(dialog(page)).toBeVisible();
  const path = await rows(page).first().locator(".swa-insert-path").inputValue();
  expect(path).toMatch(new RegExp(`^${space.folder}/\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}\\.png$`));
  // (The image drawn as it will be: its preview's frame)
  await expect(rows(page).first().locator(".swa-insert-sample .swa-frame")).toHaveCount(1);
  await rows(page).first().locator(".swa-insert-choice", { hasText: "Card" }).click();
  await dialog(page).getByRole("button", { name: "Insert" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => space.saved("Page")).toContain(`![[${path}|||{ view: card }]]`);
  expect(space.hasFile(path.slice(space.folder.length + 1))).toBe(true);
});

test("a large photo shown full, fitted whole in the dialog, not drawn at its own size", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nBefore\n" }, "Page");
  await cursorAfter(page, "Before");
  // (A camera's photo: 3000 × 2000 px, made in the page)
  await pageText(page).evaluate(async (element) => {
    const canvas = document.createElement("canvas");
    canvas.width = 3000;
    canvas.height = 2000;
    canvas.getContext("2d")!.fillRect(0, 0, 3000, 2000);
    const blob = await new Promise<Blob>((done) => canvas.toBlob((made) => done(made!), "image/png"));
    const data = new DataTransfer();
    data.items.add(new File([blob], "image.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
  });
  await expect(dialog(page)).toBeVisible();
  await rows(page).first().locator(".swa-insert-choice", { hasText: "Full" }).click();
  const image = rows(page).first().locator(".swa-insert-sample img");
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(3000);
  const sample = (await rows(page).first().locator(".swa-insert-sample").boundingBox())!;
  const box = (await image.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(sample.width + 0.5);
  expect(box.height).toBeLessThanOrEqual(320.5);
  // (Whole: its ratio kept, 3 : 2)
  expect(Math.abs(box.width / box.height - 1.5)).toBeLessThan(0.02);
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
});

test("files being uploaded: told in a panel at the bottom right, a row each with its state; the files go where the caret was as Insert was pressed", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nBefore\n\nAfter\n" }, "Page");
  await cursorAfter(page, "Before");
  // (Each file's write held a while: an upload over a slow network)
  let release!: () => void;
  const held = new Promise<void>((done) => (release = done));
  await page.route(/\/\.fs\/.*\.png$/, async (route) => {
    if (route.request().method() === "PUT") await held;
    await route.continue();
  });
  await paste(pageText(page), [
    { name: "a.png", type: "image/png" },
    { name: "b.png", type: "image/png" },
  ]);
  await expect(dialog(page)).toBeVisible();
  const paths = await rows(page).locator(".swa-insert-path").evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));
  await dialog(page).getByRole("button", { name: "Insert" }).click();
  await expect(dialog(page)).toHaveCount(0);
  const progress = page.locator(".swa-upload-progress");
  await expect(progress).toBeVisible();
  const uploads = progress.locator(".swa-upload-progress-row");
  await expect(uploads).toHaveCount(2);
  await expect(uploads.first()).toHaveAttribute("data-swa-upload", "uploading");
  await expect(uploads.nth(1)).toHaveAttribute("data-swa-upload", "waiting");
  await expect(progress.locator(".swa-upload-progress-head")).toHaveText("Uploading 1 of 2…");
  // At the window's bottom right, in the theme's colour (SilverBullet's root sets it, not the browser's)
  const box = (await progress.boundingBox())!;
  const window = page.viewportSize()!;
  expect(window.width - (box.x + box.width)).toBeLessThan(24);
  expect(window.height - (box.y + box.height)).toBeLessThan(24);
  expect(await progress.evaluate((element) => getComputedStyle(element).color)).toBe(await page.locator("#sb-root").evaluate((root) => getComputedStyle(root).color));
  // (The page not written meanwhile)
  expect(await space.saved("Page")).toBe("# Page\n\nBefore\n\nAfter\n");
  // The caret moved and text typed meanwhile: the files still go after Before
  await cursorAfter(page, "After");
  await page.keyboard.type(" typed");
  release();
  await expect(progress.locator(".swa-upload-progress-head")).toHaveText("All 2 uploaded");
  await expect.poll(() => space.saved("Page")).toContain(`![[${paths[1]}`);
  const saved = (await space.saved("Page")) ?? "";
  expect(saved).toContain("After typed");
  expect(saved.indexOf(paths[0]!)).toBeGreaterThan(saved.indexOf("Before"));
  expect(saved.indexOf(paths[1]!)).toBeLessThan(saved.indexOf("After typed"));
  await expect(progress).toHaveCount(0, { timeout: 5000 });
});

test("an image copied from a web page: linked at its address on the web instead of kept, nothing uploaded, drawn from there", async ({ page, space }) => {
  const url = "https://images.example.test/pics/cat.png";
  // (The web's image served by the test)
  await page.route(url, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PIXEL_PNG }));
  await space.open({ Page: "# Page\n\nBefore\n\nAfter\n" }, "Page");
  await cursorAfter(page, "Before");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await paste(pageText(page), [{ name: "image.png", type: "image/png" }], { "text/html": `<meta charset="utf-8"><img src="${url}" alt="">` });
  await expect(dialog(page)).toBeVisible();
  // (The name it would have had in the space: no file of it written)
  const path = await rows(page).first().locator(".swa-insert-path").inputValue();
  expect(path).toMatch(/\.png$/);
  // (Linked by default: its address in place of its name)
  await expect(rows(page).first().locator('.swa-insert-kept [aria-checked="true"]')).toHaveText("Link");
  await expect(rows(page).first().locator(".swa-insert-name")).toHaveAttribute("title", url);
  await dialog(page).getByRole("button", { name: "Insert" }).click();
  await expect.poll(() => space.saved("Page")).toContain(`![](${url})`);
  // (Nothing uploaded: no panel, no file of the space)
  await expect(page.locator(".swa-upload-progress")).toHaveCount(0);
  expect(space.hasFile(path.slice(space.folder.length + 1))).toBe(false);
  // (Drawn once the caret is off its line)
  await cursorAfter(page, "After");
  await expect(page.locator(`#sb-main img[src="${url}"]`)).toHaveCount(1);
});

test("files dropped on a line: inserted where dropped, a batch's names apart, a name taken kept both unless replaced", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nFirst line\n\nLast line\n" }, "Page", { "photo.png": PIXEL_PNG });
  const last = (await page.locator("#sb-main .cm-line", { hasText: "Last line" }).boundingBox())!;
  await drop(page, last.x + last.width - 2, last.y + last.height / 2, [
    { name: "photo.png", type: "image/png" },
    { name: "photo.png", type: "image/png" },
  ]);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first().locator(".swa-insert-row-note")).toContainText(`inserted as “${space.folder}/photo-1.png”`);
  await expect(rows(page).nth(1).locator(".swa-insert-row-note")).toContainText(`inserted as “${space.folder}/photo-2.png”`);
  // All full, written as none: Show as gives images full by default
  await dialog(page).locator(".swa-insert-all .swa-insert-choice", { hasText: "Full" }).click();
  await dialog(page).getByRole("button", { name: "Insert" }).click();
  await expect.poll(() => space.saved("Page")).toContain(`Last line ![[${space.folder}/photo-1.png]] ![[${space.folder}/photo-2.png]]`);
  expect(space.hasFile("photo-1.png") && space.hasFile("photo-2.png")).toBe(true);
});

test("a file dropped on the lower half of a widget (a grid): a line of its own under it, the grid's markdown whole", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n<grid>\n<cell>\n\nLeft\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n" }, "Page");
  await gridsDrawn(page);
  const grid = (await page.locator("#sb-main .swl-grid").boundingBox())!;
  await drop(page, grid.x + grid.width / 2, grid.y + grid.height - 2, [{ name: "photo.png", type: "image/png" }]);
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole("button", { name: "Insert" }).click();
  await expect.poll(() => space.saved("Page")).toContain(`</grid>\n![[${space.folder}/photo.png]]\n`);
});

test("a drop or a paste on another plugin's element that takes files itself (marked) is left to it: no dialog, nothing written", async ({ page, space }) => {
  const text = "# Page\n\n<grid>\n<cell>\n\nLeft\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n";
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  // (The element marked as a database marks its cell of files, and taking what reaches it, as that cell will)
  await grid.evaluate((element) => {
    element.setAttribute("data-silverware-takes-files", "");
    const got: string[] = [];
    (window as unknown as { got: string[] }).got = got;
    for (const type of ["dragover", "drop", "paste"])
      element.addEventListener(type, (event) => {
        got.push(`${type}${event.defaultPrevented ? " prevented" : ""}`);
        event.preventDefault();
        event.stopPropagation();
      });
  });
  const box = (await grid.boundingBox())!;
  await drop(page, box.x + box.width / 2, box.y + box.height - 2, [{ name: "photo.png", type: "image/png" }]);
  await paste(grid, [{ name: "image.png", type: "image/png" }]);
  // (Each reached the element, none taken before it)
  expect(await page.evaluate(() => (window as unknown as { got: string[] }).got)).toEqual(["dragover", "drop", "paste"]);
  await expect(dialog(page)).toHaveCount(0);
  expect(await space.saved("Page")).toBe(text);
  expect(space.hasFile("photo.png")).toBe(false);
});

test("Cancel writes nothing; a part of a page pasted (HTML with text), or a paste in a fenced block, is SilverBullet's", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nText\n\n```\ncode\n```\n" }, "Page");
  await cursorAfter(page, "Text");
  await paste(pageText(page), [{ name: "image.png", type: "image/png" }]);
  await expect(dialog(page)).toBeVisible();
  const path = await rows(page).first().locator(".swa-insert-path").inputValue();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(space.hasFile(path.slice(space.folder.length + 1))).toBe(false);
  expect(await space.saved("Page")).toBe("# Page\n\nText\n\n```\ncode\n```\n");
  // (A file with HTML of text beside it: a part of a page, made markdown by SilverBullet)
  await paste(pageText(page), [{ name: "image.png", type: "image/png" }], { "text/html": "<p>Pasted words</p>" });
  await expect.poll(() => space.saved("Page")).toContain("Pasted words");
  await expect(dialog(page)).toHaveCount(0);
  // In a fenced block: not taken
  await cursorAfter(page, "code");
  await paste(pageText(page), [{ name: "image.png", type: "image/png" }]);
  await page.waitForTimeout(300);
  await expect(dialog(page)).toHaveCount(0);
});

test("File: Upload opens the dialog empty, the files picked in it inserted at the cursor", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nHere\n" }, "Page");
  await cursorAfter(page, "Here");
  await page.keyboard.press("Enter");
  await uploadReplaced(page);
  await runCommand(page, "File: Upload");
  await expect(dialog(page)).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await dialog(page).getByRole("button", { name: "Browse…" }).click();
  await (await chooser).setFiles([{ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") }]);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first().locator(".swa-insert-path")).toHaveValue(`${space.folder}/notes.txt`);
  await rows(page).first().locator(".swa-insert-choice", { hasText: "Link" }).click();
  await dialog(page).getByRole("button", { name: "Insert" }).click();
  await expect.poll(() => space.saved("Page")).toContain(`Here\n[[${space.folder}/notes.txt]]`);
  expect(space.hasFile("notes.txt")).toBe(true);
});

test("turned off in the settings: a paste is SilverBullet's own (its prompt), File: Upload its own", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nText\n" }, "Page");
  await runCommand(page, "Silverware Assets: Settings");
  const settings = page.locator(".swa-dialog.swa-settings-window");
  await settings.locator(".swa-settings-check", { hasText: "Use the insert dialog" }).locator("input").uncheck();
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(settings).toHaveCount(0);
  await expect.poll(() => space.config()).toContain("enabled = false");
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
  await cursorAfter(page, "Text");
  await paste(pageText(page), [{ name: "image.png", type: "image/png" }]);
  // (SilverBullet's own prompt for the name, no dialog of ours)
  await expect(page.locator(".sb-modal-box, .sb-modal").filter({ hasText: "File name" })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
});

test("a file pasted into a grid's cell's field: inserted into the cell", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n<grid>\n<cell>\n\nLeft\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n" }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().getByText("Left").click();
  const field = page.locator("#sb-main .swl-grid-editor");
  await expect(field).toBeVisible();
  await page.keyboard.press("End");
  await paste(field, [{ name: "image.png", type: "image/png" }]);
  await expect(dialog(page)).toBeVisible();
  const path = await rows(page).first().locator(".swa-insert-path").inputValue();
  await dialog(page).getByRole("button", { name: "Insert" }).click();
  // (Uploaded, then put into the field: its link there before the field is left, else it is left without it; the caret
  // after it, its markdown shown)
  await expect(field.locator(".cm-content")).toContainText(`![[${path}]]`);
  // (Left by a click below: the cell written)
  await page.locator("#sb-main .cm-line", { hasText: "After" }).click();
  await expect.poll(() => space.saved("Page")).toContain(`<cell>\n\nLeft ![[${path}]]\n\n</cell>`);
});
