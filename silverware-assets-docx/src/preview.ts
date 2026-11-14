// A Word document's preview: its first page drawn smaller (docs/silverware-viewers.md), as docx-preview draws it, scaled
// down (CSS zoom) to the preview's height, cut to its own size, in a shadow root of its own (src/documents.ts). A box of
// the preview's room at once, the type's icon and the file's name in it until the page is drawn, and where it cannot be
// (the renderer not loaded, a file it cannot read: said in its title).
import { el } from "../../shared/elements.ts";
import { drawn, showDocument } from "./documents.ts";
import { DOCX_CLASS, pageSize } from "./load.ts";

/** The room a preview has, in CSS pixels */
export type PreviewBox = { readonly width: number; readonly height: number };

/** The scale a page is drawn at to fit a preview's room, its proportions kept */
export const previewScale = (page: PreviewBox, box: PreviewBox): number => Math.max(0, Math.min(box.width / page.width, box.height / page.height));

/** A document's preview: a box at once (its icon and name), its first page drawn smaller in it once read */
export function docxPreview(doc: Document, url: string, name: string, icon: string, box: PreviewBox, signal: AbortSignal): HTMLElement {
  const preview = el(doc, "div", { class: "swa-docx-preview", attrs: { "data-swa-docx-state": "drawing", title: name } }, el(doc, "span", { class: "swa-docx-preview-icon", html: icon }), el(doc, "span", { class: "swa-docx-preview-name", text: name }));
  preview.style.setProperty("--swa-docx-box-width", `${Math.round(box.width)}px`);
  preview.style.setProperty("--swa-docx-box-height", `${Math.round(box.height)}px`);
  drawn(doc, url)
    .then(({ styles, body }) => {
      if (signal.aborted) return;
      const first = body.querySelector<HTMLElement>(`section.${DOCX_CLASS}`);
      const size = first && pageSize(first);
      if (!first || !size) throw new Error("the document has no page");
      const scale = previewScale(size, box);
      // (docx-preview's wrapper's class kept: its rules are scoped by it)
      const wrapper = el(doc, "div", { class: `${DOCX_CLASS}-wrapper` }, first.cloneNode(true));
      wrapper.style.zoom = String(scale);
      const page = el(doc, "div", { class: "swa-docx-preview-page" });
      page.style.width = `${Math.round(size.width * scale)}px`;
      page.style.height = `${Math.round(size.height * scale)}px`;
      showDocument(page, styles, [wrapper], "previewing");
      preview.replaceChildren(page);
      preview.dataset.swaDocxState = "page";
    })
    .catch((error: unknown) => {
      if (signal.aborted) return;
      preview.dataset.swaDocxState = "failed";
      preview.title = `${name}: ${error instanceof Error ? error.message : String(error)}`;
    });
  return preview;
}
