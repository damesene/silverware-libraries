// ExcelJS' browser build as src/vendor.ts imports it (its package's types are those of its main entry)
declare module "exceljs/dist/exceljs.bare.min.js" {
  import ExcelJS from "exceljs";
  export default ExcelJS;
}
