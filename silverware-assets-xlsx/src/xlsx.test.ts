// @vitest-environment jsdom
// Silverware Assets XLSX: values shown by their formats, Excel's colours, a worksheet (a stand-in of ExcelJS' objects) made
// into the model, a sheet drawn; the preview and the reader where ExcelJS is not loaded (as in a test: it is a file
// beside the built bundle, not beside src/). The workbook drawn in SilverBullet is tested in ui-tests/.
import { describe, expect, it, vi } from "vitest";
import { ASSET_WIDE_ATTRIBUTE, ASSETS_VERSION, type AssetType } from "../../shared/assets.ts";
import { excelDate, formatNumber, isDateFormat, showValue } from "./format.ts";
import { init } from "./index.ts";
import { columnName, columnPixels, MOST } from "./model.ts";
import { xlsxPreview } from "./preview.ts";
import { cutNote, xlsxReader } from "./reader.ts";
import { cellStyle, drawSheet } from "./table.ts";
import { cssColour, type ExcelCell, type ExcelWorksheet, lookOf, rangeOf, sheetOf } from "./workbook.ts";

const EN = "en-US";

/** A stand-in of ExcelJS' worksheet: cells by "row:column" */
const worksheet = (cells: Record<string, ExcelCell>, more: Partial<ExcelWorksheet> = {}): ExcelWorksheet => ({
  name: "Sheet1",
  rowCount: 3,
  columnCount: 3,
  getRow: () => ({}),
  getColumn: (column) => (column === 2 ? { width: 20 } : {}),
  getCell: (row, column) => cells[`${row}:${column}`] ?? { value: null },
  ...more,
});

describe("a value shown by its format", () => {
  it("shows numbers by General, decimals, thousands, percent and text round them", () => {
    expect(formatNumber(42, "General", EN)).toBe("42");
    expect(formatNumber(1 / 3, "General", EN)).toBe("0.3333333333");
    expect(formatNumber(1234.5, "#,##0.00", EN)).toBe("1,234.50");
    expect(formatNumber(1234.5, "0", EN)).toBe("1235");
    expect(formatNumber(0.256, "0.0%", EN)).toBe("25.6%");
    expect(formatNumber(-3.5, "0.00", EN)).toBe("-3.50");
    expect(formatNumber(19.9, '"$"#,##0.00', EN)).toBe("$19.90");
    expect(formatNumber(19.9, "[$€-407] #,##0.00", EN)).toBe("€ 19.90");
    expect(formatNumber(1500, '#,##0 "km"', EN)).toBe("1,500 km");
    // A negative's own section: its brackets, no minus
    expect(formatNumber(-5, "0;(0)", EN)).toBe("(5)");
  });

  it("shows scientific numbers, thousands' scaling, fractions as General, minutes and seconds as a time", () => {
    expect(formatNumber(12345, "0.00E+00", EN)).toBe("1.23E+04");
    expect(formatNumber(0.000123, "0.0E+00", EN)).toBe("1.2E-04");
    expect(formatNumber(1234567, "#,##0,", EN)).toBe("1,235");
    expect(formatNumber(1234567, '#,##0.0,, "M"', EN)).toBe("1.2 M");
    expect(formatNumber(1.5, "# ?/?", EN)).toBe("1.5");
    // Three minutes and five seconds in `mm:ss`, a day's fraction
    expect(formatNumber(185 / 86400, "mm:ss", EN)).toBe("03:05");
    expect(formatNumber(185.4 / 86400, "mm:ss.0", EN)).toBe("03:05.4");
  });

  it("tells dates' formats from numbers', and shows a date in UTC, with its time where the format has one", () => {
    expect(isDateFormat("mm-dd-yy")).toBe(true);
    expect(isDateFormat("yyyy-mm-dd h:mm")).toBe(true);
    expect(isDateFormat("#,##0.00")).toBe(false);
    expect(isDateFormat('0.00 "days"')).toBe(false);
    const date = new Date(Date.UTC(2026, 10, 14, 15, 30));
    expect(showValue(date, "d/m/yyyy", EN).text).toBe("11/14/2026");
    expect(showValue(date, "yyyy-mm-dd h:mm", EN).text).toBe("11/14/2026, 3:30 PM");
    expect(excelDate(46340).toISOString().slice(0, 10)).toBe("2026-11-14");
    expect(formatNumber(46340, "yyyy-mm-dd", EN)).toBe("11/14/2026");
  });

  it("shows a formula's saved result, rich text, a link's text, an error, a boolean; numbers marked as numbers", () => {
    expect(showValue({ formula: "A1*2", result: 84 }, undefined, EN)).toEqual({ text: "84", number: true });
    expect(showValue({ formula: "A1" }, undefined, EN)).toEqual({ text: "", number: false });
    expect(showValue({ richText: [{ text: "Bold " }, { text: "plain" }] }, undefined, EN).text).toBe("Bold plain");
    expect(showValue({ text: "Site", hyperlink: "https://example.com" }, undefined, EN).text).toBe("Site");
    expect(showValue({ error: "#DIV/0!" }, undefined, EN).text).toBe("#DIV/0!");
    expect(showValue(true, undefined, EN).text).toBe("TRUE");
  });
});

