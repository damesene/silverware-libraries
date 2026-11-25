// @vitest-environment jsdom
// SILVERBULLET-INTERNAL (editorposition.ts): a point's place asked of SilverBullet's editor, none where it cannot say.
import { afterEach, describe, expect, it } from "vitest";
import { editorPositionAt } from "./editorposition.ts";

const win = window as unknown as { client?: unknown };
afterEach(() => {
  delete win.client;
});

describe("a point's place asked of SilverBullet's editor", () => {
  it("is what its editor says, for the point given", () => {
    win.client = { editorView: { posAtCoords: ({ x, y }: { x: number; y: number }) => (x === 10 && y === 20 ? 42 : -1) } };
    expect(editorPositionAt(document, 10, 20)).toBe(42);
  });

  it("is none without its editor, or where it fails or says no place", () => {
    expect(editorPositionAt(document, 1, 1)).toBeUndefined();
    win.client = { editorView: {} };
    expect(editorPositionAt(document, 1, 1)).toBeUndefined();
    win.client = {
      editorView: {
        posAtCoords: () => {
          throw new Error("not in the editor");
        },
      },
    };
    expect(editorPositionAt(document, 1, 1)).toBeUndefined();
    win.client = { editorView: { posAtCoords: () => "3" } };
    expect(editorPositionAt(document, 1, 1)).toBeUndefined();
    win.client = { editorView: { posAtCoords: () => null } };
    expect(editorPositionAt(document, 1, 1)).toBeUndefined();
  });
});
