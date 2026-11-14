// Columns (docs/silverware-layout-grid.md) as a user works with them in SilverBullet: /grid, a cell edited in place,
// Alt+click to the raw text, columns set by the grid's line, a grid in an embedded page, its hashtags indexed.
import { cellField, cursorAt, editorText, expect, fieldState, fillField, gridsDrawn, PAGE_LAYOUT, runCommand, test } from "./helpers.ts";

const GRID = "<grid>\n<column>\n\nLeft text\n\n</column>\n<column>\n\nRight text\n\n</column>\n</grid>\n";

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
  await expect.poll(() => editorText(page)).toContain("<grid>\n<column>\n\n");
  const text = await editorText(page);
  expect(text.match(/<column>/g)).toHaveLength(2);
  // The cursor on the first column's blank line
  const first = text.indexOf("<column>\n\n") + "<column>\n\n".length;
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
  const words = (await cell.getByText("Right text").boundingBox())!;
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
  const text = `# Page\n\n<grid>\n<column>\n\nSome *italic* words\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n\nAfter\n`;
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
  const words = (await page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right").boundingBox())!;
  await mouseDrag(page, from, { x: words.x + words.width + 2, y: words.y + words.height / 2 });
  await expect.poll(() => editorText(page)).toBe(text.replace("Some *italic* words", "Some  words").replace("Right\n", "Right*italic*\n"));
  await expect(cellField(page)).toHaveCount(1);
});

