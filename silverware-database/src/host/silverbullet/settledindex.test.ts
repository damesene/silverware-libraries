import { describe, expect, it } from "vitest";
import type { IndexChange, IndexedObject } from "../../../../shared/platform.ts";
import { settledIndex } from "./settledindex.ts";

const told = () => {
  const list: string[] = [];
  return { list, tell: (change: IndexChange) => void list.push(`${change.document}${change.deleted ? " deleted" : ""}${change.early ? " early" : ""}`) };
};

describe("SilverBullet's index, read only whole", () => {
  it("answers with the last reading made while no page was being indexed, the changes told meanwhile told again once it is whole", async () => {
    let objects: IndexedObject[] = [
      { name: "db-tasks/A", tags: ["db"], status: "Todo" },
      { name: "db-tasks/B", tags: ["db"], status: "Done" },
    ];
    let idle = true;
    const { list, tell } = told();
    const index = settledIndex(async () => objects, async () => idle, tell);
    const names = async () => (await index.objects("db")).map((one) => `${String(one.name)} ${String(one.status)}`);
    expect(await names()).toEqual(["db-tasks/A Todo", "db-tasks/B Done"]);
    // A indexed anew: the queue busy, its objects cleared: the last whole reading answers
    idle = false;
    objects = [objects[1]!];
    index.changed({ document: "db-tasks/A", deleted: false });
    expect(list).toEqual(["db-tasks/A early"]);
    expect(await names()).toEqual(["db-tasks/A Todo", "db-tasks/B Done"]);
    // Emptied, but busy again before it is read: nothing told yet
    await index.settled();
    expect(list).toEqual(["db-tasks/A early"]);
    // Indexed, the queue empty: read anew, then told whole; a read while busy again answers the new reading
    objects = [{ name: "db-tasks/A", tags: ["db"], status: "Done" }, ...objects];
    idle = true;
    await index.settled();
    expect(list).toEqual(["db-tasks/A early", "db-tasks/A"]);
    idle = false;
    expect(await names()).toEqual(["db-tasks/A Done", "db-tasks/B Done"]);
    // Emptied again with nothing told meanwhile: nothing told again
    idle = true;
    await index.settled();
    expect(list).toHaveLength(2);
  });

  it("tells a page deleted whole at once and leaves it out of every answer, the index not cleared yet, until it is indexed again", async () => {
    let objects: IndexedObject[] = [
      { name: "db-tasks/A", tags: ["db"] },
      { name: "outline", tags: ["task"], page: "db-tasks/A", done: true },
    ];
    let idle = true;
    const { list, tell } = told();
    const index = settledIndex(async () => objects, async () => idle, tell);
    await index.objects("db");
    // Deleted, the queue idle and nothing queued (SilverBullet clears the page after it tells): told whole now, left out
    index.changed({ document: "db-tasks/A", deleted: true });
    expect(list).toEqual(["db-tasks/A deleted early", "db-tasks/A deleted"]);
    expect(await index.objects("db")).toEqual([]);
    expect(await index.objects("task")).toEqual([]);
    // Made again
    idle = false;
    index.changed({ document: "db-tasks/A", deleted: false });
    objects = [{ name: "db-tasks/A", tags: ["db"], again: true }];
    idle = true;
    await index.settled();
    expect(await index.objects("db")).toEqual([{ name: "db-tasks/A", tags: ["db"], again: true }]);
  });

  it("tells a change early and whole at once where SilverBullet says nothing of its queue, the index read as it is", async () => {
    let objects: IndexedObject[] = [{ name: "A", tags: ["db"] }];
    const { list, tell } = told();
    const index = settledIndex(async () => objects, undefined, tell);
    await index.objects("db");
    objects = [{ name: "A", tags: ["db"], changed: true }];
    index.changed({ document: "A", deleted: false });
    expect(list).toEqual(["A early", "A"]);
    expect(await index.objects("db")).toEqual(objects);
  });

  it("reads the index as it is the first time a tag is asked for, whole or not (nothing read before to answer with)", async () => {
    const index = settledIndex(async (tag) => [{ name: `page of ${tag}`, tags: [tag] }], async () => false, () => {});
    expect((await index.objects("db")).map((one) => one.name)).toEqual(["page of db"]);
  });
});
