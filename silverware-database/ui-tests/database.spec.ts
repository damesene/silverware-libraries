import { editorText, expect, item, root, runCommand, test, waitForIndex } from "./helpers.ts";

// (The test's own view named: the built-in ones come first in the switcher)
const BLOCK = "```silverware-database\nid: tasks\nview: names\n```\n";
const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };

test("a block draws its database: the views on to switch, the one shown its items", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-switch")).toHaveCount(5);
  expect(await page.locator(".swd-switch").evaluateAll((all) => all.map((one) => (one as HTMLElement).dataset.view))).toEqual(["table", "list", "board", "names", "count"]);
  await expect(page.locator('.swd-switch[aria-pressed="true"]')).toHaveAttribute("data-view", "names");
  await expect(page.locator(".test-item")).toHaveText(["Fix login", "Write docs"]);
});

test("a view picked is written into the block it was picked in, the place drawn anew from it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await page.locator('.swd-switch[data-view="count"]').click();
  await expect(page.locator(".test-count")).toHaveText("2 of 2");
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\n```silverware-database\nid: tasks\nview: count\n```\n");
});

test("actions one after another are each written into the block, SilverBullet's controls of it hidden", async ({ page, space }) => {
  await space.open({ Page: `# Page

${BLOCK}`, ...TASKS }, "Page");
  await page.locator('.swd-switch[data-view="count"]').click();
  await expect.poll(() => space.saved("Page")).toContain("view: count");
  await page.locator('.swd-switch[data-view="names"]').click();
  await expect.poll(() => space.saved("Page")).toContain("view: names");
  await page.locator('.swd-switch[data-view="list"]').click();
  await expect.poll(() => space.saved("Page")).toContain("view: list");
  await expect(page.locator(".swd-place")).toHaveCount(1);
  for (const control of await page.locator(".swd-widget .button-bar button, .swd-widget .sb-widget-menu-bar button, .sb-code-copy-button").all()) await expect(control).toBeHidden();
});

test("a press beside the block, on its lines, does not show its markdown", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}\nAfter\n`, ...TASKS }, "Page");
  await expect(page.locator(".test-item")).toHaveCount(2);
  const widget = (await page.locator(".swd-widget").boundingBox())!;
  const place = (await page.locator(".swd-place").boundingBox())!;
  const closing = (await page.locator(".cm-line.sb-fenced-code-hide").first().boundingBox())!;
  const content = (await page.locator(".cm-content").boundingBox())!;
  // In the widget's margin above the place, on the closing fence hidden under it, and left and right of the block in the
  // editor, on none of its lines (the content's padding, the room beside it), which CodeMirror puts on the block's line
  const middle = widget.y + widget.height / 2;
  for (const [where, x, y] of [
    ["the widget's margin", widget.x + 40, (widget.y + place.y) / 2],
    ["the closing fence", closing.x + 40, closing.y + closing.height / 2],
    ["the content's padding, left", Math.max(content.x + 2, widget.x - 8), middle],
    ["the content's padding, right", Math.min(content.x + content.width - 2, widget.x + widget.width + 8), middle],
    ["right of the content", content.x + content.width + 20, middle],
  ] as const) {
    await test.step(where, async () => {
      await page.mouse.click(x, y);
      await expect(page.locator(".swd-place")).toBeVisible();
      await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(0);
    });
  }
});

test("a press in the block on what takes no focus, after a field or a menu of it had it, does not show its markdown", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\nAfter\n", ...TASKS }, "Page");
  const fence = page.locator(".cm-line", { hasText: "```silverware-database" });
  await expect(page.locator(".swd-place table")).toBeVisible();
  const head = (await page.locator(".swd-place-head").boundingBox())!;
  // ⋯ opened, then a press beside its menu, in the block's head
  await page.locator(".swd-more").click();
  await page.mouse.click(head.x + head.width - 40, head.y + head.height / 2);
  await expect(page.locator(".swd-place")).toBeVisible();
  await expect(fence).toHaveCount(0);
  // A cell edited, then a press on the table's header
  await page.locator('td[data-key="status"]').first().click();
  await expect(page.locator(".swd-place td :is(input, select)")).toHaveCount(1);
  const header = (await page.locator(".swd-place thead th").last().boundingBox())!;
  await page.mouse.click(header.x + header.width - 5, header.y + header.height / 2);
  await expect(page.locator(".swd-place")).toBeVisible();
  await expect(fence).toHaveCount(0);
});

