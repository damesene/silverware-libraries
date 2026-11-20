// What an owner (a module, or the core) reads and writes of what tables keep,
// its own only: the host's functions for it, each attribute's name made of the
// owner's and the key (meta.ts). The core gives a module these in its own
// host (core/modulehost.ts), so the module never names an attribute whole.
//
// With the metadata setting off, nothing new is stored: an attribute the table
// has may change or go, none is added (`enabled`: whether the setting is on).
import { attributeName, columnAttributeOf, columnValues, hasMetaNamed, metaValue, metaValuesOf, type Owner, withColumnValues, withMetaValue } from "../meta.ts";
import type { Table } from "../markdown.ts";
import { attributeIn, type AttributePlace, attributesAt, NO_ATTRIBUTES, type TableModel, withAttributeIn, withAttributesAt } from "../model/model.ts";
import { tagValue, withTagValue } from "../tagvalues.ts";
import type { ModelHost } from "./feature.ts";

export type OwnMeta = Pick<
  ModelHost,
  "attribute" | "withAttribute" | "attributes" | "columnAttributes" | "withColumnAttributes" | "canStore" | "getCellTag" | "withCellTag" | "canStoreCellTag"
>;

/** Whether a table is the model (else markdown's `Table`) */
const isModel = (table: Table | TableModel): table is TableModel => "columns" in table;

export function ownMeta(owner: Owner, enabled: () => boolean): OwnMeta {
  // Whether the table may have this attribute: the setting on, or it has it already
  const storable = (table: Table, name: string | undefined) => name !== undefined && (enabled() || hasMetaNamed(table, name));
  const nameOf = (table: Table, key: string, at?: { readonly column: number }) => (at ? columnAttributeOf(table, owner, key, at.column) : attributeName(owner, key));
  // The same of the model: at any place, a row's and a cell's too
  const inModel = (model: TableModel, key: string, at?: AttributePlace) => attributeIn(attributesAt(model, at) ?? NO_ATTRIBUTES, owner, key);
  const storableInModel = (model: TableModel, key: string, at?: AttributePlace) => !!attributesAt(model, at) && (enabled() || inModel(model, key, at) !== undefined);
  const withInModel = (model: TableModel, key: string, value: string | undefined, at?: AttributePlace) =>
    value !== undefined && !storableInModel(model, key, at) ? model : withAttributesAt(model, at, (attributes) => withAttributeIn(attributes, owner, key, value));
  function attribute(table: Table, key: string, at?: { readonly column: number }): string | undefined;
  function attribute(table: TableModel, key: string, at?: AttributePlace): string | undefined;
  function attribute(table: Table | TableModel, key: string, at?: AttributePlace): string | undefined {
    if (isModel(table)) return inModel(table, key, at);
    return at ? columnValues(table, owner, key).get(at.column!) : metaValue(table, owner, key);
  }
  function withAttribute(table: Table, key: string, value: string | undefined, at?: { readonly column: number }): Table;
  function withAttribute(table: TableModel, key: string, value: string | undefined, at?: AttributePlace): TableModel;
  function withAttribute(table: Table | TableModel, key: string, value: string | undefined, at?: AttributePlace): Table | TableModel {
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
  function canStore(table: Table | TableModel, key: string, at?: AttributePlace): boolean {
    return isModel(table) ? storableInModel(table, key, at) : storable(table, nameOf(table, key, at && { column: at.column! }));
  }
  return {
    attribute,
    withAttribute,
    attributes: (table) => (isModel(table) ? new Map(table.attributes.get(owner)) : metaValuesOf(table, owner)),
    columnAttributes: (table, key) => {
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
    getCellTag: (cell, key) => tagValue(cell, attributeName(owner, key)),
    withCellTag: (cell, key, value) => withTagValue(cell, attributeName(owner, key), value),
    canStoreCellTag: (cell, key) => enabled() || tagValue(cell, attributeName(owner, key)) !== undefined,
  };
}
