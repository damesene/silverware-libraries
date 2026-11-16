// A workbook as ExcelJS read it, made into Silverware Assets XLSX's model (src/model.ts): each visible sheet's cells as text by
// their formats (src/format.ts) with their look (fonts, fills, alignment, borders; Excel's theme and legacy colours
// near enough), merged cells, widths and heights, frozen panes; a sheet larger than MOST cut to it. What of ExcelJS is
// read is declared here (its package is a file beside the bundle, not bundled). Pure.
import { type CellValue, showValue } from "./format.ts";
import { type CellLook, columnPixels, MOST, rowPixels, type Sheet, type SheetCell, type SheetRow, type Workbook } from "./model.ts";

type Colour = { readonly argb?: string; readonly theme?: number; readonly tint?: number; readonly indexed?: number };
type Edge = { readonly style?: string; readonly color?: Colour };
export type ExcelStyle = {
  readonly numFmt?: string;
  readonly font?: { readonly bold?: boolean; readonly italic?: boolean; readonly underline?: boolean | string; readonly strike?: boolean; readonly size?: number; readonly name?: string; readonly color?: Colour };
  readonly fill?: { readonly type?: string; readonly pattern?: string; readonly fgColor?: Colour; readonly bgColor?: Colour };
  readonly alignment?: { readonly horizontal?: string; readonly vertical?: string; readonly wrapText?: boolean; readonly indent?: number };
  readonly border?: { readonly top?: Edge; readonly right?: Edge; readonly bottom?: Edge; readonly left?: Edge };
};
export type ExcelCell = { readonly value: CellValue; readonly style?: ExcelStyle; readonly numFmt?: string };
export type ExcelWorksheet = {
  readonly name: string;
  readonly state?: string;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly views?: readonly { readonly state?: string; readonly xSplit?: number; readonly ySplit?: number }[];
  readonly model?: { readonly merges?: readonly string[] };
  readonly properties?: { readonly defaultRowHeight?: number; readonly defaultColWidth?: number };
  getRow(row: number): { readonly height?: number; readonly hidden?: boolean };
  getColumn(column: number): { readonly width?: number; readonly hidden?: boolean };
  getCell(row: number, column: number): ExcelCell;
};
export type ExcelWorkbook = { readonly worksheets: readonly ExcelWorksheet[] };

// Excel's default theme's colours (Office 2013 and later), by the theme's index ExcelJS gives
const THEME = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "0563C1", "954F72"];
// The legacy palette's first colours (indexed), the rest left out
const INDEXED = ["000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080"];

