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

// SILVERBULLET-INTERNAL (src/host/silverbullet/editorposition.ts): a SilverBullet changing what it is fails here, by name
test("SilverBullet's editor gives a widget's position: client.editorView.posAtDOM, an embed's start, a link within it", async ({ page, space }) => {
  // (The same file twice, its embeds' texts apart: SilverBullet 2.12.1 draws one text's medium in one of its widgets alone)
  const image = (alt: string) => `![[${space.folder}/photo.png|${alt}]]`;
  const link = `[[${space.folder}/doc.pdf]]`;
  await space.open({ Page: `# Page\n\n${image("A")}\n\nSee ${link} here.\n\n${image("B")}\n` }, "Page", { "photo.png": PIXEL_PNG, "doc.pdf": "%PDF-1.4\n" });
  await expect(page.locator("#sb-main [data-swa-asset]")).toHaveCount(2);
  await expect(page.locator("#sb-main [data-swa-link]")).toHaveCount(1);
  const found = await page.evaluate(() => {
    const view = (window as unknown as { client: { editorView: { posAtDOM(node: Node, offset: number): number; state: { doc: { toString(): string } } } } }).client.editorView;
    const top = (element: Element) => {
      let at = element;
      while (at.parentElement && !at.parentElement.matches(".cm-content")) at = at.parentElement;
      return at;
    };
    return {
      text: view.state.doc.toString(),
      embeds: [...document.querySelectorAll("#sb-main [data-swa-asset]")].map((frame) => view.posAtDOM(top(frame), 0)),
      link: view.posAtDOM(document.querySelector("#sb-main [data-swa-link]")!, 0),
    };
  });
  expect(found.embeds).toEqual([found.text.indexOf(image("A")), found.text.indexOf(image("B"))]);
  const linkAt = found.text.indexOf(link);
  expect(found.link).toBeGreaterThanOrEqual(linkAt);
  expect(found.link).toBeLessThan(linkAt + link.length);
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

test("a PDF's viewer as wide as its frame, its handle shown from beside its right edge (the viewer tells the page of no move over it)", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.pdf]]\n\n![[${space.folder}/doc.pdf|Doc|200]]\n\nAfter\n` }, "Page", { "doc.pdf": "%PDF-1.4\n" });
  const frames = page.locator("#sb-main [data-swa-asset='pdf']");
  await expect(frames).toHaveCount(2);
  const width = async (locator: import("@playwright/test").Locator) => Math.round((await locator.boundingBox())!.width);
  // Without a size of its own: the frame's width; with one: its own
  await expect.poll(async () => (await width(frames.first().locator("object"))) === (await width(frames.first()))).toBe(true);
  await expect.poll(() => width(frames.nth(1).locator("object"))).toBe(200);
  // As tall as the original's setting (480 px), not the browser's 150 px of an object: no preview's size
  await expect.poll(async () => Math.round((await frames.first().locator("object").boundingBox())!.height)).toBe(480);
  // From the page right of it to just beside its edge, where the bar is: shown
  const box = (await frames.first().boundingBox())!;
  await page.mouse.move(box.x + box.width + 120, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width + 6, box.y + box.height / 2, { steps: 8 });
  await expect(page.locator(".swl-handle-bar")).toBeVisible();
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

test("a preview's size the settings' (all files, a type's own), never widened by a handle, a PDF's neither", async ({ page, space }) => {
  await space.open(
    { Page: `# Page\n\n![[${space.folder}/doc.pdf|||{ view: preview }]]\n\nBetween\n\n![[${space.folder}/photo.png|Photo||{ view: preview }]]\n` },
    "Page",
    { "doc.pdf": "%PDF-1.4\n", "photo.png": PIXEL_PNG },
  );
  const pdf = page.locator("#sb-main [data-swa-asset='pdf']");
  await expect(pdf.locator(".swa-pdf")).toBeVisible();
  // Beside a preview its grip for its menu alone, no width to drag: its size is the settings'
  const box = (await pdf.boundingBox())!;
  await page.mouse.move(box.x + box.width + 120, box.y + 20);
  await page.mouse.move(box.x + box.width + 6, box.y + 20, { steps: 6 });
  await pdf.hover();
  await expect(page.locator(".swl-handle.swl-handle-menu-only .swl-handle-bar")).toBeVisible();
  // A preview's width for all files, a PDF's own height
  await runCommand(page, ASSETS_SETTINGS);
  const dialog = page.locator(".swa-dialog");
  await dialog.getByRole("tab", { name: "Appearance" }).click();
  await dialog.getByLabel("A preview's width (px)", { exact: true }).fill("100");
  // (A type's own in its row, opened; marked Own then)
  const pdfRow = dialog.locator('[data-swa-type="pdf"]');
  await pdfRow.locator(".swa-type-head").click();
  await dialog.getByLabel("pdf: a preview's height (px)", { exact: true }).fill("300");
  await expect(pdfRow.locator(".swa-type-mark")).toHaveText("Own");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const size = async (locator: import("@playwright/test").Locator) => {
    const one = (await locator.boundingBox())!;
    return [Math.round(one.width), Math.round(one.height)];
  };
  await expect.poll(() => size(pdf.locator(".swa-pdf"))).toEqual([100, 300]);
  // Its frame as wide as the preview: its "…" at the preview's corner, not at the text's right
  await pdf.hover();
  const more = (await pdf.locator(".swa-more").boundingBox())!;
  const shown = (await pdf.locator(".swa-pdf").boundingBox())!;
  expect(more.x + more.width).toBeLessThanOrEqual(shown.x + shown.width + 1);
  // The image within 100 × 160 (a pixel drawn as large as it fits, its ratio kept): no wider than 100
  await expect.poll(async () => (await size(page.locator("#sb-main [data-swa-asset='image'] img")))[0]! <= 100).toBe(true);
});

