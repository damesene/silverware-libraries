// The commands module: every SilverBullet command (but those it hides) as an
// action, `commands.<its name>`, in the group Commands. There are many: the
// popup finds them by its search, and does not list them as it opens; any of
// them can be a favourite. Running one invokes it (SilverBullet's
// editor.invokeCommand) on the editor's selection. The list is read when the
// toolbar starts (Space Lua still loading: the user's commands not defined
// yet), again as the core asks (`refresh`: once Space Lua has loaded, and as
// the toolbar first shows after each load of it) and every few seconds as the
// actions are asked for (a plug's commands updated), one read after another.
import type { Action, ModuleHost, ToolbarModule } from "../core/action.ts";
import { ICONS } from "../icons.ts";

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

// How long a list read is used, as the actions are asked for, before it is read again
const FRESH_MS = 5000;

export function commandsModule(host: ModuleHost): ToolbarModule {
  let actions: readonly Action[] = [];
  // The reads one after another: the last one asked for answers last, its list the one used
  let reads: Promise<void> = Promise.resolve();
  /** The list read (after any read before it); rejected where it could not be, the list before kept */
  const read = (): Promise<void> => {
    const { listCommands, invokeCommand } = host;
    if (!listCommands || !invokeCommand) return Promise.resolve();
    const next = reads.catch(() => undefined).then(async () => {
      actions = commandActions(await listCommands(), (name) => invokeCommand(name));
    });
    reads = next;
    return next;
  };
  let readAt = 0;
  const logged = (e: unknown) => console.error("Silverware Toolbar: could not list SilverBullet's commands", e);
  const timed = () => {
    readAt = Date.now();
    return read();
  };
  timed().catch(logged);
  return {
    // Read again in the background every few seconds as they are asked for (a plug's commands updated): the list
    // read before meanwhile
    actions: () => {
      if (Date.now() - readAt > FRESH_MS) timed().catch(logged);
      return actions;
    },
    refresh: timed,
  };
}
