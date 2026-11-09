import { editorText, expect, item, root, runCommand, test, waitForIndex } from "./helpers.ts";

// (The test's own view named: the built-in ones come first in the switcher)
const BLOCK = "```silverware-database\nid: tasks\nview: names\n```\n";
const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };

/** A view picked in a place (the first, else the one given): its picker's menu opened, the view's item pressed */
async function pickView(page: import("@playwright/test").Page, label: string, place = page.locator(".swd-place").first()): Promise<void> {
  await place.locator(".swd-view-picker").click();
  await place.locator(".swd-menu .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: new RegExp(`^${label}$`) }) }).click();
}

/** An entry of a place's menu (⋯) chosen by its label (its value after it left out); the menu open first, or a submenu of it */
async function choose(page: import("@playwright/test").Page, label: string): Promise<void> {
  await page.locator(".swd-menu .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: new RegExp(`^${label}(:|$)`) }) }).first().click();
}

test("a block draws its database: the view shown in its picker, the views on in its menu, the one shown its items", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  const picker = page.locator(".swd-view-picker");
  await expect(picker).toHaveAttribute("data-view", "names");
  await expect(picker.locator(".swd-view-picker-label")).toHaveText("Names");
  await expect(page.locator(".test-item")).toHaveText(["Fix login", "Write docs"]);
  await picker.click();
  await expect(page.locator(".swd-menu .swd-menu-item .swd-label")).toHaveText(["Table", "List", "Board", "Calendar", "Timeline", "Names", "Count"]);
  await expect(page.locator('.swd-menu .swd-menu-item[aria-checked="true"] .swd-label')).toHaveText("Names");
  // Esc closes it, the view as it was
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-menu .swd-menu-item")).toHaveCount(0);
  await expect(picker).toBeFocused();
});

test("full screen: the place over the whole window, SilverBullet's top bar under it, the same icon or Esc putting it back", async ({ page, space }) => {
  await space.open({ Page: `# Page

${BLOCK}`, ...TASKS }, "Page");
  const place = page.locator(".swd-place");
  await page.locator('.swd-tool[data-tool="fullscreen"]').click();
  await expect(place).toHaveClass(/swd-over-window/);
  const box = (await place.boundingBox())!;
  const view = page.viewportSize()!;
  expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, view.width, view.height]);
  // (On top: the point at the window's top left corner, where SilverBullet's top bar is, is the place's)
  expect(await page.evaluate(() => !!document.elementFromPoint(5, 5)?.closest(".swd-place"))).toBe(true);
  await expect(page.locator(".test-item")).toHaveText(["Fix login", "Write docs"]);
  // Another view picked: written into the block, which SilverBullet draws anew: still over the window
  await pickView(page, "Count");
  await expect.poll(() => space.saved("Page")).toContain("view: count");
  await expect(page.locator(".swd-place")).toHaveClass(/swd-over-window/);
  await expect(page.locator(".swd-view-picker")).toHaveAttribute("data-view", "count");
  await page.locator('.swd-tool[data-tool="fullscreen"]').focus();
  await page.keyboard.press("Escape");
  await expect(place).not.toHaveClass(/swd-over-window/);
  await page.locator('.swd-tool[data-tool="fullscreen"]').click();
  await expect(place).toHaveClass(/swd-over-window/);
  await page.locator('.swd-tool[data-tool="fullscreen"]').click();
  await expect(place).not.toHaveClass(/swd-over-window/);
  // (The block's markdown not shown by any of it)
  await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(0);
});

test("the calendar: items on their days, one dragged to another day keeping its time, one added by a day's +, a phone's day list", async ({ page, space }) => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = (d: number) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(d)}`;
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    due: { type: datetime, label: Due }\n---\n";
  const item = (due: string, rank: string) => `---\ntags: [db]\nstatus: Todo\ndue: "${due}"\n_database:\n  rank: ${rank}\n---\n`;
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: calendar\n```\n", "Page/db-tasks": rootPage, "Page/db-tasks/Sync": item(`${day(5)}T10:00`, "a0"), "Page/db-tasks/Someday": "---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a1\n---\n" }, "Page");
  const cell = (d: number) => page.locator(`.swd-cal-day[data-day="${day(d)}"]`);
  const bar = (name: string) => page.locator(".swd-cal-week .swd-cal-item", { hasText: name });
  await expect(bar("Sync")).toHaveText("10:00 Sync");
  await expect(page.locator(".swd-cal-undated .swd-cal-item")).toHaveText("Someday");
  // Dragged onto another day: its date that day, its time kept
  await bar("Sync").dragTo(cell(12));
  await expect.poll(() => space.saved("Page/db-tasks/Sync")).toMatch(/due: "?.*-12T10:00"?/);
  await expect(bar("Sync")).toHaveText("10:00 Sync");
  await expect(bar("Sync").locator(".swd-cal-name")).toBeVisible();
  // One without a date dragged onto a day: given it
  await page.locator(".swd-cal-undated .swd-cal-item").dragTo(cell(13));
  await expect.poll(() => space.saved("Page/db-tasks/Someday")).toContain(day(13));
  // A day's +: an item added on it
  await cell(20).hover({ position: { x: 10, y: 10 } });
  await cell(20).locator(".swd-cal-add").click();
  await expect.poll(() => space.saved("Page/db-tasks/Untitled")).toContain(day(20));
  // A phone: the days show marks, a day pressed lists its items whole under the month
  await page.setViewportSize({ width: 390, height: 844 });
  await cell(12).click({ position: { x: 4, y: 12 } });
  await expect(page.locator(".swd-cal-agenda")).toBeVisible();
  await expect(page.locator(".swd-cal-agenda .swd-cal-item")).toHaveText("10:00 Sync");
  await expect(bar("Sync").locator(".swd-cal-name")).toBeHidden();
});

test("the calendar's spans: an item from its start to its end a bar across its days, moved whole, its end dragged by its handle", async ({ page, space }) => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = (d: number) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(d)}`;
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    start: { type: date, label: Start }\n    end: { type: date, label: End }\n---\n";
  const trip = `---\ntags: [db]\nstart: "${day(3)}"\nend: "${day(5)}"\n_database:\n  rank: a0\n---\n`;
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: calendar\ncalendar.endBy: end\n```\n", "Page/db-tasks": rootPage, "Page/db-tasks/Trip": trip }, "Page");
  const cell = (d: number) => page.locator(`.swd-cal-day[data-day="${day(d)}"]`);
  const bars = page.locator(".swd-cal-week .swd-cal-item", { hasText: "Trip" });
  await expect(page.locator(".swd-cal-by")).toHaveText("by Start → End");
  // Across its days: as wide as the days it lasts (one bar, or one a week where it crosses one)
  const width = async () => (await bars.evaluateAll((all) => all.map((one) => one.getBoundingClientRect().width))).reduce((sum, one) => sum + one, 0);
  const dayWidth = (await cell(3).boundingBox())!.width;
  expect(await width()).toBeGreaterThan(dayWidth * 2.5);
  // Moved whole: taken by its first day, dropped on the 10th: the 10th to the 12th
  await bars.first().dragTo(cell(10), { sourcePosition: { x: 12, y: 8 } });
  await expect.poll(() => space.saved("Page/db-tasks/Trip")).toContain(`end: "${day(12)}"`);
  expect(await space.saved("Page/db-tasks/Trip")).toContain(`start: "${day(10)}"`);
  // Its end's handle dragged to the 14th
  await bars.last().hover();
  await bars.last().locator(".swd-cal-handle-end").dragTo(cell(14));
  await expect.poll(() => space.saved("Page/db-tasks/Trip")).toContain(`end: "${day(14)}"`);
  expect(await space.saved("Page/db-tasks/Trip")).toContain(`start: "${day(10)}"`);
});

