import { describe, expect, it } from "vitest";
import { TypeRegistry } from "../domain/types/registry.ts";
import type { Property } from "../model/database.ts";
import { groupable, groupedBy } from "./groupmenu.ts";
import type { ViewDefinition, ViewHost } from "./view.ts";

describe("what a view is grouped by", () => {
  const types = new TypeRegistry();
  const property = (key: string, type: string, params: Property["params"] = {}): Property => ({ key, label: key, type, params, readonly: false });
  const properties = [property("photos", "files"), property("status", "select", { options: ["Todo", "Done"] }), property("notes", "text")];
  const host = (group?: string) => ({ database: { properties }, type: (one: Property) => types.of(one.type, one.params), listing: { group } }) as unknown as ViewHost;
  const view = (groupBy: ViewDefinition["groupBy"]) => ({ name: "v", groupBy }) as ViewDefinition;

  it("never offers a property of files (a list of files is no group), nor takes it as a board's columns", () => {
    expect(groupable(view(undefined), host()).map((one) => one.key)).toEqual(["status", "notes"]);
    // (Picked by hand in the block: not grouped by it)
    expect(groupedBy(view(undefined), host("photos"))).toBeUndefined();
    // (A board, always grouped, the files first in the schema: its columns of the first it may group by)
    expect(groupedBy(view({ required: true }), host())?.key).toBe("status");
    expect(groupedBy(view({ required: true, prefer: ["files"] }), host())?.key).toBe("status");
  });
});
