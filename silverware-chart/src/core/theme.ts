// SilverBullet's look as charts are drawn in it: its text color and font
// (its CSS variables, so its themes and dark mode count), and the size of its
// text where a chart is (its box's font), read as a chart is made; a change of
// them (the theme switched, the text's size) told, so charts are drawn anew.
import type { Theme } from "./type.ts";

// Tableau 10: told apart in light and dark alike
export const PALETTE = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"];

// A chart's text against the page's: Chart.js's 12 px by SilverBullet's 18 px text, its default look kept
const FONT_RATIO = 12 / 18;
// A chart's text size where its box's is not known (not in the document yet): Chart.js's own
const FONT_SIZE = 12;

/** The look of the page as it is now; its text's size where `at` is (a chart's box), in proportion */
export function themeOf(doc: Document, at?: Element): Theme {
  const view = doc.defaultView;
  const style = view?.getComputedStyle(doc.documentElement);
  const v = (name: string) => style?.getPropertyValue(name).trim() ?? "";
  const text = at?.isConnected ? parseFloat(view?.getComputedStyle(at).fontSize ?? "") : NaN;
  return {
    text: v("--root-color") || v("--editor-text-color") || "#333",
    // A grid that stays quiet on any background
    grid: "rgba(128, 128, 128, 0.25)",
    font: v("--ui-font") || v("--editor-font") || "sans-serif",
    fontSize: Number.isFinite(text) && text > 0 ? Math.round(text * FONT_RATIO * 10) / 10 : FONT_SIZE,
    palette: PALETTE,
  };
}

/**
 * `changed` called when the size of a box's text is known (as it is put in the page) and as it changes (the page's
 * font set larger or smaller): a mark one em wide in the box, watched for its width. The function given back stops it
 */
export function watchFontSize(box: HTMLElement, changed: () => void): () => void {
  const view = box.ownerDocument.defaultView;
  if (!view?.ResizeObserver) return () => {};
  const mark = box.ownerDocument.createElement("span");
  mark.className = "swc-em";
  mark.setAttribute("aria-hidden", "true");
  box.append(mark);
  let width = -1;
  const observer = new view.ResizeObserver(() => {
    const now = mark.getBoundingClientRect().width;
    if (now <= 0 || Math.abs(now - width) < 0.01) return;
    width = now;
    changed();
  });
  observer.observe(mark);
  return () => {
    observer.disconnect();
    mark.remove();
  };
}

/** `changed` called (once a frame) when the theme is switched: the root's data-theme, SilverBullet's light or dark */
export function watchTheme(doc: Document, changed: () => void): () => void {
  const view = doc.defaultView;
  if (!view?.MutationObserver) return () => {};
  let queued = false;
  const observer = new view.MutationObserver(() => {
    if (queued) return;
    queued = true;
    view.requestAnimationFrame(() => {
      queued = false;
      changed();
    });
  });
  // (Not its style: other plugins keep variables of theirs there, the toolbar's room as it docks)
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
