// A grid's cell edited in place (docs/silverware-layout-grid.md, *Editing*): its rendering replaced by its markdown in
// a field as tall as its text, the grid keeping its shape. Left (the field losing focus, Esc, Ctrl/Cmd+Enter), the
// text is handed back once; the cell shows its rendering again until the host draws the grid anew.
import { el } from "../../../../shared/elements.ts";

/** The cell's markdown edited in place, the cursor at `at` in it (none: at its end); `done` gets the text as left (once) */
export function editCell(cell: HTMLElement, markdown: string, at: number | undefined, done: (text: string) => void): HTMLTextAreaElement {
  const doc = cell.ownerDocument;
  const shown = [...cell.childNodes];
  const field = el(doc, "textarea", { class: "swl-grid-editor", attrs: { "aria-label": "The cell's markdown", spellcheck: "true" } });
  field.value = markdown;
  let left = false;
  const grow = () => {
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  };
  const leave = () => {
    if (left) return;
    left = true;
    const text = field.value;
    cell.replaceChildren(...shown);
    cell.classList.remove("swl-grid-editing");
    done(text);
  };
  field.addEventListener("input", grow);
  field.addEventListener("blur", leave);
  field.addEventListener("keydown", (event) => {
    // The page's editor takes no key typed here (its shortcuts, its own handling of the widget's keys)
    event.stopPropagation();
    if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      field.blur();
    }
  });
  cell.classList.add("swl-grid-editing");
  cell.replaceChildren(field);
  grow();
  field.focus();
  const caret = at === undefined ? markdown.length : Math.max(0, Math.min(markdown.length, at));
  field.setSelectionRange(caret, caret);
  return field;
}

/**
 * The word under a point in the rendering and how far into it the point is, as the browser places a caret there
 * (none where it cannot: an image, a browser without caretPositionFromPoint or caretRangeFromPoint)
 */
export function caretWord(doc: Document, x: number, y: number): { readonly node: Node; readonly offset: number } | undefined {
  const withPosition = doc as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  const position = withPosition.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = doc.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : undefined;
}
