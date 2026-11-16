// SilverBullet's commands as `system.listCommands()` gives them (the init page's Lua hands the function over), read in
// one place: Silverware Toolbar's commands module (their names, the hidden ones left out) and shared/silverbullet/
// keptkeys.ts (their shortcuts) take them from here. Pure.

/** A command of SilverBullet's: its name, its shortcuts off a Mac and on one (by CodeMirror's names), whether it is hidden */
export type CommandDefinition = {
  readonly name: string;
  readonly keys: readonly string[];
  // None given: a Mac takes `keys`, as SilverBullet does
  readonly macKeys: readonly string[];
  readonly hidden: boolean;
};

/** A list as Lua hands it over: an array, or a table as an object with its items under 1, 2, … (or by name) */
function itemsOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value && typeof value === "object" ? Object.values(value) : [];
}

/** A key or its list, as a command gives it */
function keysOf(value: unknown): string[] {
  return (typeof value === "string" ? [value] : itemsOf(value)).filter((one): one is string => typeof one === "string" && one.trim() !== "");
}

/** The commands of what `system.listCommands()` gives (by name, each `{ name, key, mac, hide }`, a key one or a list); what is no command left out */
export function commandsOf(listed: unknown): CommandDefinition[] {
  return itemsOf(listed).flatMap((command): CommandDefinition[] => {
    if (!command || typeof command !== "object") return [];
    const { name, key, mac, hide } = command as { name?: unknown; key?: unknown; mac?: unknown; hide?: unknown };
    if (typeof name !== "string" || !name) return [];
    return [{ name, keys: keysOf(key), macKeys: keysOf(mac), hidden: hide === true }];
  });
}

/** A command's shortcuts on this keyboard: a Mac's where it gives them, else its others */
export function shortcutsOn(command: CommandDefinition, mac: boolean): readonly string[] {
  return mac && command.macKeys.length ? command.macKeys : command.keys;
}
