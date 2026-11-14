// The page writer's parts: each one form in a page's content, its kinds of
// change, what a plugin asks of it (its section of the builder, `p.properties`,
// `p.tags`) and how that is written in the text. The builder (changes.ts)
// makes its sections and the writer (writer.ts) writes the changes by this
// registry alone, so a part is added here, its types included, and nowhere
// else. Built in only for now (decided 2026-11-07); another plugin's part
// would be registered the same way, its types added to `PageChange` and
// `PageSections` (TypeScript's interface merging for the latter).
import { validateAttributeName, writeAttributes } from "../markdown/attributes.ts";
import { embedAsLink, type EmbedChanges, linkAsEmbed, readEmbeds, readLinks, writeEmbed } from "../markdown/embed.ts";
import { readGrids } from "../markdown/grid.ts";
import { blocksIn, type GridMode, gridOfBlocks, ungridded } from "../markdown/gridbuild.ts";
import { codeBlocksOf, sameBody } from "./blocks.ts";
import type { PageBuilder } from "./changes.ts";
import { type FrontmatterValue, readFrontmatter, readKey, validateFrontmatterKey, writeKey } from "./frontmatter.ts";
import { addPageTags, applyEdits, type EditResult, removeTags, type RemoveHow, renameTags } from "./tags/edit.ts";
import type { FrontmatterForm } from "./tags/frontmatter.ts";
import { isWithin, matches, renamedTag } from "./tags/names.ts";
import type { TagContext } from "./tags/scan.ts";
import { readScalar } from "../yaml/scalar.ts";
import { emptyMap, isYamlMap, readYamlMap, validateYamlValue, writeYamlEntry, type YamlMap, type YamlValue } from "../yaml/tree.ts";

/** A property's value: a scalar, a list, or a map (a plugin's own data, `_database`), nested as deep as needed */
export type PropertyValue = YamlValue;

/** Where a property is: its key, or the keys down to it in maps (`["_database", "rank"]`) */
export type PropertyPath = string | readonly string[];

/** Where tags are taken off a page: its own tags (SilverBullet's page tags), the hashtags in its body, or both */
export type TagsFrom = "pageTags" | "body" | "both";

export type TagsRemoval = {
  // With the tags under each (`project` takes `project/alpha` too)
  readonly subtags?: boolean;
  readonly from?: TagsFrom;
  // A hashtag in the body leaves its word, only the # going (`#<two words>`: two words)
  readonly keepWord?: boolean;
};

/** One change of a page's content, of a kind a part below writes */
export type PageChange =
  | { readonly kind: "setProperty"; readonly path: readonly string[]; readonly value: PropertyValue }
  | { readonly kind: "removeProperty"; readonly path: readonly string[] }
  | { readonly kind: "renameTags"; readonly tags: readonly string[]; readonly into: string; readonly subtags: boolean }
  | { readonly kind: "removeTags"; readonly tags: readonly string[]; readonly subtags: boolean; readonly from: TagsFrom; readonly keepWord: boolean }
  | { readonly kind: "addTags"; readonly tags: readonly string[] }
  // A user's script editing the text itself (Silverware Tags' custom operations): the one way past the model
  | { readonly kind: "editText"; readonly edit: (text: string) => EditResult | Promise<EditResult> }
  // The body, all after the frontmatter (a database item's); `was`: written only where it is still that
  | { readonly kind: "setBody"; readonly text: string; readonly was?: string }
  // A fenced code block of a language and body (the `occurrence`-th of those alike, counted from 0) written anew
  | { readonly kind: "replaceCodeBlock"; readonly language: string; readonly body: string; readonly occurrence: number; readonly of?: number; readonly text: string }
  // Such a block taken out of the page whole, its fences with it
  | { readonly kind: "removeCodeBlock"; readonly language: string; readonly body: string; readonly occurrence: number; readonly of?: number }
  // A cell of a grid (Silverware Layout's columns, shared/markdown/grid.ts) given new content: the grid of that body
  // (the `occurrence`-th of those alike), its `cell`-th cell counted from 0
  | { readonly kind: "replaceGridCell"; readonly body: string; readonly occurrence: number; readonly of?: number; readonly cell: number; readonly content: string }
  // A grid's `<grid>` line given attributes (a value set, or null: taken off), the others on it kept
  | { readonly kind: "setGridAttributes"; readonly body: string; readonly occurrence: number; readonly of?: number; readonly attributes: Readonly<Record<string, string | null>> }
  | { readonly kind: "changeGridCells"; readonly body: string; readonly occurrence: number; readonly of?: number; readonly cells: GridCellsChange }
  | { readonly kind: "putIntoGrid"; readonly from: number; readonly to: number; readonly was: string; readonly mode: GridMode; readonly columns: number }
  // An embed (shared/markdown/embed.ts) given an alt text, a size or metadata: the embed of that text (the
  // `occurrence`-th of those alike), written in its own style
  | { readonly kind: "setEmbed"; readonly text: string; readonly occurrence: number; readonly of?: number; readonly changes: EmbedChanges }
  | { readonly kind: "embedToLink"; readonly text: string; readonly occurrence: number; readonly of?: number }
  | { readonly kind: "linkToEmbed"; readonly text: string; readonly occurrence: number; readonly of?: number };