test("Edit source in ⋯ shows the block's markdown, the cursor in its text", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}\nAfter\n`, ...TASKS }, "Page");
  await expect(page.locator(".test-item")).toHaveCount(2);
  await page.locator(".swd-more").click();
  await page.locator(".swd-edit-source").click();
  await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(1);
  await expect(page.locator(".cm-line", { hasText: "id: tasks" })).toBeVisible();
});

test("in SilverBullet's dark look the browser's own controls of a database are drawn dark (a date's calendar icon)", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-widget")).toBeVisible();
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  expect(await page.locator(".swd-widget").evaluate((one) => getComputedStyle(one).colorScheme)).toBe("dark");
});

test("Group by in ⋯ picks the board's select, written into the block", async ({ page, space }) => {
  const root = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    area: { type: select, label: Area, options: [Web, App] }\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: board\n```\n", ...TASKS, "Page/db-tasks": root }, "Page");
  await expect(page.locator(".swd-board-column")).toHaveCount(2);
  await page.locator(".swd-more").click();
  await page.locator('.swd-group-option[data-key="area"]').click();
  await expect.poll(() => space.saved("Page")).toContain("board.groupBy: area");
  await expect(page.locator(".swd-board-column").first()).toHaveAttribute("aria-label", /^No Area/);
});

test("a table grouped under Group by is a table per group, an item added in one with its value, a group folded kept in the block", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await page.locator('.swd-group-option[data-key="status"]').click();
  await expect.poll(() => space.saved("Page")).toContain("table.groupBy: status");
  const groups = page.locator(".swd-group");
  await expect(groups).toHaveCount(2);
  await expect(groups.locator(".swd-group-label")).toHaveText(["Todo", "Done"]);
  await expect(groups.nth(1).locator("tbody tr")).toHaveCount(1);
  await groups.nth(1).locator(".swd-table-add").click();
  await expect.poll(() => space.saved("Page/db-tasks/Untitled")).toContain("status: Done");
  await expect(groups.nth(1).locator("tbody tr")).toHaveCount(2);
  await groups.nth(0).locator(".swd-group-head").click();
  await expect.poll(() => space.saved("Page")).toContain("table.folded:");
  await expect(groups.nth(0).locator("table")).toHaveCount(0);
});

