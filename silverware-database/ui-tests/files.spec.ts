// Files & media (docs/silverware-database-files.md) against SilverBullet, every plugin installed (Silverware Assets
// among them): a value's files drawn in a table's cell and the peek's row, a file opened by a press.
import { expect, test } from "./helpers.ts";

// A pixel of PNG, each image of the test one
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const ROOT = "---\ntags: [db-root]\n_database:\n  id: files\n  name: Files\n  version: 1\n  properties:\n    photos: { type: files, label: Photos }\n---\n";
const withFiles = (folder: string, rank: string, files: readonly string[]) => `---\ntags: [db]\nphotos:\n${files.map((one) => `  - "[[${folder}/files/${one}]]"`).join("\n")}\n_database:\n  rank: ${rank}\n---\n`;

test("a value's files: a table's cell draws three and counts the rest, a press opens one in the side panel, not the cell's editor; the peek draws every one larger", async ({ page, space }) => {
  const names = ["a.png", "b.png", "c.png", "report.pdf"];
  await space.open(
    { Page: "# Page\n\n```silverware-database\nid: files\nview: table\n```\n", "Page/db-files": ROOT, "Page/db-files/Holiday": withFiles(space.folder, "a0", names) },
    "Page",
    Object.fromEntries(names.map((name) => [`files/${name}`, name.endsWith(".png") ? PNG : "%PDF-1.4\n"])),
  );
  const cell = page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator('td[data-key="photos"]');
  const buttons = cell.locator(".swd-media-button");
  await expect(buttons).toHaveCount(3);
  await expect(cell.locator(".swd-media-more")).toHaveText("+1");
  await expect(cell.locator(".swd-media-more")).toHaveAttribute("title", "report.pdf");
  // (Each image itself, fitted in the line: no higher than it)
  const image = buttons.first().locator("img");
  await expect(image).toHaveAttribute("src", /files\/a\.png$/);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && !!img.style.height)).toBe(true);
  expect(Math.round((await image.boundingBox())!.height)).toBe(28);
  expect((await cell.locator(".swd-media-strip").boundingBox())!.height).toBeLessThanOrEqual(28.5);
  // A file pressed: in Silverware Assets' side panel, the cell not edited
  await buttons.nth(1).click();
  await expect(page.locator(".swa-side-panel .swa-panel-title")).toHaveText("b.png");
  await expect(page.locator(".swa-side-panel .swa-panel-body img")).toBeVisible();
  await expect(cell.locator(".swd-editor")).toHaveCount(0);
  await expect(page.locator(".swd-floated")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".swa-side-panel")).toHaveCount(0);
  // The peek: as a table's row (small, side by side, the rest counted), a pencil after them to edit the value
  await page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator(".swd-open").click();
  const row = page.locator('.swd-peek .swd-peek-value[data-key="photos"]');
  await expect(row.locator(".swd-media-button")).toHaveCount(3);
  await expect(row.locator(".swd-media-more")).toHaveText("+1");
  await expect(row.locator(".swd-peek-edit")).toHaveCount(1);
  // (The panel and its properties' box with the plugins' thin scrollbar: shared/scrollbar.css)
  await expect(page.locator(".swd-peek-props-box")).toHaveCSS("scrollbar-width", "thin");
  await expect(page.locator(".swd-peek")).toHaveCSS("scrollbar-width", "thin");
  const small = row.locator(".swd-media-button").first().locator("img");
  await expect.poll(() => small.evaluate((img: HTMLImageElement) => img.complete && !!img.style.height)).toBe(true);
  expect(Math.round((await small.boundingBox())!.height)).toBe(28);
  // A press on a file there opens it too, the peek kept
  await row.locator(".swd-media-button").nth(2).click();
  await expect(page.locator(".swa-side-panel .swa-panel-title")).toHaveText("c.png");
  await expect(page.locator(".swd-peek")).toBeVisible();
  await expect(row.locator(".swd-editor")).toHaveCount(0);
  // Its pencil: the files' editor in the row, Esc putting it aside
  await page.keyboard.press("Escape");
  await expect(page.locator(".swa-side-panel")).toHaveCount(0);
  await row.locator(".swd-peek-edit").click();
  await expect(row.locator(".swd-editor-files .swd-files-row")).toHaveCount(names.length);
  // (Laid over the page, not cut by the properties' box: its Upload in view)
  await expect(page.locator(".swd-editor-files.swd-floated")).toHaveCount(1);
  await expect(page.locator(".swd-editor-files .swd-files-upload")).toBeInViewport({ ratio: 1 });
  await page.locator(".swd-editor-files .swd-files-upload").press("Escape");
  await expect(row.locator(".swd-editor-files")).toHaveCount(0);
  await expect(row.locator(".swd-media-more")).toHaveText("+1");
});

