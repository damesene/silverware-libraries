// The documents read (docs/silverware-viewers.md): each fetched and drawn by docx-preview once per file and version
// (kept by its URL and what its server says of it now: replaced under the same name, read again), made safe (only
// web and mail links, nothing that runs), and shown in a shadow root of its own: what a document's styles say stays in
// it (a font's or a style's name of the document's could reach the page's rules otherwise), and the page's rules stay
// out of it (the editor's font, size, line height, hyphenation reach it only as inherited, set again here).
import { fileVersion, readTurns } from "../../shared/reads.ts";
import { madeSafe } from "../../shared/safehtml.ts";
import { DOCX_CLASS, drawDocx, type DrawnDocx } from "./load.ts";

// At most so many documents read at once, and so many kept (the oldest let go): each is every page of a document, its
// images inlined
const AT_ONCE = 2;
const KEPT = 6;

/** What a document's shadow root holds of its own besides docx-preview's styles: Word's defaults where it names none, its pages on the reader's ground */
const DOCUMENT_CSS = `
.${DOCX_CLASS}-wrapper {
  font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif;
  font-size: 11pt;
  line-height: normal;
  color: #000;
  hyphens: manual;
  text-align: left;
  background: none !important;
}
.swa-docx-reading .${DOCX_CLASS}-wrapper {
  padding: 12px !important;
}
.swa-docx-reading section.${DOCX_CLASS} {
  margin: 0 auto 12px !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25) !important;
}
.swa-docx-previewing .${DOCX_CLASS}-wrapper {
  padding: 0 !important;
}
.swa-docx-previewing section.${DOCX_CLASS} {
  margin: 0 !important;
  box-shadow: none !important;
}
a[href] {
  color: #0563c1;
}
`;

const inTurn = readTurns(AT_ONCE);
const kept = new Map<string, Promise<DrawnDocx>>();

/** A document drawn once per file and version, made safe, for its previews and readers to clone (a failure not kept); `again`: drawn anew (Regenerate preview) */
export async function drawn(doc: Document, url: string, again = false): Promise<DrawnDocx> {
  const key = `${await fileVersion(url, doc.baseURI)} ${url}`;
  if (again) kept.delete(key);
  const known = kept.get(key);
  if (known) {
    kept.delete(key);
    kept.set(key, known);
    return known;
  }
  const drawing = inTurn(() => drawDocx(doc, url)).then((one) => {
    madeSafe(one.body);
    madeSafe(one.styles);
    return one;
  });
  kept.set(key, drawing);
  drawing.catch(() => kept.get(key) === drawing && kept.delete(key));
  while (kept.size > KEPT) kept.delete(kept.keys().next().value!);
  return drawing;
}

/**
 * A document shown in an element's shadow root (made where it has none, emptied where it has one): docx-preview's
 * styles and what is given, its own defaults, under a box marked as the reader's or a preview's
 */
export function showDocument(host: HTMLElement, styles: HTMLElement, content: readonly Node[], role: "reading" | "previewing"): ShadowRoot {
  const doc = host.ownerDocument;
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  const own = doc.createElement("style");
  own.textContent = DOCUMENT_CSS;
  const box = doc.createElement("div");
  box.className = `swa-docx-${role}`;
  box.append(...content);
  root.replaceChildren(...[...styles.children].map((style) => style.cloneNode(true)), own, box);
  return root;
}
