// The assign module: tags given to pages and taken off them, the pages picked
// in a tree by folder (a folder's box: every page under it, its own page too).
// Added into each page's frontmatter (those it has left out), taken off its
// frontmatter and its tag lines (a hashtag in its text stays: that is the
// text's, Delete takes it off). From its command, or the manager: Add to
// pages… (the tag to add), Remove from pages… (the tag to take off, the pages
// having it checked).
import { pagesWith } from "../core/catalog.ts";
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { counted, type Operation } from "../core/operation.ts";
import { addPageTags, removePageTags } from "../tags/edit.ts";
import { hashtagOf } from "../tags/names.ts";
import { chipsField, suggestions } from "../ui/chips.ts";
import { buttons, openDialog } from "../ui/dialog.ts";
import { el } from "../ui/elements.ts";
import { labelled, note } from "../ui/form.ts";
import { pageTree } from "../ui/pagetree.ts";

export const ASSIGN_COMMAND = "Silverware Tags: Tag pages";

const listed = (names: readonly string[]) => names.map(hashtagOf).join(" ");

export function assignOperation(pages: readonly string[], add: readonly string[], remove: readonly string[]): Operation {
  const parts = [...(add.length ? [`add ${listed(add)}`] : []), ...(remove.length ? [`remove ${listed(remove)}`] : [])].join(", ");
  return {
    label: `Tag ${counted(pages.length, "page")}: ${parts}`,
    pages: () => pages,
    edit: (text) => {
      const added = addPageTags(text, add);
      if (added.problem) return added;
      const removed = removePageTags(added.text, remove);
      if (removed.problem) return removed;
      return { text: removed.text, changes: added.changes + removed.changes };
    },
    done: (pages, changes) => `Tagged ${counted(pages, "page")}: ${parts} (${counted(changes, "change")})`,
  };
}

type Start = { readonly add?: readonly string[]; readonly remove?: readonly string[]; readonly checked?: readonly string[] };

async function assignDialog(host: ModuleHost, start: Start = {}): Promise<boolean> {
  const { doc } = host;
  const catalog = await host.catalog();
  const names = [...catalog.tags.keys()];
  return new Promise((resolve) => {
    const said = note(doc);
    const update = () => {
      const pages = tree.checked().length;
      preview.disabled = !pages || (!add.values().length && !remove.values().length);
      said.say(pages ? `${counted(pages, "page")} picked` : "Pick the pages: a folder picks every page under it.");
    };
    const tree = pageTree(doc, catalog.pages, { checked: start.checked, changed: () => update() });
    const add = chipsField(doc, { values: start.add, placeholder: "Tags to add", suggest: (typed) => suggestions(names, typed), changed: () => update(), kind: "add" });
    const remove = chipsField(doc, { values: start.remove, placeholder: "Tags to remove", suggest: (typed) => suggestions(names, typed), changed: () => update(), kind: "remove" });
    const search = el(doc, "input", { class: "swg-field swg-search", attrs: { type: "search", placeholder: "Search pages", "aria-label": "Search pages", spellcheck: "false" } });
    search.addEventListener("input", () => tree.filter(search.value));
    let submitted = false;
    const preview = el(doc, "button", {
      class: "swg-button swg-primary",
      text: "Preview…",
      run: () => {
        const pages = tree.checked();
        const toAdd = add.values();
        const toRemove = remove.values();
        if (!pages.length || (!toAdd.length && !toRemove.length)) return;
        submitted = true;
        dialog.close();
        void host.run(assignOperation(pages, toAdd, toRemove)).then(resolve);
      },
    });
    const dialog = openDialog(doc, {
      title: "Tag pages",
      subtitle: "Tags are added into each page's frontmatter; removed from it and from the page's tag lines.",
      className: "swg-assign",
      content: el(
        doc,
        "div",
        "swg-assign-body",
        el(doc, "div", "swg-assign-pages", search, el(doc, "div", "swg-tree-box-list", tree.element)),
        el(doc, "div", "swg-form", labelled(doc, "Add", add.element), labelled(doc, "Remove", remove.element), said.element),
      ),
      footer: buttons(doc, el(doc, "button", { class: "swg-button", text: "Cancel", run: () => dialog.close() }), preview),
      focus: start.add?.length || start.remove?.length ? search : add.input,
      closed: () => {
        if (!submitted) resolve(false);
      },
    });
    update();
  });
}

export function assignModule(host: ModuleHost): TagsModule {
  return {
    commands: () => [{ name: ASSIGN_COMMAND, run: () => assignDialog(host) }],
    tagActions: (tag, catalog) => [
      { id: "assign.add", label: "Add to pages…", run: () => assignDialog(host, { add: [tag] }) },
      ...(catalog.tags.get(tag)?.byContext.has("page") ? [{ id: "assign.remove", label: "Remove from pages…", run: () => assignDialog(host, { remove: [tag], checked: pagesWith(catalog, tag, false).filter((page) => catalog.tags.get(tag)!.byContext.get("page")!.has(page)) }) }] : []),
    ],
  };
}
