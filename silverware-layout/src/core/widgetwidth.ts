// A widget's width (docs/silverware-layout.md, *What it does*): what its entries hold (`width`: pixels, a percent of
// the editor's pane, or `full`, the pane), what a drag of its right edge makes of it (centred on the text, so the width changes by twice the
// distance), snapped to the text's width and the guides, and named. Pure.
import { type Guide, guideName, type Percent, percentOf } from "../model/settings.ts";
import { readWidth } from "../model/width.ts";
import type { LayoutAnchor } from "../../../shared/layout.ts";

/** A widget's width as kept: pixels, a percent of the editor's pane (snapped to a guide of one), or the whole pane */
export type WidgetWidth = number | Percent | "full";

/** The narrowest a widget is made by a drag (px) */
export const MIN_WIDGET_WIDTH = 200;
/** How near a snap target a drag has to come to take it (px) */
export const SNAP_DISTANCE = 8;
/** What the pane keeps beside a widget as wide as it goes (px, both sides together) */
export const PANE_GUTTER = 40;

/** A widget's width from its entries' `width` (`1200`, `1200px`, `80%`, `full`); undefined for none or anything else */
export function readWidgetWidth(value: string | undefined): WidgetWidth | undefined {
  if (value === undefined) return undefined;
  if (value.trim() === "full") return "full";
  // (Read as a text's width is: one grammar of widths)
  const width = readWidth(value);
  if (!width) return undefined;
  const amount = Math.round(width.amount);
  if (width.unit === "%") return amount > 0 && amount <= 100 ? `${amount}%` : undefined;
  return amount > 0 ? amount : undefined;
}

/** The width as its entries keep it (`1200`, `80%`, `full`) */
export const keptWidgetWidth = (width: WidgetWidth): string => (typeof width === "number" ? String(Math.round(width)) : width);

// The pane's width as Silverware Layout gives it to its style page (host/marks.ts)
const PANE = "var(--swl-pane-width, 100vw)";

/** The width as the widget's CSS variable holds it: pixels, a share of the pane's width, or the pane's whole width */
export function cssWidgetWidth(width: WidgetWidth): string {
  if (width === "full") return PANE;
  if (typeof width === "string") return `calc(${PANE} * ${percentOf(width)! / 100})`;
  return `${Math.round(width)}px`;
}

/** A width in a pane (px), before the pane's gutter is taken: pixels, a share of the pane, the pane */
export const widthInPane = (width: WidgetWidth, pane: number): number => (width === "full" ? pane : typeof width === "string" ? (pane * percentOf(width)!) / 100 : width);

/** What a width comes to in a pane: the pane less its gutter at most */
export const shownWidgetWidth = (width: WidgetWidth, pane: number): number => Math.min(widthInPane(width, pane), pane - PANE_GUTTER);

/**
 * Where a drag of the right edge by `moved` may take a width to: a centred widget grows on both sides (twice the
 * move), one at the text's start to the right alone; not narrower than the least, nor wider than the pane less its gutter
 */
export const draggedWidth = (start: number, moved: number, pane: number, anchor: LayoutAnchor = "center"): number =>
  Math.max(MIN_WIDGET_WIDTH, Math.min(pane - PANE_GUTTER, start + (anchor === "start" ? 1 : 2) * moved));

/** What a width may snap to: the text's (the widget then keeps no width), a guide (its own width) */
export type SnapTarget = { readonly width: number; readonly kept: WidgetWidth | undefined; readonly name: string };

/**
 * The snap targets in a pane: the text's width first, then each guide as shown there (full: the pane less its gutter).
 * Only those a drag can reach (a guide of pixels wider than the pane, one under the narrowest a drag makes: none), and
 * one of a width (to the pixel): the first, so the line shown, the name said and the width kept are one guide's
 */
export function snapTargets(textWidth: number, guides: readonly Guide[], pane: number): SnapTarget[] {
  const targets: SnapTarget[] = [{ width: textWidth, kept: undefined, name: "Page width" }];
  const widths = new Set([Math.round(textWidth)]);
  for (const guide of guides) {
    if (typeof guide === "number" && guide > pane - PANE_GUTTER) continue;
    const width = shownWidgetWidth(guide, pane);
    if (width < MIN_WIDGET_WIDTH || widths.has(Math.round(width))) continue;
    widths.add(Math.round(width));
    targets.push({ width, kept: guide, name: guideName(guide) });
  }
  return targets;
}

/** A width dragged to: the target it came within SNAP_DISTANCE of (the nearest), else its own pixels */
export function snapped(width: number, targets: readonly SnapTarget[]): { readonly width: number; readonly kept: WidgetWidth | undefined; readonly name?: string } {
  let best: SnapTarget | undefined;
  for (const target of targets) if (Math.abs(target.width - width) <= SNAP_DISTANCE && (!best || Math.abs(target.width - width) < Math.abs(best.width - width))) best = target;
  return best ? { width: best.width, kept: best.kept, name: best.name } : { width: Math.round(width), kept: Math.round(width) };
}

/** A width kept, as it is named where it shows: the text's, Full width, else its pixels or percent */
export const widthName = (kept: WidgetWidth | undefined): string => (kept === undefined ? "Page width" : guideName(kept));
