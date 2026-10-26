import { describe, expect, it } from "vitest";
import type { ActionEditor } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { keyboardModule } from "./keyboard.ts";

describe("The keyboard module", () => {
  it("offers hiding the keyboard on a touch screen only, through the editor's API", () => {
    expect(keyboardModule({}).actions()).toEqual([]);
    const [hide] = keyboardModule({ touch: true }).actions();
    expect(hide!.id).toBe("actions.hideKeyboard");
    let hidden = 0;
    const editor: ActionEditor = { invokeCommand: async () => {}, navigate: async () => {}, flash: () => {}, select: () => {}, hideKeyboard: () => void hidden++ };
    hide!.perform!(contextOf("a", 0, 1), editor);
    expect(hidden).toBe(1);
  });
});