/** The builder's sections, one per part of a page's content (their parts below make them); every method gives the page's builder back */
export interface PageSections {
  readonly properties: {
    /** A property's value, at its key or down a path of keys in maps (the maps on the way made where missing) */
    set(path: PropertyPath, value: PropertyValue): PageBuilder;
    /** A property taken off (a map left empty by it stays) */
    remove(path: PropertyPath): PageBuilder;
  };
  readonly tags: {
    /** A tag renamed everywhere on the page (the page's own tags and its body); into a name it has, the two merge */
    rename(from: string, to: string, options?: { readonly subtags?: boolean }): PageBuilder;
    /** Several tags renamed into one */
    merge(tags: readonly string[], into: string, options?: { readonly subtags?: boolean }): PageBuilder;
    /** Tags taken off (by default from everywhere, the hashtag taken out of the body whole) */
    remove(tags: string | readonly string[], options?: TagsRemoval): PageBuilder;
    /** Tags given to the page as its own, those it has left out */
    add(tags: string | readonly string[]): PageBuilder;
  };
  readonly codeBlocks: {
    /**
     * A fenced code block's text written anew: the block of `language` whose
     * text is `body` (as the plugin read it), the `occurrence`-th of those alike
     * (two blocks showing the same, counted from 0 in the page's order); none
     * so: the page left alone (the block changed since it was read); `of`: how
     * many alike the plugin counted (another made since: left alone too)
     */
    replace(language: string, body: string, text: string, where?: { readonly occurrence?: number; readonly of?: number }): PageBuilder;
    /**
     * Such a block taken out of the page whole (its fences and its line breaks;
     * a blank line on both sides of it left as one), found as `replace` finds
     * it: none so, the page left alone
     */
    remove(language: string, body: string, where?: { readonly occurrence?: number; readonly of?: number }): PageBuilder;
  };
  readonly grids: {
    /**
     * A grid's cell given new content (its markdown, written with a blank
     * line before and after it, so other renderers read it as markdown): the
     * grid whose body is `body` (as the plugin read it, shared/markdown/grid.ts),
     * the `occurrence`-th of those alike, its `cell`-th cell; none so (the grid
     * or the cell changed since it was read): the page left alone
     */
    replaceCell(body: string, cell: number, content: string, where?: { readonly occurrence?: number; readonly of?: number }): PageBuilder;
    /**
     * A grid's attributes set on its `<grid>` line (a value, or null: taken off; the others on it kept, the line
     * written in HTML's form), the grid found as `replaceCell` finds it
     */
    setAttributes(body: string, attributes: Readonly<Record<string, string | null>>, where?: { readonly occurrence?: number; readonly of?: number }): PageBuilder;
    /**
     * A grid's cells changed (found as `replaceCell` finds it): one moved by a step, an empty one added after one (none:
     * at the end), one taken out (its content put under the grid), or all taken apart (`ungrid`: the cells one under
     * another in their order, the grid gone); the cells written again in the form a cell is written, its attributes kept
     */
    changeCells(body: string, cells: GridCellsChange, where?: { readonly occurrence?: number; readonly of?: number }): PageBuilder;
    /**
     * The blocks of a range put into a grid by a mode (shared/markdown/gridbuild.ts): `gallery` a cell each, `columns`
     * to a row; `split` in order, cut into `columns` cells by their number. The range as the plugin read it (`was`):
     * one changed since is left alone
     */
    put(from: number, to: number, was: string, mode: GridMode, columns: number): PageBuilder;
  };
  readonly embeds: {
    /**
     * An embed given an alt text, a size or metadata (each a value, or null: taken off), written in its own style
     * with SilverBullet's size in its alias and the metadata in a third segment (shared/markdown/embed.ts): the embed
     * whose text is `text` (as the plugin read it), the `occurrence`-th of those alike; none so: the page left alone
     */
    set(text: string, changes: EmbedChanges, where?: { readonly occurrence?: number; readonly of?: number }): PageBuilder;
    /** An embed written as a link to its target (its alt text the link's, its size and metadata left out), found as `set` finds it */
    toLink(text: string, where?: { readonly occurrence?: number; readonly of?: number }): PageBuilder;
  };
  readonly links: {
    /** A link written as an embed of its target (`[[a.pdf]]`: `![[a.pdf]]`): the link whose text is `text`, the `occurrence`-th of those alike */
    toEmbed(text: string, where?: { readonly occurrence?: number; readonly of?: number }): PageBuilder;
  };
}

