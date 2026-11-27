// What the database's baseline specs share (docs/silverware-core-work.md, step S, item 5): a small database's pages,
// a place's block, the parts a dialog's frame and a menu show, the ⋯ menu and Properties opened, the open menu and an
// entry of it pressed, an icon picker narrowed, the DOM's options. Not a spec: Playwright runs `*.spec.ts` alone.
import type { Locator, Page } from "@playwright/test";
import type { DomOptions } from "../../../scripts/ui-test-baselines.ts";
import { expect, item, press, root, type Space } from "../helpers.ts";

export type Args = { page: Page; space: Space };

export const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };
// A page showing the database in this view (its block's other lines `extra`)
export const BLOCK = (view: string, extra = "") => `# Page\n\n\`\`\`silverware-database\nid: tasks\nview: ${view}\n${extra}\`\`\`\n`;
// A root of two select properties: a board grouped by one, the other offered
export const TWO = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    area: { type: select, label: Area, options: [Web, App] }\n---\n";
export const FONT = "Inter";
// What a dialog of the database's frame shows (shared/dialog.ts): its box, title, close, its foot's buttons
export const FRAME = { dialog: "", title: ".swd-settings-title", close: ".swd-settings-close", cancel: ".swd-settings-foot .swd-settings-cancel", save: ".swd-settings-foot .swd-settings-save" };
// A menu's box, its title, an entry and its label
export const MENU = { menu: "", title: ".swd-menu-title", item: ".swd-menu-item", label: ".swd-menu-item .swd-label" };

/**
 * The DOM's options: Silverware Layout's marks on a widget of its left out (its own baselines keep them); an item's
 * key numbered, and the ids an element points at (the icon picker's active item, a name field's problem: made of a
 * count of those drawn in the page, not shown); the test's folder named alike in each run
 */
export const DOM: DomOptions<Args> = { omit: /^data-swl-/, opaque: ["data-item", "aria-activedescendant", "aria-describedby"], replace: ({ space }) => ({ [encodeURI(space.folder)]: "<folder>", [space.folder]: "<folder>" }) };

/** The menu open (lifted into the body), given */
export async function openMenu(page: Page): Promise<Locator> {
  const menu = page.locator(".swd-menu:visible");
  await expect(menu).toHaveCount(1);
  return menu;
}

/** The place's ⋯ menu opened, given */
export async function moreMenu(page: Page): Promise<Locator> {
  await press(page, page.locator(".swd-more"));
  return openMenu(page);
}

/** Properties opened from the ⋯ menu of a table of the database's two items */
export async function propertiesOpen(page: Page, space: Space): Promise<void> {
  await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
  await moreMenu(page);
  await choose(page, "Properties");
}

/** An entry of the menu open chosen by its label (its value after it left out), pressed */
export async function choose(page: Page, label: string): Promise<void> {
  await press(page, page.locator(".swd-menu:visible .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: new RegExp(`^${label}(:|$)`) }) }).first());
}

/** An icon picker narrowed to one icon by a name typed, drawn (every set's thousands are Silverware Icons' to record) */
export async function iconFound(pop: Locator): Promise<void> {
  await expect(pop.locator(".swi-item").first()).toBeVisible();
  await pop.locator(".swi-field").fill("rocket");
  await expect(pop.locator(".swi-item")).toHaveCount(1);
  // (Its icon drawn: one of a set still loading is drawn again once it has)
  await expect(pop.locator('[data-swi-state="pending"]')).toHaveCount(0);
}

// What an icon picker's popover shows
export const ICON_POP = { pop: "", head: ".swd-pop-head", title: ".swd-pop-title", set: ".swi-set", field: ".swi-field", icon: ".swi-item" };
