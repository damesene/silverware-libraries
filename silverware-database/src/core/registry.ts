// Definitions of a kind by name (views, converters): the built-in ones and
// those defined besides (the user's, from Space Lua), one of a built-in one's
// name in its place, the others after in the order defined, as the property
// types' registry has them. The core knows none of them by name.

/** What a registry holds: a definition named */
export type Named = { readonly name: string };

export class DefinitionRegistry<T extends Named> {
  private offered: readonly T[];

  constructor(
    private readonly builtIn: readonly T[],
    /** Why a definition cannot be one, undefined where it can */
    private readonly validate: (definition: T) => string | undefined,
    /** What one is called in what is said ("view") */
    private readonly kind: string,
  ) {
    this.offered = builtIn;
  }

  /** As offered: the built-in ones (each replaced by a defined one of its name), then the others defined */
  all(): readonly T[] {
    return this.offered;
  }

  named(name: string): T | undefined {
    return this.offered.find((one) => one.name === name);
  }

  /** Definitions besides the built-in ones, in place of those defined before; what cannot be one left out, said why */
  define(definitions: readonly T[]): readonly string[] {
    const problems: string[] = [];
    const byName = new Map<string, T>();
    for (const one of definitions) {
      const problem = this.validate(one);
      if (problem) {
        problems.push(problem);
        continue;
      }
      if (byName.has(one.name)) problems.push(`the ${this.kind} "${one.name}" is defined twice: the last kept`);
      byName.set(one.name, one);
    }
    const names = new Set(this.builtIn.map((one) => one.name));
    this.offered = [...this.builtIn.map((one) => byName.get(one.name) ?? one), ...[...byName.values()].filter((one) => !names.has(one.name))];
    return problems;
  }
}