test("a value's files edited in its popup: one taken out, one dragged by its grip, one found in the space, one uploaded through Silverware Assets into the database's folder", async ({ page, space }) => {
  const names = ["a.png", "b.png", "c.png"];
  await space.open(
    { Page: "# Page\n\n```silverware-database\nid: files\nview: table\n```\n", "Page/db-files": ROOT, "Page/db-files/Holiday": withFiles(space.folder, "a0", names) },
    "Page",
    { ...Object.fromEntries(names.map((name) => [`files/${name}`, PNG])), "Elsewhere/sunrise.png": PNG },
  );
  const cell = page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator('td[data-key="photos"]');
  await expect(cell.locator(".swd-media-button")).toHaveCount(3);
  // A press in the cell beside the files: the popup (laid over the page from the body), its search focused
  const box = (await cell.boundingBox())!;
  await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
  const popup = page.locator(".swd-editor-files");
  const rows = popup.locator(".swd-files-row");
  const shown = () => rows.evaluateAll((all) => all.map((one) => (one as HTMLElement).title));
  await expect.poll(shown).toEqual(["a.png", "b.png", "c.png"]);
  await expect(popup.getByRole("button", { name: "+ Add files…" })).toBeFocused();
  // A file's menu: another's opened closes it; its ⋯ pressed again closes it alone, the popup kept
  await popup.getByRole("button", { name: "a.png: its menu" }).click();
  await popup.getByRole("button", { name: "c.png: its menu" }).click();
  await expect(popup.locator(".swd-files-menu:visible")).toHaveCount(1);
  // (Whole in the window: placed by the script within it)
  await expect(popup.locator(".swd-files-menu:visible")).toBeInViewport({ ratio: 1 });
  await popup.getByRole("button", { name: "c.png: its menu" }).click();
  await expect(popup.locator(".swd-files-menu:visible")).toHaveCount(0);
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "b.png: its menu" }).click();
  await expect(popup.getByRole("menuitem", { name: "Download" })).toHaveAttribute("download", "b.png");
  await popup.getByRole("button", { name: "Take b.png out" }).click();
  await expect.poll(shown).toEqual(["a.png", "c.png"]);
  // (A press on a file, in it but on no control: still open)
  await rows.first().locator(".swd-media").click();
  await expect.poll(shown).toEqual(["a.png", "c.png"]);
  // c.png dragged by its grip above a.png (measured once its row has its height: its image loaded and sized)
  await expect.poll(() => popup.locator(".swd-files-row img").evaluateAll((images) => images.every((one) => (one as HTMLImageElement).complete && !!(one as HTMLImageElement).style.height))).toBe(true);
  const grip = (await popup.getByRole("button", { name: /^Move c\.png/ }).boundingBox())!;
  const first = (await popup.locator(".swd-files-row").first().boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, first.y + 4, { steps: 8 });
  await page.mouse.up();
  await expect.poll(shown).toEqual(["c.png", "a.png"]);
  // Added through Silverware Assets' dialog: one found in the space by words of its path, one uploaded
  await popup.getByRole("button", { name: "+ Add files…" }).click();
  const dialog = page.locator(".swa-dialog.swa-insert-window");
  await dialog.getByRole("button", { name: "Space" }).click();
  await dialog.locator(".swa-insert-source-field").last().fill("elsewhere sunrise");
  await dialog.locator(".swa-insert-found-item", { hasText: "sunrise.png" }).click();
  // Uploaded: Silverware Assets' dialog, its name alone asked, the file written into the database's folder of files
  const chooser = page.waitForEvent("filechooser");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Files…" }).click();
  await (await chooser).setFiles({ name: "beach.png", mimeType: "image/png", buffer: PNG });
  await expect(dialog.locator(".swa-insert-path:visible")).toHaveValue(`${space.folder}/Page/db-files/files/beach.png`);
  await expect(dialog.locator(".swa-dialog-note")).toHaveText("1 to upload · 1 from your space");
  await expect(dialog.locator(".swa-insert-choices:visible")).toHaveCount(0);
  await dialog.getByRole("button", { name: /^(Add|Insert)/ }).click();
  await expect.poll(shown).toEqual(["c.png", "a.png", "sunrise.png", "beach.png"]);
  // Left: written as listed, each a link
  await page.keyboard.press("Tab");
  await page.locator(".swd-table thead").click();
  await expect(popup).toHaveCount(0);
  await expect
    .poll(() => space.saved("Page/db-files/Holiday"))
    .toContain(`photos:\n  - "[[${space.folder}/files/c.png]]"\n  - "[[${space.folder}/files/a.png]]"\n  - "[[${space.folder}/Elsewhere/sunrise.png]]"\n  - "[[${space.folder}/Page/db-files/files/beach.png]]"\n`);
  await expect(cell.locator(".swd-media-button")).toHaveCount(3);
  await expect(cell.locator(".swd-media-more")).toHaveText("+1");
});

