// SilverBullet's editor's area on screen (`#sb-editor`: not its sidebars, not its top bar), where a panel beside the page
// goes: Silverware Database's peek and Silverware Assets' side panel. Inside its padding: Silverware Toolbar docked at its
// top or bottom pads it by its height, which a panel over the whole box lay under (seen 2026-11-09).
import type { SheetArea } from "../sheetarea.ts";

/** The editor's content box on screen, inside its padding and borders; none where the editor is not there */
export function editorArea(doc: Document): DOMRect | undefined {
  const editor = doc.querySelector<HTMLElement>("#sb-editor");
  const view = doc.defaultView;
  if (!editor || !view) return undefined;
  // (The element looked up as asked: SilverBullet keeps it for the session)
  const box = editor.getBoundingClientRect();
  const style = view.getComputedStyle(editor);
  const side = (name: "top" | "right" | "bottom" | "left") => (parseFloat(style.getPropertyValue(`padding-${name}`)) || 0) + (parseFloat(style.getPropertyValue(`border-${name}-width`)) || 0);
  const [top, right, bottom, left] = [side("top"), side("right"), side("bottom"), side("left")];
  return new DOMRect(box.left + left, box.top + top, Math.max(0, box.width - left - right), Math.max(0, box.height - top - bottom));
}

/**
 * `listener` told as the editor's content box may have changed: its size (a sidebar narrows it), and what pads it changed
 * without its size (a toolbar docked at its top moved to its bottom: the variables on html it pads it by, or its own
 * style); its end given back
 */
export function watchEditorArea(doc: Document, listener: () => void): () => void {
  const editor = doc.querySelector("#sb-editor");
  const view = doc.defaultView;
  if (!editor || !view) return () => {};
  // (Once a frame however often they change: html's style is written often, by a toolbar following the keyboard too)
  let pending = false;
  const tell = () => {
    if (pending) return;
    pending = true;
    view.requestAnimationFrame(() => {
      pending = false;
      listener();
    });
  };
  const resized = view.ResizeObserver ? new view.ResizeObserver(tell) : undefined;
  resized?.observe(editor);
  const styled = new view.MutationObserver(tell);
  for (const one of [doc.documentElement, editor]) styled.observe(one, { attributes: true, attributeFilter: ["style", "class"] });
  return () => {
    resized?.disconnect();
    styled.disconnect();
  };
}

/** The editor's area as a panel beside the page asks for it */
export function editorSheetArea(doc: Document): SheetArea {
  return { rect: () => editorArea(doc), watch: (listener) => watchEditorArea(doc, listener) };
}