test("the timeline: a row an item, its bar from its start to its end, moved by a drag a day at a time, its end by its handle, today in view", async ({ page, space }) => {
  const at = (by: number) => {
    const one = new Date();
    one.setDate(one.getDate() + by);
    return `${one.getFullYear()}-${String(one.getMonth() + 1).padStart(2, "0")}-${String(one.getDate()).padStart(2, "0")}`;
  };
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    start: { type: date, label: Start }\n    end: { type: date, label: End }\n---\n";
  const trip = `---\ntags: [db]\nstart: "${at(1)}"\nend: "${at(3)}"\n_database:\n  rank: a0\n---\n`;
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: timeline\ntimeline.endBy: end\n```\n", "Page/db-tasks": rootPage, "Page/db-tasks/Trip": trip, "Page/db-tasks/Someday": "---\ntags: [db]\n_database:\n  rank: a1\n---\n" }, "Page");
  const bar = page.locator(".swd-tl-bar", { hasText: "Trip" });
  await expect(page.locator(".swd-tl-name-text")).toHaveText(["Trip", "Someday"]);
  // Today in view, the bar three days wide (40px a day)
  await expect(page.locator(".swd-tl-unit.swd-tl-now")).toBeInViewport();
  expect(Math.round((await bar.boundingBox())!.width)).toBe(120);
  // Dragged two days and a little right: moved two days whole
  const box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60 + 30, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(box.x + 60 + 90, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => space.saved("Page/db-tasks/Trip")).toContain(`start: "${at(3)}"`);
  expect(await space.saved("Page/db-tasks/Trip")).toContain(`end: "${at(5)}"`);
  // Its end's handle a day right
  await bar.hover();
  const handle = (await bar.locator(".swd-tl-handle-end").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 42, handle.y + handle.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => space.saved("Page/db-tasks/Trip")).toContain(`end: "${at(6)}"`);
  expect(await space.saved("Page/db-tasks/Trip")).toContain(`start: "${at(3)}"`);
});

test("a tool's menu shows whole over a short block, not cut by it, scrolled in itself where the window is low", async ({ page, space }) => {
  await page.setViewportSize({ width: 900, height: 360 });
  await space.open({ Page: `# Page\n\n${BLOCK}\nAfter\n`, ...TASKS }, "Page");
  // (The block kept short, as SilverBullet's widget may be, cutting what goes past it)
  await page.addStyleTag({ content: ".swd-widget { max-height: 120px; overflow: auto; }" });
  await page.locator(".swd-view-picker").click();
  const menu = page.locator(".swd-menu:not([hidden])");
  await expect(menu.locator(".swd-menu-item")).toHaveCount(7);
  const widget = (await page.locator(".swd-widget").boundingBox())!;
  const box = (await menu.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(widget.y + widget.height);
  // Its last item pressed where it shows (on top of whatever is under it)
  await menu.locator(".swd-menu-item").last().scrollIntoViewIfNeeded();
  const scrolled = await menu.evaluate((one) => one.scrollTop);
  await page.waitForTimeout(100);
  expect(await menu.evaluate((one) => one.scrollTop)).toBe(scrolled);
  await menu.locator(".swd-menu-item", { hasText: "Count" }).click();
  await expect(page.locator(".test-count")).toHaveText("2 of 2");
});

test("a view picked is written into the block it was picked in, the place drawn anew from it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await pickView(page, "Count");
  await expect(page.locator(".test-count")).toHaveText("2 of 2");
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\n```silverware-database\nid: tasks\nview: count\n```\n");
});

test("actions one after another are each written into the block, SilverBullet's controls of it hidden", async ({ page, space }) => {
  await space.open({ Page: `# Page

${BLOCK}`, ...TASKS }, "Page");
  await pickView(page, "Count");
  await expect.poll(() => space.saved("Page")).toContain("view: count");
  await pickView(page, "Names");
  await expect.poll(() => space.saved("Page")).toContain("view: names");
  await pickView(page, "List");
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
  // Esc closes ⋯, its Group › Group by submenu too, the page's markdown never shown
  await page.locator(".swd-more").click();
  await choose(page, "Group");
  await choose(page, "Group by");
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-menu:not([hidden])")).toHaveCount(0);
  await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(0);
  await page.locator(".swd-more").click();
  await choose(page, "Edit source");
  await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(1);
  await expect(page.locator(".cm-line", { hasText: "id: tasks" })).toBeVisible();
});

test("the pencil in ⋯'s title renames the database in its root page, typing in it reaching neither the page nor its markdown", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}\nAfter\n`, ...TASKS }, "Page");
  await expect(page.locator(".test-item")).toHaveCount(2);
  await page.locator(".swd-more").click();
  await page.locator(".swd-menu-rename").click();
  const field = page.locator(".swd-menu-name");
  await expect(field).toHaveValue("Tasks");
  await field.fill("Jobs board");
  await field.press("Enter");
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("name: Jobs board");
  await expect(page.locator(".swd-place-name")).toHaveText("Jobs board");
  // The page's text untouched, its block's markdown never shown
  expect(await space.saved("Page")).toBe(`# Page\n\n${BLOCK}\nAfter\n`);
  await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(0);
});

test("in SilverBullet's dark look the browser's own controls of a database are drawn dark (a date's calendar icon)", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-widget")).toBeVisible();
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  expect(await page.locator(".swd-widget").evaluate((one) => getComputedStyle(one).colorScheme)).toBe("dark");
});

test("a timeline's bar dragged to its right edge scrolls it, as a board's card does, and is dropped the days further it went", async ({ page, space }) => {
  const day = (by: number) => {
    const one = new Date();
    one.setDate(one.getDate() + by);
    return `${one.getFullYear()}-${String(one.getMonth() + 1).padStart(2, "0")}-${String(one.getDate()).padStart(2, "0")}`;
  };
  const root = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    due: { type: date, label: Due }\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: timeline\n```\n", "Page/db-tasks": root, "Page/db-tasks/Trip": `---\ntags: [db]\ndue: "${day(1)}"\n_database:\n  rank: a0\n---\n` }, "Page");
  const bar = page.locator(".swd-tl-bar", { hasText: "Trip" });
  const scroller = page.locator(".swd-tl-box");
  const before = await scroller.evaluate((one) => one.scrollLeft);
  const from = (await bar.boundingBox())!;
  const edge = (await scroller.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(edge.x + edge.width - 6, from.y + from.height / 2, { steps: 8 });
  // Held at the edge: it scrolls on, the pointer still
  await page.waitForTimeout(800);
  expect(await scroller.evaluate((one) => one.scrollLeft)).toBeGreaterThan(before + 200);
  await page.mouse.up();
  await expect.poll(() => space.saved("Page/db-tasks/Trip")).not.toContain(`due: "${day(1)}"`);
  const saved = /due: "(\d{4}-\d{2}-\d{2})"/.exec((await space.saved("Page/db-tasks/Trip")) ?? "")![1]!;
  // Further than the pointer alone went (the edge is some 15 days from the bar on this window)
  expect(saved > day(20)).toBe(true);
});

test("a timeline's names folded to a strip by its corner's button, its rows as high, kept so as the page is opened again", async ({ page, space }) => {
  const root = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    due: { type: date, label: Due }\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: timeline\n```\n", "Page/db-tasks": root, "Page/db-tasks/Someday": "---\ntags: [db]\n_database:\n  rank: a0\n---\n" }, "Page");
  const name = page.locator(".swd-tl-name-text", { hasText: "Someday" });
  await expect(name).toBeVisible();
  const before = (await page.locator(".swd-tl-corner").boundingBox())!.width;
  const high = (await page.locator(".swd-tl-row").first().boundingBox())!.height;
  // (The row without a bar names its item only where the names are folded)
  await expect(page.locator(".swd-tl-hint-name")).toBeHidden();
  await page.locator(".swd-tl-fold").click();
  await expect(name).toBeHidden();
  expect((await page.locator(".swd-tl-corner").boundingBox())!.width).toBeLessThan(before / 3);
  expect((await page.locator(".swd-tl-row").first().boundingBox())!.height).toBe(high);
  await expect(page.locator(".swd-tl-hint-name")).toBeVisible();
  await expect(page.locator(".swd-tl-hint")).toHaveText("Someday · No Due: press a day");
  // (No icon: its name's first three letters in the strip)
  await expect(page.locator(".swd-tl-name-initial")).toHaveText("Som");
  await page.reload();
  await expect(page.locator(".swd-tl")).toHaveClass(/swd-tl-folded/);
  await page.locator(".swd-tl-fold").click();
  await expect(name).toBeVisible();
});

