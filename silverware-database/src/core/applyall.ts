// "Apply to all views" (⋯: Visible properties, Group, Color by): a part of
// how one view shows its items given to every other view on in the same
// place (its block), as each keeps it. The core's alone: what a view takes is
// in its definition (`properties`, `colors`, `groupBy`), how it is kept is the
// place's (`<view>.<key>` in the block); the views know nothing of it. Pure:
// the entries to write and the views left, with why.
import type { Property } from "../model/database.ts";
import type { GroupArrangement } from "../domain/grouping.ts";
import { groupEntries, propertyEntries, STATE_KEYS } from "./statekeys.ts";
import type { ViewDefinition } from "./view.ts";

/** A part of a view's look given to the others */
export type LookPart = "properties" | "colorBy" | "group";

/** Apply to all views as a menu offers it: what gives it, or why it gives nothing (no other view takes it) */
export type ToAll = { readonly run: () => void; readonly disabled?: string };

/** What the view it is given from has of it now */
export type LookOf = {
  /** The keys of the properties it shows, in the schema's order */
  readonly shown: readonly string[];
  readonly colorBy: string | undefined;
  /** The property it is grouped by (undefined: none), and how its groups are arranged */
  readonly group: Property | undefined;
  readonly arrangement: GroupArrangement;
};

/**
 * The block's entries giving `part` of `from` to each of `views` but itself
 * (`<view>.<key>`: value, undefined taking the key off), and the views left
 * (they take no such part, or not this one), with why
 */
export function appliedToViews(
  part: LookPart,
  from: ViewDefinition,
  look: LookOf,
  views: readonly ViewDefinition[],
  schema: readonly Property[],
  typeOf: (property: Property) => string,
): { readonly entries: Readonly<Record<string, unknown>>; readonly given: readonly ViewDefinition[]; readonly left: readonly { readonly view: ViewDefinition; readonly why: string }[] } {
  const entries: Record<string, unknown> = {};
  const given: ViewDefinition[] = [];
  const left: { view: ViewDefinition; why: string }[] = [];
  for (const view of views) {
    if (view.name === from.name) continue;
    const why = whyNot(part, view, look, typeOf);
    if (why) {
      left.push({ view, why });
      continue;
    }
    // (Kept as the view keeps it: statekeys.ts, the place's own form)
    const own =
      part === "properties" ? propertyEntries(view, look.shown, schema) : part === "colorBy" ? { [STATE_KEYS.colorBy]: look.colorBy } : groupEntries(look.group?.key, look.arrangement);
    for (const [name, value] of Object.entries(own)) entries[`${view.name}.${name}`] = value;
    given.push(view);
  }
  return { entries, given, left };
}

/** Why `view` takes no such part (none: it takes it) */
function whyNot(part: LookPart, view: ViewDefinition, look: LookOf, typeOf: (property: Property) => string): string | undefined {
  if (part === "properties") return view.properties === false ? "it shows no property" : undefined;
  if (part === "colorBy") return view.colors === false ? "it colors no item" : undefined;
  const groupBy = view.groupBy;
  if (groupBy === false) return "it is never grouped";
  // (A view always grouped keeps its own: given none, it would fall back to its default, the arrangement it had gone)
  if (!look.group) return groupBy?.required ? "it is always grouped" : undefined;
  if (groupBy?.types && !groupBy.types.includes(typeOf(look.group))) return `it groups by no property of the type of ${look.group.label}`;
  return undefined;
}
