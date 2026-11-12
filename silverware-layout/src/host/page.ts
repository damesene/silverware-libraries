// What Silverware Layout asks of the page it lays out, whatever shows it: where its text and widgets are, the pane it
// is in, where it is seen, and how its text's width is shown (each host's own: SilverBullet's in
// host/silverbullet/dom.ts). Everything else Silverware Layout does to the page it does through its own marks
// (host/marks.ts), which its style page reads, so no rule of its names any host's element.
import type { Width } from "../model/width.ts";

export type PageHost = {
  /** The element the page's text and its widgets are in; none while the host has none (its editor not made yet) */
  content(): HTMLElement | undefined;
  /** The element whose font the page's text takes (the font zoom sizes it); none while there is none */
  editor(): HTMLElement | undefined;
  /** The pane the page is in: a widget is never wider than it (less a gutter) */
  pane(): HTMLElement;
  /** The part of the window the page is seen in (below the host's own bars), top and bottom */
  view(): { readonly top: number; readonly bottom: number };
  /** Where a drag's guides go: the box the page scrolls in, so they lie under its widgets (none: over the page) */
  guideLayer(): HTMLElement | undefined;
  /** The page's text shown at a width (none: the host's own) */
  showTextWidth(width: Width | undefined): void;
  /** The text's width the host gives (px), Silverware Layout's own set aside */
  themeTextWidth(): number;
};
