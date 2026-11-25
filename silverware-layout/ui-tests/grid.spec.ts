// Columns (docs/silverware-layout-grid.md) as a user works with them in SilverBullet: /grid, a cell edited in place,
// Alt+click to the raw text, columns set by the grid's line, a grid in an embedded page, its hashtags indexed.
import { boxOf, cellField, cursorAt, editorText, expect, fieldState, fillField, gridsDrawn, LAYOUT_SETTINGS, PIXEL_PNG, runCommand, test } from "./helpers.ts";

const GRID = "<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n";
// Lines enough between two blocks alike that the first is out of the page (CodeMirror keeps what is far from view out)
const FAR = Array.from({ length: 160 }, (_, i) => `Line ${i + 1} between.`).join("\n\n");

test("of two grids written alike far apart, a cell of the second edited, the first out of the page: written into the second", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\n${FAR}\n\n${GRID}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  // (Scrolled to its end, and waited for it: the filler's first line gone from the page, its last shown)
  await page.evaluate(() => document.querySelector(".cm-scroller")!.scrollTo(0, 1e9));
  await expect(page.locator(".cm-line", { hasText: /^Line 1 between\.$/ })).toHaveCount(0);
  await expect(page.locator(".cm-line", { hasText: "Line 160 between." })).toBeVisible();
  // (The first grid gone from the page: its text far above the view)
  await expect(page.locator("#sb-main .swl-grid")).toHaveCount(1);
  await page.locator("#sb-main .swl-grid-cell").first().click();
  await expect.poll(async () => (await fieldState(page)).text).toBe("Left text");
  await fillField(page, "Left second");
  await page.keyboard.press("Escape");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${GRID}\n${FAR}\n\n${GRID.replace("Left text", "Left second")}\nBelow\n`);
});

test("/grid puts a grid of two columns at the cursor, the cursor in its first", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nAbove\n\n" }, "Page");
  // (Space Lua's slash command may come after the page: where /grid is not offered yet, typed again once loaded again)
  for (let attempt = 0; ; attempt++) {
    await page.locator("#sb-main .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("/grid", { delay: 50 });
    // (Asked for as well, where typed while the editor was busy it offered none)
    if (!(await page.locator(".cm-tooltip-autocomplete").isVisible())) await page.keyboard.press("Control+Space");
    try {
      // (Ours by its description: the list may offer more holding "grid")
      await expect(page.locator(".cm-tooltip-autocomplete li", { hasText: "Columns:" })).toBeVisible({ timeout: 5000 });
      break;
    } catch (error) {
      if (attempt >= 2) throw error;
      for (let i = 0; i < "/grid".length; i++) await page.keyboard.press("Backspace");
      await page.reload();
      await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
    }
  }
  await page.locator(".cm-tooltip-autocomplete li", { hasText: "Columns:" }).click();
  await expect.poll(() => editorText(page)).toContain("<grid>\n<cell>\n\n");
  const text = await editorText(page);
  expect(text.match(/<cell>/g)).toHaveLength(2);
  // The cursor on the first cell's blank line
  const first = text.indexOf("<cell>\n\n") + "<cell>\n\n".length;
  expect(await cursorAt(page)).toBe(first);
});

test("a cell edited in place: its markdown in a field, written as it is left, the rest of the grid kept", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const cell = page.locator("#sb-main .swl-grid-cell").first();
  await cell.click();
  await expect.poll(async () => (await fieldState(page)).text).toBe("Left text");
  await fillField(page, "Left **edited**");
  await page.keyboard.press("Escape");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${GRID.replace("Left text", "Left **edited**")}\nBelow\n`);
  await expect(page.locator("#sb-main .swl-grid-cell").first().locator("strong")).toHaveText("edited");
});

test("in a cell's field a file's link has its icon as in the page; a link pressed is followed once the cell is written", async ({ page, space }) => {
  const links = `See [[${space.folder}/photo.png]] then [[${space.folder}/Other|the other]]`;
  const grid = `<grid>\n<cell>\n\nLeft text\n\n${links}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n`;
  await space.open({ Page: `# Page\n\n${grid}\nBelow\n`, Other: "# Other\n" }, "Page", { "photo.png": PIXEL_PNG });
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().getByText("Left text").click();
  await expect(cellField(page)).toBeVisible();
  // The file's link: Silverware Assets' icon before it, as in the page
  await expect(cellField(page).locator(".swa-link-icon")).toHaveCount(1);
  // Typed in, then a page's link pressed: the cell written into its own page first, then the other page shown
  await fillField(page, `Left edited\n\n${links}`);
  // (The caret away from the links: on them their markdown is shown, as it is to be typed in)
  await page.keyboard.press("Control+Home");
  await cellField(page).locator(".swe-wiki-link", { hasText: "the other" }).click();
  await expect(page).toHaveURL(/\/Other$/);
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${grid.replace("Left text", "Left edited")}\nBelow\n`);
});

test("a shortcut of SilverBullet's pressed in a cell's field does nothing there and says so, the cell still edited", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().click();
  await expect.poll(async () => (await fieldState(page)).text).toBe("Left text");
  await page.keyboard.press("Control+k");
  await expect(page.locator(".sb-notifications")).toContainText("Navigate: Page Picker doesn't work here");
  await expect(cellField(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cellField(page)).toHaveCount(0);
});

test("a cell left by a click straight into another of its grid: the first written, the second edited on, what is typed in it kept as the grid is drawn anew", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().click();
  await expect.poll(async () => (await fieldState(page)).text).toBe("Left text");
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" one");
  await page.locator("#sb-main .swl-grid-cell").nth(1).click();
  await page.keyboard.press("Control+End");
  // (Typed as the first is written and the grid drawn anew: the second's editor taken into the new drawing)
  await page.keyboard.type(" two", { delay: 60 });
  await expect.poll(() => space.saved("Page")).toContain("Left text one");
  await expect.poll(async () => (await fieldState(page)).text).toBe("Right text two");
  await page.keyboard.press("Escape");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${GRID.replace("Left text", "Left text one").replace("Right text", "Right text two")}\nBelow\n`);
});

test("text dropped on a cell not edited: written into its markdown where it was let go, the page's editor taking nothing of it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const cell = page.locator("#sb-main .swl-grid-cell").nth(1);
  // (A drag as the browser carries one, from wherever: its plain text, let go at the end of the cell's text)
  const words = await boxOf(cell.getByText("Right text"));
  const at = { x: words.x + words.width + 2, y: words.y + words.height / 2 };
  const data = { items: [{ mimeType: "text/plain", data: " **dropped**" }], dragOperationsMask: 1 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchDragEvent", { type: "dragEnter", ...at, data });
  await cdp.send("Input.dispatchDragEvent", { type: "dragOver", ...at, data });
  await expect(cell).toHaveClass(/swl-grid-drop/);
  await cdp.send("Input.dispatchDragEvent", { type: "drop", ...at, data });
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${GRID.replace("Right text", "Right text **dropped**")}\nBelow\n`);
  await expect(page.locator("#sb-main .swl-grid-drop")).toHaveCount(0);
});

/** Text dropped at a point as the browser carries a drag there (its drag begun by the test: a selection is not dragged headless) */
async function dropAt(page: import("@playwright/test").Page, x: number, y: number, text: string): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const data = { items: [{ mimeType: "text/plain", data: text }], dragOperationsMask: 17 };
  for (const type of ["dragEnter", "dragOver", "drop"] as const) await cdp.send("Input.dispatchDragEvent", { type, x, y, data });
  await cdp.detach();
}

/** A drag begun from a cell's rendering, its selection the element of this text in it; what it carries */
const dragFromCell = (page: import("@playwright/test").Page, selector: string, text: string): Promise<string> =>
  page.evaluate(
    ({ selector, text }) => {
      const element = [...document.querySelectorAll(`#sb-main .swl-grid-cell ${selector}`)].find((one) => one.textContent === text)!;
      const range = document.createRange();
      range.selectNodeContents(element);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
      const carried = new DataTransfer();
      element.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: carried }));
      return carried.getData("text/plain");
    },
    { selector, text },
  );

/**
 * A drag as a mouse makes it: pressed at a point, moved, the browser's own drag started (its data caught by CDP), then
 * carried and dropped at another point, as the browser carries a drag
 */
async function mouseDrag(page: import("@playwright/test").Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.setInterceptDrags", { enabled: true });
  const caught = new Promise<unknown>((resolve) => cdp.once("Input.dragIntercepted", (event) => resolve(event.data)));
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", clickCount: 1 });
  for (let step = 1; step <= 6; step++) await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + step * 8, y: from.y + step * 4, button: "left", buttons: 1 });
  const data = await caught;
  for (const type of ["dragEnter", "dragOver", "drop"] as const) await cdp.send("Input.dispatchDragEvent", { type, ...to, data: data as never });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...to, button: "left", clickCount: 1 });
  await cdp.detach();
}

