// Silverware Assets PDF's type of file, registered with Silverware Assets (shared/assets.ts) in place of its own `pdf`: the
// preview its first page as an image. No `embed` of its own: the original, the side panel and the enlarged view are the
// browser's own PDF viewer, as Silverware Assets draws them (the user's choice, 2026-11-14: a reader of pages would add
// nothing to the browser's).
import { assetName, type AssetType } from "../../shared/assets.ts";
import { pdfPreview } from "./preview.ts";

// A document with lines of text (as Silverware Assets' own PDF's), SVG text so it follows the theme's colour
const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';

// Narrower than this (px) there is no room for a preview: the host's own
const LEAST_WIDTH = 40;

export function pdfType(doc: Document): AssetType {
  return {
    name: "pdf",
    match: { kind: ["file", "web"], mime: "application/pdf", ext: ["pdf"] },
    icon: ICON,
    views: {
      preview: (context) =>
        "url" in context.asset && context.viewport.width >= LEAST_WIDTH
          ? pdfPreview(doc, context.asset.url, assetName(context.asset), { width: context.viewport.width, height: context.viewport.height }, context.signal)
          : null,
    },
  };
}