test("a PDF's preview clicked runs the click the settings give (its viewer under a layer taking it), its original's viewer left alone", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.pdf|||{ view: preview }]]\n\n![[${space.folder}/doc.pdf|Doc||{ view: embed }]]\n` }, "Page", { "doc.pdf": "%PDF-1.4\n" });
  const [preview, original] = [page.locator("#sb-main [data-swa-asset='pdf'][data-swa-view='preview']"), page.locator("#sb-main [data-swa-asset='pdf'][data-swa-view='embed']")];
  await expect(preview.locator(".swa-shield")).toHaveCount(1);
  await expect(original.locator(".swa-shield")).toHaveCount(0);
  // (What is opened kept: a PDF in a new tab is the browser's to download in a test's)
  await page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { opened: string[] }).opened = opened;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
  const box = (await preview.boundingBox())!;
  await page.mouse.click(box.x + box.width / 3, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => (window as unknown as { opened: string[] }).opened.join(" "))).toContain("doc.pdf");
});

test("a preview's label: its alt text above by default (else its name), then the name dragged under it and the size on, in the settings", async ({ page, space }) => {
  await space.open(
    { Page: `# Page\n\n![[${space.folder}/photo.png|Photo||{ view: preview }]]\n\nBetween\n\n![[${space.folder}/doc.pdf|||{ view: preview }]]\n` },
    "Page",
    { "doc.pdf": "%PDF-1.4\n", "photo.png": PIXEL_PNG },
  );
  const image = page.locator("#sb-main [data-swa-asset='image']");
  const pdf = page.locator("#sb-main [data-swa-asset='pdf']");
  await expect(image.locator(".swa-label-above")).toHaveText("Photo");
  await expect(pdf.locator(".swa-label-above")).toHaveText("doc.pdf");
  // (The type's icon first, before the alt text)
  await expect(pdf.locator(".swa-label-above > .swa-label-icon svg")).toBeVisible();
  await expect(page.locator("#sb-main .swa-label-below")).toHaveCount(0);
  // Its "…" at the preview's corner, under the line above it
  await image.hover();
  const label = (await image.locator(".swa-label-above").boundingBox())!;
  const more = (await image.locator(".swa-more").boundingBox())!;
  expect(more.y).toBeGreaterThanOrEqual(label.y + label.height);
  // In the settings: the name dragged under the preview, the size on
  await runCommand(page, ASSETS_SETTINGS);
  const dialog = page.locator(".swa-dialog");
  await dialog.getByRole("tab", { name: "Appearance" }).click();
  const chip = (field: string) => dialog.locator(`.swa-label-edit .swa-sample-chip[data-swa-field="${field}"]`);
  // (The label under the size: scrolled to)
  await dialog.locator(".swa-label-edit").scrollIntoViewIfNeeded();
  // The name's chip dragged from the row of those not shown to the place under the sample: shown there
  await expect(dialog.locator('.swa-label-edit-list[data-swa-place="off"] .swa-sample-chip[data-swa-field="name"]')).toBeVisible();
  const from = (await chip("name").boundingBox())!;
  const below = (await dialog.locator('.swa-label-edit-list[data-swa-place="below"]').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(below.x + 8, below.y + below.height / 2, { steps: 12 });
  await page.mouse.up();
  const line = (place: string) => dialog.locator(`.swa-label-edit-line[data-swa-place="${place}"] .swa-sample-value`);
  await expect(line("below")).toHaveText(["lake.jpg"]);
  // A click on a chip not shown shows it where it was (the size under the preview): the sample shows it at once
  await chip("size").click();
  await expect(line("below")).toHaveText(["lake.jpg", "2.4 MB"]);
  // A property shown, pointed at: its name over its value, its ×
  const name = dialog.locator('.swa-label-edit .swa-sample-item[data-swa-field="name"]');
  await name.hover();
  await expect(name.locator(".swa-sample-tag")).toBeVisible();
  await expect(name.locator(".swa-sample-tag")).toHaveText("Name");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  // The image: its alt text above, its name and size under it; the PDF without alt text: its name once, under it
  await expect(image.locator(".swa-label-above")).toHaveText("Photo");
  await expect(image.locator(".swa-label-below")).toHaveAttribute("title", /^photo\.png · \d+ B$/);
  // (Its line above its icon alone)
  await expect(pdf.locator(".swa-label-above")).toHaveText("");
  await expect(pdf.locator(".swa-label-above > .swa-label-icon")).toBeVisible();
  await expect(pdf.locator(".swa-label-below")).toHaveAttribute("title", "doc.pdf · 9 B");
  await expect.poll(() => space.config()).toContain('field = "name"');
});