test("long text wraps: a table's cell at most its maximum width, a board's columns each as wide as the others", async ({ page, space }) => {
  const long = "a long note that goes on ".repeat(12) + "Pneumonoultramicroscopicsilicovolcanoconiosis".repeat(3);
  const root = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    notes: { type: text, label: Notes }\n---\n";
  const longItem = `---\ntags: [db]\nstatus: Todo\nnotes: ${long}\n_database:\n  rank: a2\n---\n`;
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS, "Page/db-tasks": root, "Page/db-tasks/Long one": longItem }, "Page");
  const cell = page.locator('td[data-key="notes"]').filter({ hasText: "a long note" });
  await expect(cell).toBeVisible();
  // (Its content at most 24em, its padding beside it)
  const maximum = await cell.evaluate((td) => 24 * parseFloat(getComputedStyle(td).fontSize) + parseFloat(getComputedStyle(td).paddingLeft) + parseFloat(getComputedStyle(td).paddingRight) + 1);
  expect((await cell.boundingBox())!.width).toBeLessThanOrEqual(maximum);
  // Wrapped: several lines tall
  expect((await cell.boundingBox())!.height).toBeGreaterThan(3 * (await cell.evaluate((td) => parseFloat(getComputedStyle(td).lineHeight) || 20)));
  await page.locator('.swd-switch[data-view="board"]').click();
  await expect(page.locator(".swd-board-column")).toHaveCount(2);
  const widths = await page.locator(".swd-board-column").evaluateAll((all) => all.map((one) => Math.round(one.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBe(1);
});

test("an item's long name wraps on a card and in a list, never out of it", async ({ page, space }) => {
  const long = "Added 1794061029592asdasasdasdas asd as das dadas asd asdasdasdadasdasdasdasdasdasdasd";
  const pages = { ...TASKS, ["Page/db-tasks/" + long]: "---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a2\n---\n" };
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: board\n```\n", ...pages }, "Page");
  const card = page.locator(".swd-board-card").filter({ hasText: "1794061029592" });
  await expect(card).toBeVisible();
  const inside = async (inner: import("@playwright/test").Locator, outer: import("@playwright/test").Locator) => {
    const [a, b] = [(await inner.boundingBox())!, (await outer.boundingBox())!];
    return a.x >= b.x - 1 && a.x + a.width <= b.x + b.width + 1;
  };
  expect(await inside(card.locator(".swd-board-name"), card)).toBe(true);
  await page.locator('.swd-switch[data-view="list"]').click();
  const line = page.locator(".swd-list-item").filter({ hasText: "1794061029592" });
  await expect(line).toBeVisible();
  expect(await inside(line.locator(".swd-list-name"), line)).toBe(true);
  // Beside its grip, on its line: not pushed under it
  const [grip, title] = [(await line.locator(".swd-row-grip").boundingBox())!, (await line.locator(".swd-list-name").boundingBox())!];
  expect(title.y).toBeLessThan(grip.y + grip.height);
});

test("an item added is written as a page of the database and shown at once, and still once the index has it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await page.locator(".test-add").click();
  await expect(page.locator(".test-item")).toHaveCount(3);
  // (SilverBullet tells of the page indexed before a query has it: the item stays shown through that, and once the index has it)
  const added = (await page.locator(".test-item").last().textContent())!;
  await waitForIndex(page, "db", `${space.folder}/Page/db-tasks/${added}`);
  await expect(page.locator(".test-item")).toHaveCount(3);
  expect(await space.saved(`Page/db-tasks/${added}`)).toBe("---\ntags: [db]\n_database:\n  rank: a2\n---\n");
});

test("the command New database makes its root page beside the page open and its block at the cursor", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\ntext\n" }, "Page");
  // (The page's text loaded first: loading it puts the cursor at its start)
  await expect.poll(() => editorText(page)).toBe("# Page\n\ntext\n");
  await page.evaluate(() => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { length: number } }; dispatch(spec: unknown): void } } }).client.editorView;
    view.dispatch({ selection: { anchor: view.state.doc.length } });
  });
  await runCommand(page, "Silverware Database: New database");
  const field = page.locator(".sb-modal-box input").first();
  await field.fill("Ideas");
  await field.press("Enter");
  await expect(page.locator(".swd-place")).toHaveCount(1);
  await expect.poll(() => space.saved("Page/db-ideas")).toContain("  id: ideas\n  name: Ideas\n");
  expect(await editorText(page)).toBe("# Page\n\ntext\n\n```silverware-database\nid: ideas\n```\n");
  // A new database shows its first view, the table
  await expect(page.locator('.swd-switch[aria-pressed="true"]')).toHaveAttribute("data-view", "table");
});

test("a block in a list item is not written, said why, the page as it was", async ({ page, space }) => {
  const listed = "# Page\n\n- item\n  ```silverware-database\n  id: tasks\n  view: names\n  ```\n- next\n";
  await space.open({ Page: listed, ...TASKS }, "Page");
  await page.locator('.swd-switch[data-view="count"]').click();
  await expect(page.locator(".sb-notifications")).toContainText("indented");
  expect(await space.saved("Page")).toBe(listed);
});

test("of two blocks written alike, the one a view is picked in is written", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}\ntext between\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-place")).toHaveCount(2);
  await page.locator(".swd-place").nth(1).locator('.swd-switch[data-view="count"]').click();
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${BLOCK}\ntext between\n\n\`\`\`silverware-database\nid: tasks\nview: count\n\`\`\`\n`);
});

