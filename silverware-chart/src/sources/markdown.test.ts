import { describe, expect, it } from "vitest";
import { blockOf, blocksOf } from "../core/blocks.ts";
import { cellsOf, columnIndex, columnKey, dataOf, numberOf, pageOf, plainNumberOf, tableByPlace, tablesOf } from "./markdown.ts";

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
    // Its section's only: under a subheading of it, not under the next heading of its level
    const sections = "## Sales\n\n### 2026\n\n| A |\n|---|\n| 1 |\n\n## Empty\n\nNo table.\n\n## Costs\n\n| B |\n|---|\n| 2 |\n";
    expect(tableByPlace(sections, "#Sales", undefined)?.columns[0]?.name).toBe("A");
    expect(tableByPlace(sections, "#Empty", undefined)).toBeUndefined();
    expect(tableByPlace(sections, "#Costs", undefined)?.columns[0]?.name).toBe("B");
  });

  it("finds columns by name in any case or by key, and gives a table's data", () => {
    const costs = tablesOf(TEXT)[0]!;
    expect([columnIndex(costs.columns, "month"), columnIndex(costs.columns, "unit_price"), columnIndex(costs.columns, "Unit price"), columnIndex(costs.columns, "none")]).toEqual([0, 1, 1, -1]);
    expect(dataOf(costs, { table: "above", x: "Month", series: ["unit_price"] }, "costs")).toEqual({ labels: ["Oct", "Nov"], series: [[1.5, 3]] });
    expect(dataOf(costs, { table: "above", series: ["Množství"] }, "costs")).toEqual({ labels: ["1", "2"], series: [[2, null]] });
    expect(dataOf(costs, { table: "above", x: "Month", series: [] }, "costs")).toEqual({ problem: "costs: say the columns to draw with series" });
  });

  it("offers the table's columns in place of the first reference that finds none", () => {
    const costs = tablesOf(TEXT)[0]!;
    const missing = dataOf(costs, { table: "above", x: "Month", series: ["price", "Množství"] }, "costs");
    expect(missing).toMatchObject({ problem: "costs has no column price (it has Month, Unit price, Množství)" });
    expect("choices" in missing && missing.choices?.map((c) => [c.label, c.source.series])).toEqual([
      ["Month", ["Month", "Množství"]],
      ["Unit price", ["Unit price", "Množství"]],
      ["Množství", ["Množství", "Množství"]],
    ]);
    const noX = dataOf(costs, { table: "above", x: "Mnth", series: ["Množství"] }, "costs");
    expect("choices" in noX && noX.choices?.[0]?.source).toEqual({ table: "above", x: "Month", series: ["Množství"] });
  });

  it("reads numbers with units and a decimal comma, and references to other pages", () => {
    expect([numberOf("12"), numberOf("12,99 €"), numberOf("1,234.5"), numberOf("$ -3"), numberOf("n/a"), numberOf("")]).toEqual([12, 12.99, 1234.5, -3, null, null]);
    // A value drawn takes any digits; a number compared or a column of numbers only one around its unit or currency
    expect(numberOf("~120 (est.)")).toBe(120);
    // Its separators: of both the last the decimal one, one repeated thousands, a comma alone the decimal one
    expect(["1.234,56", "1,234,567", "1.234.567", "12,5", "12,000", "-1 200,5 Kč"].map(numberOf)).toEqual([1234.56, 1234567, 1234567, 12.5, 12, -1200.5]);
    const plain = ["12", "12,99 €", "-€12", "USD 1 200", "3kg", "5 %", "A1", "Q1", "ABC1", "v2.1", "2026-11-02", "n/a", ""].map(plainNumberOf);
    expect(plain).toEqual([12, 12.99, -12, 1200, 3, 5, null, null, null, null, null, null, null]);
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
