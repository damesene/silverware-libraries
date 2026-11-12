// Silverware Chart entry point, loaded by the init page's Space Lua:
//   js.importFromSpace("Library/damesene/silverware-chart.js").init({ ... the bridge ... })
// then a code widget defined for each of `languages()`, rendering `render(…)`,
// and the page's edits told to `pageModified(…)`.
import { layoutOf } from "../../shared/layout.ts";
import { type Bridge, listOf, missingBridgeFunctions, readSettings, type Settings } from "./bridge.ts";
import { Controller } from "./core/controller.ts";
import type { ChartConstructor } from "./core/drawn.ts";
import type { NamedTable, TableApi } from "./core/module.ts";
import { customFormatsAnew, defineCustomFormats, formatsOf } from "./custom.ts";
import { createModules } from "./modules.ts";

export const version = "0.1.0";

// One controller per window, even if the module is loaded again (e.g. after an update)
const GLOBAL_KEY = "__silverwareChart";
const slot = globalThis as unknown as Record<string, Controller | undefined>;

// Chart.js, a file beside the bundle (the library page's files: install it there), loaded the first time a chart is drawn
const loadChart = (): Promise<ChartConstructor> => import(new URL("./silverware-chart-chartjs.js", import.meta.url).href).then((m: { Chart: ChartConstructor }) => m.Chart);

export async function init(bridge: Bridge): Promise<void> {
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Chart: the init page did not hand over ${missing.join(", ")}`);
    return;
  }
  const { replaceRange, getCursor, moveCursor, flash, filterBox } = bridge;
  start(document, await readSettings(bridge), {
    getText: async () => String(await bridge.getText()),
    getCurrentPage: async () => String(await bridge.getCurrentPage()),
    readPage: async (name) => String(await bridge.readPage(name)),
    replaceRange: replaceRange ? async (from, to, text) => void (await replaceRange(from, to, text)) : undefined,
    getCursor: getCursor ? async () => Number(await getCursor()) : undefined,
    moveCursor: moveCursor ? async (at) => void (await moveCursor(at)) : undefined,
    flash: flash ? (message, type) => void flash(message, type) : undefined,
    // SilverBullet's filter box gives back the option picked: found by the index it was given
    pick: filterBox
      ? async (label, options) => {
          const picked = (await filterBox(label, options.map((option, i) => ({ name: option.label, ...(option.hint ? { hint: option.hint } : {}), index: i })))) as { index?: unknown } | undefined;
          return typeof picked?.index === "number" ? picked.index : undefined;
        }
      : undefined,
    loadChart,
    table: tableApi(bridge),
    layout: layoutOf(bridge.layout),
  });
}

/** Silverware Table's API as the bridge hands it over (its tables as lists from Lua too), where it is installed */
function tableApi(bridge: Bridge): TableApi | undefined {
  const { tables, onWrite } = bridge;
  if (!tables || !onWrite) return undefined;
  return {
    tables: async (text) =>
      listOf(await tables(text)).map((t) => {
        const table = t as NamedTable;
        return { ...table, columns: listOf(table.columns) as NamedTable["columns"], rows: listOf(table.rows).map((row) => listOf(row).map(String)) };
      }),
    onWrite: (listener) => void onWrite(listener as (text: string, context: never) => unknown),
  };
}

/** The core and the modules on, over a host's API (SilverBullet's, or the playground's) */
export function start(doc: Document, settings: Settings, env: Omit<ConstructorParameters<typeof Controller>[1], "height">): Controller {
  // (The one before it, of a load of Space Lua before, let go)
  slot[GLOBAL_KEY]?.stop();
  const controller = new Controller(doc, { ...env, height: settings.height });
  controller.setModules(createModules(settings, (name) => controller.hostFor(name)));
  slot[GLOBAL_KEY] = controller;
  return controller;
}

/** The code blocks' languages charts are written in (the init page defines a code widget for each) */
export function languages(): string[] {
  return slot[GLOBAL_KEY]?.languages() ?? [];
}

/** A code block's element: its chart (or why it cannot be drawn); undefined where it is no chart (handed on) */
export function render(language: string, text: string, page: string): Promise<HTMLElement | undefined> {
  return slot[GLOBAL_KEY]?.render(String(language), String(text), String(page)) ?? Promise.resolve(undefined);
}

/** The commands' names, for the init page to define them (the modules' on) */
export function commandNames(): string[] {
  return slot[GLOBAL_KEY]?.commands().map((command) => command.name) ?? [];
}

/** A command run (the init page's commands call it) */
export async function runCommand(name: string): Promise<void> {
  await slot[GLOBAL_KEY]?.commands().find((command) => command.name === name)?.run();
}

/** The slash commands' words, for the init page to define them */
export function slashCommandNames(): { name: string; description: string }[] {
  return slot[GLOBAL_KEY]?.slashCommands().map((command) => ({ name: command.name, description: command.description ?? "" })) ?? [];
}

/** A slash command run (the init page's slash commands call it) */
export async function runSlashCommand(name: string): Promise<void> {
  await slot[GLOBAL_KEY]?.slashCommands().find((command) => command.name === name)?.run();
}

/** A block shown as code, where it is no chart and nothing drew its language before */
export function codeBlock(language: string, text: string): HTMLElement {
  const pre = document.createElement("pre");
  pre.className = "swc-code";
  const code = pre.appendChild(document.createElement("code"));
  code.textContent = String(text);
  code.dataset.language = String(language);
  return pre;
}

/** The page open was edited (the init page's editor:pageModified listener): the charts on it follow their sources */
export function pageModified(text: string, page: string): void {
  slot[GLOBAL_KEY]?.pageModified(String(text), String(page));
}

/**
 * `silverware.chart.defineFormats` (the API page's Space Lua): custom
 * formats, a definition, a list, or a function given the helpers that returns
 * them, usually a JS module of the space. The others defined; what is wrong
 * with any of them, which the API page shows as a notification.
 */
export function defineFormats(definitions: unknown): string | undefined {
  const { formats, problems } = formatsOf(definitions);
  const again = defineCustomFormats(formats);
  const lines = [
    ...(problems.length ? [`custom formats not defined: ${problems.join("; ")}`] : []),
    ...(again.length ? [`custom formats defined again (the last definition counts): ${again.join(", ")}`] : []),
  ];
  return lines.length ? `Silverware Chart: ${lines.join(". ")}` : undefined;
}

/** Space Lua is loaded (again): the custom definitions are made anew, replacing those of before */
export function resetDefinitions(): void {
  customFormatsAnew();
}
