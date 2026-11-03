// The pivot module: a table whose metadata row defines it a pivot of another
// (pivot.source, pivot.rows… in the formulas' language: pivot/definition.ts)
// is calculated from it (pivot/pivot.ts) and written: with each write of its
// source, in the same edit (otherTablesWritten), and with each of its own
// (writeStep: Refresh is a write that changes nothing else). Its source may
// be another page's table, read through the pageLinks module, as formulas
// read them: its edits do not write the pivot, which shows out of date once
// that page is indexed. Shown out of date (its source edited by hand, or on
// another page), its Refresh says so. Its headers' names
// are the user's: one renamed is kept (pivot.headers, by what each column
// stands for, as the core follows a column's attributes by place, not by
// what a pivot's column is). Formulas are calculated by the formulas
// module's cells; without it, nothing is.
import type { Feature, ModelHost, PageCommand, TableBadge, TableInfo, TableTarget, ToolbarButton, WriteEdit } from "../core/feature.ts";
import { followOwnFormula, type FormulaCells, type FormulasOffer, type PageLinksOffer } from "../formulas/index.ts";
import { listOf } from "../bridge.ts";
import { columnName } from "../columns.ts";
import { ICONS } from "../icons.ts";
import { escapeCell, type PageTable, pageTablesOf, parseTable, type Table, unescapeCell } from "../markdown.ts";
import { definitionAttributes, groupFormula, KEYS, type Key, looseDefinition, type PivotDefinition, readDefinition, sourceRef, sourceText, valueItem, valueParts } from "../pivot/definition.ts";
import { type Fields, fieldsOf } from "../pivot/fields.ts";
import { type Pivot as Calculated, pivotOf } from "../pivot/pivot.ts";
import { asNumber } from "../view.ts";
import { openPivotDialog } from "./pivotdialog.ts";

// What a pivot's dialog says first while the formulas module, which calculates pivots, is off
const FORMULAS_OFF = "A pivot is calculated by the formulas module, which is off: turn it on in Silverware Table's settings (the Silverware Table: Settings command), then reload.";

/** The headers the user named, by what each column stands for (PivotColumn.id) */
type Renames = Readonly<Record<string, string>>;

export class Pivot implements Feature {
  // Whether a pivot shown is out of date (or why it cannot be calculated), as last read
  private readonly stale = new WeakMap<TableInfo, string | boolean>();
  // Another page's tables (as pageLinks read them) a pivot of one of them was last checked from
  private readonly checkedFrom = new WeakMap<TableInfo, readonly PageTable[] | null>();

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

  /** The page of a source on another page (one naming the page shown is of this page) */
  private pageOf(definition: PivotDefinition): string | undefined {
    const { page } = sourceRef(definition.source);
    return page !== undefined && page !== this.host.currentPage ? page : undefined;
  }

  /** The name of a source of this page, lowercased; none for one on another page */
  private nameHere(definition: PivotDefinition): string | undefined {
    return this.pageOf(definition) === undefined ? sourceRef(definition.source).name.toLowerCase() : undefined;
  }

  /**
   * The source a definition names: among this page's tables (not the pivot,
   * at `except`), or among another page's as pageLinks read it (`unread`
   * until it has: the pivot then stays as written)
   */
  private find(definition: PivotDefinition, tables: readonly PageTable[], except: number): Found {
    const { name } = sourceRef(definition.source);
    const page = this.pageOf(definition);
    if (page === undefined) {
      const table = this.sourceIn(tables, name, except);
      return table ? { table } : { problem: `no table named ${name} on this page` };
    }
    const read = this.host.otherPages()?.tables(page);
    if (read === undefined) return { unread: page };
    if (read === null) return { problem: `no page ${page}` };
    const table = this.sourceIn(read, name, -1);
    return table ? { table } : { problem: `no table named ${name} on ${page}` };
  }

