// The SilverBullet API Silverware Chart uses, handed over by the library
// page's Space Lua (editor.*, space.readPage, config.get, and Silverware
// Table's silverware.table.tables and onWrite where it is installed), so no
// SilverBullet internals are needed.

export type Bridge = {
  readonly getText: () => string | Promise<string>;
  readonly getCurrentPage: () => string | Promise<string>;
  readonly readPage: (name: string) => string | Promise<string>;
  // Optional: one edit of the page open (Update data); without it, a chart's data are not written
  readonly replaceRange?: (from: number, to: number, text: string) => unknown;
  // Optional: the cursor's offset, putting it somewhere (Edit source), a notification
  readonly getCursor?: () => unknown;
  readonly moveCursor?: (at: number) => unknown;
  readonly flash?: (message: string, type?: "info" | "error") => unknown;
  // Optional: SilverBullet's filter box (editor.filterBox), the option picked or nothing
  readonly filterBox?: (label: string, options: readonly Record<string, unknown>[]) => unknown;
  // Optional: without it, settings keep their defaults
  readonly getConfig?: (path: string, defaultValue: unknown) => unknown;
  // Optional, Silverware Table's (silverware.table.tables and onWrite), where it is installed
  readonly tables?: (text: string) => unknown;
  readonly onWrite?: (listener: (text: string, context: never) => unknown) => unknown;
  // Optional: Silverware Layout's API (silverware.layout.api), where it is installed: the charts laid out at the width their blocks keep
  readonly layout?: unknown;
};

/** The bridge's functions it cannot work without, missing from what the init page gave */
export function missingBridgeFunctions(bridge: Partial<Bridge>): string[] {
  return (["getText", "getCurrentPage", "readPage"] as const).filter((name) => typeof bridge[name] !== "function");
}

/** The modules: the parts that can be turned off with `silverware.chart.modules.<name>.enabled` (default on) */
export const MODULE_NAMES = ["mermaid", "types", "settings", "tables", "silverwareTable", "insert"] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

/** A module's name and what it does (the init page's config.define says the same) */
export const MODULE_LABELS: Readonly<Record<ModuleName, string>> = { mermaid: "Mermaid", types: "Chart types", settings: "Chart settings", tables: "Tables as sources", silverwareTable: "Silverware Table", insert: "Insert a chart" };
export const MODULE_DESCRIPTIONS: Readonly<Record<ModuleName, string>> = {
  mermaid: "Charts written as Mermaid (```mermaid blocks of xychart-beta and pie), which GitHub and other Mermaid renderers draw too.",
  types: "The built-in types of charts: bar, line, area, scatter, pie, doughnut, polar area, radar.",
  settings: "The settings every chart has, in its settings dialog: title, height, legend, stacked, smooth lines, the axes, each series' name, color and how it is drawn.",
  tables: "A markdown table as a chart's data, found by its place (above or below the chart, under a heading), followed as it is edited.",
  silverwareTable: "Where Silverware Table is installed: a table it named as a chart's data, and the chart's data written into its block with each edit of the table.",
  insert: "The command Silverware Chart: Insert chart (a chart under a table of the page) and the slash command /chart (a chart at the cursor), the table picked from a list.",
};

/** Where each setting is in SilverBullet's configuration */
export const PATHS = {
  height: "silverware.chart.height",
  module: (name: ModuleName) => `silverware.chart.modules.${name}.enabled`,
} as const;

/** Silverware Chart's settings, read as it starts (a change applies on reload) */
export type Settings = {
  readonly modules: ReadonlySet<ModuleName>;
  // A chart's height where its block says none (CSS)
  readonly height: string;
};

/** The settings as configured, each its default where it is not set or not valid */
export async function readSettings(bridge: Partial<Bridge>): Promise<Settings> {
  const get = async (path: string, fallback: unknown) => {
    try {
      return await bridge.getConfig?.(path, fallback);
    } catch {
      return fallback;
    }
  };
  const modules = new Set<ModuleName>();
  for (const name of MODULE_NAMES) if ((await get(PATHS.module(name), true)) !== false) modules.add(name);
  const height = await get(PATHS.height, "300px");
  return { modules, height: typeof height === "string" && height.trim() ? height.trim() : "300px" };
}

/**
 * A list as handed over: an array, or a Lua table as an object with its
 * items under 1, 2, … (as the other plugins' bridges take them)
 */
export function listOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.every(([key], i) => key === String(i + 1))) return [];
  return entries.map(([, item]) => item);
}