test("the settings turn a view off: saved in CONFIG, the switcher without it at once", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-switch")).toHaveCount(5);
  await runCommand(page, "Silverware Database: Settings");
  await page.locator('.swd-settings [data-swd-view="count"]').click();
  await page.locator(".swd-settings-save").click();
  await expect(page.locator(".swd-settings")).toHaveCount(0);
  // (In a block of its own: the Configuration Manager writes its block anew from what its schema shows)
  await expect.poll(() => space.config()).toContain('-- managed-by: silverware-database');
  expect(await space.config()).toContain('config.set("silverware.database.views.count.enabled", false)');
  await expect(page.locator(".swd-switch")).toHaveCount(4);
});

test("the table edits a value in place, written into the item's page", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\n```\n", ...TASKS }, "Page");
  const cell = page.locator('.swd-table tbody tr:first-child [data-key="status"]');
  await cell.click();
  await cell.locator("select").selectOption("Done");
  await expect(cell).toHaveText("Done");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toBe("---\ntags: [db]\nstatus: Done\n_database:\n  rank: a0\n---\n");
});

test("the board moves a card to another column, its value written", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: board\n```\n", ...TASKS }, "Page");
  // (Todo and Done: no column of none, every item has a value)
  await expect(page.locator(".swd-board-column")).toHaveCount(2);
  // Dragged by the mouse below the Done column's last card
  const card = (await page.locator('.swd-board-column[data-value="Todo"] .swd-board-card').boundingBox())!;
  const last = (await page.locator('.swd-board-column[data-value="Done"] .swd-board-card').last().boundingBox())!;
  await page.mouse.move(card.x + 20, card.y + 10);
  await page.mouse.down();
  await page.mouse.move(last.x + 20, last.y + last.height - 2, { steps: 10 });
  await page.mouse.move(last.x + 22, last.y + last.height - 1, { steps: 2 });
  await page.mouse.up();
  await expect(page.locator('.swd-board-column[data-value="Done"] .swd-board-name')).toHaveText(["Write docs", "Fix login"]);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Done\n");
});

test("the Properties dialog adds a property and changes a type, the change of items shown before it is written", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await page.locator(".swd-properties-button").click();
  await page.locator(".swd-property-new-label").fill("Estimate");
  await page.locator(".swd-property-new-type").selectOption("number");
  await page.locator(".swd-property-add").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("    estimate: { type: number, label: Estimate }\n");
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('[data-property="status"] .swd-property-type').selectOption("text");
  await expect(page.locator(".swd-property-review")).toContainText("Change the type of Status: no item's value changes");
  // Nothing written until applied
  expect(await space.saved("Page/db-tasks")).toContain("status: { type: select");
  await page.locator(".swd-property-apply").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("status: { type: text");
});

test("the peek is 600px wide by default, its left edge dragged setting its width in CONFIG, for every database", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  const peek = page.locator(".swd-peek");
  await expect(peek).toBeVisible();
  const before = (await peek.boundingBox())!;
  // (600px, or most of the editor's area where it has less room)
  const area = (await page.locator("#sb-editor").boundingBox())!;
  expect(Math.round(before.width)).toBe(Math.round(Math.min(600, area.width * 0.8)));
  const edge = { x: before.x + 2, y: before.y + 200 };
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await page.mouse.move(edge.x + 80, edge.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await peek.boundingBox())!.width)).toBe(Math.round(before.width) - 80);
  await expect.poll(() => space.config()).toContain(`"silverware.database.modules.peek.width"`);
  // Still open, the item still shown
  await expect(page.locator(".swd-peek-name")).toHaveValue("Fix login");
});

test("the peek's text looks as the page's in the editor, though it hangs outside it", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  await expect(page.locator(".swd-peek")).toBeVisible();
  const look = (selector: string) => page.locator(selector).first().evaluate((one) => ["fontFamily", "fontSize", "lineHeight"].map((key) => getComputedStyle(one)[key as "fontFamily"]));
  expect(await look(".swd-peek")).toEqual(await look(".cm-content"));
  // Its body's field too
  expect((await look(".swd-peek-body"))[0]).toBe((await look(".cm-content"))[0]);
});

