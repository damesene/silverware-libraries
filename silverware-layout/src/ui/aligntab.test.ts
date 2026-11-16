// @vitest-environment jsdom
// The settings dialog's Alignment tab: a row per kind registered, the default written as none, and the saved
// defaults of kinds not registered now (their plugin not loaded) kept as the rows shown are saved.
import { describe, expect, it } from "vitest";
import { alignTab } from "./aligntab.ts";

const KINDS = [
  { key: "silverware-table/table", kind: { id: "table", name: "Table", align: "center" as const } },
  { key: "silverware-assets/preview", kind: { id: "preview", name: "File: preview", align: "left" as const } },
];

describe("the Alignment tab", () => {
  it("saves the rows shown, a kind's own default as none, and keeps the saved ones of kinds not registered", async () => {
    let saved: Readonly<Record<string, string>> | undefined;
    const tab = alignTab(document, KINDS, { "silverware-chart/chart": "right", "silverware-assets/preview": "center" }, async (alignments) => {
      saved = alignments;
      return undefined;
    });
    const selects = [...tab.panel.querySelectorAll("select")];
    expect(selects.map((select) => select.value)).toEqual(["", "center"]);
    expect(tab.changed()).toBe(false);
    selects[0]!.value = "right";
    selects[1]!.value = "";
    expect(tab.changed()).toBe(true);
    await tab.save();
    expect(saved).toEqual({ "silverware-chart/chart": "right", "silverware-table/table": "right" });
  });
});
