// Silverware Tags entry point, loaded by the library page's Space Lua:
//   js.importFromSpace("Library/damesene/silverware-tags.js").init({ ... the bridge ... })
// then its commands defined by `commandNames()`, each running `runCommand(name)`.
import { type Bridge, missingBridgeFunctions, readSettings } from "./bridge.ts";
import { Controller } from "./core/controller.ts";
import { createModules } from "./modules.ts";
import type { Notifier, Space } from "./space/space.ts";
import { silverBulletNotifier, silverBulletSpace } from "./space/silverbullet.ts";

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
  await start(silverBulletSpace(bridge), silverBulletNotifier(bridge), await readSettings(bridge));
}

/** The core and the modules on, over a space (SilverBullet's, or the playground's) */
export async function start(space: Space, notifier: Notifier, settings: Awaited<ReturnType<typeof readSettings>>): Promise<Controller> {
  const controller = new Controller(document, space, notifier);
  controller.setModules(createModules(settings.modules, controller.host));
  slot[GLOBAL_KEY] = controller;
  return controller;
}

/** The commands' names, for the library page to define them (the core's and those of the modules on) */
export function commandNames(): string[] {
  return slot[GLOBAL_KEY]?.commands().map((command) => command.name) ?? [];
}

/** A command run (the library page's commands call it) */
export function runCommand(name: string): Promise<void> {
  return slot[GLOBAL_KEY]?.runCommand(name) ?? Promise.resolve();
}
