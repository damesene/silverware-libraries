// Two of Silverware Assets' own actions (docs/silverware-assets.md, *Actions*), registered as anyone's: the
// asset shown in a panel at the window's right (`open-panel`: the page beside it still used) or enlarged over the page
// (`open-enlarged`), each rendered as the core renders it (`render`: the type's own view, else the host's drawing, else its
// card). One of each at a time: another shown takes its place. Esc, ×, or (the enlarged view) a click beside it closes it.
// Over the window, so marked as shown over it (the other plugins stand back: shared/overwindow.ts); the side panel marked
// a side panel too (Silverware Layout may move the page's text to the left while one is open: shared/sidepanel.ts).
import { type ActionContext, type Asset, type AssetAction, assetName, type Capabilities } from "../../../shared/assets.ts";
import { el } from "../../../shared/elements.ts";
import { sheetRect } from "../../../shared/sheetarea.ts";
import { markSidePanel } from "../../../shared/sidepanel.ts";
import { markOverWindow } from "../../../shared/overwindow.ts";

// What a panel shows: an asset drawn larger than its card (a card alone is no more than the card in the page)
const shows = (_asset: Asset, can: Capabilities) => can.views.includes("full") || can.views.includes("preview");

/** The one shown now of a kind (side panel, enlarged), closed as another takes its place */
const open = new Map<string, () => void>();

/** A panel of a kind shown: its frame (marked over the window), closed by Esc or its ×; what closes it given back */
function show(kind: "side-panel" | "enlarged", context: ActionContext, build: (close: () => void) => { readonly root: HTMLElement; readonly body: HTMLElement; readonly stop?: () => void }): () => void {
  open.get(kind)?.();
  const doc = document;
  let closed = false;
  // What its file's drawing started, ended as it closes (a document still read, its size watched)
  const drawing = new AbortController();
  const close = () => {
    if (closed) return;
    closed = true;
    drawing.abort();
    stop?.();
    root.remove();
    doc.removeEventListener("keydown", key, true);
    if (open.get(kind) === close) open.delete(kind);
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  const { root, body, stop } = build(close);
  markOverWindow(root, true);
  doc.body.append(root);
  doc.addEventListener("keydown", key, true);
  open.set(kind, close);
  void context.render("full", body, drawing.signal).catch(() => body.replaceChildren(el(doc, "div", { class: "swa-panel-failed", text: "This file cannot be shown here" })));
  return close;
}

/** The head of a panel: the asset's name, Open in a new tab (where it has a URL), × (first in the side panel, as a
 * database's peek has it: at the edge it opened from) */
function head(context: ActionContext, close: () => void, closeFirst = false): HTMLElement {
  const doc = document;
  const name = assetName(context.asset);
  const closeButton = el(doc, "button", { class: "swa-panel-close", title: "Close (Esc)", text: "×", attrs: { "aria-label": "Close" } });
  closeButton.addEventListener("click", () => close());
  const tab = "url" in context.asset ? el(doc, "button", { class: "swa-panel-button", text: "Open in a new tab" }) : null;
  const url = "url" in context.asset ? context.asset.url : undefined;
  tab?.addEventListener("click", () => url && context.open(url));
  const title = el(doc, "span", { class: "swa-panel-title", text: name, title: name });
  return el(doc, "div", { class: "swa-panel-head" }, ...(closeFirst ? [closeButton, title, tab] : [title, tab, closeButton]));
}

// The side panel's width: none set its style page's, the narrowest it may be dragged to, a step of the arrow keys; the
// width dragged kept on this device (as Silverware Database's peek keeps its own), where the browser keeps anything
const MIN_WIDTH = 320;
const KEY_STEP = 40;
const WIDTH_KEY = "silverware.assets.peekWidth";

function keptWidth(): number | undefined {
  try {
    const width = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(width) && width >= MIN_WIDTH ? width : undefined;
  } catch {
    return undefined;
  }
}

function keepWidth(width: number | undefined): void {
  try {
    if (width === undefined) localStorage.removeItem(WIDTH_KEY);
    else localStorage.setItem(WIDTH_KEY, String(width));
  } catch {
    // (Not kept: the width holds for this panel alone)
  }
}

/**
 * The side panel's left edge: dragged, the panel as wide as the pointer leaves it, kept as it is let go; a double click
 * its default again; ← → from the keys
 */
function resizer(panel: HTMLElement): HTMLElement {
  const doc = panel.ownerDocument;
  const handle = el(doc, "div", { class: "swa-side-panel-resize", title: "Drag to set the panel's width (a double click: its default)", attrs: { role: "separator", "aria-orientation": "vertical", "aria-label": "The panel's width", tabindex: "0" } });
  const widest = () => doc.defaultView?.innerWidth ?? Infinity;
  // The width set (none: the style page's), within the window: a width past it is not kept
  let width: number | undefined;
  const set = (wanted: number | undefined) => {
    width = wanted === undefined ? undefined : Math.round(Math.min(Math.max(MIN_WIDTH, wanted), Math.max(MIN_WIDTH, widest())));
    if (width === undefined) panel.style.removeProperty("width");
    else panel.style.width = `${width}px`;
  };
  const keep = () => keepWidth(width);
  set(keptWidth());
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const start = { x: event.clientX, width: panel.getBoundingClientRect().width };
    handle.setPointerCapture?.(event.pointerId);
    const move = (moved: PointerEvent) => set(start.width + start.x - moved.clientX);
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      keep();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
  handle.addEventListener("dblclick", () => {
    set(undefined);
    keep();
  });
  handle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    set(panel.getBoundingClientRect().width + (event.key === "ArrowLeft" ? KEY_STEP : -KEY_STEP));
    keep();
  });
  return handle;
}

