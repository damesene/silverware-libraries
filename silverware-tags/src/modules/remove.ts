// The remove module: Delete tag… on the tag picked reviews taking it off every
// page using it (the frontmatter, tag lines, a hashtag in text with a space
// beside it); a tag with subtags: the review offers them too, off by default.
import { pagesWith, subtagsOf } from "../core/catalog.ts";
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { counted, type Operation } from "../core/operation.ts";
import { removeTags } from "../tags/edit.ts";
import { hashtagOf, matches } from "../tags/names.ts";

export function removeOperation(tag: string, children: boolean, subtags = 0): Operation {
  const what = `${hashtagOf(tag)}${children ? " and its subtags" : ""}`;
  return {
    label: `Delete ${what}`,
    pages: (catalog) => pagesWith(catalog, tag, children),
    edit: (text) => removeTags(text, (name) => matches(name, tag, children)),
    done: (pages, changes) => `Deleted ${what}: ${counted(changes, "tag")} on ${counted(pages, "page")}`,
    ...(subtags ? { option: { label: `Its subtags too (${subtags})`, on: children, toggled: () => removeOperation(tag, !children, subtags) } } : {}),
  };
}

export function removeModule(_host: ModuleHost): TagsModule {
  return {
    tagActions: () => [
      {
        id: "remove",
        label: "Delete tag…",
        danger: true,
        key: "Delete",
        run: (tag, host) => removeOperation(tag, false, subtagsOf(host.catalog, tag).length),
      },
    ],
  };
}
