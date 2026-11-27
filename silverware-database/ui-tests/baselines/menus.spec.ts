// Rendering baselines of Silverware Database's menus not in dialogs.spec.ts (docs/silverware-core-work.md, step S,
// item 5): the ⋯ menu's Color by submenu and its title turned into the database's name's field, a calendar's Start and
// a timeline's End submenus (views/spans.ts `spanMenu`), and the ⋯ menu of a place at the bottom of SilverBullet's
// scroller, laid above its button; each opened in its theme on a desktop and a phone as a user there opens it, its
// DOM, its look and its place against what it opened from (scripts/ui-test-baselines.ts `recordParts`; written anew
// only by SW_BASELINES=update).
import { type Part, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { boxOf, expect, press, test } from "../helpers.ts";
import { type Args, BLOCK, choose, DOM, FONT, MENU, moreMenu, openMenu, TASKS, TWO } from "./parts.ts";

// A root of a select and three properties of days: a calendar's and a timeline's Start and End offered among them
const DATED = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    begins: { type: date, label: Begins }\n    due: { type: date, label: Due }\n    done_on: { type: datetime, label: Done on }\n---\n";
// A page whose place lies under forty lines: scrolled to the bottom of SilverBullet's scroller
const LOW = `# Page\n\n${Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`).join("\n")}\n\n\`\`\`silverware-database\nid: tasks\nview: table\n\`\`\`\n`;

const PARTS: Readonly<Record<string, Part<Args>>> = {
  colorByMenu: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("board"), ...TASKS, "Page/db-tasks": TWO }, "Page");
      await expect(page.locator(".swd-board-column")).toHaveCount(2);
      await moreMenu(page);
      await choose(page, "Color by");
      const menu = await openMenu(page);
      await expect(menu.locator('[role="menuitemcheckbox"] .swd-label')).toHaveText(["None", "Status", "Area"]);
      return menu;
    },
    parts: { ...MENU, back: ".swd-menu-back" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-more") }),
  },
  renameField: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
      const menu = await moreMenu(page);
      await press(page, menu.locator(".swd-menu-rename"));
      const field = menu.locator(".swd-menu-name");
      await expect(field).toBeFocused();
      await expect(field).toHaveValue("Tasks");
      return menu;
    },
    parts: { ...MENU, field: ".swd-menu-name" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-more") }),
  },
  startMenu: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("calendar"), ...TASKS, "Page/db-tasks": DATED }, "Page");
      await moreMenu(page);
      await choose(page, "Start");
      const menu = await openMenu(page);
      await expect(menu.locator('[role="menuitemcheckbox"] .swd-label')).toHaveText(["Begins", "Due", "Done on"]);
      return menu;
    },
    parts: { ...MENU, back: ".swd-menu-back" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-more") }),
  },
  endMenu: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("timeline"), ...TASKS, "Page/db-tasks": DATED }, "Page");
      await moreMenu(page);
      await choose(page, "End");
      const menu = await openMenu(page);
      await expect(menu.locator('[role="menuitemcheckbox"] .swd-label')).toHaveText(["None (a day each)", "Due", "Done on"]);
      return menu;
    },
    parts: { ...MENU, back: ".swd-menu-back" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-more") }),
  },
  lowMenu: {
    open: async ({ page, space }) => {
      await space.open({ Page: LOW, ...TASKS }, "Page");
      // The page scrolled to its end, its place drawn (CodeMirror draws only what is near the view: SilverBullet's scroller)
      const scroller = page.locator(".cm-scroller");
      await scroller.evaluate((box) => (box.scrollTop = 1e6));
      const more = page.locator(".swd-more");
      // Its button at the bottom of what the page scrolls in (no room under it for the menu; a phone's bar under that)
      await expect(async () => {
        await more.evaluate((button) => button.scrollIntoView({ block: "end" }));
        const [box, view] = [await boxOf(more), await boxOf(scroller)];
        expect(Math.abs(view.y + view.height - (box.y + box.height))).toBeLessThan(4);
      }).toPass({ timeout: 10_000 });
      const menu = await moreMenu(page);
      // (Laid above it)
      const [box, button] = [await boxOf(menu), await boxOf(more)];
      expect(box.y + box.height).toBeLessThanOrEqual(button.y);
      return menu;
    },
    parts: MENU,
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swd-more") }),
  },
};

recordParts(test, (title, body) => test(title, ({ page, space }) => body({ page, space })), PARTS, DOM);
