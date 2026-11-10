// Which views exist: the built-in ones and those defined besides (the user's,
// `silverware.database.defineViews`), in a registry of definitions
// (registry.ts). The core knows no view by name.
import { DefinitionRegistry } from "./registry.ts";
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
  if (view.menu !== undefined && typeof view.menu !== "function") return `the view "${view.name}": its menu is no function`;
  const groupBy = view.groupBy as false | { types?: unknown; required?: unknown; draws?: unknown; prefer?: unknown } | undefined;
  const flag = (value: unknown) => value === undefined || typeof value === "boolean";
  const names = (value: unknown) => value === undefined || (Array.isArray(value) && value.every((one) => typeof one === "string"));
  if (groupBy !== undefined && groupBy !== false && (typeof groupBy !== "object" || groupBy === null || !names(groupBy.types) || !names(groupBy.prefer) || !flag(groupBy.required) || !flag(groupBy.draws)))
    return `the view "${view.name}": its groupBy is false or { types: [type names], prefer: [type names], required, draws: true or false }`;
  const properties = view.properties as false | { hiddenByDefault?: unknown } | undefined;
  if (properties !== undefined && properties !== false && (typeof properties !== "object" || properties === null || !flag(properties.hiddenByDefault)))
    return `the view "${view.name}": its properties is false or { hiddenByDefault: true or false }`;
  if (view.colors !== undefined && view.colors !== false) return `the view "${view.name}": its colors is false or left out`;
  const keys = new Set<string>();
  for (const setting of view.settings ?? []) {
    if (typeof setting?.key !== "string" || !SETTING_KEY_RE.test(setting.key)) return `the view "${view.name}": "${String(setting?.key)}" is no setting's key: letters, digits, _ and -`;
    if (setting.key === "enabled") return `the view "${view.name}": "enabled" is every view's own setting`;
    if (keys.has(setting.key)) return `the view "${view.name}": the setting "${setting.key}" twice`;
    keys.add(setting.key);
  }
  return undefined;
}

export class ViewRegistry extends DefinitionRegistry<ViewDefinition> {
  constructor(builtIn: readonly ViewDefinition[] = []) {
    super(builtIn, validateView, "view");
  }
}