test("the peek shows an item beside the page, its content written as it is left, no key reaching the page", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  await expect(page.locator(".swd-peek")).toBeVisible();
  await expect(page.locator(".swd-peek-name")).toHaveValue("Fix login");
  const body = page.locator(".swd-peek-body");
  await expect(body).toBeEditable();
  await body.fill("Steps to fix\n");
  await body.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-peek")).toHaveCount(0);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("Steps to fix\n");
  expect(await space.saved("Page")).toBe("# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n");
});

test("a type of the user's shows and reads its values, one that fails shows them as kept, a view's definition given HELPERS", async ({ page, space }) => {
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: rated\n  name: Rated\n  version: 1\n  properties:\n    rating: { type: stars, label: Rating }\n    odd: { type: broken, label: Odd }\n---\n";
  const one = "---\ntags: [db]\nrating: 3\nodd: kept\n_database:\n  rank: a0\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: rated\nview: table\n```\n", "Page/db-rated": rootPage, "Page/db-rated/One": one }, "Page");
  const rating = page.locator('tbody tr:first-child [data-key="rating"]');
  await expect(rating).toHaveText("★★★");
  await expect(page.locator('tbody tr:first-child [data-key="odd"]')).toHaveText("kept");
  await rating.click();
  const field = rating.locator("input");
  await field.fill("5");
  await field.press("Enter");
  await expect.poll(() => space.saved("Page/db-rated/One")).toContain("rating: 5\n");
  await expect(page.locator('tbody tr:first-child [data-key="rating"]')).toHaveText("★★★★★");
  await page.locator('.swd-switch[data-view="count"]').click();
  await expect(page.locator(".test-count")).toHaveAttribute("title", "helpers: function");
});

test("a cell of the table edited keeps its row and its columns where they were", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  const table = page.locator(".swd-table");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const layout = () =>
    table.evaluate((one) => ({
      row: Math.round(one.querySelector("tbody tr")!.getBoundingClientRect().height),
      columns: [...one.querySelectorAll("thead th")].map((th) => Math.round(th.getBoundingClientRect().width)),
    }));
  // Wide, and narrow as a phone (the table scrolled sideways sizes its columns by their content)
  for (const width of [1200, 420]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await layout();
    for (const key of ["name", "status"]) {
      await table.locator(`tbody tr:first-child td[data-key="${key}"]`).click();
      await expect(table.locator(`tbody tr:first-child td[data-key="${key}"] .swd-editor`)).toBeVisible();
      expect(await layout()).toEqual(before);
      await page.keyboard.press("Escape");
    }
  }
});

