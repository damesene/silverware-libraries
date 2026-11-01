import { describe, expect, it } from "vitest";
import { blockOf, blocksOf } from "../core/blocks.ts";
import { cellsOf, columnIndex, columnKey, dataOf, numberOf, pageOf, tableByPlace, tablesOf } from "./markdown.ts";

const TEXT = `# Costs

| Month | Unit price #euro | Množství |
|---|--:|---|
| Oct | 1,5 € | 2 |
| Nov | 3 | \\| |
| <meta core.table core.name='costs'> |

\`\`\`mermaid
| not | a table |
|---|---|
\`\`\`

## Other

| A |
|---|
| x |
`;

describe("markdown tables", () => {
  it("are read outside code, their columns keyed as SilverBullet's index keys them, rows that show nothing left out", () => {
    const [costs, other] = tablesOf(TEXT);
    expect(tablesOf(TEXT)).toHaveLength(2);
    expect(costs?.columns).toEqual([
      { name: "Month", key: "month" },
      { name: "Unit price", key: "unit_price" },
      { name: "Množství", key: "mno_stv_" },
    ]);
    expect(costs?.rows).toEqual([
      ["Oct", "1,5 €", "2"],
      ["Nov", "3", "|"],
    ]);
    expect(TEXT.slice(costs!.from, costs!.to).endsWith("core.name='costs'> |")).toBe(true);
    expect(other?.rows).toEqual([["x"]]);
  });

  it("splits cells on pipes not escaped, hidden tags left out", () => {
    expect(cellsOf("| a \\| b | <meta x='1'>c |")).toEqual(["a | b", "c"]);
    expect(columnKey("**Unit price** #euro")).toBe("unit_price");
  });

  it("finds a table by its place: above, below, under a heading", () => {
    const block = blocksOf(TEXT)[0]!;
    expect(tableByPlace(TEXT, "above", block)?.columns[0]?.name).toBe("Month");
    expect(tableByPlace(TEXT, "below", block)?.columns[0]?.name).toBe("A");
    expect(tableByPlace(TEXT, "#other", undefined)?.columns[0]?.name).toBe("A");
    expect(tableByPlace(TEXT, "#Nowhere", undefined)).toBeUndefined();
    expect(tableByPlace(TEXT, "above", undefined)).toBeUndefined();
  });

  it("finds columns by name in any case or by key, and gives a table's data", () => {
    const costs = tablesOf(TEXT)[0]!;
    expect([columnIndex(costs.columns, "month"), columnIndex(costs.columns, "unit_price"), columnIndex(costs.columns, "Unit price"), columnIndex(costs.columns, "none")]).toEqual([0, 1, 1, -1]);
    expect(dataOf(costs, "Month", ["unit_price"], "costs")).toEqual({ labels: ["Oct", "Nov"], series: [[1.5, 3]] });
    expect(dataOf(costs, undefined, ["Množství"], "costs")).toEqual({ labels: ["1", "2"], series: [[2, null]] });
    expect(dataOf(costs, "Month", [], "costs")).toEqual({ problem: "costs: say the columns to draw with series" });
  });

  it("reads numbers with units and a decimal comma, and references to other pages", () => {
    expect([numberOf("12"), numberOf("12,99 €"), numberOf("1,234.5"), numberOf("$ -3"), numberOf("n/a"), numberOf("")]).toEqual([12, 12.99, 1234.5, -3, null, null]);
    expect(pageOf("[[Data/2026]]#Sales")).toEqual({ page: "Data/2026", rest: "#Sales" });
    expect(pageOf("above")).toEqual({ rest: "above" });
  });
});

describe("fenced blocks", () => {
  it("are found with their language and body, a block found by its text", () => {
    const block = blockOf(TEXT, "mermaid", "| not | a table |\n|---|---|")!;
    expect(block).toMatchObject({ language: "mermaid", body: "| not | a table |\n|---|---|" });
    expect(TEXT.slice(block.from, block.to)).toBe("```mermaid\n| not | a table |\n|---|---|\n```");
    expect(TEXT.slice(block.bodyFrom, block.bodyTo)).toBe(block.body);
    expect(blockOf(TEXT, "mermaid", "other")).toBeUndefined();
    expect(blocksOf("~~~~js\na\n~~~\nb\n~~~~\n")).toMatchObject([{ language: "js", body: "a\n~~~\nb" }]);
  });
});
