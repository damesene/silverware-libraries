/// <reference types="node" />
// What the interaction tests share: the sample page opened, its tables and
// cells, the page's markdown, waiting for a table rendered anew, and gestures
// Playwright has no single call for.
//
// The tests run against one of two targets (SW_TARGET, set by playwright.config.ts):
// - playground (npm run test:ui): the page that mocks SilverBullet. It bundles
//   silverware-table/src and keeps its page in localStorage only: each test's
//   browser context starts from the sample page.
// - silverbullet (npm run test:ui:sb): a real SilverBullet with the committed
//   silverware-table.js deployed (scripts/silverbullet.mjs). Each test gets a
//   page of its own in the space, the sample page written into it; the tests
//   run one at a time, as settings are the whole space's.
// The tests do not know which: what differs is here (opening the page, writing
// and reading its markdown, settings, loading the page anew). A test that only
// makes sense in the playground is tagged @playground, and skipped against
// SilverBullet.
import { readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { LONG_PRESS_MS } from "../src/core/press.ts";

export { expect };

export type Target = "playground" | "silverbullet";

export const target: Target = process.env.SW_TARGET === "silverbullet" ? "silverbullet" : "playground";

const sample = readFileSync(join(import.meta.dirname, "../../playground/sample.md"), "utf8");

/** The space SilverBullet serves (scripts/silverbullet.mjs makes it) */
const space = process.env.SW_SB_SPACE ?? "";

/** Where the test pages are in the space, each a page of its own */
const TEST_FOLDER = "UiTests";

/** A page in the space holding the settings a test gives with `setSettings` */
const SETTINGS_PAGE = `${TEST_FOLDER}/Settings`;

/**
 * Errors SilverBullet itself logs in the browser's console that are not
 * Silverware Table's: the `page` fixture fails a test on any other. Each with
 * why it is not a failure.
 */
const SILVERBULLET_CONSOLE_NOISE: readonly RegExp[] = [];

/** The settings a test gave, by its page: a later `setSettings` adds to them */
const settingsOf = new WeakMap<Page, Record<string, Setting>>();

type Setting = string | number | boolean;

/** The SilverBullet client of the page, as SilverBullet's own end-to-end tests reach it */
type Client = {
  editorView: {
    state: { doc: { length: number; toString(): string } };
    dispatch(spec: { changes: { from: number; to: number; insert: string } }): void;
  };
  ui: { viewState: { unsavedChanges: boolean } };
  widgetsReady?: Promise<unknown>;
};

/**
 * Tests get `page` open on the sample page, Silverware Table on its tables.
 * An error in the page (thrown or logged) fails the test; a test that fails
 * gets what the browser's console said, attached to its report.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    const log: string[] = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      log.push(`[pageerror] ${e.message}`);
    });
    page.on("console", (m) => {
      log.push(`[${m.type()}] ${m.text()}`);
      if (m.type() !== "error") return;
      if (target === "silverbullet" && SILVERBULLET_CONSOLE_NOISE.some((noise) => noise.test(m.text()))) return;
      errors.push(m.text());
    });
    const name = `${TEST_FOLDER}/${testInfo.testId}`;
    let failed = false;
    try {
      if (target === "silverbullet") {
        await writePage(name, sample);
        await page.goto(`/${name}`);
      } else {
        await page.goto("/");
      }
      await ready(page);
      await use(page);
      expect(errors, "errors in the page").toEqual([]);
    } catch (e) {
      failed = true;
      throw e;
    } finally {
      if ((failed || testInfo.status !== testInfo.expectedStatus) && log.length) {
        await testInfo.attach("browser console", { body: log.join("\n"), contentType: "text/plain" });
      }
      if (target === "silverbullet") {
        // Closed first, so the page saves nothing after it is gone
        await page.close();
        await rm(join(space, `${name}.md`), { force: true });
        await rm(join(space, `${SETTINGS_PAGE}.md`), { force: true });
      }
    }
  },
});

/** Writes a page into SilverBullet's space, as an edit outside SilverBullet would */
async function writePage(name: string, text: string): Promise<void> {
  const path = join(space, `${name}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

/** Waits for the page loaded: in SilverBullet its editor and widgets, then (both) its first table enhanced */
async function ready(page: Page): Promise<void> {
  if (target === "silverbullet") {
    await expect(page.locator("#sb-editor .cm-editor")).toBeVisible();
    await page.waitForFunction(() => !!(window as unknown as { client?: Client }).client);
    await page.evaluate(() => (window as unknown as { client: Client }).client.widgetsReady);
  }
  await expect(table(page)).toBeVisible();
}

/**
 * Makes the page's markdown `text`, as typed over the whole page, and leaves
 * the focus nowhere: the tables are rendered from it, as after any edit
 */
export async function setPage(page: Page, text: string): Promise<void> {
  if (target === "silverbullet") {
    await page.evaluate((text) => {
      const view = (window as unknown as { client: Client }).client.editorView;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    }, text);
  } else {
    await page.evaluate((text) => {
      const source = document.querySelector<HTMLTextAreaElement>("#source")!;
      source.value = text;
      source.dispatchEvent(new Event("input", { bubbles: true }));
    }, text);
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Changes the first `search` in the page's markdown to `replacement`, as another client (or a formula elsewhere) would */
export async function replaceInPage(page: Page, search: string, replacement: string): Promise<void> {
  const text = await markdown(page);
  const at = text.indexOf(search);
  if (at < 0) throw new Error(`"${search}" is not in the page`);
  if (target === "silverbullet") {
    await page.evaluate(
      ({ at, length, replacement }) =>
        (window as unknown as { client: Client }).client.editorView.dispatch({ changes: { from: at, to: at + length, insert: replacement } }),
      { at, length: search.length, replacement },
    );
  } else {
    await page.evaluate(
      ({ at, length, replacement }) => {
        const source = document.querySelector<HTMLTextAreaElement>("#source")!;
        source.value = source.value.slice(0, at) + replacement + source.value.slice(at + length);
        source.dispatchEvent(new Event("input", { bubbles: true }));
      },
      { at, length: search.length, replacement },
    );
  }
}

/** Loads the page anew (what was written saved first), Silverware Table on its tables again */
export async function reload(page: Page): Promise<void> {
  if (target === "silverbullet") {
    await expect.poll(() => page.evaluate(() => (window as unknown as { client: Client }).client.ui.viewState.unsavedChanges)).toBe(false);
  }
  await page.reload();
  await ready(page);
}

/**
 * Sets Silverware Table's settings (`silverware.table.…` keys) and loads the
 * page anew, as a change of settings applies. Settings given earlier in the
 * test are kept. In the playground they go to its settings store, as its
 * dialog keeps them; in SilverBullet into a page of the space, by `config.set`.
 */
export async function setSettings(page: Page, values: Record<string, Setting>): Promise<void> {
  const settings = { ...settingsOf.get(page), ...values };
  settingsOf.set(page, settings);
  if (target === "silverbullet") {
    const lines = Object.entries(settings).map(([key, value]) => `config.set(${JSON.stringify(key)}, ${JSON.stringify(value)})`);
    await writePage(SETTINGS_PAGE, `\`\`\`space-lua\n${lines.join("\n")}\n\`\`\`\n`);
  } else {
    await page.evaluate((settings) => {
      const store = JSON.parse(localStorage.getItem("silverwarePlayground.settings") ?? "{}");
      // Metadata on, as the playground starts with it
      localStorage.setItem("silverwarePlayground.settings", JSON.stringify({ "silverware.table.metadata": true, ...store, ...settings }));
    }, settings);
  }
  await reload(page);
}

