// An element of a plugin's that takes files dropped or pasted on it itself (a database's cell of files, its card, its
// popup): marked with one attribute every plugin knows, so a plugin that takes files at the document (Silverware
// Assets, before SilverBullet's editor) leaves a drop or a paste there alone without knowing whose element it is.

import { composedClosest, composedTarget } from "./shadow.ts";

/** The attribute on an element that takes files dropped or pasted on it itself */
export const TAKES_FILES_ATTRIBUTE = "data-silverware-takes-files";

/** An element marked as taking files itself, or not */
export function markTakesFiles(element: Element, on: boolean): void {
  element.toggleAttribute(TAKES_FILES_ATTRIBUTE, on);
}

/** The element marked as taking files itself that a node is in (past a shadow root to its host), if any */
export function takesFilesOf(node: EventTarget | null | undefined): Element | undefined {
  const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
  return (element && composedClosest(element, `[${TAKES_FILES_ATTRIBUTE}]`)) ?? undefined;
}

/** The element marked as taking files itself that an event happened in (in a shadow root too, where the document's `target` is its host), if any */
export function takesFilesAt(event: Event): Element | undefined {
  return takesFilesOf(composedTarget(event) ?? event.target);
}
