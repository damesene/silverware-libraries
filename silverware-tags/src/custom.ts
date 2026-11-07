// Custom operations: the user's own things done with a tag, defined in a JS
// file of the space and given from Space Lua (silverware.tags.defineOperations
// on the API page), as the toolbar's custom actions are: a definition, a
// function given HELPERS returning one or a list, or a list. Each is an action
// on a tag (a button of the tag picked, as the built-in ones): its `edit` gets
// each page's text and gives the text it should have, which the core plans,
// reviews, applies and keeps for Undo, meta pages protected as for any change.
// What it gives or throws is checked as it runs: a page it fails on is left
// alone and said in the review.
import type { Catalog } from "./core/catalog.ts";
import { pagesWith } from "./core/catalog.ts";
import type { TagAction } from "./core/module.ts";
import { counted, type Operation } from "./core/operation.ts";
import { addPageTags, applyEdits, type EditResult, frontmatterTags, pageTags, removePageTags, removeTags, renameTags, tagUses } from "./tags/edit.ts";
import { type FrontmatterForm, readFrontmatter } from "./tags/frontmatter.ts";
import { hashtagOf, isMetaTag, isWithin, matches, validateName, parentOf, renamedTag } from "./tags/names.ts";
import { scanHashtags } from "./tags/scan.ts";

/** What a custom operation's functions get to tell the space by: plain lists (a JS module's, Space Lua's alike) */
export type TagsContext = {
  // The tag the action is on
  readonly tag: string;
  // Every tag, every page (meta pages left out where they are protected)
  readonly tags: readonly string[];
  readonly pages: readonly string[];
  // The pages using a tag (with `children`, its subtags' too)
  pagesWith(tag: string, children?: boolean): string[];
  // How a tag is used: its pages by context (page, item, task, table, header)
  contexts(tag: string): Readonly<Record<string, readonly string[]>>;
};

export type OperationDefinition = {
  readonly name: string;
  // Its button on a tag, and the review's title (else the label and the tag)
  readonly label: string;
  readonly title?: (context: TagsContext) => string;
  readonly danger?: boolean;
  // Whether it is offered for a tag (left out: always)
  readonly when?: (context: TagsContext) => boolean;
  // The pages it may change (left out: those using the tag); a promise may be given
  readonly pages?: (context: TagsContext) => readonly string[] | Promise<readonly string[]>;
  // A page's text as it should be: a text, { text, changes } (what the helpers give), or nothing (unchanged); a promise may be given
  readonly edit: (text: string, page: string, context: TagsContext) => unknown;
};

/** The domain's pure functions a custom operation edits with (text in, text out), as the built-in modules do */
export const HELPERS = {
  renameTags,
  removeTags,
  // (In the form the setting asks for where a page has no tags yet, unless one is given)
  addPageTags: (text: string, names: readonly string[], form?: FrontmatterForm) => addPageTags(text, names, form ?? newTagsForm),
  removePageTags,
  pageTags,
  frontmatterTags,
  tagUses,
  hashtags: (text: string) => scanHashtags(text, readFrontmatter(text).bodyStart),
  applyEdits,
  hashtagOf,
  isMetaTag,
  isWithin,
  matches,
  validateName,
  // Its name before 2026-11-07, kept for the scripts that call it
  nameProblem: validateName,
  parentOf,
  renamedTag,
};

// How a page's tags are written where it has none yet, as Silverware Tags started with (the setting)
let newTagsForm: FrontmatterForm = "flow";

/** The setting as Silverware Tags starts, for the helpers' addPageTags */
export function setNewTagsForm(form: FrontmatterForm): void {
  newTagsForm = form;
}

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

// The custom operations by name, as last defined
let custom = new Map<string, OperationDefinition>();
let anew = false;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** The definitions given as a flat list, or what failed making them */
function definitionsOf(value: unknown, problems: string[]): unknown[] {
  if (isObject(value) && !Array.isArray(value) && "default" in value) return definitionsOf(value.default, problems);
  if (typeof value === "function") {
    try {
      return definitionsOf((value as (helpers: typeof HELPERS) => unknown)(HELPERS), problems);
    } catch (e) {
      problems.push(`the definitions failed: ${message(e)}`);
      return [];
    }
  }
  if (Array.isArray(value)) return value.flatMap((item) => definitionsOf(item, problems));
  return [value];
}

/** What is wrong with a definition (nothing: undefined) */
function validateDefinition(d: Partial<OperationDefinition>): string | undefined {
  if (typeof d.name !== "string" || !NAME_RE.test(d.name)) return `its name ${JSON.stringify(d.name)} is not letters, digits and _ starting with a letter`;
  if (typeof d.label !== "string" || !d.label) return "it has no label";
  if (typeof d.edit !== "function") return "its edit is not a function";
  for (const fn of ["title", "when", "pages"] as const) if (d[fn] !== undefined && typeof d[fn] !== "function") return `its ${fn} is not a function`;
  if (d.danger !== undefined && typeof d.danger !== "boolean") return "its danger is not true or false";
  return undefined;
}