/** A table enhanced by Silverware Table, by its place on the page (0: Fruit) */
export const table = (page: Page, index = 0): Locator => page.locator(".sb-table-widget.swt-table").nth(index);

/** A body cell by its row in the markdown (1 the first under the header) and its column */
export const cell = (page: Page, row: number, column: number, index = 0): Locator =>
  table(page, index).locator(`tr[data-swt-row="${row}"] > td`).nth(column);

/** A header cell */
export const header = (page: Page, column: number, index = 0): Locator => table(page, index).locator("table tr").first().locator("th, td").nth(column);

/** The body rows of a table shown */
export const bodyRows = (page: Page, index = 0): Locator => table(page, index).locator("tr[data-swt-row]");

/** A column's body cells as shown */
export const columnCells = (page: Page, column: number, index = 0): Locator => bodyRows(page, index).locator(`> td:nth-child(${column + 1})`);

/** The page's markdown, as its editor has it (SilverBullet's, or the playground's) */
export const markdown = (page: Page): Promise<string> =>
  target === "silverbullet"
    ? page.evaluate(() => (window as unknown as { client: Client }).client.editorView.state.doc.toString())
    : page.locator("#source").inputValue();

/** A notification shown (SilverBullet's flash notification, or the playground's) with this text */
export const notification = (page: Page, hasText: string | RegExp): Locator =>
  page.locator(target === "silverbullet" ? ".sb-notifications > div" : "#flash > div", { hasText });

