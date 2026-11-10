// Icons as the plugins draw and pick them (docs/silverware-icons.md): Silverware Icons' API as a plugin's init page
// hands it over, or its stand-in without it (`iconsOf`); how a value is written (`<set>:<name>` or text) is
// iconref.ts's, pure, which this file gives on.

import { iconLabelOf, isReference, referenceOf } from "./iconref.ts";

export { type IconReference, iconLabelOf, isReference, referenceOf } from "./iconref.ts";

/** The version of Silverware Icons' API this file is written for: another is taken as none (updated apart) */
export const ICONS_VERSION = 1;

export type PickOptions = {
  // The tabs: these sets (none: all; one: no tabs)
  readonly sets?: readonly string[];
  // A value picked, as it is written (an emoji's character, `lucide:house`)
  readonly picked: (value: string) => void;
  // Told once a set's icons are shown (the picker grew: the caller places its panel again)
  readonly shown?: () => void;
  // The search field's icon (markup of the caller's icons)
  readonly searchIcon?: string;
};

/** What a plugin draws and picks icons with: Silverware Icons' API (`silverware.icons.api`), or the stand-in without it */
export type Icons = {
  readonly version: number;
  // A value's markup in `<base>-icon`: text as itself; a set's icon its SVG, a placeholder filled once its set is in,
  // or a stand-in (a dotted box, its title why). Put into the page as it is made, not kept for later: a placeholder is
  // filled in the page, while its set loads and a moment after
  markup(value: string, base: string): string;
  // A value as text (a tooltip, a screen reader): text itself, an icon its label
  text(value: string): string;
  // The picker in `into` (its children replaced), the function given back ending it
  pick(into: HTMLElement, options: PickOptions): () => void;
};

// Where Silverware Icons is installed from (its page in the repository, as REPO.md lists it)
const ICONS_PAGE = "https://github.com/damesene/silverware-libraries/blob/main/silverware-icons/silverware-icons.md";

/**
 * The icons a plugin draws and picks with: Silverware Icons' API as the plugin's init page hands it over, where it is
 * there and of the version this file is written for; else the stand-in (text as itself, an icon a dotted box saying
 * it needs Silverware Icons, the picker's place saying so). A plugin calls it once and never asks which it got
 */
export function iconsOf(given: unknown): Icons {
  if (given && typeof given === "object") {
    const api = given as Partial<Icons>;
    if (api.version === ICONS_VERSION && typeof api.markup === "function" && typeof api.text === "function" && typeof api.pick === "function") return api as Icons;
  }
  return STAND_IN;
}

const STAND_IN: Icons = {
  version: ICONS_VERSION,
  markup: (value, base) =>
    isReference(value) ? `<span class="${base}-icon ${base}-icon-missing" title="Needs Silverware Icons"></span>` : `<span class="${base}-icon">${escapeMarkup(value)}</span>`,
  text: (value) => {
    const reference = referenceOf(value);
    return reference ? iconLabelOf(reference.name) : value;
  },
  pick: (into) => {
    const doc = into.ownerDocument;
    // (Styled here: without Silverware Icons, no style page of it is installed)
    const note = doc.createElement("p");
    note.style.cssText = "margin: 0; padding: 12px; line-height: 1.4;";
    const link = doc.createElement("a");
    link.href = ICONS_PAGE;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Silverware Icons";
    note.append("Emoji and icons need ", link, ". Install it as you installed this plugin.");
    into.replaceChildren(note);
    return () => undefined;
  },
};

/** Text made safe in markup and its attributes */
export function escapeMarkup(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
