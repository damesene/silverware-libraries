// Which views exist: the built-in ones and those defined besides (the user's,
// `silverware.database.defineViews`, later), one of a built-in view's name in
// its place, the others after in the order defined, as the property types'
// registry has them. The core knows no view by name.
import type { ViewDefinition } from "./view.ts";

// A view's name as its settings and a place's state name it
const VIEW_NAME_RE = /^[a-z][a-z0-9-]*$/;
// A setting's key: one segment of its path (a dot would nest it in SilverBullet's config)
const SETTING_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/** Why a view cannot be one (its name, its parts), undefined where it can */
export function validateView(view: ViewDefinition): string | undefined {
  if (typeof view?.name !== "string" || !VIEW_NAME_RE.test(view.name)) return `"${String(view?.name)}" is no view's name: lower case letters, digits and -, starting with a letter`;
  if (typeof view.label !== "string" || !view.label.trim()) return `the view "${view.name}" has no label`;
  if (typeof view.icon !== "string") return `the view "${view.name}" has no icon`;
  if (typeof view.render !== "function") return `the view "${view.name}" has no render`;
  if (view.settings !== undefined && !Array.isArray(view.settings)) return `the view "${view.name}": its settings are no list`;
  const groupBy = view.groupBy as false | { types?: unknown; required?: unknown; draws?: unknown } | undefined;
  const flag = (value: unknown) => value === undefined || typeof value === "boolean";
  if (groupBy !== undefined && groupBy !== false && (typeof groupBy !== "object" || groupBy === null || (groupBy.types !== undefined && (!Array.isArray(groupBy.types) || !groupBy.types.every((one) => typeof one === "string"))) || !flag(groupBy.required) || !flag(groupBy.draws)))
    return `the view "${view.name}": its groupBy is false or { types: [type names], required, draws: true or false }`;
  const keys = new Set<string>();
  for (const setting of view.settings ?? []) {
    if (typeof setting?.key !== "string" || !SETTING_KEY_RE.test(setting.key)) return `the view "${view.name}": "${String(setting?.key)}" is no setting's key: letters, digits, _ and -`;
    if (setting.key === "enabled") return `the view "${view.name}": "enabled" is every view's own setting`;
    if (keys.has(setting.key)) return `the view "${view.name}": the setting "${setting.key}" twice`;
    keys.add(setting.key);
  }
  return undefined;
}

export class ViewRegistry {
  private offered: readonly ViewDefinition[];

  constructor(private readonly builtIn: readonly ViewDefinition[] = []) {
    this.offered = builtIn;
  }

  /** The views as offered: the built-in ones (each replaced by a defined one of its name), then the others defined */
  all(): readonly ViewDefinition[] {
    return this.offered;
  }

  named(name: string): ViewDefinition | undefined {
    return this.offered.find((view) => view.name === name);
  }

  /** Views defined besides the built-in ones, in place of those defined before; what cannot be a view left out, said why */
  define(views: readonly ViewDefinition[]): readonly string[] {
    const problems: string[] = [];
    const byName = new Map<string, ViewDefinition>();
    for (const view of views) {
      const problem = validateView(view);
      if (problem) {
        problems.push(problem);
        continue;
      }
      if (byName.has(view.name)) problems.push(`the view "${view.name}" is defined twice: the last kept`);
      byName.set(view.name, view);
    }
    const names = new Set(this.builtIn.map((view) => view.name));
    this.offered = [...this.builtIn.map((view) => byName.get(view.name) ?? view), ...[...byName.values()].filter((view) => !names.has(view.name))];
    return problems;
  }
}
