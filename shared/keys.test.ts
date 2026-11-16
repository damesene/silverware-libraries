// @vitest-environment jsdom
// A key event matched against a key by CodeMirror's names: modifiers exactly, Mod as Ctrl off a Mac, Shift as a shifted
// sign needs; with Ctrl, Alt or Cmd also by the key code, as CodeMirror's keymaps (SilverBullet's) take it.
import { describe, expect, it } from "vitest";
import { keyMatches } from "./keys.ts";

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("the keys' names", () => {
  it("match a key with its modifiers exactly, Mod as Ctrl off a Mac", () => {
    expect(keyMatches("Mod-Enter", key({ key: "Enter", ctrlKey: true }))).toBe(true);
    expect(keyMatches("Mod-Enter", key({ key: "Enter" }))).toBe(false);
    expect(keyMatches("Escape", key({ key: "Escape" }))).toBe(true);
    expect(keyMatches("Escape", key({ key: "Escape", ctrlKey: true }))).toBe(false);
    expect(keyMatches("Shift-Tab", key({ key: "Tab", shiftKey: true }))).toBe(true);
    expect(keyMatches("Mod-b", key({ key: "B", ctrlKey: true }))).toBe(true);
    // (A letter's key with Shift held is not the key without it: Ctrl+Shift+Z is no `Mod-z`; a shifted sign is itself)
    expect(keyMatches("Mod-z", key({ key: "Z", ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(keyMatches("Mod-Shift-z", key({ key: "Z", ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(keyMatches("?", key({ key: "?", shiftKey: true }))).toBe(true);
  });

  it("match a key by its key code where Ctrl, Alt or Cmd is held, as CodeMirror's keymaps do: Shift as named, AltGr never", () => {
    expect(keyMatches("Ctrl-Shift-8", key({ key: "*", keyCode: 56, ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(keyMatches("Ctrl-k", key({ key: "л", keyCode: 75, ctrlKey: true }))).toBe(true);
    // (A German keyboard's minus, where a US one has its slash: its key code the minus')
    expect(keyMatches("Ctrl-/", key({ key: "-", keyCode: 189, code: "Slash", ctrlKey: true }))).toBe(false);
    expect(keyMatches("Mod-1", key({ key: "!", keyCode: 49, ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(keyMatches("Mod-z", key({ key: "y", keyCode: 89, ctrlKey: true }))).toBe(false);
    expect(keyMatches("Ctrl-Alt-7", key({ key: "{", keyCode: 55, ctrlKey: true, altKey: true }))).toBe(false);
    expect(keyMatches("Ctrl-/", key({ key: "/", keyCode: 191 }))).toBe(false);
  });
});
