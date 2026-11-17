// The page's look of what an editor draws as rendered (shared/editor.ts `EditorLook`), for an editor's user to hand
// it: a sample of markdown rendered by the page (`LOOK_SAMPLE`), put where the editor will be (the page's rules apply
// there), out of sight, its task's boxes and its hashtag's properties read as computed, the sample
// taken out at once. Read as the editor is made: a zoom or a theme changed since is read anew. No host's names: a box
// is an `<input>` of the type, a hashtag the element whose text it is alone. Which properties make each part's look
// is the editor's live preview's to need (silverware-editor/src/look.ts writes them).
import type { EditorLook, LookProperties } from "./editor.ts";

// The sample: an open task, a done one, a hashtag on a line of its own (none of a done task's look on it), a table
const HASHTAG = "#swlsample";
export const LOOK_SAMPLE = `- [ ] a\n- [x] b\n\n${HASHTAG}\n\n| c |\n|---|\n| d |`;

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

// What makes a table's cell's look (its header's alike): its text, its room, its ground, its line under it
const TABLE_CELL = [
  "font-size", "font-weight", "line-height", "color", "background-color", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-bottom-width", "border-bottom-style", "border-bottom-color", "text-transform", "letter-spacing",
];

// (No ground: a colour of none, as computed)
const CLEAR = /^(transparent|rgba\(0, 0, 0, 0\))$/;

/** A cell's look with the ground it is drawn on: its own, else its row's or its part's (a page may give a header's row its ground, its cells none) */
function grounded(win: Window, cell: Element, look: LookProperties): LookProperties {
  if (!CLEAR.test(look["background-color"] ?? "")) return look;
  for (let up = cell.parentElement; up && up.tagName !== "TABLE"; up = up.parentElement) {
    const ground = win.getComputedStyle(up).backgroundColor;
    if (!CLEAR.test(ground)) return { ...look, "background-color": ground };
  }
  return look;
}

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
    const table = sample.querySelector("table");
    const head = table?.querySelector("thead :is(th, td)");
    const cell = table?.querySelector("tbody td");
    return {
      ...(open ? { checkbox: read(win.getComputedStyle(open), BOX) } : {}),
      ...(done ? { checkboxChecked: read(win.getComputedStyle(done), BOX) } : {}),
      ...(mark && mark.getPropertyValue("content") !== "none" ? { checkedMark: read(mark, MARK) } : {}),
      ...(tag ? { hashtag: read(win.getComputedStyle(tag), TAG) } : {}),
      ...(head ? { tableHead: grounded(win, head, read(win.getComputedStyle(head), TABLE_CELL)) } : {}),
      ...(cell ? { tableCell: read(win.getComputedStyle(cell), TABLE_CELL) } : {}),
    };
  } finally {
    sample.remove();
  }
}