test("a timeline grouped by Group by in ⋯: one axis, each group's head over its items' rows, folded by its head", async ({ page, space }) => {
  const day = (by: number) => {
    const one = new Date();
    one.setDate(one.getDate() + by);
    return `${one.getFullYear()}-${String(one.getMonth() + 1).padStart(2, "0")}-${String(one.getDate()).padStart(2, "0")}`;
  };
  const root = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    phase: { type: select, label: Phase, options: [Design, Build] }\n    due: { type: date, label: Due }\n---\n";
  const item = (phase: string, due: number, rank: string) => `---\ntags: [db]\nphase: ${phase}\ndue: "${day(due)}"\n_database:\n  rank: ${rank}\n---\n`;
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: timeline\n```\n", "Page/db-tasks": root, "Page/db-tasks/Sketch": item("Design", 1, "a0"), "Page/db-tasks/Code": item("Build", 3, "a1"), "Page/db-tasks/Review": item("Design", 2, "a2") }, "Page");
  await expect(page.locator(".swd-tl-bar")).toHaveCount(3);
  await page.locator(".swd-more").click();
  await choose(page, "Group");
  await choose(page, "Group by");
  await choose(page, "Phase");
  await expect.poll(() => space.saved("Page")).toContain("timeline.groupBy: phase");
  const rows = page.locator(".swd-tl-row");
  await expect(rows.locator(".swd-group-label, .swd-tl-name-text")).toHaveText(["Design", "Sketch", "Review", "Build", "Code"]);
  await expect(page.locator(".swd-tl")).toHaveCount(1);
  // (Colored by it too: the bar and its name in the names' column)
  await page.locator(".swd-more").click();
  await choose(page, "Color by");
  await choose(page, "Phase");
  await expect(page.locator('.swd-tl-row[data-item] .swd-tl-name[data-swd-item-color="1"]')).toHaveCount(1);
  await expect(page.locator('.swd-tl-bar[data-swd-item-color="1"]')).toHaveCount(1);
  await page.locator('.swd-tl-group[data-group] .swd-group-head').first().click();
  await expect(rows.locator(".swd-group-label, .swd-tl-name-text")).toHaveText(["Design", "Build", "Code"]);
});

test("Color by in ⋯ colors a view's items by a select's options, written into the block", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Color by");
  await choose(page, "Status");
  await expect.poll(() => space.saved("Page")).toContain("list.colorBy: status");
  // (Todo the options' first, Done the second)
  await expect(page.locator(".swd-list-item", { hasText: "Fix login" })).toHaveAttribute("data-swd-item-color", "0");
  await expect(page.locator(".swd-list-item", { hasText: "Write docs" })).toHaveAttribute("data-swd-item-color", "1");
});

test("Group › Group by in ⋯ picks the board's property, written into the block", async ({ page, space }) => {
  const root = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    area: { type: select, label: Area, options: [Web, App] }\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: board\n```\n", ...TASKS, "Page/db-tasks": root }, "Page");
  await expect(page.locator(".swd-board-column")).toHaveCount(2);
  await page.locator(".swd-more").click();
  await choose(page, "Group");
  await choose(page, "Group by");
  await choose(page, "Area");
  await expect.poll(() => space.saved("Page")).toContain("board.groupBy: area");
  await expect(page.locator(".swd-board-column").first()).toHaveAttribute("aria-label", /^No Area/);
});

test("a board grouped by a checkbox: a card dragged ticks it; its columns ordered and hidden under Group in ⋯, the menu staying open", async ({ page, space }) => {
  const root = `---
tags: [db-root]
_database:
  id: tasks
  name: Tasks
  version: 1
  properties:
    status: { type: select, label: Status, options: [Todo, Done] }
    done: { type: checkbox, label: Done }
---
`;
  const fence = "`".repeat(3);
  const block = `# Page

${fence}silverware-database
id: tasks
view: board
board.groupBy: done
${fence}
`;
  await space.open({ Page: block, ...TASKS, "Page/db-tasks": root }, "Page");
  const columns = page.locator(".swd-board-column");
  await expect(columns.locator(".swd-board-title")).toHaveText([/^Checked/, /^Unchecked/]);
  await columns.nth(1).locator(".swd-board-card").first().dragTo(columns.nth(0));
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("done: true");
  // Group: Unchecked moved first by Alt+↑ on its grip, then Checked hidden by its eye, the menu open all along
  await page.locator(".swd-more").click();
  await choose(page, "Group");
  const rows = page.locator(".swd-group-row");
  await expect(rows.locator(".swd-group-row-label")).toHaveText(["Checked", "Unchecked"]);
  await rows.nth(1).locator(".swd-group-grip").focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(() => space.saved("Page")).toContain("board.groupOrder:");
  await expect(columns.locator(".swd-board-title")).toHaveText([/^Unchecked/, /^Checked/]);
  await expect(rows.locator(".swd-group-row-label")).toHaveText(["Unchecked", "Checked"]);
  await rows.nth(1).locator(".swd-group-eye").click();
  await expect.poll(() => space.saved("Page")).toContain("board.groupHidden:");
  await expect(columns).toHaveCount(1);
  await expect(rows.nth(1)).toHaveClass(/swd-group-off/);
  // Back from Group by to Group
  await choose(page, "Group by");
  await page.locator(".swd-menu-back").click();
  await expect(page.locator(".swd-group-switch")).toBeVisible();
  await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(0);
});

test("a table grouped under Group by is one table, a part per group with its own header, its columns as wide in every group, folding moving none", async ({ page, space }) => {
  const long = "a much longer name than the other";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS, [`Page/db-tasks/${long}`]: item("Done", "a2") }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Group");
  await choose(page, "Group by");
  await choose(page, "Status");
  await expect.poll(() => space.saved("Page")).toContain("table.groupBy: status");
  await expect(page.locator(".swd-table")).toHaveCount(1);
  const groups = page.locator(".swd-table-group");
  await expect(groups).toHaveCount(2);
  await expect(groups.locator(".swd-group-label")).toHaveText(["Todo", "Done"]);
  await expect(groups.locator(".swd-table-headrow")).toHaveCount(2);
  // Each group's header cells where the other's are: one table's columns
  const lefts = (at: number) => groups.nth(at).locator(".swd-table-headrow > th").evaluateAll((all) => all.map((one) => Math.round(one.getBoundingClientRect().left)));
  expect(await lefts(0)).toEqual(await lefts(1));
  const before = await lefts(1);
  await expect(groups.nth(1).locator("tr[data-item]")).toHaveCount(2);
  await groups.nth(1).locator(".swd-table-add").click();
  await expect.poll(() => space.saved("Page/db-tasks/Untitled")).toContain("status: Done");
  await expect(groups.nth(1).locator("tr[data-item]")).toHaveCount(3);
  // Folded: kept in the block, its rows unseen, no column moved (the long name still counts)
  await groups.nth(1).locator(".swd-group-head").click();
  await expect.poll(() => space.saved("Page")).toContain("table.folded:");
  await expect(groups.nth(1)).toHaveClass(/swd-folded/);
  await expect(groups.nth(1).locator("tr[data-item]").first()).not.toBeVisible();
  expect(await lefts(0)).toEqual(before);
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
  await pickView(page, "Board");
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
  await pickView(page, "List");
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
  await expect(page.locator(".swd-view-picker")).toHaveAttribute("data-view", "table");
});

