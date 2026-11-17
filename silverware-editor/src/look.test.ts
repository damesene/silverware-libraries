// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { lookRules } from "./look.ts";

describe("the page's look of what the live preview draws", () => {
  it("writes each part given as a rule over the editor's own, through the CSSOM: a value it does not read left out, none ending the rule", () => {
    const rules = lookRules(document, { checkbox: { width: "17px", "border-top-left-radius": "50%" }, hashtag: { color: "red; } x { color: blue" } });
    expect(rules).toBe(".cm-editor .cm-content .swe-checkbox { width: 17px !important; border-top-left-radius: 50% !important; }");
    expect(lookRules(document, {})).toBe("");
  });
});
