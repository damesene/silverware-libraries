// What every plugin's interaction tests (each plugin's ui-tests/helpers.ts) share: kept here once, re-exported by
// each helpers file so a test imports it from its own.
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { loaded, watchReloads } from "./silverbullet-loaded.ts";
import { silverBulletsOwnError } from "./silverbullet-noise.ts";
import { configFile, silverbulletServer } from "./silverbullet-servers.ts";

/**
 * Where an element is once laid out: waited for (a write, a hover or a save may render it anew meanwhile, and
 * SilverBullet draws a widget's element anew with any change of its editor: a box read at once may be none). For a
 * single read; inside an `expect.poll` read `boundingBox()` itself, a null only polled again
 */
export async function boxOf(target: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect.poll(async () => (box = await target.boundingBox()) !== null).toBe(true);
  return box!;
}

type Commands = { clientSystem?: { commandHook?: { buildAllCommands(): Map<string, unknown> } } };

/**
 * Waits until Space Lua has defined a command (it loads after the page): its plugin started. Asked of a client that may
 * still be starting (a page loaded again: its client there, its system not yet), as not yet defined, not as an error
 */
export async function commandDefined(page: Page, name: string): Promise<void> {
  await page.waitForFunction((command) => !!(window as unknown as { client?: Commands }).client?.clientSystem?.commandHook?.buildAllCommands().has(command), name);
}

type Runs = { runCommandByName(name: string): Promise<void>; clientSystem?: { commandHook?: { buildAllCommands(): Map<string, unknown> } } };

/**
 * A command run as SilverBullet's palette would, where this SilverBullet has it (Navigate: Tree from its 3.0; a
 * plugin's once defined, which `commandDefined` waits for): whether it did. Not waited for (its run may wait for the
 * user, a dialog of its), a failure of it not told here; what it shows is waited for by the test
 */
export async function runSilverBulletCommand(page: Page, name: string): Promise<boolean> {
  return page.evaluate((command) => {
    const client = (window as unknown as { client?: Runs }).client;
    if (!client?.clientSystem?.commandHook?.buildAllCommands().has(command)) return false;
    void client.runCommandByName(command);
    return true;
  }, name);
}

/**
 * SilverBullet's System: Reload, as its palette runs it, waited for until Space Lua has run again (each plugin's init
 * and API pages run again on the modules already loaded, docs/silverware-core.md *Probes* 2; probed 2026-11-26: a
 * block counting its runs had run once more as this returned). What a plugin starts after its init page returns (a
 * database's modules, an editor's CodeMirror) is not waited for: a test waits for what it shows
 */
export async function reloadSpaceLua(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { client: { runCommandByName(name: string): Promise<void> } }).client.runCommandByName("System: Reload"));
}

/** Text put at the page's end through SilverBullet's editor, as typed: its widgets drawn for it */
export async function appendToPage(page: Page, text: string): Promise<void> {
  await page.evaluate((text) => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { length: number } }; dispatch(spec: unknown): void } } }).client.editorView;
    view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
  }, text);
}

/**
 * Errors of the page a test fails on, gathered as they come: thrown in it or logged as errors, but SilverBullet's own
 * (scripts/silverbullet-noise.ts) and a 404 (SilverBullet answers what it looks for and does not find with one, which
 * the page logs). A suite's own exceptions stay in its helpers: `alsoAllowed`, thrown or logged
 */
export function pageErrors(page: Page, alsoAllowed?: RegExp): string[] {
  const errors: string[] = [];
  gathered.set(page, errors);
  // (Read by its stack: SilverBullet's own, as it starts, thrown in its client alone)
  page.on("pageerror", (e) => void (silverBulletsOwnError(e.stack ?? e.message) || alsoAllowed?.test(e.message) || errors.push(e.message)));
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error" && !/404/.test(text) && !alsoAllowed?.test(text) && !silverBulletsOwnError(text)) errors.push(text);
  });
  return errors;
}

// Each page's errors as `pageErrors` gathers them, for `expectNoPageErrorsYet`
const gathered = new WeakMap<Page, string[]>();

/**
 * A fixture's own list of the page's errors made the one `expectNoPageErrorsYet` reads (a fixture that gathers them
 * itself, as Silverware Table's with its log, not by `pageErrors`)
 */
export function gatherPageErrors(page: Page, errors: string[]): void {
  gathered.set(page, errors);
}

/**
 * No error in the page so far (as `pageErrors` or a fixture's own list, `gatherPageErrors`, gathered them): checked before a test marks itself failing for a known bug
 * (`test.fail(true, "Known …")`), so an error of the page before it is a failure, not taken for the known one (the
 * fixture checks the errors only after the test)
 */
export function expectNoPageErrorsYet(page: Page): void {
  const errors = gathered.get(page);
  if (!errors) throw new Error("expectNoPageErrorsYet: the page's errors are not gathered (pageErrors, gatherPageErrors)");
  expect(errors, "errors in the page before the known bug's mark").toEqual([]);
}

/** A test's pages in its worker's SilverBullet space */
export type Space = {
  /** The folder of this test's pages in the space (`<root>/<test's title> <id>`) */
  readonly folder: string;
  /** Pages written (by their names under the folder), and files beside them (an image: its name with its extension), the page `open` of them opened, the plugins started */
  open(pages: Readonly<Record<string, string>>, open: string, files?: Readonly<Record<string, Uint8Array | string>>): Promise<void>;
  /** Another of the pages written opened, the plugins started */
  goTo(name: string): Promise<void>;
};

