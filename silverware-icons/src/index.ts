// Silverware Icons (docs/silverware-icons.md): sets of icons the other plugins draw and offer to pick from. Its API
// page hands `api` to Space Lua (`silverware.icons.api`), the other plugins' init pages hand it to theirs; one object
// per module, as js.importFromSpace gives the same module on each load of Space Lua.
import { Drawing } from "./draw.ts";
import { BUILT_IN_SETS } from "./manifest.ts";
import { type Loader, Registry } from "./registry.ts";

/** What the other plugins get (shared/icons.ts `Icons`: its version the one they were written for) */
export const API_VERSION = 1;

// The sets' files beside the bundle: the bundle's own URL is the space's (js.importFromSpace imports /.fs/<path>)
const loadBeside: Loader = async (file) => ((await import(new URL(`./${file}`, import.meta.url).href)) as { default: unknown }).default;

const registry: Registry = new Registry(
  BUILT_IN_SETS,
  loadBeside,
  (on) => drawing.loading(on),
  () => drawing.fill(),
);
const drawing: Drawing = new Drawing(registry, () => (typeof document === "undefined" ? undefined : document));

export const api = {
  version: API_VERSION,
  markup: (value: string, base: string): string => drawing.markup(value, base),
  text: (value: string): string => drawing.text(value),
};

/** The user's sets (`silverware.icons.defineSets`): what was wrong, as one text to show; none where all is well */
export function defineSets(definitions: unknown): string | undefined {
  const value = definitions && typeof definitions === "object" && !Array.isArray(definitions) && "default" in definitions ? (definitions as { default: unknown }).default : definitions;
  const { problems, again } = registry.define(value);
  const lines = [
    ...(problems.length ? [`Silverware Icons: sets not defined: ${problems.join("; ")}`] : []),
    ...(again.length ? [`Silverware Icons: sets defined again (the last definition counts): ${again.join(", ")}`] : []),
  ];
  return lines.length ? lines.join("\n") : undefined;
}

/** Space Lua is loaded (again): the user's sets are made anew, replacing those of before */
export function resetDefinitions(): void {
  registry.anewDefinitions();
}
