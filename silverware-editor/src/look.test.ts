// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { lookRules } from "./look.ts";

describe("the page's look of what the live preview draws", () => {
  it("writes each part given as a rule over the editor's own, through the CSSOM: a value it does not read left out, none ending the rule", () => {
    const rules = lookRules(document, { checkbox: { width: "17px", "border-top-left-radius": "50%" }, hashtag: { color: "red; } x { color: blue" } });
    expect(rules).toBe(".cm-editor .cm-content .swe-checkbox { width: 17px !important; border-top-left-radius: 50% !important; }");
    expect(lookRules(document, {})).toBe("");
  });

  it("takes a task's hanging indent as how far its text's next lines begin after its first (none where it hangs none)", () => {
    expect(lookRules(document, { task: { "padding-left": "27.2px", "text-indent": "-27.2px" } })).toBe(".cm-editor .cm-content { --swe-task-hang: 27.2px !important; }");
    expect(lookRules(document, { task: { "padding-left": "0px", "text-indent": "0px" } })).toBe("");
  });
});
