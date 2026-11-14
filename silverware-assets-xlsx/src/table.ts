// A sheet drawn as a table (docs/silverware-viewers.md), as a spreadsheet shows it: the columns' letters and the rows'
// numbers (where asked), Excel's grid, each cell's text with its look (fonts, fills, alignment, borders, merged cells),
// the columns' widths and rows' heights; numbers at the right where nothing aligns them. The frozen rows and columns
// are held as it scrolls (`holdFrozen`, once it is laid out).
import { el } from "../../shared/elements.ts";
import { type CellLook, columnName, type Sheet, type SheetCell } from "./model.ts";

// The rows' numbers' column (px), and a row's height where the sheet gives none (Excel's 15 pt)
const NUMBERS_WIDTH = 40;
const ROW_HEIGHT = 20;

/** A cell's look as inline CSS */
export function cellStyle(look: CellLook | undefined, number: boolean): Record<string, string> {
  const style: Record<string, string> = {};
  if (look?.bold) style.fontWeight = "bold";
  if (look?.italic) style.fontStyle = "italic";
  const decoration = [look?.underline ? "underline" : "", look?.strike ? "line-through" : ""].filter(Boolean).join(" ");
  if (decoration) style.textDecoration = decoration;
  if (look?.color) style.color = look.color;
  if (look?.fill) style.backgroundColor = look.fill;
  if (look?.size) style.fontSize = `${look.size}pt`;
  if (look?.font) style.fontFamily = `"${look.font.replace(/"/g, "")}", var(--swa-xlsx-font)`;
  const align = look?.align ?? (number ? "right" : undefined);
  if (align) style.textAlign = align;
  if (look?.valign) style.verticalAlign = look.valign;
  if (look?.wrap) style.whiteSpace = "pre-wrap";
  if (look?.indent) style.paddingLeft = `${4 + look.indent * 9}px`;
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const border = look?.borders?.[side];
    if (border) style[`border${side[0]!.toUpperCase()}${side.slice(1)}`] = border;
  }
  return style;
}

/** A sheet drawn: its first `rows` and `columns` (all where none), with the letters and numbers where `headers` */
export function drawSheet(doc: Document, sheet: Sheet, options: { readonly rows?: number; readonly columns?: number; readonly headers: boolean }): HTMLTableElement {
  const columnCount = Math.min(sheet.columns.length, options.columns ?? Infinity);
  const rowCount = Math.min(sheet.rows.length, options.rows ?? Infinity);
  const table = el(doc, "table", { class: "swa-xlsx-sheet" });
  const colgroup = el(doc, "colgroup");
  if (options.headers) colgroup.append(el(doc, "col", { attrs: { style: `width: ${NUMBERS_WIDTH}px` } }));
  for (let column = 0; column < columnCount; column++) colgroup.append(el(doc, "col", { attrs: { style: `width: ${sheet.columns[column]}px` } }));
  table.append(colgroup);
  const width = sheet.columns.slice(0, columnCount).reduce((sum, one) => sum + one, options.headers ? NUMBERS_WIDTH : 0);
  table.style.width = `${width}px`;
  if (options.headers) {
    const head = el(doc, "tr", { class: "swa-xlsx-sheet-letters" }, el(doc, "th", { class: "swa-xlsx-sheet-corner" }));
    for (let column = 1; column <= columnCount; column++) head.append(el(doc, "th", { text: columnName(column) }));
    table.append(el(doc, "thead", {}, head));
  }
  const body = el(doc, "tbody");
  for (let index = 0; index < rowCount; index++) {
    const row = sheet.rows[index]!;
    const tr = el(doc, "tr");
    tr.style.height = `${row.height ?? ROW_HEIGHT}px`;
    if (row.height === 0) tr.hidden = true;
    if (options.headers) tr.append(el(doc, "th", { class: "swa-xlsx-sheet-number", text: String(index + 1) }));
    for (let column = 0; column < columnCount; column++) {
      const cell = row.cells[column];
      if (cell === "covered") continue;
      tr.append(cellElement(doc, cell, rowCount - index, columnCount - column));
    }
    body.append(tr);
  }
  table.append(body);
  return table;
}

/** A cell's element: its text and look, its span held within what is drawn */
function cellElement(doc: Document, cell: SheetCell | undefined, rowsLeft: number, columnsLeft: number): HTMLTableCellElement {
  const td = el(doc, "td", cell?.text ? { text: cell.text } : {});
  if (!cell) return td;
  Object.assign(td.style, cellStyle(cell.look, !!cell.number));
  if (cell.rowSpan) td.rowSpan = Math.min(cell.rowSpan, rowsLeft);
  if (cell.colSpan) td.colSpan = Math.min(cell.colSpan, columnsLeft);
  return td;
}

/**
 * A drawn sheet's frozen rows and columns held as it scrolls (sticky, each at the place the ones before it end, under
 * the letters and right of the numbers), measured once it is laid out. Measured in the table's own pixels: a zoom on
 * it (CSS zoom) scales what is set in it again, so what was measured is divided by it
 */
export function holdFrozen(table: HTMLTableElement, frozen: Sheet["frozen"]): void {
  const zoom = Number(table.style.zoom) || 1;
  const height = (element: Element) => element.getBoundingClientRect().height / zoom;
  const head = table.tHead?.rows[0];
  const top = head ? height(head) : 0;
  const rows = [...table.tBodies[0]!.rows];
  // (Layers: a frozen row's cells over the rows scrolled under them, its number over the numbers' column; the letters,
  // the style page's, over all)
  let offset = top;
  for (const row of rows.slice(0, frozen.rows)) {
    for (const cell of row.cells) {
      cell.style.position = "sticky";
      cell.style.top = `${offset}px`;
      cell.style.zIndex = cell.tagName === "TH" ? "3" : "2";
      cell.classList.add("swa-xlsx-sheet-frozen");
    }
    offset += height(row);
  }
  if (frozen.columns) {
    const numbers = head ? (head.cells[0]?.getBoundingClientRect().width ?? 0) / zoom : 0;
    const widths = [...table.querySelectorAll("col")].slice(head ? 1 : 0).map((col) => parseFloat(col.style.width) || 0);
    const lefts = widths.map((_, column) => numbers + widths.slice(0, column).reduce((sum, one) => sum + one, 0));
    // Each row's cells by their columns: a column taken by a cell merged down from a row above has none in this row
    const takenUntil: number[] = [];
    rows.forEach((row, index) => {
      let column = 0;
      for (const cell of [...row.cells].filter((one) => one.tagName === "TD")) {
        while ((takenUntil[column] ?? -1) >= index) column++;
        if (cell.rowSpan > 1) for (let span = 0; span < cell.colSpan; span++) takenUntil[column + span] = index + cell.rowSpan - 1;
        if (column < frozen.columns) {
          cell.style.position = "sticky";
          cell.style.left = `${lefts[column] ?? numbers}px`;
          cell.style.zIndex = cell.style.top ? "3" : "2";
          cell.classList.add("swa-xlsx-sheet-frozen");
        }
        column += cell.colSpan;
      }
    });
  }
  table.toggleAttribute("data-swa-xlsx-held", true);
}