describe("a worksheet made into the model", () => {
  it("gives Excel's colours as CSS: ARGB, the default theme's tinted, the legacy palette's", () => {
    expect(cssColour({ argb: "FFFF0000" })).toBe("#ff0000");
    expect(cssColour({ theme: 4 })).toBe("#4472c4");
    expect(cssColour({ theme: 0, tint: -0.5 })).toBe("#808080");
    expect(cssColour({ theme: 1, tint: 0.5 })).toBe("#808080");
    expect(cssColour({ indexed: 2 })).toBe("#ff0000");
    expect(cssColour({})).toBeUndefined();
  });

  it("reads a cell's look: font, fill, alignment, borders; the defaults (Calibri 11, black) left out", () => {
    expect(lookOf({ font: { bold: true, size: 11, name: "Calibri", color: { argb: "FF000000" } } })).toEqual({ bold: true });
    expect(lookOf({ fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } }, alignment: { horizontal: "center", vertical: "middle", wrapText: true } })).toEqual({
      fill: "#ffff00",
      align: "center",
      valign: "middle",
      wrap: true,
    });
    expect(lookOf({ border: { bottom: { style: "medium", color: { argb: "FF0000FF" } } } })).toEqual({ borders: { bottom: "2px solid #0000ff" } });
    expect(lookOf({})).toBeUndefined();
    expect(rangeOf("$B$2:D4")).toEqual({ top: 2, left: 2, bottom: 4, right: 4 });
  });

  it("gives each cell its text and look, merged cells spanning, covered ones left, frozen panes, columns' widths", () => {
    const sheet = sheetOf(
      worksheet(
        { "1:1": { value: "Title", style: { font: { bold: true } } }, "2:1": { value: 1234.5, style: { numFmt: "#,##0.00" } }, "2:2": { value: { formula: "A2*2", result: 2469 } } },
        { model: { merges: ["A1:B1"] }, views: [{ state: "frozen", ySplit: 1, xSplit: 0 }] },
      ),
      EN,
    );
    expect(sheet.rows[0]!.cells[0]).toEqual({ text: "Title", look: { bold: true }, colSpan: 2 });
    expect(sheet.rows[0]!.cells[1]).toBe("covered");
    expect(sheet.rows[1]!.cells.slice(0, 2)).toEqual([
      { text: "1,234.50", number: true },
      { text: "2469", number: true },
    ]);
    expect(sheet.rows[2]!.cells.every((cell) => cell === undefined)).toBe(true);
    expect(sheet.frozen).toEqual({ rows: 1, columns: 0 });
    expect(sheet.columns).toEqual([columnPixels(undefined), columnPixels(20), columnPixels(undefined)]);
    expect(sheet.cut).toBeUndefined();
  });

  it("cuts a sheet larger than the most drawn, said under it", () => {
    const sheet = sheetOf(worksheet({}, { rowCount: MOST.rows + 10, columnCount: 3 }), EN);
    expect(sheet.rows).toHaveLength(MOST.rows);
    expect(sheet.cut).toEqual({ rows: MOST.rows + 10, columns: 3 });
    expect(cutNote(sheet)).toBe(`Shown: the first ${MOST.rows} of ${MOST.rows + 10} rows and 3 of 3 columns. Open the file to see all of it.`);
    expect(columnName(1)).toBe("A");
    expect(columnName(28)).toBe("AB");
  });
});