test("a preview in a grid's cell: the pointer on it, its own grip shown, which opens its menu and drags nothing", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${grid(`![[${space.folder}/a.png|A|60x40|{ view: preview }]]`, "Right")}\nAfter\n` }, "Page", { "a.png": PIXEL_PNG });
  await gridsDrawn(page);
  const preview = page.locator("#sb-main .swl-grid [data-swa-asset='image']");
  await expect(preview).toBeVisible();
  // The grid's menu open first: closed as the handle goes to the preview, so a press there opens the preview's
  await page.locator("#sb-main .swl-grid-cell").nth(1).hover();
  await page.locator(".swl-handle-bar").click();
  await expect(page.locator(".swl-popup")).toBeVisible();
  await preview.hover();
  await expect(page.locator(".swl-popup")).toHaveCount(0);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const handle = (await bar.boundingBox())!;
  const box = (await preview.boundingBox())!;
  // Beside the preview, not the grid
  expect(Math.abs(handle.x - (box.x + box.width))).toBeLessThan(20);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  // A press opens its menu at once: Align alone, no width to take off
  await expect(page.locator(".swl-popup")).toBeVisible();
  await page.mouse.move(handle.x + handle.width / 2 + 60, handle.y + handle.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(Math.round((await preview.boundingBox())!.width)).toBe(Math.round(box.width));
  await expect(page.locator(".swl-popup .swl-menu-item", { hasText: "Width" })).toHaveCount(0);
  // Esc closes it; a plain click on the grip opens it again
  await page.keyboard.press("Escape");
  await expect(page.locator(".swl-popup")).toHaveCount(0);
  await preview.hover();
  await page.locator(".swl-handle-bar").click();
  await expect(page.locator(".swl-popup")).toBeVisible();
  await page.locator(".swl-popup .swl-segment[title='Center']").click();
  await expect.poll(() => space.saved("Page")).toMatch(/\|A\|60x40\|\{ [^}]*align: center[^}]*\}\]\]/);
});

test("a file aligned right: its handle beside its left edge shown as the pointer comes to it from the left", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/a.png|Photo|200|{ align: right }]]\n\nAfter\n` }, "Page", { "a.png": PIXEL_PNG });
  const image = page.locator("#sb-main [data-swa-asset='image']");
  await expect(image).toBeVisible();
  const box = (await image.boundingBox())!;
  // From the text's left, over the empty line, to just left of the image's left edge: no widget there but its handle's place
  await page.mouse.move(box.x - 200, box.y + box.height / 2);
  await page.mouse.move(box.x - 8, box.y + box.height / 2, { steps: 10 });
  await expect(page.locator(".swl-handle-bar")).toBeVisible();
  const handle = (await page.locator(".swl-handle-bar").boundingBox())!;
  expect(handle.x + handle.width).toBeLessThanOrEqual(box.x);
});

