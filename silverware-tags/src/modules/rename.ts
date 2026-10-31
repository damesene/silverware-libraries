// The rename module: a tag renamed everywhere it is used (the frontmatter,
// tag lines, paragraphs, items, tasks, tables); into a name a tag has, the two
// merge. With its subtags, the tags under it follow (`project/alpha` →
// `work/project/alpha`). From the manager (Rename…) or its command, which asks
// for the tag too.
import { type Catalog, pagesWith, subtagsOf } from "../core/catalog.ts";
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { counted, type Operation } from "../core/operation.ts";
import { renameTags } from "../tags/edit.ts";
import { hashtagOf, nameProblem, renamedTag } from "../tags/names.ts";
import { suggestions, tagField } from "../ui/chips.ts";
import { buttons, openDialog } from "../ui/dialog.ts";
import { el } from "../ui/elements.ts";
import { checkbox, labelled, note } from "../ui/form.ts";

export const RENAME_COMMAND = "Silverware Tags: Rename tag";

export function renameOperation(from: string, to: string, children: boolean): Operation {
  const what = `${hashtagOf(from)} to ${hashtagOf(to)}${children ? " with its subtags" : ""}`;
  return {
    label: `Rename ${what}`,
    pages: (catalog) => pagesWith(catalog, from, children),
    edit: (text) => renameTags(text, (name) => renamedTag(name, from, to, children)),
    done: (pages, changes) => `Renamed ${what}: ${counted(changes, "tag")} on ${counted(pages, "page")}`,
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

/** The dialog: the tag (unless given), its new name, its subtags; the rename then previewed. The new name where applied */
async function renameDialog(host: ModuleHost, given?: string, known?: Catalog): Promise<string | undefined> {
  const { doc } = host;
  const catalog = known ?? (await host.catalog());
  const names = [...catalog.tags.keys()];
  return new Promise((resolve) => {
    const from = tagField(doc, { value: given, placeholder: "The tag to rename", suggest: (typed) => suggestions(names, typed), changed: () => update() });
    const to = tagField(doc, { value: given, placeholder: "Its new name", suggest: (typed) => suggestions(names, typed), changed: () => update() });
    const children = checkbox(doc, "With its subtags", true, () => update());
    const said = note(doc);
    const rename = el(doc, "button", { class: "swg-button swg-primary", text: "Rename…", run: () => void submit() });
    const update = () => {
      const tag = from.value();
      const subtags = subtagsOf(catalog, tag);
      children.element.hidden = !subtags.length;
      children.element.querySelector("span")!.textContent = `With its subtags (${subtags.length}: ${subtags.slice(0, 3).map(hashtagOf).join(", ")}${subtags.length > 3 ? ", …" : ""})`;
      const problem = renameProblem(tag, to.value());
      rename.disabled = !!problem;
      // (Its own name, as the dialog opens with it: nothing to say yet)
      if (problem) said.say(tag && to.value() === tag ? "" : problem, true);
      else said.say(catalog.tags.has(to.value()) ? `${hashtagOf(to.value())} exists: the two become one.` : `${counted(pagesWith(catalog, tag, children.box.checked && subtags.length > 0).length, "page")} to look at.`);
    };
    // Submitted: the dialog closed, the rename previewed (resolved once that is done)
    let submitted = false;
    const submit = async () => {
      const tag = from.value();
      const name = to.value();
      if (submitted || renameProblem(tag, name)) return;
      const withChildren = children.box.checked && subtagsOf(catalog, tag).length > 0;
      submitted = true;
      dialog.close();
      resolve((await host.run(renameOperation(tag, name, withChildren))) ? name : undefined);
    };
    // Enter in a field renames (once its list of tags took what it had to)
    const form = el(
      doc,
      "div",
      { class: "swg-form", on: { keydown: (e) => e.key === "Enter" && !e.defaultPrevented && (e.preventDefault(), void submit()) } },
      given ? null : labelled(doc, "Tag", from.element),
      labelled(doc, given ? `New name of ${hashtagOf(given)}` : "New name", to.element, "Levels are parted by /: project/alpha is under project."),
      children.element,
      said.element,
    );
    const dialog = openDialog(doc, {
      title: given ? `Rename ${hashtagOf(given)}` : "Rename a tag",
      className: "swg-small",
      content: form,
      footer: buttons(doc, el(doc, "button", { class: "swg-button", text: "Cancel", run: () => dialog.close() }), rename),
      focus: given ? to.input : from.input,
      closed: () => {
        if (!submitted) resolve(undefined);
      },
    });
    if (given) to.input.select();
    update();
  });
}

export function renameModule(host: ModuleHost): TagsModule {
  return {
    commands: () => [{ name: RENAME_COMMAND, run: () => renameDialog(host) }],
    tagActions: (tag, catalog) => [{ id: "rename", label: "Rename…", run: () => renameDialog(host, tag, catalog) }],
  };
}
