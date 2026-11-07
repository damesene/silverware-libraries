// What a view's definitions are given where they are a function (`export default (HELPERS) => [ … ]`
// in the module given to `silverware.database.defineViews`): the built-in views' own editors, so a view of the
// user's edits a value as the table, the list and the kanban do, nothing written the user did not
// change (views/editors.ts).
import { editValue, NAME, shownValue, toggle } from "./editors.ts";

export const VIEW_HELPERS = {
  /** The built-in property every item has: its name (`editValue(host, cell, item, NAME, show)` renames) */
  NAME,
  /** A cell's value edited in place by its type's editor, written as it is left */
  editValue,
  /** A value as a line of a card shows it beside others (a checkbox its property's name), undefined where empty */
  shownValue,
  /** A checkbox turned, written at once */
  toggle,
} as const;

export type ViewHelpers = typeof VIEW_HELPERS;
