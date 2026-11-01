// SilverBullet's look as charts are drawn in it: its text color and font
// (its CSS variables, so its themes and dark mode count), read as a chart is
// made; a change of them (the theme switched) told, so charts are drawn anew.
import type { Theme } from "./type.ts";

// Tableau 10: told apart in light and dark alike
export const PALETTE = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"];

/** The look of the page as it is now */
export function themeOf(doc: Document): Theme {
  const style = doc.defaultView?.getComputedStyle(doc.documentElement);
  const v = (name: string) => style?.getPropertyValue(name).trim() ?? "";
  return {
    text: v("--root-color") || v("--editor-text-color") || "#333",
    // A grid that stays quiet on any background
    grid: "rgba(128, 128, 128, 0.25)",
    font: v("--ui-font") || v("--editor-font") || "sans-serif",
    palette: PALETTE,
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
