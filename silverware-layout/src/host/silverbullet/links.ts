// A click on a link SilverBullet shows as its markdown (the caret or the selection in it: `[[`, `]]`, `](url)` seen)
// placing the cursor alone, as in a text editor: SilverBullet follows a link on its click wherever it is clicked
// (2.12.1), so a link being edited could not be clicked into. A link drawn as a link (the caret away) is followed as
// ever, Ctrl or Cmd held is too. While SilverBullet shows all the markdown as written, every link is its markdown:
// that mode's clicks are held back by shared/syntaxmode.ts, with this setting (src/index.ts).
//
// SilverBullet's elements (2.12.1, probed 2026-11-15): a link drawn as a link is an `<a>` (`a.sb-wiki-link`, a widget;
// `a.sb-link` round a markdown link's text; `a.sb-hashtag`, a hashtag always drawn so); a link shown as its markdown is
// its parts as spans of the editor's text, `span.sb-wiki-link` between `span.sb-meta` marks, `span.sb-link`.

import { SILVERBULLET_SYNTAX_PAGE } from "./syntaxmode.ts";

// The editor's text, and a link's part shown as its markdown there (never within a link drawn as a link)
const TEXT = "#sb-main .cm-content";
const SHOWN_LINK = "span.sb-wiki-link, span.sb-link";
// The root's mark while SilverBullet shows the markdown as written and its clicks place the cursor (src/index.ts)
const ALL_SHOWN = "data-swl-syntax-clicks";
// The root's mark while the pointer is over such a link or text (the style page's text pointer)
const TEXT_POINTER = "data-swl-text-pointer";

const elementOf = (target: EventTarget | null) => (target instanceof Element ? target : (target as Node | null)?.parentElement);

// A mark of the markdown (`[[`, `]]`, `|`), a link's where it is beside a part of one
const MARK = "span.sb-meta";

/** Whether a click is on a link shown as its markdown in the page's editor: its text, its target, or its marks */
export function onShownLink(target: EventTarget | null): boolean {
  const element = elementOf(target);
  if (!element?.closest(TEXT) || element.closest("a")) return false;
  if (element.closest(SHOWN_LINK)) return true;
  const mark = element.closest(MARK);
  return !!mark && [mark.previousElementSibling, mark.nextElementSibling].some((beside) => !!beside?.matches(SHOWN_LINK));
}

/**
 * Clicks on links shown as their markdown held back from SilverBullet (the press before it has placed the cursor:
 * CodeMirror's), while `wanted` says so; Ctrl or Cmd held, followed. The text's pointer over such a link, and over all
 * the text while SilverBullet shows the markdown as written (a widget's own kept), not a hand: nothing opens there.
 * Once per document
 */
export function holdShownLinkClicks(doc: Document, wanted: () => boolean): void {
  if (held.has(doc)) return;
  held.add(doc);
  // (Told at the press: the press moves the cursor, and CodeMirror draws the link's line anew before its click comes,
  // which is then on another element, perhaps the line's)
  let pressedOnShown = false;
  doc.addEventListener(
    "mousedown",
    (event) => {
      pressedOnShown = event.button === 0 && !event.ctrlKey && !event.metaKey && wanted() && onShownLink(event.target);
    },
    true,
  );
  doc.addEventListener(
    "click",
    (event) => {
      const held = pressedOnShown && event.button === 0 && !event.ctrlKey && !event.metaKey;
      pressedOnShown = false;
      if (held) event.stopPropagation();
    },
    true,
  );
  doc.addEventListener(
    "mouseover",
    (event) => {
      const element = elementOf(event.target);
      const all = !!element && doc.documentElement.hasAttribute(ALL_SHOWN) && !!element.closest(SILVERBULLET_SYNTAX_PAGE.text) && !element.closest(SILVERBULLET_SYNTAX_PAGE.notText);
      // (The root marked, the style page's rule giving what is under the pointer the text's pointer: the editor's own
      // elements left as they are, CodeMirror redraws what is changed in them)
      const text = wanted() && (onShownLink(element ?? null) || all);
      if (doc.documentElement.hasAttribute(TEXT_POINTER) !== text) doc.documentElement.toggleAttribute(TEXT_POINTER, text);
    },
    true,
  );
}
const held = new WeakSet<Document>();