/**
 * A space fixture's body (`base.extend({ space: (…) => withSpace(…) })`): a test's pages written into its worker's space
 * under `root/<test>`, a page opened and waited for until loaded and the commands `started` are defined (its plugins
 * started), and after the test the pages, Silverware Assets' previews of their files and Library/Config put back as
 * they were. Against a real SilverBullet only
 */
export async function withSpace(page: Page, root: string, started: readonly string[], use: (space: Space) => Promise<void>): Promise<void> {
  const server = silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
  // (Its title's start and its id's end: two titles alike in their first words are two folders)
  const folder = `${root}/${test.info().title.replace(/[^\w ]/g, "").slice(0, 40).trim()} ${test.info().testId.slice(-6)}`;
  const configPath = configFile(server.space);
  const configBefore = existsSync(configPath) ? await readFile(configPath, "utf8") : undefined;
  let watching = false;
  const goTo = async (name: string) => {
    // (SilverBullet's first index, complete, builds the editor's state anew: waited for, as what a test does before it
    // would be undone: scripts/silverbullet-loaded.ts)
    if (!watching) await watchReloads(page);
    watching = true;
    await page.goto(`http://127.0.0.1:${server.port}/${folder}/${name}`);
    await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
    await loaded(page);
    for (const command of started) await commandDefined(page, command);
  };
  await use({
    folder,
    open: async (pages, open, files = {}) => {
      // (The files first: a page indexed before what it embeds is there drew it missing)
      for (const [name, content] of Object.entries(files)) {
        const file = join(server.space, folder, name);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, content);
      }
      for (const [name, text] of Object.entries(pages)) {
        const file = join(server.space, folder, `${name}.md`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, text);
      }
      await goTo(open);
    },
    goTo,
  });
  // (The page closed first: an open client would take Library/Config written under it for a change of its own)
  await page.close();
  await rm(join(server.space, folder), { recursive: true, force: true });
  // (Previews Silverware Assets kept of its files: silverware-assets/src/core/stored.ts)
  await rm(join(server.space, "_silverware-assets-previews", folder), { recursive: true, force: true });
  if (configBefore === undefined) await rm(configPath, { force: true });
  else await writeFile(configPath, configBefore);
}

/**
 * What the document has on top at an element's middle and inside each of its corners: whether each is the element or
 * in it (in a shadow root too), named by where it fails; a point outside the window `"outside view"` (the document has
 * nothing there to hit), not taken for one covered. What lies over it there by its stacking (another plugin's control,
 * a panel of the page) shows; visibility alone would not. Each corner is read `inset` px in, or past its own rounding
 * where that is more (its computed radii, elliptical too: a point r·(1 − 1/√2) in from the corner on the larger r is
 * inside the arc; a round control's corners so too)
 */
export async function onTopAt(target: Locator, inset = 3): Promise<Record<string, boolean | "outside view">> {
  await boxOf(target);
  return target.evaluate((element, inset) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    // A corner's radii in px, across and down (one value both; a share of the box's width across, of its height down;
    // no more than half the side, as CSS draws a radius too large for its box)
    const radii = (value: string): [number, number] => {
      const [across = "0", down = across] = value.split(" ");
      const px = (one: string, side: number) => Math.min(side / 2, one.endsWith("%") ? (parseFloat(one) / 100) * side : parseFloat(one) || 0);
      return [px(across, box.width), px(down, box.height)];
    };
    // In past the arc: (1 − d/r)² ≤ ½ on each axis once d ≥ r·(1 − 1/√2) for the larger r, so the two sum to 1 at most;
    // short of the box's middle
    const inFrom = (value: string) => Math.min(Math.max(inset, Math.ceil(Math.max(...radii(value)) * (1 - Math.SQRT1_2)) + 1), Math.min(box.width, box.height) / 2);
    const points: Record<string, [number, number]> = {
      middle: [box.left + box.width / 2, box.top + box.height / 2],
      "top left": [box.left + inFrom(style.borderTopLeftRadius), box.top + inFrom(style.borderTopLeftRadius)],
      "top right": [box.right - inFrom(style.borderTopRightRadius), box.top + inFrom(style.borderTopRightRadius)],
      "bottom left": [box.left + inFrom(style.borderBottomLeftRadius), box.bottom - inFrom(style.borderBottomLeftRadius)],
      "bottom right": [box.right - inFrom(style.borderBottomRightRadius), box.bottom - inFrom(style.borderBottomRightRadius)],
    };
    const within = (node: Element | null): boolean => {
      for (let at: Node | null = node; at; at = at.parentNode ?? (at instanceof ShadowRoot ? at.host : null)) if (at === element) return true;
      return false;
    };
    const deepest = (x: number, y: number) => {
      let found = document.elementFromPoint(x, y);
      while (found?.shadowRoot) {
        const inner = found.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === found) break;
        found = inner;
      }
      return found;
    };
    const outside = (x: number, y: number) => x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight;
    return Object.fromEntries(Object.entries(points).map(([name, [x, y]]) => [name, outside(x, y) ? "outside view" : within(deepest(x, y))]));
  }, inset);
}

/** Every point `onTopAt` reads on top */
export const ON_TOP = { middle: true, "top left": true, "top right": true, "bottom left": true, "bottom right": true };