test("text selected in a cell's field dragged onto another cell: moved at once, the field's cell written with it, the field going on", async ({ page, space }) => {
  const text = `# Page\n\n<grid>\n<cell>\n\nSome *italic* words\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().getByText("italic").click();
  await expect(cellField(page)).toBeVisible();
  // "*italic*" selected in the field (as a drag over the rendering opens the field with it selected), dragged
  const from = await cellField(page).evaluate((root: HTMLElement) => {
    type View = { state: { doc: { toString(): string } }; dispatch(spec: unknown): void; coordsAtPos(at: number): { left: number; top: number; bottom: number } | null };
    const content = root.shadowRoot?.querySelector(".cm-content") as (Element & { cmTile?: { view?: View } }) | null;
    const view = content?.cmTile?.view;
    if (!view) throw new Error("the field is not Silverware Editor's");
    const at = view.state.doc.toString().indexOf("*italic*");
    view.dispatch({ selection: { anchor: at, head: at + 8 } });
    const box = view.coordsAtPos(at + 3)!;
    return { x: box.left + 2, y: (box.top + box.bottom) / 2 };
  });
  const words = await boxOf(page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right"));
  await mouseDrag(page, from, { x: words.x + words.width + 2, y: words.y + words.height / 2 });
  await expect.poll(() => editorText(page)).toBe(text.replace("Some *italic* words", "Some  words").replace("Right\n", "Right*italic*\n"));
  await expect(cellField(page)).toHaveCount(1);
});

test("Enter at a bullet item's end above a task list in a cell's field: the next item, no blank line before it (as the page)", async ({ page, space }) => {
  const list = "* adasdadd\n\n* [ ] asdjl\n* [ ] b";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${list}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().getByText("adasdadd").click();
  await expect(cellField(page)).toBeVisible();
  // The caret at the item's end
  await cellField(page).evaluate((root: HTMLElement) => {
    type View = { state: { doc: { toString(): string } }; dispatch(spec: unknown): void; focus(): void };
    const view = (root.shadowRoot?.querySelector(".cm-content") as (Element & { cmTile?: { view?: View } }) | null)?.cmTile?.view;
    if (!view) throw new Error("the field is not Silverware Editor's");
    const at = view.state.doc.toString().indexOf("adasdadd") + "adasdadd".length;
    view.dispatch({ selection: { anchor: at } });
    view.focus();
  });
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await fieldState(page)).text).toBe("* adasdadd\n* \n\n* [ ] asdjl\n* [ ] b");
});

test("a drag moves text: the page's selection into a cell, a cell's (its markdown) into another, each one edit undone at once; a cell's into the page taken out of it", async ({ page, space }) => {
  const text = `# Page\n\n<grid>\n<cell>\n\nSome *italic* words\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  const endOfRight = async () => {
    const words = await boxOf(page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right"));
    return { x: words.x + words.width + 2, y: words.y + words.height / 2 };
  };
  // The page's "After" selected and dragged into the second cell: taken out of the page, as one edit
  await page.evaluate(() => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void; contentDOM: HTMLElement } } }).client.editorView;
    const at = view.state.doc.toString().lastIndexOf("After");
    view.dispatch({ selection: { anchor: at, head: at + 5 } });
    view.contentDOM.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: new DataTransfer() }));
  });
  let to = await endOfRight();
  await dropAt(page, to.x, to.y, "After");
  const moved = text.replace("Right\n", "RightAfter\n").replace("</grid>\n\nAfter\n", "</grid>\n\n\n");
  await expect.poll(() => space.saved("Page")).toBe(moved);
  await page.locator("#sb-main .cm-line").first().click();
  await page.keyboard.press("Control+z");
  await expect.poll(() => editorText(page)).toBe(text);
  // The first cell's "italic" dragged into the second: its markdown, out of the first, as one edit
  await gridsDrawn(page);
  expect(await dragFromCell(page, "em", "italic")).toBe("*italic*");
  to = await endOfRight();
  await dropAt(page, to.x, to.y, "*italic*");
  const between = text.replace("Some *italic* words", "Some  words").replace("Right\n", "Right*italic*\n");
  await expect.poll(() => editorText(page)).toBe(between);
  await page.locator("#sb-main .cm-line").first().click();
  await page.keyboard.press("Control+z");
  await expect.poll(() => editorText(page)).toBe(text);
  // Into the page: the page's editor takes it, the cell has it taken out
  await gridsDrawn(page);
  await dragFromCell(page, "em", "italic");
  const after = await boxOf(page.locator("#sb-main .cm-line", { hasText: "After" }));
  await dropAt(page, after.x + after.width - 5, after.y + after.height / 2, "*italic*");
  await page.evaluate(() => document.querySelector("#sb-main .swl-grid-cell em")?.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: new DataTransfer() })));
  await expect.poll(() => editorText(page)).toContain("Some  words");
  expect(await editorText(page)).toContain("*italic*");
});

test("the grid keeps the page's cursor out of its text: a quick second click on another cell edits it, a press between cells or on a divider, the arrows over it; its markdown shown by the menu alone", async ({ page, space }) => {
  const text = `# Page\n\nAbove\n\n${GRID}\nAfter\n`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const cells = page.locator("#sb-main .swl-grid-cell");
  // One cell, then another at once, the second press a double click's (the cell opened in between)
  const left = await boxOf(cells.first().getByText("Left text"));
  const right = await boxOf(cells.nth(1).getByText("Right text"));
  await page.mouse.click(left.x + 5, left.y + 5);
  await page.waitForTimeout(150);
  await page.mouse.click(right.x + 5, right.y + 5, { clickCount: 2 });
  await expect(cells.nth(1).locator(".swl-grid-editor")).toHaveCount(1);
  await expect(grid).toHaveCount(1);
  await page.keyboard.press("Escape");
  // A press between the cells (the divider there): the grid as it is, the page's cursor not in it
  const a = await boxOf(cells.first());
  const b = await boxOf(cells.nth(1));
  await page.mouse.click((a.x + a.width + b.x) / 2, b.y + 5);
  await page.waitForTimeout(300);
  await expect(grid).toHaveCount(1);
  // The arrows: down from the line above it to the line after it, up again to the line above
  // (The blank line under "Above", the grid's line, the blank line after it)
  const blankAbove = text.indexOf("Above") + "Above".length + 1;
  await page.locator("#sb-main .cm-line", { hasText: "Above" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => cursorAt(page)).toBe(blankAbove);
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => cursorAt(page)).toBe(text.indexOf("\nAfter"));
  await expect(grid).toHaveCount(1);
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => cursorAt(page)).toBe(blankAbove);
  await expect(grid).toHaveCount(1);
  // The cell's markdown on purpose: its menu's Edit markdown, the cursor at its text
  await cells.nth(1).hover();
  await cells.nth(1).locator(".swl-grid-cell-grip").click();
  await page.locator(".swl-popup").getByText("Edit markdown").click();
  await expect(grid).toHaveCount(0);
  await expect.poll(() => cursorAt(page)).toBe(text.indexOf("Right text"));
});

test("a cell shorter than its row clicked under its text: edited, the caret after its last character", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\nOne\n\nTwo\n\nThree\n\nFour\n\n</cell>\n<cell>\n\nShort\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const short = page.locator("#sb-main .swl-grid-cell").nth(1);
  const box = await boxOf(short);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 6);
  await expect.poll(async () => (await fieldState(page)).text).toBe("Short");
  const state = await fieldState(page);
  expect([state.from, state.to]).toEqual([5, 5]);
  await page.keyboard.press("Escape");
});

test("a press beside a grid, in the page's margin at its height, keeps the grid drawn, as beside a table; one beside a line of text is the text's", async ({ page, space }) => {
  const text = `# Page\n\n${GRID}\nAfter\n`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  const grid = await boxOf(page.locator("#sb-main .swl-grid"));
  const content = await boxOf(page.locator("#sb-main .cm-content"));
  const viewport = page.viewportSize()!;
  for (const x of [Math.max(4, content.x - 30), Math.min(viewport.width - 4, content.x + content.width + 30)]) {
    await page.mouse.click(x, grid.y + grid.height / 2);
    await page.waitForTimeout(400);
    await expect(page.locator("#sb-main .swl-grid")).toHaveCount(1);
  }
  const after = await boxOf(page.locator("#sb-main .cm-line", { hasText: "After" }));
  await page.mouse.click(Math.min(viewport.width - 4, content.x + content.width + 30), after.y + after.height / 2);
  await expect.poll(() => cursorAt(page)).toBe(text.length - 1);
});

test("Alt+click in a cell shows the raw text, the cursor where the click was", async ({ page, space }) => {
  const text = `# Page\n\n${GRID}`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  const words = page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right text");
  const box = await boxOf(words);
  // On "text", the second word
  await words.click({ modifiers: ["Alt"], position: { x: box.width - 4, y: box.height / 2 } });
  await expect.poll(() => cursorAt(page)).toBeGreaterThanOrEqual(text.indexOf("Right text") + "Right ".length);
  expect(await cursorAt(page)).toBeLessThanOrEqual(text.indexOf("Right text") + "Right text".length);
  // The raw text shown: the grid's lines are the editor's again
  await expect(page.locator("#sb-main .cm-content")).toContainText("<cell>");
});

test("a grid's columns as its line says, given again as the line is edited", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID.replace("<grid>", '<grid columns="1fr 3fr">')}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const cells = page.locator("#sb-main .swl-grid-cell");
  const widthsOf = async () => [Math.round((await boxOf(cells.nth(0))).width), Math.round((await boxOf(cells.nth(1))).width)];
  await expect.poll(async () => {
    const [a, b] = await widthsOf();
    return Math.round(b! / a!);
  }).toBe(3);
});

test("a grid's handle drags it both ways from its middle (centred by default); a double click takes its width off", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nAbove\n\n${GRID}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const edges = async () => {
    const box = await boxOf(grid);
    return [Math.round(box.x), Math.round(box.x + box.width)];
  };
  const [left, right] = await edges();
  await grid.hover();
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const box = await boxOf(bar);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 8 });
  // While dragged: its right edge with the pointer, its left edge as far the other way
  await expect.poll(edges).toEqual([left! - 60, right! + 60]);
  await page.mouse.up();
  await expect.poll(() => space.saved("Page")).toMatch(/<grid width="\d+">/);
  await grid.hover();
  await page.locator(".swl-handle-bar").dblclick();
  await expect.poll(() => space.saved("Page")).toContain("<grid>\n");
  // (A double click opens no menu)
  await expect(page.locator(".swl-popup")).toHaveCount(0);
});

test("a cell keeps the blank lines of its markdown as the editor shows them: between a loose list's items, before a heading after a list", async ({ page, space }) => {
  const cell = "One\n\nTwo\n- item\n\n- item2\n\n# Head\n\nAfter";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cell}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const first = page.locator("#sb-main .swl-grid-cell").first();
  // The two SilverBullet's rendering leaves out, put back; those between paragraphs it keeps
  await expect(first.locator(".swl-grid-blank")).toHaveCount(2);
  const top = async (selector: string) => (await boxOf(first.locator(selector).first())).y;
  const line = (await boxOf(first.locator("li").first())).height;
  // item2 two lines under item (a blank line between), the heading a blank line under the list
  expect(Math.round(((await top("li >> nth=1")) - (await top("li"))) / line)).toBe(2);
  expect(Math.round(((await top("h1")) - (await top("li >> nth=1"))) / line)).toBe(2);
});

