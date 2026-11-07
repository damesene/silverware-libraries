// The shape of a property type: what a value of it is, how it reads from text
// typed and shows as text. Built-in types (builtin/) and the user's (later,
// `silverware.database.defineTypes`) are written against this alike; a view
// draws and edits a value through its type, never by knowing the type.
import type { Params, Value } from "../../model/database.ts";

/**
 * A value as kept, as text: what a type shows of a value that does not read
 * as it (kept as read, shown invalid, never blank)
 */
export function keptText(value: Value): string {
  if (value === null) return "";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

/** A text typed made a value, or why it cannot be one */
export type Parsed = { readonly value: Value } | { readonly problem: string };

export interface PropertyType {
  /** Its name, as a property's `type` names it */
  readonly name: string;
  /** What the user sees it called */
  readonly label: string;
  /** Why a property's params are not this type's (a select's options no list of texts), undefined where they are */
  validateParams?(params: Params): string | undefined;
  /** Why a value does not read as this type (shown invalid, kept as read), undefined where it does; an empty value always does (`isEmpty`) */
  validate(value: Value, params: Params): string | undefined;
  /** The value as text: what is shown, filtered and copied; one that does not read as the type as kept (`keptText`) */
  text(value: Value, params: Params): string;
  /** What sorting compares where it is not the text (a select by its options' order) */
  sortKey?(value: Value, params: Params): string;
  /** A text typed (an editor's) made a value; an empty text an empty value (a checkbox has none: unticked) */
  parse(text: string, params: Params): Parsed;
}
