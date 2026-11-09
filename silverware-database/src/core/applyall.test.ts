import { describe, expect, it } from "vitest";
import type { Property } from "../model/database.ts";
import { appliedToViews, type LookOf } from "./applyall.ts";
import type { ViewDefinition } from "./view.ts";

const view = (name: string, more: Partial<ViewDefinition> = {}): ViewDefinition => ({ name, label: name[0]!.toUpperCase() + name.slice(1), icon: "x", render: () => {}, ...more });
const TABLE = view("table");
const LIST = view("list");
const CALENDAR = view("calendar", { properties: { hiddenByDefault: true }, groupBy: { types: ["select"] } });
const PLAIN = view("plain", { properties: false, colors: false, groupBy: false });
const VIEWS = [TABLE, LIST, CALENDAR, PLAIN];

const SCHEMA: Property[] = [
  { key: "status", label: "Status", type: "select", params: {}, readonly: false },
  { key: "due", label: "Due", type: "date", params: {}, readonly: false },
  { key: "estimate", label: "Estimate", type: "number", params: {}, readonly: false },
];
const typeOf = (property: Property) => property.type;
const look = (more: Partial<LookOf> = {}): LookOf => ({ shown: ["status", "due"], colorBy: "status", group: SCHEMA[0], arrangement: { order: ["Done", "Todo"], hidden: ["Later"], hideEmpty: true }, ...more });

describe("a part of a view's look given to the others of its block", () => {
  it("gives the properties shown as each keeps them: those hidden, or those shown where it hides by default; not to a view showing none, nor to itself", () => {
    const { entries, given, left } = appliedToViews("properties", TABLE, look(), VIEWS, SCHEMA, typeOf);
    expect(entries).toEqual({ "list.hiddenProperties": ["estimate"], "calendar.shownProperties": ["status", "due"] });
    expect(given.map((one) => one.name)).toEqual(["list", "calendar"]);
    expect(left.map((one) => [one.view.name, one.why])).toEqual([["plain", "it shows no property"]]);
    // (Every one shown: no list kept where hidden ones are kept)
    expect(appliedToViews("properties", TABLE, look({ shown: ["status", "due", "estimate"] }), [TABLE, LIST], SCHEMA, typeOf).entries).toEqual({ "list.hiddenProperties": undefined });
  });

  it("gives Color by, None too, to every view that colors its items", () => {
    expect(appliedToViews("colorBy", TABLE, look(), VIEWS, SCHEMA, typeOf).entries).toEqual({ "list.colorBy": "status", "calendar.colorBy": "status" });
    expect(appliedToViews("colorBy", TABLE, look({ colorBy: undefined }), [TABLE, LIST], SCHEMA, typeOf).entries).toEqual({ "list.colorBy": undefined });
  });

  it("gives the grouping with its groups' arrangement where a view groups by such a property; left with why elsewhere", () => {
    const by = appliedToViews("group", TABLE, look(), VIEWS, SCHEMA, typeOf);
    expect(by.entries).toEqual({
      "list.groupBy": "status", "list.groupOrder": ["Done", "Todo"], "list.groupHidden": ["Later"], "list.groupHideEmpty": true,
      "calendar.groupBy": "status", "calendar.groupOrder": ["Done", "Todo"], "calendar.groupHidden": ["Later"], "calendar.groupHideEmpty": true,
    });
    expect(by.left.map((one) => one.view.name)).toEqual(["plain"]);
    // A date: no calendar grouped by it; None: every view's grouping taken off
    const dated = appliedToViews("group", TABLE, look({ group: SCHEMA[1] }), VIEWS, SCHEMA, typeOf);
    expect(dated.left.map((one) => [one.view.name, one.why])).toEqual([["calendar", "it groups by no property of the type of Due"], ["plain", "it is never grouped"]]);
    expect(appliedToViews("group", TABLE, look({ group: undefined }), [TABLE, LIST], SCHEMA, typeOf).entries).toEqual({ "list.groupBy": undefined, "list.groupOrder": undefined, "list.groupHidden": undefined, "list.groupHideEmpty": undefined });
  });

  it("leaves a view always grouped (a board) as it is where None is given: it would fall back to its default, its arrangement gone", () => {
    const board = view("board", { groupBy: { required: true, draws: true, prefer: ["select"] } });
    const none = appliedToViews("group", TABLE, look({ group: undefined }), [TABLE, board], SCHEMA, typeOf);
    expect(none.entries).toEqual({});
    expect(none.left.map((one) => [one.view.name, one.why])).toEqual([["board", "it is always grouped"]]);
    // (A property given: taken, as any view)
    expect(appliedToViews("group", TABLE, look(), [TABLE, board], SCHEMA, typeOf).entries["board.groupBy"]).toBe("status");
  });
});
