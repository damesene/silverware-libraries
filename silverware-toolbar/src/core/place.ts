// Where a floating element goes by the selection: above it, centred on it or
// (`before`: the toolbar on a computer, out of the way of what is read)
// ending where it starts; below it where there is no room above (under the top of the page's view:
// SilverBullet's top bar); always inside the window. Or by another element
// (the popup by the toolbar): below it, above it where there is no room below.

// Between the selection and the element, and the element and the window's edges
const GAP = 8;

export type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/**
 * A floating element placed by the toolbar (the popup of every action, a
 * panel): under it (no toolbar on screen: under the top of the view, in the
 * middle), or `above` it (docked at the bottom), held by its bottom edge so
 * what shows fewer gets shorter from the top
 */
export function placeByToolbar(element: HTMLElement, rect: Box | undefined, viewTop: number, above: boolean): void {
  const win = element.ownerDocument.defaultView!;
  if (above && rect) {
    const left = Math.max(GAP, Math.min(rect.left + GAP, win.innerWidth - element.offsetWidth - GAP));
    element.style.left = `${Math.round(left)}px`;
    element.style.top = "auto";
    element.style.bottom = `${Math.round(win.innerHeight - (rect.top - GAP))}px`;
    return;
  }
  element.style.removeProperty("bottom");
  const size = { width: element.offsetWidth, height: element.offsetHeight };
  const at = rect ?? { left: win.innerWidth / 2, right: win.innerWidth / 2, top: viewTop, bottom: viewTop + 40 };
  const { left, top } = placeBy(at, size, { width: win.innerWidth, height: win.innerHeight, top: viewTop }, !!rect);
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

/** The room over the toolbar docked at the bottom, its gaps left out (what floats there is at most as tall) */
export function roomAbove(rect: Box, viewTop: number): number {
  return rect.top - viewTop - 2 * GAP;
}

/** The element's place (its left and top, fixed) by `rect` (the selection's; `under`: another element's), the page's view's top being `top` */
export function placeBy(
  rect: Box,
  size: { width: number; height: number },
  view: { width: number; height: number; top: number },
  under = false,
  before = false,
): { left: number; top: number; below: boolean } {
  const wanted = before ? rect.left - GAP - size.width : (rect.left + rect.right) / 2 - size.width / 2;
  const left = Math.max(GAP, Math.min(wanted, view.width - size.width - GAP));
  const above = rect.top - GAP - size.height;
  const below = under ? rect.bottom + GAP + size.height <= view.height - GAP || above < view.top + GAP : above < view.top + GAP;
  const top = below ? Math.min(rect.bottom + GAP, view.height - size.height - GAP) : above;
  return { left: Math.round(left), top: Math.round(Math.max(GAP, top)), below };
}
