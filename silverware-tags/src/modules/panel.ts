// The panel module: the tags as a panel beside the page, always at hand, as
// rows a host draws as a tree by "/" (SilverBullet's navigator, wired by the
// init page's Lua: this module knows nothing of it). Each row a tag with
// the pages using it and where (a page's tag, a task's, an item's), a level
// above tags a row too, counting the pages of the tags under it. Its actions:
// Add to the page open, or for one of its own tags Remove from the page open
// (at once, with Undo), Open in the Tags window, and the other modules' row
// actions (`panelActions`: Rename, the rename module's); dragged under another level, the
// rename is reviewed (through the rename module's offer: off, the drag is
// refused and said). A click does nothing more than the tree does (a level
// opens); a double click opens the window at it, as its action does. The tags of the page open are
// marked `here`, and shown first where the setting says so (else by name).
import type { Catalog } from "../core/catalog.ts";
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { type PanelOffer, type PanelRow, RENAME_OFFER, type RenameOffer } from "../core/offers.ts";
import { pageTags } from "../../../shared/pages/tags/edit.ts";
import { hashtagOf } from "../../../shared/markdown/inline.ts";
import { isMetaTag, isWithin } from "../../../shared/pages/tags/names.ts";

/**
 * The rows of a catalog's tags: each tag, and each level above tags (a row of
 * its own, so the host's tree shows its count too: a host's tree merges a row
 * into the folder of its path). A row with tags under it counts the pages
 * using it or any of them, each page once; one without, the pages using it
 */
export function panelRows(catalog: Catalog, page?: string, own: ReadonlySet<string> = new Set(), pageFirst = false): PanelRow[] {
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
    // By name; with `pageFirst` the page open's first (a host's tree keeps the rows' order: SilverBullet's, its sort stable)
    .sort((a, b) => (pageFirst ? Number(b.here) - Number(a.here) : 0) || a.name.localeCompare(b.name));
}

// Two clicks of a row this close are a double click (the window opened at it)
const DOUBLE_CLICK_MS = 400;

/** The panel's own setting (bridge.ts reads it; a module knows nothing of how) */
export type PanelSettings = { readonly pageFirst: boolean };

export function panelModule(host: ModuleHost, settings: PanelSettings): TagsModule {
  const onPage = async (tag: string, verb: "add" | "remove") => {
    const page = await host.space.currentPage();
    if (!page) {
      host.notifier.flash("Silverware Tags: no page is open", "error");
      return;
    }
    // One page, the user's own ask: applied at once (said, with Undo; through the editor, Ctrl+Z there too)
    await host.apply({
      label: `Tags of ${page}: ${verb} ${hashtagOf(tag)}`,
      pages: () => [page],
      change: (p) => (verb === "add" ? p.tags.add(tag) : p.tags.remove(tag, { from: "pageTags" })),
      done: () => `${page}: ${verb === "add" ? "added" : "removed"} ${hashtagOf(tag)}`,
    });
  };
  // The last click (its tag and when), told apart from a double click
  let last: { readonly tag: string; readonly at: number } | undefined;
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
      const actions = host.panelActions();
      return panelRows(await host.catalog(), page, own, settings.pageFirst).map((row) => ({ ...row, can: Object.fromEntries(actions.map((action) => [action.id, action.when?.(row) ?? true])) }));
    },
    actions: () => host.panelActions().map(({ id, icon, label, key }) => ({ id, icon, label, ...(key ? { key } : {}) })),
    clicked: async (tag) => {
      const now = Date.now();
      const twice = last?.tag === tag && now - last.at < DOUBLE_CLICK_MS;
      last = twice ? undefined : { tag, at: now };
      if (twice) await host.open("tags", tag);
    },
    run: async (id, tag) => {
      await host.panelActions().find((action) => action.id === id)?.run(tag);
    },
    move: async (tag, to) => {
      const rename = host.offered<RenameOffer>(RENAME_OFFER);
      if (!rename) {
        host.notifier.flash("Silverware Tags: moving a tag renames it, and Rename is turned off", "error");
        return;
      }
      // (Under itself, its subtags with it, the level dropped on would move under its own new name)
      const problem = to !== tag && isWithin(to, tag) ? "a tag cannot move under itself" : rename.validate(tag, to);
      if (problem) {
        host.notifier.flash(`Silverware Tags: ${hashtagOf(tag)} to ${hashtagOf(to)}: ${problem}`, "error");
        return;
      }
      await rename.review(tag, to);
    },
  };
  host.offer(offer);
  return {
    // Its own row actions, among the other modules' (Rename is the rename module's)
    panelActions: () => [
      { id: "panel.add", icon: "plus", label: "Add to the page open", order: 10, when: (row) => !row.level && !row.own, run: (tag) => onPage(tag, "add") },
      // One of the page open's own tags: taken off it instead
      { id: "panel.remove", icon: "minus", label: "Remove from the page open", order: 10, when: (row) => row.own, run: (tag) => onPage(tag, "remove") },
      { id: "panel.open", icon: "external-link", label: "Open in the Tags window", order: 90, run: (tag) => host.open("tags", tag) },
    ],
  };
}