  /** Why another page cannot be read for a pivot, if so */
  private unreadable(): string | undefined {
    if (!this.host.offered<PageLinksOffer>("pageLinks") || !this.host.bridge.readPage) return "its source is on another page, which the pageLinks module reads: it is off";
    return undefined;
  }

  /** The pivot table written as calculated: its headers (the user's names kept), its cells, numbers right-aligned; its metadata as it was */
  private written(table: Table, pivot: Calculated, renames: Renames): Table {
    const header = pivot.columns.map((column) => escapeCell(renames[column.id] ?? column.header));
    const kept = Object.fromEntries(Object.entries(renames).filter(([id]) => pivot.columns.some((column) => column.id === id)));
    const rows = [{ cells: header }, ...pivot.body.map((cells) => ({ cells: cells.map(escapeCell) }))];
    const align = pivot.columns.map((column): Table["align"][number] => (column.numeric ? "right" : ""));
    // Its totals pinned (the row at the bottom, the columns at the right): they stay in view, out of a sort; other pins as they were
    const totals = { bottom: pivot.totalRow ? 1 : 0, right: pivot.totalColumns };
    // (Its delimiter row as written where its columns are aligned as before)
    const same = align.length === table.align.length && align.every((a, i) => a === table.align[i]);
    const made: Table = same ? { ...table, rows } : { ...table, rows, align, delimiterSource: undefined, alignSource: undefined };
    const pinned = this.host.withPins(made, { ...this.host.pinsOf(made), ...totals });
    return this.host.setMeta(pinned, "headers", Object.keys(kept).length ? JSON.stringify(kept) : undefined);
  }

  /** The pivot calculated from a source, or why it cannot be */
  private calculate(definition: PivotDefinition, found: Found): Calculated | string {
    const cells = this.cells();
    if (!cells) return "it needs the formulas module, which is off";
    if ("problem" in found) return found.problem;
    if ("unread" in found) return this.unreadable() ?? `${found.unread} is not read yet`;
    return pivotOf(found.table, definition, { cells, name: sourceRef(definition.source).name });
  }

  /** Before a pivot of another page's table is written: that page read anew, as formulas read the pages they refer to */
  async prepareWrite(info: TableTarget): Promise<void> {
    const definition = this.definitionOf(parseTable(info.source));
    const page = definition && !("problem" in definition) ? this.pageOf(definition) : undefined;
    if (page !== undefined) await this.host.offered<PageLinksOffer>("pageLinks")?.readPages([page], true);
  }

