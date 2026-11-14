// Columns (docs/silverware-layout-grid.md) as a user works with them in SilverBullet: /grid, a cell edited in place,
// Alt+click to the raw text, columns set by the grid's line, a grid in an embedded page, its hashtags indexed.
import { cursorAt, editorText, expect, gridsDrawn, runCommand, test } from "./helpers.ts";

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
  const field = cell.locator("textarea.swl-grid-editor");
  await expect(field).toHaveValue("Left text");
  await field.fill("Left **edited**");
  await page.keyboard.press("Escape");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${GRID.replace("Left text", "Left **edited**")}\nBelow\n`);
  await expect(page.locator("#sb-main .swl-grid-cell").first().locator("strong")).toHaveText("edited");
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

test("a grid widened by its handle grows both ways, centred on the text", async ({ page, space }) => {
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
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 8 });
  // While dragged: its right edge with the pointer, its left edge as far the other way
  await expect.poll(edges).toEqual([left! - 100, right! + 100]);
  await page.mouse.up();
  await expect.poll(() => space.saved("Page")).toMatch(/<grid width="\d+">/);
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
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\nRight text\n\nLeft text\n\nAfter\n");
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
  const field = page.locator("#sb-main textarea.swl-grid-editor");
  await expect(field).toBeFocused();
  const at = await field.evaluate((input: HTMLTextAreaElement) => input.selectionStart);
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
  const field = page.locator("#sb-main textarea.swl-grid-editor");
  await expect(field).toBeFocused();
  const [from, to] = await field.evaluate((input: HTMLTextAreaElement) => [input.selectionStart, input.selectionEnd]);
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
  const field = page.locator("#sb-main textarea.swl-grid-editor");
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
    await expect(field).toBeFocused();
    expect(await field.evaluate((input: HTMLTextAreaElement) => [input.selectionStart, input.selectionEnd]), text.slice(from, to)).toEqual([start + from, start + to]);
    await page.keyboard.press("Escape");
    await expect(field).toHaveCount(0);
  }
});

test("a cell left by Esc, then a drag in a cell: the grid stays drawn, the field opens", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}` }, "Page");
  await gridsDrawn(page);
  const field = page.locator("#sb-main textarea.swl-grid-editor");
  await page.locator("#sb-main .swl-grid-cell").first().click();
  await expect(field).toBeFocused();
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
  await expect(field).toBeFocused();
  await expect(page.locator("#sb-main .swl-grid")).toHaveCount(1);
  await page.keyboard.press("Escape");
});

test("Ctrl+Z and Ctrl+Y in a cell's field undo and redo its typing, the page's text left alone", async ({ page, space }) => {
  const text = `# Page\n\n${GRID}`;
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().click();
  const field = page.locator("#sb-main textarea.swl-grid-editor");
  await expect(field).toBeFocused();
  await field.press("End");
  await page.keyboard.type(" typed");
  await expect(field).toHaveValue("Left text typed");
  await page.keyboard.press("Control+z");
  await expect(field).toHaveValue("Left text");
  await page.keyboard.press("Control+y");
  await expect(field).toHaveValue("Left text typed");
  await page.keyboard.press("Control+z");
  await expect(field).toHaveValue("Left text");
  expect(await editorText(page)).toBe(text);
  await page.keyboard.press("Escape");
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
  await expect(page.locator("#sb-main textarea.swl-grid-editor")).toHaveCount(0);
  await gridsDrawn(page);
  await page.locator('#sb-main .swl-grid-cell .sb-task input[type="checkbox"]').first().click();
  await expect.poll(() => space.saved("Page")).toBe(text(" "));
});
