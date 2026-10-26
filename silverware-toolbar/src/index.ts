// Silverware Toolbar entry point, loaded by the library page's Space Lua:
//   js.importFromSpace("Library/damesene/silverware-toolbar.js").init({ ... editor functions ... })
import { saveConfigPage, withConfigSettings } from "../../shared/configpage.ts";
import { actionsOf, customActionsAnew, defineCustomActions } from "./actions.ts";
import { type Bridge, missingBridgeFunctions, PATHS, readSettings, type Settings } from "./bridge.ts";
import type { Action } from "./core/action.ts";
import { Controller } from "./core/controller.ts";
import { customFormatsAnew, defineCustomFormats, formatsOf } from "./formats/index.ts";
import { createActions } from "./modules.ts";
import { SettingsDialog } from "./settings/dialog.ts";

export const version = "0.1.0";

// One controller per window, even if the module is loaded again (e.g. after an update)
const GLOBAL_KEY = "__silverwareToolbar";

const slot = globalThis as unknown as Record<string, Controller | undefined>;

// The toolbar's own block of the CONFIG page, for tables (the favourites): the
// Configuration Manager's block would lose them on its next save (shared/configpage.ts)
export const OWN_MARKER = "-- managed-by: silverware-toolbar";

// The bridge and the actions of the toolbar started last, for the settings dialog
let current: { readonly bridge: Bridge; readonly actions: () => readonly Action[] } | undefined;
let settingsDialog: SettingsDialog | undefined;

export async function init(bridge: Bridge): Promise<void> {
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Toolbar: the library page did not hand over ${missing.join(", ")}`);
    return;
  }
  const settings = await readSettings(bridge);
  const running = slot[GLOBAL_KEY];
  // SilverBullet loads its configuration again (CONFIG saved) and hands a new bridge over: with the same settings
  // the toolbar as it is takes it, a popup open staying open
  if (running && current && sameSettings(running, settings)) {
    running.bridge = bridge;
    current = { ...current, bridge };
    return;
  }
  // The one before stopped only now: init may be called again meanwhile (Space Lua loaded twice), each stops the last
  running?.stop();
  const actions = createActions(settings.modules, { listCommands: bridge.listCommands, invokeCommand: bridge.invokeCommand, wordAtCaret: settings.wordAtCaret });
  const controller = new Controller(document, bridge, settings, actions, () => void openSettings());
  slot[GLOBAL_KEY] = controller;
  current = { bridge, actions };
  controller.start();
}

/** Whether settings can be saved through the bridge (the CONFIG page, or a store of its own) */
function canSaveIn(bridge: Bridge): boolean {
  return !!bridge.saveSettings || (!!bridge.readPage && !!bridge.saveConfigPage);
}

/** Whether the toolbar running has the settings read */
function sameSettings(running: Controller, settings: Settings): boolean {
  const modules = [...running.settings.modules].sort().join();
  return (
    modules === [...settings.modules].sort().join() &&
    running.settings.placement === settings.placement &&
    running.settings.show === settings.show &&
    running.settings.wordAtCaret === settings.wordAtCaret &&
    JSON.stringify(running.settings.favorites) === JSON.stringify(settings.favorites)
  );
}

/** The "Silverware Toolbar: Show actions" command (its key too): the popup of every action, under the toolbar by the selection or the caret */
export function showActions(): void {
  void slot[GLOBAL_KEY]?.showActions();
}

/** The "Silverware Toolbar: Settings" command (the popup's last item too): the settings dialog */
export async function openSettings(): Promise<void> {
  if (!current || settingsDialog?.isOpen) return;
  const { bridge, actions } = current;
  settingsDialog = new SettingsDialog({
    doc: document,
    bridge,
    actions,
    canSave: canSaveIn(bridge),
    save: (values) => saveSettings(bridge, values),
    // The toolbar started anew with them (favourites need no reload)
    saved: () => void init(bridge),
  });
  await settingsDialog.open();
}

/**
 * Settings saved where SilverBullet keeps them: the CONFIG page, values in the
 * Configuration Manager's block (it shows them, Ctrl-,), the favourites in the
 * toolbar's own; or the bridge's own store (the playground's)
 */
async function saveSettings(bridge: Bridge, values: Readonly<Record<string, unknown>>): Promise<void> {
  if (bridge.saveSettings) {
    await bridge.saveSettings(values);
    return;
  }
  if (!bridge.readPage || !bridge.saveConfigPage) throw new Error("no configuration page to save to");
  const { [PATHS.favorites]: favorites, ...scalars } = values;
  const tables = PATHS.favorites in values ? { [PATHS.favorites]: favorites } : {};
  await saveConfigPage(
    { readPage: (name) => bridge.readPage!(name), saveConfigPage: (text) => bridge.saveConfigPage!(text) },
    (text) => withConfigSettings(withConfigSettings(text, scalars), tables, OWN_MARKER),
  );
}

/**
 * `silverware.toolbar.defineFormats` (the library page's Space Lua): custom
 * formats, a definition, a list, or a function given the helpers that returns
 * them, usually a JS module of the space. The others defined; what is wrong
 * with any of them (or a name defined twice), which the library page shows as
 * a notification (an error there would stop the rest of the user's script).
 */
export function defineFormats(definitions: unknown): string | undefined {
  const { formats, problems } = formatsOf(definitions);
  const again = defineCustomFormats(formats);
  return report("formats", problems, again);
}

/** `silverware.toolbar.defineActions`: custom actions with code of their own, as `defineFormats` takes formats */
export function defineActions(definitions: unknown): string | undefined {
  const { actions, problems } = actionsOf(definitions);
  const again = defineCustomActions(actions);
  return report("actions", problems, again);
}

/** Space Lua is loaded (again): the custom definitions are made anew, replacing those of before */
export function resetDefinitions(): void {
  customFormatsAnew();
  customActionsAnew();
}

function report(what: string, problems: readonly string[], again: readonly string[]): string | undefined {
  const lines = [
    ...(problems.length ? [`custom ${what} not defined: ${problems.join("; ")}`] : []),
    ...(again.length ? [`custom ${what} defined again (the last definition counts): ${again.join(", ")}`] : []),
  ];
  return lines.length ? `Silverware Toolbar: ${lines.join(". ")}` : undefined;
}