  /** A pivot written: calculated anew from its source as the page has it, a header the user renamed in it kept */
  writeStep(before: Table, after: Table, edit: WriteEdit): Table {
    const definition = this.definitionOf(after);
    if (!definition || "problem" in definition) return after;
    const pivot = this.calculate(definition, this.find(definition, edit.page.tables, edit.page.from));
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
    // A table of that name after another (a copy in the markdown) is not the pivots' source: they read the first
    const first = (name: string | undefined) => !!name && edit.page.tables.find((t) => this.host.tableName(t.table)?.trim().toLowerCase() === name.toLowerCase())?.range.from === edit.page.from;
    if (!first(oldName) && !first(newName)) return [];
    const out: PageTable[] = [];
    for (const { range, table } of edit.page.tables) {
      if (range.from === edit.page.from) continue;
      const definition = this.definitionOf(table);
      if (!definition || "problem" in definition) continue;
      const source = this.nameHere(definition);
      if (source === undefined || (source !== oldName && source !== newName?.toLowerCase())) continue;
      // Its definition following the edit: the source's new name (as it names it: [[This page]] kept), its columns renamed or moved
      const renamed = newName ? sourceText({ ...sourceRef(definition.source), name: newName }) : definition.source;
      const { definition: followed, moved } = this.followed({ ...definition, source: renamed }, before, after, edit);
      const named = this.withDefinition(table, followed);
      const pivot = this.calculate(followed, { table: after });
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
    // (A value's share kept as it says it)
    const values = each(definition.values, (item) => {
      const { formula: made, show } = valueParts(item);
      return valueItem(formula(made), show);
    });
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
    if (!definition) {
      this.stale.delete(info);
      // A source rendered anew (edited by hand, which renders it alone): its pivots shown may be out of date now
      const name = this.host.tableName(table)?.trim().toLowerCase();
      if (!name) return;
      for (const other of this.host.shownTables()) {
        const of = other.key !== info.key && this.definitionOf(parseTable(other.source));
        if (of && !("problem" in of) && this.nameHere(of) === name) this.check(other);
      }
      this.host.toolbarChanged();
      return;
    }
    this.check(info);
    this.host.toolbarChanged();
  }

  /** Other pages read anew (a pivot's source among them, as SilverBullet indexed it): the pivots of another page's table checked again */
  tablesChanged(): void {
    let checked = false;
    for (const info of this.host.shownTables()) {
      const definition = this.definitionOf(parseTable(info.source));
      const page = definition && !("problem" in definition) ? this.pageOf(definition) : undefined;
      if (page === undefined) continue;
      // (Not where its page is as it was checked from: another page read, or definitions changed)
      const tables = this.host.otherPages()?.tables(page);
      if (tables !== undefined && this.checkedFrom.get(info) === tables) continue;
      this.check(info);
      checked = true;
    }
    if (checked) this.host.toolbarChanged();
  }

  /**
   * Whether a pivot shown is as its source makes it now, or why it cannot be
   * calculated; one of another page's table not read yet has that page read
   * (`read`), then is checked again
   */
  private check(info: TableInfo, read = true): void {
    const table = parseTable(info.source);
    const definition = this.definitionOf(table);
    if (!definition) return void this.stale.delete(info);
    if ("problem" in definition) return void this.stale.set(info, `This pivot cannot be calculated: ${definition.problem}`);
    const tables = pageTablesOf(this.host.pageText);
    const own = tables.find((t) => t.table.rows[0]?.cells.join("|") === table.rows[0]?.cells.join("|") && this.host.getMeta(t.table, "source") === definition.source);
    const found = this.find(definition, tables, own?.range.from ?? -1);
    const page = this.pageOf(definition);
    if (page !== undefined) {
      const from = this.host.otherPages()?.tables(page);
      if (from === undefined) this.checkedFrom.delete(info);
      else this.checkedFrom.set(info, from);
    }
    if ("unread" in found && read && !this.unreadable() && this.cells()) {
      // Up to date as far as is known meanwhile: not highlighted for a moment
      this.stale.set(info, false);
      void this.host.offered<PageLinksOffer>("pageLinks")!.readPages([found.unread], false).then(() => {
        const now = this.host.tableFor(info.key);
        if (now) this.check(now, false);
        this.host.toolbarChanged();
      });
      return;
    }
    const pivot = this.calculate(definition, found);
    if (typeof pivot === "string") return void this.stale.set(info, `This pivot cannot be calculated: ${pivot}`);
    const now = this.written(table, pivot, this.renamesOf(table));
    this.stale.set(info, JSON.stringify(now.rows.map((r) => r.cells)) !== JSON.stringify(table.rows.map((r) => r.cells)));
  }

  /** What a pivot is, at a glance: Pivot of its source as the definition writes it (another page's: Pivot of [[Orders]]orders), one with a problem too; out of date, said so */
  tableBadges(info: TableInfo): TableBadge[] {
    const table = parseTable(info.source);
    if (!this.definitionOf(table)) return [];
    const what = { icon: ICONS.pivot, text: `Pivot of ${this.host.getMeta(table, "source")?.trim() ?? ""}` };
    // Out of date, or not calculated at all: said without its toolbar's Refresh shown
    const state = this.stale.get(info);
    if (!state) return [what];
    return [what, { icon: ICONS.recalculate, text: typeof state === "string" ? "Cannot be calculated" : "Out of date", attention: true }];
  }

  /** Deleting a table: its pivots on the page keep their numbers, calculated no more */
  tableDeleteWarning(info: TableInfo): string | undefined {
    const name = this.host.tableName(parseTable(info.source))?.trim().toLowerCase();
    if (!name) return undefined;
    const pivots = pageTablesOf(this.host.pageText).filter(({ table }) => {
      const of = this.definitionOf(table);
      return of && !("problem" in of) && this.nameHere(of) === name;
    }).length;
    return pivots ? `${pivots === 1 ? "a pivot table of it keeps its numbers" : `${pivots} pivot tables of it keep their numbers`}, calculated no more` : undefined;
  }

  /** A pivot's cells are calculated: its header alone is the user's (its names) */
  readOnly(table: Table, cell: { readonly row: number }): string | undefined {
    if (cell.row === 0 || !this.definitionOf(table)) return undefined;
    return `this table is a pivot of ${this.host.getMeta(table, "source")}: its values are calculated. Edit ${this.host.getMeta(table, "source")}, or what the pivot shows in its definition`;
  }

  /** A cell of a pivot edited: what it shows is changed in its settings, opened instead */
  editRefused(info: TableInfo, cell: { readonly row: number }): void {
    if (cell.row > 0 && this.definitionOf(parseTable(info.source))) this.settings(info);
  }

  /** A pivot's rows and columns are its calculation's */
  fixedShape(table: Table): string | undefined {
    return this.definitionOf(table) ? `this table is a pivot of ${this.host.getMeta(table, "source")}: its rows and columns come from it` : undefined;
  }

  /** The page's tables a pivot can summarize (named ones, not pivots), `also` one more first (a table to be named so, another page's source) */
  private sources(also?: { readonly name: string; readonly table: Table }): { name: string; columns: string[]; table: Table }[] {
    return [...(also ? [also] : []), ...this.namedIn(pageTablesOf(this.host.pageText))].map(({ name, table }) => ({ name, table, columns: (table.rows[0]?.cells ?? []).map(columnName) }));
  }

  /** The tables of a page a pivot can summarize: named ones, not pivots */
  private namedIn(tables: readonly PageTable[]): { name: string; table: Table }[] {
    return tables.flatMap(({ table }) => {
      const name = this.host.tableName(table)?.trim();
      return name && !this.definitionOf(table) ? [{ name, table }] : [];
    });
  }

  /** Another page's tables a pivot can summarize, by their names and their columns' (read through pageLinks), or why there are none */
  private async pageSources(page: string): Promise<readonly { name: string; columns: string[] }[] | string> {
    if (page === this.host.currentPage) return this.sources();
    const offer = this.host.offered<PageLinksOffer>("pageLinks");
    if (!offer || !this.host.bridge.readPage || !this.cells()) return "Other pages are read by the pageLinks module, which is off";
    await offer.readPages([page], false);
    const tables = this.host.otherPages()?.tables(page);
    if (tables === null) return `There is no page ${page}`;
    if (!tables) return `${page} could not be read`;
    const named = this.namedIn(tables).map(({ name, table }) => ({ name, columns: (table.rows[0]?.cells ?? []).map(columnName) }));
    return named.length ? named : `No table of ${page} has a name: a pivot names the table it summarizes`;
  }

  /** The source of a definition the dialog makes: one of its sources of this page (a table to be named so among them), else as found */
  private sourceFor(definition: PivotDefinition, sources: ReturnType<Pivot["sources"]>): Found {
    const name = this.nameHere(definition);
    const listed = name === undefined ? undefined : sources.find((s) => s.name.toLowerCase() === name)?.table;
    return listed ? { table: listed } : this.find(definition, pageTablesOf(this.host.pageText), -1);
  }

  /** The dialog: a pivot's fields picked, its preview calculated from the source as the page has it */
  private dialog(sources: ReturnType<Pivot["sources"]>, fields: Fields, submitLabel: string, submit: (definition: PivotDefinition) => void, blocked?: string): void {
    const { listPages } = this.host.bridge;
    // Without the formulas module nothing is calculated: the dialog says so first, and inserts or saves nothing
    const off = this.cells() ? undefined : FORMULAS_OFF;
    openPivotDialog(this.host, {
      sources,
      fields,
      submitLabel,
      submit,
      ...(off ? { notice: off } : {}),
      ...(off || blocked ? { blocked: off ?? blocked } : {}),
      preview: (definition) => this.calculate(definition, this.sourceFor(definition, sources)),
      readPage: (page) => this.pageSources(page),
      ...(listPages ? { pages: async () => listOf(await listPages()).filter((page): page is string => typeof page === "string" && page !== this.host.currentPage) } : {}),
    });
  }

  /**
   * Insert pivot table…: a pivot of the table, first its text column by its
   * numbers' sum; inserted under it, the table named in the same edit where
   * it has no name (a pivot names its source)
   */
  private insert(info: TableInfo): void {
    const table = parseTable(info.source);
    const own = this.host.tableName(table)?.trim();
    const taken = new Set(pageTablesOf(this.host.pageText).map((t) => this.host.tableName(t.table)?.toLowerCase()));
    let n = 1;
    while (taken.has(`table${n}`)) n++;
    const name = own ?? `table${n}`;
    const fields = this.firstFields(name, table);
    const blocked = this.blocked({ ...table, meta: undefined });
    this.dialog(this.sources(own ? undefined : { name, table }), fields, "Insert", (definition) => {
      const sources = this.sources(own ? undefined : { name, table });
      const pivot = this.calculate(definition, this.sourceFor(definition, sources));
      if (typeof pivot === "string") return void this.host.bridge.flash(`Silverware Table: ${pivot}`, "error");
      const made = this.written(this.withDefinition({ indent: table.indent, align: [], rows: [{ cells: [""] }], padded: false }, definition), pivot, {});
      const names = !own && definition.source.trim().toLowerCase() === name.toLowerCase();
      void this.host.insertTable(made, info, names ? { target: info, change: (t) => this.host.withTableName(t, name) } : undefined);
    }, blocked);
  }

  /** A pivot of a table to start from: its text column by its numbers' sum (else a count of its rows) */
  private firstFields(name: string, table: Table): Fields {
    const columns = (table.rows[0]?.cells ?? []).map(columnName);
    const numeric = (c: number) => table.rows.slice(1).filter((r) => asNumber(unescapeCell(r.cells[c] ?? "").trim()) !== undefined).length * 2 > table.rows.length - 1;
    const label = columns.findIndex((_, c) => !numeric(c));
    const value = columns.findIndex((_, c) => c !== label && numeric(c));
    return {
      source: name,
      rows: label >= 0 ? [{ column: columns[label]!, grouping: "" }] : [],
      columns: [],
      values: value >= 0 ? [{ fn: "SUM", column: columns[value]!, show: "" }] : [{ fn: "COUNTA", column: columns[0] ?? "", show: "" }],
      conditions: [],
      any: false,
      sort: [],
      totals: "both",
    };
  }

  /** Why no pivot can be inserted (a table's metadata not stored), if so */
  private blocked(table: Table): string | undefined {
    return this.host.canStoreMeta(table, "source") ? undefined : "A pivot is kept in its table's metadata: turn on Store table metadata in the settings";
  }

  /** Insert pivot table, the command (and /pivot): the dialog for a pivot of the page's first named table (none: of another page), inserted at the cursor */
  commands(): PageCommand[] {
    return [{ name: "Silverware Table: Insert pivot table", slash: "pivot", description: "A pivot table at the cursor: a summary of a table of this page or another", run: () => this.insertAtCursor() }];
  }

  private insertAtCursor(): void {
    const empty: Table = { indent: "", align: [], rows: [{ cells: [""] }], padded: false };
    const sources = this.sources();
    const first = sources[0];
    const fields: Fields = first ? this.firstFields(first.name, first.table) : { source: "", rows: [], columns: [], values: [{ fn: "COUNTA", column: "", show: "" }], conditions: [], any: false, sort: [], totals: "both" };
    this.dialog(sources, fields, "Insert", (definition) => {
      const pivot = this.calculate(definition, this.sourceFor(definition, this.sources()));
      if (typeof pivot === "string") return void this.host.bridge.flash(`Silverware Table: ${pivot}`, "error");
      const made = this.written(this.withDefinition(empty, definition), pivot, {});
      // The cursor as it is now: the editor moved it with any edit made while the dialog was open
      void (async () => {
        const position = (await this.host.bridge.getCursor?.()) ?? (await this.host.bridge.getText()).length;
        await this.host.insertTable(made, { position });
      })();
    }, this.blocked(empty));
  }

  /** Pivot settings…: the pivot's definition in the dialog, saved into its metadata row (the write calculates it: writeStep) */
  private settings(info: TableInfo): void {
    const table = parseTable(info.source);
    const read = this.definitionOf(table);
    if (!read) return;
    // One with a problem (no values, wrong totals): as far as it reads, for the dialog to fix
    const definition = "problem" in read ? looseDefinition((key) => this.host.getMeta(table, key)) : read;
    this.dialog(this.sources(), fieldsOf(definition), "Save", (changed) => {
      // A source moved to another page: that page read anew before the write (prepareWrite reads the pivot's source as it was)
      const page = this.pageOf(changed);
      const read = page === undefined ? undefined : this.host.offered<PageLinksOffer>("pageLinks")?.readPages([page], true);
      void Promise.resolve(read).then(() => this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => this.withDefinition(t, changed)));
    });
  }

