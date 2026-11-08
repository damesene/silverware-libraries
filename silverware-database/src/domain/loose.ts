// Keys items keep that the schema has none of (a property removed with its
// values kept, a key typed by hand or another tool's), shown so as to be
// added again or taken off the items: what type their values look like, a
// property's label from a key.
import { isEmpty, type Value } from "../model/database.ts";
import { readReferences } from "./types/reference.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/\S+$/;

/**
 * The type a key's values look like, of those offered for a property of the
 * user's: every value logical a checkbox, a number a number, a date as ISO a
 * date, a web address a URL, links to pages references, a list of texts a
 * multi-select; else a text
 */
export function guessedType(values: readonly Value[]): string {
  const given = values.filter((one) => !isEmpty(one));
  if (!given.length) return "text";
  if (given.every((one) => readReferences(one) !== undefined)) return "reference";
  if (given.every(Array.isArray)) return "multi-select";
  // (Lists among values of one: a text, nothing of them refused)
  if (given.some(Array.isArray)) return "text";
  const every = (test: (one: Value) => boolean) => given.every(test);
  if (every((one) => typeof one === "boolean")) return "checkbox";
  if (every((one) => typeof one === "number")) return "number";
  if (every((one) => typeof one === "string" && DATE_RE.test(one))) return "date";
  if (every((one) => typeof one === "string" && URL_RE.test(one))) return "url";
  return "text";
}

/** The values as a select's options: each text once, a list's each, in the order met */
export function optionsOfValues(values: readonly Value[]): string[] {
  return [...new Set(values.flatMap((one) => (Array.isArray(one) ? one : isEmpty(one) ? [] : [String(one)])))];
}

/** A property's label from its key: words by `_` and `-`, the first capitalized (`due_date` "Due date") */
export function labelOfKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : key;
}
