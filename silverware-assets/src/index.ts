// Silverware Assets in SilverBullet: the files a page embeds and links decorated (decorate.ts) over SilverBullet's
// page (host/silverbullet/assets.ts), the types of file and actions registered (core/registry.ts: the built-in ones,
// others through `api`, shared/assets.ts). Silverware Layout, where it is installed, is used through its API alone
// (handed over by the init page): a medium's width by its handle (a provider registered, shared/layout.ts), what its
// grids draw outside the editor (shared/rendered.ts).
import { saveConfigPage, withConfigSettings } from "../../shared/configpage.ts";
import { layoutOf } from "../../shared/layout.ts";
import { applyLayers } from "../../shared/layers.ts";
import { pageWriter } from "../../shared/pages/writer.ts";
import { renderedOf } from "../../shared/rendered.ts";
import { type SyntaxModeWatcher, watchSyntaxMode } from "../../shared/syntaxmode.ts";
import { type Bridge, missingBridgeFunctions } from "./bridge.ts";
import { registerBuiltins } from "./builtin/index.ts";
import { AssetRegistry } from "./core/registry.ts";
import { type ListedFile, orphanedPreviews } from "./core/stored.ts";
import { AssetDecorator, type AssetHost } from "./decorate.ts";
import { factsOf, silverBulletAssetHost } from "./host/silverbullet/assets.ts";
import { silverBulletPlatform } from "../../shared/silverbullet/platform.ts";
import { ASSETS_PATH, readAssetSettings, readSyntaxModeSettings, storedAssetPaths, SYNTAX_PATHS, type SyntaxModeSettings } from "./model/settings.ts";
import { SILVERBULLET_SYNTAX_PAGE, SYNTAX_OPTION } from "./host/silverbullet/syntaxmode.ts";
import { assetProvider } from "./provider.ts";
import { mediaTabs } from "./ui/mediatab.ts";
import { markdownTab, SettingsWindow } from "./ui/settingswindow.ts";

const SETTINGS = "Silverware Assets: Settings";
const CLEAN_UP = "Silverware Assets: Clean up previews";
// Silverware Assets' own block of CONFIG: its tables, which the Configuration Manager's block would lose (shared/configpage.ts)
const OWN_MARKER = "-- managed-by: silverware-assets";

// The bridge handed over last (a problem told through it)
let current: Bridge | undefined;

/** A problem said to the user, the console's before a start */
function problem(message: string): void {
  if (current) void current.flash(message, "error");
  else console.error(message);
}

// The types of file and the actions, one registry per window: the module is imported once, so `api` is the same object
// as Space Lua loads again, and a type registered again (its plugin's init page run again) replaces its own
const registry = new AssetRegistry(problem);
registerBuiltins(registry);

// The files drawn again as another plugin registers a type or an action (its init page may run after the page's files
// were drawn: a PDF's preview drawn as the browser's viewer before Silverware Assets PDF registered its own), once for a burst
// of them
const REDRAW_MS = 50;
let redraw: ReturnType<typeof setTimeout> | undefined;
registry.onChange(() => {
  clearTimeout(redraw);
  redraw = setTimeout(() => void decorator?.redecorateAll(), REDRAW_MS);
});

/** Silverware Assets' API, as its API page hands it to other plugins (`silverware.assets.api`): types of file and actions (shared/assets.ts) */
export const api = registry.api();

// The files decorated, one per window (its observers live as long), its host the bridge handed over last
let decorator: AssetDecorator | undefined;
// What follows SilverBullet's markdown shown as written, one per window (its settings read as it checks the mode)
let syntaxWatcher: SyntaxModeWatcher<SyntaxModeSettings> | undefined;

/** The settings of the markdown shown as written, as SilverBullet's configuration has them */
async function readSyntaxSettings(bridge: Bridge): Promise<SyntaxModeSettings> {
  if (!bridge.getConfig) return { hideAssets: true, clickPlacesCursor: true };
  const [hides, clicks] = await Promise.all([bridge.getConfig(SYNTAX_PATHS.hides, true), bridge.getConfig(SYNTAX_PATHS.clicks, true)]);
  return readSyntaxModeSettings((path) => (path === SYNTAX_PATHS.hides ? hides : path === SYNTAX_PATHS.clicks ? clicks : undefined));
}