  /** Where a pivot's source was changed so that it is out of date */
  private changedWhere(info: TableInfo): string {
    const definition = this.definitionOf(parseTable(info.source));
    const page = definition && !("problem" in definition) ? this.pageOf(definition) : undefined;
    return page === undefined ? "its source was changed outside Silverware Table" : `its source on ${page} was changed`;
  }

  /** Refresh, in a pivot's toolbar: highlighted where it is out of date */
  toolbarButtons(info: TableInfo): ToolbarButton[] {
    const state = this.stale.get(info);
    if (state === undefined) {
      // Any other table with rows: a pivot of it, made in the dialog
      const table = parseTable(info.source);
      // (Also with the formulas module off: its dialog says it is needed)
      if (table.rows.length < 2 || this.definitionOf(table)) return [];
      return [{ label: "Insert pivot table…", place: "menu", icon: ICONS.pivot, title: "A summary of this table under it, calculated anew as it changes", run: () => this.insert(info) }];
    }
    const problem = typeof state === "string" ? state : undefined;
    return [
      { label: "Pivot settings…", place: "icon", icon: ICONS.pivot, title: "What the pivot shows", run: () => this.settings(info) },
      {
        label: "Refresh pivot",
        place: "icon",
        icon: ICONS.recalculate,
        attention: state !== false,
        title: problem ?? (state ? `Refresh pivot: it is out of date (${this.changedWhere(info)})` : "Refresh pivot (it is up to date)"),
        // A write of the pivot calculates it anew (writeStep)
        run: () => void this.host.writeTable(this.host.tableFor(info.key) ?? info, (t) => t),
      },
    ];
  }
}

/** A source as found: its table, why there is none, or the page it is on, not read yet */
type Found = { readonly table: Table } | { readonly problem: string } | { readonly unread: string };

/** A column's id (PivotColumn.id: row:<group>, value:<value>, column:<key>|<value>, total|<value>) with its items as they are written now */
function movedId(id: string, moved: ReadonlyMap<string, string>): string {
  const m = /^(row:|value:|total\||column:[^|]*\|)(.*)$/.exec(id);
  return m ? m[1]! + (moved.get(m[2]!) ?? m[2]!) : id;
}
