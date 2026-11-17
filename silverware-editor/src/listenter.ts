// Enter in a list as SilverBullet's own editor has it: a list item continued by CodeMirror's command (its marker, a
// task's box, an ordered list's next number, a blank item leaving the list), without the blank line CodeMirror puts
// before the new item where the list is loose (a blank line between two of its items: a bullet item above a task
// list, which reads as one list with it). SilverBullet's page puts none there (its own command since 2.12.1, verified
// 2026-11-17 against its edge: `* a` above a blank line and `* [ ] b`, Enter after `a` gives `* a\n* \n\n* [ ] b`).
import type { StateCommand, Transaction, TransactionSpec } from "@codemirror/state";
import type { CodeMirror } from "./codemirror.ts";

/** A blank line at the start of what is inserted after a line's end: a line break, nothing but spaces and quote marks, a line break */
const LEADING_BLANK = /^(\r?\n)[ \t>]*(?=\r?\n)/;

/** CodeMirror's Enter in markdown, its blank line for a loose list left out */
export function listEnter(cm: CodeMirror): StateCommand {
  const continued = cm.insertNewlineContinueMarkupCommand({ nonTightLists: false });
  return ({ state, dispatch }) =>
    continued({
      state,
      dispatch: (tr: Transaction) => {
        // (One cursor and one insertion: what Enter at a caret makes; anything else as CodeMirror made it)
        let insertion: { from: number; to: number; text: string } | undefined;
        let count = 0;
        tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
          count++;
          insertion = { from: fromA, to: toA, text: inserted.toString() };
        });
        const blank = count === 1 && insertion && state.selection.ranges.length === 1 ? LEADING_BLANK.exec(insertion.text) : null;
        if (!insertion || !blank) return dispatch(tr);
        const text = insertion.text.slice(blank[0].length);
        const spec: TransactionSpec = {
          changes: { from: insertion.from, to: insertion.to, insert: text },
          selection: { anchor: tr.newSelection.main.head - blank[0].length },
          scrollIntoView: true,
          userEvent: "input",
        };
        dispatch(state.update(spec));
      },
    });
}
