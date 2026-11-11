// A converter's reading of text and values that is no kind of block's: a text
// made plain (its marks as words, those at its end and its attributes left
// out, as a task's name is made), a value as written read (people, links,
// YAML), two values of one key joined. What every converter may use (a
// module's HELPERS, converters/helpers.ts), the tasks converter too.
import { type InlineMark, inlineMarks } from "../../../shared/markdown/inline.ts";
import { readAttributeValue } from "../../../shared/markdown/task.ts";
import type { ReadValue } from "./infer.ts";

/** A mark as a word in a sentence: a tag's or a person's name, a link's alias or target */
function wordOf(mark: InlineMark): string {
  if (mark.kind === "link") return mark.alias ?? mark.name;
  return mark.name;
}

/**
 * A text made plain: its attributes and the marks at its end left out, the others (a hashtag, a mention, a link within
 * a sentence) as words, escaped characters as themselves, spaces collapsed; marks alone, their words
 */
export function plainText(text: string): string {
  const marks = inlineMarks(text);
  // Whether plain text (no mark) follows each mark: the marks with none after them are the text's end
  const plainAfter: boolean[] = [];
  let after = /\S/.test(text.slice(marks.at(-1)?.to ?? 0));
  for (let at = marks.length - 1; at >= 0; at--) {
    plainAfter[at] = after;
    if (/\S/.test(text.slice(marks[at - 1]?.to ?? 0, marks[at]!.from))) after = true;
  }
  let plain = "";
  let at = 0;
  marks.forEach((mark, i) => {
    plain += text.slice(at, mark.from);
    at = mark.to;
    plain += mark.kind !== "attribute" && plainAfter[i] ? wordOf(mark) : " ";
  });
  // (A character escaped, as a converter's `write` escapes what would read as syntax, is the character)
  plain = (plain + text.slice(at)).replace(/\\([\\[\]#@`$<])/g, "$1").replace(/\s+/g, " ").trim();
  return plain || marks.flatMap((mark) => (mark.kind === "attribute" ? [] : [wordOf(mark)])).join(" ");
}

/**
 * A value as written (an attribute's, a table's cell) read: people where it is mentions alone (or `"@name"`s), links
 * where wiki links alone, else YAML's value (a text where YAML reads none); none where it is empty
 */
export function readValue(written: string): ReadValue | undefined {
  const marks = inlineMarks(written);
  const rest = marks.reduceRight((text, mark) => text.slice(0, mark.from) + text.slice(mark.to), written);
  if (marks.length && !/[^\s,]/.test(rest)) {
    if (marks.every((mark) => mark.kind === "mention")) return { kind: "people", names: marks.map((mark) => mark.name) };
    if (marks.every((mark) => mark.kind === "link")) return { kind: "links", targets: marks.map((mark) => mark.name) };
  }
  const yaml = readAttributeValue(written);
  if ("problem" in yaml) return { kind: "plain", value: written.trim() };
  const value = yaml.value;
  if (value === null || value === "") return undefined;
  if (Array.isArray(value)) {
    const texts = value.flatMap((one) => (one === null ? [] : [typeof one === "object" ? JSON.stringify(one) : String(one)]));
    // A list of `@name`s: people
    if (texts.length && texts.every((one) => /^@\S/.test(one))) return { kind: "people", names: texts.map((one) => one.slice(1).trim()) };
    return { kind: "plain", value: texts };
  }
  if (typeof value === "object") return { kind: "plain", value: written.trim() };
  // A person quoted, as one is written back (`[owner: "@ada"]`, `"@Ada Lovelace"`)
  if (typeof value === "string" && /^@\S/.test(value)) return { kind: "people", names: [value.slice(1).trim()] };
  return { kind: "plain", value };
}

/** Two values of one key (in one item) as one: a list of both, each once */
export function joinedValues(a: ReadValue, b: ReadValue): ReadValue {
  if (a.kind === "people" && b.kind === "people") return { kind: "people", names: [...new Set([...a.names, ...b.names])] };
  if (a.kind === "links" && b.kind === "links") return { kind: "links", targets: [...new Set([...a.targets, ...b.targets])] };
  const texts = (one: ReadValue): string[] => {
    if (one.kind === "people") return one.names.map((name) => `@${name}`);
    if (one.kind === "links") return one.targets.map((target) => `[[${target}]]`);
    return Array.isArray(one.value) ? [...one.value] : one.value === null ? [] : [String(one.value)];
  };
  return { kind: "plain", value: [...new Set([...texts(a), ...texts(b)])] };
}