/** The operations defined, and what is wrong with the others */
export function operationsOf(definitions: unknown): { operations: OperationDefinition[]; problems: string[] } {
  const problems: string[] = [];
  const operations: OperationDefinition[] = [];
  definitionsOf(definitions, problems).forEach((definition, i) => {
    if (!isObject(definition)) {
      problems.push(`operation ${i + 1}: not an object`);
      return;
    }
    const problem = validateDefinition(definition as Partial<OperationDefinition>);
    if (problem) problems.push(`operation ${typeof definition.name === "string" ? definition.name : i + 1}: ${problem}`);
    else operations.push(definition as OperationDefinition);
  });
  return { operations, problems };
}

/** Custom operations, added to those defined before (one of the same name replaced), or replacing them all after `customOperationsAnew`; the names defined again */
export function defineCustomOperations(operations: readonly OperationDefinition[]): string[] {
  const before = anew ? new Map<string, OperationDefinition>() : custom;
  anew = false;
  const again = operations.filter((o, i) => before.has(o.name) || operations.findIndex((p) => p.name === o.name) < i).map((o) => o.name);
  custom = new Map([...before, ...operations.map((o) => [o.name, o] as const)]);
  return [...new Set(again)];
}

/** Space Lua loads again: the next definitions replace those of before (kept until then) */
export function customOperationsAnew(): void {
  anew = true;
}

export function resetCustomOperations(): void {
  custom = new Map();
  anew = false;
}

/** The context a definition's functions get, of a catalog */
export function tagsContext(tag: string, catalog: Catalog): TagsContext {
  return {
    tag,
    tags: [...catalog.tags.keys()].sort(),
    pages: catalog.pages,
    pagesWith: (name, children = false) => pagesWith(catalog, name, children),
    contexts: (name) => Object.fromEntries([...(catalog.tags.get(name)?.byContext ?? [])].map(([context, pages]) => [context, [...pages].sort()])),
  };
}

/** What a definition's edit gave, as the core takes it; what is wrong with it thrown */
function editResultOf(given: unknown, before: string): EditResult {
  if (given === undefined || given === null) return { text: before, changes: 0 };
  if (typeof given === "string") return { text: given, changes: given === before ? 0 : 1 };
  if (isObject(given) && typeof given.text === "string") {
    const changes = typeof given.changes === "number" ? given.changes : given.text === before ? 0 : 1;
    return { text: given.text, changes, ...(typeof given.problem === "string" ? { problem: given.problem } : {}) };
  }
  throw new Error("its edit gave neither a text, { text, changes } nor nothing");
}

/** A definition's operation on a tag, as the core runs it */
export function customOperation(definition: OperationDefinition, context: TagsContext): Operation {
  const { name } = definition;
  const call = <T>(fn: string, f: () => T): T => {
    try {
      return f();
    } catch (e) {
      throw new Error(`${name}'s ${fn} failed: ${message(e)}`);
    }
  };
  const label = definition.title ? String(call("title", () => definition.title!(context))) : `${definition.label} ${hashtagOf(context.tag)}`;
  return {
    label,
    pages: async () => {
      if (!definition.pages) return context.pagesWith(context.tag);
      const pages = await call("pages", () => definition.pages!(context));
      if (!Array.isArray(pages) || !pages.every((page) => typeof page === "string")) throw new Error(`${name}'s pages did not give a list of page names`);
      return pages;
    },
    edit: async (text, page) => {
      try {
        return editResultOf(await definition.edit(text, page, context), text);
      } catch (e) {
        throw new Error(`${name}: ${message(e)}`);
      }
    },
    done: (pages, changes) => `${label}: ${counted(changes, "change")} on ${counted(pages, "page")}`,
  };
}

/** The custom operations as actions on a tag, in the order they were defined */
export function customActions(): TagAction[] {
  return [...custom.values()].map((definition) => ({
    id: `custom.${definition.name}`,
    label: definition.label,
    ...(definition.danger ? { danger: true } : {}),
    ...(definition.when
      ? {
          when: (tag: string, catalog: Catalog) => {
            try {
              return !!definition.when!(tagsContext(tag, catalog));
            } catch (e) {
              console.error(`Silverware Tags: ${definition.name}'s when failed`, e);
              return false;
            }
          },
        }
      : {}),
    run: (tag, host) => customOperation(definition, tagsContext(tag, host.catalog)),
  }));
}