test("a click on a blank line of a cell puts the field's caret on that line, not at the cell's start", async ({ page, space }) => {
  // Two blank lines between the paragraphs (drawn as line breaks), one between the list's items (put back)
  const cell = "One\n\n\nTwo\n- a\n\n- b";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cell}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const first = page.locator("#sb-main .swl-grid-cell").first();
  const clickAbove = async (selector: string, lines: number) => {
    const box = await boxOf(first.locator(selector).first());
    const line = (await boxOf(first.locator(".p").first())).height;
    await page.mouse.click(box.x + 30, box.y - line * (lines - 0.5));
  };
  const caret = async () => (await fieldState(page)).from;
  // The blank line right above "Two": its line's start (the second blank one, at 5)
  await clickAbove(".p >> nth=1", 1);
  await expect(cellField(page)).toBeVisible();
  await expect.poll(caret).toBe(cell.indexOf("\n\nTwo") + 1);
  await page.keyboard.press("Escape");
  await expect(cellField(page)).toHaveCount(0);
  // The one between the list's items
  await clickAbove("li >> nth=1", 1);
  await expect(cellField(page)).toBeVisible();
  await expect.poll(caret).toBe(cell.indexOf("\n- b"));
});

test("a blank line before a list is a line, as in the editor, and a click there puts the caret on it", async ({ page, space }) => {
  // (A list and its first item start on one line: the blank line before it once, not twice)
  const cell = "Plan\n\n- a\n- b";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cell}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const first = page.locator("#sb-main .swl-grid-cell").first();
  await expect(first.locator(".swl-grid-blank")).toHaveCount(1);
  const plan = await boxOf(first.locator(".p").first());
  const item = await boxOf(first.locator("li").first());
  // The first item two lines of text under "Plan": a blank line between
  expect(Math.round((item.y - plan.y) / plan.height)).toBe(2);
  await page.mouse.click(item.x + 30, item.y - plan.height / 2);
  await expect(cellField(page)).toBeVisible();
  await expect.poll(async () => (await fieldState(page)).from).toBe(cell.indexOf("\n- a"));
});

test("a click on an item's text over the list nested in it after a blank line puts the caret in that text", async ({ page, space }) => {
  const cell = "- first\n\n  - b\n  - c";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cell}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const first = page.locator("#sb-main .swl-grid-cell").first();
  const word = await boxOf(first.locator(".p").first());
  await page.mouse.click(word.x + word.width - 2, word.y + word.height / 2);
  await expect(cellField(page)).toBeVisible();
  // In "first", not on the blank line under it
  const inWord = (at: number) => at > cell.indexOf("first") && at <= cell.indexOf("\n");
  await expect.poll(async () => inWord((await fieldState(page)).from)).toBe(true);
});

test("a click in a nested list's margin over its blank line puts the caret on that blank line", async ({ page, space }) => {
  const cell = "- first\n\n  - b\n  - c";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cell}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  // (A theme's margin over a nested list: room between the item's text and the blank line under it; a style of the
  // page's, so a grid drawn anew has it too)
  await page.addStyleTag({ content: "#sb-main .swl-grid-cell li > ul { margin-top: 12px !important; }" });
  const first = page.locator("#sb-main .swl-grid-cell").first();
  const word = await boxOf(first.locator(".p").first());
  expect((await boxOf(first.locator("li > ul"))).y - (word.y + word.height)).toBeGreaterThan(8);
  await page.mouse.click(word.x + 10, word.y + word.height + 4);
  await expect(cellField(page)).toBeVisible();
  await expect.poll(async () => (await fieldState(page)).from).toBe(cell.indexOf("\n\n") + 1);
});

test("a quote's blank line between a loose list's items is a line, as in the editor, and a click there puts the caret on it, in the quote", async ({ page, space }) => {
  // (The quote's blank line its mark alone: SilverBullet's rendering leaves it out between the items)
  const cell = "> - a\n>\n> - b";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cell}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const first = page.locator("#sb-main .swl-grid-cell").first();
  await expect(first.locator(".swl-grid-blank")).toHaveCount(1);
  const a = await boxOf(first.locator("li .p").first());
  const b = await boxOf(first.locator("li .p").nth(1));
  expect(Math.round((b.y - a.y) / a.height)).toBe(2);
  await page.mouse.click(b.x + 30, b.y - a.height / 2);
  await expect(cellField(page)).toBeVisible();
  // (Past its mark: what is typed there stays in the quote)
  await expect.poll(async () => (await fieldState(page)).from).toBe(cell.indexOf("\n>\n") + 2);
});

test("a blank line before a block in a list's item is a line, as in the editor", async ({ page, space }) => {
  // (SilverBullet's rendering draws the item's second paragraph right under its first)
  const cell = "- a\n\n  para2";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cell}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const first = page.locator("#sb-main .swl-grid-cell").first();
  await expect(first.locator(".swl-grid-blank")).toHaveCount(1);
  const a = await boxOf(first.locator("li .p").first());
  const second = await boxOf(first.locator("li .p").nth(1));
  expect(Math.round((second.y - a.y) / a.height)).toBe(2);
});

test("an empty cell is a line high, clicked into to write in it", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n<grid>\n<cell>\n\nLeft\n\n</cell>\n<cell>\n\n\n</cell>\n</grid>\n" }, "Page");
  await gridsDrawn(page);
  const empty = page.locator("#sb-main .swl-grid-cell").nth(1);
  expect((await boxOf(empty)).height).toBeGreaterThan(10);
  await empty.click();
  await expect(empty.locator(".swl-grid-editor")).toBeVisible();
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  await fillField(page, "Written");
  await page.keyboard.press("Escape");
  await expect.poll(() => space.saved("Page")).toContain("<cell>\n\nWritten\n\n</cell>");
});

test("a grid aligned right from its handle's menu: written as its attribute, at the text's right edge; dragged, it grows to the left; centred again as the default", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nAbove\n\n${GRID.replace("<grid>", '<grid width="400">')}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const content = page.locator("#sb-main .cm-content");
  const textRight = await content.evaluate((one) => one.getBoundingClientRect().right - parseFloat(getComputedStyle(one).paddingRight));
  const rightEdge = async () => {
    const box = await boxOf(grid);
    return Math.round(box.x + box.width);
  };
  const openMenu = async () => {
    await grid.hover();
    await page.locator(".swl-handle-bar").click();
    await expect(page.locator(".swl-popup")).toBeVisible();
  };
  // Esc closes the menu (the focus may be on the grip pressed)
  await openMenu();
  await page.keyboard.press("Escape");
  await expect(page.locator(".swl-popup")).toHaveCount(0);
  await openMenu();
  // Kept open with the pointer resting on it, and over the grid again (the same widget, found anew)
  await page.locator(".swl-popup").hover();
  await page.waitForTimeout(700);
  await expect(page.locator(".swl-popup")).toBeVisible();
  await grid.hover();
  await page.waitForTimeout(200);
  await expect(page.locator(".swl-popup")).toBeVisible();
  // Centred, the grid's default, marked so
  await expect(page.locator(".swl-popup .swl-segment[title='Center (default)']")).toHaveAttribute("aria-checked", "true");
  await page.locator(".swl-popup .swl-segment[title='Right']").click();
  await expect.poll(() => space.saved("Page")).toContain('<grid width="400" align="right">');
  await expect.poll(rightEdge).toBe(Math.round(textRight));
  // Its handle beside its left edge; dragged to the left, wider, its right edge where it was
  await grid.hover();
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const handle = await boxOf(bar);
  expect(handle.x + handle.width).toBeLessThanOrEqual((await boxOf(grid)).x);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  // (Wider than the text too: still to the left alone, its right edge kept, the guides placed from it with it)
  await page.mouse.move(handle.x + handle.width / 2 - 600, handle.y + handle.height / 2, { steps: 12 });
  expect((await boxOf(grid)).width).toBeGreaterThan(textRight - (await boxOf(content)).x);
  expect(await rightEdge()).toBe(Math.round(textRight));
  await page.mouse.move(handle.x + handle.width / 2 - 60, handle.y + handle.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => space.saved("Page")).toContain('<grid width="460" align="right">');
  expect(await rightEdge()).toBe(Math.round(textRight));
  // The default again: the attribute taken off
  await openMenu();
  await page.locator(".swl-popup .swl-segment[title='Center (default)']").click();
  await expect.poll(() => space.saved("Page")).toContain('<grid width="460">');
});

test("the settings dialog's Alignment tab: every grid at the right where it says nothing itself, saved in Library/Config; its own from its menu wins", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nAbove\n\n${GRID.replace("<grid>", '<grid width="400">')}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const content = page.locator("#sb-main .cm-content");
  const text = await content.evaluate((one) => {
    const box = one.getBoundingClientRect();
    const style = getComputedStyle(one);
    return { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) };
  });
  const edges = async () => {
    const box = await boxOf(grid);
    return [Math.round(box.x), Math.round(box.x + box.width)];
  };
  await runCommand(page, LAYOUT_SETTINGS);
  const dialog = page.locator(".swl-dialog");
  await dialog.getByRole("tab", { name: "Alignment" }).click();
  const select = dialog.getByRole("combobox", { name: "Grid: where it stands" });
  await expect(select).toHaveValue("");
  await select.selectOption("right");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await edges())[1]).toBe(Math.round(text.right));
  await expect.poll(() => space.config()).toMatch(/silverware-layout-grid\/grid.*right/);
  // Its own, from its handle's menu: at the left, written in its line, the setting's default named in the menu
  await grid.hover();
  await page.locator(".swl-handle-bar").click();
  await expect(page.locator(".swl-popup .swl-segment[title='Right (default)']")).toHaveAttribute("aria-checked", "true");
  await page.locator(".swl-popup .swl-segment[title='Left']").click();
  await expect.poll(() => space.saved("Page")).toContain('<grid width="400" align="left">');
  await expect.poll(async () => (await edges())[0]).toBe(Math.round(text.left));
  // The setting's default chosen from the menu: none of its own written
  await grid.hover();
  await page.locator(".swl-handle-bar").click();
  await page.locator(".swl-popup .swl-segment[title='Right (default)']").click();
  await expect.poll(() => space.saved("Page")).toContain('<grid width="400">');
});

