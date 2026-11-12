// SilverBullet's page as Silverware Layout lays it out (host/page.ts): the one place naming its elements and its theme's
// variable (docs/silverware-layout.md, probes 1 and 2; docs/silverware-layout-font-size.md):
// - the text and its widgets are in CodeMirror's content (`.cm-content`), its font is the editor's (`#sb-main
//   .cm-editor`, which SilverBullet 2.12.1 sizes in px and its main by `--editor-font-size`);
// - the text's width is the variable `--editor-width` its theme declares on the root, read by the text, the top bar
//   and the notifications alike: set inline on the root, important, it wins over a theme's or a Space Style's
//   `!important` (probe 2);
// - the editor's pane is `#sb-editor`;
// - the page is seen in CodeMirror's scroller (`.cm-scroller`), below SilverBullet's top bar: a stacking context of its
//   own (position relative, z-index 0) the page's lines and widgets are in, so a guide at z-index -1 in it lies under
//   the widgets and over the editor's background (verified in SilverBullet 2.12.1).
// silverware-layout/ui-tests/silverbullet.spec.ts checks each against SilverBullet.
import { cssWidth, type Width } from "../../model/width.ts";
import { textWidthOf } from "../marks.ts";
import type { PageHost } from "../page.ts";

const TEXT_WIDTH = "--editor-width";
const CONTENT_SELECTOR = ".cm-content";
const EDITOR_SELECTOR = "#sb-main .cm-editor";
const PANE_SELECTOR = "#sb-editor";
const SCROLLER_SELECTOR = ".cm-scroller";

/** SilverBullet's page in a document (the playground's imitates it) */
export function silverBulletPage(doc: Document): PageHost {
  return {
    content: () => doc.querySelector<HTMLElement>(CONTENT_SELECTOR) ?? undefined,
    editor: () => doc.querySelector<HTMLElement>(EDITOR_SELECTOR) ?? undefined,
    // (The window where SilverBullet's pane is not there)
    pane: () => doc.querySelector<HTMLElement>(PANE_SELECTOR) ?? doc.documentElement,
    view: () => {
      const height = doc.defaultView?.innerHeight ?? 0;
      const scroller = doc.querySelector(SCROLLER_SELECTOR)?.getBoundingClientRect();
      return scroller ? { top: Math.max(0, scroller.top), bottom: Math.min(height, scroller.bottom) } : { top: 0, bottom: height };
    },
    guideLayer: () => doc.querySelector<HTMLElement>(SCROLLER_SELECTOR) ?? undefined,
    showTextWidth: (width) => showTextWidth(doc, width),
    themeTextWidth: () => themeTextWidth(doc),
  };
}

/** The page's text shown at a width (none: the theme's, nothing of ours left) */
function showTextWidth(doc: Document, width: Width | undefined): void {
  const style = doc.documentElement.style;
  if (width) {
    const value = cssWidth(width);
    if (style.getPropertyValue(TEXT_WIDTH) !== value || style.getPropertyPriority(TEXT_WIDTH) !== "important") style.setProperty(TEXT_WIDTH, value, "important");
  } else if (style.getPropertyValue(TEXT_WIDTH)) style.removeProperty(TEXT_WIDTH);
}

/**
 * The text's width the theme gives (px), Silverware Layout's own set aside a moment: what a page follows where neither
 * it nor the default has a width. Read once, as the dialog opens
 */
function themeTextWidth(doc: Document): number {
  const content = doc.querySelector<HTMLElement>(CONTENT_SELECTOR);
  if (!content) return 0;
  const style = doc.documentElement.style;
  const value = style.getPropertyValue(TEXT_WIDTH);
  const priority = style.getPropertyPriority(TEXT_WIDTH);
  if (value) style.removeProperty(TEXT_WIDTH);
  const width = textWidthOf(content);
  if (value) style.setProperty(TEXT_WIDTH, value, priority);
  return Math.round(width);
}
