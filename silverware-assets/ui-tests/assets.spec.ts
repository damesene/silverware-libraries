// Embedded files (docs/silverware-assets.md) as a user works with them in SilverBullet, in a page and in Silverware
// Layout's grid (shared/rendered.ts, where the two meet): the "…" menu writing a
// view into the embed it is on (the same file in a grid and outside it apart), a file SilverBullet cannot draw as a card,
// a width dragged (in the page, and within a grid's cell), a PDF and a zip in a cell, a link's icon, the settings'
// card fields and a click shown in the side panel.
import { ASSETS_SETTINGS, expect, gridsDrawn, PAGE_LAYOUT, PIXEL_PNG, runCommand, test } from "./helpers.ts";

const cell = (text: string) => `<column>\n\n${text}\n\n</column>`;
const grid = (...cells: string[]) => `<grid>\n${cells.map(cell).join("\n")}\n</grid>\n`;

/** A view chosen in a medium's "…" menu */
async function choose(page: import("@playwright/test").Page, frame: import("@playwright/test").Locator, item: string): Promise<void> {
  await frame.hover();
  await frame.locator(".swa-more").click();
  await page.locator(".swa-popup .swa-menu-item", { hasText: item }).click();
}

test("the same image at a long page's top and end, the top scrolled away: a view chosen at the end written to the end's embed", async ({ page, space }) => {
  const image = `![[${space.folder}/photo.png|Photo|120]]`;
  const filler = Array.from({ length: 200 }, (_, i) => `Line ${i + 1} of the page.`).join("\n\n");
  await space.open({ Page: `# Page\n\nTop:\n\n${image}\n\n${filler}\n\nThe end:\n\n${image}\n\nAfter it.\n` }, "Page", { "photo.png": PIXEL_PNG });
  await page.locator(".cm-scroller").evaluate((scroller) => scroller.scrollTo(0, scroller.scrollHeight));
  const last = page.locator("#sb-main [data-swa-asset]").last();
  await expect(last).toBeVisible();
  // (The top's widget not drawn: the editor draws what is in view)
  await expect(page.locator("#sb-main [data-swa-asset]")).toHaveCount(1);
  await choose(page, last, "Show as a card");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\nTop:\n\n${image}\n\n${filler}\n\nThe end:\n\n![[${space.folder}/photo.png|Photo|120|{ view: icon }]]\n\nAfter it.\n`);
});

test("the same image outside a grid and in it: a view chosen in the grid written to the grid's embed alone, shown at once", async ({ page, space }) => {
  const image = `![[${space.folder}/photo.png|Photo|120]]`;
  await space.open({ Page: `# Page\n\n${image}\n\n${grid(image, "Right")}` }, "Page", { "photo.png": PIXEL_PNG });
  await gridsDrawn(page);
  const inGrid = page.locator("#sb-main .swl-grid [data-swa-asset]").first();
  await expect(inGrid).toHaveAttribute("data-swa-view", "embed");
  await choose(page, inGrid, "Show as a card");
  const written = `![[${space.folder}/photo.png|Photo|120|{ view: icon }]]`;
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${image}\n\n${grid(written, "Right")}`);
  await expect(page.locator("#sb-main .swl-grid [data-swa-asset]").first()).toHaveAttribute("data-swa-view", "icon");
  await expect(page.locator("#sb-main [data-swa-asset]:not(.swl-grid *)").first()).toHaveAttribute("data-swa-view", "embed");
  // Then the one outside the grid: written to its own embed, as the page is now (its text no longer the grid's)
  await choose(page, page.locator("#sb-main [data-swa-asset]:not(.swl-grid *)").first(), "Show as a preview");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n![[${space.folder}/photo.png|Photo|120|{ view: preview }]]\n\n${grid(written, "Right")}`);
});

