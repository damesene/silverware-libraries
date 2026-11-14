// A Word document's preview: its first page drawn smaller (docs/silverware-viewers.md), as docx-preview draws it, scaled
// down (CSS zoom) to the preview's height, cut to its own size, in a shadow root of its own (src/documents.ts). A box of
// the preview's room at once, the type's icon and the file's name in it until the page is drawn, and where it cannot be
// (the renderer not loaded, a file it cannot read: said in its title). Where Silverware Assets keeps previews in the
// space (`stored`, docs/silverware-assets-stored-previews.md), the first page and its styles are kept as HTML (its
// images made smaller), read back and made safe after: the document not read nor laid out again.
import type { StoredPreview } from "../../shared/assets.ts";
import { el } from "../../shared/elements.ts";
import { fileVersion } from "../../shared/reads.ts";
import { safeHtml } from "../../shared/safehtml.ts";
import { drawn, showDocument } from "./documents.ts";
import { DOCX_CLASS, pageSize } from "./load.ts";

/** The room a preview has, in CSS pixels */
export type PreviewBox = { readonly width: number; readonly height: number };

/** The scale a page is drawn at to fit a preview's room, its proportions kept */
export const previewScale = (page: PreviewBox, box: PreviewBox): number => Math.max(0, Math.min(box.width / page.width, box.height / page.height));

/** A document's first page as drawn, its styles, its size */
type FirstPage = { readonly styles: HTMLElement; readonly page: HTMLElement; readonly size: PreviewBox };

// An image of a page kept: its longer side at most this (px), as a preview shows it
const STORED_IMAGE_SIDE = 600;
// The first pages kept in memory (by file and version: a preview drawn anew shows at once), the oldest let go past this many
const KEPT = 20;
const kept = new Map<string, Promise<FirstPage>>();

/** A document's first page as docx-preview draws it */
async function drawnFirst(doc: Document, url: string, again = false): Promise<FirstPage> {
  const { styles, body } = await drawn(doc, url, again);
  const page = body.querySelector<HTMLElement>(`section.${DOCX_CLASS}`);
  const size = page && pageSize(page);
  if (!page || !size) throw new Error("the document has no page");
  return { styles, page, size };
}

/** A page's images (docx-preview's data URLs) made smaller where they are larger than a preview shows them */
async function shrinkImages(doc: Document, root: HTMLElement): Promise<void> {
  const win = doc.defaultView;
  if (!win) return;
  await Promise.all(
    [...root.querySelectorAll("img")].map(async (img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src.startsWith("data:image/")) return;
      const image = new win.Image();
      image.src = src;
      try {
        await image.decode();
      } catch {
        return;
      }
      const scale = STORED_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight, 1);
      if (!(scale < 1)) return;
      const canvas = doc.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const smaller = canvas.toDataURL("image/webp", 0.85);
      if (smaller.length < src.length) img.setAttribute("src", smaller);
    }),
  );
}

/** A first page as kept: its styles, the page, its size */
async function serialized(doc: Document, first: FirstPage): Promise<string> {
  const page = first.page.cloneNode(true) as HTMLElement;
  await shrinkImages(doc, page);
  const styles = [...first.styles.children].map((style) => style.outerHTML).join("");
  return `<div data-swa-docx-styles>${styles}</div><div data-swa-docx-page data-swa-docx-width="${first.size.width}" data-swa-docx-height="${first.size.height}">${page.outerHTML}</div>`;
}

/** A first page read back from what was kept, made safe; none where it is not one */
function parsed(doc: Document, html: string): FirstPage | undefined {
  const box = doc.createElement("div");
  box.append(safeHtml(doc, html));
  const styles = box.querySelector<HTMLElement>(":scope > [data-swa-docx-styles]");
  const holder = box.querySelector<HTMLElement>(":scope > [data-swa-docx-page]");
  const page = holder?.querySelector<HTMLElement>(`section.${DOCX_CLASS}`);
  const width = Number(holder?.getAttribute("data-swa-docx-width"));
  const height = Number(holder?.getAttribute("data-swa-docx-height"));
  if (!styles || !page || !(width > 0) || !(height > 0)) return undefined;
  return { styles, page, size: { width, height } };
}

/** A document's first page as kept in the space: read back where kept for this version, else drawn and kept (`anew`: drawn) */
async function storedFirst(doc: Document, url: string, stored: StoredPreview): Promise<FirstPage> {
  const key = `${await fileVersion(new URL(url, doc.baseURI).href, doc.baseURI)} ${url}`;
  const known = stored.anew ? undefined : kept.get(key);
  if (known) return known;
  const made = (async () => {
    const text = await (await stored.read("text/html"))?.text();
    const own = text ? parsed(doc, text) : undefined;
    if (own) return own;
    const first = await drawnFirst(doc, url, stored.anew);
    // (Not kept where the space cannot be written: drawn again next time, as without)
    void serialized(doc, first)
      .then((html) => stored.write(new Blob([html], { type: "text/html" })))
      .catch(() => undefined);
    return first;
  })();
  kept.delete(key);
  kept.set(key, made);
  made.catch(() => kept.get(key) === made && kept.delete(key));
  while (kept.size > KEPT) kept.delete(kept.keys().next().value!);
  return made;
}

/** A document's preview: a box at once (its icon and name), its first page drawn smaller in it once read */
export function docxPreview(doc: Document, url: string, name: string, icon: string, box: PreviewBox, signal: AbortSignal, stored?: StoredPreview): HTMLElement {
  const preview = el(doc, "div", { class: "swa-docx-preview", attrs: { "data-swa-docx-state": "drawing", title: name } }, el(doc, "span", { class: "swa-docx-preview-icon", html: icon }), el(doc, "span", { class: "swa-docx-preview-name", text: name }));
  preview.style.setProperty("--swa-docx-box-width", `${Math.round(box.width)}px`);
  preview.style.setProperty("--swa-docx-box-height", `${Math.round(box.height)}px`);
  (stored ? storedFirst(doc, url, stored) : drawnFirst(doc, url))
    .then(({ styles, page: first, size }) => {
      if (signal.aborted) return;
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
