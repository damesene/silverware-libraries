// A store whose items are calculated (docs/silverware-database-formulas.md, decided 5): a database's formula
// properties' values given to everything that shows or reads its items (the places, the modules' hosts), over the store
// as it is, so after the system's values (a formula reads Created and Modified). The core keeps the store itself for
// every read a write is made from (a schema edit converts and writes the values it read), so a calculated value can
// never be written. Its `database` is the schema a view shows: a property whose options are a formula's given that
// formula's list as its options (decided 7), the revision the store's (a write against it is the schema as kept).
// Every other member is the store's own.
import { changesByItself, type FormulaValues, withFormulaValues } from "../domain/formulas/calculate.ts";
import type { FormulaProblem } from "../domain/formulas/model.ts";
import { withFormulaOptions } from "../domain/formulas/options.ts";
import type { Database, Item, Revised } from "../model/database.ts";
import type { DatabaseStore } from "./store.ts";

/** A formula's errors among a database's items, by item and property key */
export type FormulaProblems = FormulaValues["problems"];

/** A store whose items have their formulas' values; the errors among them asked apart */
export type CalculatingStore = DatabaseStore & {
  /** The errors a database's formulas give its items, as its items were last read (none: no formula fails) */
  formulaProblems(database: string): Promise<FormulaProblems>;
  /** Why a property's options' formula gives none, by its key (none: every one gives its list) */
  optionsProblems(database: string): Promise<ReadonlyMap<string, FormulaProblem>>;
};

type Calculated = {
  readonly key: string;
  readonly items: Revised<readonly Item[]>;
  readonly problems: FormulaProblems;
  readonly database: Revised<Database> | undefined;
  readonly optionsProblems: ReadonlyMap<string, FormulaProblem>;
};

/** `store`'s items calculated; the last calculation of each database kept while its schema and items are as read */
export function calculatingStore(store: DatabaseStore): CalculatingStore {
  const kept = new Map<string, Calculated>();

  async function calculated(id: string): Promise<Calculated> {
    const database = await store.database(id);
    const items = await store.items(id);
    if (!database) {
      kept.delete(id);
      return { key: "", items, problems: new Map(), database: undefined, optionsProblems: new Map() };
    }
    // (A formula giving another value as time goes, TODAY(), NOW(), or as functions defined from Space Lua change: kept
    // for its minute only, its values and their errors one calculation)
    const moment = changesByItself(database.value) ? new Date().toISOString().slice(0, 16) : "";
    const key = JSON.stringify([database.revision, items.revision, moment]);
    const last = kept.get(id);
    if (last?.key === key) return last;
    const { items: values, problems } = withFormulaValues(items.value, database.value);
    // (Its revision moved with the schema's where it has formulas: a formula changed gives other values, its items the same)
    const revision = values === items.value ? items.revision : `${items.revision}:${database.revision}${moment ? `:${moment}` : ""}`;
    // (Options by a formula read the items with their formulas' values: a formula property's values may be them)
    const shown = withFormulaOptions(database.value, values);
    const made = { key, items: { value: values, revision }, problems, database: shown.database === database.value ? database : { value: shown.database, revision: database.revision }, optionsProblems: shown.problems };
    kept.set(id, made);
    return made;
  }

  const own = {
    items: async (id: string) => (await calculated(id)).items,
    formulaProblems: async (id: string) => (await calculated(id)).problems,
    database: async (id: string) => (await calculated(id)).database,
    optionsProblems: async (id: string) => (await calculated(id)).optionsProblems,
  };
  return new Proxy(store, {
    get(target, member) {
      if (Object.hasOwn(own, member)) return own[member as keyof typeof own];
      const value = Reflect.get(target, member, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as CalculatingStore;
}
