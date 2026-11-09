// What is to change in pages, as data in the model's terms: a property set,
// tags renamed, a page renamed. A plugin makes it with the builder and hands
// it to the page writer (writer.ts), the one place that knows how anything is
// written in a page. The builder's sections are the parts' (parts.ts), so it
// imports their registry; nothing here reads or writes a page's text.
//
//   const changes = pageChanges()
//     .page("Projects/Fix login", (p) => p.properties.set("status", "Done").tags.rename("bug", "defect"))
//     .page("Projects/Write docs", (p) => p.tags.add("docs"))
//     .create("Projects/Plan", (p) => p.properties.set(["_database", "rank"], "a2").body("Notes"))
//     .page("Projects/Old", (p) => p.remove())
//     .build();
import { type PageChange, type PageSections, PARTS } from "./parts.ts";
import type { EditResult } from "./tags/edit.ts";

// The changes' types are their parts', given here to whoever builds them
export type { PageChange, PageSections, PropertyPath, PropertyValue, TagsFrom, TagsRemoval } from "./parts.ts";

/**
 * A page's changes: its content's in the order made, and its new name (made
 * first); `create`: the page is made (none of that name may be there), its
 * content made by its changes from nothing; `remove`: the page is taken out
 * of the space (no other change of it)
 */
export type PageEntry = { readonly page: string; readonly renameTo?: string; readonly create?: true; readonly remove?: true; readonly changes: readonly PageChange[] };

/** The changes of a batch, a page once */
export type Changes = readonly PageEntry[];

/** A page's changes as they are made: its content's by section, its own (its name) on it; one chain holds them all */
export interface PageBuilder extends PageSections {
  /** The page given a new name (links to it followed where the platform does), before its content changes */
  rename(to: string): PageBuilder;
  /** The text edited by a function of it: only for a user's script, which the model cannot hold */
  editText(edit: (text: string) => EditResult | Promise<EditResult>): PageBuilder;
  /** Its body (all after its frontmatter) made this text; `was`: only where it is still that (as the plugin read it) */
  body(text: string, was?: string): PageBuilder;
  /** The page taken out of the space (Undo makes it again where its name is still free) */
  remove(): PageBuilder;
}

/** A batch of changes made page by page; `build()` gives them as frozen data, the builder no longer used */
export class ChangesBuilder {
  private readonly pages = new Map<string, { renameTo?: string; create?: true; remove?: true; changes: PageChange[] }>();
  private built = false;

  /** A page made, its content made by `make` from nothing (a page of that name there already: left alone) */
  create(name: string, make?: (page: PageBuilder) => unknown): this {
    if (this.pages.has(name)) throw new Error(`the page "${name}" is named in this batch already`);
    this.pages.set(name, { create: true, changes: [] });
    return this.page(name, make ?? (() => {}));
  }

  /** A page's changes made by `make` (a page named again: its changes after those made before) */
  page(name: string, make: (page: PageBuilder) => unknown): this {
    if (this.built) throw new Error("these changes were built already: make a new builder");
    let entry = this.pages.get(name);
    if (!entry) this.pages.set(name, (entry = { changes: [] }));
    const target = entry;
    const add = (change: PageChange): PageBuilder => {
      target.changes.push(change);
      return builder;
    };
    // The sections as the parts make them, the page's own methods beside them
    const sections = Object.fromEntries(PARTS.flatMap((one) => (one.section ? [[one.section.name, one.section.make(add)]] : [])));
    const builder: PageBuilder = {
      ...(sections as unknown as PageSections),
      rename: (to) => {
        target.renameTo = to;
        return builder;
      },
      editText: (edit) => add({ kind: "editText", edit }),
      body: (text, was) => add({ kind: "setBody", text, ...(was === undefined ? {} : { was }) }),
      remove: () => {
        target.remove = true;
        return builder;
      },
    };
    make(builder);
    return this;
  }

  /** The changes as frozen data, pages in the order first named; the builder is done */
  build(): Changes {
    this.built = true;
    return Object.freeze(
      [...this.pages].map(([page, { renameTo, create, remove, changes }]) =>
        Object.freeze({ page, ...(renameTo === undefined ? {} : { renameTo }), ...(create ? { create } : {}), ...(remove ? { remove } : {}), changes: Object.freeze(changes.map(frozen)) }),
      ),
    );
  }
}

/** A change frozen whole: its lists too (the tags, a list's value) */
function frozen(change: PageChange): PageChange {
  for (const value of Object.values(change)) if (Array.isArray(value)) Object.freeze(value);
  return Object.freeze(change);
}

/** A builder of a batch of changes */
export function pageChanges(): ChangesBuilder {
  return new ChangesBuilder();
}