test("a divider between columns is a line alone: nothing over the grid, the line lit over it as pointed at, no grip (a grip is a widget's width: the grid's handle beside it)", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  // The pointer over a cell: the grid's own handle beside it, nothing in the gap (the divider placed there meanwhile)
  await page.locator("#sb-main .swl-grid-cell").first().getByText("Left text").hover();
  await expect(page.locator(".swl-handle-bar")).toBeVisible();
  const divider = page.locator("#sb-main .swl-grid-divider");
  await expect(divider).toHaveCount(1);
  const shown = () => divider.evaluate((element) => [getComputedStyle(element, "::before").opacity, getComputedStyle(element, "::after").opacity]);
  await expect.poll(shown).toEqual(["0", "0"]);
  // Over the divider: its line, the column's cursor; still no grip
  await divider.hover();
  await expect.poll(shown).toEqual(["1", "0"]);
  await expect(divider).toHaveCSS("cursor", "col-resize");
});

test("a tall grid's divider knob (a touch screen's) and its drag's label ride in the part of the grid in view as the page scrolls, as a widget's handle does", async ({ page, space }) => {
  const long = Array.from({ length: 80 }, (_, i) => `Line ${i + 1}`).join("\n\n");
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${long}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  // (Scrolled so that the grid's top is far above the window, its end below it)
  await page.locator("#sb-main .swl-grid-cell", { hasText: "Line 40" }).getByText("Line 40", { exact: true }).scrollIntoViewIfNeeded();
  await grid.hover({ position: { x: 10, y: (await grid.evaluate((element) => -element.getBoundingClientRect().top)) + 300 } });
  const divider = page.locator("#sb-main .swl-grid-divider");
  await expect(divider).toHaveCount(1);
  const gripInWindow = () =>
    divider.evaluate((element) => {
      const top = element.getBoundingClientRect().top + parseFloat(getComputedStyle(element, "::after").top);
      return top > 0 && top < window.innerHeight;
    });
  await expect.poll(gripInWindow).toBe(true);
  // Scrolled further: still in view
  await page.mouse.wheel(0, 600);
  await expect.poll(gripInWindow).toBe(true);
});

test("a grid scrolled under a pointer that stays put gets its divider and its knob's place, no pointer's coming into it needed", async ({ page, space }) => {
  const above = Array.from({ length: 40 }, (_, i) => `Above ${i + 1}`).join("\n\n");
  const long = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join("\n\n");
  await space.open({ Page: `# Page\n\n${above}\n\n<grid>\n<cell>\n\n${long}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nBelow\n` }, "Page");
  // (The pointer in the middle of the window, over the text above the grid; then the page scrolled under it)
  const middle = await page.evaluate(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));
  await page.mouse.move(middle.x - 100, middle.y);
  // (The grid drawn only once near the window: its place read where it is there)
  const gridTop = () => page.evaluate(() => document.querySelector("#sb-main .swl-grid")?.getBoundingClientRect().top);
  for (let i = 0; i < 30; i++) {
    const top = await gridTop();
    if (top !== undefined && top < middle.y - 200) break;
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(100);
  }
  const divider = page.locator("#sb-main .swl-grid-divider");
  await expect(divider).toHaveCount(1);
  await expect
    .poll(() =>
      divider.evaluate((element) => {
        const top = element.getBoundingClientRect().top + parseFloat(getComputedStyle(element, "::after").top);
        return top > 0 && top < window.innerHeight;
      }),
    )
    .toBe(true);
});

test("the divider between two columns dragged: their shares change as it moves, snapping to 2 : 1, written; a double click makes them even again", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const cells = page.locator("#sb-main .swl-grid-cell");
  const widths = async () => [(await boxOf(cells.nth(0))).width, (await boxOf(cells.nth(1))).width];
  const [a, b] = await widths();
  await page.locator("#sb-main .swl-grid").hover();
  const divider = page.locator("#sb-main .swl-grid-divider");
  await expect(divider).toHaveCount(1);
  const box = await boxOf(divider);
  const y = box.y + Math.min(box.height / 2, 20);
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  // To two thirds of the two columns: 2 : 1, said as it snaps, shown at once
  const target = (a! + b!) * (2 / 3) - a!;
  await page.mouse.move(box.x + box.width / 2 + target + 3, y, { steps: 10 });
  await expect(page.locator(".swl-grid-divider-label")).toHaveText("2 : 1");
  // A guide at each ratio's place while it is dragged, the one snapped to lit; none after
  await expect(page.locator("#sb-main .swl-grid-guide")).toHaveCount(7);
  await expect(page.locator("#sb-main .swl-grid-guide.swl-grid-guide-near")).toHaveText("2 : 1");
  await expect.poll(async () => {
    const [first, second] = await widths();
    return Math.round((first! / second!) * 10) / 10;
  }).toBe(2);
  await page.mouse.up();
  await expect(page.locator("#sb-main .swl-grid-guide")).toHaveCount(0);
  await expect.poll(() => space.saved("Page")).toContain('<grid columns="2fr 1fr">');
  // Even again: the attribute taken off (two cells are two even columns anyway), the divider moved with the columns at
  // once (it stayed where 2 : 1 had it: the grid is not drawn anew, its body the same)
  await divider.dblclick();
  await expect.poll(() => space.saved("Page")).toContain("<grid>\n");
  await expect.poll(async () => {
    const [first, second, line] = [(await boxOf(cells.nth(0))), (await boxOf(cells.nth(1))), (await boxOf(divider))];
    return Math.round(Math.abs(line.x + line.width / 2 - (first.x + first.width + second.x) / 2));
  }).toBeLessThan(2);
});

test("a grid's columns set to Auto in its handle's menu: as many to a row as fit, none under its min width, no divider; a count again", async ({ page, space }) => {
  const cells = Array.from({ length: 8 }, (_, i) => `<cell>\n\nCell ${i + 1}\n\n</cell>\n`).join("");
  await space.open({ Page: `# Page\n\n<grid>\n${cells}</grid>\n\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const choose = async (row: string, option: string) => {
    await page.mouse.move(0, 0);
    await grid.hover();
    await page.locator(".swl-handle-bar").click();
    await page.locator(".swl-popup .swl-menu-segmented", { hasText: row }).locator(".swl-segment", { hasText: new RegExp(`^${option}$`) }).click();
  };
  // How many cells the first row has, the narrowest column's width, the gap between two
  const firstRow = () =>
    grid.evaluate((element) => {
      const boxes = [...element.querySelectorAll(":scope > .swl-grid-cell")].map((cell) => cell.getBoundingClientRect());
      const row = boxes.filter((box) => Math.abs(box.top - boxes[0]!.top) < 1);
      return {
        count: row.length,
        narrowest: Math.min(...boxes.map((box) => box.width)),
        gap: parseFloat(getComputedStyle(element).columnGap) || 0,
        // (How far the first row's last cell is from the grid's right edge: fewer cells than fit share the whole row)
        rightGap: element.getBoundingClientRect().right - Math.max(...row.map((box) => box.right)),
      };
    });
  await choose("Columns", "Auto");
  await expect.poll(() => space.saved("Page")).toContain('<grid columns="auto">');
  await expect(grid).toHaveAttribute("data-swl-fit", "");
  const width = (await boxOf(grid)).width;
  const { gap } = await firstRow();
  const fit = (min: number) => Math.min(8, Math.max(1, Math.floor((width + gap) / (min + gap))));
  // M: 240 px at least
  await expect.poll(async () => (await firstRow()).count).toBe(fit(240));
  expect((await firstRow()).narrowest).toBeGreaterThanOrEqual(Math.min(240, width));
  await expect(page.locator("#sb-main .swl-grid-divider")).toHaveCount(0);
  // XS: 100 px at least, more to a row; chosen in the menu left open by Auto, shown anew with its min width
  const minWidths = page.locator(".swl-popup .swl-menu-segmented", { hasText: "Min width" });
  await expect(minWidths).toBeVisible();
  await minWidths.locator(".swl-segment", { hasText: /^XS$/ }).click();
  await expect(page.locator(".swl-popup")).toHaveCount(0);
  await expect.poll(() => space.saved("Page")).toContain('<grid columns="auto" min-width="xs">');
  await expect.poll(async () => (await firstRow()).count).toBe(fit(100));
  expect((await firstRow()).rightGap).toBeLessThan(2);
  // A count again: that many to a row, its min width gone, its dividers back
  await choose("Columns", "3");
  await expect.poll(() => space.saved("Page")).toContain('<grid columns="3">');
  await expect(grid).not.toHaveAttribute("data-swl-fit");
  await expect.poll(async () => (await firstRow()).count).toBe(3);
  await page.mouse.move(0, 0);
  await grid.hover();
  await expect(page.locator("#sb-main .swl-grid-divider")).toHaveCount(2);
});

test("a wide grid's divider snaps to the text's edge too: its first column lined up with the text, said and guided", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID.replace("<grid>", '<grid width="1100">')}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const textRight = await page.locator("#sb-main .cm-content").evaluate((content) => {
    const box = content.getBoundingClientRect();
    return box.right - parseFloat(getComputedStyle(content).paddingRight);
  });
  await page.locator("#sb-main .swl-grid").hover();
  const divider = page.locator("#sb-main .swl-grid-divider");
  const box = await boxOf(divider);
  const y = box.y + Math.min(box.height / 2, 20);
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  // The first column's right edge to the text's right edge (the divider half the gap beyond it), a few px short
  const gap = await page.locator("#sb-main .swl-grid").evaluate((grid) => parseFloat(getComputedStyle(grid).columnGap));
  await page.mouse.move(textRight + gap / 2 - 4, y, { steps: 10 });
  await expect(page.locator(".swl-grid-divider-label")).toHaveText("Page width");
  await expect(page.locator("#sb-main .swl-grid-guide.swl-grid-guide-near")).toHaveText("Page width");
  const right = await boxOf(page.locator("#sb-main .swl-grid-cell").first());
  expect(Math.round(right.x + right.width)).toBe(Math.round(textRight));
  // The guide where the divider is, snapped (its line on the divider's, not on the column's edge beside it)
  const middle = async (selector: string) => {
    const one = await boxOf(page.locator(selector));
    return Math.round(one.x + one.width / 2);
  };
  expect(Math.abs((await middle("#sb-main .swl-grid-guide.swl-grid-guide-near")) - (await middle("#sb-main .swl-grid-divider")))).toBeLessThanOrEqual(1);
  await page.mouse.up();
  await expect.poll(() => space.saved("Page")).toMatch(/<grid width="1100" columns="[^"]+">/);
});

test("what a cell draws in the theme's look: a table a card of its corners, a picture's and a code block's corners, a quote's bar", async ({ page, space }) => {
  const cellText = "| A | B |\n|---|---|\n| 1 | 2 |\n\n```\nlet x = 1;\n```\n\n> A quote";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cellText}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const cell = page.locator("#sb-main .swl-grid-cell").first();
  // The theme's corners (none where it names none: SilverBullet 2.12.1, whose page has none either)
  const radius = (name: string) => page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "0px", name);
  const looks = await cell.evaluate((cell) => {
    const style = (selector: string) => getComputedStyle(cell.querySelector(selector)!);
    return { table: style("table").borderTopLeftRadius, collapse: style("table").borderCollapse, code: style("pre").borderTopLeftRadius, quote: style("blockquote").borderLeftStyle };
  });
  expect(looks).toEqual({ table: await radius("--ui-radius-xl"), collapse: "separate", code: await radius("--ui-radius-lg"), quote: "solid" });
});

test("a grid in a page embedded in another: drawn with its own columns, not edited there", async ({ page, space }) => {
  await space.open(
    {
      Host: `# Host\n\nAbove\n\n![[${space.folder}/Embedded]]\n\nBelow\n`,
      Embedded: `# Embedded\n\n${GRID.replace("<grid>", '<grid columns="1fr 3fr">')}`,
    },
    "Host",
  );
  const shown = page.locator("#sb-main .swl-grid-shown");
  await expect(shown).toHaveCount(1, { timeout: 15000 });
  await expect(shown.locator(".swl-grid-cell")).toHaveText(["Left text", "Right text"]);
  const [a, b] = [(await boxOf(shown.locator(".swl-grid-cell").nth(0))).width, (await boxOf(shown.locator(".swl-grid-cell").nth(1))).width];
  expect(Math.round(b / a)).toBe(3);
  await shown.locator(".swl-grid-cell").first().click();
  await expect(shown.locator("textarea")).toHaveCount(0);
});

