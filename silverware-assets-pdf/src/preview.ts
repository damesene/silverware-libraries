// A PDF's preview: its first page as an image (docs/silverware-viewers.md). A box of the preview's size at once, the
// page in it once drawn; where pdf.js is not loaded or cannot read the file, the browser's viewer in it (Silverware
// Assets lays its layer over a viewer a preview puts in later, so its click stays the preview's).
import { fileVersion, readTurns } from "../../shared/reads.ts";
import { el } from "../../shared/elements.ts";
import { drawPage, openPdf, screenRatio } from "./pdfjs/load.ts";

// At most so many PDFs read at once: a page of many previews does not read them all together
const AT_ONCE = 2;
// The pages drawn kept (by file and the pixels they are drawn at), so a preview drawn anew (the editor draws widgets
// again as the page is edited near them) shows at once; the oldest let go past this many
const KEPT = 40;
// Why a read was left: no preview waits for it any more (drawn anew, the page left)
const UNWANTED = "no preview waits for this page any more";

/** The size a page is fitted into, in CSS pixels; a page's own, in its points */
export type PageBox = { readonly width: number; readonly height: number };

/** The scale a page of a size is drawn at to fit a box, its proportions kept, sharp for the screen's pixels */
export function fittedScale(page: PageBox, box: PageBox, ratio: number): number {
  return Math.max(0, Math.min(box.width / page.width, box.height / page.height)) * ratio;
}

function drawnSize(page: PageBox, box: PageBox, ratio: number): PageBox {
  const scale = fittedScale(page, box, ratio);
  return { width: Math.max(1, Math.floor(page.width * scale)), height: Math.max(1, Math.floor(page.height * scale)) };
}

const inTurn = readTurns(AT_ONCE);

/** A PDF's first page drawn to fit a box, as an image (PNG), and the page's own size */
async function drawFirstPage(doc: Document, url: string, box: PageBox, ratio: number): Promise<{ readonly image: Blob; readonly page: PageBox }> {
  const task = await openPdf(doc, url);
  try {
    const page = await (await task.promise).getPage(1);
    const own = page.getViewport({ scale: 1 });
    const canvas = await drawPage(doc, page, fittedScale(own, box, ratio));
    const image = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
    if (!image) throw new Error("the page could not be drawn");
    return { image, page: { width: own.width, height: own.height } };
  } finally {
    void task.destroy();
  }
}

// The images drawn by file and the pixels they are drawn at (or, before a file's page is known, the box asked): the
// newest last. Each preview makes its own URL of an image and lets it go once shown, so letting one go here takes
// nothing from a preview
const kept = new Map<string, Promise<Blob>>();
// Each file's page size, once read: a box of another width drawing the same pixels (a preview bound by its height, the
// text's width changed) finds its image kept
const pageSizes = new Map<string, PageBox>();
// The previews waiting for each image being drawn: none left (each drawn anew, the page left), it is not drawn
const waitingFor = new Map<string, Set<AbortSignal>>();

/** A drawn page's key: its file and version, and the pixels it is drawn at (before its page is known, the box asked) */
function keyOf(version: string, box: PageBox, ratio: number): string {
  const page = pageSizes.get(version);
  if (!page) return `box ${Math.round(box.width)}x${Math.round(box.height)}@${ratio} ${version}`;
  const size = drawnSize(page, box, ratio);
  return `${size.width}x${size.height} ${version}`;
}

function keep(key: string, image: Promise<Blob>): void {
  kept.delete(key);
  kept.set(key, image);
  while (kept.size > KEPT) kept.delete(kept.keys().next().value!);
}

/**
 * A PDF's first page as an image, drawn once per file, version (what its server says of it now: replaced under the same
 * name, drawn again) and size, for a preview waiting on it while its signal holds
 */
async function firstPage(doc: Document, address: string, box: PageBox, signal: AbortSignal): Promise<Blob> {
  const url = new URL(address, doc.baseURI).href;
  const version = `${await fileVersion(url, doc.baseURI)} ${url}`;
  const ratio = screenRatio(doc);
  const key = keyOf(version, box, ratio);
  const known = kept.get(key);
  if (known) {
    keep(key, known);
    waitingFor.get(key)?.add(signal);
    return known;
  }
  const signals = new Set([signal]);
  waitingFor.set(key, signals);
  const wanted = () => [...signals].some((one) => !one.aborted);
  const drawn = inTurn(() => (wanted() ? drawFirstPage(doc, url, box, ratio) : Promise.reject(new Error(UNWANTED)))).then(({ image, page }) => {
    pageSizes.set(version, page);
    // (Kept by the pixels it is drawn at too: another box drawing those finds it)
    keep(keyOf(version, box, ratio), Promise.resolve(image));
    return image;
  });
  keep(key, drawn);
  // (A failure not kept: tried again next time)
  void drawn
    .catch(() => {
      if (kept.get(key) === drawn) kept.delete(key);
    })
    .finally(() => waitingFor.delete(key));
  return drawn;
}

/** A PDF's preview: a box at once, its first page in it as an image once drawn; the browser's viewer where it cannot be */
export function pdfPreview(doc: Document, url: string, name: string, box: PageBox, signal: AbortSignal): HTMLElement {
  const preview = el(doc, "div", { class: "swa-pdf-preview", attrs: { "data-swa-pdf-state": "drawing" } });
  preview.style.setProperty("--swa-pdf-box-width", `${Math.round(box.width)}px`);
  preview.style.setProperty("--swa-pdf-box-height", `${Math.round(box.height)}px`);
  firstPage(doc, url, box, signal).then(
    (image) => {
      if (signal.aborted) return;
      const src = URL.createObjectURL(image);
      const img = el(doc, "img", { attrs: { src, alt: name, draggable: "false" } });
      // (Its own URL let go once shown: the image keeps what it decoded)
      const done = () => URL.revokeObjectURL(src);
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      preview.replaceChildren(img);
      preview.dataset.swaPdfState = "page";
    },
    () => {
      if (signal.aborted) return;
      preview.replaceChildren(el(doc, "object", { attrs: { type: "application/pdf", data: url } }));
      preview.dataset.swaPdfState = "viewer";
    },
  );
  return preview;
}
