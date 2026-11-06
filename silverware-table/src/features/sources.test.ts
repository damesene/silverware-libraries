import { describe, expect, it, vi } from "vitest";
import type { ModelHost } from "../core/feature.ts";
import { memorySources, type SourceProvider, type SourcesOffer } from "../sources.ts";
import { Sources, sourceTable } from "./sources.ts";

/** The module on a host that keeps what it offers and counts the tables' checks */
function started<P extends SourceProvider>(provider: P = memorySources({ tasks: { columns: ["name", "due"], rows: [["a | b", "2025-11-06"]] } }) as unknown as P) {
  let offer: SourcesOffer | undefined;
  const tablesChanged = vi.fn();
  const host = { offer: (api: SourcesOffer) => void (offer = api), tablesChanged } as unknown as ModelHost;
  const module = new Sources(host, provider);
  module.start();
  return { offer: offer!, tablesChanged, module, provider };
}

describe("sourceTable", () => {
  it("makes a source's data a table: its columns the header, each value a cell's text", () => {
    const table = sourceTable({ columns: ["name"], rows: [["a | b"], []] });
    expect(table.rows.map((r) => r.cells)).toEqual([["name"], ["a \\| b"], [""]]);
  });
});

describe("the sources module", () => {
  it("offers a source as a table, the same object while its data are the same", () => {
    const { offer } = started();
    const table = offer.table("Tasks");
    expect(table?.rows[1]?.cells).toEqual(["a \\| b", "2025-11-06"]);
    expect(offer.table("tasks")).toBe(table);
    expect(offer.names()).toEqual(["tasks"]);
  });

  it("tells no such source (null) from one not read yet (undefined)", () => {
    const provider = { names: () => ["tasks"], read: () => undefined, changed: () => () => {} };
    const { offer } = started(provider);
    expect(offer.table("tasks")).toBeUndefined();
    expect(offer.table("people")).toBeNull();
  });

  it("has the tables checked again as a source changes, and counts the changes", () => {
    const { offer, tablesChanged, provider, module } = started(memorySources({ tasks: { columns: ["name"], rows: [] } }));
    const version = offer.version();
    provider.set("people", { columns: ["value"], rows: [["anna"]] });
    expect(tablesChanged).toHaveBeenCalledTimes(1);
    expect(offer.version()).toBe(version + 1);
    module.stop();
    provider.set("people", undefined);
    expect(tablesChanged).toHaveBeenCalledTimes(1);
  });
});
