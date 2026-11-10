import { describe, expect, it } from "vitest";
import { type ActionEditor, NO_ARGS } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { keyboardModule } from "./keyboard.ts";

describe("The keyboard module", () => {
  it("offers hiding the keyboard, for a touch screen only (touchOnly: left out elsewhere but offered for a toolbar a finger may show), through the editor's API", () => {
    const [hide] = keyboardModule().actions();
    expect(hide!.id).toBe("actions.hideKeyboard");
    expect(hide!.touchOnly).toBe(true);
    let hidden = 0;
    const editor: ActionEditor = { invokeCommand: async () => {}, navigate: async () => {}, flash: () => {}, select: () => {}, hideKeyboard: () => void hidden++, write: async () => {}, startCompletion: async () => {}, completes: true };
    hide!.perform!(contextOf("a", 0, 1), editor, NO_ARGS);
    expect(hidden).toBe(1);
  });
});
