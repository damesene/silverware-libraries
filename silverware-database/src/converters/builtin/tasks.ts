// Tasks to a database (docs/silverware-database-converters.md, *Decided*): each
// task at the selection's top level an item; what is under it (subtasks of any
// depth, other lines) its body. Its name the task's text (its lines going on
// without a blank line too, as SilverBullet names a task), its marks in a
// sentence kept as words, those at its end and its attributes left out;
// Status (always Todo, In progress, Done) from an attribute `state`/`status`,
// else its checkbox (`[ ]` Todo, `[x]` Done) or its state of its own, whatever
// the case; each other attribute a property of its key (its type from its
// values), mentions People, wiki links Links, hashtags the page's tags; shown
// first on a board by Status. Read as SilverBullet reads markdown, through
// the blocks every converter is given (shared/markdown/blocks.ts `readBlocks`);
// tasks in fenced code are none.
import { escapedAttributes, hashtagOf, type InlineMark, inlineMarks } from "../../../../shared/markdown/inline.ts";
import { type Block, dedentedLines, readBlocks } from "../../../../shared/markdown/blocks.ts";
import { indentWidth } from "../../../../shared/markdown/lines.ts";
import { readAttributeValue, writeAttribute, writeTaskLine } from "../../../../shared/markdown/task.ts";
import type { Converted, ConvertedItem, ConvertedProperty, ConverterDefinition } from "../../core/converter.ts";
import { keyFromLabel } from "../../domain/keys.ts";
import { labelOfKey } from "../../domain/loose.ts";
import type { Item, Property, Value } from "../../model/database.ts";
import { inferProperty, type ReadValue } from "../infer.ts";
import { joinedValues, plainText, readValue } from "../values.ts";

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

type TaskItem = Extract<Block, { kind: "item" }> & { readonly task: { readonly state: string; readonly done: boolean } };

/** A task of the text's top level, and its body: the lines under it and those after it up to the next task, dedented */
type Read = { readonly task: TaskItem; readonly body: string };

/**
 * The tasks at the top level of a text (`readBlocks`), each with what is under it and what follows it up to the next
 * task (any markdown, a heading's lines too): a task inside another is the other's, and so is one indented more than
 * the task before it (`- [ ] A`, `text`, `  - [ ] B`: B is A's, as the line between is A's text going on); one under
 * a heading or a list's item that is no task (nothing before it) one of the top level; what is before the first task is
 * none's; a task under a list's item that is no task, after a task, the task's body as the item is
 */
function topTasks(text: string): Read[] {
  const lines = text.split(/\r?\n/);
  const found: { task: TaskItem; to: number }[] = [];
  const indentOf = (block: Block) => indentWidth(lines[block.lines.from]!);
  const visit = (blocks: readonly Block[]) => {
    for (const block of blocks) {
      const current = found.at(-1);
      if (block.kind === "item" && block.task && !(current && indentOf(block) > indentOf(current.task))) found.push({ task: block as TaskItem, to: block.lines.to });
      else if (block.kind === "heading") {
        // (Its own lines the task's before it, a setext heading's underline too; its section read on, a task in it one of its own)
        if (current) current.to = block.title.to;
        visit(block.children);
      } else if (current) current.to = block.lines.to;
      else if (block.kind === "item") visit(block.children);
    }
  };
  visit(readBlocks(text));
  return found.map(({ task, to }) => ({ task, body: dedentedLines(lines.slice(task.title.to, to)).join("\n") }));
}

/** A task's name: its text made plain (`plainText`), cut at a word */
function nameOf(text: string): string {
  const name = plainText(text);
  if (name.length <= NAME_LENGTH) return name;
  const cut = name.slice(0, NAME_LENGTH + 1);
  const space = cut.lastIndexOf(" ");
  return (space > NAME_LENGTH / 2 ? cut.slice(0, space) : name.slice(0, NAME_LENGTH)).trim();
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
  tasks.forEach(({ task, body }, at) => {
    const marks = inlineMarks(task.text);
    const values: Record<string, Value> = { [STATUS]: stateOf(task.task, marks, states) };
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
      byItem.set(at, was ? joinedValues(was, value) : value);
    }
    items.push({ name: nameOf(task.text), values, ...(body ? { body } : {}), ...(tags.length ? { tags } : {}), source: escapedAttributes(task.text.trim()) });
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
function stateOf(task: { readonly state: string; readonly done: boolean }, marks: readonly InlineMark[], states: string[]): string {
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
 * `[ ]` with the attribute `status` (`[status: In progress]`: a task's own state, `- [In progress]`, is no task outside
 * SilverBullet, and an attribute `state` would be SilverBullet's task's own field, verified 2026-11-11; the user's
 * choice); People, Links and the page's Tags as marks after the name (a person no mention can name, a tag no hashtag
 * can: in an attribute, left out); every other property, but those the system gives, an attribute of its key (one
 * read as the status, `state` or `status`, with `_2` after it). The name's characters reading would take as syntax
 * are escaped
 */
function write(items: readonly Item[], properties: readonly Property[]): string {
  const status = properties.find((one) => one.key === STATUS && one.type === "select");
  // (A checkbox `done` ticks a task only where there is no Status: in a database converted, it is an attribute's)
  const done = status ? undefined : properties.find((one) => one.key === "done" && one.type === "checkbox");
  const lines = items.map((item) => {
    const stated = status && typeof item.values[STATUS] === "string" && item.values[STATUS] ? (item.values[STATUS] as string) : undefined;
    const finished = (done !== undefined && item.values[done.key] === true) || (stated !== undefined && sameState(stated, DONE_STATE));
    const other = stated !== undefined && !finished && !sameState(stated, TODO_STATE) ? stated : undefined;
    const parts = [item.name.replace(/\s+/g, " ").trim().replace(SYNTAX_RE, (c) => `\\${c}`)];
    if (other !== undefined) parts.push(writeAttribute(STATUS, other));
    for (const property of properties) {
      if (property === done || property === status) continue;
      const value = item.values[property.key];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) continue;
      // (A key read as the status, `state` or `status` of another type, would take its place: written with `_2`)
      const key = /^(state|status)$/i.test(property.key) ? `${property.key}_2` : property.key;
      if (property.system === "tags") parts.push(...texts(value).filter((tag) => !/[>\n]/.test(tag)).map(hashtagOf));
      else if (property.system !== undefined) continue;
      else if (property.key === LINKS && property.type === "reference") parts.push(...linksOf(value));
      else if (property.type === "reference") parts.push(`[${key}: ${linksOf(value).join(", ")}]`);
      else if (property.type === "person") {
        const names = texts(value);
        const marked = property.key === PEOPLE ? names.filter((name) => markOf(`@${name}`, "mention")) : [];
        const others = names.filter((name) => !marked.includes(name));
        parts.push(...marked.map((name) => `@${name}`));
        if (others.length) parts.push(writeAttribute(key, Array.isArray(value) ? others.map((name) => `@${name}`) : `@${others[0]}`));
      } else parts.push(writeAttribute(key, value));
    }
    return writeTaskLine(finished ? "x" : " ", parts.filter(Boolean).join(" "));
  });
  return lines.length ? `${lines.join("\n")}\n` : "";
}

// (Frozen: a user's converter is given it, HELPERS.tasks, to build on, never to change for every converter)
export const TASKS_CONVERTER: ConverterDefinition = Object.freeze({
  name: "tasks",
  label: "Tasks",
  description: "A list of tasks: each task an item, its attributes, mentions, links and tags its properties",
  read,
  write,
});
