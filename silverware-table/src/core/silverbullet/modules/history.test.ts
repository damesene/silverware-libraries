// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { onWrite, resetDefinitions } from "../../../index.ts";
import { findTables } from "../../../markdown.ts";
import { cell, controller, flush, pointInsert, setup, setText, text, useTablePage, tableKey } from "../../../testing/page.ts";

describe("History markers", () => {
  useTablePage();

  // The editor's cursor as CodeMirror keeps it through an edit: before an
  // insertion at its place (assoc -1), after a change before it
  let cursor = 0;
  const editor = {
    setSelection: (from: number) => {
      cursor = from;
    },
  };
  const following = () => {
    const bridge = controller.bridge as { replaceRange: (from: number, to: number, insert: string) => unknown };
    const replace = bridge.replaceRange.bind(bridge);
    bridge.replaceRange = (from, to, insert) => {
      if (cursor > from || (cursor === from && to > from)) cursor = Math.max(from, cursor + insert.length - (to - from));
      return replace(from, to, insert);
    };
  };
  const outsideTables = () => findTables(text).every((range) => cursor < range.from || cursor > range.to);

  // The edit then inserts right after the table, where the cursor would be
  it.each([
    ["text above it: the cursor goes before the table", "Intro\n\n"],
    ["at the page's start: the cursor goes after the row added", ""],
  ])("keeps the editor's cursor out of the table when a row is added at its end (the last row empty), %s", async (_, above) => {
    await setup(`${above}| A |\n|---|\n| 1 |\n| |\n\nEnd.\n`, {}, editor);
    following();
    cell(2, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    pointInsert({ key: tableKey(), axis: "row", at: 3, beside: { after: 2 } });
    document.querySelector<HTMLElement>(".swt-insert")!.click();
    await flush();
    await controller.scan();
    expect(text).toBe(`${above}| A |\n|---|\n| 1 |\n| |\n| |\n\nEnd.\n`);
    expect(outsideTables()).toBe(true);
  });

  // Another plugin's edits with the write (silverware.table.onWrite) widen the edit: the marker moved by the table's own change
  describe("with other plugins' edits in the same write", () => {
    afterEach(() => {
      resetDefinitions();
      onWrite(() => []);
    });

    it.each([
      // The edit reaching from above the table into it: the cursor after the table, where it reaches not
      ["a line above it grows: the cursor goes after the table", "Chart: 1\n\nIntro\n\n", "\nEnd.\n", () => [{ from: 7, to: 8, text: "1234567890" }], "\nEnd"],
      // The cursor after the row added, the other edit under it: not moved past that edit too
      ["at the page's start, a line under it grows: the cursor goes after the row added", "", "\nChart: 1\n", (written: string) => [{ from: written.indexOf("Chart: 1") + 7, to: written.indexOf("Chart: 1") + 8, text: "1234567890" }], "\nChart"],
    ])("keeps the editor's cursor out of the table when a row is added at its end and %s", async (_, above, below, edits, place) => {
      await setup(`${above}| A |\n|---|\n| 1 |\n| |\n${below}`, {}, editor);
      onWrite(edits);
      following();
      cell(2, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      pointInsert({ key: tableKey(), axis: "row", at: 3, beside: { after: 2 } });
      document.querySelector<HTMLElement>(".swt-insert")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("1234567890");
      expect(cursor).toBe(text.indexOf(place));
      expect(outsideTables()).toBe(true);
    });
  });

  it("keeps it right after the table for an edit inside it", async () => {
    await setup("Intro\n\n| A |\n|---|\n| 1 |\n\nEnd.\n", { "silverware.table.editor.enterKey": "save" }, editor);
    following();
    setText(text);
    cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    pointInsert({ key: tableKey(), axis: "row", at: 1, beside: { before: 1 } });
    document.querySelector<HTMLElement>(".swt-insert")!.click();
    await flush();
    expect(text).toBe("Intro\n\n| A |\n|---|\n| |\n| 1 |\n\nEnd.\n");
    // After the table: the blank line under it
    expect(cursor).toBe(text.indexOf("\n\nEnd") + 1);
    expect(outsideTables()).toBe(true);
  });
});
