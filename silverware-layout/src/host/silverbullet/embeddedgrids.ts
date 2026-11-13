// A grid in a page embedded in another (`![[Other]]`): SilverBullet draws the embedded page's markdown without its
// custom syntax (2.12.1 and its main, probed 2026-11-13: in `.sb-inline-content`, the grid's lines as text, a <br>
// between each, its cells' markdown as written), so the grid shows as its text. Found here as that text (a line
// `<grid …>` to a line `</grid>`, each a text of its own in the same parent) and handed over to be drawn as a grid,
// the drawing put in its place. Only here: the shape is SilverBullet's.
const FRAME = ".sb-inline-content";
const OPEN = /^<grid(?:\s[^>]*)?>$/;
const CLOSE = "</grid>";
// What is never looked into: a grid drawn (a cell's text is its own)
const DRAWN = ".swl-grid";

/** Each grid shown as text in an embedded page, now and from now on, drawn by `draw` in its place; stopped by the function given back */
export function watchEmbeddedGrids(doc: Document, draw: (gridText: string) => Promise<HTMLElement | undefined>): () => void {
  const look = (root: Node) => {
    const element = root instanceof Element ? root : root.parentElement;
    if (!element || element.closest(DRAWN)) return;
    const frames = new Set<Element>(element.querySelectorAll(FRAME));
    const around = element.closest(FRAME);
    if (around) frames.add(around);
    for (const frame of frames) for (const open of openings(doc, frame)) replace(open);
  };
  // A grid's opening text once looked at (one not drawn, put back, is not looked at again)
  const seen = new WeakSet<Text>();
  const replace = (open: Text) => {
    if (seen.has(open)) return;
    seen.add(open);
    const found = gridFrom(open);
    if (!found) return;
    const place = doc.createElement("div");
    place.className = "swl-grid-place";
    open.before(place);
    for (const node of found.nodes) node.parentNode?.removeChild(node);
    void draw(found.text)
      .then((grid) => (grid ? place.replaceWith(grid) : place.replaceWith(...found.nodes)))
      .catch(() => place.replaceWith(...found.nodes));
  };
  look(doc.body);
  const observer = new (doc.defaultView ?? window).MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) look(node);
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/** The texts in a frame that open a grid, not in a grid drawn */
function openings(doc: Document, frame: Element): Text[] {
  const found: Text[] = [];
  const walker = doc.createTreeWalker(frame, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (OPEN.test(node.textContent?.trim() ?? "") && !node.parentElement?.closest(DRAWN)) found.push(node as Text);
  }
  return found;
}

/** A grid's text from its opening line to its line `</grid>`, and the nodes it is drawn as (none closing it: none) */
export function gridFrom(open: Text): { readonly text: string; readonly nodes: readonly Node[] } | undefined {
  const lines: string[] = [];
  const nodes: Node[] = [];
  let line = "";
  for (let node: Node | null = open; node; node = node.nextSibling) {
    nodes.push(node);
    if (node.nodeName === "BR") {
      lines.push(line);
      line = "";
      continue;
    }
    line += node.textContent ?? "";
    if (line.trim() === CLOSE) {
      lines.push(line);
      return { text: lines.join("\n"), nodes };
    }
  }
  return undefined;
}
