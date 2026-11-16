// @vitest-environment jsdom
// SilverBullet's shortcuts a surface keeps from it: which keys are its (its commands', CodeMirror's editing left out),
// what is told, and when not (taken by the field, typing, the same again at once, nothing known of the commands).
import { describe, expect, it, vi } from "vitest";
import { keptKeys, messageOf, shortcutsOf } from "./keptkeys.ts";

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", { cancelable: true, ...init });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// As `system.listCommands()` gives them (SilverBullet 2.12.1): by name, a key one or a list, a Mac's apart
const LISTED = {
  "Open Command Palette": { name: "Open Command Palette", key: "Ctrl-/", mac: "Cmd-/" },
  "Navigate: Page Picker": { name: "Navigate: Page Picker", key: "Ctrl-k", mac: "Cmd-k" },
  "Navigate: Tree": { name: "Navigate: Tree", key: ["Ctrl-o", "Ctrl-Shift-o"], mac: ["Cmd-o", "Cmd-Shift-o"] },
  "Text: Listify Selection": { name: "Text: Listify Selection", key: "Ctrl-Shift-8", mac: "Cmd-Shift-8" },
  "Delete Line": { name: "Delete Line", key: "Ctrl-d" },
  "Journal: Today": { name: "Journal: Today", key: "Ctrl-q j" },
  "Quick Note": { name: "Quick Note", key: ["Ctrl-q q", "Ctrl-q Ctrl-q"] },
  "Task: Cycle State": { name: "Task: Cycle State", key: "Mod-. t" },
  "Editor: Cursor Line Up": { name: "Editor: Cursor Line Up", key: ["ArrowUp", "Ctrl-p"], mac: "ArrowUp" },
  "Page: Rename": { name: "Page: Rename" },
};

describe("SilverBullet's shortcuts", () => {
  it("are its commands' keys on this keyboard, a Mac's where a command gives one, CodeMirror's editing and commands without a key left out", () => {
    const off = shortcutsOf(LISTED, false);
    expect(off.map((one) => one.name)).not.toContain("Editor: Cursor Line Up");
    expect(off.map((one) => one.name)).not.toContain("Page: Rename");
    expect(off.find((one) => one.name === "Navigate: Tree")?.keys).toEqual(["Ctrl-o", "Ctrl-Shift-o"]);
    const mac = shortcutsOf(LISTED, true);
    expect(mac.find((one) => one.name === "Open Command Palette")?.keys).toEqual(["Cmd-/"]);
    expect(mac.find((one) => one.name === "Delete Line")?.keys).toEqual(["Ctrl-d"]);
  });

  it("are read of a list as Lua hands it over too, its items and a key's list under 1, 2, …", () => {
    const lua = { 1: { name: "Navigate: Tree", key: { 1: "Ctrl-o", 2: "Ctrl-Shift-o" } } };
    expect(shortcutsOf(lua, false)).toEqual([{ name: "Navigate: Tree", keys: ["Ctrl-o", "Ctrl-Shift-o"] }]);
    expect(shortcutsOf(undefined, false)).toEqual([]);
  });

  it("name the command a key runs, the one a sequence starts where it starts one alone, the keys where it starts several", () => {
    const shortcuts = shortcutsOf(LISTED, false);
    expect(messageOf(shortcuts, key({ key: "/", ctrlKey: true }))).toBe("Open Command Palette doesn't work here");
    expect(messageOf(shortcuts, key({ key: "O", ctrlKey: true, shiftKey: true }))).toBe("Navigate: Tree doesn't work here");
    expect(messageOf(shortcuts, key({ key: ".", ctrlKey: true }))).toBe("Task: Cycle State doesn't work here");
    expect(messageOf(shortcuts, key({ key: "q", ctrlKey: true }))).toBe("Ctrl-q shortcuts don't work here");
    expect(messageOf(shortcuts, key({ key: "j", ctrlKey: true }))).toBeUndefined();
    expect(messageOf(shortcuts, key({ key: "ArrowUp" }))).toBeUndefined();
  });
});

describe("a key kept from SilverBullet", () => {
  const kept = (now = () => 0) => {
    const tell = vi.fn();
    const listCommands = vi.fn(async () => LISTED);
    return { tell, listCommands, keep: keptKeys(listCommands, tell, now)! };
  };

  it("is told where it is a shortcut of SilverBullet's", async () => {
    const { tell, keep } = kept();
    keep(key({ key: "k", ctrlKey: true }));
    await flush();
    expect(tell).toHaveBeenCalledWith("Navigate: Page Picker doesn't work here");
  });

  it("is not told where the field took it, where it is typing or what AltGr types, as it goes up, or where it is no shortcut", async () => {
    const { tell, listCommands, keep } = kept();
    const taken = key({ key: "k", ctrlKey: true });
    taken.preventDefault();
    keep(taken);
    keep(key({ key: "k" }));
    keep(key({ key: "ArrowUp" }));
    keep(new KeyboardEvent("keyup", { key: "k", ctrlKey: true }));
    keep(key({ key: "@", ctrlKey: true, altKey: true, modifierAltGraph: true }));
    expect(listCommands).not.toHaveBeenCalled();
    keep(key({ key: "j", ctrlKey: true }));
    await flush();
    expect(tell).not.toHaveBeenCalled();
  });

  it("is told once while pressed again at once, again a while later; the commands read once, again once stale", async () => {
    let time = 0;
    const { tell, listCommands, keep } = kept(() => time);
    keep(key({ key: "k", ctrlKey: true }));
    await flush();
    keep(key({ key: "k", ctrlKey: true }));
    await flush();
    expect(tell).toHaveBeenCalledTimes(1);
    keep(key({ key: "/", ctrlKey: true }));
    await flush();
    expect(tell).toHaveBeenCalledTimes(2);
    time = 60_000;
    keep(key({ key: "/", ctrlKey: true }));
    await flush();
    expect(tell).toHaveBeenCalledTimes(3);
    expect(listCommands).toHaveBeenCalledTimes(2);
  });

  it("is told once the commands are read, where reading them failed before (not kept as none)", async () => {
    const tell = vi.fn();
    const listCommands = vi.fn().mockRejectedValueOnce(new Error("Space Lua loading")).mockResolvedValue(LISTED);
    const keep = keptKeys(listCommands, tell, () => 0)!;
    keep(key({ key: "k", ctrlKey: true }));
    await flush();
    expect(tell).not.toHaveBeenCalled();
    keep(key({ key: "k", ctrlKey: true }));
    await flush();
    expect(tell).toHaveBeenCalledWith("Navigate: Page Picker doesn't work here");
  });

  it("is never told where nothing is known of SilverBullet's commands, or where there is nothing to tell by", () => {
    expect(keptKeys(undefined, vi.fn())).toBeUndefined();
    expect(keptKeys(async () => LISTED, undefined)).toBeUndefined();
  });
});