/** A colour of Excel's as CSS (`#rrggbb`): its ARGB, its theme's (lightened or darkened by its tint) or the legacy palette's */
export function cssColour(colour: Colour | undefined): string | undefined {
  if (!colour) return undefined;
  if (colour.argb && /^[0-9a-f]{8}$/i.test(colour.argb)) return `#${colour.argb.slice(2).toLowerCase()}`;
  if (colour.argb && /^[0-9a-f]{6}$/i.test(colour.argb)) return `#${colour.argb.toLowerCase()}`;
  const base = colour.theme !== undefined ? THEME[colour.theme] : colour.indexed !== undefined ? INDEXED[colour.indexed] : undefined;
  if (!base) return undefined;
  const tint = colour.tint ?? 0;
  const channel = (index: number) => {
    const value = parseInt(base.slice(index, index + 2), 16);
    const tinted = tint < 0 ? value * (1 + tint) : value + (255 - value) * tint;
    return Math.round(Math.min(255, Math.max(0, tinted))).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/** An edge of a cell's border as CSS, by Excel's style of it */
function cssEdge(edge: Edge | undefined): string | undefined {
  if (!edge?.style) return undefined;
  const width = /medium|thick/.test(edge.style) ? (edge.style === "thick" ? 3 : 2) : 1;
  const line = edge.style === "double" ? "double" : /dash|dot/i.test(edge.style) ? (/dot/i.test(edge.style) ? "dotted" : "dashed") : "solid";
  return `${edge.style === "double" ? 3 : width}px ${line} ${cssColour(edge.color) ?? "#000"}`;
}

/** A cell's look from its style (none where it has nothing of it) */
export function lookOf(style: ExcelStyle | undefined): CellLook | undefined {
  if (!style) return undefined;
  const { font, fill, alignment, border } = style;
  const look: Record<string, unknown> = {};
  if (font?.bold) look.bold = true;
  if (font?.italic) look.italic = true;
  if (font?.underline) look.underline = true;
  if (font?.strike) look.strike = true;
  const color = cssColour(font?.color);
  if (color && color !== "#000000") look.color = color;
  if (font?.size && font.size !== 11) look.size = font.size;
  if (font?.name && font.name !== "Calibri") look.font = font.name;
  if (fill?.type === "pattern" && fill.pattern && fill.pattern !== "none") {
    const fillColour = cssColour(fill.fgColor) ?? cssColour(fill.bgColor);
    if (fillColour) look.fill = fillColour;
  }
  const horizontal = alignment?.horizontal;
  if (horizontal === "left" || horizontal === "center" || horizontal === "right" || horizontal === "justify") look.align = horizontal;
  else if (horizontal === "centerContinuous") look.align = "center";
  const vertical = alignment?.vertical;
  if (vertical === "top" || vertical === "bottom") look.valign = vertical;
  else if (vertical === "middle" || vertical === "center") look.valign = "middle";
  if (alignment?.wrapText) look.wrap = true;
  if (alignment?.indent) look.indent = alignment.indent;
  const borders = { top: cssEdge(border?.top), right: cssEdge(border?.right), bottom: cssEdge(border?.bottom), left: cssEdge(border?.left) };
  if (Object.values(borders).some(Boolean)) look.borders = Object.fromEntries(Object.entries(borders).filter(([, value]) => value));
  return Object.keys(look).length ? (look as CellLook) : undefined;
}

/** A1-style range's corners, 1-based (`B2:D4` → rows 2–4, columns 2–4) */
export function rangeOf(range: string): { readonly top: number; readonly left: number; readonly bottom: number; readonly right: number } | undefined {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(range.replace(/\$/g, ""));
  if (!match) return undefined;
  const column = (letters: string) => [...letters.toUpperCase()].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0);
  const [a, b] = [column(match[1]!), column(match[3]!)];
  const [c, d] = [Number(match[2]), Number(match[4])];
  return { top: Math.min(c, d), bottom: Math.max(c, d), left: Math.min(a, b), right: Math.max(a, b) };
}

/** A worksheet made into a sheet of the model: its rows and columns to MOST, merged cells, frozen panes */
export function sheetOf(worksheet: ExcelWorksheet, locale?: string): Sheet {
  const rowCount = Math.min(worksheet.rowCount, MOST.rows);
  const columnCount = Math.min(worksheet.columnCount, MOST.columns);
  // Merged cells: each range's first cell spans it, the others covered
  const spans = new Map<string, { readonly rows: number; readonly columns: number }>();
  const covered = new Set<string>();
  for (const merge of worksheet.model?.merges ?? []) {
    const range = rangeOf(merge);
    if (!range || range.top > rowCount || range.left > columnCount) continue;
    const bottom = Math.min(range.bottom, rowCount);
    const right = Math.min(range.right, columnCount);
    spans.set(`${range.top}:${range.left}`, { rows: bottom - range.top + 1, columns: right - range.left + 1 });
    for (let row = range.top; row <= bottom; row++) for (let column = range.left; column <= right; column++) if (row !== range.top || column !== range.left) covered.add(`${row}:${column}`);
  }
  const columns: number[] = [];
  for (let column = 1; column <= columnCount; column++) {
    const one = worksheet.getColumn(column);
    columns.push(one.hidden ? 0 : columnPixels(one.width ?? worksheet.properties?.defaultColWidth));
  }
  const rows: SheetRow[] = [];
  for (let row = 1; row <= rowCount; row++) {
    const excelRow = worksheet.getRow(row);
    const cells: (SheetCell | "covered" | undefined)[] = [];
    for (let column = 1; column <= columnCount; column++) {
      const key = `${row}:${column}`;
      if (covered.has(key)) {
        cells.push("covered");
        continue;
      }
      const cell = worksheet.getCell(row, column);
      const shown = showValue(cell.value, cell.style?.numFmt ?? cell.numFmt, locale);
      const look = lookOf(cell.style);
      const span = spans.get(key);
      if (!shown.text && !look && !span) {
        cells.push(undefined);
        continue;
      }
      cells.push({
        text: shown.text,
        ...(shown.number ? { number: true } : {}),
        ...(look ? { look } : {}),
        ...(span && span.rows > 1 ? { rowSpan: span.rows } : {}),
        ...(span && span.columns > 1 ? { colSpan: span.columns } : {}),
      });
    }
    const height = excelRow.hidden ? 0 : excelRow.height !== undefined ? rowPixels(excelRow.height) : undefined;
    rows.push({ ...(height !== undefined ? { height } : {}), cells });
  }
  const view = worksheet.views?.find((one) => one.state === "frozen");
  const cut = worksheet.rowCount > rowCount || worksheet.columnCount > columnCount ? { rows: worksheet.rowCount, columns: worksheet.columnCount } : undefined;
  return {
    name: worksheet.name,
    columns,
    rows,
    frozen: { rows: Math.min(view?.ySplit ?? 0, rowCount), columns: Math.min(view?.xSplit ?? 0, columnCount) },
    ...(cut ? { cut } : {}),
  };
}

/** A workbook's visible sheets made into the model */
export const workbookOf = (workbook: ExcelWorkbook, locale?: string): Workbook => ({
  sheets: workbook.worksheets.filter((sheet) => !sheet.state || sheet.state === "visible").map((sheet) => sheetOf(sheet, locale)),
});
