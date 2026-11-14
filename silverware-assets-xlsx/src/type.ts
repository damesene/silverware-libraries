// Silverware Assets XLSX's type of file, registered with Silverware Assets (shared/assets.ts): an Excel workbook (.xlsx), its
// preview its first sheet's first cells drawn small, the original (and the side panel and the enlarged view, which draw
// a type's `embed`) a reader of every sheet.
import { assetName, type AssetType } from "../../shared/assets.ts";
import { xlsxPreview } from "./preview.ts";
import { xlsxReader } from "./reader.ts";

// A sheet of cells, SVG text so it follows the theme's colour (Lucide's sheet)
const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 9v12M15 9v12"/></svg>';

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// Narrower than this (px) there is no room for a preview: the card
const LEAST_WIDTH = 40;

export function xlsxType(doc: Document): AssetType {
  return {
    name: "xlsx",
    match: { kind: ["file", "web"], mime: XLSX_MIME, ext: ["xlsx"] },
    icon: ICON,
    // Its preview kept in the space where Silverware Assets keeps previews: a workbook read once
    storesPreview: true,
    views: {
      preview: (context) =>
        "url" in context.asset && context.viewport.width >= LEAST_WIDTH
          ? xlsxPreview(doc, context.asset.url, assetName(context.asset), ICON, { width: context.viewport.width, height: context.viewport.height }, context.signal, context.stored)
          : null,
      embed: (context) => ("url" in context.asset ? xlsxReader(doc, context.asset.url, assetName(context.asset), context.fills ? undefined : context.viewport.height, context.signal) : null),
    },
  };
}
