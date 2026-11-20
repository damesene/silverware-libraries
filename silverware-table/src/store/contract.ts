// The contract every table store passes (docs/silverware-table-store-plan.md,
// *Contract tests*): a store's test runs it against itself, made by a
// fixture of its own. What step 2 of the plan has (the read side): tables
// read in order with keys that stay, revisions, documents. Transactions,
// places, `writable` and changes told join it with the steps that add them.
import { describe, expect, it } from "vitest";
import type { Table } from "../markdown.ts";
import type { TableStore } from "../core/store.ts";

/** A store holding these documents' tables (by name, in order), and a way to put others in a document's place */
export type StoreFixture = {
  readonly store: TableStore;
  /** The document's tables made these, as an edit outside the store would (typed, synced) */
  replace(document: string, tables: readonly Table[]): void;
};

const table = (header: readonly string[], ...rows: (readonly string[])[]): Table => ({
  rows: [header, ...rows].map((cells) => ({ cells: [...cells] })),
  align: header.map(() => "" as const),
  indent: "",
  padded: false,
});

export function storeContract(name: string, make: (documents: Readonly<Record<string, readonly Table[]>>) => StoreFixture): void {
  describe(`${name}: the table store's contract`, () => {
    const prices = table(["Fruit", "Price"], ["Pear", "12"], ["Fig", "3"]);
    const counts = table(["Item", "Count"], ["Box", "4"]);

    it("reads a document's tables in order, each with its model", async () => {
      const { store } = make({ Shop: [prices, counts] });
      const tables = (await store.tables("Shop"))!;
      expect(tables.map((t) => t.model.rows.map((r) => r.cells))).toEqual([prices.rows.map((r) => r.cells), counts.rows.map((r) => r.cells)]);
    });

    it("gives no tables for a document without any, null for one not there", async () => {
      const { store } = make({ Empty: [] });
      expect(await store.tables("Empty")).toEqual([]);
      expect(await store.tables("Nowhere")).toBeNull();
    });

    it("keeps a table's key and revision read again unchanged, each table's its own", async () => {
      const { store } = make({ Shop: [prices, counts] });
      const first = (await store.tables("Shop"))!;
      const again = (await store.tables("Shop"))!;
      expect(again.map((t) => t.key)).toEqual(first.map((t) => t.key));
      expect(again.map((t) => t.revision)).toEqual(first.map((t) => t.revision));
      expect(new Set(first.map((t) => t.key)).size).toBe(2);
    });

    it("changes the revision of a table changed, and only its; the key stays", async () => {
      const fixture = make({ Shop: [prices, counts] });
      const before = await fixture.store.tables("Shop");
      fixture.replace("Shop", [table(["Fruit", "Price"], ["Pear", "13"], ["Fig", "3"]), counts]);
      const after = (await fixture.store.tables("Shop"))!;
      expect(after.map((t) => t.key)).toEqual(before!.map((t) => t.key));
      expect(after[0]!.revision).not.toBe(before![0]!.revision);
      expect(after[0]!.model.rows[1]!.cells).toEqual(["Pear", "13"]);
      expect(after[1]!.revision).toBe(before![1]!.revision);
    });

    it("tells the document a key is of", async () => {
      const { store } = make({ Shop: [prices], Stock: [counts] });
      const [shop] = (await store.tables("Shop"))!;
      const [stock] = (await store.tables("Stock"))!;
      expect(store.documentOf(shop!.key)).toBe("Shop");
      expect(store.documentOf(stock!.key)).toBe("Stock");
    });
  });
}
