// SilverBullet's commands as `system.listCommands()` gives them, read once for every plugin: names, keys off a Mac
// and on one, hidden; a list as Lua hands it over; what is no command left out.
import { describe, expect, it } from "vitest";
import { commandsOf, shortcutsOn } from "./commands.ts";

describe("SilverBullet's commands", () => {
  it("are read with their keys off a Mac and on one, a key one or a list, and whether hidden; what is no command left out", () => {
    const commands = commandsOf({
      "Navigate: Tree": { name: "Navigate: Tree", key: ["Ctrl-o", "Ctrl-Shift-o"], mac: ["Cmd-o", "Cmd-Shift-o"] },
      "Delete Line": { name: "Delete Line", key: "Ctrl-d" },
      Secret: { name: "Secret", hide: true },
      x: 3,
      y: { name: "" },
    });
    expect(commands).toEqual([
      { name: "Navigate: Tree", keys: ["Ctrl-o", "Ctrl-Shift-o"], macKeys: ["Cmd-o", "Cmd-Shift-o"], hidden: false },
      { name: "Delete Line", keys: ["Ctrl-d"], macKeys: [], hidden: false },
      { name: "Secret", keys: [], macKeys: [], hidden: true },
    ]);
    expect(shortcutsOn(commands[0]!, true)).toEqual(["Cmd-o", "Cmd-Shift-o"]);
    expect(shortcutsOn(commands[1]!, true)).toEqual(["Ctrl-d"]);
  });

  it("are read of a list as Lua hands it over, its items and a key's list under 1, 2, …; none of what is no list", () => {
    expect(commandsOf({ 1: { name: "Navigate: Tree", key: { 1: "Ctrl-o", 2: "Ctrl-Shift-o" } } })).toEqual([{ name: "Navigate: Tree", keys: ["Ctrl-o", "Ctrl-Shift-o"], macKeys: [], hidden: false }]);
    expect(commandsOf(undefined)).toEqual([]);
    expect(commandsOf("commands")).toEqual([]);
  });
});