/** Files dropped on an element, or pasted on it (`paste`), as a browser's drop and paste carry them */
async function give(target: import("@playwright/test").Locator, names: readonly string[], how: "drop" | "paste"): Promise<void> {
  await target.evaluate(
    (element, { names, how, png }) => {
      const data = new DataTransfer();
      for (const name of names) data.items.add(new File([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], name, { type: "image/png" }));
      if (how === "paste") return void element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
      const box = element.getBoundingClientRect();
      const at = { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
      for (const type of ["dragenter", "dragover", "drop"]) element.dispatchEvent(new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true, composed: true, ...at }));
    },
    { names, how, png: PNG.toString("base64") },
  );
}

test("files dropped or pasted on a value of files: Silverware Assets' dialog of their names, the files added at the value's end, nothing put in the page", async ({ page, space }) => {
  const root = ROOT.replace("    photos:", "    status: { type: select, label: Status, options: [Todo] }\n    photos:");
  const text = "# Page\n\n```silverware-database\nid: files\nview: table\n```\n\n```silverware-database\nid: files\nview: board\nboard.hiddenProperties: []\n```\n";
  await space.open({ Page: text, "Page/db-files": root, "Page/db-files/Holiday": withFiles(space.folder, "a0", ["a.png"]).replace("photos:", "status: Todo\nphotos:") }, "Page", { "files/a.png": PNG });
  const dialog = page.locator(".swa-dialog.swa-insert-window");
  const insert = async (name: string) => {
    await expect(dialog).toBeVisible();
    // (Its name in the database's folder of files, nothing asked of how it is shown)
    await expect(dialog.locator(".swa-insert-path")).toHaveValue(new RegExp(`^${space.folder}/Page/db-files/files/.+\\.png$`));
    await expect(dialog.locator(".swa-insert-choices:visible")).toHaveCount(0);
    await dialog.locator(".swa-insert-path").fill(`${space.folder}/Page/db-files/files/${name}`);
    await dialog.getByRole("button", { name: /^(Add|Insert)/ }).click();
    await expect(dialog).toHaveCount(0);
  };
  const saved = (...names: string[]) => `photos:\n  - "[[${space.folder}/files/a.png]]"\n${names.map((one) => `  - "[[${space.folder}/Page/db-files/files/${one}]]"\n`).join("")}`;
  const cell = page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator('td[data-key="photos"]');
  await expect(cell.locator(".swd-media-button")).toHaveCount(1);
  // Dropped on a table's cell
  await give(cell, ["dropped.png"], "drop");
  await insert("dropped.png");
  await expect.poll(() => space.saved("Page/db-files/Holiday")).toContain(saved("dropped.png"));
  // Pasted on the cell focused (by Tab): SilverBullet's editor takes none of it
  await cell.focus();
  await give(cell, ["pasted.png"], "paste");
  await insert("pasted.png");
  await expect.poll(() => space.saved("Page/db-files/Holiday")).toContain(saved("dropped.png", "pasted.png"));
  // Dropped on a board's card (on its name: the view's one value of files)
  await give(page.locator(".swd-board-card", { hasText: "Holiday" }).locator(".swd-board-name"), ["card.png"], "drop");
  await insert("card.png");
  await expect.poll(() => space.saved("Page/db-files/Holiday")).toContain(saved("dropped.png", "pasted.png", "card.png"));
  // Pasted on the peek's row focused
  await page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator(".swd-open").click();
  const row = page.locator('.swd-peek .swd-peek-value[data-key="photos"]');
  await expect(row.locator(".swd-media-more")).toHaveText("+1");
  await row.focus();
  await give(row, ["peek.png"], "paste");
  await insert("peek.png");
  await expect.poll(() => space.saved("Page/db-files/Holiday")).toContain(saved("dropped.png", "pasted.png", "card.png", "peek.png"));
  await expect(row.locator(".swd-media-more")).toHaveText("+2");
  // The page as it was: no file put in it, by Silverware Assets nor by SilverBullet
  expect(await space.saved("Page")).toBe(text);
});

