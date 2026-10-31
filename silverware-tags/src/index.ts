// Silverware Tags entry point, loaded by the library page's Space Lua:
//   js.importFromSpace("Library/damesene/silverware-tags.js").init({ ... the bridge ... })
// then its commands defined by `commandNames()`, each running `runCommand(name)`.
import { saveConfigPage, withConfigSettings } from "../../shared/configpage.ts";
import { type Bridge, missingBridgeFunctions, readSettings, type Settings } from "./bridge.ts";
import { Controller } from "./core/controller.ts";
import { PANEL_OFFER, type PanelOffer, type PanelRow } from "./core/offers.ts";
import { createModules } from "./modules.ts";
import type { Notifier, Space } from "./space/space.ts";
import { silverBulletNotifier, silverBulletSpace } from "./space/silverbullet.ts";
import { SettingsDialog, type SettingsStore } from "./settings.ts";

export const version = "0.1.0";

// One controller per window, even if the module is loaded again (e.g. after an update)
const GLOBAL_KEY = "__silverwareTags";
const slot = globalThis as unknown as Record<string, Controller | undefined>;

export async function init(bridge: Bridge): Promise<void> {
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Tags: the library page did not hand over ${missing.join(", ")}`);
    return;
  }
  const space = silverBulletSpace(bridge);
  const notifier = silverBulletNotifier(bridge);
  const store: SettingsStore = {
    read: () => readSettings(bridge),
    canSave: !!bridge.saveConfigPage,
    // In the Configuration Manager's block of CONFIG (it shows them, Ctrl-,), as the other plugins save theirs
    save: (values) => saveConfigPage({ readPage: (name) => bridge.readPage(name), saveConfigPage: (text) => bridge.saveConfigPage!(text) }, (text) => withConfigSettings(text, values)),
    reload: async () => {
      if (bridge.reloadUI) await bridge.reloadUI();
      else globalThis.location?.reload();
    },
    confirm: async (question) => (bridge.confirm ? !!(await bridge.confirm(question)) : globalThis.confirm(question)),
    flash: (message, type) => notifier.flash(message, type),
  };
  await start(space, notifier, await readSettings(bridge), store);
}

/** The core and the modules on, over a space (SilverBullet's, or the playground's); the settings dialog where a store is given */
export async function start(space: Space, notifier: Notifier, settings: Settings, store?: SettingsStore): Promise<Controller> {
  const dialog = store ? new SettingsDialog(document, store) : undefined;
  const controller = new Controller(document, space, notifier, { protectMeta: settings.protectMeta, settings: dialog ? () => dialog.open() : undefined });
  controller.setModules(createModules(settings.modules, (name) => controller.hostFor(name)));
  slot[GLOBAL_KEY] = controller;
  shown = settings;
  return controller;
}

// The settings Silverware Tags runs with
let shown: Settings | undefined;

/** Whether the panel shows SilverBullet's own tags apart (Meta), as they are not left out (the setting) */
export function panelMetaApart(): boolean {
  return !(shown?.protectMeta ?? true);
}

/** The commands' names, for the library page to define them (the core's and those of the modules on) */
export function commandNames(): string[] {
  return slot[GLOBAL_KEY]?.commands().map((command) => command.name) ?? [];
}

/** A command run (the library page's commands call it) */
export function runCommand(name: string): Promise<void> {
  return slot[GLOBAL_KEY]?.runCommand(name) ?? Promise.resolve();
}

// The tags' panel (the panel module's offer), for whatever draws it: the library page's Lua makes SilverBullet's
// navigator view of these; the JS knows nothing of how it is drawn
const panel = () => slot[GLOBAL_KEY]?.offered<PanelOffer>(PANEL_OFFER);

/** Whether the panel module is on (the library page defines the view only then) */
export function panelOn(): boolean {
  return !!panel();
}

/** The panel's rows: a tag each, its name the tree's path */
export async function panelRows(): Promise<PanelRow[]> {
  return [...((await panel()?.rows()) ?? [])];
}

export function panelSelect(tag: string): Promise<void> {
  return panel()?.select(tag) ?? Promise.resolve();
}

export function panelRename(tag: string): Promise<void> {
  return panel()?.rename(tag) ?? Promise.resolve();
}

export function panelMove(tag: string, to: string): Promise<void> {
  return panel()?.move(tag, to) ?? Promise.resolve();
}
