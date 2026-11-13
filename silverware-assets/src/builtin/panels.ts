// Two of Silverware Assets' own actions (docs/silverware-assets.md, *Actions*), registered as anyone's: the
// asset shown in a panel at the window's right (`peek`: the page beside it still used) or enlarged over the page
// (`popover`), each rendered as the core renders it (`render`: the type's own view, else the host's drawing, else its
// card). One of each at a time: another shown takes its place. Esc, ×, or (the popover) a click beside it closes it.
// Over the window, so marked `data-silverware-over-window` (the other plugins stand back: shared/overwindow.ts, its
// attribute named here as the contract leaves this part to know no more than the contract and the elements).
import { type ActionContext, type Asset, type AssetAction, assetName, type Capabilities } from "../../../shared/assets.ts";
import { el } from "../../../shared/elements.ts";

const OVER_WINDOW = "data-silverware-over-window";

// What a panel shows: an asset drawn larger than its card (a card alone is no more than the card in the page)
const shows = (_asset: Asset, can: Capabilities) => can.views.includes("embed") || can.views.includes("preview");

/** The one shown now of a kind (peek, popover), closed as another takes its place */
const open = new Map<string, () => void>();

/** A panel of a kind shown: its frame (marked over the window), closed by Esc or its ×; what closes it given back */
function show(kind: "peek" | "popover", context: ActionContext, build: (close: () => void) => { readonly root: HTMLElement; readonly body: HTMLElement }): () => void {
  open.get(kind)?.();
  const doc = document;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
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
  const { root, body } = build(close);
  root.setAttribute(OVER_WINDOW, "");
  doc.body.append(root);
  doc.addEventListener("keydown", key, true);
  open.set(kind, close);
  void context.render("embed", body).catch(() => body.replaceChildren(el(doc, "div", { class: "swa-panel-failed", text: "This file cannot be shown here" })));
  return close;
}

/** The head of a panel: the asset's name, Open in a new tab (where it has a URL), × */
function head(context: ActionContext, close: () => void): HTMLElement {
  const doc = document;
  const name = assetName(context.asset);
  const closeButton = el(doc, "button", { class: "swa-panel-close", title: "Close (Esc)", text: "×", attrs: { "aria-label": "Close" } });
  closeButton.addEventListener("click", () => close());
  const tab = "url" in context.asset ? el(doc, "button", { class: "swa-panel-button", text: "Open in a new tab" }) : null;
  const url = "url" in context.asset ? context.asset.url : undefined;
  tab?.addEventListener("click", () => url && context.open(url));
  return el(doc, "div", { class: "swa-panel-head" }, el(doc, "span", { class: "swa-panel-title", text: name, title: name }), tab, closeButton);
}

export const peek: AssetAction = {
  name: "peek",
  label: "Show in a side panel",
  fits: shows,
  run: (context) =>
    void show("peek", context, (close) => {
      const body = el(document, "div", { class: "swa-panel-body" });
      const root = el(document, "aside", { class: "swa-peek", attrs: { role: "dialog", "aria-label": assetName(context.asset) } }, head(context, close), body);
      return { root, body };
    }),
};

export const popover: AssetAction = {
  name: "popover",
  label: "Show enlarged",
  fits: shows,
  run: (context) =>
    void show("popover", context, (close) => {
      const body = el(document, "div", { class: "swa-panel-body" });
      const box = el(document, "div", { class: "swa-popover-box", attrs: { role: "dialog", "aria-modal": "true", "aria-label": assetName(context.asset) } }, head(context, close), body);
      const root = el(document, "div", { class: "swa-popover" }, box);
      // A click beside the box (on the dimmed page) closes it
      root.addEventListener("click", (event) => {
        if (event.target === root) close();
      });
      return { root, body };
    }),
};
