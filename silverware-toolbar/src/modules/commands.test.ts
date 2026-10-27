import { describe, expect, it } from "vitest";
import type { ActionEditor } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { commandActions, commandsModule } from "./commands.ts";

const EDITOR: ActionEditor = { invokeCommand: async () => {}, navigate: async () => {}, flash: () => {}, select: () => {}, hideKeyboard: () => {} };

describe("The commands module", () => {
  it("makes an action of each command SilverBullet lists, by name, hidden ones and what is no command left out", () => {
    const run: string[] = [];
    const actions = commandActions(
      { b: { name: "Text: Bold" }, a: { name: "Navigate: Home" }, h: { name: "Secret", hide: true }, x: 3, y: { name: "" } },
      (name) => run.push(name),
    );
    expect(actions.map((a) => [a.id, a.label, a.group, a.listed])).toEqual([
      ["commands.Navigate: Home", "Navigate: Home", "Commands", false],
      ["commands.Text: Bold", "Text: Bold", "Commands", false],
    ]);
    actions[1]!.perform!(contextOf("", 0, 0), EDITOR);
    expect(run).toEqual(["Text: Bold"]);
    expect(commandActions(undefined, () => undefined)).toEqual([]);
  });

  it("has none without the editor's commands, and the list once read", async () => {
    expect(commandsModule({}).actions()).toEqual([]);
    const module = commandsModule({ listCommands: async () => ({ a: { name: "Navigate: Home" } }), invokeCommand: () => undefined });
    await module.refresh!();
    expect(module.actions().map((a) => a.id)).toEqual(["commands.Navigate: Home"]);
  });

  it("reads the list anew when asked (refresh), a command defined since there: a Space Lua script's, loaded after the toolbar", async () => {
    let list: Record<string, unknown> = { a: { name: "Navigate: Home" } };
    const module = commandsModule({ listCommands: async () => list, invokeCommand: () => undefined });
    await module.refresh!();
    list = { ...list, b: { name: "My: Command" } };
    // As they are asked for: the list read before
    expect(module.actions().map((a) => a.label)).toEqual(["Navigate: Home"]);
    await module.refresh!();
    expect(module.actions().map((a) => a.label)).toEqual(["My: Command", "Navigate: Home"]);
  });

  it("reads one after another: the last asked for answers last; one that fails keeps the list before", async () => {
    let answer: (list: unknown) => void = () => undefined;
    let calls = 0;
    const module = commandsModule({
      listCommands: () => {
        calls++;
        if (calls === 3) return Promise.reject(new Error("busy"));
        return new Promise((resolve) => (answer = resolve));
      },
      invokeCommand: () => undefined,
    });
    const tick = () => new Promise((resolve) => setTimeout(resolve));
    const second = module.refresh!();
    await tick();
    // The first read still out: the second not asked yet
    expect(calls).toBe(1);
    answer({ a: { name: "Old" } });
    await tick();
    expect(calls).toBe(2);
    answer({ b: { name: "New" } });
    await second;
    expect(module.actions().map((a) => a.label)).toEqual(["New"]);
    await expect(module.refresh!()).rejects.toThrow("busy");
    expect(module.actions().map((a) => a.label)).toEqual(["New"]);
  });
});
