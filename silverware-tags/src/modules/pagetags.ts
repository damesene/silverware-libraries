// The pageTags module: the tags of the page open in the editor as chips (×
// takes one off, typing adds one, the space's offered), saved at once (one
// page, no preview): added into its frontmatter, taken off it and its tag
// lines; through the editor, so Ctrl+Z there undoes it too.
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { counted, type Operation } from "../core/operation.ts";
import { addPageTags, pageTags, removePageTags } from "../tags/edit.ts";
import { hashtagOf } from "../tags/names.ts";
import { chipsField, suggestions } from "../ui/chips.ts";
import { buttons, openDialog } from "../ui/dialog.ts";
import { el } from "../ui/elements.ts";

export const PAGE_TAGS_COMMAND = "Silverware Tags: Page tags";

/** The page's tags made `wanted`: those new added, those gone taken off */
export function pageTagsOperation(page: string, had: readonly string[], wanted: readonly string[]): Operation {
  const add = wanted.filter((name) => !had.includes(name));
  const remove = had.filter((name) => !wanted.includes(name));
  return {
    label: `Tags of ${page}`,
    pages: () => [page],
    edit: (text) => {
      const added = addPageTags(text, add);
      if (added.problem) return added;
      const removed = removePageTags(added.text, remove);
      return removed.problem ? removed : { text: removed.text, changes: added.changes + removed.changes };
    },
    done: () => [`${page}:`, ...(add.length ? [`added ${add.map(hashtagOf).join(" ")}`] : []), ...(remove.length ? [`removed ${remove.map(hashtagOf).join(" ")}`] : [])].join(" "),
  };
}

async function pageTagsDialog(host: ModuleHost): Promise<void> {
  const { doc, space } = host;
  const page = await space.currentPage();
  if (!page) {
    host.notifier.flash("Silverware Tags: no page is open", "error");
    return;
  }
  const [text, catalog] = await Promise.all([space.read(page), host.catalog()]);
  const had = pageTags(text);
  const names = [...catalog.tags.keys()];
  const field = chipsField(doc, { values: had, placeholder: "Add a tag", suggest: (typed) => suggestions(names, typed), kind: "page" });
  const save = el(doc, "button", {
    class: "swg-button swg-primary",
    text: "Save",
    run: () => {
      const wanted = field.values();
      dialog.close();
      if (wanted.length === had.length && wanted.every((name) => had.includes(name))) return;
      void host.apply(pageTagsOperation(page, had, wanted));
    },
  });
  const dialog = openDialog(doc, {
    title: `Tags of ${page}`,
    subtitle: `${counted(had.length, "tag")} now. New tags go into the page's frontmatter.`,
    className: "swg-small",
    content: el(doc, "div", { class: "swg-form", on: { keydown: (e) => e.key === "Enter" && !e.defaultPrevented && (e.preventDefault(), save.click()) } }, field.element),
    footer: buttons(doc, el(doc, "button", { class: "swg-button", text: "Cancel", run: () => dialog.close() }), save),
    focus: field.input,
  });
}

export function pageTagsModule(host: ModuleHost): TagsModule {
  return {
    commands: () => [{ name: PAGE_TAGS_COMMAND, run: () => pageTagsDialog(host) }],
  };
}
