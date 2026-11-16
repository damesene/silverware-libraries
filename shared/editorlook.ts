// The page's look of what an editor draws as rendered (shared/editor.ts `EditorLook`), for an editor's user to hand
// it: a sample of markdown rendered by the page (`LOOK_SAMPLE`), put where the editor will be (the page's rules apply
// there), out of sight, its task's boxes, a done task's text and its hashtag's properties read as computed, the sample
// taken out at once. Read as the editor is made: a zoom or a theme changed since is read anew. No host's names: a box
// is an `<input>` of the type, a hashtag the element whose text it is alone. Which properties make each part's look
// is the editor's live preview's to need (silverware-editor/src/look.ts writes them).
import type { EditorLook, LookProperties } from "./editor.ts";

// The sample: an open task, a done one, a hashtag on a line of its own (none of a done task's look on it)
const HASHTAG = "#swlsample";
export const LOOK_SAMPLE = `- [ ] a\n- [x] b\n\n${HASHTAG}`;

// What makes a box's look, and its mark's
const BOX = [
  "appearance", "box-sizing", "display", "position", "width", "height", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left", "border-top-width", "border-right-width", "border-bottom-width",
  "border-left-width", "border-top-style", "border-right-style", "border-bottom-style", "border-left-style", "border-top-color",
  "border-right-color", "border-bottom-color", "border-left-color", "border-top-left-radius", "border-top-right-radius",
  "border-bottom-right-radius", "border-bottom-left-radius", "background-color", "background-image", "color", "accent-color",
  "vertical-align", "font-size",
];
const MARK = [
  "content", "display", "position", "box-sizing", "left", "top", "right", "bottom", "width", "height", "border-top-width",
  "border-right-width", "border-bottom-width", "border-left-width", "border-top-style", "border-right-style",
  "border-bottom-style", "border-left-style", "border-top-color", "border-right-color", "border-bottom-color",
  "border-left-color", "background-color", "transform",
];
// What makes a hashtag's look (its place in the line too: padding, margin)
const TAG = [
  "color", "background-color", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-style",
  "border-right-style", "border-bottom-style", "border-left-style", "border-top-color", "border-right-color", "border-bottom-color",
  "border-left-color", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "font-size", "font-weight", "text-decoration-line",
];

const read = (style: CSSStyleDeclaration, names: readonly string[]): LookProperties => Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));

/** The look of the sample rendered (`html`) where an editor will be (`place`), as computed there; none of what it does not have */
export function sampleLook(place: HTMLElement, html: string): EditorLook {
  const win = place.ownerDocument.defaultView;
  if (!win) return {};
  const sample = place.ownerDocument.createElement("div");
  sample.setAttribute("aria-hidden", "true");
  sample.style.cssText = "position: absolute; visibility: hidden; pointer-events: none; left: 0; top: 0; width: 100%;";
  sample.innerHTML = html;
  place.append(sample);
  try {
    const boxes = [...sample.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const open = boxes.find((box) => !box.checked);
    const done = boxes.find((box) => box.checked);
    const tag = [...sample.querySelectorAll<HTMLElement>("*")].reverse().find((one) => one.textContent?.trim() === HASHTAG);
    const mark = done ? win.getComputedStyle(done, "::after") : undefined;
    return {
      ...(open ? { checkbox: read(win.getComputedStyle(open), BOX) } : {}),
      ...(done ? { checkboxChecked: read(win.getComputedStyle(done), BOX) } : {}),
      ...(mark && mark.getPropertyValue("content") !== "none" ? { checkedMark: read(mark, MARK) } : {}),
      // (The text beside it: what holds the box, as it is drawn)
      ...(done?.parentElement ? { taskDone: read(win.getComputedStyle(done.parentElement), ["text-decoration-line", "color", "opacity"]) } : {}),
      ...(open?.parentElement ? { task: read(win.getComputedStyle(open.parentElement), ["padding-left", "text-indent"]) } : {}),
      ...(tag ? { hashtag: read(win.getComputedStyle(tag), TAG) } : {}),
    };
  } finally {
    sample.remove();
  }
}
