// Rendering baselines of what Silverware Table lays over its tables but dialogs (docs/silverware-core-work.md, step S,
// item 5): its toolbar, a cell's, a column's and the ⋯ menus, and its floating lists (a choice column's choices, a
// formula's help, a filter's bubble); each opened in its theme on a desktop and a phone as a user there opens it, its
// DOM, its look and its place against what it opened from (scripts/ui-test-baselines.ts `recordParts`; written anew
// only by SW_BASELINES=update), a cell's popup over a long text, and a list near the window's bottom, laid above its
// cell. Against SilverBullet alone, as every baseline. A fill's tip (a drag) is item 3's, left for step 6.
import type { Locator, Page } from "@playwright/test";
import { keptThrough, type Part, PHONE, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { barOn, cell, editCell, expect, expectNoPageErrorsYet, header, menu, menuOf, press, startingOn, table, target, test } from "../helpers.ts";

test.skip(target !== "silverbullet", "baselines are SilverBullet's (the playground draws otherwise)");

type Args = { page: Page };

const FONT = "Inter";
// A menu's box, its title, an entry and its label
const MENU = { menu: "", title: ".swt-menu-title", item: ".swt-menu-item", label: ".swt-menu-item .swt-label" };

// The pages they start on: a small table, a column of choices
const FRUIT = startingOn("# Menus\n\n| Name | Qty | Note |\n|---|--:|---|\n| Pear | 3 | |\n| Fig | 5 | |\n| Kiwi | 8 | |\n");
// A cell's text too long for its column (cut: its popup offered)
const LONG = startingOn(`# Long\n\n| Name | Note |\n|---|---|\n| Pear | ${"A note that goes on and on, much longer than the column it is in. ".repeat(4).trim()} |\n`);
// A column of choices: the window made as short as its row, the list laid above it
const LOW = startingOn(`# Low\n\n| Task | Status #choice-status |\n|---|---|\n| A | done |\n| <meta core.table columntypes.choice.status='["open","in progress","done"]'> |\n`);
const CHOICES = startingOn(`# Choices\n\n| Task | Status #choice-status |\n|---|---|\n| A | done |\n| B | open |\n| <meta core.table columntypes.choice.status='["open","in progress","done"]'> |\n`);

/**
 * The filter's row drawn and still: its first field the same node for 30 frames in a row (about 500 ms, more than the
 * 150 to 300 ms after which a phone draws the row again: a tap comes once a person sees it settled)
 */
async function filterRowStill(page: Page): Promise<void> {
  await expect(page.locator(".swt-filter-row input.swt-filter").first()).toBeVisible();
  await page.evaluate(async () => {
    let field = document.querySelector(".swt-filter-row input.swt-filter");
    for (let still = 0, frames = 0; still < 30; frames++) {
      if (frames > 600) throw new Error("The filter's row never settled");
      await new Promise((done) => requestAnimationFrame(done));
      const now = document.querySelector(".swt-filter-row input.swt-filter");
      still = now !== null && now === field ? still + 1 : 0;
      field = now;
    }
  });
}

/** The first column's filter opened from the toolbar and "i" typed in it, as a user does (its field given) */
async function filterTyped(page: Page): Promise<Locator> {
  await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
  const bar = await barOn(page, header(page, 0));
  await press(page, bar.locator('button[aria-label="Filter"]'));
  await filterRowStill(page);
  const field = page.locator(".swt-filter-row input.swt-filter").first();
  await press(page, field);
  await page.keyboard.type("i");
  await expect(table(page).locator("tr[data-swt-row]:not(.swt-hidden)")).toHaveCount(2);
  return field;
}

/** The long text's cell edited, its ⤢ shown (given) */
async function longCellEdited(page: Page): Promise<Locator> {
  await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(1);
  // Its ⤢, shown while a cell whose text does not fit is edited
  await editCell(page, cell(page, 1, 1));
  const expand = page.locator(".swt-expand.swt-visible");
  await expect(expand).toBeVisible();
  return expand;
}

/** The element of this selector shown, given */
async function shown(page: Page, selector: string): Promise<Locator> {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
  return element;
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  toolbar: {
    details: FRUIT,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
      return barOn(page, cell(page, 1, 0));
    },
    parts: { bar: "", button: "button", more: ".swt-bar-more" },
    font: FONT,
    // (Right-aligned to the table: its place against the table's top left follows the table's width too)
    place: ({ page }) => ({ anchor: table(page) }),
  },
  cellMenu: {
    details: FRUIT,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
      await menuOf(page, cell(page, 1, 0));
      return menu(page);
    },
    parts: MENU,
    font: FONT,
    place: ({ page }) => ({ anchor: cell(page, 1, 0) }),
  },
  columnMenu: {
    details: FRUIT,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
      await menuOf(page, header(page, 1));
      return menu(page);
    },
    parts: MENU,
    font: FONT,
    place: ({ page }) => ({ anchor: header(page, 1) }),
  },
  moreMenu: {
    details: FRUIT,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
      const bar = await barOn(page, cell(page, 1, 0));
      await press(page, bar.locator(".swt-bar-more"));
      await expect(menu(page)).toBeVisible();
      return menu(page);
    },
    parts: MENU,
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swt-bar.swt-visible .swt-bar-more") }),
  },
  choices: {
    details: CHOICES,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(2);
      await editCell(page, cell(page, 1, 1));
      const list = await shown(page, ".swt-choices");
      await expect(list.locator(".swt-choice")).toHaveText(["open", "in progress", "done"]);
      return list;
    },
    parts: { list: "", choice: ".swt-choice" },
    font: FONT,
    place: ({ page }) => ({ anchor: cell(page, 1, 1) }),
  },
  formulaHint: {
    details: FRUIT,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
      // (An empty cell: its text typed whole, nothing to take out first)
      await editCell(page, cell(page, 1, 2));
      await page.keyboard.type("=SU");
      return shown(page, ".swt-formula-hint");
    },
    parts: { hint: "" },
    font: FONT,
    // (Placed against the cell edited)
    place: ({ page }) => ({ anchor: cell(page, 1, 2) }),
  },
  cellPopup: {
    // (On a desktop alone: in Chrome's phone emulation the table scrolls to and fro a while as the cell is edited and
    // stops at either of two places, the popup's place against it and its clip with it; a real phone does not)
    devices: ["desktop"],
    details: LONG,
    open: async ({ page }) => {
      // Its ⤢ pressed
      await press(page, await longCellEdited(page));
      return shown(page, ".swt-cell-popup");
    },
    parts: { popup: "" },
    font: FONT,
    // (Laid over the cell it shows)
    place: ({ page }) => ({ anchor: cell(page, 1, 1) }),
  },
  choicesAbove: {
    details: LOW,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(1);
      // (The window's bottom a little under the row: no room for the list under it)
      const row = await cell(page, 1, 1).boundingBox();
      await page.setViewportSize({ width: page.viewportSize()!.width, height: Math.round(row!.y + row!.height + 40) });
      await editCell(page, cell(page, 1, 1));
      const list = await shown(page, ".swt-choices");
      await expect(list.locator(".swt-choice")).toHaveText(["open", "in progress", "done"]);
      // (Laid above its cell: no room under it)
      await expect(list).toHaveClass(/swt-above/);
      return list;
    },
    parts: { list: "", choice: ".swt-choice" },
    font: FONT,
    place: ({ page }) => ({ anchor: cell(page, 1, 1) }),
  },
  filterBubble: {
    details: FRUIT,
    open: async ({ page }) => {
      await filterTyped(page);
      return shown(page, ".swt-filter-bubble.swt-visible");
    },
    parts: { bubble: "" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swt-filter-row input.swt-filter").first() }),
  },
};