test("a file SilverBullet cannot draw is a card, its click opening the file in a new tab", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/archive.zip]]\n` }, "Page", { "archive.zip": "not really a zip" });
  const card = page.locator("#sb-main .swa-card");
  await expect(card).toHaveText("archive.zip");
  // (What the click opens taken instead of opened: a tab opened with noopener tells its page nothing)
  await page.evaluate(() => {
    const opened: string[] = ((window as unknown as { swlOpened: string[] }).swlOpened = []);
    window.open = (url?: string | URL) => (opened.push(String(url)), null);
  });
  await card.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { swlOpened: string[] }).swlOpened)).toEqual([`.fs/${encodeURI(`${space.folder}/archive.zip`)}`]);
});

test("an image's width dragged by its handle, staying at its place, written as SilverBullet's size", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/photo.png|Photo|200]]\n\nAfter\n` }, "Page", { "photo.png": PIXEL_PNG });
  const frame = page.locator("#sb-main [data-swa-asset]").first();
  await expect(frame).toHaveAttribute("data-swl-width", "200");
  const left = (await frame.boundingBox())!.x;
  await frame.hover();
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n![[${space.folder}/photo.png|Photo|260]]\n\nAfter\n`);
  await expect.poll(async () => Math.round((await page.locator("#sb-main [data-swa-asset]").first().boundingBox())!.x)).toBe(Math.round(left));
});

test("an image widened to the page's width by its handle: kept at that width as it snaps there, written as its pixels", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/photo.png|Photo|200]]\n\nAfter\n` }, "Page", { "photo.png": PIXEL_PNG });
  const frame = page.locator("#sb-main [data-swa-asset]").first();
  await expect(frame).toHaveAttribute("data-swl-width", "200");
  const text = await page.locator("#sb-main .cm-content").evaluate((content) => {
    const style = getComputedStyle(content);
    return content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  });
  await frame.hover();
  const bar = page.locator(".swl-handle-bar");
  const box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // (To the text's width, its right edge at the text's: the image grows to the right alone)
  await page.mouse.move(box.x + box.width / 2 + (text - 200), box.y + box.height / 2, { steps: 12 });
  // While snapped there: as wide as the text, not back at its 200 px
  await expect.poll(async () => Math.round((await frame.boundingBox())!.width)).toBeGreaterThan(text - 10);
  await page.mouse.up();
  await expect.poll(() => space.saved("Page")).toMatch(new RegExp(`photo\\.png\\|Photo\\|${Math.round(text)}\\]\\]`));
});

test("an image in a grid's cell dragged within the cell: no wider than it, its quarters its guides", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${grid(`![[${space.folder}/photo.png|Photo|100]]`, "Right")}` }, "Page", { "photo.png": PIXEL_PNG });
  await gridsDrawn(page);
  const frame = page.locator("#sb-main .swl-grid [data-swa-asset]").first();
  await expect(frame).toHaveAttribute("data-swl-in-room", "");
  const cellWidth = (await page.locator("#sb-main .swl-grid-cell").first().boundingBox())!.width;
  await frame.hover();
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 1000, box.y + box.height / 2, { steps: 8 });
  await expect(page.locator(".swl-handle-guide-label")).toContainText(["25 %", "50 %", "75 %", "100 %"]);
  await page.mouse.up();
  await expect.poll(async () => /\|Photo\|(\d+)\]\]/.exec((await space.saved("Page")) ?? "")?.[1]).toBe(String(Math.round(cellWidth)));
});

test("a PDF and a zip in a grid's cells: the PDF's viewer as wide as its cell, the zip a card", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${grid(`![[${space.folder}/doc.pdf]]`, `![[${space.folder}/archive.zip]]`)}` }, "Page", { "doc.pdf": "%PDF-1.4\n", "archive.zip": "zip" });
  await gridsDrawn(page);
  const cells = page.locator("#sb-main .swl-grid-cell");
  const pdf = cells.nth(0).locator("[data-swa-asset='pdf']");
  await expect(pdf.locator("object")).toHaveAttribute("data", `.fs/${encodeURI(`${space.folder}/doc.pdf`)}`);
  expect(Math.round((await pdf.boundingBox())!.width)).toBe(Math.round((await cells.nth(0).boundingBox())!.width));
  await expect(cells.nth(1).locator(".swa-card")).toHaveText("archive.zip");
});