/** The side panel over the right of the host's area (the window where it gives none) */
function placeIn(panel: HTMLElement, context: ActionContext): void {
  const view = panel.ownerDocument.defaultView;
  if (!view) return;
  const area = sheetRect(context.sheetArea, view);
  panel.style.top = `${Math.max(0, area.top)}px`;
  panel.style.right = `${Math.max(0, view.innerWidth - area.right)}px`;
  panel.style.height = `${Math.max(0, Math.min(area.bottom, view.innerHeight) - Math.max(0, area.top))}px`;
  panel.style.bottom = "auto";
  panel.style.maxWidth = `${Math.max(0, Math.round(Math.min(area.width, view.innerWidth)))}px`;
}

export const sidePanel: AssetAction = {
  name: "open-panel",
  label: "Open in side panel",
  fits: shows,
  run: (context) =>
    void show("side-panel", context, (close) => {
      const body = el(document, "div", { class: "swa-panel-body" });
      const root = el(document, "aside", { class: "swa-side-panel", attrs: { role: "dialog", "aria-label": assetName(context.asset) } }, head(context, close, true), body);
      root.prepend(resizer(root));
      markSidePanel(root, true);
      // (Over the area the host gives, its editor's: under its top bar and a toolbar docked at the editor's edge)
      const place = () => placeIn(root, context);
      place();
      return { root, body, stop: context.sheetArea?.watch(place) };
    }),
};

export const enlarged: AssetAction = {
  name: "open-enlarged",
  label: "Open enlarged",
  fits: shows,
  run: (context) =>
    void show("enlarged", context, (close) => {
      const body = el(document, "div", { class: "swa-panel-body" });
      const box = el(document, "div", { class: "swa-enlarged-box", attrs: { role: "dialog", "aria-modal": "true", "aria-label": assetName(context.asset) } }, head(context, close), body);
      const root = el(document, "div", { class: "swa-enlarged" }, box);
      // A click beside the box (on the dimmed page) closes it
      root.addEventListener("click", (event) => {
        if (event.target === root) close();
      });
      return { root, body };
    }),
};
