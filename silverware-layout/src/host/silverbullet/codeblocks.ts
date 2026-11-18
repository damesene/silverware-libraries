// A grid's cells' code blocks highlighted as the page's editor highlights them (docs/silverware-look-fixes.md):
// SilverBullet's rendering highlights none (`markdownToHtml`: `<pre data-lang="csharp">`, its lines between `<br>`s),
// so each is highlighted by Silverware Editor's API where it is there (`Editors.highlightCode`), else left as rendered.
// Its parts are drawn between the same `<br>`s, its text as it was: what a press in it finds of its markdown (its
// offsets) does not change.
import type { CodePart, Editors } from "../../../../shared/editor.ts";

// A code block highlighted already (a cell taken over unchanged keeps its highlighting)
const HIGHLIGHTED = "data-swl-highlighted";

/** A code block's text as rendered: its text, a line's end where a `<br>` is */
function codeOf(pre: HTMLElement): string {
  return [...pre.childNodes].map((node) => (node.nodeName === "BR" ? "\n" : (node.textContent ?? ""))).join("");
}

/** A code's parts drawn: each a span of its look (none: its text), a `<br>` at each line's end */
function drawParts(doc: Document, parts: readonly CodePart[]): Node[] {
  const nodes: Node[] = [];
  for (const part of parts) {
    part.text.split("\n").forEach((piece, index) => {
      if (index > 0) nodes.push(doc.createElement("br"));
      if (!piece) return;
      if (!part.look) return void nodes.push(doc.createTextNode(piece));
      const span = doc.createElement("span");
      for (const [name, value] of Object.entries(part.look)) span.style.setProperty(name, value);
      span.textContent = piece;
      nodes.push(span);
    });
  }
  return nodes;
}

/** A grid's cells' code blocks in a language highlighted, each once (none where the editor highlights none) */
export function highlightCodeIn(grid: HTMLElement, editors: Editors): void {
  const highlight = editors.highlightCode;
  if (!highlight) return;
  for (const pre of grid.querySelectorAll<HTMLElement>(`pre[data-lang]:not([${HIGHLIGHTED}])`)) {
    const language = pre.dataset.lang ?? "";
    const code = codeOf(pre);
    pre.setAttribute(HIGHLIGHTED, "");
    void highlight(code, language)
      .then((parts) => {
        // (Drawn where it is still as it was read, in the page or not yet: a grid is highlighted as it is drawn, before
        // the host puts it in the page, and a highlighter loaded answers before it does)
        if (!parts || codeOf(pre) !== code) return;
        pre.replaceChildren(...drawParts(pre.ownerDocument, parts));
      })
      .catch(() => undefined);
  }
}
