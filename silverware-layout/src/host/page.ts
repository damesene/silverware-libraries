// What Silverware Layout asks of the page it lays out, whatever shows it: where its text and widgets are, the pane it
// is in, where it is seen, and how its text's width is shown (each host's own: SilverBullet's in
// host/silverbullet/dom.ts). Everything else Silverware Layout does to the page it does through its own marks
// (host/marks.ts), which its style page reads, so no rule of its names any host's element.
import type { Width } from "../model/width.ts";

/** Where the page is seen in the window: top and bottom; left and right where a panel of the host's narrows it */
export type PageView = { readonly top: number; readonly bottom: number; readonly left?: number; readonly right?: number };

export type PageHost = {
  /** The element the page's text and its widgets are in; none while the host has none (its editor not made yet) */
  content(): HTMLElement | undefined;
  /** The element whose font the page's text takes (the font zoom sizes it); none while there is none */
  editor(): HTMLElement | undefined;
  /** The pane the page is in: a widget is never wider than it (less a gutter) */
  pane(): HTMLElement;
  /**
   * The part of the window the page is seen in (below the host's own bars), top and bottom; its left and right edges
   * where a panel of the host's lies over part of the page (none: the pane's)
   */
  view(): PageView;
  /** `listener` told as what lies over the page may have changed the view without a scroll or a resize; its end given back */
  watchView?(listener: () => void): () => void;
  /** Where a drag's guides go: the box the page scrolls in, so they lie under its widgets (none: over the page) */
  guideLayer(): HTMLElement | undefined;
  /** The page's text shown at a width (none: the host's own) */
  showTextWidth(width: Width | undefined): void;
  /** The text's width the host gives (px), Silverware Layout's own set aside */
  themeTextWidth(): number;
  /**
   * Optional: the host's own elements placed by the text as it centres it (a title over the page, notifications), each
   * handed to `found` as it is there (now, and as one comes later), so they move with the text where it stands at the
   * left (docs/silverware-layout-text-align.md); the function given back stops it. None: only the text moves
   */
  watchAlongText?(found: (element: HTMLElement) => void): () => void;
};
