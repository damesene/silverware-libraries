// The shape of a set of icons (docs/silverware-icons.md, *The sets*): what the built-in sets' files hold, as
// scripts/icons/ writes them, and what a user's set gives (`defineSets`, checked by this file's checks).

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