test("files dropped on the files' popup: added to its list, written as it is left", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: files\nview: table\n```\n", "Page/db-files": ROOT, "Page/db-files/Holiday": withFiles(space.folder, "a0", ["a.png"]) }, "Page", { "files/a.png": PNG });
  const cell = page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator('td[data-key="photos"]');
  const box = (await cell.boundingBox())!;
  await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
  const popup = page.locator(".swd-editor-files");
  await expect(popup.locator(".swd-files-row")).toHaveAttribute("title", "a.png");
  await give(popup, ["dropped.png"], "drop");
  const dialog = page.locator(".swa-dialog.swa-insert-window");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^(Add|Insert)/ }).click();
  // (The popup kept open under the dialog: its companion)
  await expect.poll(() => popup.locator(".swd-files-row").evaluateAll((all) => all.map((one) => (one as HTMLElement).title))).toEqual(["a.png", "dropped.png"]);
  await page.locator(".swd-table thead").click();
  await expect(popup).toHaveCount(0);
  await expect.poll(() => space.saved("Page/db-files/Holiday")).toContain(`  - "[[${space.folder}/Page/db-files/files/dropped.png]]"`);
});

test("a board's Card preview: the first image of the property picked over each card, opened by a press, files dropped there added to it; None takes it off", async ({ page, space }) => {
  const root = ROOT.replace("    photos: { type: files, label: Photos }", "    status: { type: select, label: Status, options: [Todo] }\n    docs: { type: files, label: Docs }\n    photos: { type: files, label: Photos }");
  const card = `---\ntags: [db]\nstatus: Todo\ndocs: ["[[${space.folder}/files/a.png]]"]\nphotos: ["[[${space.folder}/files/report.pdf]]", "[[${space.folder}/files/b.png]]"]\n_database:\n  rank: a0\n---\n`;
  await space.open(
    { Page: "# Page\n\n```silverware-database\nid: files\nview: board\n```\n", "Page/db-files": root, "Page/db-files/Holiday": card },
    "Page",
    { "files/a.png": PNG, "files/b.png": PNG, "files/report.pdf": "%PDF-1.4\n" },
  );
  const holiday = page.locator(".swd-board-card", { hasText: "Holiday" });
  await expect(holiday).toBeVisible();
  await expect(holiday.locator(".swd-board-cover")).toHaveCount(0);
  // Card preview in ⋯: None and the properties of files, Photos picked
  await page.locator(".swd-more").click();
  await page.locator(".swd-menu .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^Card preview/ }) }).click();
  await expect(page.locator(".swd-menu:not([hidden]) .swd-menu-item .swd-label")).toContainText(["None", "Docs", "Photos"]);
  await page.locator(".swd-menu:not([hidden]) .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^Photos$/ }) }).click();
  // (Kept in the block; its first image, the PDF before it passed over)
  await expect.poll(() => space.saved("Page")).toContain("board.cardPreview: photos");
  const cover = holiday.locator(".swd-board-cover");
  await expect(cover).toHaveAttribute("aria-label", "Open b.png");
  await expect(cover.locator("img")).toHaveAttribute("src", /files\/b\.png$/);
  // (As wide as the card at most)
  const [coverBox, cardBox] = [(await cover.boundingBox())!, (await holiday.boundingBox())!];
  expect(coverBox.width).toBeLessThanOrEqual(cardBox.width + 0.5);
  await cover.click();
  await expect(page.locator(".swa-side-panel .swa-panel-title")).toHaveText("b.png");
  await page.keyboard.press("Escape");
  // Files dropped on the cover: added to its property, not the first of the card
  await give(cover, ["beach.png"], "drop");
  const dialog = page.locator(".swa-dialog.swa-insert-window");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^(Add|Insert)/ }).click();
  await expect.poll(() => space.saved("Page/db-files/Holiday")).toContain("beach.png");
  const saved = (await space.saved("Page/db-files/Holiday"))!;
  expect(saved).toContain(`docs: ["[[${space.folder}/files/a.png]]"]`);
  // (In the order kept, the new one last, in the list's own form: a list on one line kept so)
  expect(saved).toMatch(/photos: \["\[\[[^\n"]*report\.pdf\]\]", "\[\[[^\n"]*b\.png\]\]", "\[\[[^\n"]*beach\.png\]\]"\]/);
  // None: no cover
  await page.locator(".swd-more").click();
  await page.locator(".swd-menu .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^Card preview/ }) }).click();
  await page.locator(".swd-menu:not([hidden]) .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^None$/ }) }).click();
  await expect(holiday.locator(".swd-board-cover")).toHaveCount(0);
  await expect.poll(() => space.saved("Page")).not.toContain("cardPreview");
});

/** SilverBullet's question answered (its modal's Ok or Cancel), once it says what is given */
async function answer(page: import("@playwright/test").Page, says: string, ok: boolean): Promise<void> {
  const prompt = page.locator("dialog.sb-modal-box .sb-prompt");
  await expect(prompt).toContainText(says);
  await prompt.locator(".sb-prompt-buttons button", { hasText: ok ? "Ok" : "Cancel" }).click();
  await expect(prompt).toHaveCount(0);
}

test("an item removed: the files it alone named in the database's folder offered for deletion, deleted where asked; those another item names kept", async ({ page, space }) => {
  const at = (name: string) => `${space.folder}/Page/db-files/files/${name}`;
  const value = (...names: string[]) => `---\ntags: [db]\nphotos:\n${names.map((one) => `  - "[[${at(one)}]]"`).join("\n")}\n_database:\n  rank: a0\n---\n`;
  await space.open(
    { Page: "# Page\n\n```silverware-database\nid: files\nview: table\n```\n", "Page/db-files": ROOT, "Page/db-files/Holiday": value("alone.png", "shared.png"), "Page/db-files/Work": value("shared.png").replace("a0", "a1") },
    "Page",
    { "Page/db-files/files/alone.png": PNG, "Page/db-files/files/shared.png": PNG },
  );
  await page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator(".swd-remove").click();
  await answer(page, 'Remove "Holiday"?', true);
  await answer(page, "Delete its file too (alone.png)? No other item names it; Undo of the removal does not bring it back.", true);
  await expect.poll(() => space.hasFile("Page/db-files/files/alone.png")).toBe(false);
  expect(space.hasFile("Page/db-files/files/shared.png")).toBe(true);
  await expect(page.locator(".swd-table tbody tr")).toHaveCount(1);
});

test("a database deleted with its files where ticked in its dialog", async ({ page, space }) => {
  await space.open(
    { Page: "# Page\n\n```silverware-database\nid: files\nview: table\n```\n", "Page/db-files": ROOT, "Page/db-files/Holiday": withFiles(space.folder, "a0", ["a.png"]) },
    "Page",
    { "files/a.png": PNG, "Page/db-files/files/up.png": PNG, "Page/db-files/files/more.png": PNG },
  );
  await page.locator(".swd-more").click();
  await page.locator(".swd-menu .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^Delete database/ }) }).click();
  const dialog = page.locator(".swd-delete-database");
  const files = dialog.locator(".swd-delete-files");
  await expect(files).toContainText(`Also delete its uploaded files: 2 files in ${space.folder}/Page/db-files/files. Undo does not bring them back.`);
  // (Not by default)
  await expect(files.locator("input")).not.toBeChecked();
  await files.locator("input").check();
  await dialog.locator(".swd-delete-name").fill("Files");
  await dialog.locator(".swd-delete-confirm").click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => space.hasFile("Page/db-files/files/up.png")).toBe(false);
  expect(space.hasFile("Page/db-files/files/more.png")).toBe(false);
  // (A file it linked outside its folder kept)
  expect(space.hasFile("files/a.png")).toBe(true);
});

test("files zoom with the content (Silverware Layout's font zoom with files): a cell's line, its images and a card's cover twice as large at twice the zoom", async ({ page, space }) => {
  const root = ROOT.replace("    photos:", "    status: { type: select, label: Status, options: [Todo] }\n    photos:");
  const card = withFiles(space.folder, "a0", ["a.png", "report.pdf"]).replace("photos:", "status: Todo\nphotos:");
  await space.open(
    { Page: "# Page\n\n```silverware-database\nid: files\nview: table\n```\n\n```silverware-database\nid: files\nview: board\nboard.cardPreview: photos\n```\n", "Page/db-files": root, "Page/db-files/Holiday": card },
    "Page",
    { "files/a.png": PNG, "files/report.pdf": "%PDF-1.4\n" },
  );
  const cell = page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator('td[data-key="photos"]');
  const image = cell.locator(".swd-media-button img");
  const cover = page.locator(".swd-board-cover img");
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && !!img.style.height)).toBe(true);
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && !!img.style.height)).toBe(true);
  const sizes = async () => ({
    strip: Math.round((await cell.locator(".swd-media-strip").boundingBox())!.height),
    image: Math.round((await image.boundingBox())!.height),
    file: Math.round((await cell.locator('[data-swd-media="file"]').boundingBox())!.height),
    cover: Math.round((await cover.boundingBox())!.height),
  });
  const before = await sizes();
  expect([before.strip, before.image, before.cover]).toEqual([28, 28, 160]);
  // (The scale Silverware Layout sets on the root as the font is zoomed, files following it: nothing drawn again)
  await page.evaluate(() => document.documentElement.style.setProperty("--sw-content-scale", "2"));
  expect(before.file).toBe(24);
  await expect.poll(sizes).toEqual({ strip: 56, image: 56, file: 48, cover: 320 });
  await page.evaluate(() => document.documentElement.style.removeProperty("--sw-content-scale"));
  await expect.poll(sizes).toEqual(before);
});

test("a large image in the files' popup held in its box while it loads, not drawn at its own size first", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: files\nview: table\n```\n", "Page/db-files": ROOT, "Page/db-files/Holiday": withFiles(space.folder, "a0", ["big.png"]) }, "Page", { "files/big.png": PNG });
  // (A photo of 2000 × 1500 px whose data comes slowly: its size known from the first, its pixels held back)
  const big = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement("canvas"), { width: 2000, height: 1500 });
    const blob = await new Promise<Blob>((done) => canvas.toBlob((made) => done(made!), "image/png"));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  let release!: () => void;
  const held = new Promise<void>((done) => (release = done));
  await page.route(/\/big\.png(\?.*)?$/, async (route) => {
    await held;
    await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(big) });
  });
  const cell = page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator('td[data-key="photos"]');
  const box = (await cell.boundingBox())!;
  await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
  const image = page.locator(".swd-editor-files .swd-files-row img");
  await expect(image).toHaveCount(1);
  // While it loads: within its box (150 × 150) by the style page alone
  const loading = await image.evaluate((img: HTMLImageElement) => ({ complete: img.complete, sized: img.style.height, maxWidth: getComputedStyle(img).maxWidth, maxHeight: getComputedStyle(img).maxHeight }));
  expect(loading).toEqual({ complete: false, sized: "", maxWidth: "150px", maxHeight: "150px" });
  release();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && !!img.style.height)).toBe(true);
  const loaded = (await image.boundingBox())!;
  expect([Math.round(loaded.width), Math.round(loaded.height)]).toEqual([150, 113]);
});

