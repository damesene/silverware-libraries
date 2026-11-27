// Rendering baselines of what a database lays over its place and of its dated views (docs/silverware-core-work.md,
// step S, item 5): the place's menu, the peek, the Properties dialog, and the calendar and timeline at a fixed day,
// their DOM and their look in each theme (each opened in it) on a desktop and a phone, recorded against today's code
// (scripts/ui-test-baselines.ts; written anew only by SW_BASELINES=update); the peek's colours after the theme is
// switched while it is open (known); and a filter written into the block, by Enter and by the field left, its focus,
// caret and the page's scroll kept through SilverBullet drawing the block anew.
import type { Locator, Page } from "@playwright/test";
import { keptThrough, type Part, recordParts, setTheme } from "../../../scripts/ui-test-baselines.ts";
import { expect, expectNoPageErrorsYet, type Space, fieldReady, item, root, test } from "../helpers.ts";

const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };
const BLOCK = (view: string, extra = "") => `# Page\n\n\`\`\`silverware-database\nid: tasks\nview: ${view}\n${extra}\`\`\`\n`;
// Silverware Layout's marks on a widget of its (its own baselines keep them)
const OTHERS = /^data-swl-/;
// The day the dated views are drawn on: a Monday, mid-month, its morning (local time: the machine's, Node's and the
// browser's alike); an item on it, one later that week, one over the weekend
const TODAY = new Date("2026-11-16T09:00:00");
const DATED_ROOT = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    due: { type: datetime, label: Due }\n    end: { type: datetime, label: End }\n---\n";
const DATED = (due: string, end: string, rank: string) => `---\ntags: [db]\nstatus: Todo\ndue: "${due}"\nend: "${end}"\n_database:\n  rank: ${rank}\n---\n`;
const DATED_PAGES = {
  "Page/db-tasks": DATED_ROOT,
  "Page/db-tasks/Standup": DATED("2026-11-16T10:00", "2026-11-16T10:15", "a0"),
  "Page/db-tasks/Sync": DATED("2026-11-18T10:00", "2026-11-18T11:00", "a1"),
  "Page/db-tasks/Trip": DATED("2026-11-20", "2026-11-23", "a2"),
};

// What its parts are opened with: the test's page and space
type Args = { page: Page; space: Space };