describe("a sheet drawn", () => {
  it("has the columns' letters and the rows' numbers, its cells' looks as CSS, numbers at the right, spans", () => {
    const sheet = sheetOf(
      worksheet({ "1:1": { value: "Title", style: { font: { bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } } } }, "2:2": { value: 7 } }, { model: { merges: ["A1:B1"] } }),
      EN,
    );
    const table = drawSheet(document, sheet, { headers: true });
    expect([...table.tHead!.rows[0]!.cells].map((cell) => cell.textContent)).toEqual(["", "A", "B", "C"]);
    const [first, second] = [...table.tBodies[0]!.rows];
    expect(first!.cells[0]!.textContent).toBe("1");
    const title = first!.cells[1] as HTMLTableCellElement;
    expect([title.textContent, title.colSpan, title.style.fontWeight, title.style.backgroundColor]).toEqual(["Title", 2, "bold", "rgb(255, 255, 0)"]);
    expect(first!.cells).toHaveLength(3);
    expect((second!.cells[2] as HTMLElement).style.textAlign).toBe("right");
    expect(cellStyle({ indent: 2, font: "Arial" }, false)).toEqual({ paddingLeft: "22px", fontFamily: '"Arial", var(--swa-xlsx-font)' });
  });
});

describe("a sheet's frozen columns", () => {
  it("are held by their columns past a cell merged down from a row above, each at the place the columns before it end", async () => {
    const { holdFrozen } = await import("./table.ts");
    const sheet = sheetOf(
      worksheet({ "1:1": { value: "Tall" }, "1:2": { value: "B1" }, "2:2": { value: "B2" }, "3:2": { value: "B3" }, "1:3": { value: "C1" }, "2:3": { value: "C2" } }, { model: { merges: ["A1:A3"] }, views: [{ state: "frozen", xSplit: 2, ySplit: 0 }] }),
      EN,
    );
    const table = drawSheet(document, sheet, { headers: false });
    holdFrozen(table, sheet.frozen);
    const left = (text: string) => [...table.querySelectorAll("td")].find((cell) => cell.textContent === text)!.style.left;
    const [a, b] = sheet.columns;
    // Row 2 has no cell of column A (A1 spans it): B2 at B's place, C2 not held
    expect([left("Tall"), left("B1"), left("B2"), left("B3"), left("C2")]).toEqual(["0px", `${a}px`, `${a}px`, `${a}px`, ""]);
    expect(b).toBeGreaterThan(0);
    expect(table.hasAttribute("data-swa-xlsx-held")).toBe(true);
  });
});

describe("where ExcelJS cannot be loaded", () => {
  it("a preview stays its icon and name, its title saying why; a reader, as wide as its line, says it cannot show the workbook", async () => {
    const preview = xlsxPreview(document, "/a.xlsx", "a.xlsx", "<svg/>", { width: 200, height: 160 }, new AbortController().signal);
    expect(preview.querySelector(".swa-xlsx-preview-name")!.textContent).toBe("a.xlsx");
    const reader = xlsxReader(document, "/b.xlsx", "b.xlsx", 480, new AbortController().signal);
    expect(reader.hasAttribute(ASSET_WIDE_ATTRIBUTE)).toBe(true);
    await vi.waitFor(() => expect(preview.dataset.swaXlsxState).toBe("failed"));
    await vi.waitFor(() => expect(reader.dataset.swaXlsxState).toBe("failed"));
    expect(reader.querySelector(".swa-xlsx-reader-failed")!.textContent).toMatch(/^This workbook cannot be shown here/);
  });
});

describe("Silverware Assets XLSX", () => {
  it("registers its type with Silverware Assets' API once while the same API is handed over, again with another", () => {
    const registered: AssetType[] = [];
    const off = vi.fn();
    const api = () => ({ version: ASSETS_VERSION, types: { register: (type: AssetType) => (registered.push(type), off) }, actions: { register: () => () => undefined } });
    const assets = api();
    init({ assets });
    init({ assets });
    expect(registered.map((type) => type.name)).toEqual(["xlsx"]);
    expect(registered[0]!.match.ext).toEqual(["xlsx"]);
    init({ assets: api() });
    expect(registered).toHaveLength(2);
    expect(off).toHaveBeenCalledTimes(1);
  });
});
