// Which width the page's text is shown at: the page's own, else the default setting's, else none (the theme's), and
// none in a pane narrower than the setting's least (a phone: the text is the pane's width anyway). Pure.
import type { Width } from "../model/width.ts";

export type TextWidthAsked = {
  // The page's own (its frontmatter's `_layout.width`)
  readonly page: Width | undefined;
  // The default setting's
  readonly fallback: Width | undefined;
  // The editor's pane now, and the least it is laid out at (px)
  readonly paneWidth: number;
  readonly minPaneWidth: number;
};

/** The width to show the text at; undefined: none of Silverware Layout's (the theme's) */
export function textWidthShown({ page, fallback, paneWidth, minPaneWidth }: TextWidthAsked): Width | undefined {
  if (paneWidth < minPaneWidth) return undefined;
  return page ?? fallback;
}
