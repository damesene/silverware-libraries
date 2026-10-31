/// <reference types="node" />
// What the tags' interaction tests share: the sample space opened, a command
// run, a page's text read.
//
// Against one of two targets (SW_TARGET, set by playwright.config.ts), as the
// table's and the toolbar's tests:
// - playground: the tags playground (a space of pages in memory, the page open
//   the one shown; its pages start from the sample in each test's browser
//   context).
// - silverbullet: a real SilverBullet with the committed silverware-tags.js
//   deployed: the sample's pages written into its worker's space under
//   UiTags/ before the test (indexed as SilverBullet finds them), removed
//   after; commands run as its client runs them.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { SAMPLE_PAGES } from "../../playground/tags-sample.ts";
import { silverbulletServer } from "../../scripts/silverbullet-servers.ts";

export { expect };

const target = process.env.SW_TARGET === "silverbullet" ? "silverbullet" : "playground";
export const onSilverBullet = target === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");

// The sample's pages there: in a folder of their own, so a test's tree of pages is theirs
const FOLDER = "UiTags";
/** A sample page's name in the space the tests run against */
export const pageName = (name: string): string => (onSilverBullet ? `${FOLDER}/${name}` : name);

type Window = { playgroundTags?: { runCommand(name: string): Promise<void>; space: { pages: Map<string, string> } }; client?: { runCommandByName(name: string): Promise<void> } };

/** Tests get `page` with the sample space open (its index page); an error in the page fails the test */
export const test = base.extend({
  baseURL: async ({ baseURL }, use) => {
    await use(onSilverBullet ? `http://127.0.0.1:${server().port}/` : baseURL);
  },
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    try {
      if (onSilverBullet) {
        await rm(join(server().space, FOLDER), { recursive: true, force: true });
        for (const [name, text] of Object.entries(SAMPLE_PAGES)) {
          const path = join(server().space, `${pageName(name)}.md`);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, text);
        }
        await page.goto(`/${pageName("index")}`);
        await page.waitForFunction(() => !!(window as unknown as Window).client);
      } else {
        await page.goto("/tags.html");
        await page.waitForFunction(() => !!(window as unknown as Window).playgroundTags);
      }
      await use(page);
      expect(errors, "errors in the page").toEqual([]);
    } finally {
      if (onSilverBullet) {
        await page.close();
        await rm(join(server().space, FOLDER), { recursive: true, force: true });
        // The settings a test saved go with it (CONFIG, written once the page is closed)
        await writeFile(join(server().space, "CONFIG.md"), "");
      }
    }
  },
});

/** Runs a command by its name, as SilverBullet's command palette runs it */
export async function command(page: Page, name: string): Promise<void> {
  // SilverBullet defines the library page's commands once its Space Lua has loaded (after the client is there):
  // waited for as its client finds a command (its view state, else its command hook)
  if (onSilverBullet)
    await page.waitForFunction(
      (name) => {
        const c = (window as unknown as { client?: { ui?: { viewState?: { commands?: Map<string, unknown> } }; clientSystem?: { commandHook?: { buildAllCommands?(): Map<string, unknown> } } } }).client;
        return !!(c?.ui?.viewState?.commands?.has(name) || c?.clientSystem?.commandHook?.buildAllCommands?.().has(name));
      },
      name,
      { timeout: 30_000 },
    );
  await page.evaluate((name) => {
    const w = window as unknown as Window;
    void (w.playgroundTags ? w.playgroundTags.runCommand(name) : w.client!.runCommandByName(name));
  }, name);
}

/** A sample page's text as it is now */
export async function pageText(page: Page, name: string): Promise<string> {
  if (onSilverBullet) return (await readFile(join(server().space, `${pageName(name)}.md`), "utf8").catch(() => "")).replace(/\r\n/g, "\n");
  return page.evaluate((name) => (window as unknown as Window).playgroundTags!.space.pages.get(name) ?? "", name);
}

/** Pages added to the sample (by their names in it) */
export async function addPages(page: Page, pages: Readonly<Record<string, string>>): Promise<void> {
  if (onSilverBullet) {
    for (const [name, text] of Object.entries(pages)) {
      const path = join(server().space, `${pageName(name)}.md`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text);
    }
    return;
  }
  await page.evaluate((pages) => {
    for (const [name, text] of Object.entries(pages)) (window as unknown as Window).playgroundTags!.space.pages.set(name, text);
  }, pages);
}

/** Opens a sample page (the page open in the editor) */
export async function openPage(page: Page, name: string): Promise<void> {
  if (onSilverBullet) await page.goto(`/${pageName(name)}`);
  else await page.locator(`#pages [data-page="${name}"]`).click();
}

/** The window open by tag, its tags listed (SilverBullet's index caught up with the sample's pages: the tag shown) */
export async function openManager(page: Page, tag: string): Promise<Locator> {
  const manager = page.locator(".swg-workspace");
  await expect(async () => {
    if (!(await manager.isVisible())) await command(page, "Silverware Tags: Manager");
    await expect(manager).toBeVisible({ timeout: 2000 });
    if (!(await manager.locator(`[data-swg-tag="${tag}"]`).isVisible())) {
      // Not indexed yet: opened again
      await manager.locator(".swg-dialog-close").click();
      throw new Error(`${tag} not listed yet`);
    }
  }).toPass({ timeout: onSilverBullet ? 30_000 : 5_000 });
  return manager;
}

/**
 * The tags' panel open (SilverBullet's navigator by its command; the
 * playground's always shows) and its row of a tag, by its path as both draw it
 * (`data-path`); a sample's tags shown (SilverBullet's index caught up)
 */
export async function panelRow(page: Page, tag: string): Promise<Locator> {
  const row = page.locator(onSilverBullet ? `.sb-nav-row[data-path="${tag}"]` : `#tags-panel .row[data-path="${tag}"]`);
  await expect(async () => {
    if (onSilverBullet && !(await row.isVisible())) await command(page, "Silverware Tags: Tags panel");
    await expect(row).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: onSilverBullet ? 30_000 : 5_000 });
  return row;
}

/** One of a panel row's actions run: its button (shown as the pointer is over the row), by its label */
export async function panelAction(page: Page, row: Locator, label: string): Promise<void> {
  await row.hover();
  await row.getByRole("button", { name: label }).click();
}
