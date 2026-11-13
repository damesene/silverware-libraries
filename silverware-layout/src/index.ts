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
import { registerBuiltins } from "./assets/builtin/index.ts";
import { AssetRegistry } from "./assets/core/registry.ts";
import { AssetDecorator, type AssetHost } from "./assets/decorate.ts";
import { assetProvider } from "./assets/provider.ts";
import { mediaTab } from "./assets/ui/mediatab.ts";
import { ASSETS_PATH, readAssetSettings, storedAssetSettings } from "./assets/model/settings.ts";
import { silverBulletAssetHost } from "./host/silverbullet/assets.ts";
import { gridInsertion } from "./grid/core/insert.ts";
import { gridLinks } from "./grid/core/links.ts";
import { gridTags } from "./grid/core/tags.ts";
import { gridRelations, gridTagObjects } from "./host/silverbullet/gridindex.ts";
import { Grids } from "./grid/grids.ts";
import { gridProvider } from "./grid/provider.ts";
import { silverBulletGridHost } from "./host/silverbullet/grid.ts";
import { keepDeviceZoom, readDeviceZoom } from "./host/devicezoom.ts";
import { silverBulletPage } from "./host/silverbullet/dom.ts";
import { pageLayoutOf, writePageWidth } from "./host/silverbullet/page.ts";
import { silverBulletPlatform } from "./host/silverbullet/platform.ts";
import { DEFAULT_GUIDES, DEFAULT_MIN_PANE_WIDTH, keptGuides, PATHS, readSettings, type Settings } from "./model/settings.ts";
import { cssWidth, readTextWidth } from "./model/width.ts";

const PAGE_LAYOUT = "Silverware Layout: Page layout";
// Silverware Layout's own block of CONFIG: the guides, a list, which the Configuration Manager's block would lose
// (shared/configpage.ts)
const OWN_MARKER = "-- managed-by: silverware-layout";

// One registry per window: the module is imported once, so `api` is the same object as Space Lua loads again, and a
// provider registered again (its plugin's init page run again) replaces its own. One app per window as well (its
// observers and listeners live as long), started again with each load of Space Lua
const registry = new Registry((message) => app.problem(message));
const app = new LayoutApp(document, silverBulletPage(document), registry);

// The types of asset and actions (docs/silverware-layout-assets.md), one registry per window as the providers'
const assetRegistry = new AssetRegistry((message) => app.problem(message));
registerBuiltins(assetRegistry);

/** Silverware Layout's API, as its API page hands it to the widget plugins (`silverware.layout.api`): the widgets' providers, and `assets` (shared/assets.ts) */
export const api = Object.assign(registry.api(), { assets: assetRegistry.api() });

// The page's grids (docs/silverware-layout-grid.md), made as the init page hands SilverBullet's API over
let grids: Grids | undefined;
// The embedded media decorated, made as the API is handed over
let assets: AssetDecorator | undefined;

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
    grids.start();
    // A grid's width laid out as any widget's, registered as a widget plugin registers
    registry.register(gridProvider(grids));
    grids.onAttributes = () => app.layOutWidgets();
  }
  const raw = silverBulletAssetHost(bridge, writer, document);
  const assetHost: AssetHost = { ...raw, settings: async () => readAssetSettings(await raw.settings()).settings };
  if (assets) assets.useHost(assetHost);
  else {
    assets = new AssetDecorator(document, assetHost, assetRegistry);
    // A medium's width laid out as a widget's, registered as a widget plugin registers
    registry.register(assetProvider(assets));
    assets.onDecorated = () => app.layOutWidgets();
    assets.start();
  }
  // The Media tab of the Page layout dialog, made as it opens: the settings as configured, the types and actions registered
  const decorator = assets;
  app.dialogTabs = async () => {
    const settings = await assetHost.settings();
    const input = { settings, types: assetRegistry.types.all.map(({ name, icon }) => ({ name, icon })), actions: assetRegistry.actions.all.map(({ name, label }) => ({ name, ...(label ? { label } : {}) })) };
    return [
      mediaTab(document, input, async (saved) => {
        await saveConfigPage({ readPage: (page) => bridge.readPage(page), saveConfigPage: (text) => bridge.saveConfigPage!(text) }, (text) => withConfigSettings(text, { [ASSETS_PATH]: storedAssetSettings(saved) }, OWN_MARKER));
        await decorator.redecorateAll();
        return undefined;
      }),
    ];
  };
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
  return [PAGE_LAYOUT];
}

export async function runCommand(name: string): Promise<void> {
  if (name === PAGE_LAYOUT) await app.openDialog();
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
