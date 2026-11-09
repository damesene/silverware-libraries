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
  /** False where it is not offered for a property of the user's (a system property's own: a share done) */
  readonly offered?: boolean;
  /** True where its values are lists (a multi-select's options, references): grouped by it, an item is in the group of each */
  readonly lists?: boolean;
  /**
   * The field its values are edited in: a list of its options, boxes of them,
   * a browser's date, time or date and time field, a link's address and text;
   * `toggle`: no field, a press turning it (true or not: its empty value
   * unticked, never missing); `documents`: some of the space's documents
   * picked, a list of references (domain/types/reference.ts); a text field
   * where none (or where a value kept does not read as it)
   */
  readonly editor?: "select" | "multi-select" | "date" | "time" | "datetime-local" | "link" | "toggle" | "documents";
  /** How a value shows where not as its text alone: its options as pills, a share as a bar, a link to open, a box ticked or not, links to the documents it names, labels (texts as quiet pills, no options) */
  readonly look?: "options" | "share" | "link" | "check" | "documents" | "labels";
  /** Why a property's params are not this type's (a select's options no list of texts), undefined where they are */
  validateParams?(params: Params): string | undefined;
  /** Why a value does not read as this type (shown invalid, kept as read), undefined where it does; an empty value always does (`isEmpty`) */
  validate(value: Value, params: Params): string | undefined;
  /** The value as text: what is shown, filtered and copied; one that does not read as the type as kept (`keptText`) */
  text(value: Value, params: Params): string;
  /** What sorting compares where it is not the text (a select by its options' order) */
  sortKey?(value: Value, params: Params): string;
  /**
   * The value of the group a value is in, where values of one group differ (a
   * date's day, whatever its time): an item added there gets it, one moved
   * there it read over its own (`parse` with `was`: a date keeps its time).
   * None: a group per value
   */
  groupValue?(value: Value, params: Params): Value;
  /**
   * A text typed (an editor's) made a value; an empty text an empty value (a
   * checkbox has none: unticked). `was`: the value it replaces, where there is
   * one, for a type keeping a part of it the text does not say (a date its time)
   */
  parse(text: string, params: Params, was?: Value): Parsed;
}
