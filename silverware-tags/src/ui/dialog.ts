// Silverware Tags' dialogs (shared/dialog.ts, base `swg-dialog`), one over
// another: each opened is a layer of its own (the preview over the manager),
// Esc and a press beside it closing the top one only.
import { type Dialog, type DialogOptions, Dialogs } from "../../../shared/dialog.ts";
import { ICONS } from "./icons.ts";

const LOOK = { base: "swg-dialog", closeIcon: ICONS.close };

/** A dialog over the page and over any Silverware Tags dialog open */
export function openDialog(doc: Document, options: DialogOptions): Dialog {
  return new Dialogs(doc, LOOK).open(options);
}

/** A row of buttons for a dialog's foot: the others left, the main one last */
export function buttons(doc: Document, ...list: readonly HTMLElement[]): HTMLElement {
  const row = doc.createElement("div");
  row.className = "swg-buttons";
  row.append(...list);
  return row;
}
