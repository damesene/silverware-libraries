// Removing what Silverware Table stores in tables: the metadata row and the
// hidden tags in cells (tags.ts: formulas, whose cells keep their results,
// names), whatever module keeps them. The question asked first says whose it
// is, from the attributes' names (`<owner>.…`, metanames.ts): nothing a module
// says itself, a module turned off is named as well.
// For one table from its toolbar, for all tables of the page with the
// "Silverware Table: Remove table metadata" command, for cells, rows or
// columns from their menu (a column's attributes in the metadata row too).
// The core's; what a table stores beyond its content, and the table without
// it, are its store's (BoundStore.metadataOf, withoutMetadata: the markdown
// store's metadata row and hidden tags, those of no column too, which no
// model holds), written as any change: the features follow it (formulas
// referring to a name gone, a sheet's data handed on).
import { FEATURE_NAMES, MODULE_LABELS } from "../bridge.ts";
import { CELL_MENU_ORDER, type CellMenuGroup, type CellRef, type Feature, type MetadataPart, type StoredMetadata, type TableHost, type ToolbarButton, type TableInfo } from "./feature.ts";
import type { LineMenuBuilder, LineMenuGroup, LineMenuTarget } from "./feature.ts";
import { ICONS } from "../icons.ts";
import type { MenuEntry } from "../menu.ts";
import { CORE } from "../metanames.ts";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** An owner as the question names it: Silverware Table for the core, a module by its label */
function ownerLabel(owner: string): string {
  if (owner === CORE) return "Silverware Table";
  const module = FEATURE_NAMES.find((name) => name.toLowerCase() === owner);
  return module ? MODULE_LABELS[module] : "others";
}

/**
 * Whose the tables' metadata is, as the question says it: each owner (the
 * core first, then in the order found) with how many of its cells hold some
 */
export function metadataOwners(stored: readonly StoredMetadata[]): string[] {
  const owners = new Map<string, number>();
  for (const one of stored) for (const { owner, cells } of one.owners) owners.set(owner, (owners.get(owner) ?? 0) + cells);
  const ordered = [...owners].sort(([a], [b]) => (a === CORE ? -1 : b === CORE ? 1 : 0));
  return ordered.map(([owner, cells]) => `${ownerLabel(owner)}${cells ? ` (${plural(cells, "cell")})` : ""}`);
}

/** Owners listed in a sentence: "a, b and c" */
function listed(items: readonly string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : (items[0] ?? "");
}

/** What a question says it removes: whose it is (none found: an empty metadata row) */
function whose(owners: readonly string[], where: string): string {
  return owners.length ? `, what ${listed(owners)} keep${owners.length === 1 ? "s" : ""} in ${where}` : "";
}

// What the question says of what stays
const KEPT = "Cells keep their text, a formula's cell its result.";

export class Metadata implements Feature {
  constructor(private readonly host: TableHost) {}

  toolbarButtons(info: TableInfo): ToolbarButton[] {
    if (!this.host.storedMetadata(info.model, "all").any) return [];
    return [
      {
        label: "Remove metadata",
        icon: ICONS.trash,
        danger: true,
        title: "Remove this table's <meta> tags: its stored settings (sorting, filters, pinning, name, theme, stripes) and what its cells keep (formulas, which keep their results, names)",
        run: () => void this.removeFromTable(info),
      },
    ];
  }

  /** Remove metadata in the menu of a cell or of the cells selected, last (with deleting) */
  cellMenuEntries(info: TableInfo, cells: readonly CellRef[]): CellMenuGroup | undefined {
    const entry = this.partEntry(info, { cells, columns: new Set() }, cells.length === 1 ? "this cell" : `these ${cells.length} cells`);
    return entry && { order: CELL_MENU_ORDER.deleting, entries: [entry] };
  }

  /** Remove metadata in the menu of rows (columns): their cells, a column's header too, and the columns' attributes */
  lineMenu(info: TableInfo, { axis, lines }: LineMenuTarget, menu: LineMenuBuilder): LineMenuGroup[] {
    const rows = axis === "row" ? lines : Array.from({ length: info.rows }, (_, row) => row);
    const columns = axis === "row" ? Array.from({ length: info.columns }, (_, column) => column) : lines;
    const part = { cells: rows.flatMap((row) => columns.map((column) => ({ row, column }))), columns: new Set(axis === "column" ? lines : []) };
    const entry = this.partEntry(info, part, lines.length === 1 ? `this ${axis}` : `these ${lines.length} ${axis}s`);
    return entry ? [menu.slot.remove([entry])] : [];
  }

