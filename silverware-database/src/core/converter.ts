// What a converter is and what it gives: text selected in a page read as a
// database's items, with the properties they need
// (docs/silverware-database-converters.md). The built-in converters
// (converters/builtin/) and the user's (`silverware.database.defineConverters`)
// are written against this alike, importing only types from the core. A
// converter reads; what is made of what it read (a new database now, items
// added to one later) is the core's, so a converter knows no database.
import type { Params, Value } from "../model/database.ts";
import { DefinitionRegistry } from "./registry.ts";

/** A property the items read need: its key (what their values are under), label, type and the type's settings */
export type ConvertedProperty = { readonly key: string; readonly label: string; readonly type: string; readonly params?: Params; readonly system?: string };

/**
 * An item read: its name, its values by property key, its body (markdown), the tags of the document it is kept in; its
 * `source`, the text it was read from, is put at the top of its body where its name (as kept) is not that text
 */
export type ConvertedItem = { readonly name: string; readonly values?: Readonly<Record<string, Value>>; readonly body?: string; readonly tags?: readonly string[]; readonly source?: string };

/** What a converter read of a text: the properties and the items, in the text's order */
export type Converted = { readonly properties: readonly ConvertedProperty[]; readonly items: readonly ConvertedItem[] };

export type ConverterDefinition = {
  // Lower case letters, digits and -, starting with a letter
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  /** The items of a text (the lines selected, whole); none where it holds none this converter reads */
  read(text: string): Converted | undefined;
};

const CONVERTER_NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Why a converter cannot be one, undefined where it can */
export function validateConverter(converter: ConverterDefinition): string | undefined {
  if (typeof converter?.name !== "string" || !CONVERTER_NAME_RE.test(converter.name)) return `"${String(converter?.name)}" is no converter's name: lower case letters, digits and -, starting with a letter`;
  if (typeof converter.label !== "string" || !converter.label.trim()) return `the converter "${converter.name}" has no label`;
  if (converter.description !== undefined && typeof converter.description !== "string") return `the converter "${converter.name}": its description is no text`;
  if (typeof converter.read !== "function") return `the converter "${converter.name}" has no read`;
  return undefined;
}

/** Why what a converter read is none (a user's converter giving something else), undefined where it is */
export function validateConverted(converted: unknown): string | undefined {
  const read = converted as Converted | undefined;
  if (typeof read !== "object" || read === null || !Array.isArray(read.properties) || !Array.isArray(read.items)) return "it gave no { properties, items }";
  const text = (value: unknown) => typeof value === "string";
  const maybe = (value: unknown, test: (value: unknown) => boolean) => value === undefined || test(value);
  const record = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value);
  for (const one of read.properties) {
    if (!record(one) || !text(one.key) || !text(one.label) || !text(one.type) || !maybe(one.params, record) || !maybe(one.system, text)) return `a property is no { key, label, type, params }: ${JSON.stringify(one)}`;
  }
  for (const one of read.items) {
    const tags = (value: unknown) => Array.isArray(value) && value.every(text);
    if (!record(one) || !text(one.name) || !maybe(one.values, record) || !maybe(one.body, text) || !maybe(one.tags, tags) || !maybe(one.source, text)) return `an item is no { name, values, body, tags }: ${JSON.stringify(one)}`;
  }
  return undefined;
}

export class ConverterRegistry extends DefinitionRegistry<ConverterDefinition> {
  constructor(builtIn: readonly ConverterDefinition[] = []) {
    super(builtIn, validateConverter, "converter");
  }
}
