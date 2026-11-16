// The page's look of what the live preview draws (shared/editor.ts `EditorLook`: a task's box, a done task's text,
// its hanging indent, a hashtag, as the page's own rendering computes them), written as rules of the editor's shadow root over its own look.
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
  rule(".swe-task-done", look.taskDone);
  // (A task's hanging indent: how far its text's next lines begin after where its first begins, the box's room)
  const hang = -parseFloat(look.task?.["text-indent"] ?? "");
  if (hang > 0 && Number.isFinite(hang)) rule("", { "--swe-task-hang": `${hang}px` });
  rule(".swe-hashtag", look.hashtag);
  return rules.join("\n");
}