test("an option given a color in Properties keeps it in the root page and shows in it", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await page.locator(".swd-properties-button").click();
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('.swd-option-color[aria-label="Color of Done"]').click();
  await page.locator('.swd-option-swatch[data-color-name="red"]').click();
  await expect.poll(() => space.saved("Page/db-tasks")).toMatch(/colors:[\s\S]*Done: red/);
  // And one of your own, written in quotes (a # starts a comment in YAML)
  await page.locator('.swd-option-color[aria-label="Color of Todo"]').click();
  await page.locator(".swd-option-own-input").evaluate((input: HTMLInputElement) => {
    input.value = "#3a7bd5";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect.poll(() => space.saved("Page/db-tasks")).toContain('Todo: "#3a7bd5"');
  await page.keyboard.press("Escape");
  await expect(page.locator('td[data-key="status"] .swd-pill', { hasText: "Done" })).toHaveAttribute("data-color", "5");
  await expect(page.locator('td[data-key="status"] .swd-pill', { hasText: "Todo" })).toHaveAttribute("data-color", "own");
});

test("a table scrolled sideways stays where it was as a value changes, and as it is sorted (its block written, drawn anew)", async ({ page, space }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const wide = "---\ntags: [db-root]\n_database:\n  id: wide\n  name: Wide\n  version: 1\n  properties:\n" + ["a", "b", "c", "d", "e", "f"].map((key) => `    ${key}: { type: text, label: Column ${key} }\n`).join("") + "    done: { type: checkbox, label: Done }\n---\n";
  const row = (name: string, rank: string) => `---\ntags: [db]\na: some text\nb: some text\nc: some text\n_database:\n  rank: ${rank}\n---\n`;
  await space.open({ Page: "# Page\n\n```silverware-database\nid: wide\nview: table\n```\n", "Page/db-wide": wide, "Page/db-wide/One": row("One", "a0"), "Page/db-wide/Two": row("Two", "a1") }, "Page");
  const box = page.locator(".swd-table-box");
  await expect(page.locator(".swd-table tbody tr")).toHaveCount(2);
  await box.evaluate((one) => (one.scrollLeft = one.scrollWidth));
  const left = await box.evaluate((one) => one.scrollLeft);
  expect(left).toBeGreaterThan(100);
  await page.locator('tbody tr:first-child td[data-key="done"] input').click();
  await expect.poll(() => space.saved("Page/db-wide/One")).toContain("done: true");
  await expect.poll(() => page.locator(".swd-table-box").evaluate((one) => one.scrollLeft)).toBe(left);
  await page.locator(".swd-sort-button").click();
  await page.locator('.swd-sort-option[data-key="name"]').click();
  await expect.poll(() => space.saved("Page")).toContain("sort");
  await expect.poll(() => page.locator(".swd-table-box").evaluate((one) => one.scrollLeft)).toBe(left);
});

test("a board scrolled sideways stays where it was as a card is added", async ({ page, space }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const states = ["Todo", "Doing", "Review", "Done", "Later"];
  const root = "---\ntags: [db-root]\n_database:\n  id: board\n  name: Board\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [" + states.join(", ") + "] }\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: board\nview: board\n```\n", "Page/db-board": root, "Page/db-board/One": "---\ntags: [db]\nstatus: Later\n_database:\n  rank: a0\n---\n" }, "Page");
  const board = page.locator(".swd-board");
  await expect(page.locator(".swd-board-card")).toHaveCount(1);
  await board.evaluate((one) => one.scrollTo({ left: one.scrollWidth }));
  const left = await board.evaluate((one) => one.scrollLeft);
  expect(left).toBeGreaterThan(100);
  // (A click as the page's own: Playwright's would scroll the board to show the button first)
  await page.locator('.swd-board-column[data-value="Later"] .swd-board-add').dispatchEvent("click");
  await expect(page.locator(".swd-board-card")).toHaveCount(2);
  await expect.poll(() => page.locator(".swd-board").evaluate((one) => one.scrollLeft)).toBe(left);
});

test("a property hidden in Properties is kept in the root page, shown by no view, and still offered by the filter", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await expect(page.locator(".swd-table th")).toContainText(["Name", "Status"]);
  await page.locator(".swd-more").click();
  await page.locator(".swd-properties-button").click();
  await page.locator('[data-property="status"] .swd-prop-eye').click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("hidden: true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-table th", { hasText: "Status" })).toHaveCount(0);
  await page.locator(".swd-filter-button").click();
  await expect(page.locator('.swd-filter input[data-key="status"]')).toBeVisible();
  expect(await space.saved("Page/db-tasks/Fix login")).toContain("status: Todo");
});

