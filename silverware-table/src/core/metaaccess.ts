// What an owner (a module, or the core) reads and writes of what tables keep,
// its own only: the host's functions for it, each attribute the owner's key
// (the store writes its whole name). The core gives a module these in its own
// host (core/modulehost.ts), so the module never names an attribute whole.
//
// With the metadata setting off, nothing new is stored: an attribute the table
// has may change or go, none is added (`enabled`: whether the setting is on).
import { attributeIn, type AttributePlace, attributesAt, type ModelCell, NO_ATTRIBUTES, type Owner, type TableModel, withAttributeIn, withAttributeSet, withAttributesAt } from "../../../shared/table/model.ts";

/** An owner's attributes, read and written: a table's at any place (the table, a column, a row, a cell), or a cell's given alone */
export type OwnMeta = {
  attribute(table: TableModel, key: string, at?: AttributePlace): string | undefined;
  attribute(cell: ModelCell, key: string): string | undefined;
  withAttribute(table: TableModel, key: string, value: string | undefined, at?: AttributePlace): TableModel;
  withAttribute(cell: ModelCell, key: string, value: string | undefined): ModelCell;
  attributes(table: TableModel): ReadonlyMap<string, string>;
  columnAttributes(table: TableModel, key: string): Map<number, string>;
  withColumnAttributes(table: TableModel, key: string, values: ReadonlyMap<number, string>): TableModel;
  canStore(table: TableModel, key: string, at?: AttributePlace): boolean;
  canStore(cell: ModelCell, key: string): boolean;
};

/** Whether it is a cell of the model given alone */
const isCell = (target: TableModel | ModelCell): target is ModelCell => "content" in target;

export function ownMeta(owner: Owner, enabled: () => boolean): OwnMeta {
  // An attribute at any place of the table, a row's and a cell's too
  const inModel = (model: TableModel, key: string, at?: AttributePlace) => attributeIn(attributesAt(model, at) ?? NO_ATTRIBUTES, owner, key);
  // Whether the table may have this attribute there: the setting on, or it has it already
  const storableInModel = (model: TableModel, key: string, at?: AttributePlace) => !!attributesAt(model, at) && (enabled() || inModel(model, key, at) !== undefined);
  const withInModel = (model: TableModel, key: string, value: string | undefined, at?: AttributePlace) =>
    value !== undefined && !storableInModel(model, key, at) ? model : withAttributesAt(model, at, (attributes) => withAttributeIn(attributes, owner, key, value));
  // A cell given alone: may it hold one (the setting on, or it has it). Set on it unchecked: whether a cell may take
  // one it had not is the write step's, which sees the table before the change (withoutNewAttributes: a calculated
  // column's formula copied into a new row passes, a new formula does not)
  const storableInCell = (cell: ModelCell, key: string) => enabled() || attributeIn(cell.attributes, owner, key) !== undefined;
  function attribute(table: TableModel, key: string, at?: AttributePlace): string | undefined;
  function attribute(cell: ModelCell, key: string): string | undefined;
  function attribute(table: TableModel | ModelCell, key: string, at?: AttributePlace): string | undefined {
    return isCell(table) ? attributeIn(table.attributes, owner, key) : inModel(table, key, at);
  }
  function withAttribute(table: TableModel, key: string, value: string | undefined, at?: AttributePlace): TableModel;
  function withAttribute(cell: ModelCell, key: string, value: string | undefined): ModelCell;
  function withAttribute(table: TableModel | ModelCell, key: string, value: string | undefined, at?: AttributePlace): TableModel | ModelCell {
    // (A cell's: an explicit set, recorded even at the same value, which an edit's rules tell from one it left)
    return isCell(table) ? { ...table, attributes: withAttributeSet(table.attributes, owner, key, value) } : withInModel(table, key, value, at);
  }
  function canStore(table: TableModel, key: string, at?: AttributePlace): boolean;
  function canStore(cell: ModelCell, key: string): boolean;
  function canStore(table: TableModel | ModelCell, key: string, at?: AttributePlace): boolean {
    return isCell(table) ? storableInCell(table, key) : storableInModel(table, key, at);
  }
  return {
    attribute,
    withAttribute,
    attributes: (table) => new Map(table.attributes.get(owner)),
    columnAttributes: (table, key) => {
      const values = new Map<number, string>();
      table.columns.forEach((column, c) => {
        const value = attributeIn(column.attributes, owner, key);
        if (value !== undefined) values.set(c, value);
      });
      return values;
    },
    withColumnAttributes: (table, key, values) => table.columns.reduce((model, _, column) => withInModel(model, key, values.get(column), { column }), table),
    canStore,
  };
}
