// Something a plugin shows over the whole window (a table or a database in
// full screen, a sheet): its element carries one attribute every plugin knows,
// so another plugin can stand back while it shows without knowing whose it is.
// The mark is on the element itself, so an element taken out of the page takes
// its mark along.

import { marked, watchMark } from "./watchmark.ts";

/** The attribute on an element shown over the whole window */
export const OVER_WINDOW_ATTRIBUTE = "data-silverware-over-window";

const SELECTOR = `[${OVER_WINDOW_ATTRIBUTE}]`;

// (How long nothing is marked before the end is told: the shared watcher's)
export { ENDED_MS } from "./watchmark.ts";

/** An element marked as shown over the whole window, or not */
export function markOverWindow(element: Element, on: boolean): void {
  element.toggleAttribute(OVER_WINDOW_ATTRIBUTE, on);
}

/**
 * What is shown over the window that a node is in (a table in full screen, a database's peek), if any: a plugin's
 * controls placed by where the pointer is stand back from another plugin's, as its widget may lie under it
 */
export function overWindowOf(node: EventTarget | null): Element | undefined {
  const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
  return element?.closest(SELECTOR) ?? undefined;
}

/** Whether a plugin shows something over the whole window in a document */
export function overWindowShown(doc: Document): boolean {
  return marked(doc, OVER_WINDOW_ATTRIBUTE);
}

/**
 * Told when something is shown over the window (at once) or no longer is
 * (once nothing has been marked for ENDED_MS): a mark set or taken off, an
 * element put in or taken out with its mark. Gives the way to stop watching
 */
export function watchOverWindow(doc: Document, changed: (shown: boolean) => void): () => void {
  return watchMark(doc, OVER_WINDOW_ATTRIBUTE, changed);
}