test("a drag moves text: the page's selection into a cell, a cell's (its markdown) into another, each one edit undone at once; a cell's into the page taken out of it", async ({ page, space }) => {
  const text = `# Page\n\n<grid>\n<column>\n\nSome *italic* words\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n\nAfter\n`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  const endOfRight = async () => {
    const words = (await page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right").boundingBox())!;
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
  const after = (await page.locator("#sb-main .cm-line", { hasText: "After" }).boundingBox())!;
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
  const left = (await cells.first().getByText("Left text").boundingBox())!;
  const right = (await cells.nth(1).getByText("Right text").boundingBox())!;
  await page.mouse.click(left.x + 5, left.y + 5);
  await page.waitForTimeout(150);
  await page.mouse.click(right.x + 5, right.y + 5, { clickCount: 2 });
  await expect(cells.nth(1).locator(".swl-grid-editor")).toHaveCount(1);
  await expect(grid).toHaveCount(1);
  await page.keyboard.press("Escape");
  // A press between the cells (the divider there): the grid as it is, the page's cursor not in it
  const a = (await cells.first().boundingBox())!;
  const b = (await cells.nth(1).boundingBox())!;
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
  // The column's markdown on purpose: its menu's Edit markdown, the cursor at its text
  await cells.nth(1).hover();
  await cells.nth(1).locator(".swl-grid-cell-more").click();
  await page.locator(".swl-popup").getByText("Edit markdown").click();
  await expect(grid).toHaveCount(0);
  await expect.poll(() => cursorAt(page)).toBe(text.indexOf("Right text"));
});

test("a column shorter than its row clicked under its text: edited, the caret after its last character", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n<grid>\n<column>\n\nOne\n\nTwo\n\nThree\n\nFour\n\n</column>\n<column>\n\nShort\n\n</column>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const short = page.locator("#sb-main .swl-grid-cell").nth(1);
  const box = (await short.boundingBox())!;
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
  const grid = (await page.locator("#sb-main .swl-grid").boundingBox())!;
  const content = (await page.locator("#sb-main .cm-content").boundingBox())!;
  const viewport = page.viewportSize()!;
  for (const x of [Math.max(4, content.x - 30), Math.min(viewport.width - 4, content.x + content.width + 30)]) {
    await page.mouse.click(x, grid.y + grid.height / 2);
    await page.waitForTimeout(400);
    await expect(page.locator("#sb-main .swl-grid")).toHaveCount(1);
  }
  const after = (await page.locator("#sb-main .cm-line", { hasText: "After" }).boundingBox())!;
  await page.mouse.click(Math.min(viewport.width - 4, content.x + content.width + 30), after.y + after.height / 2);
  await expect.poll(() => cursorAt(page)).toBe(text.length - 1);
});

test("Alt+click in a cell shows the raw text, the cursor where the click was", async ({ page, space }) => {
  const text = `# Page\n\n${GRID}`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  const words = page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right text");
  const box = (await words.boundingBox())!;
  // On "text", the second word
  await words.click({ modifiers: ["Alt"], position: { x: box.width - 4, y: box.height / 2 } });
  await expect.poll(() => cursorAt(page)).toBeGreaterThanOrEqual(text.indexOf("Right text") + "Right ".length);
  expect(await cursorAt(page)).toBeLessThanOrEqual(text.indexOf("Right text") + "Right text".length);
  // The raw text shown: the grid's lines are the editor's again
  await expect(page.locator("#sb-main .cm-content")).toContainText("<column>");
});

test("a grid's columns as its line says, given again as the line is edited", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID.replace("<grid>", '<grid columns="1fr 3fr">')}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const cells = page.locator("#sb-main .swl-grid-cell");
  const widthsOf = async () => [Math.round((await cells.nth(0).boundingBox())!.width), Math.round((await cells.nth(1).boundingBox())!.width)];
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
    const box = (await grid.boundingBox())!;
    return [Math.round(box.x), Math.round(box.x + box.width)];
  };
  const [left, right] = await edges();
  await grid.hover();
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const box = (await bar.boundingBox())!;
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
  await space.open({ Page: `# Page\n\n<grid>\n<column>\n\n${cell}\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const first = page.locator("#sb-main .swl-grid-cell").first();
  // The two SilverBullet's rendering leaves out, put back; those between paragraphs it keeps
  await expect(first.locator(".swl-grid-blank")).toHaveCount(2);
  const top = async (selector: string) => (await first.locator(selector).first().boundingBox())!.y;
  const line = (await first.locator("li").first().boundingBox())!.height;
  // item2 two lines under item (a blank line between), the heading a blank line under the list
  expect(Math.round(((await top("li >> nth=1")) - (await top("li"))) / line)).toBe(2);
  expect(Math.round(((await top("h1")) - (await top("li >> nth=1"))) / line)).toBe(2);
});

test("a click on a blank line of a cell puts the field's caret on that line, not at the cell's start", async ({ page, space }) => {
  // Two blank lines between the paragraphs (drawn as line breaks), one between the list's items (put back)
  const cell = "One\n\n\nTwo\n- a\n\n- b";
  await space.open({ Page: `# Page\n\n<grid>\n<column>\n\n${cell}\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n` }, "Page");
  await gridsDrawn(page);
  const first = page.locator("#sb-main .swl-grid-cell").first();
  const clickAbove = async (selector: string, lines: number) => {
    const box = (await first.locator(selector).first().boundingBox())!;
    const line = (await first.locator(".p").first().boundingBox())!.height;
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

test("an empty cell is a line high, clicked into to write in it", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n<grid>\n<column>\n\nLeft\n\n</column>\n<column>\n\n\n</column>\n</grid>\n" }, "Page");
  await gridsDrawn(page);
  const empty = page.locator("#sb-main .swl-grid-cell").nth(1);
  expect((await empty.boundingBox())!.height).toBeGreaterThan(10);
  await empty.click();
  await expect(empty.locator(".swl-grid-editor")).toBeVisible();
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  await fillField(page, "Written");
  await page.keyboard.press("Escape");
  await expect.poll(() => space.saved("Page")).toContain("<column>\n\nWritten\n\n</column>");
});

test("a grid aligned right from its handle's menu: written as its attribute, at the text's right edge; dragged, it grows to the left; centred again as the default", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nAbove\n\n${GRID.replace("<grid>", '<grid width="400">')}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const content = page.locator("#sb-main .cm-content");
  const textRight = await content.evaluate((one) => one.getBoundingClientRect().right - parseFloat(getComputedStyle(one).paddingRight));
  const rightEdge = async () => {
    const box = (await grid.boundingBox())!;
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
  const handle = (await bar.boundingBox())!;
  expect(handle.x + handle.width).toBeLessThanOrEqual((await grid.boundingBox())!.x);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  // (Wider than the text too: still to the left alone, its right edge kept, the guides placed from it with it)
  await page.mouse.move(handle.x + handle.width / 2 - 600, handle.y + handle.height / 2, { steps: 12 });
  expect((await grid.boundingBox())!.width).toBeGreaterThan(textRight - (await content.boundingBox())!.x);
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

test("the Page layout dialog's Alignment tab: every grid at the right where it says nothing itself, saved in CONFIG; its own from its menu wins", async ({ page, space }) => {
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
    const box = (await grid.boundingBox())!;
    return [Math.round(box.x), Math.round(box.x + box.width)];
  };
  await runCommand(page, PAGE_LAYOUT);
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

test("the divider between two columns dragged: their shares change as it moves, snapping to 2 : 1, written; a double click makes them even again", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const cells = page.locator("#sb-main .swl-grid-cell");
  const widths = async () => [(await cells.nth(0).boundingBox())!.width, (await cells.nth(1).boundingBox())!.width];
  const [a, b] = await widths();
  await page.locator("#sb-main .swl-grid").hover();
  const divider = page.locator("#sb-main .swl-grid-divider");
  await expect(divider).toHaveCount(1);
  const box = (await divider.boundingBox())!;
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
  // Even again: the attribute taken off (two cells are two even columns anyway)
  await divider.dblclick();
  await expect.poll(() => space.saved("Page")).toContain("<grid>\n");
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
  const box = (await divider.boundingBox())!;
  const y = box.y + Math.min(box.height / 2, 20);
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  // The first column's right edge to the text's right edge (the divider half the gap beyond it), a few px short
  const gap = await page.locator("#sb-main .swl-grid").evaluate((grid) => parseFloat(getComputedStyle(grid).columnGap));
  await page.mouse.move(textRight + gap / 2 - 4, y, { steps: 10 });
  await expect(page.locator(".swl-grid-divider-label")).toHaveText("Page width");
  await expect(page.locator("#sb-main .swl-grid-guide.swl-grid-guide-near")).toHaveText("Page width");
  const right = (await page.locator("#sb-main .swl-grid-cell").first().boundingBox())!;
  expect(Math.round(right.x + right.width)).toBe(Math.round(textRight));
  // The guide where the divider is, snapped (its line on the divider's, not on the column's edge beside it)
  const middle = async (selector: string) => {
    const one = (await page.locator(selector).boundingBox())!;
    return Math.round(one.x + one.width / 2);
  };
  expect(Math.abs((await middle("#sb-main .swl-grid-guide.swl-grid-guide-near")) - (await middle("#sb-main .swl-grid-divider")))).toBeLessThanOrEqual(1);
  await page.mouse.up();
  await expect.poll(() => space.saved("Page")).toMatch(/<grid width="1100" columns="[^"]+">/);
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
  const [a, b] = [(await shown.locator(".swl-grid-cell").nth(0).boundingBox())!.width, (await shown.locator(".swl-grid-cell").nth(1).boundingBox())!.width];
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

test("Put into grid: the tasks selected split into 2 columns, a list in each, by the command's two picks", async ({ page, space }) => {
  const tasks = "- [ ] one\n- [ ] two\n- [x] three\n- [ ] four\n- [ ] five";
  await space.open({ Page: `# Page\n\n${tasks}\n\nAfter\n` }, "Page");
  await page.evaluate((list) => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } } }).client.editorView;
    const text = view.state.doc.toString();
    view.dispatch({ selection: { anchor: text.indexOf(list), head: text.indexOf(list) + list.length } });
  }, tasks);
  // (Not awaited: the command waits for the picks)
  void runCommand(page, "Silverware Layout: Put into grid");
  const box = page.locator(".sb-modal-box, .sb-modal").first();
  await expect(box).toContainText("Put 5 blocks into a grid");
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
    .toBe("# Page\n\n<grid>\n<column>\n\n- [ ] one\n- [ ] two\n- [x] three\n\n</column>\n<column>\n\n- [ ] four\n- [ ] five\n\n</column>\n</grid>\n\nAfter\n");
});

test("Put into grid takes a paragraph's lines as blocks each, as the editor shows them apart", async ({ page, space }) => {
  const lines = "First line\nSecond line\nThird line";
  await space.open({ Page: `# Page\n\n${lines}\n\nAfter\n` }, "Page");
  await page.evaluate((text) => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } } }).client.editorView;
    const all = view.state.doc.toString();
    view.dispatch({ selection: { anchor: all.indexOf(text), head: all.indexOf(text) + text.length } });
  }, lines);
  void runCommand(page, "Silverware Layout: Put into grid");
  const box = page.locator(".sb-modal-box, .sb-modal").first();
  await expect(box).toContainText("Put 3 blocks into a grid");
  await page.keyboard.press("Escape");
});

