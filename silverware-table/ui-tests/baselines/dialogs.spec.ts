// Rendering baselines of Silverware Table's dialogs (docs/silverware-core-work.md, step S, item 5): its settings, a
// column's conditional formatting and choices, a pivot, a view and the functions offered to it, a result of several
// values, Export to Excel; each opened in its theme on a desktop and a phone, the way a user there opens it (a hover,
// a right click and clicks; a tap, a long press and taps), its DOM, its look and its place in the window
// (scripts/ui-test-baselines.ts `recordParts`; written anew only by SW_BASELINES=update). Each starts on a page of its
// own (`startingOn`), not the shared sample. Against SilverBullet alone, as every baseline.
import type { Locator, Page } from "@playwright/test";
import { type Part, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { bodyRows, cell, expect, header, hoverCell, longPress, menu, startingOn, table, tap, target, test } from "../helpers.ts";

test.skip(target !== "silverbullet", "baselines are SilverBullet's (the playground draws otherwise)");

type Args = { page: Page };

// What a dialog of the shared frame shows: its box, title, close, and its foot's buttons; its font SilverBullet's
// interface's
const FRAME = { dialog: "", title: "h2", close: ".swt-dialog-close", primary: ".swt-dialog-foot .swt-dialog-primary", button: ".swt-dialog-foot .swt-dialog-button" };
const FONT = "Inter";

// The pages the dialogs start on: two small named tables (a pivot's or a view's sources), a column of scores, a
// column of choices, a result of several values (its formula written), a table to export
const FRUIT = startingOn("# Dialogs\n\n| Name | Qty |\n|---|--:|\n| Pear | 3 |\n| Fig | 5 |\n| <meta core.table core.name='fruit'> |\n\n| Town | People |\n|---|--:|\n| Brno | 400 |\n| <meta core.table core.name='towns'> |\n");
const SCORES = startingOn("| Item | Score |\n|---|---|\n| Pear | 10 |\n| Fig | 60 |\n| Kiwi | 90 |\n");
const CHOICES = startingOn(`| Task | Status #choice-status |\n|---|---|\n| A | done |\n| B | open |\n| <meta core.table columntypes.choice.status='["open","in progress","done"]'> |\n`);
const SPILL = startingOn("| Tag | List |\n|---|---|\n| b | \\#SPILL! <meta formulas.f='=SORT(UNIQUE([tag]))'> |\n| a | |\n| b | |\n");
const SHOP = startingOn("# Shop\n\n| Fruit | Qty |\n|---|--:|\n| Pear | 3 |\n| Apple | 10 |\n| <meta core.table core.name='shop'> |\n");

/** Whether the page is a phone's (a touch screen: no hover, a long press for a menu) */
const onPhone = (page: Page) => page.evaluate(() => matchMedia("(pointer: coarse)").matches);

/** A press as a user makes it: a click, a tap on a phone */
async function press(page: Page, target: Locator): Promise<void> {
  if (await onPhone(page)) await tap(page, target);
  else await target.click();
}

/** The table's toolbar shown on a cell: by a hover, by a tap on a phone */
async function barOn(page: Page, target: Locator): Promise<Locator> {
  if (await onPhone(page)) await tap(page, target);
  else await hoverCell(page, target);
  const bar = page.locator(".swt-bar.swt-visible");
  await expect(bar).toBeVisible();
  return bar;
}

/** An action of the toolbar: its icon where it is there, else its entry in the ⋯ menu */
async function barAction(page: Page, label: string): Promise<void> {
  const bar = await barOn(page, cell(page, 1, 0));
  const icon = bar.locator(`button[aria-label="${label}"]`);
  if (await icon.count()) return press(page, icon);
  await press(page, bar.locator(".swt-bar-more"));
  await press(page, menu(page).locator(".swt-menu-item").filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first());
}

/** A column's or a cell's menu, as a user opens it: a right click, a long press on a phone */
async function menuOf(page: Page, target: Locator): Promise<void> {
  if (await onPhone(page)) await longPress(page, target);
  else await target.click({ button: "right" });
  await expect(menu(page)).toBeVisible();
}

/** The dialog of this class shown, given */
async function shown(page: Page, selector: string): Promise<Locator> {
  const dialog = page.locator(selector);
  await expect(dialog).toBeVisible();
  return dialog;
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  settings: {
    details: FRUIT,
    open: async ({ page }) => {
      await expect(bodyRows(page)).toHaveCount(2);
      await barAction(page, "Silverware Table settings…");
      return shown(page, ".swt-settings");
    },
    // (Its frame's own buttons)
    parts: { dialog: "", title: "h2", close: ".swt-settings-close", tab: ".swt-settings-tab", save: ".swt-settings-save", cancel: ".swt-settings-cancel" },
    font: FONT,
    place: () => ({}),
  },
  conditions: {
    details: SCORES,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
      await menuOf(page, header(page, 1));
      await press(page, menu(page).locator(".swt-menu-item", { hasText: /^Conditional formatting/ }));
      await press(page, menu(page).locator(".swt-menu-item", { hasText: "Greater than…" }));
      return shown(page, ".swt-cf-dialog");
    },
    parts: FRAME,
    font: FONT,
    place: () => ({}),
  },
  choices: {
    details: CHOICES,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(2);
      await menuOf(page, header(page, 1));
      await press(page, menu(page).getByTitle("Edit the column's choices"));
      return shown(page, ".swt-choices-dialog");
    },
    parts: FRAME,
    font: FONT,
    place: () => ({}),
  },
  pivot: {
    details: FRUIT,
    open: async ({ page }) => {
      await expect(bodyRows(page)).toHaveCount(2);
      await barAction(page, "Insert pivot table…");
      return shown(page, ".swt-pivot-dialog");
    },
    parts: { ...FRAME, preview: ".swt-pivot-table" },
    font: FONT,
    place: () => ({}),
  },
  view: {
    details: FRUIT,
    open: async ({ page }) => {
      await expect(bodyRows(page)).toHaveCount(2);
      await barAction(page, "Insert view…");
      return shown(page, ".swt-view-dialog");
    },
    parts: { ...FRAME, field: 'input[aria-label="Formula"]' },
    font: FONT,
    place: () => ({}),
  },
  functions: {
    details: FRUIT,
    open: async ({ page }) => {
      await expect(bodyRows(page)).toHaveCount(2);
      await barAction(page, "Insert view…");
      const view = await shown(page, ".swt-view-dialog");
      await view.locator('input[aria-label="Formula"]').fill("=");
      await press(page, view.locator('button[aria-label="Functions"]'));
      return shown(page, ".swt-functions-dialog");
    },
    parts: FRAME,
    font: FONT,
    place: () => ({}),
  },
  result: {
    details: SPILL,
    open: async ({ page }) => {
      await expect(cell(page, 2, 0)).toHaveText("a");
      // Over the window: on a desktop by its ⤢ on the cell hovered; on a phone, which hovers nothing, from the cell's
      // menu (a long press), Show result
      if (await onPhone(page)) {
        await menuOf(page, cell(page, 1, 1));
        await press(page, menu(page).locator(".swt-menu-item", { hasText: /^Show result/ }));
      } else {
        await cell(page, 1, 1).hover();
        await page.locator(".swt-result-button").click();
      }
      return shown(page, ".swt-result-dialog");
    },
    // (Nothing to save: its close alone)
    parts: { dialog: "", title: "h2", close: ".swt-dialog-close", size: ".swt-result-size" },
    font: FONT,
    place: () => ({}),
  },
  excel: {
    details: SHOP,
    open: async ({ page }) => {
      await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(2);
      await barAction(page, "Export to Excel…");
      return shown(page, ".swt-excel-dialog");
    },
    // (Its Download in its body, not its foot)
    parts: { ...FRAME, primary: ".swt-excel-option .swt-dialog-primary" },
    font: FONT,
    place: () => ({}),
  },
};

recordParts(test, (title, body, details) => test(title, details, ({ page }) => body({ page })), PARTS);
