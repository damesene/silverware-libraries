// Silverware Core's gate (silverware-core/CLAUDE.md, *How the plugins load it*; written into each plugin's page by
// scripts/coregate.mjs): with the core every plugin starts through it; without it, with an older one, or with one of
// another major, each plugin says why, starts nothing, and its Space Lua API's functions refuse with the same message.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { apiFunctionsOf, keyOf, NEEDS } from "../../scripts/coregate.mjs";
import { LIBRARIES } from "../../scripts/libraries.mjs";
import { expect, test } from "./helpers.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (path: string) => (existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), "utf8") : "");

/** Each plugin: its folder, its key in Lua, its name, its API's first function (where it has an API of functions) */
const PLUGINS = LIBRARIES.filter((library) => library !== "silverware-core").map((library) => {
  const key = keyOf(library);
  return { library, key, title: /^# (.+)$/m.exec(read(`${library}/${library}.md`))![1]!, stub: apiFunctionsOf(key, read(`${library}/${library}-api.md`))[0] };
});

// The plugins started: a command of each that defines one (as cross-plugin/ui-tests/helpers.ts' STARTED)
const COMMANDS = ["Silverware Assets: Settings", "Silverware Database: Settings", "Silverware Layout: Settings", "Silverware Table: Settings", "Silverware Tags: Manager", "Silverware Toolbar: Settings"];

/**
 * A page saying, a line each, whether each plugin was refused (its gate's message, or "started"), what its API's first
 * function says called, and the core's version as its API page sets it; a markdown table under it
 */
const PAGE = [
  "# Gate",
  "",
  "Core: ${silverware.core and silverware.core.version or 'none'}",
  "",
  // (A line each, no blank between: the page whole in the window, where CodeMirror draws its lines)
  ...PLUGINS.map(({ key, stub }) =>
    [`${key} gate: \${silverware_internal.${key}.refused or "started"}`, ...(stub ? [`${key} stub: \${(function() local ok, problem = pcall(silverware.${key}.${stub}) return ok and "ran" or tostring(problem) end)()}`] : [])].join(" "),
  ),
  "",
  "| A | B |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
].join("\n");

/** The page's editor, each of `texts` shown in it (Space Lua run, its expressions drawn), each awaited on its own */
async function shows(page: Page, texts: (string | RegExp)[]): Promise<void> {
  const editor = page.locator("#sb-editor");
  for (const text of texts) await expect(editor).toContainText(text);
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// (Tall: every plugin's line drawn at once)
test.use({ viewport: { width: 1280, height: 2400 } });

/**
 * SilverBullet's notifications kept as they come, from the page's start: each shows a few seconds, gone before a page
 * loaded whole is read (`notifications`, their texts)
 */
const recordNotifications = (page: Page) =>
  page.addInitScript(() => {
    const shown: Element[] = ((window as unknown as { __notifications: Element[] }).__notifications = []);
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          // (One added in the box, or the box added with its first)
          if (record.target instanceof Element && record.target.matches(".sb-notifications")) shown.push(node);
          else shown.push(...node.querySelectorAll(".sb-notifications > *"));
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });

const notifications = (page: Page) => page.evaluate(() => (window as unknown as { __notifications: Element[] }).__notifications.map((one) => one.textContent ?? ""));

const commandsDefined = (page: Page) =>
  page.evaluate((names) => {
    const all = (window as unknown as { client: { clientSystem: { commandHook: { buildAllCommands(): Map<string, unknown> } } } }).client.clientSystem.commandHook.buildAllCommands();
    return names.filter((name) => all.has(name));
  }, COMMANDS);

test("with the core, every plugin starts through its gate", async ({ page, space }) => {
  await space.open({ Page: PAGE }, "Page");
  for (const command of COMMANDS) await expect.poll(() => commandsDefined(page).then((names) => names.includes(command))).toBe(true);
  await shows(page, ["Core: 1.0.0", ...PLUGINS.flatMap(({ key, stub }) => [`${key} gate: started`, ...(stub ? [`${key} stub: `] : [])])]);
  // (A function called with nothing ran or refused by its own check, not the gate's: every line drawn above)
  await expect(page.locator("#sb-editor")).not.toContainText("Silverware Core");
  // (Silverware Table drew its table)
  await expect(page.locator("#sb-editor [data-swt-row]").first()).toBeAttached();
});

for (const [version, why] of [
  [undefined, (title: string, need: string) => `${title} needs Silverware Core ${need} or later (not installed): run Library: Update All, then reload the page`],
  ["0.9.0", (title: string, need: string) => `${title} needs Silverware Core ${need} or later (installed 0.9.0): run Library: Update All, then reload the page`],
  ["2.0.0", (title: string, need: string) => `${title} works with Silverware Core ${need.split(".")[0]}.x only (installed 2.0.0): update ${title}: run Library: Update All, then reload the page`],
] as const) {
  test(`with ${version ? `a core ${version}` : "no core"}, each plugin says why, starts nothing, and its API refuses`, async ({ page, space, coreAs }) => {
    await coreAs(version);
    await recordNotifications(page);
    await space.open({ Page: PAGE }, "Page");
    await shows(page, [
      `Core: ${version ?? "none"}`,
      ...PLUGINS.flatMap(({ library, key, title, stub }) => {
        const problem = why(title, NEEDS[library]!);
        return [`${key} gate: ${problem}`, ...(stub ? [new RegExp(`${key} stub: .*?${escaped(problem)}`)] : [])];
      }),
    ]);
    // Told once each, as the page loaded
    const told = await notifications(page);
    for (const { library, title } of PLUGINS) expect(told.filter((one) => one.includes(why(title, NEEDS[library]!))), title).toHaveLength(1);
    // Nothing of the plugins started: no command, no table enhanced
    expect(await commandsDefined(page)).toEqual([]);
    await expect(page.locator("#sb-editor [data-swt-row]")).toHaveCount(0);
  });
}

// A plugin taking another's function through its Lua (Assets and Layout the toolbar's `defineActions`) leaves a refused
// one's alone: its stubs only refuse, and taken they would fail the plugin's own start (what each defines after taking
// it awaited: Assets' settings command, Layout's slash command /grid; and the error in the page, `pageErrors`)
test("with the toolbar alone refused, the plugins taking its actions start without it", async ({ page, space, libraryFiles }) => {
  const problem = "Silverware Toolbar needs Silverware Core 1.1 or later (installed 1.0.0): run Library: Update All, then reload the page";
  await libraryFiles("silverware-toolbar-api.md", (text) => {
    const needing = text.replace("(major == 1 and minor < 0)", "(major == 1 and minor < 1)").replaceAll("Silverware Core 1.0 or later", "Silverware Core 1.1 or later");
    expect(needing, "the toolbar's gate as scripts/coregate.mjs writes it").toContain("(major == 1 and minor < 1)");
    return needing;
  });
  await space.open({ Page: PAGE }, "Page");
  await shows(page, [`toolbar gate: ${problem}`, ...PLUGINS.filter(({ key }) => key !== "toolbar").map(({ key }) => `${key} gate: started`)]);
  for (const command of COMMANDS.filter((name) => !name.startsWith("Silverware Toolbar")))
    await expect.poll(() => commandsDefined(page).then((names) => names.includes(command))).toBe(true);
  await expect.poll(() => page.evaluate(() => "grid" in (window as unknown as { client: { config: { get(key: string, fallback: object): object } } }).client.config.get("slashCommands", {}))).toBe(true);
  expect(await commandsDefined(page)).not.toContain("Silverware Toolbar: Settings");
});