test("a link to a file shows its type's icon, in a grid too; a link to a page none", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nSee [[${space.folder}/doc.pdf]] and [[${space.folder}/Other]].\n\n${grid(`In a cell [[${space.folder}/doc.pdf]]`, "Right")}`, Other: "# Other\n" }, "Page", { "doc.pdf": "%PDF-1.4\n" });
  await gridsDrawn(page);
  await expect(page.locator("#sb-main [data-swa-link='pdf'] .swa-link-icon")).toHaveCount(2);
  await expect(page.locator("#sb-main a", { hasText: "Other" }).locator(".swa-link-icon")).toHaveCount(0);
  // Its icon's menu: the link not followed, the file shown enlarged
  const url = page.url();
  await page.locator("#sb-main .swl-grid [data-swa-link='pdf'] .swa-link-icon").click();
  await page.locator(".swa-popup .swa-menu-item", { hasText: "Show enlarged" }).click();
  await expect(page.locator(".swa-popover object")).toHaveAttribute("data", `.fs/${encodeURI(`${space.folder}/doc.pdf`)}`);
  expect(page.url()).toBe(url);
  await page.keyboard.press("Escape");
  await expect(page.locator(".swa-popover")).toHaveCount(0);
});

test("the settings' Assets tab: a card's size shown, a click set to the side panel; the panel shows the file and Esc closes it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/archive.zip]]\n\n![[${space.folder}/photo.png|Photo||{ view: preview }]]\n` }, "Page", { "archive.zip": "zip", "photo.png": PIXEL_PNG });
  await expect(page.locator("#sb-main .swa-card")).toHaveText("archive.zip");
  await runCommand(page, ASSETS_SETTINGS);
  const dialog = page.locator(".swa-dialog");
  await dialog.getByRole("tab", { name: "Assets" }).click();
  await dialog.getByLabel("Its size").check();
  await dialog.getByLabel("All files: a click").selectOption("peek");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => space.config()).toContain('click = "peek"');
  await expect(page.locator("#sb-main .swa-card-size")).toHaveText("3 B");
  await page.locator("#sb-main [data-swa-asset='image'] img").click();
  const peek = page.locator(".swa-peek");
  await expect(peek.locator(".swa-panel-title")).toHaveText("Photo");
  await expect(peek.locator(".swa-panel-body img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(peek).toHaveCount(0);
});

test("a link shown as embedded by its icon's menu, and the embed shown as a link again by its own, each the one it is", async ({ page, space }) => {
  const link = `[[${space.folder}/doc.pdf]]`;
  await space.open({ Page: `# Page\n\nA ${link} here.\n\n${grid(`Cell ${link}`, "Right")}` }, "Page", { "doc.pdf": "%PDF-1.4\n" });
  await gridsDrawn(page);
  const pick = async (trigger: import("@playwright/test").Locator, label: string) => {
    await trigger.click();
    await page.locator(".swa-popup .swa-menu-item", { hasText: label }).click();
  };
  await pick(page.locator("#sb-main .swl-grid [data-swa-link] .swa-link-icon"), "Show as embedded");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\nA ${link} here.\n\n${grid(`Cell !${link}`, "Right")}`);
  const embedded = page.locator("#sb-main .swl-grid [data-swa-asset='pdf']");
  await embedded.hover();
  await pick(embedded.locator(".swa-more"), "Show as a link");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\nA ${link} here.\n\n${grid(`Cell ${link}`, "Right")}`);
});

test("SilverBullet's markdown shown as written: media and grids hidden, their markdown alone; shown again after", async ({ page, space }) => {
  const image = `![[${space.folder}/photo.png|Photo|120]]`;
  await space.open({ Page: `# Page\n\n${image}\n\n${grid("Left", "Right")}` }, "Page", { "photo.png": PIXEL_PNG });
  await gridsDrawn(page);
  const medium = page.locator("#sb-main [data-swa-asset]:not(.swa-frame)").first();
  const shownGrid = page.locator("#sb-main .swl-grid");
  await expect(medium).toBeVisible();
  await runCommand(page, "Editor: Toggle Markdown Syntax Rendering");
  await expect(page.locator("#sb-main .cm-content")).toContainText(image);
  await expect(medium).toBeHidden();
  await expect(shownGrid).toBeHidden();
  await runCommand(page, "Editor: Toggle Markdown Syntax Rendering");
  await expect(page.locator("#sb-main [data-swa-asset]:not(.swa-frame)").first()).toBeVisible();
  await expect(page.locator("#sb-main .swl-grid")).toBeVisible();
});