test("a grid's hashtags in the index: a tag of the page, a paragraph holding it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID.replace("Left text", "Left #uigridtag text")}` }, "Page");
  await gridsDrawn(page);
  type Indexed = { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } };
  const query = (tag: string) => page.evaluate((t) => (window as unknown as { client: Indexed }).client.clientSystem.localSyscall("index.queryLuaObjects", [t, {}]), tag);
  await expect
    .poll(async () => ((await query("tag")) as { name: string; page: string; parent: string }[]).filter((one) => one.name === "uigridtag").map((one) => `${one.page}:${one.parent}`))
    .toEqual([`${space.folder}/Page:page`]);
  const paragraphs = (await query("paragraph")) as { page: string; text: string; tags?: string[] }[];
  expect(paragraphs.filter((one) => one.page === `${space.folder}/Page`).map((one) => [one.text, one.tags])).toEqual([["Left #uigridtag text", ["uigridtag"]]]);
});

test("Wrap in grid: the tasks selected split into 2 columns, a list in each, by the command's two picks", async ({ page, space }) => {
  const tasks = "- [ ] one\n- [ ] two\n- [x] three\n- [ ] four\n- [ ] five";
  await space.open({ Page: `# Page\n\n${tasks}\n\nAfter\n` }, "Page");
  await page.evaluate((list) => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } } }).client.editorView;
    const text = view.state.doc.toString();
    view.dispatch({ selection: { anchor: text.indexOf(list), head: text.indexOf(list) + list.length } });
  }, tasks);
  // (Not awaited: the command waits for the picks)
  void runCommand(page, "Silverware Layout: Wrap in grid");
  const box = page.locator(".sb-modal-box, .sb-modal").first();
  await expect(box).toContainText("Wrap 5 blocks in a grid");
  // (Keys once the filter box has the focus: before, they would be the editor's, the selection typed over)
  const field = page.locator(".sb-modal-box input, .sb-modal input").first();
  await expect(field).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(box).toContainText("How many columns");
  await expect(field).toBeFocused();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => space.saved("Page"))
    .toBe("# Page\n\n<grid>\n<cell>\n\n- [ ] one\n- [ ] two\n- [x] three\n\n</cell>\n<cell>\n\n- [ ] four\n- [ ] five\n\n</cell>\n</grid>\n\nAfter\n");
});

test("Wrap in grid takes a paragraph's lines as blocks each, as the editor shows them apart", async ({ page, space }) => {
  const lines = "First line\nSecond line\nThird line";
  await space.open({ Page: `# Page\n\n${lines}\n\nAfter\n` }, "Page");
  await page.evaluate((text) => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } } }).client.editorView;
    const all = view.state.doc.toString();
    view.dispatch({ selection: { anchor: all.indexOf(text), head: all.indexOf(text) + text.length } });
  }, lines);
  void runCommand(page, "Silverware Layout: Wrap in grid");
  const box = page.locator(".sb-modal-box, .sb-modal").first();
  await expect(box).toContainText("Wrap 3 blocks in a grid");
  await page.keyboard.press("Escape");
});

/** The page's editor's selection set over a text of it */
async function selectText(page: import("@playwright/test").Page, text: string): Promise<void> {
  await page.evaluate((wanted) => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } } }).client.editorView;
    const all = view.state.doc.toString();
    view.dispatch({ selection: { anchor: all.indexOf(wanted), head: all.indexOf(wanted) + wanted.length } });
  }, text);
}

test("Move to grid: two paragraphs a cell each, put where the line shows between the grid's cells, taken out of the page in one edit", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nOne\n\nTwo\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  await selectText(page, "One\n\nTwo");
  void runCommand(page, "Silverware Layout: Move to grid");
  const box = page.locator(".sb-modal-box, .sb-modal").first();
  await expect(box).toContainText("Move 2 blocks to a grid");
  await expect(page.locator(".sb-modal-box input, .sb-modal input").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  // The bar says what to do; the line between the cells, labelled with the cells made, follows the pointer
  await expect(page.locator(".swl-pick-bar")).toContainText("2 new cells go there");
  const second = await boxOf(page.locator("#sb-main .swl-grid-cell").nth(1));
  await page.mouse.move(second.x + 10, second.y + second.height / 2);
  const mark = page.locator(".swl-pick-mark");
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute("data-swl-pick", "between-columns");
  await expect(page.locator(".swl-pick-label")).toHaveText("2 new cells");
  // (The line in the gap left of the second cell)
  const line = await boxOf(mark);
  expect(line.x + line.width / 2).toBeLessThan(second.x);
  await page.mouse.click(second.x + 10, second.y + second.height / 2);
  await expect(page.locator(".swl-pick-bar")).toHaveCount(0);
  await expect
    .poll(() => space.saved("Page"))
    .toBe("# Page\n\n<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nOne\n\n</cell>\n<cell>\n\nTwo\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n\nAfter\n");
  // (No cell opened by the click that picked)
  await expect(cellField(page)).toHaveCount(0);
});

test("Move to grid: Esc gives up, nothing written; a block put into a cell where the line shows inside it", async ({ page, space }) => {
  const text = `# Page\n\n${GRID}\nMoved\n\nAfter\n`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  await selectText(page, "Moved");
  // (One block: no mode asked, it goes together)
  void runCommand(page, "Silverware Layout: Move to grid");
  await expect(page.locator(".swl-pick-bar")).toContainText("or in a cell to add it there");
  await page.keyboard.press("Escape");
  await expect(page.locator(".swl-pick-bar")).toHaveCount(0);
  await expect(page.locator(":root[data-swl-picking]")).toHaveCount(0);
  expect(await space.saved("Page")).toBe(text);
  void runCommand(page, "Silverware Layout: Move to grid");
  await expect(page.locator(".swl-pick-bar")).toBeVisible();
  const first = page.locator("#sb-main .swl-grid-cell").first();
  const cell = await boxOf(first);
  // (In the cell's middle, under its text: after its last block)
  await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height - 2);
  await expect(page.locator(".swl-pick-mark")).toHaveAttribute("data-swl-pick", "inside");
  await expect(page.locator(".swl-pick-label")).toHaveText("Into this cell");
  await expect(first).toHaveClass(/swl-grid-pick-cell/);
  await page.mouse.click(cell.x + cell.width / 2, cell.y + cell.height - 2);
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${GRID.replace("Left text\n", "Left text\n\nMoved\n")}\nAfter\n`);
});

test("a cell's grip and the grid's handle: the cell moved right by its grip's menu, then the grid unwrapped by its handle's, its content kept in its order", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const pick = async (cell: number, label: string) => {
    const target = page.locator("#sb-main .swl-grid-cell").nth(cell);
    await target.hover();
    // (Its grip at the middle of the cell's top edge, shown as the pointer is over the cell)
    const grip = target.locator(".swl-grid-cell-grip");
    await expect(grip).toHaveCSS("opacity", "1");
    // (Its upper half above the cell, not cut off by the box the host draws the grid in)
    expect(await grip.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return document.elementFromPoint(box.left + box.width / 2, box.top + 1) === element;
    })).toBe(true);
    await grip.click();
    await page.locator(".swl-popup .swl-menu-item", { hasText: label }).click();
  };
  await pick(0, "Move right");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${GRID.replace("Left text", "@@").replace("Right text", "Left text").replace("@@", "Right text")}\nAfter\n`);
  await gridsDrawn(page);
  await expect(page.locator("#sb-main .swl-grid-cell").first()).toContainText("Right text");
  // The grid's own items: its handle's menu, after Align (no "…" on its cells any more)
  await expect(page.locator("#sb-main .swl-grid-cell-more")).toHaveCount(0);
  await page.locator("#sb-main .swl-grid").hover();
  await page.locator(".swl-handle-bar").click();
  await expect(page.locator(".swl-popup .swl-menu-segmented", { hasText: "Align" })).toBeVisible();
  await page.locator(".swl-popup .swl-menu-item", { hasText: "Unwrap grid" }).click();
  // (Two cells of a line of text each: a line break between, as a paragraph's lines put into cells come back)
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\nRight text\nLeft text\n\nAfter\n");
});

