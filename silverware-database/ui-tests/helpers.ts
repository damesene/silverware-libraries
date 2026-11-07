/// <reference types="node" />
// What the database's interaction tests share. A database is drawn by
// SilverBullet's code widget, which the playground has not: these tests run
// against a real SilverBullet only (npm run test:ui:sb), the committed
// silverware-database.js deployed, and are skipped on the playground. A
// test's pages are written into its worker's space (UiDatabase/<test>/…) with
// two views of its own (defined by Space Lua, as a user's are), opened, and
// removed after.
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { silverbulletServer } from "../../scripts/silverbullet-servers.ts";

export { expect };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
const FOLDER = "UiDatabase";

/** The views the tests define: the items' names with a button adding one, and how many items there are */
const VIEWS = `export default [
  {
    name: "names",
    label: "Names",
    icon: "N",
    render(host, element) {
      const draw = () => {
        const add = Object.assign(document.createElement("button"), { textContent: "Add", className: "test-add" });
        add.addEventListener("click", () => void host.create({ name: "Added " + Date.now() }));
        element.replaceChildren(...host.items.map((item) => Object.assign(document.createElement("div"), { textContent: item.name, className: "test-item" })), add);
      };
      draw();
      return { update: draw };
    },
  },
  {
    name: "count",
    label: "Count",
    icon: "#",
    render(host, element) {
      element.replaceChildren(Object.assign(document.createElement("p"), { textContent: host.items.length + " of " + host.total, className: "test-count" }));
    },
  },
];
`;

/** A database's root page, of the format the store writes */
export const root = (id: string, name: string) =>
  `---\ntags: [db-root]\n_database:\n  id: ${id}\n  name: ${name}\n  format: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n---\n`;

/** An item's page */
export const item = (status: string, rank: string) => `---\ntags: [db]\nstatus: ${status}\n_database:\n  rank: ${rank}\n---\n`;

export type Space = {
  /** The folder of this test's pages in the space (`UiDatabase/<test>`) */
  readonly folder: string;
  /** Pages written (by their names under the folder) and the page `open` of them opened, the test's views defined */
  open(pages: Readonly<Record<string, string>>, open: string): Promise<void>;
  /** A page's text as saved (its name under the folder); undefined where there is none */
  saved(name: string): Promise<string | undefined>;
  /** The space's CONFIG page as saved (the settings dialog writes it; put back as it was after the test) */
  config(): Promise<string | undefined>;
};

/**
 * Tests get `page` and `space`: an error in the page fails the test.
 * SilverBullet indexes a space as it first loads, before its Space Lua runs:
 * the page is loaded again once, so the test's views are defined.
 */
export const test = base.extend<{ space: Space }>({
  page: async ({ page }, use) => {
    test.skip(!onSilverBullet, "a database is drawn by SilverBullet's code widget: tested against SilverBullet only");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // (SilverBullet answers what it looks for and does not find with a 404, which the page logs)
      if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text());
    });
    try {
      await use(page);
      expect(errors, "errors in the page").toEqual([]);
    } finally {
      await page.close();
    }
  },
  space: async ({ page }, use) => {
    const folder = `${FOLDER}/${test.info().title.replace(/[^\w ]/g, "").slice(0, 40).trim()}`;
    const path = (name: string) => join(server().space, folder, `${name}.md`);
    const configPath = join(server().space, "CONFIG.md");
    const configBefore = existsSync(configPath) ? await readFile(configPath, "utf8") : undefined;
    await use({
      folder,
      open: async (pages, open) => {
        const views = join(server().space, folder, "views.js");
        await mkdir(dirname(views), { recursive: true });
        await writeFile(views, VIEWS);
        const lua = `\`\`\`space-lua\nsilverware.database.defineViews(js.importFromSpace("${folder}/views.js"))\n\`\`\`\n`;
        await writeFile(path("Views"), `# Views\n\n${lua}`);
        for (const [name, text] of Object.entries(pages)) {
          await mkdir(dirname(path(name)), { recursive: true });
          await writeFile(path(name), text);
        }
        await page.goto(`http://127.0.0.1:${server().port}/${folder}/${open}`);
        await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
        // Once the index has the views' Space Lua block: loaded again, it runs
        await waitForIndex(page, "space-lua", `${folder}/Views@`);
        await page.reload();
        await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
      },
      saved: async (name) => (existsSync(path(name)) ? (await readFile(path(name), "utf8")).replace(/\r\n/g, "\n") : undefined),
      config: async () => (existsSync(configPath) ? (await readFile(configPath, "utf8")).replace(/\r\n/g, "\n") : undefined),
    });
    // (The page closed first: an open client would take CONFIG written under it for a change of its own)
    await page.close();
    await rm(join(server().space, folder), { recursive: true, force: true });
    if (configBefore === undefined) await rm(configPath, { force: true });
    else await writeFile(configPath, configBefore);
  },
});

/** The page open's text, as its editor has it */
export function editorText(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { client: { editorView: { state: { doc: { toString(): string } } } } }).client.editorView.state.doc.toString());
}

/** A command run as the palette would, once Space Lua has defined it (it loads after the page) */
export async function runCommand(page: Page, name: string): Promise<void> {
  type Client = { clientSystem: { commandHook: { buildAllCommands(): Map<string, unknown> } }; runCommandByName(name: string): Promise<void> };
  await page.waitForFunction((command) => (window as unknown as { client: Client }).client.clientSystem.commandHook.buildAllCommands().has(command), name);
  await page.evaluate((command) => void (window as unknown as { client: Client }).client.runCommandByName(command), name);
}

/** Waits until the index has an object of `tag` holding `text` (its page's name, a block's ref): asked of the index itself, not of Space Lua, which loads after the page */
export async function waitForIndex(page: Page, tag: string, text: string): Promise<void> {
  type Client = { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } };
  await expect
    .poll(async () => {
      const found = await page.evaluate((one) => (window as unknown as { client: Client }).client.clientSystem.localSyscall("index.queryLuaObjects", [one, {}]), tag);
      return Array.isArray(found) && found.some((object) => JSON.stringify(object).includes(text));
    })
    .toBe(true);
}
