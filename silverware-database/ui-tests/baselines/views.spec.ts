// Rendering baselines of a database's place and its views (docs/silverware-core-work.md, step S, item 5): the place's
// chrome and the table, list and board views, their DOM once and their look in each theme on a desktop and on a phone
// (Chrome's Pixel 7: its size, touch and pixel ratio), recorded against today's code (scripts/ui-test-baselines.ts; written anew only
// by SW_BASELINES=update); and what typing in a filter and an item changed elsewhere leave in place.
import { domOf, expectBaseline, keptThrough, PHONE, setTheme, settledLook } from "../../../scripts/ui-test-baselines.ts";
import { expect, expectNoPageErrorsYet, item, test } from "../helpers.ts";
import { BLOCK, DOM, TASKS } from "./parts.ts";

// SilverBullet's font of the page's text, which the place's text is in
const FONT = "iA-Mono";
// The place's chrome, every view's
const CHROME = {
  place: "",
  bar: ".swd-place-bar",
  name: ".swd-place-name",
  count: ".swd-place-count",
  picker: ".swd-view-picker",
  tool: ".swd-tools .swd-tool",
  body: ".swd-place-body",
};
// Each view: its items' elements, and the parts of its own whose look is kept (the first and the second item both)
const VIEWS = {
  table: {
    items: ".swd-table tbody tr",
    parts: { table: ".swd-table", head: ".swd-table thead th", row: ".swd-table tbody tr", secondRow: ".swd-table tbody tr:nth-child(2)", name: ".swd-table-name", cell: ".swd-table tbody td:nth-child(2)", pill: ".swd-pill", foot: ".swd-table-foot", add: ".swd-table-add" },
  },
  list: {
    items: ".swd-list-item",
    parts: { list: ".swd-list", item: ".swd-list-item", secondItem: ".swd-list-item:nth-child(2)", name: ".swd-list-name", value: ".swd-list-value", pill: ".swd-pill", foot: ".swd-table-foot", add: ".swd-table-add" },
  },
  board: {
    items: ".swd-board-card",
    parts: { board: ".swd-board", column: ".swd-board-column", secondColumn: ".swd-board-column:nth-child(2)", title: ".swd-board-title", count: ".swd-board-count", cards: ".swd-board-cards", card: ".swd-board-card", name: ".swd-board-name", add: ".swd-board-add" },
  },
} as const;

for (const [device, use] of [["desktop", {}], ["phone", PHONE]] as const) {
  test.describe(`on a ${device}`, () => {
    test.use(use);
    for (const [view, { items, parts }] of Object.entries(VIEWS)) {
      test(`the ${view} view: its DOM, and its look light and dark`, async ({ page, space }) => {
        await space.open({ Page: BLOCK(view), ...TASKS }, "Page");
        const place = page.locator(".swd-place");
        await expect(place.locator(items)).toHaveCount(2);
        await expectBaseline(`${view}-${device}-dom`, await domOf(place, { omit: DOM.omit, opaque: DOM.opaque }));
        for (const theme of ["light", "dark"] as const) {
          await setTheme(page, theme);
          await expectBaseline(`${view}-${device}-${theme}`, await settledLook(page, place, { ...CHROME, ...parts }, FONT));
        }
      });
    }
  });
}

test("typing in a filter: the field the same and focused, its caret at the end; the row still shown the same node (known: every row drawn anew)", async ({ page, space }) => {
  await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
  const rows = page.locator(".swd-table tbody tr");
  await expect(rows).toHaveCount(2);
  await page.locator(".swd-filter-button").click();
  const field = page.locator('.swd-filter input[data-key="name"]');
  await field.click();
  await field.evaluate((one) => one.setAttribute("data-test-field", ""));
  const place = page.locator(".swd-place");
  const kept = await keptThrough(place, ".swd-table tbody tr", ".swd-table-name", () => page.keyboard.type("Fix"), () => expect(rows).toHaveCount(1));
  await expect(page.locator('.swd-filter input[data-test-field][data-key="name"]')).toBeFocused();
  await expect.poll(() => field.evaluate((input: HTMLInputElement) => [input.value, input.selectionStart])).toEqual(["Fix", 3]);
  // (What today's code did, in the report: the claim of the mark below)
  test.info().annotations.push({ type: "kept", description: JSON.stringify(kept) });
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-26): a view is drawn anew whole as its filter is typed in, its rows put anew (el() and replaceChildren); kept by the Preact conversion of the views (step 10, checkpoint C's measure)");
  expect(kept).toEqual({ root: "kept", kept: ["Fix login"], anew: [], blinked: 0 });
});

test("an item changed elsewhere: its row shown anew, the other row the same node, nothing put back (known: every row drawn anew)", async ({ page, space }) => {
  await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
  const rows = page.locator(".swd-table tbody tr");
  await expect(rows).toHaveCount(2);
  type Client = { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } };
  const changed = item("Todo", "a1");
  const kept = await keptThrough(
    page.locator(".swd-place"),
    ".swd-table tbody tr",
    ".swd-table-name",
    () => page.evaluate(([name, text]) => (window as unknown as { client: Client }).client.clientSystem.localSyscall("space.writePage", [name, text]).then(() => undefined), [`${space.folder}/Page/db-tasks/Write docs`, changed] as const),
    () => expect(rows.filter({ hasText: "Write docs" }).locator(".swd-pill")).toHaveText("Todo"),
  );
  test.info().annotations.push({ type: "kept", description: JSON.stringify(kept) });
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-26): an item changed elsewhere draws the view anew whole, every row put anew; kept by the Preact conversion of the views (step 10, checkpoint C's measure)");
  expect(kept).toEqual({ root: "kept", kept: ["Fix login"], anew: ["Write docs"], blinked: 0 });
});
