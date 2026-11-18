// The page's look of what the live preview draws (shared/editor.ts `EditorLook`: a task's box, a hashtag, a table's cells,
// as the page's own rendering computes them), written as rules of the editor's shadow root over its own look.
// Each value set through the CSSOM (`setProperty`): one it does not read is left out, none can end the rule, a value
// with a `;` in it (a data URL's image) kept whole.
import type { EditorLook, LookProperties } from "../../shared/editor.ts";

// (Above the editor's theme: CodeMirror's rules are a class of its own and the part's, two classes)
const SCOPE = ".cm-editor .cm-content";

/** A rule's declarations of properties as computed, each important, as the CSSOM writes them */
function declarations(doc: Document, properties: LookProperties): string {
  const style = doc.createElement("div").style;
  for (const [name, value] of Object.entries(properties)) if (value) style.setProperty(name, value, "important");
  return style.cssText;
}

/** The rules of a look, for the editor's root (none of a part not given) */
export function lookRules(doc: Document, look: EditorLook): string {
  const rules: string[] = [];
  const rule = (selector: string, properties: LookProperties | undefined) => {
    const written = properties ? declarations(doc, properties) : "";
    if (written) rules.push(`${selector ? `${SCOPE} ${selector}` : SCOPE} { ${written} }`);
  };
  rule(".swe-checkbox", look.checkbox);
  rule(".swe-checkbox:checked", look.checkboxChecked);
  rule(".swe-checkbox:checked::after", look.checkedMark);
  rule(".swe-hashtag", look.hashtag);
  rule(".swe-table thead th", look.tableHead);
  rule(".swe-table tbody td", look.tableCell);
  // The page's editor's own (its rendering's differ), on a heading's line, a strong text's and inline code's mark alone:
  // what is in them inherits it, what has a look of its own (a hashtag, a link) keeps it
  for (const level of [1, 2, 3] as const) rule(`.cm-line.swe-h${level}`, look[`heading${level}`]);
  rule(".swe-strong", look.strong);
  rule(".swe-inline-code", look.inlineCode);
  rule(".cm-line.swe-code-line", look.codeBlock);
  // (A rule's line as the page's: its colour and width, as far down its line as the page's margin puts it; drawn as a
  // ground, not by margins, which CodeMirror's measure of its lines leaves out: a press under it found the line above)
  const line = look.rule;
  if (line) {
    const color = line["border-top-color"] || "currentColor";
    rule(".cm-line.swe-hr", {
      "background-image": `linear-gradient(${color}, ${color})`,
      "background-position": `0 ${line["margin-top"] || "50%"}`,
      "background-size": `100% ${line["border-top-width"] || "1px"}`,
      "background-repeat": "no-repeat",
    });
  }
  return rules.join("\n");
}