/** What a grid's cells get (`changeCells`) */
export type GridCellsChange =
  | { readonly kind: "move"; readonly cell: number; readonly by: -1 | 1 }
  | { readonly kind: "add"; readonly after?: number }
  | { readonly kind: "takeOut"; readonly cell: number }
  | { readonly kind: "ungrid" };

export type WriterOptions = {
  // How a page's tags are written where it has none yet
  readonly newTagsForm?: FrontmatterForm;
};

type Kind = PageChange["kind"];
type ChangeOf<K extends Kind> = Extract<PageChange, { kind: K }>;

/** A part: the kinds of change it writes, how, and the builder's section that makes them (none: a page's own method) */
export type Part = {
  readonly kinds: readonly Kind[];
  readonly section?: { readonly name: keyof PageSections; readonly make: (add: (change: PageChange) => PageBuilder) => unknown };
  readonly write: (text: string, change: PageChange, options: WriterOptions) => EditResult | Promise<EditResult>;
};

/** A part made with its types checked: its section gives only its kinds, its write gets only them */
function part<K extends Kind, N extends keyof PageSections>(definition: {
  readonly kinds: readonly K[];
  readonly section?: { readonly name: N; readonly make: (add: (change: ChangeOf<K>) => PageBuilder) => PageSections[N] };
  readonly write: (text: string, change: ChangeOf<K>, options: WriterOptions) => EditResult | Promise<EditResult>;
}): Part {
  return definition as unknown as Part;
}

const list = (tags: string | readonly string[]) => (typeof tags === "string" ? [tags] : [...tags]);
const pathOf = (path: PropertyPath): readonly string[] => (typeof path === "string" ? [path] : [...path]);

/** The line break a page's text uses (a page of none: "\n") */
const lineBreakOf = (text: string) => (text.includes("\r\n") ? "\r\n" : "\n");

/**
 * A property's change: a key of scalars or a list written in the page's
 * frontmatter in the form it has; a map, or a key down a path, in the forms
 * yamltree.ts reads and writes (a key written otherwise left alone, said why)
 */
