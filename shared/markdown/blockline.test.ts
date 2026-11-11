import { describe, expect, it } from "vitest";
import { readLine } from "./blockline.ts";

describe("readLine", () => {
  it("reads each kind of block line with its marker, text and where the text starts", () => {
    expect(readLine("## Title")).toEqual({ kind: "heading", level: 2, indent: "", marker: "## ", content: "Title", contentFrom: 3 });
    expect(readLine("  - item")).toEqual({ kind: "bullet", indent: "  ", marker: "- ", content: "item", contentFrom: 4, item: { kind: "bullet", marker: "- ", content: "item" } });
    expect(readLine("12) step")).toEqual({ kind: "numbered", number: 12, indent: "", marker: "12) ", content: "step", contentFrom: 4, item: { kind: "numbered", marker: "12) ", content: "step" } });
    expect(readLine("- [IN PROGRESS] task")).toEqual({ kind: "task", state: "IN PROGRESS", done: false, indent: "", marker: "- [IN PROGRESS] ", content: "task", contentFrom: 16, item: { kind: "bullet", marker: "- ", content: "[IN PROGRESS] task" } });
    expect(readLine("1. [x] done")).toMatchObject({ kind: "task", done: true, content: "done", item: { kind: "numbered", content: "[x] done" } });
    expect(readLine("> quoted")).toMatchObject({ kind: "quote", marker: "> ", content: "quoted" });
    expect(readLine("| a | b |")).toMatchObject({ kind: "table", content: "| a | b |" });
    expect(readLine("text")).toEqual({ kind: "paragraph", indent: "", marker: "", content: "text", contentFrom: 0 });
    expect(readLine("   ")).toMatchObject({ kind: "blank" });
  });

  it("tells apart what reads alike: a rule from a bullet, a hashtag from a heading, a list's text from a task", () => {
    expect(["---", "- - -", "***"].map((one) => readLine(one).kind)).toEqual(["rule", "rule", "rule"]);
    expect(readLine("#tag text").kind).toBe("paragraph");
    expect(readLine("####### seven").kind).toBe("paragraph");
    expect(readLine("- [due: x] text").kind).toBe("bullet");
    expect(readLine("-text").kind).toBe("paragraph");
  });

  it("gives a line starting with a list's marker its item whatever its kind, a rule's too; others none", () => {
    expect(readLine("- - -")).toMatchObject({ kind: "rule", item: { kind: "bullet", marker: "- ", content: "- -" } });
    expect(readLine("***").item).toBeUndefined();
    expect(readLine("## Title").item).toBeUndefined();
    expect(readLine("text").item).toBeUndefined();
  });

  it("keeps a line given whole, a CRLF's \\r in its text", () => {
    expect(readLine("- x\r")).toMatchObject({ kind: "bullet", content: "x\r" });
  });
});
