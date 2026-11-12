// A widget's width (docs/silverware-layout.md, *What it does*): what its entries hold (`width`: pixels, or `full`, the
// editor's pane), what a drag of its right edge makes of it (centred on the text, so the width changes by twice the
// distance), snapped to the text's width and the presets, and named. Pure.
import type { Preset } from "../model/settings.ts";

/** A widget's width as kept: pixels, or the editor's whole pane */
export type WidgetWidth = number | "full";

/** The narrowest a widget is made by a drag (px) */
export const MIN_WIDGET_WIDTH = 200;
/** How near a snap target a drag has to come to take it (px) */
export const SNAP_DISTANCE = 8;
/** What the pane keeps beside a widget as wide as it goes (px, both sides together) */
export const PANE_GUTTER = 40;

/** A widget's width from its entries' `width` (`1200`, `1200px`, `full`); undefined for none or anything else */
export function readWidgetWidth(value: string | undefined): WidgetWidth | undefined {
  if (value === undefined) return undefined;
  const text = value.trim();
  if (text === "full") return "full";
  const match = /^(\d+(?:\.\d+)?)\s*(px)?$/.exec(text);
  if (!match) return undefined;
  const amount = Math.round(Number(match[1]));
  return amount > 0 ? amount : undefined;
}

/** The width as its entries keep it (`1200`, `full`) */
export const keptWidgetWidth = (width: WidgetWidth): string => (width === "full" ? "full" : String(Math.round(width)));

/** The width as the widget's CSS variable holds it: pixels, or the pane's whole width (its container's) */
export const cssWidgetWidth = (width: WidgetWidth): string => (width === "full" ? "100cqw" : `${Math.round(width)}px`);

/** What a width comes to in a pane: the pane less its gutter at most */
export const shownWidgetWidth = (width: WidgetWidth, pane: number): number => Math.min(width === "full" ? pane : width, pane - PANE_GUTTER);

/** Where a drag may take a width to: not narrower than the least, nor wider than the pane less its gutter */
export const draggedWidth = (start: number, moved: number, pane: number): number => Math.max(MIN_WIDGET_WIDTH, Math.min(pane - PANE_GUTTER, start + 2 * moved));

/** What a width may snap to: the text's (the widget then keeps no width), a preset (its own width) */
export type SnapTarget = { readonly width: number; readonly kept: WidgetWidth | undefined; readonly name: string };

/** The snap targets in a pane: the text's width first, then each preset (full: the pane less its gutter) */
export function snapTargets(textWidth: number, presets: readonly Preset[], pane: number): SnapTarget[] {
  const targets: SnapTarget[] = [{ width: textWidth, kept: undefined, name: "Text width" }];
  for (const preset of presets) {
    if (preset.width === "full") targets.push({ width: pane - PANE_GUTTER, kept: "full", name: preset.name });
    else if (preset.width.unit === "px") targets.push({ width: Math.min(preset.width.amount, pane - PANE_GUTTER), kept: preset.width.amount, name: preset.name });
  }
  return targets;
}

/** A width dragged to: the target it came within SNAP_DISTANCE of (the nearest), else its own pixels */
export function snapped(width: number, targets: readonly SnapTarget[]): { readonly width: number; readonly kept: WidgetWidth | undefined; readonly name?: string } {
  let best: SnapTarget | undefined;
  for (const target of targets) if (Math.abs(target.width - width) <= SNAP_DISTANCE && (!best || Math.abs(target.width - width) < Math.abs(best.width - width))) best = target;
  return best ? { width: best.width, kept: best.kept, name: best.name } : { width: Math.round(width), kept: Math.round(width) };
}

/** The text's width (none kept) and each preset of pixels or full, named: what a width kept is called */
export function namedWidths(presets: readonly Preset[]): { readonly kept: WidgetWidth | undefined; readonly name: string }[] {
  const named: { readonly kept: WidgetWidth | undefined; readonly name: string }[] = [{ kept: undefined, name: "Text width" }];
  for (const preset of presets) {
    if (preset.width === "full") named.push({ kept: "full", name: preset.name });
    else if (preset.width.unit === "px") named.push({ kept: preset.width.amount, name: preset.name });
  }
  return named;
}
