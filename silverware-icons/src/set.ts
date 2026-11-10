// The shape of a set of icons (docs/silverware-icons.md, *The sets*): what the built-in sets' files hold, as
// scripts/icons/ writes them, and what a user's set gives (`defineSets`, checked by this file's checks).
import { iconLabelOf } from "../../shared/icons.ts";

/** How a set's icons are drawn: from nodes (24×24, currentColor), or as a character (an emoji) */
export type SetKind = "svg" | "text";

/** A built-in set as the manifest knows it before any of its files is loaded (src/manifest.ts, generated) */
export type SetEntry = {
  // The prefix of its references (`lucide:house`); a set of characters has none (its value is its character)
  readonly name: string;
  // Its tab in the picker
  readonly label: string;
  readonly kind: SetKind;
  readonly license: string;
  // Its files beside the bundle: what drawing loads (an SVG set's), what picking loads
  readonly draw?: string;
  readonly search: string;
};

/** An SVG element of an icon: a path's `d` alone, else its tag and attributes */
export type IconNode = string | readonly [tag: string, attrs: Readonly<Record<string, string>>];

/** An SVG set's drawing data (its file `draw`): each icon's nodes by name, the names it had (aliases) to its name */
export type DrawData = {
  readonly icons: Readonly<Record<string, readonly IconNode[]>>;
  readonly aliases: Readonly<Record<string, string>>;
};

/** A set's group: its id, its label, its icon (a value of the set: `lucide:house`, an emoji) */
export type IconGroup = { readonly id: string; readonly label: string; readonly icon: string };

/**
 * An icon as picked: its name (an emoji's: its character), its label, its keywords (one text, words apart by
 * spaces), its groups' ids
 */
export type SearchIcon = readonly [name: string, label: string, keywords: string, groups: readonly string[]];

/** A set's picking data (its file `search`): its groups, its icons in the order shown */
export type SearchData = { readonly groups: readonly IconGroup[]; readonly icons: readonly SearchIcon[] };

/** A set with its data in hand: a user's (`defineSets`), or a built-in one once loaded */
export type DefinedSet = {
  readonly name: string;
  readonly label: string;
  readonly kind: SetKind;
  readonly license?: string;
  readonly draw?: DrawData;
  readonly search: SearchData;
};

// What an SVG icon may be drawn of: the elements and attributes of line icons. Not a protection from a user's set
// (defineSets runs the user's JS), but so a set of any source cannot break the page it is drawn in
export const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);
export const ALLOWED_ATTRIBUTES: ReadonlySet<string> = new Set([
  "d", "cx", "cy", "r", "x", "y", "width", "height", "rx", "ry", "x1", "x2", "y1", "y2", "points",
  "fill", "fill-rule", "clip-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "transform",
]);

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const ICON_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * A user's set made a set, checked (docs/silverware-icons.md, *The sets*): `{ name, label, kind, license, groups,
 * icons }`, each icon `{ name, label, keywords, groups, nodes, aliases }` (an SVG set's nodes: a path's `d`, or
 * `[tag, attrs]`; a set of characters' name: its character). A set that is wrong: none, and why; an icon that is
 * wrong is left out, said in `problems`
 */
export function setOf(value: unknown): { set?: DefinedSet; problems: string[] } {
  const problems: string[] = [];
  if (!isObject(value)) return { problems: ["a set is not { name, label, kind, icons }"] };
  const { name, label, kind, license } = value;
  if (typeof name !== "string" || !NAME_RE.test(name)) return { problems: [`a set's name is not lower case letters, digits and dashes: ${String(name)}`] };
  if (typeof label !== "string" || !label.trim()) return { problems: [`the set ${name} has no label`] };
  if (kind !== "svg" && kind !== "text") return { problems: [`the set ${name}'s kind is not "svg" or "text"`] };
  if (license !== undefined && typeof license !== "string") return { problems: [`the set ${name}'s license is not text`] };
  if (!Array.isArray(value.icons)) return { problems: [`the set ${name} has no list of icons`] };
  const groups: IconGroup[] = [];
  for (const group of Array.isArray(value.groups) ? value.groups : []) {
    if (isObject(group) && typeof group.id === "string" && group.id && typeof group.label === "string" && typeof group.icon === "string") groups.push({ id: group.id, label: group.label, icon: group.icon });
    else problems.push(`the set ${name}: a group is not { id, label, icon }`);
  }
  const ids = new Set(groups.map((group) => group.id));
  const drawn: Record<string, readonly IconNode[]> = {};
  const aliases: Record<string, string> = {};
  const icons: SearchIcon[] = [];
  for (const icon of value.icons) {
    const made = iconOf(icon, kind, ids);
    if (typeof made === "string") {
      problems.push(`the set ${name}: ${made}`);
      continue;
    }
    if (icons.some((one) => one[0] === made.search[0])) {
      problems.push(`the set ${name}: ${made.search[0]} twice`);
      continue;
    }
    icons.push(made.search);
    if (made.nodes) drawn[made.search[0]] = made.nodes;
    for (const alias of made.aliases) aliases[alias] ??= made.search[0];
  }
  for (const alias of Object.keys(aliases)) if (drawn[alias]) delete aliases[alias];
  const set: DefinedSet = {
    name,
    label: label.trim(),
    kind,
    ...(license ? { license } : {}),
    ...(kind === "svg" ? { draw: { icons: drawn, aliases } } : {}),
    search: { groups, icons },
  };
  return { set, problems };
}

