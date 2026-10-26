// Which formats exist: the built-in ones (builtin/) and the custom ones the
// user defines (custom.ts, from Space Lua): a custom one of a built-in's name
// replaces it in its place, the others come after the built-in ones where
// they are offered and before them where a line is read.
import { BLOCK_READING_ORDER, BUILT_IN_DEFINITIONS } from "./builtin/index.ts";
import { formatsOf } from "./custom.ts";
import type { Format } from "./format.ts";

const built = formatsOf(BUILT_IN_DEFINITIONS);
// A mistake in a built-in format is a bug (a test checks there is none)
export const BUILT_IN_PROBLEMS: readonly string[] = built.problems;
const BUILT_IN: readonly Format[] = built.formats;
const BUILT_IN_NAMES = new Set(BUILT_IN.map((f) => f.name));

// The custom formats by name, as last defined
let custom = new Map<string, Format>();
// Defined after Space Lua loaded again: the custom formats of before are replaced by the first definitions
let anew = false;

/** The formats of a scope, in the order they are offered */
export function formatsIn(scope: Format["scope"]): Format[] {
  const own = BUILT_IN.filter((f) => f.scope === scope).map((f) => custom.get(f.name) ?? f);
  const added = [...custom.values()].filter((f) => f.scope === scope && !BUILT_IN_NAMES.has(f.name));
  return [...own, ...added];
}

/** The block formats in the order a line is read: custom ones first, the paragraph last */
export function blockReadingOrder(): Format[] {
  const added = [...custom.values()].filter((f) => f.scope === "block" && !BUILT_IN_NAMES.has(f.name));
  const named = BLOCK_READING_ORDER.map((name) => custom.get(name) ?? BUILT_IN.find((f) => f.name === name)!);
  // A custom format of a built-in one's name but another scope: not read as a block
  return [...added, ...named.filter((f) => f.scope === "block")];
}

/** The format of an id (formats.<name>), if any */
export function formatById(id: string): Format | undefined {
  const name = id.startsWith("formats.") ? id.slice(8) : undefined;
  return name === undefined ? undefined : (custom.get(name) ?? BUILT_IN.find((f) => f.name === name));
}

/** Custom formats, added to those defined before (one of the same name replaced), or replacing them all after `customFormatsAnew`; the names defined again, for a notification */
export function defineCustomFormats(formats: readonly Format[]): string[] {
  const before = anew ? new Map<string, Format>() : custom;
  anew = false;
  const again = formats.filter((f, i) => before.has(f.name) || formats.findIndex((g) => g.name === f.name) < i).map((f) => f.name);
  custom = new Map([...before, ...formats.map((f) => [f.name, f] as const)]);
  return [...new Set(again)];
}

/** Space Lua is loaded again: the next definitions replace the custom formats (kept until then) */
export function customFormatsAnew(): void {
  anew = true;
}

/** Forgets the custom formats */
export function resetCustomFormats(): void {
  custom = new Map();
  anew = false;
}