test("a block in a list item is not written, said why, the page as it was", async ({ page, space }) => {
  const listed = "# Page\n\n- item\n  ```silverware-database\n  id: tasks\n  view: names\n  ```\n- next\n";
  await space.open({ Page: listed, ...TASKS }, "Page");
  await pickView(page, "Count");
  await expect(page.locator(".sb-notifications")).toContainText("indented");
  expect(await space.saved("Page")).toBe(listed);
});

// SilverBullet 2.12.1 renders blocks written alike on a page as one element: its widget cache shares a widget's result by
// its language, page and text (client/codemirror/fenced_code.ts cacheKey, client/widget_cache.ts prewarmResult, since
// its commit 1dd7556f of 2026-10-10), so only one of them is in the page. Which block a pick is written into is covered
// by index.test.ts; this waits for a SilverBullet that renders each block apart, or for places drawn from HTML text
test.fixme("of two blocks written alike, the one a view is picked in is written", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}\ntext between\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-place")).toHaveCount(2);
  await pickView(page, "Count", page.locator(".swd-place").nth(1));
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${BLOCK}\ntext between\n\n\`\`\`silverware-database\nid: tasks\nview: count\n\`\`\`\n`);
});

test("the settings turn a view off: saved in CONFIG, the picker without it at once", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await page.locator(".swd-view-picker").click();
  await expect(page.locator(".swd-menu .swd-menu-item")).toHaveCount(7);
  await page.keyboard.press("Escape");
  await runCommand(page, "Silverware Database: Settings");
  await page.locator('.swd-settings [data-swd-view="count"]').click();
  await page.locator(".swd-settings-save").click();
  await expect(page.locator(".swd-settings")).toHaveCount(0);
  // (In a block of its own: the Configuration Manager writes its block anew from what its schema shows)
  await expect.poll(() => space.config()).toContain('-- managed-by: silverware-database');
  expect(await space.config()).toContain('config.set("silverware.database.views.count.enabled", false)');
  await page.locator(".swd-view-picker").click();
  await expect(page.locator(".swd-menu .swd-menu-item")).toHaveCount(6);
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

test("the Properties dialog adds a property and changes a type in its draft, both written by Save", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Properties");
  await page.locator(".swd-property-new-label").fill("Estimate");
  await page.locator(".swd-property-new-type").selectOption("number");
  await page.locator(".swd-property-add").click();
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('[data-property="status"] .swd-property-type').selectOption("text");
  await expect(page.locator('[data-property="status"] .swd-prop-mark')).toHaveText("Changed");
  // Nothing written until Save
  expect(await space.saved("Page/db-tasks")).toContain("status: { type: select");
  expect(await space.saved("Page/db-tasks")).not.toContain("estimate:");
  // (Every value reads as text: the schema alone, written at once, the dialog closed)
  await page.locator(".swd-properties-save").click();
  await expect(page.locator(".swd-properties")).toHaveCount(0);
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("status: { type: text");
  expect(await space.saved("Page/db-tasks")).toContain("    estimate: { type: number, label: Estimate }\n");
});

test("a time, a date and time and a link: edited in their own fields, written and read back through the index; a link opened by a press", async ({ page, space }) => {
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    at: { type: time, label: At }\n    when: { type: datetime, label: When }\n    web: { type: url, label: Web }\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS, "Page/db-tasks": rootPage }, "Page");
  const row = page.locator(".swd-table tbody tr", { hasText: "Fix login" });
  const cell = (key: string) => row.locator(`td[data-key="${key}"]`);
  // A time
  await cell("at").click();
  await expect(cell("at").locator("input")).toHaveAttribute("type", "time");
  await cell("at").locator("input").fill("14:30");
  await cell("at").locator("input").press("Enter");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toMatch(/at: "?14:30"?/);
  await expect(cell("at")).toHaveText("14:30");
  await expect(cell("at")).not.toHaveClass(/swd-invalid/);
  // A date and time
  await cell("when").click();
  await expect(cell("when").locator("input")).toHaveAttribute("type", "datetime-local");
  await cell("when").locator("input").fill("2026-11-08T14:30");
  await cell("when").locator("input").press("Enter");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toMatch(/when: "?2026-11-08T14:30"?/);
  await expect(cell("when")).toHaveText("2026-11-08 14:30");
  await expect(cell("when")).not.toHaveClass(/swd-invalid/);
  // A link: its address, then a text of its own
  await cell("web").click();
  // (Typed without its scheme: kept as a web address)
  await cell("web").locator(".swd-link-address").fill("example.com/docs/");
  await cell("web").locator(".swd-link-address").press("Enter");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toMatch(/web: "?https:\/\/example\.com\/docs\/"?/);
  await expect(cell("web").locator("a.swd-link")).toHaveText("example.com/docs");
  await expect(cell("web").locator(".swd-link-rest")).toHaveText("/docs");
  // Pressed: opened in a tab of its own, the block's markdown not shown, no editor opened
  const opened = page.waitForEvent("popup");
  await cell("web").locator("a.swd-link").click();
  expect((await opened).url()).toBe("https://example.com/docs/");
  await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(0);
  await expect(cell("web").locator(".swd-editor-link")).toHaveCount(0);
  // Its text, pressed beside the link
  const box = (await cell("web").boundingBox())!;
  await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
  await cell("web").locator(".swd-link-text").fill("Docs");
  await cell("web").locator(".swd-link-text").press("Enter");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("[Docs](https://example.com/docs/)");
  await expect(cell("web").locator("a.swd-link")).toHaveText("Docs");
  // A select in the peek: its list open at once
  await row.locator(".swd-table-name").hover();
  await row.locator(".swd-open").click();
  await page.locator('.swd-peek .swd-peek-value[data-key="status"]').click();
  const select = page.locator('.swd-peek .swd-peek-value[data-key="status"] select');
  await expect(select).toBeFocused();
  expect(await select.evaluate((one) => one.matches(":open"))).toBe(true);
  // The link in the peek: its pencil edits it, on the link's line
  const web = page.locator('.swd-peek .swd-peek-value[data-key="web"]');
  await expect(web.locator("a.swd-link")).toHaveText("Docs");
  const [link, pencil] = [(await web.locator("a.swd-link").boundingBox())!, (await web.locator(".swd-peek-edit").boundingBox())!];
  expect(Math.abs(link.y + link.height / 2 - (pencil.y + pencil.height / 2))).toBeLessThan(6);
  await web.locator(".swd-peek-edit").click();
  await expect(web.locator(".swd-link-text")).toHaveValue("Docs");
  await expect(web.locator(".swd-link-address")).toHaveValue("https://example.com/docs/");
  // A value changed, then a press in the content: the value shown at once, the content's field keeping the focus
  const at = page.locator('.swd-peek .swd-peek-value[data-key="at"]');
  await at.click();
  await at.locator("input").fill("09:15");
  const body = page.locator(".swd-peek .swd-peek-body");
  await body.click();
  await expect(at).toHaveText("09:15");
  await expect(body).toBeFocused();
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toMatch(/at: "?09:15"?/);
});