test("a card dragged to the board's right edge scrolls it, and is dropped in a column that was out of sight", async ({ page, space }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  const states = ["Todo", "Doing", "Review", "Done", "Later"];
  const root = "---\ntags: [db-root]\n_database:\n  id: board\n  name: Board\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [" + states.join(", ") + "] }\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: board\nview: board\n```\n", "Page/db-board": root, "Page/db-board/One": "---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a0\n---\n" }, "Page");
  const board = page.locator(".swd-board");
  const card = (await page.locator(".swd-board-card").boundingBox())!;
  const box = (await board.boundingBox())!;
  await page.mouse.move(card.x + 20, card.y + 10);
  await page.mouse.down();
  // Held at the right edge until the board has scrolled to its end
  await page.mouse.move(box.x + box.width - 8, card.y + 30, { steps: 10 });
  await expect
    .poll(async () => {
      await page.mouse.move(box.x + box.width - 8 + (Math.random() > 0.5 ? 1 : 0), card.y + 30);
      return board.evaluate((one) => one.scrollWidth - one.clientWidth - one.scrollLeft);
    })
    .toBeLessThan(2);
  const later = (await page.locator('.swd-board-column[data-value="Later"]').boundingBox())!;
  await page.mouse.move(later.x + later.width / 2, later.y + 60, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => space.saved("Page/db-board/One")).toContain("status: Later");
});

test("a property made required in Properties is kept in the root page, marked *, and an item without a value shows it missing", async ({ page, space }) => {
  const none = "---\ntags: [db]\n_database:\n  rank: a2\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS, "Page/db-tasks/Plan": none }, "Page");
  await expect(page.locator(".swd-table tbody tr")).toHaveCount(3);
  await page.locator(".swd-more").click();
  await page.locator(".swd-properties-button").click();
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('[data-property="status"] .swd-property-required input').click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("required: true");
  await expect(page.locator('[data-property="status"] .swd-prop-required')).toHaveText("*");
  await page.keyboard.press("Escape");
  await expect(page.locator('tbody tr:nth-child(3) td[data-key="status"]')).toHaveClass(/swd-missing/);
  await expect(page.locator('tbody tr:first-child td[data-key="status"]')).not.toHaveClass(/swd-missing/);
});

test("a table's row dragged by its grip to the top is written there, by its rank alone", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await expect(page.locator(".swd-table tbody tr")).toHaveCount(2);
  const last = page.locator(".swd-table tbody tr").last();
  await last.hover();
  const grip = (await last.locator(".swd-row-grip").boundingBox())!;
  const first = (await page.locator(".swd-table tbody tr").first().boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 4, first.y + 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".swd-table-name")).toHaveText(["Write docs", "Fix login"]);
  await expect.poll(() => space.saved("Page/db-tasks/Write docs")).not.toContain("rank: a1");
  expect(await space.saved("Page/db-tasks/Write docs")).toContain("status: Done");
});

test("options renamed in Properties rename the items' values in the same write: two swapping names swap them", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await page.locator(".swd-properties-button").click();
  await page.locator('[data-property="status"] .swd-prop-head').click();
  const names = page.locator('[data-property="status"] .swd-option-name');
  await names.nth(0).fill("Done");
  await names.nth(1).fill("Todo");
  await page.locator(".swd-property-options-save").click();
  await expect(page.locator(".swd-property-review")).toContainText("1 item: Todo → Done");
  await expect(page.locator(".swd-property-review")).toContainText("1 item: Done → Todo");
  await expect(page.locator(".swd-property-review")).toContainText("Writes 3 pages.");
  // Nothing written until applied
  expect(await space.saved("Page/db-tasks/Fix login")).toContain("status: Todo\n");
  await page.locator(".swd-property-apply").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("options: [Done, Todo]");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Done\n");
  await expect.poll(() => space.saved("Page/db-tasks/Write docs")).toContain("status: Todo\n");
  // (The dialog stays open while the change is written: closed once its review has gone)
  await expect(page.locator(".swd-property-review")).toHaveCount(0);
  await page.locator(".swd-settings-close").click();
  await expect(page.locator(".swd-properties")).toHaveCount(0);
  await expect(page.locator('td[data-key="status"] .swd-pill')).toHaveText(["Done", "Todo"]);
  // Undo puts the options and every value back in one step
  await page.locator(".swd-undo").click();
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Todo\n");
  await expect.poll(() => space.saved("Page/db-tasks/Write docs")).toContain("status: Done\n");
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("options: [Todo, Done]");
  await expect(page.locator(".swd-undo")).toHaveAttribute("aria-busy", "false");
});