recordParts(test, (title, body, details) => test(title, details, ({ page }) => body({ page })), PARTS);

test("the toolbar's Filter pressed: the filter row shown, the bar and its buttons the same nodes (known: its buttons drawn anew)", FRUIT, async ({ page }) => {
  await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
  const bar = await barOn(page, cell(page, 1, 0));
  const kept = await keptThrough(bar, "button", "@aria-label", () => press(page, bar.locator('button[aria-label="Filter"]')), async () => {
    await expect(page.locator(".swt-filter-row input.swt-filter")).toHaveCount(3);
  });
  test.info().annotations.push({ type: "kept", description: JSON.stringify(kept) });
  // (What holds today: the bar itself kept, nothing put back, the same four buttons)
  expect(kept.root).toBe("kept");
  expect(kept.blinked).toBe(0);
  expect([...kept.kept, ...kept.anew].sort()).toEqual(["Edit mode", "Filter", "Lazy saving", "More"]);
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-27): the toolbar draws its buttons anew whole as the table's view changes (a button pressed: Filter; core/toolbar.ts show: replaceChildren, each button made again), the bar kept but none of its buttons; expected kept by the Preact conversion (step 10, checkpoint C's measure)");
  expect(kept.anew).toEqual([]);
});

test.describe("on a phone", () => {
  test.use(PHONE);
  test("a formula's help whole in the window (known: wider than a phone's)", FRUIT, async ({ page }) => {
    const hint = await PARTS.formulaHint!.open({ page });
    const box = (await hint.boundingBox())!;
    test.info().annotations.push({ type: "box", description: JSON.stringify({ box, window: page.viewportSize() }) });
    expectNoPageErrorsYet(page);
    test.fail(true, "Known (2026-11-27): a formula's help is wider than a phone's window (478 px in 412), its right part out of it; expected within the window once floating panels are placed by the core (step 6)");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test("a filter opened, its field tapped once its row is drawn: the focus kept there (its drawings counted)", FRUIT, async ({ page }) => {
    await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
    const bar = await barOn(page, header(page, 0));
    // The first filter field's element, each time another, frame by frame from before the filter is opened till the
    // tap: a phone draws the row twice, the second 150 to 300 ms after (Chrome's emulation; a person's tap comes later,
    // the user's phone kept the focus), a desktop once. Counted for the Preact conversion's measure, not a bug
    // (step S *Known*'s rule)
    await page.evaluate(() => {
      const state = { drawn: [] as string[], stop: false };
      (window as unknown as { swtDrawn: typeof state }).swtDrawn = state;
      let last: Element | null = null;
      const look = () => {
        const field = document.querySelector(".swt-filter-row input.swt-filter");
        if (field !== last) state.drawn.push(field ? "drawn" : "gone");
        last = field;
        if (!state.stop) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await press(page, bar.locator('button[aria-label="Filter"]'));
    await filterRowStill(page);
    const drawn = await page.evaluate(() => {
      const state = (window as unknown as { swtDrawn: { drawn: string[]; stop: boolean } }).swtDrawn;
      state.stop = true;
      return state.drawn;
    });
    test.info().annotations.push({ type: "drawn", description: JSON.stringify(drawn) });
    const field = page.locator(".swt-filter-row input.swt-filter").first();
    await press(page, field);
    await expect(field).toBeFocused();
  });
});
