// The panel module: the tags as a panel beside the page, always at hand, as
// rows a host draws as a tree by "/" (SilverBullet's navigator, wired by the
// library page's Lua: this module knows nothing of it). Each row a tag with
// the pages using it and where (a page's tag, a task's, an item's), a level
// above tags a row too. Picked, the window opens at it; F2, at it with its name
// to type; dragged under another level, the rename is reviewed (through the
// rename module's offer: off, the drag is refused and said).
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { PANEL_OFFER, type PanelOffer, type PanelRow, RENAME_OFFER, type RenameOffer } from "../core/offers.ts";
import { hashtagOf, isMetaTag } from "../tags/names.ts";

/** The rows of a catalog's tags (each tag; the levels above them are the host's tree's folders) */
export function panelRows(tags: Iterable<{ readonly name: string; readonly pages: ReadonlySet<string>; readonly byContext: ReadonlyMap<string, ReadonlySet<string>> }>): PanelRow[] {
  return [...tags]
    .map((tag) => ({
      name: tag.name,
      label: tag.name.slice(tag.name.lastIndexOf("/") + 1),
      count: tag.pages.size,
      onPages: tag.byContext.has("page"),
      inTasks: tag.byContext.has("task"),
      inItems: tag.byContext.has("item"),
      meta: isMetaTag(tag.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function panelModule(host: ModuleHost): TagsModule {
  const offer: PanelOffer = {
    rows: async () => panelRows((await host.catalog()).tags.values()),
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
  host.offer(PANEL_OFFER, offer);
  return {};
}