test("a board's card narrower than its files: they shrink, their names cut, the rest's count whole within the card", async ({ page, space }) => {
  const root = ROOT.replace("    photos:", "    status: { type: select, label: Status, options: [Todo] }\n    photos:");
  const names = ["first report.pdf", "second report.pdf", "third report.pdf", "fourth.pdf"];
  const card = withFiles(space.folder, "a0", names).replace("photos:", "status: Todo\nphotos:");
  await space.open(
    { Page: "# Page\n\n```silverware-database\nid: files\nview: board\nboard.hiddenProperties: []\n```\n", "Page/db-files": root, "Page/db-files/Reports": card },
    "Page",
    Object.fromEntries(names.map((name) => [`files/${name}`, "%PDF-1.4\n"])),
  );
  const value = page.locator(".swd-board-card", { hasText: "Reports" }).locator('.swd-board-value[data-key="photos"]');
  await expect(value.locator(".swd-media-button")).toHaveCount(3);
  const box = (await page.locator(".swd-board-card", { hasText: "Reports" }).boundingBox())!;
  const more = (await value.locator(".swd-media-more").boundingBox())!;
  expect(more.width).toBeGreaterThan(0);
  expect(more.x + more.width).toBeLessThanOrEqual(box.x + box.width);
  await expect(value.locator(".swd-media-more")).toHaveText("+1");
});
