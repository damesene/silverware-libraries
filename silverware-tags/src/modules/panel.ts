// The panel module: the tags as a panel beside the page, always at hand, as
// rows a host draws as a tree by "/" (SilverBullet's navigator, wired by the
// library page's Lua: this module knows nothing of it). Each row a tag with
// the pages using it and where (a page's tag, a task's, an item's), a level
// above tags a row too, counting the pages of the tags under it. Picked, the window opens at it; F2, at it with its name
// to type; dragged under another level, the rename is reviewed (through the
// rename module's offer: off, the drag is refused and said).
import type { Catalog } from "../core/catalog.ts";
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { type PanelOffer, type PanelRow, RENAME_OFFER, type RenameOffer } from "../core/offers.ts";
import { hashtagOf, isMetaTag, isWithin } from "../tags/names.ts";

/**
 * The rows of a catalog's tags: each tag, and each level above tags (a row of
 * its own, so the host's tree shows its count too: a host's tree merges a row
 * into the folder of its path). A row with tags under it counts the pages
 * using it or any of them, each page once; one without, the pages using it
 */
export function panelRows(catalog: Catalog): PanelRow[] {
  const names = new Set<string>();
  for (const name of catalog.tags.keys()) name.split("/").forEach((_, i, parts) => names.add(parts.slice(0, i + 1).join("/")));
  return [...names]
    .map((name) => {
      const under = [...catalog.tags.values()].filter((tag) => isWithin(tag.name, name));
      const pages = new Set(under.flatMap((tag) => [...tag.pages]));
      const has = (context: string) => under.some((tag) => tag.byContext.has(context));
      return {
        name,
        label: name.slice(name.lastIndexOf("/") + 1),
        count: pages.size,
        level: !catalog.tags.has(name),
        parent: under.some((tag) => tag.name !== name),
        onPages: has("page"),
        inTasks: has("task"),
        inItems: has("item"),
        meta: isMetaTag(name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function panelModule(host: ModuleHost): TagsModule {
  const offer: PanelOffer = {
    rows: async () => panelRows(await host.catalog()),
    select: (tag) => host.open("tags", tag),
    rename: (tag) => host.open("tags", { tag, focus: "name" }),
    move: async (tag, to) => {
      const rename = host.offered<RenameOffer>(RENAME_OFFER);
      if (!rename) {
        host.notifier.flash("Silverware Tags: moving a tag renames it, and Rename is turned off", "error");
        return;
      }
      const problem = rename.problem(tag, to);
      if (problem) {
        host.notifier.flash(`Silverware Tags: ${hashtagOf(tag)} to ${hashtagOf(to)}: ${problem}`, "error");
        return;
      }
      await rename.review(tag, to);
    },
  };
  host.offer(offer);
  return {};
}