test("a cell's menu: the cell moved right, then the grid removed, its content kept in its order", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const pick = async (cell: number, label: string) => {
    const target = page.locator("#sb-main .swl-grid-cell").nth(cell);
    await target.hover();
    await target.locator(".swl-grid-cell-more").click();
    await page.locator(".swl-popup .swl-menu-item", { hasText: label }).click();
  };
  await pick(0, "Move right");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${GRID.replace("Left text", "@@").replace("Right text", "Left text").replace("@@", "Right text")}\nAfter\n`);
  await gridsDrawn(page);
  await expect(page.locator("#sb-main .swl-grid-cell").first()).toContainText("Right text");
  await pick(0, "Remove the grid");
  // (Two cells of a line of text each: a line break between, as a paragraph's lines put into cells come back)
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\nRight text\nLeft text\n\nAfter\n");
});

test("a grid's borders from its menu: written as its attribute, the first column's line where its divider is", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const grid = page.locator("#sb-main .swl-grid");
  const cell = page.locator("#sb-main .swl-grid-cell").first();
  await cell.hover();
  await cell.locator(".swl-grid-cell-more").click();
  await page.locator(".swl-popup .swl-menu-item", { hasText: "Borders" }).click();
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
  await cell.hover();
  await cell.locator(".swl-grid-cell-more").click();
  await page.locator(".swl-popup .swl-menu-item", { hasText: "Borders" }).click();
  await expect(grid).not.toHaveAttribute("data-swl-border");
  await expect.poll(() => space.saved("Page")).toContain("<grid>\n");
});

test("SilverBullet's button bar of a grid's frame stays hidden as the pointer is over the grid", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}` }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().hover();
  await expect(page.locator("#sb-main .swl-grid-widget :is(.button-bar, .sb-widget-menu-bar)")).toBeHidden();
});

