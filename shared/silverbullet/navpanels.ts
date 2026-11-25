// SilverBullet's panels lying over the page (from 3.0: its navigator, `.sb-nav-root`, the space tree and the pickers, at
// the window's left or right; on a phone over almost the whole page, seen 2026-11-24). A plugin's controls float in the
// body over every layer of SilverBullet's, so where they are placed by a widget under such a panel they showed over it
// and took the presses meant for it: a table's toolbar and grips over the space tree. What is placed by the page's view
// takes that view less these panels (`besideNavPanels`). In 2.12.1 its panels stand beside the editor, over none of it.

/** SilverBullet's navigator panels, each at the window's left or right */
export const NAV_PANEL_SELECTOR = ".sb-nav-root";

// What a panel's edge may be off the view's and still be at it (px: a border, a rounding)
const EDGE = 2;

/**
 * `listener` told as SilverBullet's panels over the page may have come, gone or moved: one put in or taken out, one
 * resized, one's sliding in or out ended (it opens over the page without the page scrolling or resizing, which is all
 * else a plugin's controls follow); its end given back
 */
export function watchNavPanels(doc: Document, listener: () => void): () => void {
  const win = doc.defaultView;
  if (!win) return () => {};
  const resized = win.ResizeObserver ? new win.ResizeObserver(() => listener()) : undefined;
  const watched = new Set<Element>();
  const watchAll = () => {
    for (const panel of doc.querySelectorAll(NAV_PANEL_SELECTOR)) {
      if (watched.has(panel)) continue;
      watched.add(panel);
      resized?.observe(panel);
    }
    for (const panel of watched) {
      if (panel.isConnected) continue;
      watched.delete(panel);
      resized?.unobserve(panel);
    }
  };
  // (A node put in or taken out is a panel, or holds one as its child, as SilverBullet's main element drawn anew holds
  // it: not looked into deeper, so a large table's rows the editor draws cost no search each)
  const isPanel = (node: Node) => node instanceof win.Element && (node.matches(NAV_PANEL_SELECTOR) || !!node.querySelector(`:scope > ${NAV_PANEL_SELECTOR}`));
  const added = new win.MutationObserver((records) => {
    if (!records.some((record) => [...record.addedNodes, ...record.removedNodes].some(isPanel))) return;
    watchAll();
    listener();
  });
  added.observe(doc.body, { childList: true, subtree: true });
  // (Its sliding ended: where it stands now, a transform's move tells no observer)
  const slid = (event: Event) => event.target instanceof win.Element && event.target.closest(NAV_PANEL_SELECTOR) && listener();
  doc.addEventListener("transitionend", slid, true);
  doc.addEventListener("animationend", slid, true);
  watchAll();
  return () => {
    added.disconnect();
    resized?.disconnect();
    doc.removeEventListener("transitionend", slid, true);
    doc.removeEventListener("animationend", slid, true);
  };
}

/** The page's editor, what a panel lies over or stands beside */
const EDITOR_SELECTOR = "#sb-main .cm-editor";

/**
 * Whether one of SilverBullet's panels lies over part of the page's editor now (the space tree over a phone's page), not
 * beside it (docked beside the editor in a wider window): what belongs to the page and not to a place in it (a toolbar
 * docked at the window's edge) stands back then
 */
export function navPanelOverPage(doc: Document): boolean {
  // (None in the page, SilverBullet 2.12.1's always: nothing measured)
  if (!doc.querySelector(NAV_PANEL_SELECTOR)) return false;
  const box = doc.querySelector(EDITOR_SELECTOR)?.getBoundingClientRect();
  if (!box || box.width <= 0 || box.height <= 0) return false;
  const view = { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  const beside = besideNavPanels(view, doc);
  return beside.left > view.left || beside.right < view.right;
}

/** A rectangle of the screen, as the plugins' geometry has it */
export type ScreenRect = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };

/**
 * `view` (the page's part in view) less SilverBullet's panels lying over it: one over its left part takes the view's
 * left edge to the panel's right, one over its right part the right edge to the panel's left; one over all of it leaves
 * none (as wide as nothing, at its left)
 */
export function besideNavPanels(view: ScreenRect, doc: Document): ScreenRect {
  const win = doc.defaultView;
  let { left, right } = view;
  for (const panel of doc.querySelectorAll<HTMLElement>(NAV_PANEL_SELECTOR)) {
    const box = panel.getBoundingClientRect();
    // (Not shown, or beside the view: over none of it; one there unseen, sliding in from nothing, not yet)
    if (box.width <= 0 || box.height <= 0) continue;
    const style = win?.getComputedStyle(panel);
    if (style?.visibility === "hidden" || style?.opacity === "0") continue;
    if (box.right <= left || box.left >= right || box.bottom <= view.top || box.top >= view.bottom) continue;
    // At the view's left edge the view starts after it, at its right edge it ends before it; one at neither (placed in
    // the middle) or at both leaves none of it: what is beside it there is no view to place by
    const atLeft = box.left <= view.left + EDGE;
    const atRight = box.right >= view.right - EDGE;
    if (atLeft && !atRight) left = Math.max(left, box.right);
    else if (atRight && !atLeft) right = Math.min(right, box.left);
    else right = left;
  }
  return { left, right: Math.max(left, right), top: view.top, bottom: view.bottom };
}
