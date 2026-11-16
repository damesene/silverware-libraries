// A workbook as Silverware Assets XLSX draws it (docs/silverware-viewers.md), plain data: each sheet's cells as text with their
// look, its columns' widths and rows' heights in CSS pixels, its merged cells, its frozen rows and columns, how much of
// it was left out. Made from what ExcelJS read (src/workbook.ts); drawn by src/table.ts. Pure.

/** A cell's look: what of Excel's formatting is drawn */
export type CellLook = {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strike?: boolean;
  // CSS colours (`#rrggbb`)
  readonly color?: string;
  readonly fill?: string;
  // Points
  readonly size?: number;
  readonly font?: string;
  readonly align?: "left" | "center" | "right" | "justify";
  readonly valign?: "top" | "middle" | "bottom";
  readonly wrap?: boolean;
  readonly indent?: number;
  // CSS borders (`1px solid #000`)
  readonly borders?: { readonly top?: string; readonly right?: string; readonly bottom?: string; readonly left?: string };
};

/** A cell drawn: its text as Excel shows it, its look, the cells it spans where merged (none: one) */
export type SheetCell = { readonly text: string; readonly look?: CellLook; readonly number?: boolean; readonly rowSpan?: number; readonly colSpan?: number };

/** A row: its height (px; none: the sheet's default), its cells by column (none: empty; `covered`: under a merged cell) */
export type SheetRow = { readonly height?: number; readonly cells: readonly (SheetCell | "covered" | undefined)[] };

export type Sheet = {
  readonly name: string;
  // Each column's width (px), as many as are drawn
  readonly columns: readonly number[];
  readonly rows: readonly SheetRow[];
  // Rows and columns held in view as the sheet scrolls (Excel's frozen panes)
  readonly frozen: { readonly rows: number; readonly columns: number };
  // How many rows and columns the sheet has, where more than are drawn
  readonly cut?: { readonly rows: number; readonly columns: number };
};

export type Workbook = { readonly sheets: readonly Sheet[] };

/** The most drawn of a sheet: larger ones drawn to this, the rest said */
export const MOST = { rows: 2000, columns: 100 } as const;

/** A column's letters (1: A, 27: AA) */
export function columnName(column: number): string {
  let name = "";
  for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** A column's width in CSS pixels from Excel's (characters of the default font's digit: about 7 px each and 5 of padding) */
export const columnPixels = (characters: number | undefined): number => Math.round((characters ?? 8.43) * 7 + 5);

/** A row's height in CSS pixels from Excel's (points) */
export const rowPixels = (points: number): number => Math.round((points * 96) / 72);