test("a click on a word of a cell edits it with the cursor in that word", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}` }, "Page");
  await gridsDrawn(page);
  const words = page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right text");
  const box = (await words.boundingBox())!;
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
  const box = (await words.boundingBox())!;
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
  await space.open({ Page: `# Page\n\n<grid>\n<column>\n\n${cell}\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n` }, "Page");
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
    // (SilverBullet may draw the page anew as another test's CONFIG is put back: the grid drawn again first)
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
  // (SilverBullet may draw the page anew as another test's CONFIG is put back: the grid drawn again first)
  await gridsDrawn(page);
  const words = page.locator("#sb-main .swl-grid-cell").nth(1).getByText("Right text");
  const box = (await words.boundingBox())!;
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
  const text = `# Page\n\n<grid>\n<column>\n\n- one\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n`;
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
  await expect.poll(() => space.saved("Page")).toContain("<column>\n\n- one\n- two\n\n</column>");
});

test("with Silverware Editor installed, a cell's markdown is shown as SilverBullet shows it: marks hidden away from the caret, a task's box toggling it", async ({ page, space }) => {
  const text = `# Page\n\n<grid>\n<column>\n\nSome **bold** and [[Other|a link]]\n- [ ] open\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n`;
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
  await expect.poll(() => space.saved("Page")).toContain("<column>\n\nSome **bold** and [[Other|a link]]\n- [x] open\n\n</column>");
});

test("with Silverware Editor installed, a table in a cell is drawn as one while edited, its markdown shown once a cell of it is pressed", async ({ page, space }) => {
  const text = `# Page\n\n<grid>\n<column>\n\nAbove\n\n| Name | Count |\n|---|--:|\n| **one** | 2 |\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n`;
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
  await expect.poll(() => space.saved("Page")).toContain(`<column>\n\n${cell}\n\n</column>`);
});

test("a task toggled in a cell of a grid of a width of its own: the grid drawn anew at that width from its first frame, no narrower one between", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n<grid width="900">\n<column>\n\n- [ ] one\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n\nAfter\n` }, "Page");
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
  const text = (state: string) => `# Page\n\n- [ ] outside\n\n<grid>\n<column>\n\nThis is my note!\n- [${state}] inside\n\n</column>\n<column>\n\nRight\n\n</column>\n</grid>\n`;
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
