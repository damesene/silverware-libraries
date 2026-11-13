// Silverware Layout in SilverBullet: the API the widget plugins register their providers with (shared/layout.ts), and
// the app (app.ts) over SilverBullet's page (host/silverbullet/dom.ts), its store SilverBullet's: the settings in its
// configuration (saved into CONFIG), a page's own width in its frontmatter (through the page writer), this device's
// zoom in the browser. Its init page hands over SilverBullet's API (bridge.ts) and calls `pageLoaded`, `pageOpened`
// and `pageEdited`.
import { applyLayers } from "../../shared/layers.ts";
import { saveConfigPage, withConfigSettings } from "../../shared/configpage.ts";
import { type PageWriter, pageWriter } from "../../shared/pages/writer.ts";
import { LayoutApp, type LayoutStore } from "./app.ts";
import { type Bridge, missingBridgeFunctions } from "./bridge.ts";
import { Registry } from "./core/registry.ts";
import { RENDERED_VERSION, type Rendered, type RenderedItem } from "../../shared/rendered.ts";
import { gridInsertion } from "./grid/core/insert.ts";
import { gridLinks } from "./grid/core/links.ts";
import { GRID_MODES, isGridMode, putIntoGrid } from "./grid/build.ts";
import { gridTags } from "./grid/core/tags.ts";
import { gridRelations, gridTagObjects } from "./host/silverbullet/gridindex.ts";
import { Grids } from "./grid/grids.ts";
import { gridProvider } from "./grid/provider.ts";
import { watchEmbeddedGrids } from "./host/silverbullet/embeddedgrids.ts";
import { watchSyntaxMode } from "./host/silverbullet/syntaxmode.ts";
import { silverBulletGridHost, silverBulletPutHost } from "./host/silverbullet/grid.ts";
import { keepDeviceZoom, readDeviceZoom } from "./host/devicezoom.ts";
import { silverBulletPage } from "./host/silverbullet/dom.ts";
import { pageLayoutOf, writePageWidth } from "./host/silverbullet/page.ts";
import { silverBulletPlatform } from "./host/silverbullet/platform.ts";
import { DEFAULT_GUIDES, DEFAULT_MIN_PANE_WIDTH, keptGuides, PATHS, readSettings, readSyntaxModeSettings, type Settings, type SyntaxModeSettings } from "./model/settings.ts";
import { syntaxTab } from "./ui/syntaxtab.ts";
import { cssWidth, readTextWidth } from "./model/width.ts";

const PAGE_LAYOUT = "Silverware Layout: Page layout";
const PUT_INTO_GRID = "Silverware Layout: Put into grid";
// Silverware Layout's own block of CONFIG: the guides, a list, which the Configuration Manager's block would lose
// (shared/configpage.ts)
const OWN_MARKER = "-- managed-by: silverware-layout";

// One registry per window: the module is imported once, so `api` is the same object as Space Lua loads again, and a
// provider registered again (its plugin's init page run again) replaces its own. One app per window as well (its
// observers and listeners live as long), started again with each load of Space Lua
const registry = new Registry((message) => app.problem(message));
const app = new LayoutApp(document, silverBulletPage(document), registry);

/**
 * Silverware Layout's API, as its API page hands it to the widget plugins (`silverware.layout.api`): the widgets'
 * providers (shared/layout.ts), and what its grids draw outside the editor (`rendered`, shared/rendered.ts)
 */
export const api = Object.assign(registry.api(), { rendered: renderedApi(), layOutAgain: () => app.layOutWidgets() });

// The page's grids (docs/silverware-layout-grid.md), made as the init page hands SilverBullet's API over
let grids: Grids | undefined;
// Who is told what the grids draw (shared/rendered.ts), the grids made or not yet
const renderedListeners = new Set<(items: readonly RenderedItem[]) => void>();

/** What the grids draw outside the editor and where it is in the page, for another plugin to decorate (shared/rendered.ts) */
function renderedApi(): Rendered {
  return {
    version: RENDERED_VERSION,
    items: () => grids?.rendered.items() ?? [],
    ranges: () => grids?.rendered.ranges() ?? [],
    onChange: (listener) => {
      renderedListeners.add(listener);
      return () => void renderedListeners.delete(listener);
    },
  };
}