test("Delete cell… in a cell's grip's menu: asked in SilverBullet's dialog; cancelled, nothing; confirmed, the cell and its content gone", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const remove = async () => {
    const second = page.locator("#sb-main .swl-grid-cell").nth(1);
    await second.hover();
    await second.locator(".swl-grid-cell-grip").click();
    const item = page.locator(".swl-popup .swl-menu-item", { hasText: "Delete cell" });
    await expect(item).toHaveClass(/swl-danger/);
    await item.click();
  };
  const confirm = page.locator(".sb-modal-box, .sb-modal").filter({ hasText: "Delete cell 2" });
  await remove();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: /Cancel/ }).click();
  await expect(confirm).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await space.saved("Page")).toContain("Right text");
  await remove();
  await confirm.locator("button").last().click();
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n<grid>\n<cell>\n\nLeft text\n\n</cell>\n</grid>\n\nAfter\n`);
});

test("a cell edited, its grip's menu: the cell left and written, Move right then done on the grid drawn anew, both kept", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const first = page.locator("#sb-main .swl-grid-cell").first();
  await expect(async () => {
    if (await cellField(page).count()) await page.keyboard.press("Escape");
    await first.getByText("Left text").click();
    await expect(cellField(page)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" typed");
  // (The edited cell's own grip: kept while it is edited)
  await first.hover();
  await first.locator(".swl-grid-cell-grip").click();
  await page.locator(".swl-popup .swl-menu-item", { hasText: "Move right" }).click();
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${GRID.replace("Left text", "@@").replace("Right text", "Left text typed").replace("@@", "Right text")}\nAfter\n`);
});

test("an Auto grid of fewer cells than fit: they share the grid's whole width, nothing left empty beside them", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n<grid columns="auto" min-width="xs">\n<cell>\n\nOne\n\n</cell>\n<cell>\n\nTwo\n\n</cell>\n</grid>\n\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const places = await page.locator("#sb-main .swl-grid").evaluate((grid) => {
    const box = grid.getBoundingClientRect();
    const cells = [...grid.querySelectorAll(":scope > .swl-grid-cell")].map((cell) => cell.getBoundingClientRect());
    return { rightGap: Math.round(box.right - cells[1]!.right), sameRow: Math.abs(cells[0]!.top - cells[1]!.top) < 1, half: Math.round(cells[0]!.width / box.width * 10) };
  });
  expect(places).toEqual({ rightGap: 0, sameRow: true, half: 5 });
});

test("a cell's field draws a task's box and a hashtag as the page renders them (the look read of the page, any version's)", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n- [ ] open #tag\n- [x] done\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const look = (one: Element) => {
    const style = getComputedStyle(one);
    const box = one.getBoundingClientRect();
    const mark = getComputedStyle(one, "::after");
    return [Math.round(box.width), Math.round(box.height), style.appearance, style.borderTopWidth, style.borderTopLeftRadius, style.backgroundColor, style.color, mark.content, style.paddingLeft];
  };
  const cell = page.locator("#sb-main .swl-grid-cell").first();
  const rendered = {
    open: await cell.locator('input[type="checkbox"]').first().evaluate(look),
    done: await cell.locator('input[type="checkbox"]').nth(1).evaluate(look),
    tag: await cell.getByText("#tag").evaluate(look),
  };
  await cell.getByText("done").click();
  await expect(cellField(page)).toBeVisible();
  const shown = await cellField(page).evaluate((root: HTMLElement, source: string) => {
    const read = new Function("one", `return (${source})(one)`) as (one: Element) => unknown[];
    const shadow = root.shadowRoot!;
    const boxes = shadow.querySelectorAll(".swe-checkbox");
    return { open: read(boxes[0]!), done: read(boxes[1]!), tag: read(shadow.querySelector(".swe-hashtag")!) };
  }, look.toString());
  expect(shown).toEqual(rendered);
});

test("a task's text wrapped in a cell's field as the cell draws it: its next lines where the cell's begin, after its box", async ({ page, space }) => {
  const words = "first second third fourth fifth sixth seventh eighth";
  await space.open({ Page: `# Page\n\n<grid columns="1fr 3fr">\n<cell>\n\n- [ ] ${words}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n` }, "Page");
  await gridsDrawn(page);
  // Where each of the task's text's lines begins (px from the cell's left), of its text nodes
  const lineStarts = (root: Node, cellLeft: number): number[] => {
    const starts: number[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!/\w/.test(node.textContent ?? "")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) if (rect.width > 0) starts.push(Math.round(rect.left - cellLeft));
    }
    return starts;
  };
  const cell = page.locator("#sb-main .swl-grid-cell").first();
  const rendered = await cell.evaluate((element, source) => {
    const starts = new Function("root", "cellLeft", `return (${source})(root, cellLeft)`) as (root: Node, left: number) => number[];
    return starts(element, element.getBoundingClientRect().left);
  }, lineStarts.toString());
  expect(rendered.length).toBeGreaterThan(2);
  await cell.getByText("first").click();
  await expect(cellField(page)).toBeVisible();
  // (The caret away from the task's line: its box drawn, its marks hidden)
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  const edited = await cellField(page).evaluate((root: HTMLElement, source) => {
    const starts = new Function("root", "cellLeft", `return (${source})(root, cellLeft)`) as (root: Node, left: number) => number[];
    const line = root.shadowRoot!.querySelector(".swe-list-line")!;
    return starts(line, (root.closest(".swl-grid-cell") as HTMLElement).getBoundingClientRect().left);
  }, lineStarts.toString());
  // Each line begins where the cell's does, the next ones under the first (after the box); it wraps in the field too
  expect(edited.length).toBeGreaterThan(2);
  expect(edited.map((x) => Math.abs(x - rendered[0]!) <= 2)).toEqual(edited.map(() => true));
  expect(rendered.map((x) => Math.abs(x - rendered[0]!) <= 2)).toEqual(rendered.map(() => true));
});

