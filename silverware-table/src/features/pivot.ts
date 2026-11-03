// The pivot module: a table whose metadata row defines it a pivot of another
// (pivot.source, pivot.rows… in the formulas' language: pivot/definition.ts)
// is calculated from it (pivot/pivot.ts) and written: with each write of its
// source, in the same edit (otherTablesWritten), and with each of its own
// (writeStep: Refresh is a write that changes nothing else). Shown out of
// date (its source edited by hand), its Refresh says so. Its headers' names
// are the user's: one renamed is kept (pivot.headers, by what each column
// stands for, as the core follows a column's attributes by place, not by
// what a pivot's column is). Formulas are calculated by the formulas
// module's cells; without it, nothing is.
import type { Feature, ModelHost, TableInfo, ToolbarButton, WriteEdit } from "../core/feature.ts";
import { followOwnFormula, type FormulaCells, type FormulasOffer } from "../formulas/index.ts";
import { ICONS } from "../icons.ts";
import { escapeCell, type PageTable, pageTablesOf, parseTable, type Table, unescapeCell } from "../markdown.ts";
import { definitionAttributes, groupFormula, KEYS, type Key, type PivotDefinition, readDefinition } from "../pivot/definition.ts";
import { type Pivot as Calculated, pivotOf } from "../pivot/pivot.ts";

/** The headers the user named, by what each column stands for (PivotColumn.id) */
type Renames = Readonly<Record<string, string>>;

export class Pivot implements Feature {
  // Whether a pivot shown is out of date (or why it cannot be calculated), as last read
  private readonly stale = new WeakMap<TableInfo, string | boolean>();

  constructor(private readonly host: ModelHost) {}

  private cells(): FormulaCells | undefined {
    return this.host.offered<FormulasOffer>("formulas")?.cells;
  }

  private definitionOf(table: Table): PivotDefinition | { readonly problem: string } | undefined {
    return readDefinition((key: Key) => this.host.getMeta(table, key));
  }

  private renamesOf(table: Table): Renames {
    try {
      const read = JSON.parse(this.host.getMeta(table, "headers") ?? "{}") as unknown;
      return read && typeof read === "object" ? (read as Renames) : {};
    } catch {
      return {};
    }
  }

  /** The source the definition names among the page's tables: the first of that name, not the pivot itself */
  private sourceIn(tables: readonly PageTable[], name: string, except: number): Table | undefined {
    const wanted = name.trim().toLowerCase();
    return tables.find((t) => t.range.from !== except && this.host.tableName(t.table)?.trim().toLowerCase() === wanted)?.table;
  }

  /** The pivot table written as calculated: its headers (the user's names kept), its cells, numbers right-aligned; its metadata as it was */
  private written(table: Table, pivot: Calculated, renames: Renames): Table {
    const header = pivot.columns.map((column) => escapeCell(renames[column.id] ?? column.header));
    const kept = Object.fromEntries(Object.entries(renames).filter(([id]) => pivot.columns.some((column) => column.id === id)));
    const rows = [{ cells: header }, ...pivot.body.map((cells) => ({ cells: cells.map(escapeCell) }))];
    const align = pivot.columns.map((column): Table["align"][number] => (column.numeric ? "right" : ""));
    // (Its delimiter row as written where its columns are aligned as before)
    const same = align.length === table.align.length && align.every((a, i) => a === table.align[i]);
    const made: Table = same ? { ...table, rows } : { ...table, rows, align, delimiterSource: undefined, alignSource: undefined };
    return this.host.setMeta(made, "headers", Object.keys(kept).length ? JSON.stringify(kept) : undefined);
  }

  /** The pivot calculated from a source, or why it cannot be */
  private calculate(definition: PivotDefinition, source: Table | undefined): Calculated | string {
    const cells = this.cells();
    if (!cells) return "it needs the formulas module, which is off";
    if (!source) return `no table named ${definition.source} on this page`;
    return pivotOf(source, definition, { cells, name: definition.source });
  }

  /** A pivot written: calculated anew from its source as the page has it, a header the user renamed in it kept */
  writeStep(before: Table, after: Table, edit: WriteEdit): Table {
    const definition = this.definitionOf(after);
    if (!definition || "problem" in definition) return after;
    const pivot = this.calculate(definition, this.sourceIn(edit.page.tables, definition.source, edit.page.from));
    if (typeof pivot === "string") return after;
    const renames: Record<string, string> = { ...this.renamesOf(after) };
    // A header renamed in this edit: its name kept for the column it is (the pivot as shown is as calculated now)
    const was = before.rows[0]?.cells ?? [];
    const now = after.rows[0]?.cells ?? [];
    if (now.length === pivot.columns.length) {
      now.forEach((cell, i) => {
        if (cell === was[i]) return;
        const column = pivot.columns[i]!;
        const name = unescapeCell(cell).trim();
        if (!name || name === column.header) delete renames[column.id];
        else renames[column.id] = name;
      });
    }
    return this.written(after, pivot, renames);
  }

