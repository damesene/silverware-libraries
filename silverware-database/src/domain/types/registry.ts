// Which property types exist: the built-in ones, and those defined besides
// (later the user's, `silverware.database.defineTypes`): one of a built-in
// type's name replaces it in its place, the others follow in the order
// defined. An instance, not module state: the core owns one, a test its own.
import { BUILT_IN_TYPES } from "./builtin/index.ts";
import type { Params } from "../../model/database.ts";
import type { PropertyType } from "./type.ts";

const BUILT_IN_NAMES = new Set(BUILT_IN_TYPES.map((type) => type.name));

export class TypeRegistry {
  // The types as offered, made anew as types are defined (a view asks for a value's type often)
  private offered: readonly PropertyType[] = BUILT_IN_TYPES;

  /** The types as offered: the built-in ones (each replaced by a defined one of its name), then the others defined */
  all(): readonly PropertyType[] {
    return this.offered;
  }

  /** The type of a name, undefined where none is (a property of a type not defined now: its values shown as text) */
  named(name: string): PropertyType | undefined {
    return this.offered.find((type) => type.name === name);
  }

  /** The type a property of that name and params is (`forParams`: a select of several options its own), undefined where none is of the name */
  of(name: string, params: Params): PropertyType | undefined {
    const type = this.named(name);
    return type?.forParams ? type.forParams(params) : type;
  }

  /** Types defined besides the built-in ones, in place of those defined before (a name again: the later one) */
  define(types: readonly PropertyType[]): void {
    const byName = new Map(types.map((type) => [type.name, type]));
    const builtIn = BUILT_IN_TYPES.map((type) => byName.get(type.name) ?? type);
    this.offered = [...builtIn, ...[...byName.values()].filter((type) => !BUILT_IN_NAMES.has(type.name))];
  }
}
