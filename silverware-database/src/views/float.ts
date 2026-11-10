// An editor's panel laid over the page where the style page lays it out of the
// flow (`position: absolute`: a cell's choices over the cells under it, the
// names offered under a field): fixed to the window at its anchor instead, so
// no box around it clips it (a block's, a table's that scrolls sideways, the
// peek's properties), followed as the page scrolls or the window resizes, and
// opened upward where the room under it is short. Where the style page keeps
// it in the flow (the peek's choices) nothing changes. Its own: the panel's
// inline position, nothing of the views'.
const MARGIN = 8;

/**
 * `panel` (in the document) kept by `anchor`: `over` its top left corner (a
 * cell's choices, over the value they edit), or `under` it (a list under a
 * field); followed until the panel leaves the document
 */
export function floatPanel(panel: HTMLElement, anchor: HTMLElement, at: "over" | "under"): void {
  const doc = panel.ownerDocument;
  const view = doc.defaultView;
  if (!view || view.getComputedStyle(panel).position !== "absolute") return;
  panel.style.position = "fixed";
  panel.classList.add("swd-floated");
  let frame: number | undefined;
  const place = () => {
    frame = undefined;
    if (!panel.isConnected || !anchor.isConnected) return stop();
    // (Hidden: nothing to place; placed as it shows, its size then known)
    if (panel.hidden) return;
    const box = anchor.getBoundingClientRect();
    const [width, height] = [view.innerWidth, view.innerHeight];
    const top = at === "over" ? box.top : box.bottom + 2;
    const below = height - top - MARGIN;
    const above = (at === "over" ? box.bottom : box.top - 2) - MARGIN;
    panel.style.maxHeight = "";
    const tall = panel.offsetHeight;
    // Where it fits under (or over) its anchor, there; else where there is more room, cut to it (it scrolls)
    if (tall <= below || below >= above) {
      panel.style.top = `${top}px`;
      panel.style.bottom = "";
      if (tall > below) panel.style.maxHeight = `${Math.max(below, 0)}px`;
    } else {
      panel.style.top = "";
      panel.style.bottom = `${height - (at === "over" ? box.bottom : box.top - 2)}px`;
      if (tall > above) panel.style.maxHeight = `${Math.max(above, 0)}px`;
    }
    panel.style.left = `${Math.max(MARGIN, Math.min(box.left, width - panel.offsetWidth - MARGIN))}px`;
  };
  const later = () => {
    frame ??= view.requestAnimationFrame(place);
  };
  const resized = typeof view.ResizeObserver === "function" ? new view.ResizeObserver(later) : undefined;
  const stop = () => {
    view.removeEventListener("scroll", later, true);
    view.removeEventListener("resize", later);
    resized?.disconnect();
    if (frame !== undefined) view.cancelAnimationFrame(frame);
  };
  view.addEventListener("scroll", later, { capture: true, passive: true });
  view.addEventListener("resize", later);
  // (Its size changed, shown or hidden, what it lists filtered: placed again)
  resized?.observe(panel);
  place();
}
