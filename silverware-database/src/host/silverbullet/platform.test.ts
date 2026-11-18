// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { editorLook } from "./platform.ts";

afterEach(() => {
  document.body.replaceChildren();
});

describe("the page's editor's text, for a panel beside the page", () => {
  it("is its content's font, its column and its content's scale (a panel's files zoomed as its text is)", () => {
    document.body.innerHTML = '<div class="cm-content" style="font-size: 30px; --editor-column: 9px; --sw-content-scale: 1.6"></div>';
    expect(editorLook(document)).toMatchObject({ "font-size": "30px", "--editor-column": "9px", "--sw-content-scale": "1.6" });
  });

  it("is none where the editor is not there", () => {
    expect(editorLook(document)).toBeUndefined();
  });
});
