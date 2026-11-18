import { describe, expect, it } from "vitest";
import { TypeRegistry } from "../domain/types/registry.ts";
import type { Database, Item, ItemKey } from "../model/database.ts";
import { MemoryStore } from "../store/memory.ts";
import { type CoreInterface, DatabaseCore } from "./core.ts";
import { leftBehind, namedFew } from "./leftbehind.ts";

const TRIPS: Database = {
  id: "trips",
  name: "Trips",
  properties: [
    { key: "photos", label: "Photos", type: "files", params: {}, readonly: false },
    { key: "docs", label: "Docs", type: "files", params: {}, readonly: false },
    { key: "note", label: "Note", type: "text", params: {}, readonly: false },
  ],
};
const FOLDER = "Trips/db-trips/files";
const item = (key: string, values: Item["values"]): Item => ({ key: key as ItemKey, name: key, values, rank: undefined, revision: "1" });

describe("what removed items leave behind", () => {
  const types = new TypeRegistry();
  const all = [
    item("a", { photos: [`[[${FOLDER}/alone.png]]`, `[[${FOLDER}/shared.png]]`, "[[Elsewhere/linked.png]]", "https://example.com/web.png"], docs: `[[${FOLDER}/doc.pdf]]` }),
    item("b", { photos: [`[[${FOLDER}/shared.png]]`], note: `[[${FOLDER}/alone.png]]` }),
    item("c", { docs: ["[[a.png]]", "not a link"] }),
  ];

  it("are the files they alone name in the database's folder of them, a value of every property of files read", () => {
    expect(leftBehind(TRIPS, types, [all[0]!], all, FOLDER)).toEqual([`${FOLDER}/alone.png`, `${FOLDER}/doc.pdf`]);
    // (Another removed with it: what both alone named)
    expect(leftBehind(TRIPS, types, [all[0]!, all[1]!], all, FOLDER)).toEqual([`${FOLDER}/alone.png`, `${FOLDER}/shared.png`, `${FOLDER}/doc.pdf`]);
    // (A value that reads as no files names none)
    expect(leftBehind(TRIPS, types, [all[2]!], all, FOLDER)).toEqual([]);
    expect(leftBehind(TRIPS, types, [all[0]!], all, undefined)).toEqual([]);
  });

  it("are named in a question by their names, the first few, then how many more", () => {
    expect(namedFew(["a/b/c.png", "d.pdf"])).toBe("c.png, d.pdf");
    expect(namedFew(Array.from({ length: 10 }, (_, at) => `f/${at}.png`))).toBe("0.png, 1.png, 2.png, 3.png, 4.png, 5.png, 6.png, 7.png and 2 more");
  });
});

describe("an item removed with the files it alone named", () => {
  /** The core over a store keeping a folder of files for the database, answering its questions in turn */
  function setup(answers: readonly boolean[], folder: string | null = FOLDER) {
    const store = new (class extends MemoryStore {
      override filesFolderOf(): string | undefined {
        return folder ?? undefined;
      }
    })([
      {
        database: TRIPS,
        items: [
          { name: "Holiday", values: { photos: [`[[${FOLDER}/alone.png]]`, `[[${FOLDER}/shared.png]]`] }, rank: "a0" },
          { name: "Work", values: { photos: [`[[${FOLDER}/shared.png]]`] }, rank: "a1" },
        ],
      },
    ]);
    const asked: string[] = [];
    const told: string[] = [];
    const left = [...answers];
    const ui: CoreInterface = { notify: (message) => void told.push(message), ask: async (message) => (asked.push(message), left.shift() ?? false) };
    const core = new DatabaseCore(store, new TypeRegistry(), ui);
    const deleted: string[][] = [];
    const documents = { remove: async (paths: readonly string[]) => (deleted.push([...paths]), paths.filter((one) => one.endsWith("locked.png"))) };
    const holiday = async () => (await store.items("trips")).value.find((one) => one.name === "Holiday")!;
    return { store, core, asked, told, deleted, documents, holiday };
  }

  it("asks, once removed, whether the files no other item names go too, saying Undo does not bring them back; deleted where yes", async () => {
    const { core, asked, deleted, documents, holiday, store } = setup([true, true]);
    const result = await core.remove("trips", [await holiday()], documents);
    expect("problem" in result).toBe(false);
    expect(asked).toEqual(['Remove "Holiday"? Undo brings it back.', "Delete its file too (alone.png)? No other item names it; Undo of the removal does not bring it back."]);
    expect(deleted).toEqual([[`${FOLDER}/alone.png`]]);
    expect((await store.items("trips")).value.map((one) => one.name)).toEqual(["Work"]);
  });

  it("keeps the files where the second question is declined, asks nothing more where the removal is, or where no host deletes files", async () => {
    const kept = setup([true, false]);
    await kept.core.remove("trips", [await kept.holiday()], kept.documents);
    expect([kept.asked.length, kept.deleted]).toEqual([2, []]);
    const declined = setup([false]);
    expect(await declined.core.remove("trips", [await declined.holiday()], declined.documents)).toEqual({ problem: "Not removed", cause: "declined" });
    expect([declined.asked.length, declined.deleted]).toEqual([1, []]);
    const none = setup([true]);
    await none.core.remove("trips", [await none.holiday()]);
    expect(none.asked).toHaveLength(1);
    // (No folder of files kept for the database: nothing left to offer)
    const noFolder = setup([true], null);
    await noFolder.core.remove("trips", [await noFolder.holiday()], noFolder.documents);
    expect(noFolder.asked).toHaveLength(1);
  });

  it("names the files several items alone named, and says those not deleted", async () => {
    const { core, store, asked, told, documents } = setup([true, true]);
    await store.apply(
      await store.plan({ database: "trips", changes: [{ kind: "createItem", ref: "x", name: "Locked", values: { photos: [`[[${FOLDER}/locked.png]]`] }, rank: "a2" }] } as never),
    );
    const items = (await store.items("trips")).value.filter((one) => one.name !== "Work");
    await core.remove("trips", items, documents);
    expect(asked[1]).toBe("Delete the 2 files only they named too (alone.png, locked.png)? No other item names them; Undo of the removal does not bring them back.");
    expect(told).toEqual(["Not deleted: locked.png"]);
  });
});
