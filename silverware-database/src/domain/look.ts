// How an item looks besides its values (model/database.ts `ItemLook`): an
// icon, one character (an emoji, as the picker gives it) or an icon of a set of
// Silverware Icons (`lucide:house`, shared/icons.ts), and a color of the
// palette (domain/colors.ts). What may be one is the domain's; where it is
// kept, the store's; how it shows, the core's (core/look.ts).
import { isReference } from "../../../shared/iconref.ts";
import type { ItemLook } from "../model/database.ts";
import { isColor } from "./colors.ts";

// An icon: one character as the user sees it (an emoji of several code points too: a flag, a family), never longer
const ICON_MAX = 32;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Why something cannot be an item's icon, undefined where it can */
export function validateIcon(icon: unknown): string | undefined {
  if (typeof icon !== "string" || !icon) return "An icon is a character";
  // (Whether its set is installed or loaded is not asked: a value read is never dropped for it)
  if (isReference(icon)) return undefined;
  if (icon.length > ICON_MAX || [...segmenter.segment(icon)].length !== 1) return "An icon is one character (an emoji) or an icon picked";
  if (/^[\s\p{C}]/u.test(icon)) return "An icon is a character that shows";
  return undefined;
}

/** Why a look cannot be an item's, undefined where it can */
export function validateLook(look: ItemLook): string | undefined {
  if (look.icon !== undefined) {
    const problem = validateIcon(look.icon);
    if (problem) return problem;
  }
  if (look.color !== undefined && !isColor(look.color)) return `"${String(look.color)}" is no color`;
  return undefined;
}

/** A look as kept (a store's object of `icon` and `color`), what is none of them left out; none where nothing is left */
export function readLook(kept: Readonly<Record<string, unknown>>): ItemLook | undefined {
  const icon = validateIcon(kept.icon) ? undefined : (kept.icon as string);
  const color = isColor(kept.color) ? kept.color : undefined;
  return lookOf(icon, color);
}

/** A look of an icon and a color (none of either: left out; neither: none) */
export function lookOf(icon: string | undefined, color: string | undefined): ItemLook | undefined {
  if (icon === undefined && color === undefined) return undefined;
  return { ...(icon === undefined ? {} : { icon }), ...(color === undefined ? {} : { color }) };
}

/** Two looks the same (none and an empty one alike) */
export function sameLook(a: ItemLook | undefined, b: ItemLook | undefined): boolean {
  return a?.icon === b?.icon && a?.color === b?.color;
}
