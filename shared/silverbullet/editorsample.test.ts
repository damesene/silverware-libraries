// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { editorSampleLook } from "./editorsample.ts";

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});

/** SilverBullet's editor as it is in the page: its content in its scroller, its rules in the page */
function page(rules: string): HTMLElement {
  document.head.append(Object.assign(document.createElement("style"), { textContent: rules }));
  document.body.innerHTML = '<div id="sb-main"><div class="cm-editor"><div class="cm-scroller"><div class="cm-content" style="--editor-column: 9px"></div></div></div></div>';
  return document.querySelector<HTMLElement>(".cm-scroller")!;
}

describe("the page's editor's look, sampled", () => {
  it("reads what SilverBullet's editor's rules give its headings, strong text, code and rule, its sizes in em, the sample taken out again", () => {
    const scroller = page(`
      #sb-main .cm-editor .sb-line-h1 { font-size: 25px; padding-top: 2px; }
      #sb-main .cm-editor .sb-h1 { color: rgb(1, 2, 3); }
      #sb-main .cm-editor .sb-strong { font-weight: 900; }
      #sb-main .cm-editor .sb-code { background-color: rgb(4, 5, 6); }
      #sb-main .cm-editor .sb-line-fenced-code { padding-left: 16px; }
    `);
    const look = editorSampleLook(document);
    // (A font's size in em of the text round it, 16 px; the rest in em of its own: a heading's 25 px)
    expect(look.heading1).toMatchObject({ "font-size": "1.5625em", "padding-top": "0.08em", color: "rgb(1, 2, 3)" });
    expect(look.strong).toEqual({ "font-weight": "900" });
    expect(look.inlineCode).toMatchObject({ "background-color": "rgb(4, 5, 6)" });
    expect(look.codeBlock).toMatchObject({ "padding-left": "1em" });
    expect(look.rule).toBeUndefined();
    expect(scroller.children).toHaveLength(1);
  });

  it("reads a rule's line only where the page draws one", () => {
    page("#sb-main .cm-editor .sb-line-hr { border-top: 1px solid red; margin-top: 1em; }");
    expect(editorSampleLook(document).rule).toMatchObject({ "border-top-width": "1px", "margin-top": "1em" });
  });

  it("reads none where SilverBullet's editor is not there", () => {
    expect(editorSampleLook(document)).toEqual({});
  });
});
