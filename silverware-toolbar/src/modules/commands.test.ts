import { describe, expect, it } from "vitest";
import { commandActions, commandsModule } from "./commands.ts";

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
    actions[1]!.perform!();
    expect(run).toEqual(["Text: Bold"]);
    expect(commandActions(undefined, () => undefined)).toEqual([]);
  });

  it("has none without the editor's commands, and the list once read", async () => {
    expect(commandsModule({}).actions()).toEqual([]);
    const module = commandsModule({ listCommands: async () => ({ a: { name: "Navigate: Home" } }), invokeCommand: () => undefined });
    await Promise.resolve();
    await Promise.resolve();
    expect(module.actions().map((a) => a.id)).toEqual(["commands.Navigate: Home"]);
  });
});
