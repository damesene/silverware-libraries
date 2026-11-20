// A table as Silverware Table works on it, apart from where it is kept
// (docs/silverware-table-store-plan.md, *The model*): what of it is here so
// far, its attributes; its columns, rows and cells come with `TableModel`.
// Nothing of a store's form is here (escapes, hidden tags, a metadata row,
// lines, places): a store's codec reads its form into the model and writes it
// back, and is the one place that knows that form.
//
// Immutable: an edit makes a new version, sharing what it did not change.

/** Whose an attribute is: a module's name in lowercase, the core's (`core`), or none (`""`: a tag typed by hand without one) */
export type Owner = string;

/**
 * Attributes by owner, then key, each value text: what a value means is its
 * owner's (a list's JSON, a formula), so a module turned off passes its
 * attributes on untouched and every store keeps text alike
 */
export type Attributes = ReadonlyMap<Owner, ReadonlyMap<string, string>>;

export const NO_ATTRIBUTES: Attributes = new Map();

/** An attribute's value; undefined: none */
export function attributeIn(attributes: Attributes, owner: Owner, key: string): string | undefined {
  return attributes.get(owner)?.get(key);
}

/** The attributes with one set (undefined: removed); the same object where nothing changes */
export function withAttributeIn(attributes: Attributes, owner: Owner, key: string, value: string | undefined): Attributes {
  const own = attributes.get(owner);
  if (own?.get(key) === value) return attributes;
  const changed = new Map(own);
  if (value === undefined) changed.delete(key);
  else changed.set(key, value);
  const all = new Map(attributes);
  if (changed.size) all.set(owner, changed);
  else all.delete(owner);
  return all;
}
