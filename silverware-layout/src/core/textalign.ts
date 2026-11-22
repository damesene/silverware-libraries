// Where the page's text stands (docs/silverware-layout-text-align.md): the page's own alignment, else the default
// setting's, else centred; `left-with-panel` at the left only while a side panel is open; none of Silverware Layout's
// in a pane narrower than the setting's least (a phone: the text is the pane's width anyway). Pure.
import type { TextAlign } from "../model/settings.ts";

export type TextAlignAsked = {
  // The page's own (its frontmatter's `_layout.align`)
  readonly page: TextAlign | undefined;
  // The default setting's
  readonly fallback: TextAlign | undefined;
  // Whether a side panel is open over the page's right
  readonly panelOpen: boolean;
  // The editor's pane now, and the least it is laid out at (px)
  readonly paneWidth: number;
  readonly minPaneWidth: number;
};

/**
 * Where the text stands now: at the left or centred; undefined where Silverware Layout places it nowhere (centred
 * throughout, the host's own way, or a pane too narrow). Centred is said only where the alignment may turn to the left
 * (left while a panel is open), so the text moves from where it is, its margin a length either way
 */
export function textAlignShown({ page, fallback, panelOpen, paneWidth, minPaneWidth }: TextAlignAsked): "left" | "center" | undefined {
  if (paneWidth < minPaneWidth) return undefined;
  const align = page ?? fallback ?? "center";
  if (align === "left") return "left";
  if (align === "left-with-panel") return panelOpen ? "left" : "center";
  return undefined;
}
