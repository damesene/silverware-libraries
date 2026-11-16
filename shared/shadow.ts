// Nodes in an open shadow root (another plugin's editor field: Silverware Editor draws its editor in one) taken as the
// page's: an event's target, the element at a point, what a node is in. The document's own answers stop at a shadow
// root's host (the field as a whole), which hides what is drawn in it (a file in a grid's cell edited).

/** The root's host where a node is in a shadow root (none: in the document, or in nothing) */
function hostOf(node: Node): Element | undefined {
  const root = node.getRootNode();
  // (Asked by its host, not its class: a node of another window's realm)
  const host = (root as Partial<ShadowRoot>).host;
  return root !== node && host ? host : undefined;
}

/** The element an event happened at, in a shadow root too (the document's `target` is the root's host there) */
export function composedTarget(event: Event): Element | undefined {
  const first = event.composedPath?.()[0];
  if (first && (first as Node).nodeType === 1) return first as Element;
  return event.target && (event.target as Node).nodeType === 1 ? (event.target as Element) : undefined;
}

/** The element at a point of the window, in an open shadow root too */
export function deepElementFromPoint(doc: Document, x: number, y: number): Element | null {
  let found = doc.elementFromPoint(x, y);
  while (found?.shadowRoot) {
    const inner = found.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === found) break;
    found = inner;
  }
  return found;
}

/** Whether a node is in an element, or in a shadow root whose host is (however deep) */
export function composedContains(ancestor: Node, node: Node): boolean {
  for (let at: Node | undefined = node; at; at = hostOf(at)) if (ancestor.contains(at)) return true;
  return false;
}

/** The closest element a selector matches that a node is in, past a shadow root to its host */
export function composedClosest<E extends Element = Element>(element: Element, selector: string): E | null {
  for (let at: Element | undefined = element; at; at = hostOf(at)) {
    const found = at.closest(selector) as E | null;
    if (found) return found;
  }
  return null;
}

/** Whether a node is drawn in a shadow root */
export function inShadow(node: Node): boolean {
  return hostOf(node) !== undefined;
}
