// What an owner (a module, or the core) reads and writes of what tables keep,
// its own only: the host's functions for it, each attribute's name made of the
// owner's and the key (meta.ts). The core gives a module these in its own
// host (core/modulehost.ts), so the module never names an attribute whole.
//
// With the metadata setting off, nothing new is stored: an attribute the table
// has may change or go, none is added (`enabled`: whether the setting is on).
import { attributeName, columnAttributeOf, columnValues, hasMetaNamed, metaValue, metaValuesOf, type Owner, withColumnValues, withMetaValue } from "../meta.ts";
import type { Table } from "../markdown.ts";
import { attributeIn, type AttributePlace, attributesAt, type ModelCell, NO_ATTRIBUTES, type TableModel, withAttributeIn, withAttributeSet, withAttributesAt } from "../model/model.ts";

/**
 * An owner's attributes, read and written: the model's (what a module's host
 * gives: ModelHost) and, for the core's own steps on the markdown (its write
 * pipeline, the stored view, the layout's entries), a markdown table's too
 */
export type OwnMeta = {
  attribute(table: Table, key: string, at?: { readonly column: number }): string | undefined;
  attribute(table: TableModel, key: string, at?: AttributePlace): string | undefined;
  attribute(cell: ModelCell, key: string): string | undefined;
  withAttribute(table: Table, key: string, value: string | undefined, at?: { readonly column: number }): Table;
  withAttribute(table: TableModel, key: string, value: string | undefined, at?: AttributePlace): TableModel;
  withAttribute(cell: ModelCell, key: string, value: string | undefined): ModelCell;
  attributes(table: Table | TableModel): ReadonlyMap<string, string>;
  columnAttributes(table: Table | TableModel, key: string): Map<number, string>;
  withColumnAttributes(table: Table, key: string, values: ReadonlyMap<number, string>): Table;
  withColumnAttributes(table: TableModel, key: string, values: ReadonlyMap<number, string>): TableModel;
  canStore(table: Table, key: string, at?: { readonly column: number }): boolean;
  canStore(table: TableModel, key: string, at?: AttributePlace): boolean;
  canStore(cell: ModelCell, key: string): boolean;
};

/** Whether a table is the model (else markdown's `Table`) */
const isModel = (table: Table | TableModel | ModelCell): table is TableModel => "columns" in table;
/** Whether it is a cell of the model given alone */
const isCell = (target: Table | TableModel | ModelCell): target is ModelCell => "content" in target;

export function ownMeta(owner: Owner, enabled: () => boolean): OwnMeta {
  // Whether the table may have this attribute: the setting on, or it has it already
  const storable = (table: Table, name: string | undefined) => name !== undefined && (enabled() || hasMetaNamed(table, name));
  const nameOf = (table: Table, key: string, at?: { readonly column: number }) => (at ? columnAttributeOf(table, owner, key, at.column) : attributeName(owner, key));
  // The same of the model: at any place, a row's and a cell's too
  const inModel = (model: TableModel, key: string, at?: AttributePlace) => attributeIn(attributesAt(model, at) ?? NO_ATTRIBUTES, owner, key);
  const storableInModel = (model: TableModel, key: string, at?: AttributePlace) => !!attributesAt(model, at) && (enabled() || inModel(model, key, at) !== undefined);
  const withInModel = (model: TableModel, key: string, value: string | undefined, at?: AttributePlace) =>
    value !== undefined && !storableInModel(model, key, at) ? model : withAttributesAt(model, at, (attributes) => withAttributeIn(attributes, owner, key, value));
  // A cell given alone: may it hold one (the setting on, or it has it). Set on it unchecked: whether a cell may take
  // one it had not is the write step's, which sees the table before the change (withoutNewAttributes: a calculated
  // column's formula copied into a new row passes, a new formula does not)
  const storableInCell = (cell: ModelCell, key: string) => enabled() || attributeIn(cell.attributes, owner, key) !== undefined;
  function attribute(table: Table, key: string, at?: { readonly column: number }): string | undefined;
  function attribute(table: TableModel, key: string, at?: AttributePlace): string | undefined;
  function attribute(cell: ModelCell, key: string): string | undefined;
  function attribute(table: Table | TableModel | ModelCell, key: string, at?: AttributePlace): string | undefined {
    if (isCell(table)) return attributeIn(table.attributes, owner, key);
    if (isModel(table)) return inModel(table, key, at);
    return at ? columnValues(table, owner, key).get(at.column!) : metaValue(table, owner, key);
  }
  function withAttribute(table: Table, key: string, value: string | undefined, at?: { readonly column: number }): Table;
  function withAttribute(table: TableModel, key: string, value: string | undefined, at?: AttributePlace): TableModel;
  function withAttribute(cell: ModelCell, key: string, value: string | undefined): ModelCell;
  function withAttribute(table: Table | TableModel | ModelCell, key: string, value: string | undefined, at?: AttributePlace): Table | TableModel | ModelCell {
    // (A cell's: an explicit set, recorded even at the same value, which an edit's rules tell from one it left)
    if (isCell(table)) return { ...table, attributes: withAttributeSet(table.attributes, owner, key, value) };
    if (isModel(table)) return withInModel(table, key, value, at);
    const column = at && { column: at.column! };
    if (value !== undefined && !storable(table, nameOf(table, key, column))) return table;
    if (!column) return withMetaValue(table, owner, key, value);
    const values = columnValues(table, owner, key);
    if (value === undefined) values.delete(column.column);
    else values.set(column.column, value);
    return withColumnValues(table, owner, key, values);
  }
  function withColumnAttributes(table: Table, key: string, values: ReadonlyMap<number, string>): Table;
  function withColumnAttributes(table: TableModel, key: string, values: ReadonlyMap<number, string>): TableModel;
  function withColumnAttributes(table: Table | TableModel, key: string, values: ReadonlyMap<number, string>): Table | TableModel {
    if (isModel(table)) return table.columns.reduce((model, _, column) => withInModel(model, key, values.get(column), { column }), table);
    const kept = new Map([...values].filter(([column]) => storable(table, columnAttributeOf(table, owner, key, column))));
    return withColumnValues(table, owner, key, kept);
  }
  function canStore(table: Table, key: string, at?: { readonly column: number }): boolean;
  function canStore(table: TableModel, key: string, at?: AttributePlace): boolean;
  function canStore(cell: ModelCell, key: string): boolean;
  function canStore(table: Table | TableModel | ModelCell, key: string, at?: AttributePlace): boolean {
    if (isCell(table)) return storableInCell(table, key);
    return isModel(table) ? storableInModel(table, key, at) : storable(table, nameOf(table, key, at && { column: at.column! }));
  }
  return {
    attribute,
    withAttribute,
    attributes: (table: Table | TableModel) => (isModel(table) ? new Map(table.attributes.get(owner)) : metaValuesOf(table, owner)),
    columnAttributes: (table: Table | TableModel, key: string) => {
      if (!isModel(table)) return columnValues(table, owner, key);
      const values = new Map<number, string>();
      table.columns.forEach((column, c) => {
        const value = attributeIn(column.attributes, owner, key);
        if (value !== undefined) values.set(c, value);
      });
      return values;
    },
    withColumnAttributes,
    canStore,
  };
}
