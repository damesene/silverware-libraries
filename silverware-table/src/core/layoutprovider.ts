// Silverware Table's provider for Silverware Layout (shared/layout.ts, docs/silverware-layout.md): its tables are
// widgets Silverware Layout lays out. The core's, as the public API for other plugins is (writelisteners.ts): it names
// no module. A table keeps Silverware Layout's entries in its metadata under the owner `layout` (`layout.width`), as it
// keeps anyone's, without reading their meaning. Read from the table as rendered (its metadata row's <meta>, before
// the browser lays it out: as a table's look is read), so Silverware Layout lays it out before it is painted; written
// through the core's write (one edit). With the metadata setting off nothing new is stored: the write says so.
import type { LayoutChanges, LayoutEntries, LayoutProvider } from "../../../shared/layout.ts";
import { renderedTable, WIDGET_SELECTOR } from "../dom.ts";
import type { Table } from "../markdown.ts";
import type { WriteResult } from "./feature.ts";
import { ownMeta } from "./metaaccess.ts";
import { renderedMeta } from "./silverbullet/adapter.ts";

/** The owner of Silverware Layout's attributes in a table's metadata */
export const LAYOUT_OWNER = "layout";

/** What the provider asks of the core */
export type LayoutTables = {
  // A rendered table's rows as SilverBullet rendered them (some may be out of the document: largeTables)
  renderedRows(table: HTMLTableElement): readonly HTMLTableRowElement[];
  // Whether a widget is enhanced (known in the page's markdown), so it can be written
  enhanced(widget: HTMLElement): boolean;
  write(widget: HTMLElement, change: (table: Table) => Table | undefined): Promise<WriteResult>;
  // The metadata setting
  metadataOn(): boolean;
};

export function tablesLayoutProvider(tables: LayoutTables): LayoutProvider {
  const meta = ownMeta(LAYOUT_OWNER, tables.metadataOn);
  return {
    name: "silverware-table",
    selector: WIDGET_SELECTOR,
    read: (element): LayoutEntries => {
      const table = renderedTable(element);
      const rendered = table && renderedMeta(tables.renderedRows(table));
      return rendered ? Object.fromEntries(meta.metaOf({ meta: rendered } as Table)) : {};
    },
    // A table holding its header in view (the sticky module) hides the rows that scrolled under it: what is seen of it
    // starts at its header, where the header is held lower than the table's top
    seen: (element) => {
      const head = renderedTable(element)?.tHead;
      if (!head) return undefined;
      const box = element.getBoundingClientRect();
      const held = head.getBoundingClientRect();
      return held.top > box.top + 1 ? { top: held.top, bottom: box.bottom } : undefined;
    },
    write: async (element, changes: LayoutChanges) => {
      const widget = element as HTMLElement;
      if (!tables.enhanced(widget)) return "the table is not ready yet";
      let refused = false;
      const result = await tables.write(widget, (table) => {
        let changed = table;
        for (const [key, value] of Object.entries(changes)) {
          if (value !== null && !meta.canStoreMeta(changed, key)) refused = true;
          else changed = meta.setMeta(changed, key, value ?? undefined);
        }
        return changed;
      });
      if (refused) return "Silverware Table's metadata setting is off, so a table stores nothing new";
      return result === "failed" ? "the table could not be written" : undefined;
    },
  };
}
