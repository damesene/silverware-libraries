// A Word document (.docx) read and drawn by docx-preview (docs/silverware-viewers.md), loaded the first time a document
// is drawn from beside the bundle (silverware-assets-docx-docxpreview.js: docx-preview and JSZip, bundled by scripts/build.mjs
// from their packages), as Silverware Chart loads Chart.js: offline, never in a space showing no document.

const RENDERER_FILE = "./silverware-assets-docx-docxpreview.js";
// How long the renderer not loaded is believed before it is asked again (ms)
const RETRY_MS = 30_000;
// The classes docx-preview gives what it draws: `<base>-wrapper` round the pages, `section.<base>` each page
export const DOCX_CLASS = "swa-docx-docx";

type Renderer = {
  renderAsync(data: Blob, body: HTMLElement, styles?: HTMLElement, options?: Readonly<Record<string, unknown>>): Promise<unknown>;
};

let loading: Promise<Renderer> | undefined;

function renderer(): Promise<Renderer> {
  loading ??= import(new URL(RENDERER_FILE, import.meta.url).href).catch((error: unknown) => {
    setTimeout(() => (loading = undefined), RETRY_MS);
    throw error;
  });
  return loading;
}

/** A document drawn: its styles and its pages, into elements of their own (not yet in the page) */
export type DrawnDocx = { readonly styles: HTMLElement; readonly body: HTMLElement };

/**
 * A document fetched (its URL resolved by the document's base, as the page's own elements resolve it) and drawn: each
 * page a `section.swa-docx-docx` in a wrapper, its styles scoped by that class; images as data URLs (nothing to let go)
 */
export async function drawDocx(doc: Document, url: string): Promise<DrawnDocx> {
  const [lib, response] = await Promise.all([renderer(), fetch(new URL(url, doc.baseURI).href)]);
  if (!response.ok) throw new Error(`the file could not be read (${response.status})`);
  const data = await response.blob();
  const styles = doc.createElement("div");
  const body = doc.createElement("div");
  await lib.renderAsync(data, body, styles, {
    className: DOCX_CLASS,
    inWrapper: true,
    breakPages: true,
    useBase64URL: true,
    renderComments: false,
    renderChanges: false,
    // (A document's alternative chunks are HTML of its own, drawn in a frame: none)
    renderAltChunks: false,
    experimental: false,
  });
  return { styles, body };
}

/** The CSS pixels of a length in points (docx-preview sizes a page in pt) */
export const pointsToPixels = (points: number): number => (points * 96) / 72;

/** A page's own size in CSS pixels, as docx-preview sets it (`width: 612pt; min-height: 792pt`), none where it sets none */
export function pageSize(page: HTMLElement): { readonly width: number; readonly height: number } | undefined {
  const length = (value: string) => {
    const match = /^([\d.]+)(pt|px)$/.exec(value.trim());
    if (!match) return undefined;
    return match[2] === "pt" ? pointsToPixels(Number(match[1])) : Number(match[1]);
  };
  const width = length(page.style.width);
  const height = length(page.style.minHeight || page.style.height);
  return width && height ? { width, height } : undefined;
}
