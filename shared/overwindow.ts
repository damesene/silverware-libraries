// Something a plugin shows over the whole window (a table or a database in
// full screen, a sheet): its element carries one attribute every plugin knows,
// so another plugin can stand back while it shows without knowing whose it is.
// The mark is on the element itself, so an element taken out of the page takes
// its mark along.

/** The attribute on an element shown over the whole window */
export const OVER_WINDOW_ATTRIBUTE = "data-silverware-over-window";

const SELECTOR = `[${OVER_WINDOW_ATTRIBUTE}]`;

// How long nothing is marked before the end is told: a view rendered anew (its element replaced, the new one marked
// a moment later) does not end
const ENDED_MS = 100;

/** An element marked as shown over the whole window, or not */
export function markOverWindow(element: Element, on: boolean): void {
  element.toggleAttribute(OVER_WINDOW_ATTRIBUTE, on);
}

/** Whether a plugin shows something over the whole window in a document */
export function overWindowShown(doc: Document): boolean {
  return !!doc.querySelector(SELECTOR);
}

/**
 * Told when something is shown over the window (at once) or no longer is
 * (once nothing has been marked for ENDED_MS): a mark set or taken off, an
 * element put in or taken out with its mark. Gives the way to stop watching
 */
export function watchOverWindow(doc: Document, changed: (shown: boolean) => void): () => void {
  const view = doc.defaultView;
  if (!view?.MutationObserver) return () => undefined;
  let shown = overWindowShown(doc);
  let ending: number | undefined;
  const tell = (now: boolean) => {
    if (now === shown) return;
    shown = now;
    changed(now);
  };
  // (Only changes that may concern a mark are looked at: the page's editor changes the document as it is typed in)
  const marked = (node: Node) => node instanceof view.Element && (node.hasAttribute(OVER_WINDOW_ATTRIBUTE) || !!node.querySelector(SELECTOR));
  const observer = new view.MutationObserver((records) => {
    if (!records.some((r) => r.type === "attributes" || [...r.addedNodes, ...r.removedNodes].some(marked))) return;
    view.clearTimeout(ending);
    ending = undefined;
    if (overWindowShown(doc)) tell(true);
    else if (shown) ending = view.setTimeout(() => tell(overWindowShown(doc)), ENDED_MS);
  });
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: [OVER_WINDOW_ATTRIBUTE], childList: true, subtree: true });
  return () => {
    observer.disconnect();
    view.clearTimeout(ending);
  };
}
