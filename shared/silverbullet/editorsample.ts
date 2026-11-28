// The page's editor's look of what a plugin's markdown editor draws as SilverBullet's editor does (shared/editor.ts
// `EditorLook`: headings, a strong text, code, a code block, a rule), read of lines drawn as SilverBullet's editor
// draws them: its class names, the one place that knows them (2.12.1 and edge alike, 2026-11-18: client/style.ts,
// client/codemirror/editor_state.ts, client/styles/editor.scss), put beside its editor's content as a content of its
// own (its rules reach it; not in its content, whose changes CodeMirror reads, nor in a widget, whose rules may differ:
// a database's place drew inline code with no ground), hidden, read as computed and taken out at once, before the
// editor is made (nothing drawn between). What differs between SilverBullet's versions (2.12.1's strong text 900,
// edge's code block inset, its headings' sizes) is so the page's to tell (docs/silverware-look-fixes.md). Its sizes in
// em of the text round them: a field's font zoomed while it is open zooms them with it.
import type { EditorLook, LookProperties } from "../editor.ts";
import { readProperties, readSample } from "../editorlook.ts";

// What makes a heading's line, its text's colour on its own element
const HEADING: readonly string[] = ["font-size", "font-weight", "letter-spacing", "line-height", "padding-top", "padding-bottom"];
const STRONG: readonly string[] = ["font-weight"];
// (No colour of code's: SilverBullet's is a code block's text in no language, not its language's parts nor inline code)
const INLINE_CODE: readonly string[] = [
  "font-family", "font-size", "font-size-adjust", "line-height", "background-color", "border-top-left-radius", "border-top-right-radius",
  "border-bottom-right-radius", "border-bottom-left-radius", "padding-top", "padding-right", "padding-bottom", "padding-left",
];
const CODE_LINE: readonly string[] = ["font-family", "font-size-adjust", "background-color", "padding-left", "padding-right"];
const RULE: readonly string[] = ["border-top-width", "border-top-style", "border-top-color", "margin-top", "margin-bottom"];
// Sizes taken in em: a font's of the text round it, the rest of the element's own font
const EM: ReadonlySet<string> = new Set(["font-size", "letter-spacing", "line-height", "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-bottom"]);

const SAMPLE = [
  '<div class="cm-line sb-line-h1"><span class="sb-h1">a</span></div>',
  '<div class="cm-line sb-line-h2"><span class="sb-h2">a</span></div>',
  '<div class="cm-line sb-line-h3"><span class="sb-h3">a</span></div>',
  '<div class="cm-line"><span class="sb-strong">a</span> <span class="sb-code">a</span></div>',
  '<div class="cm-line sb-line-fenced-code"><span class="sb-code">a</span></div>',
  '<div class="cm-line sb-line-hr"><br></div>',
].join("");

/** A size in px in em of a font's size (`base`); another value as it is */
function inEm(value: string, base: number): string {
  const px = /^(-?[\d.]+)px$/.exec(value);
  return px && base > 0 ? `${Number((Number(px[1]) / base).toFixed(4))}em` : value;
}

/** An element's properties, its sizes in em (its font's of its parent's, the rest of its own) */
function readRelative(win: Window, element: Element, names: readonly string[]): LookProperties {
  const style = win.getComputedStyle(element);
  const own = parseFloat(style.fontSize);
  const parent = element.parentElement ? parseFloat(win.getComputedStyle(element.parentElement).fontSize) : own;
  return Object.fromEntries(Object.entries(readProperties(style, names)).map(([name, value]) => [name, EM.has(name) ? inEm(value, name === "font-size" ? parent : own) : value]));
}

/** The page's editor's look (none where its editor is not there) */
export function editorSampleLook(doc: Document): EditorLook {
  const content = doc.querySelector<HTMLElement>("#sb-main .cm-editor .cm-content");
  const scroller = content?.parentElement;
  if (!content || !scroller) return {};
  // (A content as its own: its classes and what it sets on itself, a column, a zoom's size)
  const made = (sample: HTMLElement) => {
    sample.className = content.className;
    sample.setAttribute("style", content.getAttribute("style") ?? "");
  };
  return (
    readSample(
      scroller,
      SAMPLE,
      (sample, win) => {
        const [h1, h2, h3, text, code, rule] = [...sample.children] as HTMLElement[];
        const heading = (line: HTMLElement): LookProperties => ({ ...readRelative(win, line, HEADING), color: win.getComputedStyle(line.firstElementChild!).color });
        const drawn = readProperties(win.getComputedStyle(rule!), RULE);
        return {
          heading1: heading(h1!),
          heading2: heading(h2!),
          heading3: heading(h3!),
          strong: readProperties(win.getComputedStyle(text!.querySelector(".sb-strong")!), STRONG),
          inlineCode: readRelative(win, text!.querySelector(".sb-code")!, INLINE_CODE),
          codeBlock: readRelative(win, code!, CODE_LINE),
          // (A rule's line only where the page draws one: else the editor's own kept)
          ...(drawn["border-top-style"] !== "none" && parseFloat(drawn["border-top-width"] ?? "0") > 0 ? { rule: readRelative(win, rule!, RULE) } : {}),
        };
      },
      made,
    ) ?? {}
  );
}
