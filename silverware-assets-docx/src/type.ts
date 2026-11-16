// Silverware Assets DOCX's type of file, registered with Silverware Assets (shared/assets.ts): a Word document (.docx), its
// preview its first page drawn smaller, the file shown full (and the side panel and the enlarged view, which draw a type's
// `full`) a reader of the whole document.
import type { KeptKeys } from "../../shared/silverbullet/keptkeys.ts";
import { assetName, type AssetType } from "../../shared/assets.ts";
import { docxPreview } from "./preview.ts";
import { docxReader } from "./reader.ts";

// A page with lines of text and a corner folded, SVG text so it follows the theme's colour (Lucide's file-text)
const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/></svg>';

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
// Narrower than this (px) there is no room for a preview: the card
const LEAST_WIDTH = 40;

/** The type; `keyKept`: told each key a reader keeps from the page (SilverBullet's shortcuts that do nothing there said so) */
export function docxType(doc: Document, keyKept?: KeptKeys): AssetType {
  return {
    name: "docx",
    label: "Word (DOCX)",
    document: true,
    match: { kind: ["file", "web"], mime: DOCX_MIME, ext: ["docx"] },
    icon: ICON,
    // Its preview kept in the space where Silverware Assets keeps previews: a document read and laid out once
    storesPreview: true,
    // (Read whole and laid out by this plugin's script: a large one drawn on a click alone before it is inserted)
    costly: true,
    views: {
      preview: (context) =>
        "url" in context.asset && context.viewport.width >= LEAST_WIDTH
          ? docxPreview(doc, context.asset.url, assetName(context.asset), ICON, { width: context.viewport.width, height: context.viewport.height }, context.signal, context.stored)
          : null,
      full: (context) => ("url" in context.asset ? docxReader(doc, context.asset.url, assetName(context.asset), context.fills ? undefined : context.viewport.height, context.signal, keyKept) : null),
    },
  };
}