/** Started by the init page (again as Space Lua loads again): SilverBullet's API handed over */
export async function init(bridge: Bridge): Promise<void> {
  // The layers its style page lays its elements in (shared/layers.ts)
  applyLayers(document);
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Layout: the init page did not hand over ${missing.join(", ")}`);
    return;
  }
  current = bridge;
  const writer = pageWriter(silverBulletPlatform(bridge));
  // One per window (its listeners live as long); its host the bridge handed over now, again with each start
  const host = silverBulletGridHost(bridge, writer);
  if (grids) grids.useHost(host);
  else {
    grids = new Grids(document, host);
    grids.rendered.onChange((items) => {
      for (const listener of renderedListeners) listener(items);
    });
    grids.start();
    // A grid's width laid out as any widget's, registered as a widget plugin registers
    registry.register(gridProvider(grids));
    grids.onAttributes = () => app.layOutWidgets();
    // A grid in a page embedded in this one, which SilverBullet shows as its text: drawn as the grid it is
    const drawing = grids;
    watchEmbeddedGrids(document, (text) => drawing.drawText(text));
    // The markdown shown as written (SilverBullet's mode): what Silverware Layout draws or decorates hidden then, a
    // link's click the cursor's, as the settings say (read as Silverware Layout starts, again as the tab saves them)
    syntaxWatcher = watchSyntaxMode(
      document,
      () => current?.getUiOption?.("markdownSyntaxRendering"),
      () => (current ? readSyntaxSettings(current) : { hideWidgets: true, clickPlacesCursor: true }),
    );
  }
  // The Markdown tab of the Page layout dialog, made as it opens
  app.dialogTabs = async () => [
    syntaxTab(document, await readSyntaxSettings(bridge), async (saved) => {
      await saveConfigPage({ readPage: (page) => bridge.readPage(page), saveConfigPage: (text) => bridge.saveConfigPage!(text) }, (text) =>
        withConfigSettings(text, { [PATHS.syntaxHides]: saved.hideWidgets ? undefined : false, [PATHS.syntaxClicks]: saved.clickPlacesCursor ? undefined : false }),
      );
      syntaxWatcher?.settingsChanged(saved);
      return undefined;
    }),
  ];
  await app.start(silverBulletStore(bridge, writer));
}

/**
 * A grid drawn, as SilverBullet's custom syntax (the init page's `syntax.define`) asks with its body; before Silverware
 * Layout is started (no API handed over yet), its cells' markdown shown as text
 */
export function renderGrid(body: unknown): Promise<HTMLElement> | HTMLElement {
  if (grids) return grids.render(String(body));
  const plain = document.createElement("pre");
  plain.className = "swl-grid-plain";
  plain.textContent = String(body);
  return plain;
}

/**
 * A page opened (editor:pageLoaded): its name and its frontmatter's `_layout.width` as the page's meta has them, read
 * by the init page's Lua and given here, so the width is set at once, before the page is painted (each call of the
 * bridge from here is a promise answered later: reading the text took frames)
 */
export function pageLoaded(page: unknown, width: unknown): void {
  app.pageLoaded(String(page), readTextWidth(width));
}

/** The page open read again from its text (as Silverware Layout starts, after an edit) */
export function pageOpened(): Promise<void> {
  return app.pageOpened();
}

/** The page edited (editor:pageModified): its width read again once it is still a moment */
export function pageEdited(): void {
  app.pageEdited();
  // A grid's `<grid>` line edited changes no body SilverBullet draws a grid anew for: its columns set again
  grids?.refreshSoon();
}

// The bridge handed over last (for the slash commands)
let current: Bridge | undefined;
// What follows SilverBullet's markdown shown as written (its settings read as it checks the mode)
let syntaxWatcher: ReturnType<typeof watchSyntaxMode> | undefined;

/** The settings of the markdown shown as written, as SilverBullet's configuration has them */
async function readSyntaxSettings(bridge: Bridge): Promise<SyntaxModeSettings> {
  if (!bridge.getConfig) return { hideWidgets: true, clickPlacesCursor: true };
  const [hides, clicks] = await Promise.all([bridge.getConfig(PATHS.syntaxHides, true), bridge.getConfig(PATHS.syntaxClicks, true)]);
  return readSyntaxModeSettings((path) => (path === PATHS.syntaxHides ? hides : path === PATHS.syntaxClicks ? clicks : undefined));
}

/**
 * A page being indexed (the init page's page:index listener): the relations of the links in its grids, its hashtags
 * there and their paragraphs, for the index (SilverBullet's own sees nothing in a grid); none where it has no grid
 */
export function gridIndexObjects(page: unknown, text: unknown, lastModified?: unknown): Record<string, unknown>[] | undefined {
  const source = String(text ?? "");
  if (!source.includes("<grid")) return undefined;
  const { tags, paragraphs } = gridTags(source);
  const objects = [...gridRelations(String(page), gridLinks(String(page), source), lastModified), ...gridTagObjects(String(page), tags, paragraphs)];
  return objects.length ? objects : undefined;
}

/** The slash commands, as the init page defines them */
export function slashCommands(): { name: string; description: string }[] {
  return [{ name: "grid", description: "Columns: a grid of two cells side by side" }];
}

/** A slash command run: `/grid` puts a new grid at the cursor, the cursor in its first cell */
export async function runSlashCommand(name: string): Promise<void> {
  const bridge = current;
  if (name !== "grid" || !bridge?.getCursor) return;
  const [text, at] = await Promise.all([bridge.getText(), bridge.getCursor()]);
  const edit = gridInsertion(String(text), Number(at) || 0);
  await bridge.replaceRange(edit.from, edit.to, edit.insert);
  await bridge.moveCursor?.(edit.cursor);
}

/** The commands, as the init page defines them */
export function commandNames(): string[] {
  return [PAGE_LAYOUT, PUT_INTO_GRID];
}

export async function runCommand(name: string): Promise<void> {
  if (name === PAGE_LAYOUT) await app.openDialog();
  if (name === PUT_INTO_GRID) await putInto();
}

/** Put into grid: the selection's blocks, the mode given (a toolbar's button) or asked */
function putInto(given?: Parameters<typeof putIntoGrid>[1]): Promise<void> {
  if (!current) return Promise.resolve();
  return putIntoGrid(silverBulletPutHost(current, pageWriter(silverBulletPlatform(current))), given);
}

/** Silverware Toolbar's actions (its public API's definitions, handed over by the init page): Put into grid, its mode a parameter */
export function toolbarActions(): unknown[] {
  return [
    {
      name: "layoutPutIntoGrid",
      label: "Put into grid",
      icon: "lucide:layout-grid",
      group: "Layout",
      keywords: ["grid", "columns", "gallery", "side by side", "split"],
      params: [{ key: "mode", label: "Mode", choices: [{ value: "", label: "Ask" }, ...GRID_MODES.map(({ mode, name }) => ({ value: mode, label: name }))] }],
      describe: (args: { readonly mode?: unknown }) => {
        const mode = GRID_MODES.find((one) => one.mode === args.mode);
        return mode ? `Put into grid: ${mode.name.toLowerCase()}` : undefined;
      },
      perform: (context: { readonly from: number; readonly to: number }, _editor: unknown, args: { readonly mode?: unknown } = {}) =>
        putInto({ ...(isGridMode(args.mode) ? { mode: args.mode } : {}), from: context.from, to: context.to }),
    },
  ];
}

/** What Silverware Layout reads and saves, SilverBullet's way */
function silverBulletStore(bridge: Bridge, writer: PageWriter): LayoutStore {
  // A setting saved into CONFIG as SilverBullet's Configuration Manager saves it (indexed, the configuration loaded again)
  const saveConfig = (values: Readonly<Record<string, unknown>>, marker?: string) =>
    saveConfigPage({ readPage: (page) => bridge.readPage(page), saveConfigPage: (text) => bridge.saveConfigPage!(text) }, (text) => withConfigSettings(text, values, marker));
  return {
    canSaveSettings: !!bridge.saveConfigPage,
    readSettings: () => settingsOf(bridge),
    readPage: async () => {
      const [page, text] = await Promise.all([bridge.getCurrentPage(), bridge.getText()]);
      return { page: String(page), width: pageLayoutOf(String(text)).width };
    },
    savePageWidth: async (page, width) => writePageWidth(writer, page, String(await bridge.getText()), width),
    // In the Configuration Manager's block of CONFIG (it shows it, Ctrl-,), as the other plugins save theirs
    saveTextWidth: (width) => saveConfig({ [PATHS.textWidth]: width ? cssWidth(width) : undefined }),
    // In Silverware Layout's own block: a list, which the Configuration Manager would lose
    saveGuides: (guides) => saveConfig({ [PATHS.guides]: keptGuides(guides) }, OWN_MARKER),
    saveFont: (fontSize, fontZoom) => saveConfig({ [PATHS.fontSize]: fontSize === undefined ? undefined : `${fontSize}px`, [PATHS.fontZoom]: fontZoom ? undefined : false }),
    readZoom: () => readDeviceZoom(window),
    keepZoom: (size) => keepDeviceZoom(window, size),
    confirm: async (question) => (bridge.confirm ? !!(await bridge.confirm(question)) : globalThis.confirm(question)),
    flash: (message, type) => void bridge.flash(message, type),
  };
}

/** The settings as configured (none read: the defaults) */
async function settingsOf(bridge: Bridge): Promise<Settings> {
  if (!bridge.getConfig) return { textWidth: undefined, minPaneWidth: DEFAULT_MIN_PANE_WIDTH, guides: DEFAULT_GUIDES, fontSize: undefined, fontZoom: true };
  const values = new Map<string, unknown>();
  for (const path of Object.values(PATHS)) values.set(path, await bridge.getConfig(path, undefined));
  return readSettings((path) => values.get(path));
}
