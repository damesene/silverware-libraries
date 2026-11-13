// Silverware Assets in SilverBullet: the files a page embeds and links decorated (decorate.ts) over SilverBullet's
// page (host/silverbullet/assets.ts), the types of file and actions registered (core/registry.ts: the built-in ones,
// others through `api`, shared/assets.ts). Silverware Layout, where it is installed, is used through its API alone
// (handed over by the init page): a medium's width by its handle (a provider registered, shared/layout.ts), what its
// grids draw outside the editor (shared/rendered.ts).
import { layoutOf } from "../../shared/layout.ts";
import { applyLayers } from "../../shared/layers.ts";
import { pageWriter } from "../../shared/pages/writer.ts";
import { renderedOf } from "../../shared/rendered.ts";
import { type Bridge, missingBridgeFunctions } from "./bridge.ts";
import { registerBuiltins } from "./builtin/index.ts";
import { AssetRegistry } from "./core/registry.ts";
import { AssetDecorator, type AssetHost } from "./decorate.ts";
import { silverBulletAssetHost } from "./host/silverbullet/assets.ts";
import { silverBulletPlatform } from "./host/silverbullet/platform.ts";
import { readAssetSettings } from "./model/settings.ts";
import { assetProvider } from "./provider.ts";

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

/** Silverware Assets' API, as its API page hands it to other plugins (`silverware.assets.api`): types of file and actions (shared/assets.ts) */
export const api = registry.api();

// The files decorated, one per window (its observers live as long), its host the bridge handed over last
let decorator: AssetDecorator | undefined;

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
}
