// A Word document's reader (docs/silverware-viewers.md): the whole document as docx-preview draws it, its pages one under
// another, in the shared reader's shell (shared/docreader.ts: the embed's height in the page, or filling a side panel
// or the enlarged view; its bar: the page in view of how many, the zoom). The pages fitted to the reader's width times
// the zoom (CSS zoom on docx-preview's wrapper), again as the reader's width changes. Where it cannot be read: said.
import type { KeptKeys } from "../../shared/silverbullet/keptkeys.ts";
import { readerShell } from "../../shared/docreader.ts";
import { el } from "../../shared/elements.ts";
import { drawn, showDocument } from "./documents.ts";
import { DOCX_CLASS, pageSize } from "./load.ts";

// The room round the pages (px), and a change of width under which nothing is fitted again (a share)
const GAP = 12;
const REFIT_SHARE = 0.02;

/** The zoom docx-preview's pages are drawn at to fill a reader of a width (less its gaps), at a zoom of the reader's */
export const fittedZoom = (readerWidth: number, pageWidth: number, zoom: number): number => Math.max(0.05, ((readerWidth - 2 * GAP) / pageWidth) * zoom);

/** A document's reader; `height` its height in the page, none where it fills a panel */
export function docxReader(doc: Document, url: string, name: string, height: number | undefined, signal: AbortSignal, keyKept?: KeptKeys): HTMLElement {
  const shell = readerShell(doc, { base: "swa-docx" }, { name, height, ...(keyKept ? { keyKept } : {}) });
  const { root: reader, scroller } = shell;
  const content = el(doc, "div", { class: "swa-docx-reader-document" });
  scroller.append(content);
  const win = doc.defaultView;
  let pages: HTMLElement[] = [];
  let wrapper: HTMLElement | undefined;
  let pageWidth = 0;
  let fittedFor = 0;

  /** The pages fitted to the reader's width times the zoom */
  const fit = (force = false) => {
    const width = scroller.clientWidth;
    if (!wrapper || !pageWidth || !width) return;
    if (!force && fittedFor && Math.abs(width - fittedFor) / width < REFIT_SHARE) return;
    fittedFor = width;
    const share = scroller.scrollHeight ? scroller.scrollTop / scroller.scrollHeight : 0;
    wrapper.style.zoom = String(fittedZoom(width, pageWidth, shell.zoom));
    scroller.scrollTop = share * scroller.scrollHeight;
  };
  shell.onZoom(() => fit(true));

  /** The page in view: the one crossing the view's upper third, said in the bar */
  const showPageNumber = () => {
    if (!pages.length) return;
    const line = scroller.getBoundingClientRect().top + scroller.clientHeight / 3;
    const current = pages.findIndex((page) => page.getBoundingClientRect().bottom >= line);
    shell.label(`${current < 0 ? pages.length : current + 1} / ${pages.length}`);
  };
  scroller.addEventListener("scroll", showPageNumber, { passive: true });
  const resized = win?.ResizeObserver ? new win.ResizeObserver(() => fit()) : undefined;
  signal.addEventListener("abort", () => resized?.disconnect());

  drawn(doc, url)
    .then(({ styles, body }) => {
      if (signal.aborted) return;
      const root = showDocument(content, styles, [...body.children].map((node) => node.cloneNode(true)), "reading");
      wrapper = root.querySelector<HTMLElement>(`.${DOCX_CLASS}-wrapper`) ?? undefined;
      pages = [...root.querySelectorAll<HTMLElement>(`section.${DOCX_CLASS}`)];
      pageWidth = Math.max(0, ...pages.map((page) => pageSize(page)?.width ?? 0));
      shell.state("pages");
      fit(true);
      showPageNumber();
      resized?.observe(scroller);
    })
    .catch((error: unknown) => {
      if (signal.aborted) return;
      content.replaceWith(el(doc, "p", { class: "swa-docx-reader-failed", text: `This document cannot be shown here: ${error instanceof Error ? error.message : String(error)}` }));
      shell.state("failed");
    });
  return reader;
}
