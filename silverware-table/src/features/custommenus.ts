// The customMenus module (always on): the entries of custom definitions
// (`silverware.table.defineMenuEntries`, menus/custom.ts) in a row's or a
// column's menu. Each definition's lineMenu is given the menu's line and its
// table as data (the context, no table of Silverware Table's own) and the
// menu's builder, as a module's lineMenu is. What it gives is checked: a
// definition that throws, or gives what is no group of entries, gives none,
// said once (until it is defined anew); an entry whose run throws or rejects
// is said so too, the menu going on.
import type { Feature, LineMenuBuilder, LineMenuGroup, LineMenuTarget, ModelHost, TableInfo } from "../core/feature.ts";
import { locateBySource, parseTable } from "../markdown.ts";
import { type MenuEntry, wrapRuns } from "../menu.ts";
import { type MenuEntriesContext, type MenuEntriesDefinition, menuEntriesDefinitions } from "../menus/custom.ts";
import { tableData } from "../tabledata.ts";

const SLOTS = new Set(["clipboard", "edit", "insert", "columnType", "view", "look", "remove"]);
// (No element of a definition's own: the builder makes none, and one that is no node would break the whole menu)
const KINDS = new Set(["item", "separator", "segmented", "actions", "tiles"]);
const POSITIONS = new Set(["primary", "secondary"]);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isThenable = (v: unknown): v is PromiseLike<unknown> => isObject(v) && typeof v.then === "function";

/** Why an entry is none a menu can show; undefined: it is one (the builder's are) */
function entryProblem(entry: unknown): string | undefined {
  if (!isObject(entry) || typeof entry.kind !== "string" || !KINDS.has(entry.kind)) return "an entry is none (made with the menu's item, submenu, segmented, actions or separator)";
  if (entry.kind === "item" && (typeof entry.label !== "string" || typeof entry.run !== "function")) return "an item has no label or no run";
  if ((entry.kind === "segmented" || entry.kind === "actions" || entry.kind === "tiles") && !Array.isArray(entry.options)) return `a ${entry.kind} row has no options`;
  return undefined;
}

/** Why what a lineMenu gave is no list of groups of entries; undefined: it is one */
function groupsProblem(groups: unknown): string | undefined {
  if (!Array.isArray(groups)) return "its lineMenu gave no list (of the menu's slot groups: menu.slot.view([…]), menu.slot.custom({…}, […]))";
  for (const group of groups) {
    if (!isObject(group) || !Array.isArray(group.entries)) return "a group is none (made with menu.slot)";
    if (group.slot === "custom") {
      if (!isObject(group.custom) || typeof group.custom.name !== "string") return "a custom section has no name";
      const { position, priority } = group.custom;
      if (position !== undefined && !POSITIONS.has(position as string)) return `a custom section's position is "primary" or "secondary", not ${JSON.stringify(position)}`;
      if (priority !== undefined && !(typeof priority === "number" && Number.isFinite(priority))) return `a custom section's priority is no number: ${String(priority)}`;
    } else if (typeof group.slot !== "string" || !SLOTS.has(group.slot)) return `a group's slot is no slot: ${String(group.slot)}`;
    for (const entry of group.entries) {
      const problem = entryProblem(entry);
      if (problem) return problem;
    }
  }
  return undefined;
}

export class CustomMenus implements Feature {
  // The definitions said to have failed: once each, until defined anew (another object)
  private readonly said = new WeakSet<MenuEntriesDefinition>();

  constructor(private readonly host: ModelHost) {}

  lineMenu(info: TableInfo, target: LineMenuTarget, menu: LineMenuBuilder): LineMenuGroup[] {
    const definitions = menuEntriesDefinitions();
    if (!definitions.length) return [];
    const table = parseTable(info.source);
    const place = locateBySource(this.host.pageText, info.hint, info.source) ?? { from: info.hint, to: info.hint + info.source.length };
    const data = tableData(table, place, this.host.tableName(table), (column) => this.host.columnName(table, column));
    // Each definition its own copy: one changing it (sorting the rows) changes nothing the next is given
    const contextOf = (): MenuEntriesContext => ({
      axis: target.axis,
      at: target.at,
      lines: [...target.lines],
      page: this.host.currentPage,
      table: { ...data, columns: data.columns.map((c) => ({ ...c })), rows: data.rows.map((row) => [...row]) },
    });
    return definitions.flatMap((definition) => {
      // Its submenus' entries, made as they open, checked and guarded as its own
      const own: LineMenuBuilder = {
        ...menu,
        submenu: (item, entries) =>
          menu.submenu(item, () => {
            let made: unknown;
            try {
              made = entries();
            } catch (e) {
              this.failed(definition, message(e), true);
              return [];
            }
            const problem = Array.isArray(made) ? made.map(entryProblem).find((p) => p) : "a submenu gave no list of entries";
            if (problem) {
              this.failed(definition, problem, true);
              return [];
            }
            return this.guarded(definition, made as readonly MenuEntry[]);
          }),
      };
      let groups: unknown;
      try {
        groups = definition.lineMenu(contextOf(), own);
      } catch (e) {
        this.failed(definition, message(e));
        return [];
      }
      if (isThenable(groups)) {
        Promise.resolve(groups).catch(() => undefined);
        this.failed(definition, "its lineMenu gave a promise: it runs as the menu opens, which does not wait (async is for an entry's run)");
        return [];
      }
      const problem = groupsProblem(groups);
      if (problem) {
        this.failed(definition, problem);
        return [];
      }
      return (groups as readonly LineMenuGroup[]).map((group) => ({ ...group, entries: this.guarded(definition, group.entries) }));
    });
  }

  /** The entries with every run guarded: a throw or a rejection said, the menu going on */
  private guarded(definition: MenuEntriesDefinition, entries: readonly MenuEntry[]): MenuEntry[] {
    return wrapRuns(entries, (run) => () => {
      try {
        const result: unknown = run();
        if (isThenable(result)) Promise.resolve(result).catch((e: unknown) => this.failed(definition, message(e), true));
      } catch (e) {
        this.failed(definition, message(e), true);
      }
    });
  }

  /** A definition failed: said once (an entry run: each time, as it was the user's doing) */
  private failed(definition: MenuEntriesDefinition, problem: string, ran = false): void {
    if (!ran && this.said.has(definition)) return;
    if (!ran) this.said.add(definition);
    console.error(`Silverware Table: menu entries ${definition.name}: ${problem}`);
    void this.host.bridge.flash(`Silverware Table: the menu entries ${definition.name} ${ran ? "failed" : "are not shown"}: ${problem}`, "error");
  }
}