test("a reference: pages picked, kept as wiki links, opened by a press, renamed with their page by SilverBullet", async ({ page, space }) => {
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    refs: { type: reference, label: Refs }\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS, "Page/db-tasks": rootPage, "Refs target one": "# One\n", "Refs target two": "# Two\n" }, "Page");
  const target = `${space.folder}/Refs target one`;
  const cell = page.locator(".swd-table tbody tr", { hasText: "Fix login" }).locator('td[data-key="refs"]');
  await cell.click();
  // Found by words of its name, ticked by Enter, saved by Enter again
  const search = cell.locator(".swd-editor-search");
  // A page's folder pressed: its path in the search, its page not ticked, the editor still open
  await search.fill(`${space.folder} target two`);
  await cell.locator(".swd-editor-choice").first().locator("button.swd-editor-document-folder").click();
  await expect(search).toHaveValue(`${space.folder}/`);
  await expect(search).toBeFocused();
  await expect(cell.locator("input[type=checkbox]:checked")).toHaveCount(0);
  await expect(cell.locator(`.swd-editor-choice[title="${space.folder}/Refs target one"]`)).toBeVisible();
  await search.fill(`${space.folder} target one`);
  // (Each document its name, its folder under it)
  await expect(cell.locator(".swd-editor-choice").first()).toHaveAttribute("title", target);
  await expect(cell.locator(".swd-editor-choice").first().locator(".swd-editor-document-folder")).toHaveText(space.folder);
  await search.press("Enter");
  await search.press("Enter");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain(`refs: ["[[${target}]]"]`);
  await expect(cell.locator("a.swd-reference")).toHaveText(target);
  // In the peek its editor is in the value's row, its search in view (a panel over the properties' box was cut by its edge)
  await page.locator(".swd-table tbody tr", { hasText: "Fix login" }).locator(".swd-table-name").hover();
  await page.locator(".swd-table tbody tr", { hasText: "Fix login" }).locator(".swd-open").click();
  const peekRefs = page.locator('.swd-peek .swd-peek-value[data-key="refs"]');
  await peekRefs.click({ position: { x: 4, y: 4 } });
  await expect(peekRefs.locator(".swd-editor-documents")).toHaveCSS("position", "static");
  await expect(peekRefs.locator(".swd-editor-search")).toBeInViewport({ ratio: 1 });
  await peekRefs.locator(".swd-editor-search").press("Escape");
  await page.locator(".swd-peek-close").click();
  // Its page renamed in SilverBullet: the link in the item's page renamed with it
  type Client = { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } };
  await waitForIndex(page, "link", target);
  await page.evaluate(
    ([from, to]) => (window as unknown as { client: Client }).client.clientSystem.localSyscall("system.invokeFunction", ["index.renamePageCommand", { oldPage: from, page: to }]),
    [target, `${space.folder}/Refs target renamed`],
  );
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain(`refs: ["[[${space.folder}/Refs target renamed]]"]`);
  // Pressed: its page opened
  await expect(cell.locator("a.swd-reference")).toHaveText(`${space.folder}/Refs target renamed`);
  await cell.locator("a.swd-reference").click();
  await expect(page).toHaveURL(/Refs%20target%20renamed$|Refs target renamed$/);
});

test("a property's key changed in Properties follows into its views' blocks on every page, said in the review, its items with it", async ({ page, space }) => {
  const other = "# Other\n\n```silverware-database\nid: tasks\nview: list\nlist.colorBy: status\nlist.filter: {\"status\":\"Todo\"}\n```\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: board\nboard.groupBy: status\n```\n", "Page/Other": other, ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Properties");
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('[data-property="status"] .swd-prop-advanced-summary').click();
  await page.locator('[data-property="status"] .swd-property-key').fill("stav");
  await page.locator('[data-property="status"] .swd-property-key').press("Enter");
  await page.locator(".swd-properties-save").click();
  const review = page.locator(".swd-property-review");
  await expect(review).toContainText("Updates the views of it on 2 pages");
  await expect(review).toContainText("keep this window open until it is done");
  await page.locator(".swd-property-apply").click();
  await expect.poll(() => space.saved("Page")).toContain("board.groupBy: stav");
  await expect.poll(() => space.saved("Page/Other")).toContain('list.filter: {"stav":"Todo"}');
  expect(await space.saved("Page/Other")).toContain("list.colorBy: stav");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("stav: Todo");
});

test("a property's icon picked in Properties: kept in the root page, before its name in a table's header and in the peek", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Properties");
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('[data-property="status"] .swd-property-icon').click();
  await page.locator(".swd-pop .swd-emoji-field").fill("rocket");
  await page.locator(".swd-pop .swd-emoji", { hasText: "🚀" }).first().click();
  await expect(page.locator('[data-property="status"] .swd-prop-head .swd-prop-own-icon')).toHaveText("🚀");
  await expect(page.locator('[data-property="status"] .swd-property-icon')).toBeFocused();
  // Esc in the picker closes it alone, the dialog staying
  await page.locator('[data-property="status"] .swd-property-icon').click();
  await expect(page.locator(".swd-pop")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-pop")).toHaveCount(0);
  await expect(page.locator(".swd-properties")).toBeVisible();
  await page.locator(".swd-properties-save").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain('icon: "🚀"');
  await expect(page.locator(".swd-table th .swd-table-head-icon")).toHaveText("🚀");
  await page.locator(".swd-table .swd-open").first().click();
  await expect(page.locator('.swd-peek-row[data-property="status"] .swd-prop-own-icon')).toHaveText("🚀");
});

test("Name in views in Properties: kept in the root page, a list's rows showing Status: Todo", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Properties");
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('[data-property="status"] .swd-property-show-name input').click();
  await page.locator(".swd-properties-save").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("showName: true");
  await expect(page.locator(".swd-list-item", { hasText: "Fix login" }).locator(".swd-field-name")).toHaveText("Status: ");
  await expect(page.locator(".swd-list-item", { hasText: "Fix login" })).toContainText("Status: Todo");
});

test("a property removed in Properties: no question, marked until Save, its switch taking its values off the items too, shown first", async ({ page, space }) => {
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    note: { type: text, label: Note }\n---\n";
  const itemPage = "---\ntags: [db]\nstatus: Todo\nnote: keep me\n_database:\n  rank: a0\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", "Page/db-tasks": rootPage, "Page/db-tasks/Fix login": itemPage }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Properties");
  await page.locator('[data-property="note"] .swd-prop-head').click();
  await page.locator('[data-property="note"] .swd-property-remove').click();
  // No dialog of the browser's or SilverBullet's asked: marked, its switch off
  await expect(page.locator('[data-property="note"] .swd-prop-mark')).toHaveText("Removed");
  const values = page.locator('[data-property="note"] .swd-property-values-off input[role="switch"]');
  await expect(values).not.toBeChecked();
  await page.locator('[data-property="note"] .swd-property-values-off .swd-settings-switch').click();
  await page.locator(".swd-properties-save").click();
  await expect(page.locator(".swd-property-review")).toContainText("Save the properties: one item changes");
  await page.locator(".swd-property-apply").click();
  await expect.poll(() => space.saved("Page/db-tasks")).not.toContain("note:");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).not.toContain("note:");
});

