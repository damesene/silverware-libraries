// Tasks to a database (docs/silverware-database-converters.md, *Decided*): each
// task at the selection's top level an item; what is under it (subtasks of any
// depth, other lines) its body. Its name the task's text, its marks in a
// sentence kept as words, those at its end and its attributes left out;
// Status (always Todo, In progress, Done) from an attribute `state`/`status`,
// else its checkbox (`[ ]` Todo, `[x]` Done) or its state of its own, whatever
// the case; each other attribute a property of its key (its type from its
// values), mentions People, wiki links Links, hashtags the page's tags; shown
// first on a board by Status. Read as SilverBullet reads markdown
// (shared/markdown/); tasks in fenced code are none.
import { hashtagOf, type InlineMark, inlineMarks } from "../../../../shared/markdown/inline.ts";
import { indentWidth, nextFence } from "../../../../shared/markdown/lines.ts";
import { readAttributeValue, readTaskLine, type TaskLine, validateTaskState, writeAttribute, writeTaskLine } from "../../../../shared/markdown/task.ts";
import type { Converted, ConvertedItem, ConvertedProperty, ConverterDefinition } from "../../core/converter.ts";
import { keyFromLabel } from "../../domain/keys.ts";
import { labelOfKey } from "../../domain/loose.ts";
import type { Item, Property, Value } from "../../model/database.ts";
import { inferProperty, type ReadValue } from "../infer.ts";

// An item's name: about this long at most, cut at a word
const NAME_LENGTH = 100;
// The properties of the task itself, before its attributes', each key its own
const STATUS = "status";
// Status's options always there, in their order (Done last; states of a text's own between): a task's checkbox read so
const TODO_STATE = "Todo";
const DONE_STATE = "Done";
const STATES = [TODO_STATE, "In progress", DONE_STATE];
const PEOPLE = "people";
const LINKS = "links";
// The system property showing a page's tags (domain/system.ts)
const TAGS = { key: "page_tags", label: "Tags", type: "tags", system: "tags" } as const;

/** A task of the text's top level, and the lines under it */
type Read = { readonly task: TaskLine; readonly under: string[] };

/** The tasks at the top level of a text, each with the lines under it (a line before the first task is no task's) */
function topTasks(text: string): Read[] {
  const read: Read[] = [];
  let fence: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const before = fence;
    fence = nextFence(line, fence);
    const task = before === undefined && fence === undefined ? readTaskLine(line) : undefined;
    const current = read.at(-1);
    if (task && (!current || indentWidth(task.indent) <= indentWidth(current.task.indent))) read.push({ task, under: [] });
    else current?.under.push(line);
  }
  return read;
}

/** Lines without their common indentation (a blank line empty, others' ends as written: a hard line break), blank lines at the ends taken off */
function dedented(lines: readonly string[]): string {
  const given = lines.filter((line) => line.trim());
  const common = given.length ? Math.min(...given.map((line) => /^[ \t]*/.exec(line)![0].length)) : 0;
  const out = lines.map((line) => (line.trim() ? line.slice(common) : ""));
  while (out.length && !out[0]) out.shift();
  while (out.length && !out.at(-1)) out.pop();
  return out.join("\n");
}

/** A mark as a word in a sentence: a tag's or a person's name, a link's alias or target */
function wordOf(mark: InlineMark): string {
  if (mark.kind === "link") return mark.alias ?? mark.name;
  return mark.name;
}

