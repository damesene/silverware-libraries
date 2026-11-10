// What is to change in a database, as data in the model's terms, which the
// core hands its store as one transaction. A store knows only these few
// kinds; what the core offers more (a property renamed, its key changed, its
// type changed) it makes of them: the schema set anew and each item's values
// set (docs/silverware-database.md, *The core*).
import type { ItemKey, ItemLook, Property, Value } from "../model/database.ts";

/** One change of a database */
export type DatabaseChange =
  // A property's value of an item; undefined: the item has it no more
  | { readonly kind: "setValue"; readonly item: ItemKey; readonly key: string; readonly value: Value | undefined }
  | { readonly kind: "renameItem"; readonly item: ItemKey; readonly name: string }
  // Its place in the order by hand
  | { readonly kind: "setRank"; readonly item: ItemKey; readonly rank: string }
  // How it looks (its icon, its color), the whole of it: what it leaves out, it has no more
  | { readonly kind: "setLook"; readonly item: ItemKey; readonly look: ItemLook }
  // Its body (where the store keeps one: `capabilities.itemBody`), written only where it is still `was` (as `body()` read it; undefined: it had none)
  | { readonly kind: "setBody"; readonly item: ItemKey; readonly body: string; readonly was: string | undefined }
  // A new item; `ref` names it in this transaction (what its key is once made, in the report). `tags`: those of the document
  // it is kept in, beside the database's own (the system property Tags shows them), made with it
  | { readonly kind: "createItem"; readonly ref: string; readonly name: string; readonly values: Readonly<Record<string, Value>>; readonly rank?: string; readonly look?: ItemLook; readonly body?: string; readonly tags?: readonly string[] }
  | { readonly kind: "removeItem"; readonly item: ItemKey }
  // A new database of the transaction's id: its first change and only there, its schema by a `setSchema` after it
  | { readonly kind: "createDatabase"; readonly name: string }
  | { readonly kind: "renameDatabase"; readonly name: string }
  // The database deleted: its own record (its root page), the transaction's last change and only there, every item of it
  // removed by the same transaction (else none of it is)
  | { readonly kind: "removeDatabase" }
  // The properties as they are to be, in their order
  | { readonly kind: "setSchema"; readonly properties: readonly Property[] };

/**
 * What a transaction's changes were made from: the revisions of items (by
 * key) and of the database (its record: name, schema) as read. A part at
 * another revision now is left, not written over (a value toggled from what a
 * view showed, a schema changed from one since changed).
 */
export type Expected = { readonly items?: Readonly<Record<string, string>>; readonly database?: string };

/**
 * A transaction: a database's changes, made together and reported together.
 * An item it makes is changed in its `createItem` alone (no change names an
 * item by its `ref`): the core's builder folds what it is given for one into it.
 */
export type Changes = {
  readonly database: string;
  readonly changes: readonly DatabaseChange[];
  readonly expects?: Expected;
};