function propertyEdit(text: string, path: readonly string[], value: PropertyValue | undefined): EditResult {
  const [key] = path;
  const problem =
    key === undefined || path.some((one) => !one)
      ? "a property's path is empty"
      : (validateFrontmatterKey(key) ?? (key === "tags" ? "tags are no property: change them as tags" : undefined) ?? (value === undefined ? undefined : validateYamlValue(value)));
  if (problem) return { text, changes: 0, problem };
  const frontmatter = readFrontmatter(text);
  // A key of its own set to a scalar or a list, or taken off: in the page's own form, or left alone where that is not read
  // (a map typed by hand there is never replaced by a value meant for a plain key)
  if (path.length === 1 && !isYamlMap(value) && !(Array.isArray(value) && value.some((item) => typeof item === "object" && item !== null))) {
    const { entry, unreadable } = readKey(text, frontmatter, key!);
    // (A key taken off whole may be a map: the nested route reads it, or says why it cannot)
    if (unreadable && value === undefined) return nestedEdit(text, frontmatter, path, value);
    if (unreadable) return { text, changes: 0, problem: `${unreadable}: left alone` };
    const edit = writeKey(text, frontmatter, key!, entry, value as FrontmatterValue | undefined);
    return edit ? { text: applyEdits(text, [edit]), changes: 1 } : { text, changes: 0 };
  }
  return nestedEdit(text, frontmatter, path, value);
}

/** A top-level key's lines: from its line to the last line indented under it; `twice`: the key has a second block */
function keyBlock(text: string, yaml: { readonly from: number; readonly to: number }, key: string): { readonly from: number; readonly to: number; readonly twice?: true } | undefined {
  const head = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*:`);
  let from: number | undefined;
  let to = 0;
  for (let at = yaml.from; at < yaml.to; ) {
    const nl = text.indexOf("\n", at);
    const end = nl < 0 || nl >= yaml.to ? yaml.to : nl + 1;
    const line = text.slice(at, end).replace(/\r?\n$/, "");
    if (from === undefined) {
      if (head.test(line)) [from, to] = [at, end];
    } else if ((/^\s/.test(line) && line.trim()) || /^-(\s|$)/.test(line)) to = end;
    else if (line.trim() && !/^#/.test(line)) {
      // The rest of the frontmatter searched for the key again: one block edited and another left would read otherwise
      if (yamlLines(text, end, yaml.to).some((rest) => head.test(rest))) return { from, to, twice: true };
      if (head.test(line)) return { from, to, twice: true };
      break;
    }
    at = end;
  }
  return from === undefined ? undefined : { from, to };
}

function yamlLines(text: string, from: number, to: number): string[] {
  return text.slice(from, to).split(/\r?\n/);
}

/** Whether a top-level key of the frontmatter is the key written another way (in quotes) */
function twinKey(text: string, yaml: { readonly from: number; readonly to: number }, key: string): boolean {
  return text
    .slice(yaml.from, yaml.to)
    .split(/\r?\n/)
    .some((line) => {
      const quotedKey = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')\s*:/.exec(line);
      if (!quotedKey) return false;
      // A key in quotes that does not read: taken for the key (refused rather than written beside it)
      return (readScalar(quotedKey[1]!)?.text ?? key) === key;
    });
}

/** A map with `value` set down `path` (undefined: taken off), the maps on the way made; or why not (a value on the way that is no map) */
function setIn(map: YamlMap, path: readonly string[], value: PropertyValue | undefined): YamlMap | string {
  const [key, ...rest] = path;
  const copy = Object.assign(emptyMap(), map);
  if (!rest.length) {
    if (value === undefined) delete copy[key!];
    else copy[key!] = value;
    return copy;
  }
  const inner = Object.hasOwn(copy, key!) ? copy[key!] : undefined;
  if (inner !== undefined && inner !== null && !isYamlMap(inner)) return `"${key}" holds no map`;
  if ((inner === undefined || inner === null) && value === undefined) return copy;
  const set = setIn(isYamlMap(inner) ? inner : emptyMap(), rest, value);
  if (typeof set === "string") return set;
  copy[key!] = set;
  return copy;
}

function nestedEdit(text: string, frontmatter: ReturnType<typeof readFrontmatter>, path: readonly string[], value: PropertyValue | undefined): EditResult {
  const [key] = path as [string, ...string[]];
  const { range, yaml } = frontmatter;
  // The key written another way (in quotes) too: a second block of it would make the frontmatter read otherwise
  if (yaml && twinKey(text, yaml, key)) return { text, changes: 0, problem: `its frontmatter's ${key} is written in quotes: left alone` };
  const block = yaml && keyBlock(text, yaml, key);
  if (block?.twice) return { text, changes: 0, problem: `its frontmatter has ${key} twice: left alone` };
  let now: YamlMap = emptyMap();
  if (block) {
    const read = readYamlMap(text.slice(block.from, block.to));
    if ("problem" in read) return { text, changes: 0, problem: `its frontmatter's ${key} is written in a form not read here (${read.problem}): left alone` };
    now = read.value as YamlMap;
  }
  const set = setIn(now, path, value);
  if (typeof set === "string") return { text, changes: 0, problem: `its frontmatter's ${path.join(".")}: ${set}: left alone` };
  // Nothing changed: the block left as written, its comments with it
  if (JSON.stringify(set) === JSON.stringify(now)) return { text, changes: 0 };
  const after = Object.hasOwn(set, key) ? set[key] : undefined;
  let entry: string;
  try {
    entry = after === undefined ? "" : writeYamlEntry(key, after);
  } catch (error) {
    return { text, changes: 0, problem: `its frontmatter's ${path.join(".")}: ${error instanceof Error ? error.message : String(error)}` };
  }
  // In the line breaks the page has, the fences too
  const nl = lineBreakOf(text);
  entry = entry.replace(/\n/g, nl);
  let edit: { from: number; to: number; insert: string } | undefined;
  if (!range || !yaml) edit = entry ? { from: 0, to: 0, insert: `---${nl}${entry}---${nl}` } : undefined;
  else if (!block) edit = entry ? { from: yaml.to, to: yaml.to, insert: (yaml.to > yaml.from && text[yaml.to - 1] !== "\n" ? nl : "") + entry } : undefined;
  else if (!entry && !(text.slice(yaml.from, block.from) + text.slice(block.to, yaml.to)).trim()) edit = { from: range.from, to: range.to, insert: "" };
  else edit = { from: block.from, to: block.to, insert: entry };
  if (!edit || text.slice(edit.from, edit.to) === edit.insert) return { text, changes: 0 };
  return { text: applyEdits(text, [edit]), changes: 1 };
}