test("values outside the database, on their screen in Properties: one added back as a property, another taken off the pages", async ({ page, space }) => {
  const itemPage = "---\ntags: [db]\nstatus: Todo\npoints: 5\nlegacy: old text\n_tool: kept\n_database:\n  rank: a0\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS, "Page/db-tasks/Fix login": itemPage }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Properties");
  await page.locator(".swd-property-loose-open").click();
  const rows = page.locator(".swd-loose-row");
  await expect(rows).toHaveCount(2);
  await expect(page.locator('.swd-loose-row[data-key="points"] .swd-loose-type')).toHaveValue("number");
  // Added: a property of that key in the draft, gone from the screen
  await page.locator('.swd-loose-row[data-key="points"] .swd-loose-add').click();
  await expect(rows).toHaveCount(1);
  // Taken off the pages, shown first
  await page.locator('.swd-loose-row[data-key="legacy"] .swd-loose-remove').click();
  await expect(page.locator(".swd-property-review")).toContainText('Take "legacy" off the items: one item changes');
  await page.locator(".swd-property-apply").click();
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).not.toContain("legacy:");
  expect(await space.saved("Page/db-tasks/Fix login")).toContain("_tool: kept");
  await expect(page.locator(".swd-loose-none")).toBeVisible();
  // Saved: the property of that key, its value in the table
  await page.locator(".swd-loose-back").click();
  await page.locator(".swd-properties-save").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("points: { type: number, label: Points }");
  await expect(page.locator('.swd-table td[data-key="points"]').first()).toHaveText("5");
});

test("system properties added in Properties show the pages' dates, the order by hand, the page, its tags and its tasks done, written into no item's page", async ({ page, space }) => {
  // (Write docs with tasks in its page: two of three done)
  const tasks = ["- [x] outline", "- [x] draft", "- [ ] review", ""].join(String.fromCharCode(10));
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS, "Page/db-tasks/Write docs": TASKS["Page/db-tasks/Write docs"] + tasks }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Properties");
  for (const kind of ["createdAt", "modifiedAt", "order", "page", "tags", "taskProgress"]) {
    await page.locator(".swd-property-new-type").selectOption(`system:${kind}`);
    await page.locator(".swd-property-add").click();
    await expect(page.locator(`.swd-property-new-type option[value="system:${kind}"]`)).toBeDisabled();
  }
  await page.locator(".swd-properties-save").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("system: taskProgress");
  const row = page.locator(".swd-table tbody tr", { hasText: "Write docs" });
  await expect(row.locator('[data-key="order"]')).toHaveText("2");
  await expect(row.locator('[data-key="task_progress"]')).toHaveText("67%");
  await expect(row.locator('[data-key="task_progress"] .swd-progress')).toBeVisible();
  await expect(page.locator(".swd-table tbody tr", { hasText: "Fix login" }).locator('[data-key="task_progress"]')).toHaveText("");
  // (The test's pages in a folder of their own: the page's path ends so)
  expect(await row.locator('[data-key="page"]').textContent()).toMatch(new RegExp("/Page/db-tasks/Write docs$"));
  await expect(row.locator('[data-key="created_at"]')).toHaveText(/^\d{4}-\d\d-\d\d \d\d:\d\d$/);
  await expect(row.locator('[data-key="modified_at"]')).toHaveText(/^\d{4}-\d\d-\d\d \d\d:\d\d$/);
  // Read only: a click opens no editor
  await row.locator('[data-key="order"]').click();
  await expect(row.locator('[data-key="order"] input')).toHaveCount(0);
  // An item's value changed: none of them written into its page
  await row.locator('[data-key="status"]').click();
  await row.locator('[data-key="status"] select').selectOption("Todo");
  await expect.poll(() => space.saved("Page/db-tasks/Write docs")).toContain("status: Todo");
  expect(await space.saved("Page/db-tasks/Write docs")).not.toMatch(/created_at|modified_at|page_tags|^order:|^page:|task_progress/m);
  // The last task ticked by hand in the item's own page: the database shows it all done once back
  const itemPage = (await row.locator('[data-key="page"]').textContent())!;
  await page.goto(`${new URL(page.url()).origin}/${itemPage.split("/").map(encodeURIComponent).join("/")}`);
  await page.locator(".cm-line", { hasText: "review" }).locator("input[type=checkbox]").click();
  await expect.poll(() => space.saved("Page/db-tasks/Write docs")).toContain("- [x] review");
  await page.goBack();
  await expect(page.locator(".swd-table tbody tr", { hasText: "Write docs" }).locator('[data-key="task_progress"]')).toHaveText("100%");
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

test("an item's icon picked in the peek from the emoji, its color from the palette: kept in its page, shown by its name in the views", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: board\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-board-name", { hasText: "Fix login" }).click();
  await expect(page.locator(".swd-peek")).toBeVisible();
  // The emoji's data loaded from the file beside the bundle, found by its name
  await page.locator(".swd-peek-icon").click();
  await page.locator(".swd-pop .swd-emoji-field").fill("rocket");
  await page.locator(".swd-pop .swd-emoji", { hasText: "🚀" }).first().click();
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain('icon: "🚀"');
  await expect(page.locator(".swd-peek-icon .swd-item-icon")).toHaveText("🚀");
  await expect(page.locator(".swd-peek-icon")).toBeFocused();
  await page.locator(".swd-peek-color").click();
  await page.locator('.swd-peek-pop-color[aria-label="Green"]').click();
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("color: green");
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-peek")).toHaveCount(0);
  const card = page.locator(".swd-board-card", { hasText: "Fix login" });
  await expect(card.locator(".swd-item-icon")).toHaveText("🚀");
  await expect(card).toHaveAttribute("data-swd-item-color", "2");
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

test("Delete database… in ⋯ deletes its pages and its blocks on every page once its name is typed; Undo brings them back", async ({ page, space }) => {
  const other = "# Other\n\nBefore.\n\n```silverware-database\nid: tasks\nview: board\n```\n\nAfter.\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", ...TASKS, "Page/Other": other }, "Page");
  await expect(page.locator(".swd-list-name")).toHaveCount(2);
  await page.locator(".swd-more").click();
  await choose(page, "Delete database…");
  const dialog = page.locator(".swd-delete-database");
  await expect(dialog.locator(".swd-delete-lines li").first()).toHaveText("2 items, each a page of its own, deleted with its content.");
  await expect(dialog.locator(".swd-delete-lines")).toContainText(`${space.folder}/Page/Other`);
  const confirm = dialog.locator(".swd-delete-confirm");
  await expect(confirm).toBeDisabled();
  await dialog.locator(".swd-delete-name").fill("Tasks");
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => space.saved("Page/db-tasks")).toBeUndefined();
  expect(await space.saved("Page/db-tasks/Fix login")).toBeUndefined();
  await expect.poll(() => space.saved("Page/Other")).toBe("# Other\n\nBefore.\n\nAfter.\n");
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\n");
  await runCommand(page, "Silverware Database: Undo");
  await expect.poll(() => space.saved("Page/Other")).toBe(other);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Todo");
  await expect(page.locator(".swd-list-name")).toHaveCount(2);
});

test("the peek's bin removes its item, asked first: the page gone, the panel closed, Undo bringing it back", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  await page.locator(".swd-peek-remove").click();
  // (SilverBullet's own question: Ok)
  const prompt = page.locator("dialog.sb-modal-box .sb-prompt");
  await expect(prompt).toContainText('Remove "Fix login"?');
  await prompt.locator(".sb-prompt-buttons button", { hasText: "Ok" }).click();
  await expect(page.locator(".swd-peek")).toHaveCount(0);
  await expect(page.locator(".swd-list-name")).toHaveText(["Write docs"]);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toBeUndefined();
  await page.locator(".swd-undo").click();
  await expect(page.locator(".swd-list-name")).toHaveText(["Fix login", "Write docs"]);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Todo");
});

