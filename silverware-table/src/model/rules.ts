// What an edit does with attributes their owners declare a rule for, one
// place for every way a table is changed (docs/silverware-table-store-plan.md,
// *An attribute bound to its content*): run by the core after the edit and
// before the modules' write steps, on the table before the whole edit and as
// the edit left it.
//
// - Bound to its cell's content (the formulas' formula): a cell whose
//   content the edit changed loses it, unless the edit set it. A cell's
//   attributes the edit left as they were (the same object: a value typed,
//   pasted or cleared over it) are not set; a cell moved there brings its own,
//   and an attribute set explicitly is recorded even at the same value
//   (`withAttributeSet`: the same formula typed again keeps it).
// - Unique in its table (a row's or a cell's name): a row or a cell the edit
//   made (no row or column before is it: a row duplicated, inserted with
//   cells) takes none that another row or cell of the table has.
import { type Attributes, attributeIn, type ModelCell, type ModelRow, type Owner, type TableModel, withAttributeIn } from "./model.ts";
import type { IndexMap } from "./ops.ts";

/** An attribute an owner declares a rule for */
export type RuledAttribute = { readonly owner: Owner; readonly key: string };

/** The attributes declared bound to their cell's content, and those unique in a table */
export type AttributeRules = { readonly boundToContent: readonly RuledAttribute[]; readonly unique: readonly RuledAttribute[] };

/**
 * A cell as an edit leaves it (`before` the cell as it was, `after` as edited
 * there): its content changed and its attributes as they were, what is bound to
 * the content goes; else as edited
 */
export function editedCell(before: ModelCell, after: ModelCell, rules: AttributeRules): ModelCell {
  if (before.content === after.content || before.attributes !== after.attributes) return after;
  const attributes = without(after.attributes, rules.boundToContent, () => false);
  return attributes === after.attributes ? after : { ...after, attributes };
}

/** Where each row and column of the table as edited was before the edit (undefined: the edit made it), of the write's maps */
function sources(map: IndexMap | undefined, before: number, after: number, from: number): (number | undefined)[] {
  const was: (number | undefined)[] = Array.from({ length: after }, () => undefined);
  for (let i = from; i < before + from; i++) {
    const to = map ? map(i) : i;
    if (to !== undefined && to >= from && to < after + from) was[to - from] = i;
  }
  return was;
}

/** The attributes without those of `ruled` whose `keep` says no */
function without(attributes: Attributes, ruled: readonly RuledAttribute[], keep: (attribute: RuledAttribute, value: string) => boolean): Attributes {
  let result = attributes;
  for (const attribute of ruled) {
    const value = attributeIn(result, attribute.owner, attribute.key);
    if (value !== undefined && !keep(attribute, value)) result = withAttributeIn(result, attribute.owner, attribute.key, undefined);
  }
  return result;
}

/**
 * The table as `after` (the edit of `before`, its rows and columns moved as
 * the maps say: rows from 1, as the write's maps count them past the header)
 * with the rules applied; the same table where none changes anything
 */
export function withAttributeRules(before: TableModel, after: TableModel, rules: AttributeRules, rowMap?: IndexMap, columnMap?: IndexMap): TableModel {
  if (rules.boundToContent.length === 0 && rules.unique.length === 0) return after;
  const rowWas = sources(rowMap, before.rows.length, after.rows.length, 1);
  const columnWas = sources(columnMap, before.columns.length, after.columns.length, 0);
  // The unique values the table has where nothing new is: what a new row or cell may not take again
  const kept = new Set<string>();
  const note = (attributes: Attributes) => {
    for (const { owner, key } of rules.unique) {
      const value = attributeIn(attributes, owner, key);
      if (value !== undefined) kept.add(`${owner}\u0000${key}\u0000${value.toLowerCase()}`);
    }
  };
  after.rows.forEach((row, r) => {
    if (rowWas[r] === undefined) return;
    note(row.attributes);
    row.cells.forEach((cell, c) => columnWas[c] !== undefined && note(cell.attributes));
  });
  const fresh = (attribute: RuledAttribute, value: string) => !kept.has(`${attribute.owner}\u0000${attribute.key}\u0000${value.toLowerCase()}`);
  let changed = false;
  const rows = after.rows.map((row, r): ModelRow => {
    const was = rowWas[r] === undefined ? undefined : before.rows[rowWas[r]! - 1];
    const rowAttributes = was ? row.attributes : without(row.attributes, rules.unique, fresh);
    const cells = row.cells.map((cell, c): ModelCell => {
      const old = was && columnWas[c] !== undefined ? was.cells[columnWas[c]!] : undefined;
      // A new cell: no unique attribute another has; one edited: what is bound to its content as the edit leaves it
      if (old) return editedCell(old, cell, rules);
      const attributes = without(cell.attributes, rules.unique, fresh);
      return attributes === cell.attributes ? cell : { ...cell, attributes };
    });
    const same = rowAttributes === row.attributes && cells.every((cell, c) => cell === row.cells[c]);
    if (same) return row;
    changed = true;
    return { cells, attributes: rowAttributes };
  });
  return changed ? { ...after, rows } : after;
}
