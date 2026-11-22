// Whether a document holds an element marked by an attribute every plugin knows (what one shows over the window, a side
// panel), watched: told as the first is marked (at once) and as the last goes (a moment later, so an element drawn anew,
// the new one marked a moment after the old went, does not end it). The mark is on the element itself: one taken out
// of the page takes its mark along.

// How long nothing is marked before the end is told
export const ENDED_MS = 100;

/** Whether a document holds an element with the attribute */
export function marked(doc: Document, attribute: string): boolean {
  return !!doc.querySelector(`[${attribute}]`);
}

/**
 * Told when an element with the attribute is in the document (at once) or none is any more (once none has been for
 * ENDED_MS): a mark set or taken off, an element put in or taken out with its mark. Gives the way to stop watching
 */
export function watchMark(doc: Document, attribute: string, changed: (shown: boolean) => void): () => void {
  const view = doc.defaultView;
  if (!view?.MutationObserver) return () => undefined;
  const selector = `[${attribute}]`;
  let shown = marked(doc, attribute);
  let ending: number | undefined;
  const tell = (now: boolean) => {
    if (now === shown) return;
    shown = now;
    changed(now);
  };
  // (Only changes that may concern a mark are looked at: the page's editor changes the document as it is typed in)
  const concerns = (node: Node) => node instanceof view.Element && (node.hasAttribute(attribute) || !!node.querySelector(selector));
  const observer = new view.MutationObserver((records) => {
    if (!records.some((r) => r.type === "attributes" || [...r.addedNodes, ...r.removedNodes].some(concerns))) return;
    view.clearTimeout(ending);
    ending = undefined;
    if (marked(doc, attribute)) tell(true);
    else if (shown) ending = view.setTimeout(() => tell(marked(doc, attribute)), ENDED_MS);
  });
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: [attribute], childList: true, subtree: true });
  return () => {
    observer.disconnect();
    view.clearTimeout(ending);
  };
}
