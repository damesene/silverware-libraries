// The panel module: the tags as a panel beside the page, always at hand, as
// rows a host draws as a tree by "/" (SilverBullet's navigator, wired by the
// library page's Lua: this module knows nothing of it). Each row a tag with
// the pages using it and where (a page's tag, a task's, an item's), a level
// above tags a row too, counting the pages of the tags under it. Its actions:
// Add to the page open, or for one of its own tags Remove from the page open
// (at once, with Undo), Open in the Tags window; F2 opens
// the window at it with its name to type; dragged under another level, the
// rename is reviewed (through the rename module's offer: off, the drag is
// refused and said). A click does nothing more than the tree does (a level
// opens): the window is one of the actions. The tags of the page open are
// marked `here`: the host shows them first.
import type { Catalog } from "../core/catalog.ts";
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { type PanelOffer, type PanelRow, RENAME_OFFER, type RenameOffer } from "../core/offers.ts";
import { addPageTags, pageTags, removePageTags } from "../tags/edit.ts";
import { hashtagOf, isMetaTag, isWithin } from "../tags/names.ts";

/**
 * The rows of a catalog's tags: each tag, and each level above tags (a row of
 * its own, so the host's tree shows its count too: a host's tree merges a row
 * into the folder of its path). A row with tags under it counts the pages
 * using it or any of them, each page once; one without, the pages using it
 */
export function panelRows(catalog: Catalog, page?: string, own: ReadonlySet<string> = new Set()): PanelRow[] {
  // Each tag added to its own row and to every level above it, in one pass over the tags
  const rows = new Map<string, { pages: Set<string>; contexts: Set<string>; parent: boolean }>();
  for (const tag of catalog.tags.values()) {
    const parts = tag.name.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const name = parts.slice(0, i).join("/");
      let row = rows.get(name);
      if (!row) rows.set(name, (row = { pages: new Set(), contexts: new Set(), parent: false }));
      for (const page of tag.pages) row.pages.add(page);
      for (const context of tag.byContext.keys()) row.contexts.add(context);
      if (i < parts.length) row.parent = true;
    }
  }
  return [...rows]
    .map(([name, row]) => ({
      name,
      label: name.slice(name.lastIndexOf("/") + 1),
      count: row.pages.size,
      level: !catalog.tags.has(name),
      parent: row.parent,
      onPages: row.contexts.has("page"),
      inTasks: row.contexts.has("task"),
      inItems: row.contexts.has("item"),
      meta: isMetaTag(name),
      here: page !== undefined && row.pages.has(page),
      own: own.has(name),
    }))
    // The page open's first (a host's tree keeps the rows' order: SilverBullet's, its sort stable), then by name
    .sort((a, b) => Number(b.here) - Number(a.here) || a.name.localeCompare(b.name));
}

export function panelModule(host: ModuleHost): TagsModule {
  const offer: PanelOffer = {
    rows: async () => {
      const page = await host.space.currentPage();
      // Its own tags as its text has them now (the index's a moment late after the row's + or −)
      let own = new Set<string>();
      if (page)
        try {
          own = new Set(pageTags(await host.space.read(page)));
        } catch {
          // (A page not read: none marked its own)
        }
      return panelRows(await host.catalog(), page, own);
    },
    select: (tag) => host.open("tags", tag),
    addToPage: async (tag) => {
      const page = await host.space.currentPage();
      if (!page) {
        host.notifier.flash("Silverware Tags: no page is open", "error");
        return;
      }
      // One page, the user's own ask: applied at once (said, with Undo; through the editor, Ctrl+Z there too)
      await host.apply({
        label: `Tags of ${page}: add ${hashtagOf(tag)}`,
        pages: () => [page],
        edit: (text) => addPageTags(text, [tag]),
        done: () => `${page}: added ${hashtagOf(tag)}`,
      });
    },
    removeFromPage: async (tag) => {
      const page = await host.space.currentPage();
      if (!page) {
        host.notifier.flash("Silverware Tags: no page is open", "error");
        return;
      }
      await host.apply({
        label: `Tags of ${page}: remove ${hashtagOf(tag)}`,
        pages: () => [page],
        edit: (text) => removePageTags(text, [tag]),
        done: () => `${page}: removed ${hashtagOf(tag)}`,
      });
    },
    rename: (tag) => host.open("tags", { tag, focus: "name" }),
    move: async (tag, to) => {
      const rename = host.offered<RenameOffer>(RENAME_OFFER);
      if (!rename) {
        host.notifier.flash("Silverware Tags: moving a tag renames it, and Rename is turned off", "error");
        return;
      }
      // (Under itself, its subtags with it, the level dropped on would move under its own new name)
      const problem = to !== tag && isWithin(to, tag) ? "a tag cannot move under itself" : rename.problem(tag, to);
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