/** Started by the init page (again as Space Lua loads again): SilverBullet's API handed over, Silverware Layout's where it is installed */
export function init(bridge: Bridge): void {
  // The layers its style page lays its elements in (shared/layers.ts)
  applyLayers(document);
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Assets: the init page did not hand over ${missing.join(", ")}`);
    return;
  }
  current = bridge;
  const layout = layoutOf(bridge.layout);
  const rendered = renderedOf((bridge.layout as { readonly rendered?: unknown } | undefined)?.rendered);
  const writer = pageWriter(silverBulletPlatform(bridge));
  const raw = silverBulletAssetHost(bridge, writer, document, rendered);
  const host: AssetHost = { ...raw, settings: async () => readAssetSettings(await raw.settings()).settings };
  const fresh = !decorator;
  if (decorator) decorator.useHost(host);
  else decorator = new AssetDecorator(document, host, registry);
  // A medium's width laid out by Silverware Layout's handle, as a widget's (registered again: the one of its name
  // replaced), laid out again as a frame is decorated
  layout.register(assetProvider(decorator));
  decorator.onDecorated = () => layout.layOutAgain?.();
  if (fresh) decorator.start();
  // Files drawn in the fields of Silverware Layout's grids as in the page (shared/rendered.ts `drawEmbeds`)
  const drawing = decorator;
  rendered.drawEmbeds?.((markdown, page) => drawing.editorEmbed(markdown, page));
  // The markdown shown as written (SilverBullet's mode): the files hidden then, a link's click the cursor's, as the
  // settings say (read as the mode is asked, again as the settings window saves them)
  syntaxWatcher ??= watchSyntaxMode<SyntaxModeSettings>(document, {
    page: SILVERBULLET_SYNTAX_PAGE,
    shown: () => current?.getUiOption?.(SYNTAX_OPTION),
    read: () => (current ? readSyntaxSettings(current) : { hideAssets: true, clickPlacesCursor: true }),
    same: (a, b) => a.hideAssets === b.hideAssets && a.clickPlacesCursor === b.clickPlacesCursor,
    marks: (settings) => ({ "data-swa-syntax-shown": settings.hideAssets, "data-swa-syntax-clicks": settings.clickPlacesCursor }),
    placesCursor: (settings) => settings.clickPlacesCursor,
    textMark: "data-swa-text",
    initial: { hideAssets: true, clickPlacesCursor: true },
  });
}

/** The commands, as the init page defines them */
export function commandNames(): string[] {
  return [SETTINGS, CLEAN_UP];
}

export async function runCommand(name: string): Promise<void> {
  if (name === SETTINGS) await openSettings();
  if (name === CLEAN_UP) await cleanUpPreviews().catch((error: unknown) => current?.flash(`Silverware Assets: previews not cleaned up: ${error instanceof Error ? error.message : String(error)}`, "error"));
}

/** The previews kept of files gone (deleted, renamed) or of their versions gone (replaced) taken away, said how many (core/stored.ts) */
async function cleanUpPreviews(): Promise<void> {
  const bridge = current;
  if (!bridge?.listFiles || !bridge.deleteDocument) return void bridge?.flash("Silverware Assets: this SilverBullet hands over no way to list and delete files", "error");
  const listed = await bridge.listFiles();
  const metas = Array.isArray(listed) ? listed : listed && typeof listed === "object" ? Object.values(listed) : [];
  const files = metas.flatMap((meta: unknown): ListedFile[] => {
    const name = (meta as { name?: unknown } | null)?.name;
    if (typeof name !== "string") return [];
    const facts = factsOf(meta);
    return [{ name, ...(facts ? { facts } : {}) }];
  });
  const gone = orphanedPreviews(files);
  let failed = 0;
  // (Each on its own: one that fails, the rest still taken away)
  for (const path of gone) {
    try {
      await bridge.deleteDocument(path);
    } catch {
      failed++;
    }
  }
  const done = gone.length - failed;
  bridge.flash(
    done ? `Silverware Assets: ${done} preview${done === 1 ? "" : "s"} of files gone or changed taken away${failed ? `, ${failed} not` : ""}` : failed ? `Silverware Assets: ${failed} previews could not be taken away` : "Silverware Assets: no preview of a file gone or changed",
    failed ? "error" : "info",
  );
}

// The settings window, made as it is first opened
let settingsWindow: SettingsWindow | undefined;

/** The settings window: the settings as configured, the types and actions registered; saved into CONFIG */
async function openSettings(): Promise<void> {
  const bridge = current;
  const shown = decorator;
  if (!bridge || !shown) return;
  const save = (values: Readonly<Record<string, unknown>>, marker?: string) =>
    saveConfigPage({ readPage: (page) => bridge.readPage(page), saveConfigPage: (text) => bridge.saveConfigPage!(text) }, (text) => withConfigSettings(text, values, marker));
  const [settings, syntax] = await Promise.all([readAssetSettings(bridge.getConfig ? await bridge.getConfig(ASSETS_PATH, undefined) : undefined).settings, readSyntaxSettings(bridge)]);
  const input = {
    settings,
    types: registry.types.all.map(({ name, icon }) => ({ name, icon })),
    // (Those of a gesture: a menu's own, a copy, no click's)
    actions: registry.actions.all.filter((action) => action.gesture !== false).map(({ name, label }) => ({ name, ...(label ? { label } : {}) })),
  };
  settingsWindow ??= new SettingsWindow(document);
  settingsWindow.open(
    [
      ...mediaTabs(document, input, async (saved) => {
        await save(storedAssetPaths(saved), OWN_MARKER);
        await shown.redecorateAll();
        return undefined;
      }),
      markdownTab(document, syntax, async (saved) => {
        await save({ [SYNTAX_PATHS.hides]: saved.hideAssets ? undefined : false, [SYNTAX_PATHS.clicks]: saved.clickPlacesCursor ? undefined : false });
        syntaxWatcher?.settingsChanged(saved);
        return undefined;
      }),
    ],
    { canSave: !!bridge.saveConfigPage, confirm: async (question) => (bridge.confirm ? !!(await bridge.confirm(question)) : globalThis.confirm(question)) },
  );
}
