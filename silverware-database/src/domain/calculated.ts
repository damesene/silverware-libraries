// Calculated properties (docs/silverware-database-formulas.md, decided 4): values no one types, never read from an
// item's page nor kept in one, set or taken off as the items are read, read only. A system property's (given by where
// an item is kept, domain/system.ts) and a formula property's (given by its formula). Only their values share this
// rule; what of their settings may change is each kind's (a system property's type and key are fixed, a formula's not).
import type { Database, Params, Property } from "../model/database.ts";
import { FORMULA_TYPE } from "./types/builtin/formula.ts";
import type { PropertyType } from "./types/type.ts";

/** Whether a property's values are calculated, never an item's own (by the formula type's name, which no type of the user's may take) */
export function calculated(property: Pick<Property, "type" | "system">): boolean {
  return property.system !== undefined || property.type === FORMULA_TYPE;
}

/**
 * The params a property keeps as its type changes to `to` (none given): the same type keeps them; another only where
 * it declares params and these are its own (a select's options as a person's), else none, so a select turned into a
 * number keeps no options. None to or from a formula: its params are its formula's.
 */
export function paramsKept(from: Pick<Property, "type" | "params">, to: PropertyType | undefined): Params {
  if (!to) return {};
  if (to.name === from.type) return from.params;
  if (calculated({ type: to.name }) !== calculated({ type: from.type })) return {};
  return to.validateParams !== undefined && to.validateParams(from.params) === undefined ? from.params : {};
}

// The keys of a database's calculated properties, made once per reading of its schema (asked item by item)
const keysOf = new WeakMap<Database, ReadonlySet<string>>();

/** The keys of a database's calculated properties */
export function calculatedKeys(database: Database): ReadonlySet<string> {
  let keys = keysOf.get(database);
  if (!keys) keysOf.set(database, (keys = new Set(database.properties.filter(calculated).map((property) => property.key))));
  return keys;
}
