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
import { configFile, silverbulletServer } from "../../scripts/silverbullet-servers.ts";
import { loaded, watchReloads } from "../../scripts/silverbullet-loaded.ts";
import { silverBulletsOwnError } from "../../scripts/silverbullet-noise.ts";
import { commandDefined, reloadSpaceLua } from "../../scripts/ui-test-helpers.ts";

export { commandDefined, expect, reloadSpaceLua };

const target = process.env.SW_TARGET === "silverbullet" ? "silverbullet" : "playground";
export const onSilverBullet = target === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");

// The sample's pages there: in a folder of their own, so a test's tree of pages is theirs
const FOLDER = "UiTags";
/** A sample page's name in the space the tests run against */
// (A page of SilverBullet's own, `Library/…`, under the real Library/: SilverBullet tells its pages by that place)
export const pageName = (name: string): string => (!onSilverBullet ? name : name.startsWith("Library/") ? `Library/${FOLDER}/${name.slice("Library/".length)}` : `${FOLDER}/${name}`);

type Window = { playgroundTags?: { runCommand(name: string): Promise<void>; space: { pages: Map<string, string> } }; client?: { runCommandByName(name: string): Promise<void> } };

/** Tests get `page` with the sample space open (its index page); an error in the page fails the test */
export const test = base.extend({
  baseURL: async ({ baseURL }, use) => {
    await use(onSilverBullet ? `http://127.0.0.1:${server().port}/` : baseURL);
  },
  page: async ({ page }, use) => {
    const errors: string[] = [];
    // (Read by its stack: SilverBullet's own, as it starts, thrown in its client alone)
    page.on("pageerror", (e) => void (silverBulletsOwnError(e.stack ?? e.message) || errors.push(e.message)));
    page.on("console", (m) => {
      if (m.type() === "error" && !silverBulletsOwnError(m.text())) errors.push(m.text());
    });
    try {
      if (onSilverBullet) {
        await rm(join(server().space, FOLDER), { recursive: true, force: true });
        await rm(join(server().space, "Library", FOLDER), { recursive: true, force: true });
        for (const [name, text] of Object.entries(SAMPLE_PAGES)) {
          const path = join(server().space, `${pageName(name)}.md`);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, text);
        }
        await watchReloads(page);
        await page.goto(`/${pageName("index")}`);
        await page.waitForFunction(() => !!(window as unknown as Window).client);
        // (Its first index complete: the tags are read of it)
        await loaded(page);
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
        await rm(join(server().space, "Library", FOLDER), { recursive: true, force: true });
        // The settings a test saved go with it (Library/Config, written once the page is closed)
        await writeFile(configFile(server().space), "");
      }
    }
  },
});

/** Runs a command by its name, as SilverBullet's command palette runs it */
export async function command(page: Page, name: string): Promise<void> {
  // SilverBullet defines the init page's commands once its Space Lua has loaded (after the client is there):
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
    // Written through SilverBullet's client and indexed before the test goes on: files written beside it are found a
    // while later (after 2.12.1 one after another, a window opened meanwhile reading some)
    const written = Object.entries(pages).map(([name, text]) => [pageName(name), text] as const);
    // (There before SilverBullet writes it: it reads a page before writing it, a missing one a 404 in the console)
    for (const [name] of written) {
      const path = join(server().space, `${name}.md`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "");
    }
    await page.evaluate(async (written) => {
      const { client } = window as unknown as { client: { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } } };
      for (const [name, text] of written) await client.clientSystem.localSyscall("space.writePage", [name, text]);
      for (const [name] of written) await client.clientSystem.localSyscall("mq.send", ["indexQueue", `${name}.md`]);
      await client.clientSystem.localSyscall("mq.awaitEmptyQueue", ["indexQueue"]);
    }, written);
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

// A row's menu of actions: SilverBullet's edge (after 2.12.1) draws a row's actions as one ⋯ menu, a portal on the body;
// 2.12.1 and the playground draw them as buttons of the row
const ROW_MENU = ".sb-row-menu-trigger";

/**
 * A panel row's actions shown (the pointer over the row; on SilverBullet's edge its menu opened): where they are, and
 * their role. Waits for the row's menu or a button of one of `labels` (not any button: a row may have others).
 */
async function rowActions(page: Page, row: Locator, labels: readonly string[]): Promise<{ readonly within: Locator; readonly role: "button" | "menuitem" }> {
  await row.hover();
  const trigger = row.locator(ROW_MENU);
  const named = new RegExp(labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));
  await expect(trigger.or(row.getByRole("button", { name: named })).first()).toBeVisible();
  if (!(await trigger.isVisible())) return { within: row, role: "button" };
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  const menu = page.locator(".sb-row-menu");
  await expect(menu).toBeVisible();
  return { within: menu, role: "menuitem" };
}

/** One of a panel row's actions run, by its label */
export async function panelAction(page: Page, row: Locator, label: string): Promise<void> {
  const { within, role } = await rowActions(page, row, [label]);
  await within.getByRole(role, { name: label }).click();
}

/**
 * Which of `labels` a panel row offers as its actions, each label to whether it does; its menu, where it has one,
 * closed again. Ask for one it must offer beside one it must not: a row whose buttons are not drawn yet offers none.
 */
export async function panelOffers(page: Page, row: Locator, labels: readonly string[]): Promise<Record<string, boolean>> {
  const { within, role } = await rowActions(page, row, labels);
  const offered: Record<string, boolean> = {};
  for (const label of labels) offered[label] = (await within.getByRole(role, { name: label }).count()) > 0;
  if (role === "menuitem") {
    await page.keyboard.press("Escape");
    await expect(within).toHaveCount(0);
  }
  return offered;
}