/** One icon of a user's set, or what is wrong with it */
function iconOf(value: unknown, kind: SetKind, groups: ReadonlySet<string>): { search: SearchIcon; nodes?: IconNode[]; aliases: string[] } | string {
  if (!isObject(value) || typeof value.name !== "string" || !value.name) return "an icon has no name";
  const name = value.name;
  if (kind === "svg" && !ICON_NAME_RE.test(name)) return `the icon ${name}'s name is not lower case letters, digits and dashes`;
  const label = typeof value.label === "string" && value.label.trim() ? value.label.trim() : kind === "svg" ? iconLabelOf(name) : name;
  const keywords = Array.isArray(value.keywords) ? value.keywords.filter((one): one is string => typeof one === "string").join(" ") : typeof value.keywords === "string" ? value.keywords : "";
  const own = Array.isArray(value.groups) ? value.groups.filter((one): one is string => typeof one === "string") : [];
  const unknown = own.find((one) => !groups.has(one));
  if (unknown) return `the icon ${name}'s group ${unknown} is none of the set's`;
  const aliases = Array.isArray(value.aliases) ? value.aliases.filter((one): one is string => typeof one === "string" && ICON_NAME_RE.test(one)) : [];
  const search: SearchIcon = [name, label, keywords, own];
  if (kind === "text") return { search, aliases: [] };
  if (!Array.isArray(value.nodes) || !value.nodes.length) return `the icon ${name} has no nodes`;
  const nodes: IconNode[] = [];
  for (const node of value.nodes) {
    const made = nodeOf(node);
    if (typeof made === "object" && "problem" in made) return `the icon ${name}: ${made.problem}`;
    nodes.push(made);
  }
  return { search, nodes, aliases };
}

/** A node of an icon as given: a path's `d`, or `[tag, attrs]` of the elements and attributes allowed (numbers as text) */
function nodeOf(value: unknown): IconNode | { problem: string } {
  if (typeof value === "string") return value ? value : { problem: "a path without d" };
  if (!Array.isArray(value) || typeof value[0] !== "string" || !isObject(value[1])) return { problem: "a node is not a path's d or [tag, attrs]" };
  const tag = value[0];
  if (!ALLOWED_ELEMENTS.has(tag)) return { problem: `<${tag}> is not drawn (only ${[...ALLOWED_ELEMENTS].join(", ")})` };
  const attrs: Record<string, string> = {};
  for (const [key, one] of Object.entries(value[1])) {
    if (!ALLOWED_ATTRIBUTES.has(key)) return { problem: `<${tag}>'s ${key} is not drawn` };
    if (typeof one !== "string" && typeof one !== "number") return { problem: `<${tag}>'s ${key} is not text or a number` };
    attrs[key] = String(one);
  }
  return [tag, attrs];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