/**
 * A name renamed by a merge of `tags` into `into`: the first tag it is (or,
 * with subtags, is under) gives it its new name; tags under `into` where
 * `into` is under one of them stay as they are (`a` into `a/x`: `a/x/y` is
 * not moved on to `a/x/x/y`)
 */
function renamedBy(tags: readonly string[], into: string, subtags: boolean): (name: string) => string | undefined {
  return (name) => {
    for (const from of tags) {
      if (from === into) continue;
      if (isWithin(into, from) && isWithin(name, into)) return undefined;
      const to = renamedTag(name, from, into, subtags);
      if (to !== undefined) return to;
    }
    return undefined;
  };
}

// The hashtags of a page's body (every context but its own tags' lines)
const BODY: ReadonlySet<TagContext> = new Set(["paragraph", "item", "task", "table", "heading"]);

const removeHow = (from: TagsFrom, keepWord: boolean): RemoveHow =>
  from === "body" ? { frontmatter: false, contexts: BODY, keepWord } : from === "pageTags" ? { contexts: new Set<TagContext>(["page"]) } : { keepWord };

export const PARTS: readonly Part[] = [
  part({
    kinds: ["setProperty", "removeProperty"],
    section: {
      name: "properties",
      make: (add) => ({
        set: (path, value) => add({ kind: "setProperty", path: pathOf(path), value: structuredClone(value) }),
        remove: (path) => add({ kind: "removeProperty", path: pathOf(path) }),
      }),
    },
    write: (text, change) => propertyEdit(text, change.path, change.kind === "setProperty" ? change.value : undefined),
  }),
  part({
    kinds: ["renameTags", "removeTags", "addTags"],
    section: {
      name: "tags",
      make: (add) => ({
        rename: (from, to, options) => add({ kind: "renameTags", tags: [from], into: to, subtags: options?.subtags ?? false }),
        merge: (tags, into, options) => add({ kind: "renameTags", tags: [...tags], into, subtags: options?.subtags ?? false }),
        remove: (tags, options) =>
          add({ kind: "removeTags", tags: list(tags), subtags: options?.subtags ?? false, from: options?.from ?? "both", keepWord: options?.keepWord ?? false }),
        add: (tags) => add({ kind: "addTags", tags: list(tags) }),
      }),
    },
    write: (text, change, options) =>
      change.kind === "renameTags"
        ? renameTags(text, renamedBy(change.tags, change.into, change.subtags))
        : change.kind === "removeTags"
          ? removeTags(text, (name) => change.tags.some((tag) => matches(name, tag, change.subtags)), removeHow(change.from, change.keepWord))
          : addPageTags(text, change.tags, options.newTagsForm ?? "flow"),
  }),
  // A user's script editing the text itself: the page builder's own `editText`, no section
  part({ kinds: ["editText"], write: (text, change) => change.edit(text) }),
  part({
    kinds: ["replaceCodeBlock", "removeCodeBlock"],
    section: {
      name: "codeBlocks",
      make: (add) => ({
        replace: (language, body, text, where = {}) => add({ kind: "replaceCodeBlock", language, body, text, occurrence: where.occurrence ?? 0, ...(where.of === undefined ? {} : { of: where.of }) }),
        remove: (language, body, where = {}) => add({ kind: "removeCodeBlock", language, body, occurrence: where.occurrence ?? 0, ...(where.of === undefined ? {} : { of: where.of }) }),
      }),
    },
    write: (text, change) => {
      const alike = codeBlocksOf(text).filter((block) => block.language === change.language && sameBody(block.body) === sameBody(change.body));
      const block = alike[change.occurrence];
      if (!block || (change.of !== undefined && alike.length !== change.of)) return { text, changes: 0, problem: `its ${change.language} block changed since it was read: left alone` };
      // A block indented (in a list item) has its lines indented: a line written without it would end the item and leave the fence open
      if (block.indent) return { text, changes: 0, problem: `its ${change.language} block is indented (in a list item): it is written by hand only` };
      if (change.kind === "removeCodeBlock") return { text: withoutBlock(text, block.from, block.to), changes: 1 };
      const nl = lineBreakOf(text);
      const body = sameBody(change.text).replace(/\n/g, nl);
      // A block's text ends before the line break of its closing fence (its CR kept); an empty block has none, so a text
      // written into one brings its own
      const region = text.slice(block.bodyFrom, block.bodyTo);
      // (An opening fence at the text's very end has no line break of its own: one goes before the text)
      const atEnd = block.bodyFrom === text.length && !text.endsWith("\n");
      const insert = block.bodyTo > block.bodyFrom ? body + (region.endsWith("\r") ? "\r" : "") : body ? (atEnd ? nl : "") + body + nl : "";
      if (region === insert) return { text, changes: 0 };
      return { text: text.slice(0, block.bodyFrom) + insert + text.slice(block.bodyTo), changes: 1 };
    },
  }),
  part({
    kinds: ["replaceGridCell", "setGridAttributes", "changeGridCells", "putIntoGrid"],
    section: {
      name: "grids",
      make: (add) => ({
        replaceCell: (body, cell, content, where = {}) =>
          add({ kind: "replaceGridCell", body, cell, content, occurrence: where.occurrence ?? 0, ...(where.of === undefined ? {} : { of: where.of }) }),
        setAttributes: (body, attributes, where = {}) =>
          add({ kind: "setGridAttributes", body, attributes: { ...attributes }, occurrence: where.occurrence ?? 0, ...(where.of === undefined ? {} : { of: where.of }) }),
        changeCells: (body, cells, where = {}) => add({ kind: "changeGridCells", body, cells: { ...cells }, occurrence: where.occurrence ?? 0, ...(where.of === undefined ? {} : { of: where.of }) }),
        put: (from, to, was, mode, columns) => add({ kind: "putIntoGrid", from, to, was, mode, columns }),
      }),
    },
    write: (text, change) => {
      if (change.kind === "putIntoGrid") {
        if (text.slice(change.from, change.to) !== change.was) return { text, changes: 0, problem: "the text changed since it was read: left alone" };
        const edit = gridOfBlocks(text, blocksIn(text, change.from, change.to, readGrids(text)), change.mode, change.columns);
        if (!edit) return { text, changes: 0, problem: "no block to put into a grid there" };
        return { text: text.slice(0, edit.from) + edit.insert + text.slice(edit.to), changes: 1 };
      }
      const alike = readGrids(text).filter((grid) => sameBody(grid.body) === sameBody(change.body));
      const grid = alike[change.occurrence];
      const changed = { text, changes: 0, problem: "its grid changed since it was read: left alone" };
      if (!grid || (change.of !== undefined && alike.length !== change.of)) return changed;
      if (change.kind === "changeGridCells") {
        const how = change.cells;
        if (how.kind === "ungrid") return { text: text.slice(0, grid.from) + ungridded(grid) + text.slice(grid.to), changes: 1 };
        // Only the cells' own lines change: each cell moved whole (its `<column …>` line's attributes with it), what
        // lies between them where it was
        const nl = lineBreakOf(text);
        const cells = grid.cells;
        // A cell's text whole, its `</column>` written where it was left open
        const whole = (cell: (typeof cells)[number]) => {
          const own = text.slice(cell.from, cell.to);
          return cell.closed ? own : `${own.replace(/\s+$/, "")}${nl}</column>`;
        };
        // The end of a cell's last line, its line break after it included (where it has one)
        const lineEnd = (at: number) => (text.startsWith("\r\n", at) ? at + 2 : text.startsWith("\n", at) ? at + 1 : at);
        if (how.kind === "move") {
          const to = how.cell + how.by;
          if (how.cell < 0 || how.cell >= cells.length || to < 0 || to >= cells.length) return { text, changes: 0 };
          const [first, second] = how.cell < to ? [cells[how.cell]!, cells[to]!] : [cells[to]!, cells[how.cell]!];
          return { text: text.slice(0, first.from) + whole(second) + text.slice(first.to, second.from) + whole(first) + text.slice(second.to), changes: 1 };
        }
        if (how.kind === "add") {
          const empty = `<column>${nl}${nl}${nl}</column>`;
          const before = how.after === undefined ? cells.at(-1) : cells[how.after];
          if (!before) {
            // (No cell yet: the first, at the body's start)
            return { text: text.slice(0, grid.bodyFrom) + empty + nl + text.slice(grid.bodyFrom), changes: 1 };
          }
          // (After the cell's `</column>` line; one left open closed first)
          return { text: text.slice(0, before.from) + whole(before) + nl + empty + text.slice(before.to), changes: 1 };
        }
        if (how.cell < 0 || how.cell >= cells.length) return { text, changes: 0 };
        const out = cells[how.cell]!;
        // Its content under the grid, never lost; the grid gone where it was its last cell
        const after = out.content.replace(/\r\n/g, "\n").trim() ? out.content.replace(/\r\n/g, "\n") : "";
        if (cells.length === 1) return { text: text.slice(0, grid.from) + after.replace(/\n/g, nl) + text.slice(grid.to), changes: 1 };
        const kept = text.slice(0, out.from) + text.slice(out.closed ? lineEnd(out.to) : out.to);
        const shift = kept.length - text.length;
        const end = grid.to + shift;
        return { text: kept.slice(0, end) + (after ? `${nl}${nl}${after.replace(/\n/g, nl)}` : "") + kept.slice(end), changes: 1 };
      }
      if (change.kind === "setGridAttributes") {
        const problem = Object.keys(change.attributes).map(validateAttributeName).find(Boolean);
        if (problem) return { text, changes: 0, problem };
        const attributes: Record<string, string> = { ...grid.attributes };
        for (const [name, value] of Object.entries(change.attributes)) {
          if (value === null) delete attributes[name.toLowerCase()];
          else attributes[name.toLowerCase()] = value;
        }
        // The `<grid>` line, to its line break (a CR before it kept)
        const lineEnd = text.indexOf("\n", grid.from);
        const end = lineEnd < 0 ? text.length : text[lineEnd - 1] === "\r" ? lineEnd - 1 : lineEnd;
        const line = `<grid${writeAttributes(attributes)}>`;
        if (text.slice(grid.from, end) === line) return { text, changes: 0 };
        return { text: text.slice(0, grid.from) + line + text.slice(end), changes: 1 };
      }
      const cell = grid.cells[change.cell];
      if (!cell) return changed;
      const nl = lineBreakOf(text);
      const content = sameBody(change.content).replace(/^(\s*\n)+/, "");
      // A blank line before and after the content (none for no content): what other renderers need to read it as markdown
      const inner = (content ? nl + content.replace(/\n/g, nl) + nl + nl : nl) + (cell.closed ? "" : `</column>${nl}`);
      if (text.slice(cell.innerFrom, cell.innerTo) === inner) return { text, changes: 0 };
      return { text: text.slice(0, cell.innerFrom) + inner + text.slice(cell.innerTo), changes: 1 };
    },
  }),
  part({
    kinds: ["setEmbed", "embedToLink"],
    section: {
      name: "embeds",
      make: (add) => ({
        set: (text, changes, where = {}) =>
          add({ kind: "setEmbed", text, changes: structuredClone(changes), occurrence: where.occurrence ?? 0, ...(where.of === undefined ? {} : { of: where.of }) }),
        toLink: (text, where = {}) => add({ kind: "embedToLink", text, occurrence: where.occurrence ?? 0, ...(where.of === undefined ? {} : { of: where.of }) }),
      }),
    },
    write: (text, change) => {
      const alike = readEmbeds(text).filter((embed) => embed.text === change.text);
      const embed = alike[change.occurrence];
      if (!embed || (change.of !== undefined && alike.length !== change.of)) return { text, changes: 0, problem: "its embed changed since it was read: left alone" };
      const written = change.kind === "embedToLink" ? embedAsLink(embed) : writeEmbed(embed, change.changes);
      if (written === embed.text) return { text, changes: 0 };
      return { text: text.slice(0, embed.from) + written + text.slice(embed.to), changes: 1 };
    },
  }),
  part({
    kinds: ["linkToEmbed"],
    section: {
      name: "links",
      make: (add) => ({
        toEmbed: (text, where = {}) => add({ kind: "linkToEmbed", text, occurrence: where.occurrence ?? 0, ...(where.of === undefined ? {} : { of: where.of }) }),
      }),
    },
    write: (text, change) => {
      const alike = readLinks(text).filter((link) => link.text === change.text);
      const link = alike[change.occurrence];
      if (!link || (change.of !== undefined && alike.length !== change.of)) return { text, changes: 0, problem: "its link changed since it was read: left alone" };
      return { text: text.slice(0, link.from) + linkAsEmbed(link) + text.slice(link.to), changes: 1 };
    },
  }),
  // The body: the page builder's own `body`, no section
  part({
    kinds: ["setBody"],
    write: (text, change) => {
      const start = readFrontmatter(text).bodyStart;
      if (text.slice(start) === change.text) return { text, changes: 0 };
      // (The body as the plugin read it: one changed since, by hand, is never written over)
      if (change.was !== undefined && text.slice(start) !== change.was) return { text, changes: 0, problem: "its body changed since it was read: left alone" };
      // A closing fence at the text's very end gets its line break, else the body would run on from it and end the frontmatter
      const head = text.slice(0, start);
      return { text: head + (start > 0 && !head.endsWith("\n") ? lineBreakOf(text) : "") + change.text, changes: 1 };
    },
  }),
];

const partOf = new Map(PARTS.flatMap((one) => one.kinds.map((kind) => [kind, one] as const)));

/** One change applied to a page's text, by the part that writes its kind */
export async function written(text: string, change: PageChange, options: WriterOptions): Promise<EditResult> {
  const one = partOf.get(change.kind);
  if (!one) throw new Error(`no part writes a change of the kind ${change.kind}`);
  return one.write(text, change, options);
}

/**
 * The text without the lines from `from` to `to` (a block's, its closing
 * fence's line break with them); where a blank line was on both sides of them,
 * one of the two goes, so the text around reads as it would without the block
 */
function withoutBlock(text: string, from: number, to: number): string {
  const end = text.startsWith("\r\n", to) ? to + 2 : text.startsWith("\n", to) ? to + 1 : to;
  const before = text.slice(0, from);
  let after = text.slice(end);
  const blankBefore = from === 0 || /\r?\n\r?\n$/.test(before);
  const blank = /^\r?\n/.exec(after);
  if (blankBefore && blank) after = after.slice(blank[0].length);
  return before + after;
}