test("SilverBullet's markdown shown as written: a click on an embed's `![[` places the cursor, SilverBullet not told of it, a text pointer over it; the Markdown tab's box off, SilverBullet's click again", async ({ page, space }) => {
  const image = `![[${space.folder}/photo.png|Photo|120]]`;
  await space.open({ Page: `# Page\n\n${image}\n\nAfter\n` }, "Page", { "photo.png": PIXEL_PNG });
  const url = page.url();
  const clickAtStart = async () => {
    const line = page.locator("#sb-main .cm-line", { hasText: "photo.png" });
    const box = (await line.boundingBox())!;
    await page.mouse.click(box.x + 3, box.y + 8);
  };
  const cursor = () => page.evaluate(() => (window as unknown as { client: { editorView: { state: { selection: { main: { head: number } } } } } }).client.editorView.state.selection.main.head);
  // The clicks SilverBullet is told of (its editor's listener is under `#sb-main`): counted there
  await page.evaluate(() => {
    const seen = window as unknown as { swlClicks: number };
    seen.swlClicks = 0;
    document.querySelector("#sb-main")!.addEventListener("click", () => void seen.swlClicks++);
  });
  const told = () => page.evaluate(() => (window as unknown as { swlClicks: number }).swlClicks);
  await runCommand(page, "Editor: Toggle Markdown Syntax Rendering");
  await expect(page.locator("#sb-main .cm-content")).toContainText(image);
  // The text's pointer over it, no hand: nothing to follow there
  await expect
    .poll(() => page.locator("#sb-main .cm-line", { hasText: "photo.png" }).evaluate((line) => [...line.querySelectorAll("span")].map((span) => getComputedStyle(span).cursor)))
    .not.toContain("pointer");
  // (SilverBullet follows an embed's line on a click anywhere on it, its `!` too: held back, the cursor at the click)
  await clickAtStart();
  // (The cursor in the embed's line, where the click was; a long path wraps the line, so not asked to the character)
  const start = "# Page\n\n".length;
  await expect.poll(cursor).toBeGreaterThanOrEqual(start);
  expect(await cursor()).toBeLessThanOrEqual(start + image.length);
  expect(await told()).toBe(0);
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);
  // The box off in the settings' Markdown tab: the click SilverBullet's again (what it does with it, its own)
  await runCommand(page, ASSETS_SETTINGS);
  const dialog = page.locator(".swa-dialog");
  await dialog.getByRole("tab", { name: "Markdown" }).click();
  await dialog.getByLabel("A click on a link only places the cursor").uncheck();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => space.config()).toContain('config.set("silverware.assets.syntaxMode.clickPlacesCursor", false)');
  // (Once SilverBullet has loaded its configuration again: the root no longer marked for it)
  await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute("data-swa-syntax-clicks")), { timeout: 15_000 }).toBe(false);
  await clickAtStart();
  await expect.poll(told).toBe(1);
  if (page.url() !== url) await page.goBack();
  await runCommand(page, "Editor: Toggle Markdown Syntax Rendering");
});

test("SilverBullet's markdown shown as written, each plugin's box off apart: files kept by Silverware Assets', grids by Silverware Layout's", async ({ page, space }) => {
  const image = `![[${space.folder}/photo.png|Photo|120]]`;
  await space.open({ Page: `# Page\n\n${image}\n\n${grid("Left", "Right")}` }, "Page", { "photo.png": PIXEL_PNG });
  await gridsDrawn(page);
  const file = page.locator("#sb-main [data-swa-asset]:not(.swa-frame)").first();
  const shownGrid = page.locator("#sb-main .swl-grid");
  const toggle = () => runCommand(page, "Editor: Toggle Markdown Syntax Rendering");
  // Assets' box off: the file drawn there, the grid still hidden
  await runCommand(page, ASSETS_SETTINGS);
  const assets = page.locator(".swa-dialog");
  await assets.getByRole("tab", { name: "Markdown" }).click();
  await assets.getByLabel("Hide embedded files").uncheck();
  await assets.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => space.config()).toContain('config.set("silverware.assets.syntaxMode.hideAssets", false)');
  await toggle();
  await expect(page.locator("#sb-main .cm-content")).toContainText(image);
  await expect(file).toBeVisible();
  await expect(shownGrid).toBeHidden();
  await toggle();
  // Layout's box off too: the grid drawn there as well (its dialog opened again where SilverBullet, loading the
  // configuration Assets saved, started Silverware Layout again under it)
  const layout = page.locator(".swl-dialog");
  await expect(async () => {
    if (!(await layout.isVisible())) await runCommand(page, PAGE_LAYOUT);
    await layout.getByRole("tab", { name: "Markdown" }).click({ timeout: 2_000 });
    await layout.getByLabel("Hide grids").uncheck({ timeout: 2_000 });
    await layout.getByRole("button", { name: "Save" }).click({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect.poll(() => space.config()).toContain('config.set("silverware.layout.syntaxMode.hideGrids", false)');
  await toggle();
  await expect(file).toBeVisible();
  await expect(shownGrid).toBeVisible();
  await toggle();
});

test("a card opens its menu from its icon, no button over it; what is chosen there is written", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/archive.zip]]\n` }, "Page", { "archive.zip": "zip" });
  const card = page.locator("#sb-main .swa-card");
  await expect(card).toHaveText("archive.zip");
  await card.hover();
  await expect(page.locator("#sb-main [data-swa-asset] .swa-more")).toHaveCount(0);
  await card.locator(".swa-icon").click();
  await page.locator(".swa-popup .swa-menu-item", { hasText: "Show as a link" }).click();
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n[[${space.folder}/archive.zip]]\n`);
});
