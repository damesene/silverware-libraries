// Enter in a list (listenter.ts) over CodeMirror's markdown, as the editor binds it
import { describe, expect, it } from "vitest";
import { ensureSyntaxTree } from "@codemirror/language";
import { listEnter } from "./listenter.ts";
import * as cm from "./vendor.ts";

/** The text after Enter at `|` in `text`, the cursor marked `|` again */
function enter(text: string): string {
  const at = text.indexOf("|");
  let state = cm.EditorState.create({ doc: text.replace("|", ""), selection: { anchor: at }, extensions: [cm.markdown({ base: cm.markdownLanguage })] });
  ensureSyntaxTree(state, state.doc.length, 5_000);
  listEnter(cm)({ state, dispatch: (tr) => (state = tr.state) });
  const head = state.selection.main.head;
  const doc = state.doc.toString();
  return `${doc.slice(0, head)}|${doc.slice(head)}`;
}

describe("Enter in a list", () => {
  it("continues a loose list without a blank line before the new item (a bullet item above a task list)", () => {
    expect(enter("* adasdadd|\n\n* [ ] asdjl\n* [ ] b")).toBe("* adasdadd\n* |\n\n* [ ] asdjl\n* [ ] b");
  });

  it("continues a tight list, a task list and an ordered list as CodeMirror does", () => {
    expect(enter("* a|\n* b")).toBe("* a\n* |\n* b");
    expect(enter("* [ ] a|")).toBe("* [ ] a\n* [ ] |");
    expect(enter("1. a|\n2. b")).toBe("1. a\n2. |\n3. b");
  });

  it("leaves a blank item's list, its marker taken off", () => {
    expect(enter("* a\n* |")).toBe("* a\n|");
  });
});
