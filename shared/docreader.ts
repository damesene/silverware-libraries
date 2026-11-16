// A document's reader as Silverware Assets DOCX and XLSX draw one (docs/silverware-viewers.md): its shell (a bar on top,
// a label at its left and the zoom at its right; the document scrolled under it), how high it is (the embed's height in
// the page, or filling a panel: shared/assets.ts, `RenderContext.fills`), as wide as its line (ASSET_WIDE_ATTRIBUTE),
// its presses and keys its own; and the turns its reads take. What is drawn in it is each library's. Its CSS is the
// template shared/docreader.css (__base__ the library's prefix), in each library's style page.
import { ASSET_WIDE_ATTRIBUTE } from "./assets.ts";
import { el } from "./elements.ts";
import { scaledPx } from "./contentscale.ts";

/** The library's base of classes (`swa-docx`) */
export type ReaderLook = { readonly base: string };

/** The zoom's steps (1: the reader's width, or the document's own fitted to it) */
export const ZOOMS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** The zoom a step from another goes to (out: the next smaller, in: the next larger), held to the steps */
export function nextZoom(zoom: number, step: -1 | 1): number {
  if (step > 0) return ZOOMS.find((one) => one > zoom + 1e-6) ?? ZOOMS.at(-1)!;
  return [...ZOOMS].reverse().find((one) => one < zoom - 1e-6) ?? ZOOMS[0]!;
}

export type ReaderShell = {
  /** The reader, marked as wide as its line, its height set (or filling its panel) */
  readonly root: HTMLElement;
  /** What scrolls: the document drawn in it */
  readonly scroller: HTMLElement;
  /** The bar's text at its left (the page in view, a sheet's name) */
  label(text: string): void;
  /** The bar's own controls besides the zoom (a sheet's tabs), put before it */
  readonly tools: HTMLElement;
  /** The zoom now (1 at first) */
  readonly zoom: number;
  /** Told as the zoom changes by its buttons */
  onZoom(listener: (zoom: number) => void): void;
  /** Its state, as `data-<base>-state` (opening, shown, viewer) */
  state(state: string): void;
};

/**
 * A reader's shell; `height` its height in the page, none where it fills a panel; `zoom` false: no zoom in its bar;
 * `keyKept` told each key it keeps from the page (shared/silverbullet/keptkeys.ts: a shortcut that does nothing here said so)
 */
export function readerShell(
  doc: Document,
  look: ReaderLook,
  options: { readonly name: string; readonly height: number | undefined; readonly zoom?: boolean; readonly keyKept?: (event: KeyboardEvent) => void },
): ReaderShell {
  const p = `${look.base}-reader`;
  const label = el(doc, "span", { class: `${p}-label`, text: "…" });
  const tools = el(doc, "span", { class: `${p}-tools` });
  const zoomOut = el(doc, "button", { class: `${p}-button`, text: "−", attrs: { type: "button", title: "Zoom out", "aria-label": "Zoom out" } });
  const zoomFit = el(doc, "button", { class: `${p}-button ${p}-fit`, text: "100%", attrs: { type: "button", title: "Fit the width", "aria-label": "Fit the width" } });
  const zoomIn = el(doc, "button", { class: `${p}-button`, text: "+", attrs: { type: "button", title: "Zoom in", "aria-label": "Zoom in" } });
  const zoomBox = options.zoom === false ? null : el(doc, "span", { class: `${p}-zoom` }, zoomOut, zoomFit, zoomIn);
  const bar = el(doc, "div", { class: `${p}-bar` }, label, tools, zoomBox);
  const scroller = el(doc, "div", { class: `${p}-scroll` });
  const root = el(doc, "div", { class: p, attrs: { [ASSET_WIDE_ATTRIBUTE]: "", [`data-${look.base}-state`]: "opening", role: "document", "aria-label": options.name } }, bar, scroller);
  // (Its height as the content's scale makes it: shared/contentscale.ts)
  if (options.height !== undefined) root.style.height = scaledPx(Math.round(options.height));
  else root.classList.add(`${p}-fills`);
  // (Presses and keys in the reader its own: the editor around it moves no cursor, shows no markdown)
  for (const type of ["mousedown", "pointerdown"]) root.addEventListener(type, (event) => event.stopPropagation());
  root.addEventListener("keydown", (event) => {
    event.stopPropagation();
    options.keyKept?.(event);
  });
  let zoom = 1;
  const listeners: ((zoom: number) => void)[] = [];
  const zoomTo = (to: number) => {
    zoom = to;
    zoomFit.textContent = `${Math.round(zoom * 100)}%`;
    for (const listener of listeners) listener(zoom);
  };
  zoomOut.addEventListener("click", () => zoomTo(nextZoom(zoom, -1)));
  zoomIn.addEventListener("click", () => zoomTo(nextZoom(zoom, 1)));
  zoomFit.addEventListener("click", () => zoomTo(1));
  return {
    root,
    scroller,
    tools,
    get zoom() {
      return zoom;
    },
    label: (text) => void (label.textContent = text),
    onZoom: (listener) => void listeners.push(listener),
    state: (state) => root.setAttribute(`data-${look.base}-state`, state),
  };
}