test("a file aligned right from its handle's menu: written in its embed, at the text's right edge; its handle at its left edge widens it to the left", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nText above.\n\n![[${space.folder}/a.png|Photo|200]]\n\nText under.\n` }, "Page", { "a.png": PIXEL_PNG });
  const image = page.locator("#sb-main [data-swa-asset='image']");
  await expect(image).toBeVisible();
  const content = page.locator("#sb-main .cm-content");
  const textRight = await content.evaluate((one) => one.getBoundingClientRect().right - parseFloat(getComputedStyle(one).paddingRight));
  const textLeft = await content.evaluate((one) => one.getBoundingClientRect().left + parseFloat(getComputedStyle(one).paddingLeft));
  // At the left by default
  expect(Math.round((await image.boundingBox())!.x)).toBe(Math.round(textLeft));
  await image.hover();
  await page.locator(".swl-handle-bar").click();
  await expect(page.locator(".swl-popup .swl-segment[title='Left (default)']")).toBeVisible();
  // (Its own menu offers no alignment)
  await page.locator(".swl-popup .swl-segment[title='Right']").click();
  await expect.poll(() => space.saved("Page")).toContain(`![[${space.folder}/a.png|Photo|200|{ align: right }]]`);
  const rightEdge = async () => {
    const box = (await image.boundingBox())!;
    return Math.round(box.x + box.width);
  };
  await expect.poll(rightEdge).toBe(Math.round(textRight));
  // Its handle beside its left edge; dragged to the left, wider, its right edge where it was
  await image.hover();
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const handle = (await bar.boundingBox())!;
  expect(handle.x + handle.width).toBeLessThanOrEqual((await image.boundingBox())!.x);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 80, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await image.boundingBox())!.width)).toBe(280);
  expect(await rightEdge()).toBe(Math.round(textRight));
  await expect.poll(() => space.saved("Page")).toContain("|Photo|280|{ align: right }]]");
});

test("a card's icon hidden in the settings: a small arrow after its name within the card opens its menu, on a narrow page too", async ({ page, space }) => {
  const name = "17946506159461442418238509537.zip";
  await space.open({ Page: `# Page\n\n![[${space.folder}/${name}]]\n` }, "Page", { [name]: "zip" });
  await expect(page.locator("#sb-main .swa-card")).toBeVisible();
  await runCommand(page, ASSETS_SETTINGS);
  const dialog = page.locator(".swa-dialog");
  await dialog.getByRole("tab", { name: "Appearance" }).click();
  await dialog.getByRole("radio", { name: "Card" }).click();
  const look = dialog.locator('[data-swa-look="card"]');
  await look.locator('.swa-sample-item[data-swa-field="icon"]').hover();
  await look.locator('.swa-sample-item[data-swa-field="icon"] .swa-sample-remove').click();
  // (In the sample, the arrow in its place, which cannot be hidden)
  await expect(look.locator('.swa-sample-card .swa-sample-item[data-swa-field="marker"] .swa-sample-remove')).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  // No "…" beside the card: the arrow its last part, within it and within its frame on a phone's width (its long name cut instead)
  const frame = page.locator("#sb-main [data-swa-asset='file']");
  const marker = frame.locator(".swa-card > .swa-menu-marker:last-child");
  await expect(marker).toBeVisible();
  await expect(frame.locator(".swa-more")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect.poll(async () => {
    const [m, f] = [(await marker.boundingBox())!, (await frame.boundingBox())!];
    return m.x + m.width <= f.x + f.width;
  }).toBe(true);
  const url = page.url();
  await marker.click();
  await expect(page.locator(".swa-popup .swa-menu-item", { hasText: "Show as a preview" })).toBeVisible();
  expect(page.url()).toBe(url);
});

