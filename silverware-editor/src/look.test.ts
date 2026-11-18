// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { lookRules } from "./look.ts";

describe("the page's look of what the live preview draws", () => {
  it("writes each part given as a rule over the editor's own, through the CSSOM: a value it does not read left out, none ending the rule", () => {
    const rules = lookRules(document, { checkbox: { width: "17px", "border-top-left-radius": "50%" }, hashtag: { color: "red; } x { color: blue" } });
    expect(rules).toBe(".cm-editor .cm-content .swe-checkbox { width: 17px !important; border-top-left-radius: 50% !important; }");
    expect(lookRules(document, {})).toBe("");
  });

  it("writes a heading's look on its line and a strong text's on its mark alone (what is in them keeps its own); a rule's line as a ground, no margins", () => {
    const rules = lookRules(document, { heading1: { "font-size": "1.5em", "padding-top": "0.08em" }, strong: { "font-weight": "900" }, rule: { "border-top-width": "1px" } }).split("\n");
    expect(rules).toEqual([
      ".cm-editor .cm-content .cm-line.swe-h1 { font-size: 1.5em !important; padding-top: 0.08em !important; }",
      ".cm-editor .cm-content .swe-strong { font-weight: 900 !important; }",
      ".cm-editor .cm-content .cm-line.swe-hr { background-image: linear-gradient(currentcolor, currentcolor) !important; background-position: 0px 50% !important; background-size: 100% 1px !important; background-repeat: no-repeat !important; }",
    ]);
  });
});