  /** Remove metadata for a part of the table, where it has some */
  private partEntry(info: TableInfo, part: MetadataPart, what: string): MenuEntry | undefined {
    if (!this.host.storedMetadata(info.model, part).any) return undefined;
    return {
      kind: "item",
      label: "Remove metadata",
      icon: ICONS.trash,
      danger: true,
      hint: `Remove the <meta> tags of ${what}: formulas (their cells keep their results), names${part.columns.size ? ", the columns' stored settings (sorting, filters, widths)" : ""}`,
      run: () => void this.removeFromPart(info, part, what),
    };
  }

  /** Removes the metadata of a part of a table, once confirmed */
  private async removeFromPart(shownInfo: TableInfo, part: MetadataPart, what: string): Promise<void> {
    const owners = metadataOwners([this.host.storedMetadata(shownInfo.model, part)]);
    if (!(await this.host.ask(`Remove the metadata of ${what}${whose(owners, what.startsWith("this ") ? "it" : "them")}? ${KEPT} Ctrl+Z brings it back.`))) return;
    // The table as rendered now: the dialog may have outlived the rendering it was asked from
    const info = this.host.tableFor(shownInfo.key) ?? shownInfo;
    if (this.host.storedMetadata(info.model, part).settings) this.host.forgetStoredView(info.key);
    await this.host.writeTable(info, (table) => this.host.withoutStoredMetadata(table, part));
    // The dialog took the focus: back to the editor, so Ctrl+Z works right away
    this.host.focusPage();
  }

  /**
   * Removes a table's metadata, once confirmed: its metadata row (a sorting
   * stored there goes with it: the rows show as written) and the formulas of
   * its cells, which keep their results as plain values
   */
  private async removeFromTable(shownInfo: TableInfo): Promise<void> {
    const owners = metadataOwners([this.host.storedMetadata(shownInfo.model, "all")]);
    if (!(await this.host.ask(`Remove this table's metadata${whose(owners, "it")}? ${KEPT} Ctrl+Z brings it back.`))) return;
    // The table as rendered now: the dialog may have outlived the rendering it was asked from
    const info = this.host.tableFor(shownInfo.key) ?? shownInfo;
    if (this.host.storedMetadata(info.model, "all").settings) this.host.forgetStoredView(info.key);
    await this.host.writeTable(info, (table) => this.host.withoutStoredMetadata(table, "all"));
    // The dialog took the focus: back to the editor, so Ctrl+Z works right away
    this.host.focusPage();
  }

  /** Removes the metadata of all tables on the current page, once confirmed */
  async removeFromPage(): Promise<void> {
    const { host } = this;
    const page = await host.pageNameNow();
    // The page's tables as read now, those that store some
    const tables = ((await host.tables(page)) ?? []).map((t) => ({ key: t.key, stored: host.storedMetadata(t.model, "all") })).filter((t) => t.stored.any);
    if (tables.length === 0) {
      host.notify("Silverware Table: no table on this page has metadata", "info");
      return;
    }
    const owners = metadataOwners(tables.map((t) => t.stored));
    const question =
      `Remove the metadata of ${tables.length === 1 ? "the 1 table" : `all ${tables.length} tables`} on this page` +
      `${whose(owners, tables.length === 1 ? "it" : "them")}? ${KEPT} Ctrl+Z brings it back.`;
    if (!(await this.host.ask(question))) return;
    for (const t of tables) if (t.stored.settings) host.forgetStoredView(t.key);
    // One edit of all those tables, so one Ctrl+Z undoes it
    await host.replaceTables(page, tables.map((t) => ({ key: t.key, change: (table) => host.withoutStoredMetadata(table, "all") })));
    // The dialog took the focus: back to the editor, so Ctrl+Z works right away
    this.host.focusPage();
    host.notify(`Silverware Table: removed the metadata of ${tables.length} table(s)`, "info");
  }
}