/** The peek on Fix login, its field the editor (one opened before the editor loaded keeps a plain field: opened again) */
async function openPeek(page: Page, space: Space): Promise<Locator> {
  await space.open({ Page: BLOCK("list"), ...TASKS, "Page/db-tasks/Fix login": `${item("Todo", "a0")}Steps to fix\n` }, "Page");
  const peek = page.locator(".swd-peek");
  await expect(async () => {
    if (await peek.count()) await page.keyboard.press("Escape");
    await expect(peek).toHaveCount(0, { timeout: 3000 });
    await page.locator(".swd-list-name", { hasText: "Fix login" }).click({ timeout: 3000 });
    await expect(peek.locator(".swd-peek-body .cm-content")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await expect.poll(() => fieldReady(peek.locator(".swd-peek-body"))).toBe(true);
  return peek;
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  menu: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
      await page.locator(".swd-more").click();
      const menu = page.locator(".swd-menu:visible");
      await expect(menu).toHaveCount(1);
      return menu;
    },
    parts: { menu: "", item: ".swd-menu-item", label: ".swd-menu-item .swd-label", separator: ".swd-menu-separator" },
    font: "Inter",
  },
  peek: {
    open: ({ page, space }) => openPeek(page, space),
    parts: { peek: "", top: ".swd-peek-top", head: ".swd-peek-head", name: ".swd-peek-name", close: ".swd-peek-close", closeX: ".swd-peek-close-x", closeBack: ".swd-peek-close-back", props: ".swd-peek-props-box", value: ".swd-peek-value", add: ".swd-peek-add-property", body: ".swd-peek-body" },
    font: "Lora",
  },
  properties: {
    open: async ({ page, space }) => {
      await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
      await page.locator(".swd-more").click();
      await page.locator(".swd-menu:visible .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^Properties$/ }) }).first().click();
      const dialog = page.locator('[role="dialog"]').filter({ has: page.locator(".swd-properties") });
      await expect(dialog).toBeVisible();
      return dialog;
    },
    parts: { dialog: "", title: "h2", body: ".swd-properties", property: ".swd-prop-head", save: ".swd-properties-save", cancel: ".swd-properties-cancel" },
    font: "Inter",
  },
  calendar: {
    open: async ({ page, space }) => {
      await page.clock.setSystemTime(TODAY);
      await space.open({ Page: BLOCK("calendar"), ...DATED_PAGES }, "Page");
      const place = page.locator(".swd-place");
      // (Every item drawn: the index may give them in turn; laid over the days' grid, not in a day's element)
      // (Today's Standup twice: on its day, and in the list of the day picked, today)
      await expect.poll(() => place.locator(".swd-cal-item").allTextContents().then((all) => all.map((one) => one.replace(/^\d\d:\d\d\s*/, "")).sort())).toEqual(["Standup", "Standup", "Sync", "Trip"]);
      return place;
    },
    parts: { place: "", day: ".swd-cal-day", today: ".swd-cal-day.swd-cal-now", item: ".swd-cal-item" },
    font: "iA-Mono",
  },
  timeline: {
    open: async ({ page, space }) => {
      await page.clock.setSystemTime(TODAY);
      await space.open({ Page: BLOCK("timeline", "timeline.endBy: end\n"), ...DATED_PAGES }, "Page");
      const place = page.locator(".swd-place");
      await expect(place.locator(".swd-tl-bar")).toHaveCount(3);
      // (Settled: laid out once its box has its width, its names folded where it is narrow, then scrolled to today)
      await expect.poll(() => place.locator(".swd-tl-box").evaluate((box) => box.scrollLeft)).toBeGreaterThan(0);
      return place;
    },
    parts: { place: "", bar: ".swd-tl-bar", row: ".swd-tl-row", head: ".swd-tl-head", today: ".swd-tl-unit.swd-tl-now", name: ".swd-tl-name" },
    font: "iA-Mono",
  },
};

recordParts(test, (title, body) => test(title, ({ page, space }) => body({ page, space })), PARTS, { omit: OTHERS, opaque: ["data-item"], replace: ({ space }) => ({ [encodeURI(space.folder)]: "<folder>", [space.folder]: "<folder>" }) });

test("the theme switched to dark with the peek open: its text in the dark theme's colour (known: kept light)", async ({ page, space }) => {
  await page.emulateMedia({ colorScheme: "light" });
  const peek = await openPeek(page, space);
  await setTheme(page, "dark");
  // The page's own text in the dark theme's colour, then the peek's alike
  const pageColour = await page.locator("#sb-main .cm-content").evaluate((one) => getComputedStyle(one).color);
  expect(pageColour).toBe("rgb(227, 229, 236)");
  const peekColour = () => peek.locator(".swd-peek-name").evaluate((one) => getComputedStyle(one).color);
  test.info().annotations.push({ type: "peek colour", description: await peekColour() });
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-26): the peek copies the editor's colour into its inline style once as it opens (host/silverbullet/platform.ts editorLook), so a theme switched while it is open leaves its text in the colour of before, dark on dark; expected to follow the theme once the peek's look is read where it is drawn (steps 6 and 10)");
  await expect.poll(peekColour, { timeout: 5_000 }).toBe(pageColour);
});

/** A page of the block under enough lines to scroll, scrolled so the block is mid-view, its filter's field typed in */
async function filterTyped(page: Page, space: Space): Promise<Locator> {
  const above = Array.from({ length: 60 }, (_, n) => `Line ${n} of the text above.`).join("\n\n");
  await space.open({ Page: `# Page\n\n${above}\n\n${BLOCK("table").replace("# Page\n\n", "")}`, ...TASKS }, "Page");
  const rows = page.locator(".swd-table tbody tr");
  // (Drawn once in view: the editor draws the lines it shows, the block under sixty of them)
  await page.locator("#sb-main .cm-scroller").evaluate((scroller) => scroller.scrollTo(0, scroller.scrollHeight));
  await expect(rows).toHaveCount(2);
  await page.locator(".swd-place").evaluate((place) => place.scrollIntoView({ block: "center" }));
  await page.locator(".swd-filter-button").click();
  const field = page.locator('.swd-filter input[data-key="name"]');
  await field.click();
  await page.keyboard.type("Fix");
  await expect(rows).toHaveText([/Fix login/]);
  return field;
}

/** The page's scroll and the field's place on the screen */
const where = (page: Page, field: Locator) =>
  Promise.all([page.locator("#sb-main .cm-scroller").evaluate((scroller) => Math.round(scroller.scrollTop)), field.evaluate((input) => Math.round(input.getBoundingClientRect().top))]);

for (const [how, write] of [
  ["Enter", (page: Page) => page.keyboard.press("Enter")],
  ["the field left", (page: Page) => page.locator(".swd-place-count").click()],
] as const) {
  test(`a filter written into the block by ${how}: the block drawn anew by SilverBullet${how === "Enter" ? ", the field focused again, its caret at the end" : ""}, the page's scroll kept`, async ({ page, space }) => {
    const field = await filterTyped(page, space);
    const before = await where(page, field);
    const rows = page.locator(".swd-table tbody tr");
    const kept = await keptThrough(page.locator(".swd-place"), ".swd-table tbody tr", ".swd-table-name", () => write(page), async () => {
      await expect.poll(() => space.saved("Page")).toContain('table.filter: {"name":"Fix"}');
    });
    // (What the write did: SilverBullet drew the block's widget anew, the place with its row)
    test.info().annotations.push({ type: "kept", description: JSON.stringify(kept) });
    expect([kept.root, kept.kept, kept.anew]).toEqual(["anew", [], ["Fix login"]]);
    await expect(rows).toHaveText([/Fix login/]);
    if (how === "Enter") {
      await expect(field).toBeFocused();
      await expect.poll(() => field.evaluate((input: HTMLInputElement) => [input.value, input.selectionStart])).toEqual(["Fix", 3]);
    }
    const after = await where(page, field);
    expect(Math.abs(after[0] - before[0]), "the page's scroll").toBeLessThanOrEqual(1);
    expect(Math.abs(after[1] - before[1]), "the field's place").toBeLessThanOrEqual(1);
  });
}
