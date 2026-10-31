// The remove module: a tag deleted everywhere it is used (the frontmatter, tag
// lines, a hashtag in text with a space beside it), with its subtags or not.
// From the manager (Delete…); asked first, then previewed.
import { pagesWith, subtagsOf } from "../core/catalog.ts";
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { counted, type Operation } from "../core/operation.ts";
import { removeTags } from "../tags/edit.ts";
import { hashtagOf, matches } from "../tags/names.ts";
import { buttons, openDialog } from "../ui/dialog.ts";
import { el } from "../ui/elements.ts";
import { checkbox } from "../ui/form.ts";

export function removeOperation(tag: string, children: boolean): Operation {
  const what = `${hashtagOf(tag)}${children ? " and its subtags" : ""}`;
  return {
    label: `Delete ${what}`,
    pages: (catalog) => pagesWith(catalog, tag, children),
    edit: (text) => removeTags(text, (name) => matches(name, tag, children)),
    done: (pages, changes) => `Deleted ${what}: ${counted(changes, "tag")} on ${counted(pages, "page")}`,
  };
}

export function removeModule(host: ModuleHost): TagsModule {
  return {
    tagActions: (tag, catalog) => [
      {
        id: "remove",
        label: "Delete…",
        danger: true,
        run: () =>
          new Promise<boolean>((resolve) => {
            const { doc } = host;
            const subtags = subtagsOf(catalog, tag);
            const children = checkbox(doc, `With its subtags (${subtags.length})`, false);
            children.element.hidden = !subtags.length;
            let submitted = false;
            const remove = el(doc, "button", {
              class: "swg-button swg-danger swg-primary",
              text: "Delete…",
              run: () => {
                submitted = true;
                dialog.close();
                void host.run(removeOperation(tag, children.box.checked)).then(resolve);
              },
            });
            const dialog = openDialog(doc, {
              title: `Delete ${hashtagOf(tag)}`,
              className: "swg-small",
              content: el(
                doc,
                "div",
                "swg-form",
                el(doc, "p", { text: `Takes ${hashtagOf(tag)} off every page using it (${counted(pagesWith(catalog, tag, false).length, "page")}): from the frontmatter, the page's tag lines, and its text, items and tasks. You see what changes before anything is written.` }),
                children.element,
              ),
              footer: buttons(doc, el(doc, "button", { class: "swg-button", text: "Cancel", run: () => dialog.close() }), remove),
              focus: remove,
              closed: () => {
                if (!submitted) resolve(false);
              },
            });
          }),
      },
    ],
  };
}