/** A task's name: its text without its attributes and the marks at its end, the others as words; cut at a word */
function nameOf(text: string, marks: readonly InlineMark[]): string {
  // Whether plain text (no mark) follows each mark: the marks with none after them are the text's end
  const plainAfter: boolean[] = [];
  let after = /\S/.test(text.slice(marks.at(-1)?.to ?? 0));
  for (let at = marks.length - 1; at >= 0; at--) {
    plainAfter[at] = after;
    if (/\S/.test(text.slice(marks[at - 1]?.to ?? 0, marks[at]!.from))) after = true;
  }
  let name = "";
  let at = 0;
  marks.forEach((mark, i) => {
    name += text.slice(at, mark.from);
    at = mark.to;
    if (mark.kind !== "attribute" && plainAfter[i]) name += wordOf(mark);
    else name += " ";
  });
  // (A character escaped, as `write` escapes what would read as syntax, is the character)
  name = (name + text.slice(at)).replace(/\\([\\[\]#@`$<])/g, "$1").replace(/\s+/g, " ").trim();
  // Marks alone (`[[Project X]]`, `@ada`): named by their words
  if (!name) name = marks.flatMap((mark) => (mark.kind === "attribute" ? [] : [wordOf(mark)])).join(" ");
  if (name.length <= NAME_LENGTH) return name;
  const cut = name.slice(0, NAME_LENGTH + 1);
  const space = cut.lastIndexOf(" ");
  return (space > NAME_LENGTH / 2 ? cut.slice(0, space) : name.slice(0, NAME_LENGTH)).trim();
}

/** An attribute's value read: people where it is mentions alone, links where wiki links alone, else YAML (a text where it is none) */
function readValue(written: string): ReadValue | undefined {
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

/** Two values of one key in one task: one list of both */
function joined(a: ReadValue, b: ReadValue): ReadValue {
  if (a.kind === "people" && b.kind === "people") return { kind: "people", names: [...new Set([...a.names, ...b.names])] };
  if (a.kind === "links" && b.kind === "links") return { kind: "links", targets: [...new Set([...a.targets, ...b.targets])] };
  const texts = (one: ReadValue): string[] => {
    if (one.kind === "people") return one.names.map((name) => `@${name}`);
    if (one.kind === "links") return one.targets.map((target) => `[[${target}]]`);
    return Array.isArray(one.value) ? [...one.value] : one.value === null ? [] : [String(one.value)];
  };
  return { kind: "plain", value: [...new Set([...texts(a), ...texts(b)])] };
}

/** The key of an attribute's property: from its name, none of the task's own nor another name's */
function attributeKey(name: string, keys: Map<string, string>): string {
  const known = keys.get(name);
  if (known) return known;
  const base = keyFromLabel(name);
  const taken = new Set([STATUS, PEOPLE, LINKS, TAGS.key, ...keys.values()]);
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
  keys.set(name, key);
  return key;
}

function read(text: string): Converted | undefined {
  const tasks = topTasks(text);
  if (!tasks.length) return undefined;
  const items: { name: string; values: Record<string, Value>; body?: string; tags?: string[]; source: string }[] = [];
  // Each attribute's values by the items' index, by key (in the order first met), and its label
  const attributes = new Map<string, Map<number, ReadValue>>();
  const labels = new Map<string, string>();
  const keys = new Map<string, string>();
  const states = [...STATES];
  let anyPeople = false;
  let anyLinks = false;
  let anyTags = false;
  tasks.forEach(({ task, under }, at) => {
    const marks = inlineMarks(task.text);
    const values: Record<string, Value> = { [STATUS]: stateOf(task, marks, states) };
    const people = [...new Set(marks.flatMap((mark) => (mark.kind === "mention" ? [mark.name] : [])))];
    const links = [...new Set(marks.flatMap((mark) => (mark.kind === "link" ? [mark.name] : [])))];
    const tags = [...new Set(marks.flatMap((mark) => (mark.kind === "tag" ? [mark.name] : [])))];
    if (people.length) values[PEOPLE] = people;
    if (links.length) values[LINKS] = links.map((one) => `[[${one}]]`);
    anyPeople ||= people.length > 0;
    anyLinks ||= links.length > 0;
    anyTags ||= tags.length > 0;
    for (const mark of marks) {
      if (mark.kind !== "attribute" || isStateAttribute(mark)) continue;
      const value = readValue(mark.value);
      if (!value) continue;
      const key = attributeKey(mark.name, keys);
      if (!labels.has(key)) labels.set(key, labelOfKey(mark.name));
      const byItem = attributes.get(key) ?? new Map<number, ReadValue>();
      attributes.set(key, byItem);
      const was = byItem.get(at);
      byItem.set(at, was ? joined(was, value) : value);
    }
    const body = dedented(under);
    items.push({ name: nameOf(task.text, marks), values, ...(body ? { body } : {}), ...(tags.length ? { tags } : {}), source: task.text.trim() });
  });
  // (Done last: the states of its own met between In progress and it)
  const options = [...states.filter((one) => one !== DONE_STATE), DONE_STATE];
  const properties: ConvertedProperty[] = [{ key: STATUS, label: "Status", type: "select", params: { options } }];
  for (const [key, byItem] of attributes) {
    const inferred = inferProperty(key, labels.get(key)!, byItem);
    properties.push(inferred.property);
    for (const [at, value] of inferred.values) items[at]!.values[key] = value;
  }
  if (anyPeople) {
    const names = [...new Set(items.flatMap((item) => (item.values[PEOPLE] as readonly string[] | undefined) ?? []))];
    properties.push({ key: PEOPLE, label: "People", type: "person", params: { options: names, multiple: true, anyone: true } });
  }
  if (anyLinks) properties.push({ key: LINKS, label: "Links", type: "reference" });
  if (anyTags) properties.push(TAGS);
  return { properties, items: items satisfies ConvertedItem[], view: { name: "board", groupBy: STATUS } };
}

/** Two states the same whatever their case and spaces (`in  Progress` is `In progress`) */
const sameState = (a: string, b: string) => a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();

/** Whether an attribute gives the task's state (`[state: …]`, `[status: …]`, whatever their case) */
const isStateAttribute = (mark: InlineMark) => mark.kind === "attribute" && /^(state|status)$/i.test(mark.name);

/**
 * A task's status: its attribute `state` or `status` where it has one (the last), else its checkbox (`[ ]` Todo, `[x]`
 * Done) or the state of its own; one of `states` whatever its case, else added to them as first written
 */
function stateOf(task: TaskLine, marks: readonly InlineMark[], states: string[]): string {
  const attribute = marks.filter(isStateAttribute).at(-1);
  const given = attribute?.kind === "attribute" ? readAttributeValue(attribute.value) : undefined;
  // (A value YAML reads as a scalar that; another, a list or a map or none it reads, as written; none: the checkbox)
  const scalar = given && "value" in given && given.value !== null && typeof given.value !== "object";
  const fromAttribute = attribute?.kind !== "attribute" ? "" : scalar ? String((given as { value: unknown }).value).trim() : attribute.value.trim();
  const written = fromAttribute || (task.done ? DONE_STATE : task.state.trim() || TODO_STATE);
  const known = states.find((one) => sameState(one, written));
  if (known) return known;
  const state = written.replace(/\s+/g, " ");
  states.push(state);
  return state;
}

/** A mark written after the text where it reads back as all of it (a mention, a hashtag), else none */
function markOf(written: string, kind: InlineMark["kind"]): string | undefined {
  const [mark] = inlineMarks(written);
  return mark?.kind === kind && mark.from === 0 && mark.to === written.length ? written : undefined;
}

const texts = (value: Value | undefined): string[] => (Array.isArray(value) ? [...value] : typeof value === "string" && value ? [value] : []);

// What a name holds that reading would take as a mark, an attribute, code or Space Lua: written escaped
const SYNTAX_RE = /[\\[\]#@`$<]/g;

/** Links as wiki links, each in [[ ]] once; one holding a bracket of its own left out (it would end its attribute) */
const linksOf = (value: Value): string[] =>
  texts(value)
    .map((one) => (/^\[\[[^[\]]*\]\]$/.test(one) ? one : `[[${one}]]`))
    .filter((one) => /^\[\[[^[\]]+\]\]$/.test(one));

/**
 * Items written back as tasks, as `read` reads them (lossy: a type, a property's settings and an item's text are no
 * part of a task): Status *Done* (or a checkbox `done` ticked, a database's of its own) `[x]`, *Todo* `[ ]`, another
 * the task's state (one a state cannot be: the attribute `status`, which reads back as the state); People, Links and
 * the page's Tags as marks after the name (a person no mention can name, a tag no hashtag can: in an attribute, left
 * out); every other property, but those the system gives, an attribute of its key. The name's characters reading
 * would take as syntax are escaped
 */
function write(items: readonly Item[], properties: readonly Property[]): string {
  const status = properties.find((one) => one.key === STATUS && one.type === "select");
  // (A checkbox `done` ticks a task only where there is no Status: in a database converted, it is an attribute's)
  const done = status ? undefined : properties.find((one) => one.key === "done" && one.type === "checkbox");
  const lines = items.map((item) => {
    const stated = status && typeof item.values[STATUS] === "string" && item.values[STATUS] ? (item.values[STATUS] as string) : undefined;
    const finished = (done !== undefined && item.values[done.key] === true) || (stated !== undefined && sameState(stated, DONE_STATE));
    const other = stated !== undefined && !finished && !sameState(stated, TODO_STATE) ? stated : undefined;
    // (`x` a state reads as done: a status so named, as one no state can be, an attribute)
    const asState = other !== undefined && !validateTaskState(other) && !/^[xX]$/.test(other.trim());
    const state = finished ? "x" : asState ? other : " ";
    const parts = [item.name.replace(/\s+/g, " ").trim().replace(SYNTAX_RE, (c) => `\\${c}`)];
    if (other !== undefined && !asState) parts.push(writeAttribute(STATUS, other));
    for (const property of properties) {
      if (property === done || property === status) continue;
      const value = item.values[property.key];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) continue;
      if (property.system === "tags") parts.push(...texts(value).filter((tag) => !/[>\n]/.test(tag)).map(hashtagOf));
      else if (property.system !== undefined) continue;
      else if (property.key === LINKS && property.type === "reference") parts.push(...linksOf(value));
      else if (property.type === "reference") parts.push(`[${property.key}: ${linksOf(value).join(", ")}]`);
      else if (property.type === "person") {
        const names = texts(value);
        const marked = property.key === PEOPLE ? names.filter((name) => markOf(`@${name}`, "mention")) : [];
        const others = names.filter((name) => !marked.includes(name));
        parts.push(...marked.map((name) => `@${name}`));
        if (others.length) parts.push(writeAttribute(property.key, Array.isArray(value) ? others.map((name) => `@${name}`) : `@${others[0]}`));
      } else parts.push(writeAttribute(property.key, value));
    }
    return writeTaskLine(state, parts.filter(Boolean).join(" "));
  });
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export const TASKS_CONVERTER: ConverterDefinition = {
  name: "tasks",
  label: "Tasks",
  description: "A list of tasks: each task an item, its attributes, mentions, links and tags its properties",
  read,
  write,
};
