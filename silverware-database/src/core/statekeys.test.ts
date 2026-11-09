import { describe, expect, it } from "vitest";
import type { Property } from "../model/database.ts";
import { arrangementEntries, groupEntries, propertyEntries } from "./statekeys.ts";
import type { ViewDefinition } from "./view.ts";

const SCHEMA: Property[] = ["status", "due", "estimate"].map((key) => ({ key, label: key, type: "text", params: {}, readonly: false }));
const view = (more: Partial<ViewDefinition> = {}): ViewDefinition => ({ name: "v", label: "V", icon: "x", render: () => {}, ...more });

describe("a view's state as a place keeps it", () => {
  it("keeps which properties show as those hidden, or those shown where the view hides by default; in the schema's order, none where the list is empty", () => {
    expect(propertyEntries(view(), ["estimate", "status"], SCHEMA)).toEqual({ hiddenProperties: ["due"] });
    expect(propertyEntries(view(), ["status", "due", "estimate"], SCHEMA)).toEqual({ hiddenProperties: undefined });
    expect(propertyEntries(view({ properties: { hiddenByDefault: true } }), ["estimate", "status"], SCHEMA)).toEqual({ shownProperties: ["status", "estimate"] });
    expect(propertyEntries(view({ properties: { hiddenByDefault: true } }), [], SCHEMA)).toEqual({ shownProperties: undefined });
  });

  it("keeps a grouping with its groups' arrangement, or lets the arrangement of before go where none is given (empty groups' hiding kept)", () => {
    const arrangement = { order: ["b", "a"], hidden: [], hideEmpty: true };
    expect(arrangementEntries(arrangement)).toEqual({ groupOrder: ["b", "a"], groupHidden: undefined, groupHideEmpty: true });
    expect(groupEntries("status", arrangement)).toEqual({ groupBy: "status", groupOrder: ["b", "a"], groupHidden: undefined, groupHideEmpty: true });
    expect(groupEntries(undefined, arrangement)).toEqual({ groupBy: undefined, groupOrder: undefined, groupHidden: undefined, groupHideEmpty: undefined });
    expect(groupEntries("due")).toEqual({ groupBy: "due", groupOrder: undefined, groupHidden: undefined });
  });
});
