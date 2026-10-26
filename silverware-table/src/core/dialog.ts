// A feature's modal dialog (TableHost.openDialog): the plugins' shared dialog
// (shared/dialog.ts) in the look of Silverware Table's settings dialog. Its keys
// and presses are its own (the controller leaves them: not a selected cell's,
// not SilverBullet's), Tab stays in it, Esc or a press on the backdrop closes
// it, and the focus goes back where it was. The cell editor stays open
// meanwhile: its field losing the focus to the dialog is not leaving it
// (CellEditing asks `isOpen`).
import { Dialogs as SharedDialogs } from "../../../shared/dialog.ts";
import { UI_CLASS } from "../dom.ts";
import { ICONS } from "../icons.ts";

export type { Dialog, DialogOptions } from "../../../shared/dialog.ts";

export class Dialogs extends SharedDialogs {
  constructor(doc: Document) {
    super(doc, { base: "swt-dialog", backdropClass: UI_CLASS, closeIcon: ICONS.clear });
  }
}