test("a link's icon hidden in the settings: a small arrow after the link opens its menu, the link not followed", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nSee [[${space.folder}/doc.pdf]] for the numbers.\n` }, "Page", { "doc.pdf": "%PDF-1.4\n" });
  const link = page.locator("#sb-main [data-swa-link='pdf']");
  await expect(link.locator(".swa-link-icon")).toBeVisible();
  await runCommand(page, ASSETS_SETTINGS);
  const dialog = page.locator(".swa-dialog");
  await dialog.getByRole("tab", { name: "Appearance" }).click();
  await dialog.getByRole("radio", { name: "Link" }).click();
  const look = dialog.locator('[data-swa-look="link"]');
  await look.locator('.swa-sample-item[data-swa-field="icon"]').hover();
  await look.locator('.swa-sample-item[data-swa-field="icon"] .swa-sample-remove').click();
  // (In the sample, the arrow in its place, which cannot be hidden)
  await expect(look.locator('.swa-sample-item[data-swa-field="marker"] .swa-sample-remove')).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => space.config()).toMatch(/linkIcons[^\n]*false/);
  // The arrow after the link's text, its icon gone; its menu opened, the page the same
  const marker = link.locator(":scope > .swa-link-marker:last-child");
  await expect(marker).toBeVisible();
  await expect(link.locator(".swa-link-icon")).toHaveCount(0);
  const url = page.url();
  await marker.click();
  await expect(page.locator(".swa-popup .swa-menu-item", { hasText: "Show as embedded" })).toBeVisible();
  expect(page.url()).toBe(url);
});

test("Delete file… in a file's menu: asked in SilverBullet's dialog, the file deleted, its embed taken out and a link to it its text", async ({ page, space }) => {
  const embed = `![[${space.folder}/archive.zip]]`;
  const link = `[[${space.folder}/doc.pdf|the doc]]`;
  await space.open({ Page: `# Page\n\n${embed}\n\nSee ${link} here.\n` }, "Page", { "archive.zip": "zip", "doc.pdf": "%PDF-1.4\n" });
  const confirm = page.locator(".sb-modal-box, .sb-modal").filter({ hasText: "Delete the file" });
  // The card's menu (its icon): Delete file…, declined first
  const card = page.locator("#sb-main [data-swa-asset='file'] .swa-card");
  await card.locator(".swa-icon").click();
  await page.locator(".swa-popup .swa-menu-item.swa-danger", { hasText: "Delete file…" }).click();
  await expect(confirm).toContainText("The file itself is deleted, not only this embed: it cannot be brought back.");
  await confirm.getByRole("button", { name: /Cancel/ }).click();
  await expect(confirm).toHaveCount(0);
  expect(space.hasFile("archive.zip")).toBe(true);
  // Then confirmed: gone, the file and its embed
  await card.locator(".swa-icon").click();
  await page.locator(".swa-popup .swa-menu-item.swa-danger", { hasText: "Delete file…" }).click();
  await expect(confirm).toBeVisible();
  await confirm.locator("button").last().click();
  await expect.poll(() => space.hasFile("archive.zip")).toBe(false);
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\nSee ${link} here.\n`);
  // A link's menu: the file deleted, the link its text
  await page.locator("#sb-main [data-swa-link='pdf'] .swa-link-icon").click();
  await page.locator(".swa-popup .swa-menu-item.swa-danger", { hasText: "Delete file…" }).click();
  await expect(confirm).toContainText("This link is replaced by its text.");
  await confirm.locator("button").last().click();
  await expect.poll(() => space.hasFile("doc.pdf")).toBe(false);
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\nSee the doc here.\n");
});

test("the settings: a card's size shown, a click set to the side panel; the panel shows the file and Esc closes it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/archive.zip]]\n\n![[${space.folder}/photo.png|Photo||{ view: preview }]]\n` }, "Page", { "archive.zip": "zip", "photo.png": PIXEL_PNG });
  await expect(page.locator("#sb-main .swa-card")).toHaveText("archive.zip");
  await runCommand(page, ASSETS_SETTINGS);
  const dialog = page.locator(".swa-dialog");
  // A card's size: its chip under the Appearance tab's card, shown on the sample card at once
  await dialog.getByRole("tab", { name: "Appearance" }).click();
  await dialog.getByRole("radio", { name: "Card" }).click();
  const card = dialog.locator('[data-swa-look="card"]');
  await card.locator('.swa-sample-chip[data-swa-field="size"]').click();
  await expect(card.locator('.swa-sample-card .swa-sample-item[data-swa-field="size"]')).toHaveText(/860 KB/);
  await dialog.getByRole("radio", { name: "Link" }).click();
  await dialog.getByRole("tab", { name: "Files" }).click();
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
  // Assets' box off, saved while Layout's dialog is open: the file drawn there, the grid still hidden. Layout's dialog
  // stays open as SilverBullet, loading the configuration Assets saved, starts Silverware Layout again under it
  const layout = page.locator(".swl-dialog");
  await runCommand(page, PAGE_LAYOUT);
  await expect(layout).toBeVisible();
  await runCommand(page, ASSETS_SETTINGS);
  const assets = page.locator(".swa-dialog");
  await assets.getByRole("tab", { name: "Markdown" }).click();
  await assets.getByLabel("Hide embedded files").uncheck();
  await assets.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => space.config()).toContain('config.set("silverware.assets.syntaxMode.hideAssets", false)');
  // (Silverware Layout started again: its init page's settings read anew, a moment after the configuration loads)
  await page.waitForTimeout(2_000);
  await expect(layout).toBeVisible();
  await layout.getByRole("button", { name: "Cancel" }).click();
  await expect(layout).toBeHidden();
  await toggle();
  await expect(page.locator("#sb-main .cm-content")).toContainText(image);
  await expect(file).toBeVisible();
  await expect(shownGrid).toBeHidden();
  await toggle();
  // Layout's box off too: the grid drawn there as well
  await runCommand(page, PAGE_LAYOUT);
  await layout.getByRole("tab", { name: "Markdown" }).click();
  await layout.getByLabel("Hide grids").uncheck();
  await layout.getByRole("button", { name: "Save" }).click();
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