test("a cell's lists drawn and in its field alike: each text after its mark's room, the marks in the bullets' colour, a done task struck through; a table a card in both", async ({ page, space }) => {
  const cellText = "- one\n- two\n\n1. first\n2. second\n\n- [ ] open\n- [x] done\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nEnd";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cellText}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n` }, "Page");
  await gridsDrawn(page);
  // Where each word's text begins, px from the cell's left
  const starts = (root: Node, cellLeft: number, words: string[]): number[] =>
    words.map((word) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent?.indexOf(word) ?? -1;
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + 1);
        return Math.round(range.getBoundingClientRect().left - cellLeft);
      }
      return -1;
    });
  const WORDS = ["one", "first", "open", "done"];
  const cell = page.locator("#sb-main .swl-grid-cell").first();
  const rendered = await cell.evaluate(
    (element, [source, words]) => {
      const read = new Function("root", "left", "words", `return (${source})(root, left, words)`) as (root: Node, left: number, words: string[]) => number[];
      const marks = [...element.querySelectorAll(":scope > :is(ul, ol) > li")].map((li) => getComputedStyle(li, "::before").color);
      const done = element.querySelector("input:checked")!.parentElement!;
      return {
        starts: read(element, element.getBoundingClientRect().left, words as string[]),
        bullet: marks[0],
        number: marks[2],
        done: getComputedStyle(done).textDecorationLine,
        table: getComputedStyle(element.querySelector(":scope > table")!).borderTopLeftRadius,
        // (A header cell's text and the ground it is drawn on: its own, else its row's)
        head: (() => {
          const head = element.querySelector(":scope > table thead :is(th, td)")!;
          const grounds = [head, head.parentElement!, head.parentElement!.parentElement!].map((one) => getComputedStyle(one).backgroundColor);
          return [getComputedStyle(head).color, grounds.find((ground) => ground !== "rgba(0, 0, 0, 0)") ?? "rgba(0, 0, 0, 0)"];
        })(),
      };
    },
    [starts.toString(), WORDS] as const,
  );
  await cell.getByText("two").click();
  await expect(cellField(page)).toBeVisible();
  // (The caret on no list's line: their marks drawn)
  await page.keyboard.press("Control+End");
  const edited = await cellField(page).evaluate(
    (root: HTMLElement, [source, words]) => {
      const read = new Function("root", "left", "words", `return (${source})(root, left, words)`) as (root: Node, left: number, words: string[]) => number[];
      const shadow = root.shadowRoot!;
      const style = (selector: string) => getComputedStyle(shadow.querySelector(selector)!);
      return {
        starts: read(shadow, (root.closest(".swl-grid-cell") as HTMLElement).getBoundingClientRect().left, words as string[]),
        bullet: style(".swe-bullet").color,
        number: style(".swe-list-number").color,
        done: style(".swe-task-done").textDecorationLine,
        table: style(".swe-table").borderTopLeftRadius,
        head: [style(".swe-table thead th").color, style(".swe-table thead th").backgroundColor],
      };
    },
    [starts.toString(), WORDS] as const,
  );
  expect(rendered.starts.every((x) => x > 0)).toBe(true);
  expect(edited.starts.map((x, i) => Math.abs(x - rendered.starts[i]!) <= 2)).toEqual(WORDS.map(() => true));
  expect({ ...edited, starts: undefined }).toEqual({ ...rendered, starts: undefined });
  expect(rendered.done).toBe("line-through");
  const bullets = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--editor-list-bullet-color").trim());
  if (bullets) expect(rendered.bullet).not.toBe(await cell.evaluate((element) => getComputedStyle(element).color));
});

test("a cell of a grid without borders edited: lines in the middle of its gaps, nothing moved (the cells' places, their text's)", async ({ page, space }) => {
  const cells = Array.from({ length: 4 }, (_, i) => `<cell>\n\nCell ${i + 1}\n\n</cell>\n`).join("");
  await space.open({ Page: `# Page\n\n<grid>\n${cells}</grid>\n\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const places = () =>
    grid.evaluate((element) =>
      [...element.querySelectorAll(":scope > .swl-grid-cell")].map((cell) => {
        const box = cell.getBoundingClientRect();
        return [Math.round(box.left), Math.round(box.top), Math.round(box.width)];
      }),
    );
  const text = async () => (await boxOf(page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Cell 2")));
  const before = await places();
  const second = await text();
  await page.locator("#sb-main .swl-grid-cell").first().getByText("Cell 1").click();
  await expect(cellField(page)).toBeVisible();
  expect(await places()).toEqual(before);
  const now = await text();
  expect([Math.round(now.x), Math.round(now.y)]).toEqual([Math.round(second.x), Math.round(second.y)]);
  // Its lines: the grid's top and left, each cell's right and bottom
  expect(await grid.evaluate((element) => getComputedStyle(element, "::before").boxShadow)).not.toBe("none");
  expect(await grid.evaluate((element) => getComputedStyle(element.querySelector(".swl-grid-cell")!, "::after").boxShadow)).not.toBe("none");
  // None once it is left
  await page.keyboard.press("Escape");
  await expect(cellField(page)).toHaveCount(0);
  expect(await grid.evaluate((element) => getComputedStyle(element, "::before").content)).toBe("none");
});

test("Clear cell… above Delete cell… in a cell's grip's menu: asked in SilverBullet's dialog; cancelled, nothing; confirmed, the cell's content gone, the cell kept", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const clear = async () => {
    const second = page.locator("#sb-main .swl-grid-cell").nth(1);
    await second.hover();
    await second.locator(".swl-grid-cell-grip").click();
    const items = page.locator(".swl-popup .swl-menu-item");
    await expect(items.nth(-2)).toHaveText("Clear cell…");
    await expect(items.last()).toHaveText("Delete cell…");
    await items.nth(-2).click();
  };
  const confirm = page.locator(".sb-modal-box, .sb-modal").filter({ hasText: "Clear cell 2" });
  await clear();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: /Cancel/ }).click();
  await expect(confirm).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await space.saved("Page")).toContain("Right text");
  await clear();
  await confirm.locator("button").last().click();
  await expect.poll(() => space.saved("Page")).not.toContain("Right text");
  expect(await space.saved("Page")).toContain("Left text");
  await expect(page.locator("#sb-main .swl-grid-cell")).toHaveCount(2);
});

// The grid menu's two choices of lines, by their titles
const INNER_LINES = "Lines between the cells alone";
const ALL_LINES = "Lines round the grid and between its cells";

test("a grid's borders from its handle's menu: written as its attribute, the first column's line where its divider is", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const borders = async () => {
    await grid.hover();
    await page.locator(".swl-handle-bar").click();
    await page.locator(".swl-popup .swl-menu-segmented").getByRole("menuitemradio", { name: ALL_LINES, exact: true }).click();
  };
  await borders();
  await expect(grid).toHaveAttribute("data-swl-border", "");
  await expect.poll(() => space.saved("Page")).toContain('<grid border="1">');
  // The first column's right line where the divider draws its own (the pixel after the column)
  await grid.hover();
  await expect(page.locator("#sb-main .swl-grid-divider")).toHaveCount(1);
  const places = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const line = (selector: string) => {
      const element = document.querySelector(selector)!;
      const box = element.getBoundingClientRect();
      const before = getComputedStyle(element, "::before");
      // (The line's place: its box's left, by its left or right in the element, its transform's shift)
      const width = parseFloat(before.width);
      const left = before.left !== "auto" ? parseFloat(before.left) : box.width - parseFloat(before.right) - width;
      const shift = new DOMMatrix(before.transform === "none" ? undefined : before.transform).m41;
      return box.left + left + shift;
    };
    return {
      first: rect("#sb-main .swl-grid-cell"),
      divider: line("#sb-main .swl-grid-divider"),
    };
  });
  expect(Math.abs(places.divider - places.first.right)).toBeLessThan(0.6);
  // Taken off again
  await borders();
  await expect(grid).not.toHaveAttribute("data-swl-border");
  await expect.poll(() => space.saved("Page")).toContain("<grid>\n");
});

test("a grid's lines between its cells alone from its handle's menu: in the middle of each gap, its rows' too, none round it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const choose = async (title: string) => {
    await grid.hover();
    await page.locator(".swl-handle-bar").click();
    await page.locator(".swl-popup .swl-menu-segmented").getByRole("menuitemradio", { name: title, exact: true }).click();
  };
  await choose(INNER_LINES);
  await expect(grid).toHaveAttribute("data-swl-border-inner", "");
  await expect(grid).not.toHaveAttribute("data-swl-border");
  await expect.poll(() => space.saved("Page")).toContain('<grid border="inner">');
  const lines = await page.evaluate(() => {
    const [first, second] = [...document.querySelectorAll<HTMLElement>("#sb-main .swl-grid-cell")];
    const before = getComputedStyle(second!, "::before");
    return {
      first: first!.getBoundingClientRect().right,
      second: second!.getBoundingClientRect().left,
      line: second!.getBoundingClientRect().left + parseFloat(before.left) + parseFloat(before.width) / 2,
      shown: before.content !== "none",
      row: getComputedStyle(first!, "::after").height,
      ring: getComputedStyle(document.querySelector("#sb-main .swl-grid")!).boxShadow,
    };
  });
  // The line in the gap's middle, no ring round the grid
  expect(lines.shown).toBe(true);
  expect(lines.row).toBe("1px");
  expect(Math.abs(lines.line - (lines.first + lines.second) / 2)).toBeLessThan(1);
  expect(lines.ring).toBe("none");
  // Switched to all lines, then taken off by the one chosen
  await choose(ALL_LINES);
  await expect(grid).toHaveAttribute("data-swl-border", "");
  await expect(grid).not.toHaveAttribute("data-swl-border-inner");
  await expect.poll(() => space.saved("Page")).toContain('<grid border="1">');
  await choose(ALL_LINES);
  await expect(grid).not.toHaveAttribute("data-swl-border");
  await expect.poll(() => space.saved("Page")).toContain("<grid>\n");
});

test("a grid of columns as many as fit, without borders, its width dragged: every line drawn, not its ring alone", async ({ page, space }) => {
  const cell = (text: string) => `<cell>\n\n${text}\n\n</cell>\n`;
  await space.open({ Page: `# Page\n\n<grid columns="auto" min-width="xs">\n${["One", "Two", "Three", "Four"].map(cell).join("")}</grid>\n\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const cellLines = () => grid.evaluate((element) => [...element.querySelectorAll(".swl-grid-cell")].map((one) => getComputedStyle(one, "::after").boxShadow));
  expect(await cellLines()).toEqual(["none", "none", "none", "none"]);
  await grid.hover();
  const bar = await boxOf(page.locator(".swl-handle-bar"));
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width / 2 - 20, bar.y + bar.height / 2, { steps: 4 });
  await expect.poll(async () => (await cellLines()).every((shadow) => shadow !== "none")).toBe(true);
  expect(await grid.evaluate((element) => getComputedStyle(element, "::before").boxShadow)).not.toBe("none");
  await page.mouse.up();
  await expect.poll(async () => (await cellLines()).every((shadow) => shadow === "none")).toBe(true);
});

test("SilverBullet's button bar of a grid's frame stays hidden as the pointer is over the grid", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}` }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().hover();
  await expect(page.locator("#sb-main .swl-grid-widget .sb-widget-menu-bar")).toBeHidden();
});

test("a click on a word of a cell edits it with the cursor in that word", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}` }, "Page");
  await gridsDrawn(page);
  const words = page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right text");
  const box = await boxOf(words);
  // Into "text", the second word
  await words.click({ position: { x: box.width - 6, y: box.height / 2 } });
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  const at = (await fieldState(page)).from;
  expect(at).toBeGreaterThanOrEqual("Right ".length);
  expect(at).toBeLessThanOrEqual("Right text".length);
  await page.keyboard.press("Escape");
});

test("text selected in a cell by a drag is selected in its field as it is edited", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID.replace("Right text", "Right side text")}` }, "Page");
  await gridsDrawn(page);
  const words = page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right side text");
  const box = await boxOf(words);
  const char = box.width / "Right side text".length;
  // From the start of "side" to its end
  await page.mouse.move(box.x + char * 6 + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + char * 10 - 1, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  const { from, to } = await fieldState(page);
  expect(from).toBeGreaterThanOrEqual("Right ".length - 1);
  expect(from).toBeLessThanOrEqual("Right s".length);
  expect(to).toBeGreaterThanOrEqual("Right sid".length);
  expect(to).toBeLessThanOrEqual("Right side".length + 1);
  await page.keyboard.press("Escape");
});

