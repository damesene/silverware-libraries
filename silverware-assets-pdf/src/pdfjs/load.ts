// pdf.js, loaded the first time a PDF is drawn, from beside the bundle (silverware-assets-pdf-pdfjs.js and its worker, the
// pdfjs-dist package's own files copied unchanged by scripts/build.mjs), as Silverware Chart loads Chart.js: offline,
// and never in a space showing no PDF. Its types are not imported (the package is a file beside the bundle, not bundled):
// what is used of it is declared here.

const PDFJS_FILE = "./silverware-assets-pdf-pdfjs.js";
const WORKER_FILE = "./silverware-assets-pdf-pdfjs-worker.js";
// How long pdf.js not loaded is believed before it is asked again (ms): a moment off the network is not the session's
const RETRY_MS = 30_000;

export type PdfWorker = { readonly destroyed?: boolean };
export type PdfViewport = { readonly width: number; readonly height: number };
export type PdfPage = {
  getViewport(options: { readonly scale: number }): PdfViewport;
  render(options: { readonly canvas: HTMLCanvasElement; readonly viewport: PdfViewport }): { readonly promise: Promise<void> };
};
export type PdfDocument = { getPage(number: number): Promise<PdfPage> };
export type PdfTask = { readonly promise: Promise<PdfDocument>; destroy(): Promise<void> };
type PdfJs = {
  readonly GlobalWorkerOptions: { workerSrc: string };
  readonly PDFWorker: new (options?: { readonly name?: string }) => PdfWorker;
  getDocument(source: { readonly url: string; readonly isEvalSupported: boolean; readonly disableAutoFetch: boolean; readonly worker: PdfWorker }): PdfTask;
};

let loading: Promise<PdfJs> | undefined;
let worker: PdfWorker | undefined;

/** pdf.js, loaded once (not loaded: asked again a while later), and its one worker for every PDF read (one that died made anew) */
async function pdfjs(): Promise<{ readonly lib: PdfJs; readonly worker: PdfWorker }> {
  loading ??= import(new URL(PDFJS_FILE, import.meta.url).href).then(
    (lib: PdfJs) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(WORKER_FILE, import.meta.url).href;
      return lib;
    },
    (error: unknown) => {
      setTimeout(() => (loading = undefined), RETRY_MS);
      throw error;
    },
  );
  const lib = await loading;
  if (!worker || worker.destroyed) worker = new lib.PDFWorker({ name: "silverware-assets-pdf" });
  return { lib, worker };
}

/**
 * A PDF opened (its URL resolved as the page's own elements resolve it, by the document's base: pdf.js resolves a
 * relative URL by the window's address, which is a page's in a folder, `Folder/Page`, and fetched the app's page there)
 */
export async function openPdf(doc: Document, url: string): Promise<PdfTask> {
  const { lib, worker } = await pdfjs();
  // (No script of the file run; only the parts needed fetched, where the server sends parts; the worker kept as the
  // document read is let go)
  return lib.getDocument({ url: new URL(url, doc.baseURI).href, isEvalSupported: false, disableAutoFetch: true, worker });
}

/** The sharpest drawn for a screen's pixels (a phone's 3) */
export const MAX_RATIO = 3;

/** The screen's pixels per CSS pixel, as drawn: one at least, MAX_RATIO at most */
export const screenRatio = (doc: Document): number => Math.min(Math.max(doc.defaultView?.devicePixelRatio ?? 1, 1), MAX_RATIO);

/** A page drawn into a canvas at a scale (its pixels the page's at that scale) */
export async function drawPage(doc: Document, page: PdfPage, scale: number, canvas = doc.createElement("canvas")): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport }).promise;
  return canvas;
}
