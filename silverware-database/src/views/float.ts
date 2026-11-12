// What a place lays over the page from its own elements (an editor's panel, the
// names offered under a field, a tool's menu) is taken out of the place into
// the document's body while it shows, as every plugin's floating controls are:
// in the page it was in CodeMirror's scroller, a stacking context under the
// other plugins' controls (a table's tab, Silverware Layout's width handle),
// and in the place's own (a cell being edited), under a table's held header.
// In the body it is in the shared layers (shared/layers.ts) like theirs. What
// the peek lays over its own (in the body already, at its own layer) stays in it.
//
// An editor's panel the style page lays out of the flow (`position: absolute`:
// a cell's choices over the cells under it, the names offered under a field)
// is fixed to the window at its anchor, followed as the page scrolls or the
// window resizes, and opened upward where the room under it is short. Where the
// style page keeps it in the flow (the peek's choices) nothing changes. Its
// own: the panel's inline position, nothing of the views'.
const MARGIN = 8;

// The mark left where a panel was taken from: the panel goes with it (its cell drawn anew)
const HOME_CLASS = "swd-float-home";
/** What a view finds where a panel was taken from it (a cell edited in a panel) */
export const FLOAT_HOME_SELECTOR = `.${HOME_CLASS}`;
// What is laid over the page from a place
const LIFTED_CLASS = "swd-lifted";
// What is taken out of: a place in the page (not the peek, in the body already)
const PLACE_SELECTOR = ".swd-place";

/** The inherited look a panel takes from where it was (the place's font in a cell; a menu has its own) */
const FONT = ["font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "color"] as const;
/** The place's look taken along (its values a space-style may set on it; SilverBullet's dark look for the browser's controls) */
const LOOK = ["--swd-line", "--swd-quiet", "--swd-hover", "--swd-surface", "--swd-accent", "color-scheme"] as const;

/**
 * `element` moved into the document's body, laid over the page as it showed
 * (it is placed by the caller, fixed to the window), with the look of `from`
 * (where it is taken from: the place's values, and with `font` the inherited
 * font and color), its keys kept from SilverBullet (which takes keys typed in
 * fields of ours outside its editor). `gone` is told once `holder` (what it
 * belongs to: its mark, its tool) has left the page, as a place drawn anew or
 * taken out of CodeMirror's view takes it: nothing else would take it out of
 * the body. Gives the way to undo it all (but where it is: the caller puts it).
 */
export function liftOut(element: HTMLElement, holder: Node, gone: () => void, from: Element, font = false): () => void {
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  const taken = [...LOOK, ...(font ? FONT : [])];
  if (view) {
    const style = view.getComputedStyle(from);
    for (const property of taken) element.style.setProperty(property, style.getPropertyValue(property));
  }
  element.classList.add(LIFTED_CLASS);
  doc.body.append(element);
  const keep = (event: Event) => event.stopPropagation();
  for (const type of ["keydown", "keyup", "keypress"]) element.addEventListener(type, keep);
  // Whether its holder is still in the page, on any change of the document while it shows (a place is drawn anew, or
  // taken out of CodeMirror's view, by SilverBullet, with no event of ours): one check a change, only while it shows
  const watched = view?.MutationObserver
    ? new view.MutationObserver(() => {
        if (!holder.isConnected) gone();
      })
    : undefined;
  watched?.observe(doc.body, { childList: true, subtree: true });
  return () => {
    watched?.disconnect();
    for (const type of ["keydown", "keyup", "keypress"]) element.removeEventListener(type, keep);
    element.classList.remove(LIFTED_CLASS);
    for (const property of taken) element.style.removeProperty(property);
  };
}

/**
 * `panel` (in the document) kept by `anchor`: `over` its top left corner (a
 * cell's choices, over the value they edit), or `under` it (a list under a
 * field). Out of a place in the page it is taken into the body (`liftOut`), a
 * mark left where it was: it goes with that mark's content drawn anew (the edit
 * ended), and back into it while CodeMirror takes the place out of its view
 * (taken into the body again as it comes back, the edit going on). Followed
 * until it goes, or is taken out of the document.
 */
export function floatPanel(panel: HTMLElement, anchor: HTMLElement, at: "over" | "under"): void {
  const doc = panel.ownerDocument;
  const view = doc.defaultView;
  if (!view || view.getComputedStyle(panel).position !== "absolute") return;
  const from = panel.parentElement;
  const home = from?.closest(PLACE_SELECTOR) ? doc.createElement("span") : undefined;
  if (home) {
    home.className = HOME_CLASS;
    home.hidden = true;
    panel.before(home);
  }
  panel.style.position = "fixed";
  panel.classList.add("swd-floated");
  let frame: number | undefined;
  // In the body: how to put it back
  let lifted: (() => void) | undefined;
  const place = () => {
    frame = undefined;
    if (home) {
      if (!home.isConnected) return away();
      if (!lifted) lift();
    } else if (!panel.isConnected || !anchor.isConnected) return finish();
    // (Taken out by its editor: gone)
    if (!panel.isConnected) return finish();
    // (Hidden: nothing to place; placed as it shows, its size then known)
    if (panel.hidden) return;
    const box = anchor.getBoundingClientRect();
    const [width, height] = [view.innerWidth, view.innerHeight];
    const top = at === "over" ? box.top : box.bottom + 2;
    const below = height - top - MARGIN;
    const above = (at === "over" ? box.bottom : box.top - 2) - MARGIN;
    panel.style.maxHeight = "";
    const tall = panel.offsetHeight;
    // Where it fits under (or over) its anchor, there; else where there is more room, cut to it (it scrolls). The other
    // side `auto`, not left to the style page's (a list's `top: 100%` is the window's height, fixed)
    if (tall <= below || below >= above) {
      panel.style.top = `${top}px`;
      panel.style.bottom = "auto";
      if (tall > below) panel.style.maxHeight = `${Math.max(below, 0)}px`;
    } else {
      panel.style.top = "auto";
      panel.style.bottom = `${height - (at === "over" ? box.bottom : box.top - 2)}px`;
      if (tall > above) panel.style.maxHeight = `${Math.max(above, 0)}px`;
    }
    panel.style.left = `${Math.max(MARGIN, Math.min(box.left, width - panel.offsetWidth - MARGIN))}px`;
  };
  const later = () => {
    frame ??= view.requestAnimationFrame(place);
  };
  const follow = (on: boolean) => {
    const method = on ? "addEventListener" : "removeEventListener";
    view[method]("scroll", later, { capture: true, passive: true } as AddEventListenerOptions);
    view[method]("resize", later);
  };
  // (Its size changed, shown or hidden, what it lists filtered, back in the page: placed again)
  const resized = typeof view.ResizeObserver === "function" ? new view.ResizeObserver(later) : undefined;
  const lift = () => {
    // Its look the cell's (or the field's) it was in, as it was drawn there
    lifted = liftOut(panel, home!, away, from!, true);
    follow(true);
  };
  // Its mark gone: with its content drawn anew (no parent), the panel too; with its place out of the page, back in it
  // until it is laid out there again (its size observed: in the body again)
  const away = () => {
    if (!home?.parentNode) return finish();
    lifted?.();
    lifted = undefined;
    follow(false);
    home.after(panel);
  };
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    follow(false);
    resized?.disconnect();
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    lifted?.();
    lifted = undefined;
    home?.remove();
    panel.remove();
  };
  if (home) lift();
  else follow(true);
  resized?.observe(panel);
  place();
}
