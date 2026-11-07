// The rename module: the name of the tag picked is a field; typed anew and
// Enter (or Rename…), the rename is reviewed: every use changes (the
// frontmatter, tag lines, paragraphs, items, tasks, tables, headings); into a
// name a tag has, the two merge, which the field says as it is typed. A tag
// with subtags: the review offers to rename them too (`project/alpha` →
// `work/project/alpha`), on by default. It offers the others a rename
// reviewed (`rename`: the panel's drag).
import { pagesWith, subtagsOf } from "../core/catalog.ts";
import type { ModuleHost, TagsModule, WorkspaceHost } from "../core/module.ts";
import type { RenameOffer } from "../core/offers.ts";
import { counted, type Operation } from "../core/operation.ts";
import { renameTags } from "../tags/edit.ts";
import { cleanName, hashtagOf, isWithin, validateName, renamedTag } from "../tags/names.ts";
import { suggestions, tagField } from "../ui/chips.ts";
import { el } from "../../../shared/elements.ts";
import { note } from "../ui/form.ts";

export function renameOperation(from: string, to: string, children: boolean, subtags = 0): Operation {
  const what = `${hashtagOf(from)} to ${hashtagOf(to)}${children ? " with its subtags" : ""}`;
  return {
    label: `Rename ${what}`,
    pages: (catalog) => pagesWith(catalog, from, children),
    // Into a subtag of its own (#a to #a/x): the tags under the target stay as they are, so the two merge as the
    // field said, else #a/x would move on to #a/x/x
    edit: (text) => renameTags(text, (name) => (to !== from && isWithin(to, from) && isWithin(name, to) ? undefined : renamedTag(name, from, to, children))),
    done: (pages, changes) => `Renamed ${what}: ${counted(changes, "tag")} on ${counted(pages, "page")}`,
    ...(subtags ? { options: [{ label: `Its subtags too (${subtags})`, on: children, toggled: () => renameOperation(from, to, !children, subtags) }] } : {}),
    shows: to,
  };
}

/**
 * Several tags merged into one (`into`: a tag of the space or a new one):
 * every use of each renamed to it, with `children` the tags under each moved
 * under it (`a/x` into `c`: `c/x`); tags already under `into` stay as they are,
 * but those picked (`a/b` into `a`: `a`) and theirs
 */
export function mergeOperation(tags: readonly string[], into: string, children: boolean, subtags = 0): Operation {
  const what = `${tags.map(hashtagOf).join(" ")} into ${hashtagOf(into)}${children ? " with their subtags" : ""}`;
  const renamed = (name: string) => {
    for (const from of tags) {
      if (from === into) continue;
      // Into a subtag of its own (as a rename): the tags under the target stay
      if (isWithin(into, from) && isWithin(name, into)) return undefined;
      const to = renamedTag(name, from, into, children);
      if (to !== undefined) return to;
    }
    return undefined;
  };
  return {
    label: `Merge ${what}`,
    pages: (catalog) => [...new Set(tags.flatMap((tag) => pagesWith(catalog, tag, children)))].sort((a, b) => a.localeCompare(b)),
    edit: (text) => renameTags(text, renamed),
    done: (pages, changes) => `Merged ${what}: ${counted(changes, "tag")} on ${counted(pages, "page")}`,
    ...(subtags ? { options: [{ label: `Their subtags too (${subtags})`, on: children, toggled: () => mergeOperation(tags, into, !children, subtags) }] } : {}),
    shows: into,
  };
}

/** What is wrong with merging `tags` into `into` (nothing: undefined) */
export function validateMerge(into: string, tags: readonly string[]): string | undefined {
  if (tags.some((tag) => tag !== into && isWithin(into, tag))) return "the tag they become cannot be under one of them";
  return undefined;
}

/** What is wrong with renaming `from` to `to` (nothing: undefined) */
export function validateRename(from: string, to: string): string | undefined {
  if (!from) return "Which tag?";
  const problem = validateName(to);
  if (problem) return `The new name: ${problem}`;
  if (from === to) return "That is its name already";
  return undefined;
}

/** The tag's name as a field: what renaming it to the name typed would do, said under it; Enter reviews it */
function nameField(tag: string, host: WorkspaceHost): HTMLElement {
  const { doc, catalog } = host;
  const names = [...catalog.tags.keys()];
  const said = note(doc);
  const field = tagField(doc, { value: tag, placeholder: "The tag's name", suggest: (typed) => suggestions(names, typed, new Set([tag])), changed: () => update() });
  field.input.classList.add("swg-name-field");
  field.input.setAttribute("aria-label", `Rename ${hashtagOf(tag)}`);
  const rename = el(doc, "button", { class: "swg-button swg-primary swg-rename", text: "Rename…", run: () => submit() });
  const actions = el(doc, "div", "swg-name-actions", said.element, rename);
  const update = () => {
    const name = field.value();
    const changed = name !== tag;
    actions.hidden = !changed;
    if (!changed) return;
    const problem = validateRename(tag, name);
    rename.disabled = !!problem;
    if (problem) said.say(problem, true);
    else said.say(catalog.tags.has(name) ? `${hashtagOf(name)} exists: the two become one.` : `Renames it on ${counted(catalog.tags.get(tag)?.pages.size ?? 0, "page")}; you see every change first.`);
  };
  const submit = () => {
    const name = field.value();
    if (validateRename(tag, name)) return;
    const subtags = subtagsOf(catalog, tag).length;
    host.review(renameOperation(tag, name, subtags > 0, subtags));
  };
  field.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.defaultPrevented) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape" && cleanName(field.input.value) !== tag) {
      // The name typed dropped first; a second Esc closes the window
      e.preventDefault();
      e.stopPropagation();
      field.input.value = tag;
      update();
    }
  });
  update();
  return el(doc, "div", "swg-name", el(doc, "span", { class: "swg-name-hash", text: "#" }), field.element, actions);
}

export function renameModule(host: ModuleHost): TagsModule {
  const offer: RenameOffer = {
    review: async (from, to) => {
      const subtags = subtagsOf(await host.catalog(), from).length;
      await host.review(renameOperation(from, to, subtags > 0, subtags), from);
    },
    validate: validateRename,
    merge: (tags, into, catalog) => {
      const subtags = new Set(tags.flatMap((tag) => subtagsOf(catalog, tag))).size;
      return mergeOperation(tags, into, subtags > 0, subtags);
    },
  };
  host.offer(offer);
  return {
    tagParts: (tag, host) => ({ name: nameField(tag, host) }),
    // A button of the Tags panel's rows, and F2 there: the window at the tag, its name to type
    panelActions: () => [{ id: "rename.rename", icon: "edit-2", label: "Rename", key: "F2", order: 20, run: (tag) => host.open("tags", { tag, focus: "name" }) }],
    tagsActions: () => [
      {
        id: "rename.merge",
        label: "Merge into…",
        ask: { label: "Into the tag", validate: validateMerge },
        run: (tags, host, into) => {
          const subtags = new Set(tags.flatMap((tag) => subtagsOf(host.catalog, tag))).size;
          return mergeOperation(tags, into!, subtags > 0, subtags);
        },
      },
    ],
  };
}
