// The contract every table store passes (docs/silverware-table-store-plan.md,
// *Contract tests*): a store's test runs it against itself, made by a
// fixture of its own. Tables read in order with keys that stay, revisions,
// documents; transactions (plan, apply, planUndo: the database store's
// shape) written as one step or left whole, a table changed since it was read
// refusing it. A store keeping no tables of a kind (read only: a source) runs
// the read side alone. Tables are given as models: what every store keeps
// alike.
import { describe, expect, it } from "vitest";
import { type ModelRow, NO_ATTRIBUTES, type TableModel } from "../model/model.ts";
import type { TableStore } from "../core/store.ts";

/** A store holding these documents' tables (by name, in order), and a way to put others in a document's place */
export type StoreFixture = {
  readonly store: TableStore;
  /** The document's tables made these, as an edit outside the store would (typed, synced) */
  replace(document: string, tables: readonly TableModel[]): void;
};

/** A table of these headers and rows of text */
export function table(header: readonly string[], ...rows: (readonly string[])[]): TableModel {
  return {
    columns: header.map((text) => ({ header: text, align: "" as const, attributes: NO_ATTRIBUTES })),
    rows: rows.map((cells): ModelRow => ({ cells: cells.map((content) => ({ content, attributes: NO_ATTRIBUTES })), attributes: NO_ATTRIBUTES })),
    attributes: NO_ATTRIBUTES,
  };
}

/** A table of a store as texts: its headers, then its rows' contents (what every store keeps alike) */
const texts = (model: TableModel): string[][] => [model.columns.map((c) => c.header), ...model.rows.map((r) => r.cells.map((c) => c.content))];

export function storeContract(name: string, make: (documents: Readonly<Record<string, readonly TableModel[]>>) => StoreFixture, options: { readonly readOnly?: boolean } = {}): void {
  describe(`${name}: the table store's contract`, () => {
    const prices = table(["Fruit", "Price"], ["Pear", "12"], ["Fig", "3"]);
    const counts = table(["Item", "Count"], ["Box", "4"]);

    it("reads a document's tables in order, each with its model", async () => {
      const { store } = make({ Shop: [prices, counts] });
      const tables = (await store.tables("Shop"))!;
      expect(tables.map((t) => texts(t.model))).toEqual([texts(prices), texts(counts)]);
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
      expect(texts(after[0]!.model)[1]).toEqual(["Pear", "13"]);
      expect(after[1]!.revision).toBe(before![1]!.revision);
    });

    it("tells the document a key is of", async () => {
      const { store } = make({ Shop: [prices], Stock: [counts] });
      const [shop] = (await store.tables("Shop"))!;
      const [stock] = (await store.tables("Stock"))!;
      expect(store.documentOf(shop!.key)).toBe("Shop");
      expect(store.documentOf(stock!.key)).toBe("Stock");
    });

    if (options.readOnly) {
      it("refuses every transaction: its tables are read only", async () => {
        const { store } = make({ Shop: [prices] });
        const [shop] = (await store.tables("Shop"))!;
        const plan = await store.plan({ document: "Shop", edits: [{ kind: "write", key: shop!.key, expects: shop!.revision, model: counts }] });
        expect(plan.skipped?.cause).toBe("refused");
        expect((await store.apply(plan)).written).toBe(false);
      });
      return;
    }

    it("writes a transaction's tables as one step: a table written keeps its key, the others their revisions", async () => {
      const { store } = make({ Shop: [prices, counts] });
      const [shop, count] = (await store.tables("Shop"))!;
      const changed = table(["Fruit", "Price"], ["Pear", "14"], ["Fig", "3"]);
      const plan = await store.plan({ document: "Shop", edits: [{ kind: "write", key: shop!.key, expects: shop!.revision, model: changed }] });
      expect(plan.changes).toBe(1);
      expect((await store.tables("Shop"))!.map((t) => texts(t.model))).toEqual([texts(prices), texts(counts)]);
      expect((await store.apply(plan)).written).toBe(true);
      const after = (await store.tables("Shop"))!;
      expect(after.map((t) => t.key)).toEqual([shop!.key, count!.key]);
      expect(texts(after[0]!.model)).toEqual(texts(changed));
      expect(after[1]!.revision).toBe(count!.revision);
    });

    it("puts new tables after a table or at the end, each with a key of its own; takes one out", async () => {
      const { store } = make({ Shop: [prices, counts] });
      const [shop, count] = (await store.tables("Shop"))!;
      const middle = table(["Middle"], ["m"]);
      const last = table(["Last"], ["l"]);
      const report = await store.apply(
        await store.plan({ document: "Shop", edits: [{ kind: "insert", model: middle, after: shop!.key }, { kind: "insert", model: last }, { kind: "remove", key: count!.key, expects: count!.revision }] }),
      );
      expect(report.written).toBe(true);
      const after = (await store.tables("Shop"))!;
      expect(after.map((t) => texts(t.model))).toEqual([texts(prices), texts(middle), texts(last)]);
      expect(after.map((t) => t.key)).toEqual([shop!.key, ...report.inserted]);
      expect(after.some((t) => t.key === count!.key)).toBe(false);
    });

    it("leaves a transaction whole where a table of it changed since it was read, or its document is not there", async () => {
      const fixture = make({ Shop: [prices, counts] });
      const { store } = fixture;
      const [shop, count] = (await store.tables("Shop"))!;
      fixture.replace("Shop", [prices, table(["Item", "Count"], ["Box", "5"])]);
      const plan = await store.plan({
        document: "Shop",
        edits: [
          { kind: "write", key: shop!.key, expects: shop!.revision, model: table(["Fruit", "Price"], ["Pear", "1"]) },
          { kind: "remove", key: count!.key, expects: count!.revision },
        ],
      });
      expect(plan.skipped?.cause).toBe("changed");
      expect((await store.apply(plan)).written).toBe(false);
      expect((await store.tables("Shop"))!.map((t) => texts(t.model))).toEqual([texts(prices), [["Item", "Count"], ["Box", "5"]]]);
      expect((await store.plan({ document: "Nowhere", edits: [{ kind: "insert", model: prices }] })).skipped?.cause).toBe("missing");
    });

    it("puts back what a transaction wrote, where the document is still as it left it", async () => {
      const { store } = make({ Shop: [prices, counts] });
      const [shop] = (await store.tables("Shop"))!;
      const report = await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "write", key: shop!.key, expects: shop!.revision, model: table(["Fruit", "Price"], ["Kiwi", "2"]) }] }));
      expect(report.written).toBe(true);
      expect((await store.apply(await store.planUndo(report))).written).toBe(true);
      expect((await store.tables("Shop"))!.map((t) => texts(t.model))).toEqual([texts(prices), texts(counts)]);
    });
  });
}
