// How much the content of a page is zoomed beyond its default: this device's font zoom, where its user asked the files
// to follow it (Silverware Layout's setting `fontZoom.scaleFiles`, docs/silverware-layout-font-size.md *Files zoomed*).
// A CSS variable on the document's root, set by Silverware Layout alone (none: 1); what draws content of a size of its
// own (Silverware Assets' previews and files shown full, a width laid out by Layout's handle) multiplies its sizes by it, so
// it grows and shrinks with the text, as the browser's zoom would make it. Controls (a "…", a handle, a menu) do not:
// they are no content.

/** The variable, on the root: a number, 1 the default */
export const CONTENT_SCALE = "--sw-content-scale";

/**
 * A size in px as CSS that follows the content's scale (`calc(160px * var(--sw-content-scale, 1))`): the browser sizes
 * it anew as the scale changes, at once, nothing drawn again
 */
export const scaledPx = (px: number): string => `calc(${px}px * var(${CONTENT_SCALE}, 1))`;

/** A number as CSS that follows the content's scale (a `zoom` drawing something smaller: `calc(0.3 * var(…, 1))`) */
export const scaledNumber = (value: number): string => `calc(${value} * var(${CONTENT_SCALE}, 1))`;

/** The content's scale as the root has it now (none, or not a number above 0: 1) */
export function contentScaleOf(doc: Document): number {
  const scale = parseFloat(doc.documentElement.style.getPropertyValue(CONTENT_SCALE));
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/** The content's scale set on the root (1: taken off) */
export function showContentScale(doc: Document, scale: number): void {
  const style = doc.documentElement.style;
  if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 0.001) return void (style.getPropertyValue(CONTENT_SCALE) && style.removeProperty(CONTENT_SCALE));
  const value = String(Math.round(scale * 10000) / 10000);
  if (style.getPropertyValue(CONTENT_SCALE) !== value) style.setProperty(CONTENT_SCALE, value);
}
