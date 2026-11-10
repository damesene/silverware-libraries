import { describe, expect, it } from "vitest";
import { type ActionEditor, NO_ARGS } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { slashModule, slashText } from "./slash.ts";

describe("The slash module", () => {
  it("writes / at the selection's end, a space before it where SilverBullet would not complete a slash command after what is there", () => {
    expect(slashText(contextOf("", 0, 0))).toBe("/");
    expect(slashText(contextOf("a b", 2, 2))).toBe("/");
    expect(slashText(contextOf("line\n", 5, 5))).toBe("/");
    expect(slashText(contextOf("(", 1, 1))).toBe("/");
    expect(slashText(contextOf("word", 4, 4))).toBe(" /");
    expect(slashText(contextOf("a_", 2, 2))).toBe(" /");
    expect(slashText(contextOf("note:", 5, 5))).toBe(" /");
    // (A letter outside ASCII is no word character to SilverBullet: / completes after it)
    expect(slashText(contextOf("kočič", 5, 5))).toBe("/");
    expect(slashText(contextOf("Čeština", 7, 7))).toBe(" /");
    // Text selected: after it
    expect(slashText(contextOf("some text", 0, 4))).toBe(" /");
  });

  it("writes it, then starts the editor's completion; where it cannot be started, writes nothing", async () => {
    const [action] = slashModule().actions();
    expect(action!.id).toBe("actions.slashCommands");
    const done: string[] = [];
    const editor: ActionEditor = {
      invokeCommand: async () => {},
      navigate: async () => {},
      flash: () => {},
      select: () => {},
      hideKeyboard: () => {},
      write: async (from, to, text) => void done.push(`write ${from}-${to} ${text}`),
      startCompletion: async () => void done.push("complete"),
      completes: true,
    };
    await action!.perform!(contextOf("see it", 0, 3), editor, NO_ARGS);
    expect(done).toEqual(["write 3-3  /", "complete"]);
    // The completion not to be started: nothing written, a failure said
    done.length = 0;
    await expect(action!.perform!(contextOf("see it", 0, 3), { ...editor, completes: false }, NO_ARGS)).rejects.toThrow("editor.startCompletion");
    expect(done).toEqual([]);
  });
});