test("the peek stays as its content typed is written by a press beside its fields, SilverBullet indexing the page anew; a property then edited there", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  const peek = page.locator(".swd-peek");
  await expect(peek).toBeVisible();
  const body = page.locator(".swd-peek-body");
  await expect(body).toBeEditable();
  await body.click();
  await page.keyboard.type("Typed in the peek");
  // A press in the peek beside its fields: the content written as it is left, the peek still there as SilverBullet indexes
  // the page anew (its index without the page for a moment: once read as the item removed, the peek closed)
  await peek.locator(".swd-peek-head").click();
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("Typed in the peek");
  await page.waitForTimeout(2000);
  await expect(peek).toBeVisible();
  // A press on a property's value: edited there
  await peek.locator('.swd-peek-row[data-property="status"] .swd-peek-value').click();
  await expect(peek.locator('.swd-peek-row[data-property="status"] :is(select, input)')).toHaveCount(1);
  await expect(page.locator(".swd-list-name")).toHaveCount(2);
});

test("the peek's properties scroll in their own box past a height, the content under them in view, the box kept where it was as a value is edited", async ({ page, space }) => {
  // A database of 30 text properties
  const keys = Array.from({ length: 30 }, (_, at) => `p${at}`);
  const schema = keys.map((key) => `    ${key}: { type: text, label: Property ${key} }`).join("\n");
  const rootPage = `---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n${schema}\n---\n`;
  const itemPage = `---\ntags: [db]\n${keys.map((key) => `${key}: value ${key}`).join("\n")}\n_database:\n  rank: a0\n---\nThe content\n`;
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", "Page/db-tasks": rootPage, "Page/db-tasks/Fix login": itemPage }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  const peek = page.locator(".swd-peek");
  const box = peek.locator(".swd-peek-props-box");
  await expect(peek.locator(".swd-peek-body")).toHaveValue("The content\n");
  // The content in the window, the properties' box scrolling (more in it than it shows)
  await expect(peek.locator(".swd-peek-body")).toBeInViewport();
  expect(await box.evaluate((one) => one.scrollHeight > one.clientHeight + 50)).toBe(true);
  // The last property scrolled to and edited: the box where it was once the peek is drawn anew
  const last = peek.locator('.swd-peek-value[data-key="p29"]');
  await last.scrollIntoViewIfNeeded();
  const scrolled = await box.evaluate((one) => one.scrollTop);
  expect(scrolled).toBeGreaterThan(0);
  await last.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  await page.keyboard.press("Enter");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("p29: value p29 edited");
  await expect(last).toContainText("value p29 edited");
  expect(Math.abs((await box.evaluate((one) => one.scrollTop)) - scrolled)).toBeLessThan(40);
  await expect(peek.locator(".swd-peek-body")).toBeInViewport();
  // Back at the box's top: a row moved down by Alt+↓ past its edge stays in view, the box following it
  await box.evaluate((one) => (one.scrollTop = 0));
  const shownInBox = async (key: string) => {
    const [row, edges] = await Promise.all([peek.locator(`.swd-peek-row[data-property="${key}"]`).boundingBox(), box.boundingBox()]);
    return !!row && !!edges && row.y >= edges.y - 1 && row.y + row.height <= edges.y + edges.height + 1;
  };
  const lowest = await box.evaluate((one) => {
    const edge = one.getBoundingClientRect().bottom;
    const rows = [...one.querySelectorAll<HTMLElement>(".swd-peek-row")].filter((row) => row.getBoundingClientRect().bottom <= edge);
    return rows.at(-1)!.dataset.property!;
  });
  await peek.locator(`.swd-peek-row[data-property="${lowest}"]`).hover();
  await peek.locator(`.swd-peek-row[data-property="${lowest}"] .swd-peek-grip`).focus();
  for (let n = 0; n < 3; n++) {
    await page.keyboard.press("Alt+ArrowDown");
    await expect.poll(() => shownInBox(lowest)).toBe(true);
  }
  // A row dragged by its grip to the box's bottom edge: the box scrolls on (the rows past it reachable)
  await box.evaluate((one) => (one.scrollTop = 0));
  const first = peek.locator('.swd-peek-row[data-property="p0"]');
  await first.hover();
  const grip = (await first.locator(".swd-peek-grip").boundingBox())!;
  const edges = (await box.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, edges.y + edges.height - 6, { steps: 8 });
  await expect.poll(() => box.evaluate((one) => one.scrollTop)).toBeGreaterThan(40);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  // A low window (the properties and the content no longer fit): the peek scrolled to its end, its controls and the item's
  // name still at its top
  await page.setViewportSize({ width: 1200, height: 300 });
  // (Once the panel has followed the window)
  await expect.poll(() => peek.evaluate((one) => ((one.scrollTop = one.scrollHeight), one.scrollTop))).toBeGreaterThan(0);
  for (const part of [".swd-peek-close", ".swd-peek-open", ".swd-peek-name"]) await expect(peek.locator(part)).toBeInViewport({ ratio: 1 });
  await peek.locator(".swd-peek-close").click();
  await expect(peek).toHaveCount(0);
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
  await pickView(page, "Count");
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
  await choose(page, "Properties");
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('.swd-option-color[aria-label="Color of Done"]').click();
  await page.locator('.swd-option-swatch[data-color-name="red"]').click();
  // And one of your own, written in quotes (a # starts a comment in YAML)
  await page.locator('.swd-option-color[aria-label="Color of Todo"]').click();
  await page.locator(".swd-option-own-input").evaluate((input: HTMLInputElement) => {
    input.value = "#3a7bd5";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator(".swd-properties-save").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain('Todo: "#3a7bd5"');
  expect(await space.saved("Page/db-tasks")).toMatch(/colors:[\s\S]*Done: red/);
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
  await choose(page, "Name");
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

test("full screen through writes of its block: a filter typed, the place drawn anew still over the window, the typing going on; Esc in the field leaves it only", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await page.locator('.swd-tool[data-tool="fullscreen"]').click();
  await page.locator(".swd-filter-button").click();
  const name = page.locator('.swd-filter input[data-key="name"]');
  await name.click();
  // (Watched: was the place ever back in the page as the block was written and drawn anew)
  await page.evaluate(() => {
    const seen = ((window as unknown as { inPage: number }).inPage = 0);
    const look = () => {
      if (document.querySelector(".swd-place:not(.swd-over-window)")) (window as unknown as { inPage: number }).inPage++;
      requestAnimationFrame(look);
    };
    look();
    return seen;
  });
  await page.keyboard.type("Fix", { delay: 40 });
  await expect.poll(() => space.saved("Page")).toContain("Fix");
  await expect(page.locator(".swd-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".swd-place")).toHaveClass(/swd-over-window/);
  await expect(name).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as { inPage: number }).inPage)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(name).not.toBeFocused();
  await expect(page.locator(".swd-place")).toHaveClass(/swd-over-window/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-place")).not.toHaveClass(/swd-over-window/);
});

test("a filter is applied as it is typed, without Enter, the typing going on as the block is written and drawn anew", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await expect(page.locator(".swd-table tbody tr")).toHaveCount(2);
  await page.locator(".swd-filter-button").click();
  const name = page.locator('.swd-filter input[data-key="name"]');
  await name.click();
  await page.keyboard.type("Fix", { delay: 40 });
  await expect.poll(() => space.saved("Page")).toContain("Fix");
  await expect(page.locator(".swd-table tbody tr")).toHaveCount(1);
  // The block written and drawn anew: the panel open, the field focused, the caret at its end: what is typed goes on there
  await expect(name).toBeFocused();
  await page.keyboard.type(" lo", { delay: 40 });
  await expect.poll(() => space.saved("Page")).toContain("Fix lo");
  await expect(name).toHaveValue("Fix lo");
  await expect(page.locator(".swd-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(0);
  // Typed fast, past several writes: nothing typed lost, nothing of it in the page's text but the block's condition
  await name.press("End");
  await page.keyboard.type("gin and more words typed quickly", { delay: 15 });
  await expect.poll(() => space.saved("Page")).toContain("Fix login and more words typed quickly");
  await expect(name).toHaveValue("Fix login and more words typed quickly");
  // A pause just long enough for a write, then keys at once, as the block is drawn anew: none of them lost
  for (const key of ["!", "?"]) {
    await page.keyboard.type(key);
    await page.waitForTimeout(330);
  }
  await page.keyboard.type("#");
  await expect.poll(() => space.saved("Page")).toContain("typed quickly!?#");
  await expect(name).toHaveValue("Fix login and more words typed quickly!?#");
  await expect(name).toBeFocused();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect.poll(() => space.saved("Page")).toBe('# Page\n\n```silverware-database\nid: tasks\nview: table\ntable.filter: {"name":"Fix login and more words typed quickly"}\n```\n');
});

test("a property hidden under Visible properties is kept in the view's block, shown by no column of it, the filter still offering it", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await expect(page.locator(".swd-table th")).toContainText(["Name", "Status"]);
  await page.locator(".swd-more").click();
  await choose(page, "Visible properties");
  await page.locator('.swd-shown-row[data-property="status"] .swd-shown-eye').click();
  await expect.poll(() => space.saved("Page")).toContain('table.hiddenProperties: ["status"]');
  // (The menu stays open through the block's write, the eye now off)
  await expect(page.locator('.swd-shown-row[data-property="status"] .swd-shown-eye')).toHaveAttribute("aria-pressed", "false");
  // Given to the block's other views, as each keeps it: the list's hidden ones; the calendar, keeping those shown, none
  // shown (the database's one property hidden): nothing kept for it
  await choose(page, "Apply to all views");
  await expect.poll(() => space.saved("Page")).toContain('list.hiddenProperties: ["status"]');
  expect(await space.saved("Page")).not.toContain("calendar.shownProperties");
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-table th", { hasText: "Status" })).toHaveCount(0);
  expect(await space.saved("Page/db-tasks")).not.toContain("hidden");
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
  await choose(page, "Properties");
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('[data-property="status"] .swd-property-required input').click();
  await expect(page.locator('[data-property="status"] .swd-prop-required')).toHaveText("*");
  await page.locator(".swd-properties-save").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("required: true");
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
  await choose(page, "Properties");
  await page.locator('[data-property="status"] .swd-prop-head').click();
  const names = page.locator('[data-property="status"] .swd-option-name');
  await names.nth(0).fill("Done");
  await names.nth(1).fill("Todo");
  await page.locator(".swd-properties-save").click();
  await expect(page.locator(".swd-property-review")).toContainText("1 item: Todo → Done");
  await expect(page.locator(".swd-property-review")).toContainText("1 item: Done → Todo");
  await expect(page.locator(".swd-property-review")).toContainText("Writes 3 pages, one after another");
  // Nothing written until applied
  expect(await space.saved("Page/db-tasks/Fix login")).toContain("status: Todo\n");
  await page.locator(".swd-property-apply").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("options: [Done, Todo]");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Done\n");
  await expect.poll(() => space.saved("Page/db-tasks/Write docs")).toContain("status: Todo\n");
  // (The dialog stays open while the change is written: closed once it is)
  await expect(page.locator(".swd-properties")).toHaveCount(0);
  await expect(page.locator('td[data-key="status"] .swd-pill')).toHaveText(["Done", "Todo"]);
  // Undo puts the options and every value back in one step
  await page.locator(".swd-undo").click();
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Todo\n");
  await expect.poll(() => space.saved("Page/db-tasks/Write docs")).toContain("status: Done\n");
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("options: [Todo, Done]");
  await expect(page.locator(".swd-undo")).toHaveAttribute("aria-busy", "false");
});

test("a select's Multiple turned on in Properties writes it into the root page and each item's option as a list of it, edited by its boxes", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await choose(page, "Properties");
  await page.locator('[data-property="status"] .swd-prop-head').click();
  await page.locator('[data-property="status"] .swd-property-setting[data-param="multiple"] input').click();
  await page.locator(".swd-properties-save").click();
  await page.locator(".swd-property-apply").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("multiple: true");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: [Todo]");
  // Edited by its boxes now, one ticked more written as a list of both
  await page.locator('tbody tr:first-child td[data-key="status"]').click();
  await page.locator('tbody tr:first-child td[data-key="status"] input[type=checkbox][value="Done"]').check();
  await page.keyboard.press("Enter");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: [Todo, Done]");
});

test("the peek marks a property the view it was opened from hides, every property still listed and edited there", async ({ page, space }) => {
  await space.open({ Page: '# Page\n\n```silverware-database\nid: tasks\nview: table\ntable.hiddenProperties: ["status"]\n```\n', ...TASKS }, "Page");
  await expect(page.locator(".swd-table th", { hasText: "Status" })).toHaveCount(0);
  const row = page.locator(".swd-table tbody tr").first();
  await row.locator(".swd-table-name").hover();
  await row.locator(".swd-open").click();
  const status = page.locator('.swd-peek .swd-peek-row[data-property="status"]');
  await expect(status).toHaveClass(/swd-peek-hidden/);
  await expect(status.locator(".swd-peek-hidden-mark")).toHaveAttribute("title", "Hidden in Table");
  // Edited as any other, the mark kept as the panel is drawn anew
  await status.locator(".swd-peek-value").click();
  await status.locator("select").selectOption("Done");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Done");
  await expect(status).toHaveClass(/swd-peek-hidden/);
});

test("a person shows as a mention, kept by the name alone, picked from its people; with Anyone a name none of them shows as valid", async ({ page, space }) => {
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    owner: { type: person, label: Owner, options: [ada, bob] }\n---\n";
  const owned = (owner: string, rank: string) => `---\ntags: [db]\nowner: ${owner}\n_database:\n  rank: ${rank}\n---\n`;
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", "Page/db-tasks": rootPage, "Page/db-tasks/Fix login": owned("ada", "a0"), "Page/db-tasks/Write docs": owned("eve", "a1") }, "Page");
  const cell = (row: number) => page.locator(`.swd-table tbody tr:nth-child(${row}) td[data-key="owner"]`);
  await expect(cell(1).locator(".swd-pill")).toHaveText("@ada");
  await expect(cell(2).locator(".swd-pill")).toHaveClass(/swd-pill-none/);
  await cell(1).click();
  await expect(cell(1).locator("select option")).toHaveText(["", "@ada", "@bob"]);
  await cell(1).locator("select").selectOption("bob");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("owner: bob\n");
  // Anyone turned on in Properties: Eve valid, written into the root page
  await page.locator(".swd-more").click();
  await choose(page, "Properties");
  await page.locator('[data-property="owner"] .swd-prop-head').click();
  await page.locator('[data-property="owner"] .swd-property-setting[data-param="anyone"] input').click();
  await page.locator(".swd-properties-save").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("anyone: true");
  await expect(cell(2).locator(".swd-pill")).toHaveText("@eve");
  await expect(cell(2).locator(".swd-pill")).not.toHaveClass(/swd-pill-none/);
  // Its editor now a field taking any name, offering the people
  await cell(1).click();
  const field = cell(1).locator("input.swd-editor-typed");
  await expect(field).toHaveValue("@bob");
  await field.fill("@zoe");
  await field.press("Enter");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("owner: zoe\n");
});
