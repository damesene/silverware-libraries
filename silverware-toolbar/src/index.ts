// Silverware Toolbar entry point, loaded by the init page's Space Lua:
//   js.importFromSpace("Library/damesene/silverware-toolbar.js").init({ ... editor functions ... })
import { saveConfigPage, withConfigSettings } from "../../shared/configpage.ts";
import { actionsOf, customActionsAnew, defineCustomActions } from "./actions.ts";
import { type Bridge, missingBridgeFunctions, OWN_MARKER, PATHS, readSettings, type Settings } from "./bridge.ts";
import type { Action } from "./core/action.ts";
import type { ItemKind } from "./core/items.ts";
import { type Toolbar, toolbarsSetting } from "./core/toolbars.ts";
import { SETTINGS_VERSION } from "./migrations/index.ts";
import { Controller, MORE_ACTION, SETTINGS_ACTION } from "./core/controller.ts";
import { customFormatsAnew, defineCustomFormats, formatsOf } from "./formats/index.ts";
import { createModules } from "./modules.ts";
import { SettingsDialog } from "./settings/dialog.ts";

export const version = "0.1.0";

// One controller per window, even if the module is loaded again (e.g. after an update)
const GLOBAL_KEY = "__silverwareToolbar";

const slot = globalThis as unknown as Record<string, Controller | undefined>;

// The bridge and the actions of the toolbar started last, for the settings dialog
let current: { readonly bridge: Bridge; readonly actions: () => readonly Action[]; readonly kinds: () => readonly ItemKind[] } | undefined;
let settingsDialog: SettingsDialog | undefined;

