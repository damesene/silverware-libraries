// Where a floating element goes by the selection: above it, centred on it;
// below it where there is no room above (under the top of the page's view:
// SilverBullet's top bar); always inside the window. Or by another element
// (the popup by the toolbar): below it, above it where there is no room below.

// Between the selection and the element, and the element and the window's edges
const GAP = 8;

export type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/** The element's place (its left and top, fixed) by `rect` (the selection's; `under`: another element's), the page's view's top being `top` */
export function placeBy(
  rect: Box,
  size: { width: number; height: number },
  view: { width: number; height: number; top: number },
  under = false,
): { left: number; top: number; below: boolean } {
  const center = (rect.left + rect.right) / 2;
  const left = Math.max(GAP, Math.min(center - size.width / 2, view.width - size.width - GAP));
  const above = rect.top - GAP - size.height;
  const below = under ? rect.bottom + GAP + size.height <= view.height - GAP || above < view.top + GAP : above < view.top + GAP;
  const top = below ? Math.min(rect.bottom + GAP, view.height - size.height - GAP) : above;
  return { left: Math.round(left), top: Math.round(Math.max(GAP, top)), below };
}
