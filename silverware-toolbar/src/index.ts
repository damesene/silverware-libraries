// Silverware Toolbar entry point, loaded by the library page's Space Lua:
//   js.importFromSpace("Library/damesene/silverware-toolbar.js").init({ ... editor functions ... })
import { actionsOf, customActionsAnew, defineCustomActions } from "./actions.ts";
import { type Bridge, missingBridgeFunctions, readSettings } from "./bridge.ts";
import { Controller } from "./core/controller.ts";
import { customFormatsAnew, defineCustomFormats, formatsOf } from "./formats/index.ts";
import { createActions } from "./modules.ts";

export const version = "0.1.0";

// One controller per window, even if the module is loaded again (e.g. after an update)
const GLOBAL_KEY = "__silverwareToolbar";

const slot = globalThis as unknown as Record<string, Controller | undefined>;

export async function init(bridge: Bridge): Promise<void> {
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Toolbar: the library page did not hand over ${missing.join(", ")}`);
    return;
  }
  const settings = await readSettings(bridge);
  // The one before stopped only now: init may be called again meanwhile (Space Lua loaded twice), each stops the last
  slot[GLOBAL_KEY]?.stop();
  const controller = new Controller(document, bridge, settings, createActions(settings.modules));
  slot[GLOBAL_KEY] = controller;
  controller.start();
}

/** The "Silverware Toolbar: Show actions" command (its key too): the popup of every action, under the toolbar by the selection or the caret */
export function showActions(): void {
  void slot[GLOBAL_KEY]?.showActions();
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