test("a selection by a drag carried into the field to the character: the user's cases", async ({ page, space }) => {
  const cell = "# test\n\nThis is my note!";
  await space.open({ Page: `# Page\n\n<grid>\n<cell>\n\n${cell}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const text = "This is my note!";
  const start = cell.indexOf(text);
  /** Where a character of the paragraph's text is drawn, its left edge (x) and its middle (y) */
  const at = (index: number) =>
    page.evaluate(
      ({ wanted, index }) => {
        const span = [...document.querySelectorAll("#sb-main .swl-grid-cell span")].find((one) => one.textContent === wanted)!;
        const node = span.firstChild!;
        const range = document.createRange();
        range.setStart(node, Math.min(index, wanted.length - 1));
        range.setEnd(node, Math.min(index, wanted.length - 1) + 1);
        const box = range.getBoundingClientRect();
        return { x: index >= wanted.length ? box.right : box.left, y: box.top + box.height / 2 };
      },
      { wanted: text, index },
    );
  const field = cellField(page);
  for (const [from, to] of [
    [4, text.length], // " is my note!"
    [5, 7], // "is"
    [8, text.length], // "my note!"
  ] as const) {
    // (SilverBullet may draw the page anew as another test's Library/Config is put back: the grid drawn again first)
    await gridsDrawn(page);
    const a = await at(from);
    const b = await at(to);
    await page.mouse.move(a.x + 1, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x - 1, b.y, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
    const state = await fieldState(page);
    expect([state.from, state.to], text.slice(from, to)).toEqual([start + from, start + to]);
    await page.keyboard.press("Escape");
    await expect(field).toHaveCount(0);
  }
});

test("a cell left by Esc, then a drag in a cell: the grid stays drawn, the field opens", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}` }, "Page");
  await gridsDrawn(page);
  const field = cellField(page);
  await page.locator("#sb-main .swl-grid-cell").first().click();
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);
  // (SilverBullet may draw the page anew as another test's Library/Config is put back: the grid drawn again first)
  await gridsDrawn(page);
  const words = page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right text");
  const box = await boxOf(words);
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  await expect(page.locator("#sb-main .swl-grid")).toHaveCount(1);
  await page.keyboard.press("Escape");
});

test("Ctrl+Z and Ctrl+Y in a cell's field undo and redo its typing, the page's text left alone", async ({ page, space }) => {
  const text = `# Page\n\n${GRID}`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().click();
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  const value = async () => (await fieldState(page)).text;
  await page.keyboard.press("End");
  await page.keyboard.type(" typed");
  await expect.poll(value).toBe("Left text typed");
  await page.keyboard.press("Control+z");
  await expect.poll(value).toBe("Left text");
  await page.keyboard.press("Control+y");
  await expect.poll(value).toBe("Left text typed");
  await page.keyboard.press("Control+z");
  await expect.poll(value).toBe("Left text");
  expect(await editorText(page)).toBe(text);
  await page.keyboard.press("Escape");
});

test("with Silverware Editor installed, a cell is edited in its editor: a list continued on Enter, its own undo, the page's editor left alone", async ({ page, space }) => {
  const text = `# Page\n\n<grid>\n<cell>\n\n- one\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  // (The editor is loaded once SilverBullet has started, when the browser is idle: a cell opened before is a plain field)
  await expect(async () => {
    if (await cellField(page).count()) await page.keyboard.press("Escape");
    await page.locator("#sb-main .swl-grid-cell").first().click();
    await expect(page.locator("#sb-main .swl-grid-editor .cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  const value = async () => (await fieldState(page)).text;
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("two");
  await expect.poll(value).toBe("- one\n- two");
  await page.keyboard.press("Control+z");
  await expect.poll(value).not.toBe("- one\n- two");
  await page.keyboard.press("Control+y");
  await expect.poll(value).toBe("- one\n- two");
  // Nothing of it in the page's editor while it is open; written as it is left
  expect(await editorText(page)).toBe(text);
  await page.keyboard.press("Escape");
  await expect.poll(() => space.saved("Page")).toContain("<cell>\n\n- one\n- two\n\n</cell>");
});

test("with Silverware Editor installed, a cell's markdown is shown as SilverBullet shows it: marks hidden away from the caret, a task's box toggling it", async ({ page, space }) => {
  const text = `# Page\n\n<grid>\n<cell>\n\nSome **bold** and [[Other|a link]]\n- [ ] open\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  const field = page.locator("#sb-main .swl-grid-editor");
  await expect(async () => {
    if (await cellField(page).count()) await page.keyboard.press("Escape");
    await page.locator("#sb-main .swl-grid-cell").first().click();
    await expect(field.locator(".cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  // (The caret at the end, on the task's line: the first line's marks hidden)
  await page.keyboard.press("Control+End");
  await expect(field.locator(".cm-line").first()).toHaveText("Some bold and a link");
  await expect(field.locator(".swe-wiki-link")).toHaveText("a link");
  // (At the first line's end: the link it touches shown as written, the bold it does not still hidden)
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("End");
  await expect(field.locator(".cm-line").first()).toHaveText("Some bold and [[Other|a link]]");
  await field.locator("input.swe-checkbox").click();
  await expect.poll(async () => (await fieldState(page)).text).toBe("Some **bold** and [[Other|a link]]\n- [x] open");
  await expect(field.locator(".swe-task-done")).toHaveText("open");
  await page.keyboard.press("Escape");
  await expect.poll(() => space.saved("Page")).toContain("<cell>\n\nSome **bold** and [[Other|a link]]\n- [x] open\n\n</cell>");
});

test("with Silverware Editor installed, a table in a cell is drawn as one while edited, its markdown shown once a cell of it is pressed", async ({ page, space }) => {
  const text = `# Page\n\n<grid>\n<cell>\n\nAbove\n\n| Name | Count |\n|---|--:|\n| **one** | 2 |\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  const field = page.locator("#sb-main .swl-grid-editor");
  await expect(async () => {
    if (await cellField(page).count()) await page.keyboard.press("Escape");
    await page.locator("#sb-main .swl-grid-cell").first().getByText("Above").click();
    await expect(field.locator(".cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  const table = field.locator(".swe-table");
  await expect(table.locator("th")).toHaveText(["Name", "Count"]);
  await expect(table.locator("td strong")).toHaveText("one");
  await expect(table.locator("td").nth(1)).toHaveCSS("text-align", "right");
  await table.locator("td").nth(1).click();
  await expect(table).toHaveCount(0);
  const cell = "Above\n\n| Name | Count |\n|---|--:|\n| **one** | 2 |";
  await expect.poll(async () => (await fieldState(page)).from).toBe(cell.indexOf("2 |"));
  await expect(field.locator(".cm-line").filter({ hasText: "Count" })).toHaveText("| Name | Count |");
  await page.keyboard.press("Escape");
  await expect.poll(() => space.saved("Page")).toContain(`<cell>\n\n${cell}\n\n</cell>`);
});

test("a task toggled in a cell of a grid of a width of its own: the grid drawn anew at that width from its first frame, no narrower one between", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n<grid width="900">\n<cell>\n\n- [ ] one\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const widget = page.locator("#sb-main .swl-grid-widget");
  await expect(widget).toHaveAttribute("data-swl-width", "900");
  // (Every frame's width of the grid in the page while it is drawn anew)
  await page.evaluate(() => {
    const widths: number[] = ((window as unknown as { swlWidths: number[] }).swlWidths = []);
    const until = performance.now() + 2000;
    const tick = () => {
      const grid = document.querySelector("#sb-main .swl-grid");
      if (grid) widths.push(Math.round(grid.getBoundingClientRect().width));
      if (performance.now() < until) requestAnimationFrame(tick);
    };
    tick();
  });
  await page.locator('#sb-main .swl-grid-cell input[type="checkbox"]').click();
  await expect.poll(() => space.saved("Page")).toContain("- [x] one");
  await page.waitForTimeout(2100);
  const widths = await page.evaluate(() => (window as unknown as { swlWidths: number[] }).swlWidths);
  expect(new Set(widths).size, `the grid's widths frame by frame: ${[...new Set(widths)].join(", ")}`).toBe(1);
});

test("a task in a cell: drawn as the page's own (no link to its place), its box toggling it in the cell, the page's other task alone", async ({ page, space }) => {
  const text = (state: string) => `# Page\n\n- [ ] outside\n\n<grid>\n<cell>\n\nThis is my note!\n- [${state}] inside\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n`;
  await space.open({ Page: text(" ") }, "Page");
  await gridsDrawn(page);
  const task = page.locator("#sb-main .swl-grid-cell .sb-task").first();
  await expect(task).toHaveText("inside");
  await expect(task.locator("a")).toHaveCount(0);
  await task.locator('input[type="checkbox"]').click();
  await expect.poll(() => space.saved("Page")).toBe(text("x"));
  await expect(cellField(page)).toHaveCount(0);
  await gridsDrawn(page);
  await page.locator('#sb-main .swl-grid-cell .sb-task input[type="checkbox"]').first().click();
  await expect.poll(() => space.saved("Page")).toBe(text(" "));
});

test("a cell written, the grid drawn anew: the other cells' rendering kept as it was (an image not loaded again), the page under it not moved", async ({ page, space }) => {
  const text = `# Page\n\n<grid>\n<cell>\n\n![[${space.folder}/a.png|A|80]]\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n\nAfter\n`;
  await space.open({ Page: text }, "Page", { "a.png": PIXEL_PNG });
  await gridsDrawn(page);
  const image = page.locator("#sb-main .swl-grid-cell").first().locator("img").first();
  await expect(image).toBeVisible();
  await image.evaluate((element) => element.setAttribute("data-test-kept", ""));
  const after = page.locator("#sb-main .cm-line", { hasText: "After" });
  const afterTop = (await boxOf(after)).y;
  // The second cell edited, then left by a click in the page's text: written, the grid drawn anew
  await expect(async () => {
    if (await cellField(page).count()) await page.keyboard.press("Escape");
    await page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right text").click();
    await expect(cellField(page)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" typed");
  await after.click();
  await expect.poll(() => space.saved("Page")).toContain("Right text typed");
  await expect(page.locator("#sb-main .swl-grid-cell").nth(1)).toContainText("Right text typed");
  // (The same image element in the grid drawn anew: taken over, not drawn again)
  await expect(page.locator("#sb-main .swl-grid [data-test-kept]")).toHaveCount(1);
  expect(Math.abs((await boxOf(after)).y - afterTop)).toBeLessThan(2);
});
