// Rendering baselines of Silverware Database's dialogs, menus and popovers not in overlays.spec.ts
// (docs/silverware-core-work.md, step S, item 5): its settings, a Properties save's conflict, Delete database, the ⋯
// menu's Visible properties and Group submenus, the view picker's and the sort's menus, and the peek's icon and colour
// popovers; each opened in its theme on a desktop and a phone as a user there opens it (clicks; taps: the database has
// no long press), its DOM, its look and its place (in the window, or against what it opened from)
// (scripts/ui-test-baselines.ts `recordParts`; written anew only by SW_BASELINES=update); and a draft of Properties
// told of a change made elsewhere (known); the Visible properties menu through an eye pressed (known: drawn anew).
import type { Locator, Page } from "@playwright/test";
import { keptThrough, type Part, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { expect, expectNoPageErrorsYet, fieldReady, press, runCommand, type Space, test } from "../helpers.ts";
import { type Args, BLOCK, choose, DOM, FONT, FRAME, ICON_POP, iconFound, MENU, moreMenu, openMenu, propertiesOpen, TASKS, TWO } from "./parts.ts";

/** The peek on Fix login (one opened before the editor loaded keeps a plain field: opened again) */
async function openPeek(page: Page, space: Space): Promise<Locator> {
  await space.open({ Page: BLOCK("list"), ...TASKS }, "Page");
  const peek = page.locator(".swd-peek");
  await expect(async () => {
    if (await peek.count()) await page.keyboard.press("Escape");
    await expect(peek).toHaveCount(0, { timeout: 3000 });
    await press(page, page.locator(".swd-list-name", { hasText: "Fix login" }));
    await expect(peek.locator(".swd-peek-body .cm-content")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await expect.poll(() => fieldReady(peek.locator(".swd-peek-body"))).toBe(true);
  return peek;
}

/**
 * Properties open, Status renamed State in its draft, and meanwhile Status renamed Phase elsewhere: its root page
 * written by the client, as another would, the place showing it
 */
async function propertiesChangedElsewhere(page: Page, space: Space): Promise<void> {
  await propertiesOpen(page, space);
  await press(page, page.locator('[data-property="status"] .swd-prop-head'));
  await page.locator('[data-property="status"] .swd-property-label').fill("State");
  await expect(page.locator(".swd-properties-note")).toHaveText("Not saved yet");
  type Client = { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } };
  const changed = TASKS["Page/db-tasks"].replace("label: Status", "label: Phase");
  await page.evaluate(([name, text]) => (window as unknown as { client: Client }).client.clientSystem.localSyscall("space.writePage", [name, text]), [`${space.folder}/Page/db-tasks`, changed] as const);
  await expect(page.locator(".swd-table th").nth(1)).toHaveText("Phase");
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  settings: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
      // (A command alone opens it, on either device)
      await runCommand(page, "Silverware Database: Settings");
      const dialog = page.locator(".swd-settings").filter({ has: page.locator(".swd-settings-tabs") });
      await expect(dialog).toBeVisible();
      return dialog;
    },
    // (The panel shown: the others are hidden, their boxes none)
    parts: { ...FRAME, tab: ".swd-settings-tab", card: ".swd-settings-panel:not([hidden]) .swd-settings-card", row: ".swd-settings-panel:not([hidden]) .swd-settings-row", number: '.swd-settings-panel:not([hidden]) input[type="number"]' },
    font: FONT,
    place: () => ({}),
  },
  settingsViews: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
      await runCommand(page, "Silverware Database: Settings");
      const dialog = page.locator(".swd-settings").filter({ has: page.locator(".swd-settings-tabs") });
      await press(page, dialog.locator('[data-swd-tab="views"]'));
      await expect(dialog.locator('[data-swd-panel="views"]')).toBeVisible();
      return dialog;
    },
    parts: { ...FRAME, tab: ".swd-settings-tab", card: ".swd-settings-panel:not([hidden]) .swd-settings-card", row: ".swd-settings-panel:not([hidden]) .swd-settings-row", switch: ".swd-settings-panel:not([hidden]) .swd-settings-switch" },
    font: FONT,
    place: () => ({}),
  },
  conflict: {
    open: async ({ page, space }) => {
      await propertiesChangedElsewhere(page, space);
      // Saved: refused, its conflict offered, then shown
      await press(page, page.locator(".swd-properties-save"));
      await press(page, page.locator(".swd-properties-conflict"));
      const dialog = page.locator(".swd-settings.swd-conflict");
      await expect(dialog).toBeVisible();
      // (Its preview read: "Reading…" till then)
      await expect(dialog.locator(".swd-conflict-diffs")).not.toContainText("Reading");
      return dialog;
    },
    // (Not its document's box: it holds the page's name, the test's folder in it, its length the test's title's; what
    // lies under it moves with it, the same for each run of a test: helpers.ts names the folder by the title alone)
    parts: { ...FRAME, section: ".swd-conflict-section", diff: ".swd-diff" },
    font: FONT,
    place: () => ({}),
  },
  deleteDatabase: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
      await moreMenu(page);
      await choose(page, "Delete database…");
      const dialog = page.locator(".swd-settings.swd-delete-database");
      // (Its pages read: their lines and the field for its name shown then)
      await expect(dialog.locator(".swd-delete-ask")).toBeVisible();
      return dialog;
    },
    // (Not its lines' box: they name its pages, the test's folder in them, its length the test's title's; what lies
    // under them moves with them, the same for each run of a test: helpers.ts names the folder by the title alone)
    parts: { ...FRAME, field: ".swd-delete-name" },
    font: FONT,
    place: () => ({}),
  },
  shownMenu: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("table"), ...TASKS, "Page/db-tasks": TWO }, "Page");
      await moreMenu(page);
      await choose(page, "Visible properties");
      const menu = await openMenu(page);
      await expect(menu.locator(".swd-shown-row")).toHaveCount(2);
      return menu;
    },
    parts: { ...MENU, back: ".swd-menu-back", row: ".swd-shown-row", eye: ".swd-shown-eye" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-more") }),
  },
  groupMenu: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("board"), ...TASKS, "Page/db-tasks": TWO }, "Page");
      await expect(page.locator(".swd-board-column")).toHaveCount(2);
      await moreMenu(page);
      await choose(page, "Group");
      const menu = await openMenu(page);
      await expect(menu.locator(".swd-group-row")).toHaveCount(2);
      return menu;
    },
    parts: { ...MENU, back: ".swd-menu-back", row: ".swd-group-row", grip: ".swd-group-grip", eye: ".swd-group-eye" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-more") }),
  },
  groupByMenu: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("board"), ...TASKS, "Page/db-tasks": TWO }, "Page");
      await expect(page.locator(".swd-board-column")).toHaveCount(2);
      await moreMenu(page);
      await choose(page, "Group");
      await choose(page, "Group by");
      const menu = await openMenu(page);
      // (A board is grouped always: its properties alone offered, no None)
      await expect(menu.locator('[role="menuitemcheckbox"] .swd-label')).toHaveText(["Status", "Area"]);
      return menu;
    },
    parts: { ...MENU, back: ".swd-menu-back" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-more") }),
  },
  viewMenu: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
      await press(page, page.locator(".swd-view-picker"));
      const menu = await openMenu(page);
      // (The test's own views too, Names and Count, defined by its space's Space Lua)
      await expect(menu.locator('[role="menu"][aria-label="Views"] .swd-menu-item .swd-label')).toHaveText(["Table", "List", "Board", "Calendar", "Timeline", "Names", "Count"]);
      return menu;
    },
    parts: MENU,
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-view-picker") }),
  },
  sortMenu: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
      await press(page, page.locator(".swd-sort-button"));
      const menu = await openMenu(page);
      await expect(menu.locator('[role="menu"][aria-label="Sort"]')).toHaveCount(1);
      return menu;
    },
    parts: MENU,
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-sort-button") }),
  },
  iconPopover: {
    open: async ({ page, space }) => {
      const peek = await openPeek(page, space);
      await press(page, peek.locator(".swd-peek-icon"));
      const pop = page.locator('.swd-pop[aria-label="Icon"]');
      await iconFound(pop);
      return pop;
    },
    parts: ICON_POP,
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-peek-icon") }),
  },
  colorPopover: {
    open: async ({ page, space }) => {
      const peek = await openPeek(page, space);
      await press(page, peek.locator(".swd-peek-color"));
      const pop = page.locator('.swd-pop[aria-label="Color"]');
      await expect(pop.locator(".swd-peek-pop-color").first()).toBeVisible();
      return pop;
    },
    parts: { pop: "", head: ".swd-pop-head", title: ".swd-pop-title", color: ".swd-peek-pop-color", own: ".swd-peek-pop-own" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-peek-color") }),
  },
};

