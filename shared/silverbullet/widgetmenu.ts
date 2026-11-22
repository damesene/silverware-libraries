// SilverBullet's edge (after 2.12.1) shows a ⋮ in the margin beside every widget its widget menu knows (Move up, Move
// down, Delete, Edit: client/codemirror/line_handle.ts and widgets/block_menu.ts of its main, 2026-11-21): it finds the
// widget's card by the attribute `data-sb-widget-menu`, which it sets on the card as it registers its menu (a code
// block's widget, a table). On a widget of ours it does nothing that fits (our widgets take a press beside them, so a
// click on it did nothing) and it lies over a widget wider than the text. So the card round a widget of ours is taken
// out of it: the attribute taken off, now and whenever SilverBullet sets it again (as it draws the widget anew); every
// other widget keeps its ⋮. Without the attribute (2.12.1) nothing happens.
//
// Watched in the document for that attribute alone (a code block's widget is registered once it is in the page, after
// its content is drawn); a card registered before it is put in the page (a table) is taken out as its widget is found.

/** The attribute SilverBullet marks a widget's card with as it registers its widget menu */
export const WIDGET_MENU_ATTRIBUTE = "data-sb-widget-menu";

/** The attribute a widget of ours carries, so its card is known as ours */
export const OWN_WIDGET_ATTRIBUTE = "data-silverware-widget";

const MENU_SELECTOR = `[${WIDGET_MENU_ATTRIBUTE}]`;
const OWN_SELECTOR = `[${OWN_WIDGET_ATTRIBUTE}]`;

// The documents watched (each plugin's bundle watches its own once; several doing so take the same attribute off)
const watched = new WeakSet<Document>();

/**
 * A widget of ours kept out of SilverBullet's widget menu: marked as ours, its card (the nearest element registered
 * round it, itself where it is one: a table) taken out now and as SilverBullet registers it again
 */
export function keepFromWidgetMenu(widget: Element): void {
  if (!widget.hasAttribute(OWN_WIDGET_ATTRIBUTE)) widget.setAttribute(OWN_WIDGET_ATTRIBUTE, "");
  const doc = widget.ownerDocument;
  watch(doc);
  const card = widget.closest(MENU_SELECTOR);
  if (card) card.removeAttribute(WIDGET_MENU_ATTRIBUTE);
}

/** Whether an element registered with SilverBullet's widget menu is the card of a widget of ours (the nearest one round it) */
function isOwnCard(card: Element): boolean {
  if (card.hasAttribute(OWN_WIDGET_ATTRIBUTE)) return true;
  for (const widget of card.querySelectorAll(OWN_SELECTOR)) if (widget.closest(MENU_SELECTOR) === card) return true;
  return false;
}

/** The document watched for SilverBullet registering a card: one of ours taken out at once */
function watch(doc: Document): void {
  const view = doc.defaultView;
  if (watched.has(doc) || !view?.MutationObserver) return;
  watched.add(doc);
  // (That attribute alone: the editor changing the page as it is typed in wakes nothing)
  const observer = new view.MutationObserver((records) => {
    for (const record of records) {
      const card = record.target;
      if (card instanceof view.Element && card.hasAttribute(WIDGET_MENU_ATTRIBUTE) && isOwnCard(card)) card.removeAttribute(WIDGET_MENU_ATTRIBUTE);
    }
  });
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: [WIDGET_MENU_ATTRIBUTE], subtree: true });
}
