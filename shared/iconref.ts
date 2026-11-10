// How the plugins write an icon (docs/silverware-icons.md): an icon of a set of Silverware Icons is `<set>:<name>`
// (`lucide:house`), anything else is text shown as it is (an emoji, "H1"). Its form alone tells them apart, so a
// plugin reads, checks and keeps a value without Silverware Icons installed or its sets loaded. Pure: a domain may
// use it (shared/icons.ts gives it on with the API's type and its stand-in).

const REFERENCE_RE = /^([a-z][a-z0-9-]*):([a-z0-9][a-z0-9-]*)$/;

/** An icon of a set: its set's name and its name */
export type IconReference = { readonly set: string; readonly name: string };

/** A value's reference to an icon of a set, undefined where it is text */
export function referenceOf(value: string): IconReference | undefined {
  const match = REFERENCE_RE.exec(value);
  return match ? { set: match[1]!, name: match[2]! } : undefined;
}

/** Whether a value is a reference to an icon of a set (`lucide:house`), by its form */
export function isReference(value: string): boolean {
  return REFERENCE_RE.test(value);
}

/** A name of an icon as people read it: `arrow-big-down` Arrow big down (as scripts/icons/lucide.mjs labels them) */
export function iconLabelOf(name: string): string {
  const words = name.split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
