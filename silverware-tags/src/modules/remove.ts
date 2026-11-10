// The remove module: Remove tag… on the tag picked reviews taking it off every
// page using it. The review offers where from (the text and the page's own
// tags, the text only, the page's own tags only: its frontmatter and tag
// lines, as SilverBullet reads both as the page's tags), how in the text (the
// word kept, only the # going, by default; or taken out with a space beside
// it), and a tag with subtags those too, off by default. A page's own tag
// goes whole either way.
import { pagesWith, subtagsOf } from "../core/catalog.ts";
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { counted, type Operation, type OperationOption } from "../core/operation.ts";
import type { TagsFrom } from "../../../shared/pages/changes.ts";
import { hashtagOf } from "../../../shared/markdown/inline.ts";

/** How a removal goes, as the review's choices set it: where from (the page writer's `TagsFrom`), the word kept in the text or not */
export type Removal = { readonly from: TagsFrom; readonly keepWord: boolean };

const FROM: readonly TagsFrom[] = ["both", "body", "pageTags"];
const FROM_LABELS = ["Text and the page's own tags", "Text only", "The page's own tags only (frontmatter, tag lines)"];
const TEXT_LABELS = ["Keep the word, only the # goes", "Take it out of the text"];

/** By default: from everywhere, the word kept in the text */
export const KEEP_WORD: Removal = { from: "both", keepWord: true };


function removal(tags: readonly string[], children: boolean, subtags: number, way: Removal, again: (children: boolean, way: Removal) => Operation): Operation {
  const one = tags.length === 1;
  const what = `${tags.map(hashtagOf).join(" ")}${children ? (one ? " and its subtags" : " and their subtags") : ""}`;
  const where = way.from === "body" ? " from the text" : way.from === "pageTags" ? " from the pages' own tags" : "";
  const options: OperationOption[] = [
    { label: "Remove from", choices: FROM_LABELS, chosen: FROM.indexOf(way.from), choose: (i) => again(children, { ...way, from: FROM[i]! }) },
    // (Nothing of the text changes where only the page's own tags go)
    ...(way.from === "pageTags" ? [] : [{ label: "In the text", choices: TEXT_LABELS, chosen: way.keepWord ? 0 : 1, choose: (i: number) => again(children, { ...way, keepWord: i === 0 }), buttons: true }]),
    ...(subtags ? [{ label: `${one ? "Its" : "Their"} subtags too (${subtags})`, on: children, toggled: () => again(!children, way) }] : []),
  ];
  return {
    label: `Remove ${what}${where}`,
    pages: (catalog) => (one ? pagesWith(catalog, tags[0]!, children) : [...new Set(tags.flatMap((tag) => pagesWith(catalog, tag, children)))].sort((a, b) => a.localeCompare(b))),
    change: (p) => p.tags.remove(tags, { subtags: children, from: way.from, keepWord: way.keepWord }),
    done: (pages, changes) => `Removed ${what}${where}: ${counted(changes, "tag")} on ${counted(pages, "page")}`,
    options,
  };
}

export function removeOperation(tag: string, children: boolean, subtags = 0, way: Removal = KEEP_WORD): Operation {
  return removal([tag], children, subtags, way, (children, way) => removeOperation(tag, children, subtags, way));
}

/** Several tags removed everywhere they are used (with `children`, the tags under each too) */
export function removeManyOperation(tags: readonly string[], children: boolean, subtags = 0, way: Removal = KEEP_WORD): Operation {
  return removal(tags, children, subtags, way, (children, way) => removeManyOperation(tags, children, subtags, way));
}

export function removeModule(_host: ModuleHost): TagsModule {
  return {
    tagActions: () => [
      {
        id: "remove",
        label: "Remove tag…",
        danger: true,
        key: "Delete",
        run: (tag, host) => removeOperation(tag, false, subtagsOf(host.catalog, tag).length),
      },
    ],
    tagsActions: () => [
      {
        id: "remove.many",
        label: "Remove {n} tags…",
        danger: true,
        key: "Delete",
        run: (tags, host) => removeManyOperation(tags, false, new Set(tags.flatMap((tag) => subtagsOf(host.catalog, tag))).size),
      },
    ],
  };
}