/** Checks that the editor's navigation was asked to open a page (the playground only says it would) */
export async function expectNavigatedTo(page: Page, name: string): Promise<void> {
  if (target === "silverbullet") await expect(page).toHaveURL(new RegExp(`/${encodeURI(name)}$`));
  else await expect(notification(page, `would open ${name}`)).toBeVisible();
}

/** The open menu (Silverware Table's own: the toolbar's, a cell's, a grip's) */
export const menu = (page: Page): Locator => page.locator(".swt-menu");

export const menuTitle = (page: Page): Locator => menu(page).locator(".swt-menu-title");

/**
 * Runs `action`, which writes the table, and waits until the table is
 * rendered anew and enhanced: its <table> marked before is gone, the new one
 * has its rows numbered. What is checked after it is the new rendering's, not
 * the one the write replaced.
 */
export async function rendersAnew(page: Page, action: () => Promise<unknown>, index = 0): Promise<void> {
  await markTable(page, index);
  await action();
  await expect(page.locator("table[data-test-old]")).toHaveCount(0);
  await expect(table(page, index).locator("table:not([data-test-old]) tr[data-swt-row]").first()).toBeAttached();
}

/**
 * Lets what an action started finish (a write, a table rendered anew: a few
 * frames), so a check that nothing happened is not made before it would have
 */
export async function settled(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

/** Marks a table's <table> as rendered now: `table[data-test-old]` is gone once it is rendered anew */
export async function markTable(page: Page, index = 0): Promise<void> {
  await table(page, index).locator("table").evaluate((t) => t.setAttribute("data-test-old", ""));
}

export async function center(target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (!box) throw new Error("not laid out");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * A mouse drag from an element (its centre) to an element or a point, in
 * steps (Silverware Table follows the moves); `release` false: the button stays
 * down, for checks while dragging (then Esc or page.mouse.up())
 */
export async function drag(page: Page, from: Locator, to: Locator | { x: number; y: number }, { release = true } = {}): Promise<void> {
  const a = await center(from);
  const b = "x" in to ? to : await center(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  if (release) await page.mouse.up();
}

/** The pointer on a cell, and the grips there (the grips follow the cell hovered) */
/**
 * A table's icon by its name (Sheet view, Full screen), its toolbar shown:
 * in the toolbar's row of names (the toolbarNames setting), else in its ⋯
 * menu (the table's before its title, the sheet's in its first row), opened for it
 */
export async function tableIcon(page: Page, label: string): Promise<Locator> {
  const inBar = page.locator(`.swt-bar.swt-visible button[aria-label="${label}"]`);
  if (await inBar.count()) return inBar;
  if (!(await page.locator(".swt-menu").count())) await page.locator(".swt-bar.swt-visible .swt-bar-more").click();
  return page.locator(".swt-menu .swt-menu-item").filter({ hasText: new RegExp(`^${label}$`) });
}

export async function hoverCell(page: Page, target: Locator): Promise<void> {
  await target.hover();
  await expect(page.locator(".swt-grip.swt-visible").first()).toBeVisible();
}

/** A touch held still on an element past the core's long press, through Chrome's touch events */
export async function longPress(page: Page, target: Locator): Promise<void> {
  const { x, y } = await center(target);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  // Time is what a long press is: held a little past the threshold
  await page.waitForTimeout(LONG_PRESS_MS + 250);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** A tap on an element */
export async function tap(page: Page, target: Locator): Promise<void> {
  const { x, y } = await center(target);
  await page.touchscreen.tap(x, y);
}