recordParts(test, (title, body) => test(title, ({ page, space }) => body({ page, space })), PARTS, DOM);

test("a draft of Properties made of properties changed elsewhere: told under its list before Save (known: told after Save alone)", async ({ page, space }) => {
  await propertiesChangedElsewhere(page, space);
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-27): Properties follows a change made elsewhere only as a place is drawn anew (modules/properties/index.ts placeDrawn), and a place shows a schema changed elsewhere without that, so the open draft is not marked stale and its note says \"Not saved yet\" till Save, which then refuses and offers the conflict (nothing lost); expected told as the change comes (steps 4 and 6: the core's events)");
  await expect(page.locator(".swd-properties-note")).toContainText("changed elsewhere", { timeout: 10_000 });
});

test("an eye in Visible properties pressed: the view drawn without it, the menu and its rows the same nodes, nothing put back (known: the menu drawn anew)", async ({ page, space }) => {
  await space.open({ Page: BLOCK("table"), ...TASKS, "Page/db-tasks": TWO }, "Page");
  await moreMenu(page);
  await choose(page, "Visible properties");
  const menu = await openMenu(page);
  await expect(menu.locator(".swd-shown-row")).toHaveCount(2);
  const kept = await keptThrough(menu, ".swd-shown-row", "@data-property", () => press(page, menu.locator('.swd-shown-row[data-property="area"] .swd-shown-eye')), async () => {
    await expect(menu.locator(".swd-shown-row.swd-shown-off")).toHaveCount(1);
    await expect(page.locator(".swd-table th")).toHaveText(["Name", "Status", ""]);
  });
  test.info().annotations.push({ type: "kept", description: JSON.stringify(kept) });
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-27): an eye pressed in ⋯ › Visible properties draws the menu anew whole, its rows none kept (as a view's rows are, *Known*); expected kept by the Preact conversion of the menus (step 10, checkpoint C's measure)");
  expect(kept).toEqual({ root: "kept", kept: ["area", "status"], anew: [], blinked: 0 });
});
