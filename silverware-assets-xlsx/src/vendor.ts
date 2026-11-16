// ExcelJS as a file of its own beside Silverware Assets XLSX's bundle (silverware-assets-xlsx-exceljs.js, built by scripts/build.mjs),
// loaded the first time a workbook is drawn (src/load.ts): never imported by the bundle itself.
import ExcelJS from "exceljs/dist/exceljs.bare.min.js";

export const Workbook = ExcelJS.Workbook;
