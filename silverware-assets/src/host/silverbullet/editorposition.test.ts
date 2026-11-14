// @vitest-environment jsdom
// SILVERBULLET-INTERNAL (editorposition.ts): an element's place asked of SilverBullet's editor, none where it cannot say.
import { afterEach, describe, expect, it } from "vitest";
import { editorPosition } from "./editorposition.ts";

const win = window as unknown as { client?: unknown };
afterEach(() => {
  delete win.client;
});

describe("an element's place asked of SilverBullet's editor", () => {
  it("is what its editor says, for the element given", () => {
    const element = document.createElement("span");
    win.client = { editorView: { posAtDOM: (node: Node) => (node === element ? 42 : -1) } };
    expect(editorPosition(document, element)).toBe(42);
  });

  it("is none without its editor, or where it fails or says no place", () => {
    const element = document.createElement("span");
    expect(editorPosition(document, element)).toBeUndefined();
    win.client = { editorView: {} };
    expect(editorPosition(document, element)).toBeUndefined();
    win.client = {
      editorView: {
        posAtDOM: () => {
          throw new Error("not in the editor");
        },
      },
    };
    expect(editorPosition(document, element)).toBeUndefined();
    win.client = { editorView: { posAtDOM: () => "3" } };
    expect(editorPosition(document, element)).toBeUndefined();
  });
});