export async function init(bridge: Bridge): Promise<void> {
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Toolbar: the init page did not hand over ${missing.join(", ")}`);
    return;
  }
  const settings = await readSettings(bridge);
  const running = slot[GLOBAL_KEY];
  // SilverBullet loads its configuration again (CONFIG saved) and hands a new bridge over: with the same settings
  // the toolbar as it is takes it, a popup open staying open
  if (running && current && sameSettings(running, settings)) {
    running.bridge = bridge;
    // (Space Lua loaded again: commands may be new)
    running.reloaded();
    current = { ...current, bridge };
    return;
  }
  // The one before stopped only now: init may be called again meanwhile (Space Lua loaded twice), each stops the last
  running?.stop();
  // The editor's commands through the bridge this toolbar has now (SilverBullet hands a new one as it loads Space Lua
  // again: the controller's); before it is made, the one given
  let made: Controller | undefined;
  const latest = () => made?.bridge ?? bridge;
  const { actions, kinds, refresh } = createModules(settings.modules, {
    // (A bridge without them: the first one's, which has them)
    ...(bridge.listCommands ? { listCommands: () => (latest().listCommands ?? bridge.listCommands!)() } : {}),
    ...(bridge.invokeCommand ? { invokeCommand: (name: string) => (latest().invokeCommand ?? bridge.invokeCommand!)(name) } : {}),
    wordAtCaret: settings.wordAtCaret,
  });
  // The toolbar's: those for a touch screen only where this is one (the settings get every action)
  const touch = touchScreen();
  const offered = () => actions().filter((action) => touch || !action.touchOnly);
  const controller = new Controller(document, bridge, settings, offered, kinds, refresh, () => void openSettings(), (toolbars) => keepSwitched(bridge, toolbars));
  made = controller;
  slot[GLOBAL_KEY] = controller;
  current = { bridge, actions, kinds };
  controller.start();
  if (Object.keys(settings.migrated).length) void writeMigrated(bridge, settings.migrated);
}

// A switch of the toolbar being written, and the toolbars of a later one to write after it (the last one counts)
let switching: Promise<void> | undefined;
let nextSwitch: readonly Toolbar[] | undefined;

/**
 * The toolbars after a switch (`actions.switchToolbar`) kept: written as the
 * settings dialog writes them, one write at a time, only the last of switches
 * made meanwhile; SilverBullet then loads its configuration again and the
 * toolbar started for it finds the settings it runs (`sameSettings`), so it
 * goes on as it is. Where nothing can be written, the switch holds for this
 * visit; a failed write is said
 */
function keepSwitched(bridge: Bridge, toolbars: readonly Toolbar[]): void {
  if (!canSaveIn(bridge)) return;
  nextSwitch = toolbars;
  if (switching) return;
  switching = (async () => {
    while (nextSwitch) {
      const write = nextSwitch;
      nextSwitch = undefined;
      try {
        await saveSettings(bridge, { [PATHS.favorites]: toolbarsSetting(write), [PATHS.version]: SETTINGS_VERSION });
      } catch (e) {
        void bridge.flash(`Silverware Toolbar: the toolbar switched to could not be kept (${String(e)})`, "error");
      }
    }
    switching = undefined;
  })();
}

// The migrated settings being written (init may be called again meanwhile: Space Lua loaded twice, CONFIG saved)
let migrating = false;

/**
 * Settings of an older model, migrated as they were read, written back with
 * the model's version, so they are migrated once (migrations/index.ts); where
 * nothing can be written, they are migrated again as they are read
 */
async function writeMigrated(bridge: Bridge, values: Readonly<Record<string, unknown>>): Promise<void> {
  if (migrating || !canSaveIn(bridge)) return;
  migrating = true;
  try {
    await saveSettings(bridge, values);
    void bridge.flash(`Silverware Toolbar: your settings were updated to its version ${String(values[PATHS.version])} (CONFIG)`, "info");
  } catch (e) {
    console.error("Silverware Toolbar: the settings migrated could not be written", e);
  } finally {
    migrating = false;
  }
}

/** Whether this is a touch screen (an on-screen keyboard to hide), as the toolbar starts */
function touchScreen(): boolean {
  return !!globalThis.matchMedia?.("(pointer: coarse)").matches || (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
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
    running.settings.wordAtCaret === settings.wordAtCaret &&
    JSON.stringify(running.settings.toolbars) === JSON.stringify(settings.toolbars)
  );
}

/** SilverBullet ready, its Space Lua loaded (`system:ready`, the init page's listener): the actions read anew, a script's commands among them */
export function scriptsLoaded(): void {
  slot[GLOBAL_KEY]?.refreshActions();
}

/** The "Silverware Toolbar: Switch toolbar" command: the popup open at the toolbars to switch to (as *Toolbar*'s choices) */
export function switchToolbar(): void {
  const controller = slot[GLOBAL_KEY];
  if (controller) void controller.showActions(controller.switchAction());
}

/** The "Silverware Toolbar: Show actions" command (its key too): the popup of every action, under the toolbar by the selection or the caret */
export function showActions(): void {
  void slot[GLOBAL_KEY]?.showActions();
}

/** The "Silverware Toolbar: Settings" command (the popup's last item too): the settings dialog */
export async function openSettings(): Promise<void> {
  if (!current || settingsDialog?.isOpen) return;
  const { bridge, actions, kinds } = current;
  settingsDialog = new SettingsDialog({
    doc: document,
    bridge,
    // The modules' and the core's own (switching the toolbar, … and the settings: favourites too)
    actions: () => [...actions(), ...(slot[GLOBAL_KEY] ? [slot[GLOBAL_KEY]!.switchAction()] : []), MORE_ACTION, SETTINGS_ACTION],
    kinds,
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
  // Tables (the toolbars) in the toolbar's own block, the rest in the Configuration Manager's; a setting taken out
  // (undefined: a key of before, migrated) out of either, wherever it was written
  const { [PATHS.favorites]: favorites, ...scalars } = values;
  const gone = Object.fromEntries(Object.entries(values).filter(([, value]) => value === undefined));
  const tables = { ...gone, ...(PATHS.favorites in values ? { [PATHS.favorites]: favorites } : {}) };
  await saveConfigPage(
    { readPage: (name) => bridge.readPage!(name), saveConfigPage: (text) => bridge.saveConfigPage!(text) },
    (text) => withConfigSettings(withConfigSettings(text, scalars), tables, OWN_MARKER),
  );
}

/**
 * `silverware.toolbar.defineFormats` (the API page's Space Lua): custom
 * formats, a definition, a list, or a function given the helpers that returns
 * them, usually a JS module of the space. The others defined; what is wrong
 * with any of them (or a name defined twice), which the API page shows as
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
