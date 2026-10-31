// The rename module: the name of the tag picked is a field; typed anew and
// Enter (or Rename…), the rename is reviewed: every use changes (the
// frontmatter, tag lines, paragraphs, items, tasks, tables, headings); into a
// name a tag has, the two merge, which the field says as it is typed. A tag
// with subtags: the review offers to rename them too (`project/alpha` →
// `work/project/alpha`), on by default.
import { pagesWith, subtagsOf } from "../core/catalog.ts";
import type { ModuleHost, TagsModule, WorkspaceHost } from "../core/module.ts";
import { counted, type Operation } from "../core/operation.ts";
import { renameTags } from "../tags/edit.ts";
import { cleanName, hashtagOf, nameProblem, renamedTag } from "../tags/names.ts";
import { suggestions, tagField } from "../ui/chips.ts";
import { el } from "../ui/elements.ts";
import { note } from "../ui/form.ts";

export function renameOperation(from: string, to: string, children: boolean, subtags = 0): Operation {
  const what = `${hashtagOf(from)} to ${hashtagOf(to)}${children ? " with its subtags" : ""}`;
  return {
    label: `Rename ${what}`,
    pages: (catalog) => pagesWith(catalog, from, children),
    edit: (text) => renameTags(text, (name) => renamedTag(name, from, to, children)),
    done: (pages, changes) => `Renamed ${what}: ${counted(changes, "tag")} on ${counted(pages, "page")}`,
    ...(subtags ? { option: { label: `Its subtags too (${subtags})`, on: children, toggled: () => renameOperation(from, to, !children, subtags) } } : {}),
    shows: to,
  };
}

/** What is wrong with renaming `from` to `to` (nothing: undefined) */
export function renameProblem(from: string, to: string): string | undefined {
  if (!from) return "Which tag?";
  const problem = nameProblem(to);
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
    const problem = renameProblem(tag, name);
    rename.disabled = !!problem;
    if (problem) said.say(problem, true);
    else said.say(catalog.tags.has(name) ? `${hashtagOf(name)} exists: the two become one.` : `Renames it on ${counted(pagesWith(catalog, tag, false).length, "page")}; you see every change first.`);
  };
  const submit = () => {
    const name = field.value();
    if (renameProblem(tag, name)) return;
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

export function renameModule(_host: ModuleHost): TagsModule {
  return {
    tagParts: (tag, host) => ({ name: nameField(tag, host) }),
  };
}
