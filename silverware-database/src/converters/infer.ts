// The property a key's values read from a text need, and the values made
// that type's: what a converter does for values it has no type of (an
// attribute's). People and links are told by the converter (a mention, a wiki
// link); the rest guessed as a value kept under no property's key is
// (domain/loose.ts): logical values a checkbox, numbers a number, dates a
// date, a list a select of several options, else a text.
import type { ConvertedProperty } from "../core/converter.ts";
import { guessedType, optionsOfValues } from "../domain/loose.ts";
import { readMoment } from "../domain/types/moment.ts";
import type { Value } from "../model/database.ts";

/** A value as read: people (names without @), links (their targets), or a plain value */
export type ReadValue = { readonly kind: "people"; readonly names: readonly string[] } | { readonly kind: "links"; readonly targets: readonly string[] } | { readonly kind: "plain"; readonly value: Value };

/** A key's property, and each item's value under it made that type's (by the items' index; none: the item has none) */
export type Inferred = { readonly property: ConvertedProperty; readonly values: ReadonlyMap<number, Value> };

const linksOf = (targets: readonly string[]): string[] => targets.map((one) => `[[${one}]]`);

/** A read value as plain: people as `@name`, links as `[[target]]`, several as a list of texts */
function plainOf(value: ReadValue): Value {
  if (value.kind === "plain") return value.value;
  const texts = value.kind === "people" ? value.names.map((one) => `@${one}`) : linksOf(value.targets);
  return texts.length === 1 ? texts[0]! : texts;
}

/** A plain value as a text (a list's items joined) */
const textOf = (value: Value): string => (Array.isArray(value) ? value.join(", ") : String(value));

/** A list of texts as a select of several options or references keep it (one text a list of one) */
const listOf = (value: Value): string[] => (Array.isArray(value) ? [...value] : [textOf(value)]);

/** A value read as a day, with or without its time */
const momentOf = (value: Value) => (typeof value === "string" ? readMoment(value) : undefined);

/** A key's values (by the items' index) read, its property (`key`, `label`) and the values as its type keeps them */
export function inferProperty(key: string, label: string, read: ReadonlyMap<number, ReadValue>): Inferred {
  const entries = [...read];
  const property = (type: string, params?: Readonly<Record<string, unknown>>): ConvertedProperty => ({ key, label, type, ...(params ? { params } : {}) });
  const made = (type: ConvertedProperty, value: (one: ReadValue) => Value): Inferred => ({ property: type, values: new Map(entries.map(([at, one]) => [at, value(one)])) });
  if (!entries.length) return made(property("text"), plainOf);
  const people = entries.flatMap(([, one]) => (one.kind === "people" ? [one.names] : []));
  if (people.length === entries.length) {
    const multiple = people.some((names) => names.length > 1);
    return made(property("person", { options: [...new Set(people.flat())], multiple, anyone: true }), (one) => {
      const names = one.kind === "people" ? one.names : [];
      return multiple ? [...names] : (names[0] ?? null);
    });
  }
  if (entries.every(([, one]) => one.kind === "links")) return made(property("reference"), (one) => (one.kind === "links" ? linksOf(one.targets) : null));
  const plain = entries.map(([, one]) => plainOf(one));
  // Days, a time to any: a date and time (which reads a day alone too)
  const moments = plain.map(momentOf);
  if (moments.every(Boolean) && moments.some((one) => one!.time !== undefined)) return made(property("datetime"), plainOf);
  const guessed = guessedType(plain);
  if (guessed.type === "reference") return made(property("reference"), (one) => listOf(plainOf(one)));
  // Several values in any item (one in others too): a select of several options (values kept loose read so a text)
  if (plain.some(Array.isArray) && plain.every((one) => Array.isArray(one) || typeof one === "string" || typeof one === "number"))
    return made(property("select", { multiple: true, options: optionsOfValues(plain) }), (one) => listOf(plainOf(one)));
  if (guessed.type === "text") return made(property("text"), (one) => textOf(plainOf(one)));
  return made(property(guessed.type, guessed.params), plainOf);
}
