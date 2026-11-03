// Choice columns as the column types module tells them: the built-in choice
// type's (one a custom type named choice replaced is not one: its lists mean
// nothing to it), and the list a header names.
import CHOICE from "./builtin/choice.ts";
import { columnTypeOf } from "./registry.ts";
import type { ColumnType } from "./type.ts";

/** Whether a column's type (or a type, as `{ type }`) is the built-in choice type */
export function isChoice<T extends { readonly type: ColumnType }>(typed: T | undefined): typed is T {
  return typed?.type === CHOICE;
}

/** The list a header's choice type names, lower case; undefined: none, or no choice column */
export function choiceListOf(header: string): string | undefined {
  const typed = columnTypeOf(header);
  return isChoice(typed) ? (typed.params.name as string | undefined)?.toLowerCase() : undefined;
}
