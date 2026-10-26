// The commands module: every SilverBullet command (but those it hides) as an
// action, `commands.<its name>`, in the group Commands. There are many: the
// popup finds them by its search, and does not list them as it opens; any of
// them can be a favourite. Running one invokes it (SilverBullet's
// editor.invokeCommand) on the editor's selection. The list is read when the
// toolbar starts and again, at most every few seconds, as the actions are
// asked for (a command defined later): the list read before meanwhile.
import type { Action, ModuleHost, ToolbarModule } from "../core/action.ts";
import { ICONS } from "../icons.ts";

// How long a list read is used before it is read again
const FRESH_MS = 5000;

/** The commands of SilverBullet's list (system.listCommands: definitions by name) as actions, by name; hidden ones left out */
export function commandActions(list: unknown, invoke: (name: string) => unknown): Action[] {
  if (!list || typeof list !== "object") return [];
  const names = Object.values(list as Record<string, unknown>).flatMap((def): string[] => {
    if (!def || typeof def !== "object") return [];
    const { name, hide } = def as { name?: unknown; hide?: unknown };
    return typeof name === "string" && name && hide !== true ? [name] : [];
  });
  return [...new Set(names)]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      id: `commands.${name}`,
      label: name,
      icon: ICONS.command,
      group: "Commands",
      keywords: ["command"],
      listed: false,
      perform: () => invoke(name),
    }));
}

export function commandsModule(host: ModuleHost): ToolbarModule {
  let actions: readonly Action[] = [];
  let readAt = -Infinity;
  const read = async () => {
    const { listCommands, invokeCommand } = host;
    if (!listCommands || !invokeCommand) return;
    readAt = Date.now();
    try {
      actions = commandActions(await listCommands(), (name) => invokeCommand(name));
    } catch (e) {
      console.error("Silverware Toolbar: could not list SilverBullet's commands", e);
    }
  };
  void read();
  return {
    actions: () => {
      if (Date.now() - readAt > FRESH_MS) void read();
      return actions;
    },
  };
}