  /** The page's pivots of the table written, calculated anew in the same edit (a renamed source's new name written in them) */
  otherTablesWritten(before: Table, after: Table | undefined, edit: WriteEdit): readonly PageTable[] {
    if (!after) return [];
    const oldName = this.host.tableName(before)?.trim().toLowerCase();
    const newName = this.host.tableName(after)?.trim();
    if (!oldName && !newName) return [];
    const out: PageTable[] = [];
    for (const { range, table } of edit.page.tables) {
      if (range.from === edit.page.from) continue;
      const definition = this.definitionOf(table);
      if (!definition || "problem" in definition) continue;
      const source = definition.source.trim().toLowerCase();
      if (source !== oldName && source !== newName?.toLowerCase()) continue;
      // Its definition following the edit: the source's new name, its columns renamed or moved
      const { definition: followed, moved } = this.followed({ ...definition, source: newName ?? definition.source }, before, after, edit);
      const named = this.withDefinition(table, followed);
      const pivot = this.calculate(followed, after);
      if (typeof pivot === "string") continue;
      // The headers the user named, by what their columns stand for now
      const renames = Object.fromEntries(Object.entries(this.renamesOf(table)).map(([id, name]) => [movedId(id, moved), name]));
      const written = this.written(named, pivot, renames);
      if (JSON.stringify(written.rows.map((r) => r.cells)) !== JSON.stringify(table.rows.map((r) => r.cells)) || written.meta !== table.meta) out.push({ range, table: written });
    }
    return out;
  }

  /**
   * A definition after an edit of its source: its formulas' references to the
   * source's columns following it (renamed, moved: followOwnFormula, as a
   * table's own formulas follow its edits), a column named alone (`region`)
   * still named alone, the sort's keys the items they were
   */
  private followed(definition: PivotDefinition, before: Table, after: Table, edit: WriteEdit): { definition: PivotDefinition; moved: ReadonlyMap<string, string> } {
    const cells = this.cells();
    if (!cells || (!edit.columnMap && before.rows[0]?.cells.join("|") === after.rows[0]?.cells.join("|"))) return { definition, moved: new Map() };
    const following = { cells, ...(edit.rowMap ? { rowMap: edit.rowMap } : {}), ...(edit.columnMap ? { columnMap: edit.columnMap } : {}) };
    const formula = (text: string) => followOwnFormula(`=${text}`, before, after, following).slice(1);
    const group = (item: string) => {
      const made = groupFormula(item);
      const now = formula(made);
      const alone = made !== item && /^\[@([^\]]+)\]$/.exec(now)?.[1];
      return alone && /^[\p{L}\p{N} _]+$/u.test(alone) ? alone : now;
    };
    const moved = new Map<string, string>();
    const each = (items: readonly string[], f: (item: string) => string) =>
      items.map((item) => {
        const now = f(item);
        moved.set(item, now);
        return now;
      });
    const rows = each(definition.rows, group);
    const columns = each(definition.columns, group);
    const values = each(definition.values, formula);
    return {
      definition: {
        ...definition,
        rows,
        columns,
        values,
        ...(definition.where ? { where: formula(definition.where) } : {}),
        sort: definition.sort.map((key) => ({ ...key, by: moved.get(key.by) ?? key.by })),
      },
      moved,
    };
  }

  /** The table with a definition's attributes (those it leaves out taken off) */
  private withDefinition(table: Table, definition: PivotDefinition): Table {
    const written = new Map(definitionAttributes(definition));
    return KEYS.reduce((t, key) => (this.host.getMeta(t, key) === written.get(key) ? t : this.host.setMeta(t, key, written.get(key))), table);
  }

  /** A pivot shown: whether it is as its source makes it now (its source edited by hand, on this page: not) */
  enhanced(info: TableInfo): void {
    const table = parseTable(info.source);
    const definition = this.definitionOf(table);
    if (!definition) return void this.stale.delete(info);
    if ("problem" in definition) return void this.stale.set(info, `This pivot cannot be calculated: ${definition.problem}`);
    const tables = pageTablesOf(this.host.pageText);
    const own = tables.find((t) => t.table.rows[0]?.cells.join("|") === table.rows[0]?.cells.join("|") && this.host.getMeta(t.table, "source") === definition.source);
    const pivot = this.calculate(definition, this.sourceIn(tables, definition.source, own?.range.from ?? -1));
    if (typeof pivot === "string") return void this.stale.set(info, `This pivot cannot be calculated: ${pivot}`);
    const now = this.written(table, pivot, this.renamesOf(table));
    this.stale.set(info, JSON.stringify(now.rows.map((r) => r.cells)) !== JSON.stringify(table.rows.map((r) => r.cells)));
    this.host.toolbarChanged();
  }

  /** A pivot's cells are calculated: its header alone is the user's (its names) */
  readOnly(table: Table, cell: { readonly row: number }): string | undefined {
    if (cell.row === 0 || !this.definitionOf(table)) return undefined;
    return `this table is a pivot of ${this.host.getMeta(table, "source")}: its values are calculated. Edit ${this.host.getMeta(table, "source")}, or what the pivot shows in its definition`;
  }

  /** A pivot's rows and columns are its calculation's */
  fixedShape(table: Table): string | undefined {
    return this.definitionOf(table) ? `this table is a pivot of ${this.host.getMeta(table, "source")}: its rows and columns come from it` : undefined;
  }

  /** Refresh, in a pivot's toolbar: highlighted where it is out of date */
  toolbarButtons(info: TableInfo): ToolbarButton[] {
    const state = this.stale.get(info);
    if (state === undefined) return [];
    const problem = typeof state === "string" ? state : undefined;
    return [
      {
        label: "Refresh pivot",
        place: "icon",
        icon: ICONS.recalculate,
        attention: state !== false,
        title: problem ?? (state ? "Refresh pivot: it is out of date (its source was changed outside Silverware Table)" : "Refresh pivot (it is up to date)"),
        // A write of the pivot calculates it anew (writeStep)
        run: () => void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => t),
      },
    ];
  }
}

/** A column's id (PivotColumn.id: row:<group>, value:<value>, column:<key>|<value>, total|<value>) with its items as they are written now */
function movedId(id: string, moved: ReadonlyMap<string, string>): string {
  const m = /^(row:|value:|total\||column:[^|]*\|)(.*)$/.exec(id);
  return m ? m[1]! + (moved.get(m[2]!) ?? m[2]!) : id;
}
