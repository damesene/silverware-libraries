import { describe, expect, it } from "vitest";
import { pageWriter } from "../../../../shared/pages/writer.ts";
import { DatabaseCore, type Proposal } from "../../core/core.ts";
import { TypeRegistry } from "../../domain/types/registry.ts";
import { PagesStore } from "../../store/pages/store.ts";
import { memoryPages } from "../../store/pages/testing.ts";
import { blockPlaces } from "./places.ts";

const ROOT = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    due: { type: date, label: Due }\n---\n";
const ITEM = "---\ntags: [db]\nstatus: Todo\ndue: \"2026-11-10\"\n_database:\n  rank: a0\n---\n";
// A page of two blocks of the database (one showing the same as the other), one of another database's, and text
const NOTES = [
  "# Notes",
  "",
  "```silverware-database",
  "id: tasks",
  "view: board",
  "board.groupBy: status",
  'board.filter: {"status":"!=Done","due":"<2027-01-01"}',
  "```",
  "",
  "```silverware-database",
  "id: other",
  "board.groupBy: status",
  "```",
  "",
  "```silverware-database",
  "id: tasks",
  "view: timeline",
  "timeline.dateBy: due",
  "list.colorBy: status",
  "```",
  "",
].join("\n");
const PLAIN = "# Plain\n\n```silverware-database\nid: tasks\nview: list\n```\n";

function setup() {
  const memory = memoryPages({ "db-tasks": ROOT, "db-tasks/Fix login": ITEM, Notes: NOTES, Plain: PLAIN });
  const store = new PagesStore(memory.platform);
  const told: string[] = [];
  const meta = (view: string) => (view === "timeline" || view === "calendar" ? ["dateBy", "endBy"] : []);
  const core = new DatabaseCore(store, new TypeRegistry(), { notify: (message) => void told.push(message), ask: () => true }, memory.platform.space.noun, { store: blockPlaces(memory.platform.space, pageWriter(memory.platform)), propertyMeta: meta });
  return { memory, core, told };
}

const proposalOf = (made: Proposal | { problem: string }): Proposal => {
  if ("problem" in made) throw new Error(made.problem);
  return made;
};

describe("the places of a database in its space's pages, as a key changes", () => {
  it("finds every block of the database naming the key, every page read (told), and says on which pages; nothing written yet", async () => {
    const { memory, core } = setup();
    const told: [number, number][] = [];
    const proposal = proposalOf(await core.rekeyProperty("tasks", "status", "stav", (done, of) => void told.push([done, of])));
    expect(proposal.places?.documents).toEqual(["Notes"]);
    expect(told.at(-1)).toEqual([memory.pages.size, memory.pages.size]);
    expect(memory.pages.get("Notes")).toBe(NOTES);
  });

  it("writes the key anew in each block with the items, the other database's and every other line left as written; Undo puts all back", async () => {
    const { memory, core } = setup();
    await core.apply(proposalOf(await core.rekeyProperty("tasks", "status", "stav")));
    const notes = memory.pages.get("Notes")!;
    expect(notes).toContain('board.groupBy: stav\nboard.filter: {"stav":"!=Done","due":"<2027-01-01"}');
    expect(notes).toContain("timeline.dateBy: due\nlist.colorBy: stav");
    // (Another database's block: its own `status`, left)
    expect(notes).toContain("id: other\nboard.groupBy: status");
    expect(memory.pages.get("Plain")).toBe(PLAIN);
    expect(memory.pages.get("db-tasks/Fix login")).toContain("stav: Todo");
    await core.undo("tasks");
    expect(memory.pages.get("Notes")).toBe(NOTES);
    expect(memory.pages.get("db-tasks/Fix login")).toContain("status: Todo");
  });

  it("leaves a block changed since it was found, written by hand, and says so; the rest written", async () => {
    const { memory, core, told } = setup();
    const proposal = proposalOf(await core.rekeyProperty("tasks", "status", "stav"));
    memory.writeOutside("Notes", NOTES.replace("view: board", "view: list"));
    await core.apply(proposal);
    expect(memory.pages.get("Notes")).toContain("board.groupBy: status");
    expect(memory.pages.get("db-tasks/Fix login")).toContain("stav: Todo");
    expect(told.at(-1)).toMatch(/a view was left as it was: Notes/);
  });

  it("writes two blocks showing the same on one page, both", async () => {
    const block = "```silverware-database\nid: tasks\nboard.groupBy: status\n```\n";
    const twice = `# Twice\n\n${block}\n${block}`;
    const { memory, core } = setup();
    memory.writeOutside("Twice", twice);
    await core.apply(proposalOf(await core.rekeyProperty("tasks", "status", "stav")));
    expect(memory.pages.get("Twice")).toBe(twice.replaceAll("board.groupBy: status", "board.groupBy: stav"));
  });

  it("puts back by Undo only what it wrote: a block changed since by hand left, said", async () => {
    const { memory, core, told } = setup();
    await core.apply(proposalOf(await core.rekeyProperty("tasks", "status", "stav")));
    memory.writeOutside("Notes", memory.pages.get("Notes")!.replace("view: board", "view: list"));
    await core.undo("tasks");
    expect(memory.pages.get("Notes")).toContain("board.groupBy: stav");
    expect(memory.pages.get("db-tasks/Fix login")).toContain("status: Todo");
    expect(told.some((one) => /^Undo: .*a view was left as it was: Notes \(/.test(one))).toBe(true);
  });

  it("says where the views could not be written at all, the items written standing", async () => {
    const { memory, core, told } = setup();
    const proposal = proposalOf(await core.rekeyProperty("tasks", "status", "stav"));
    const write = memory.platform.space.write;
    // (The space failing as the views' page is written, after the items)
    (memory.platform.space as { write: typeof write }).write = (name, text) => {
      if (name === "Notes") throw new Error("disk full");
      return write(name, text);
    };
    await core.apply(proposal);
    expect(memory.pages.get("db-tasks/Fix login")).toContain("stav: Todo");
    expect(memory.pages.get("Notes")).toBe(NOTES);
    expect(told.at(-1)).toMatch(/Notes/);
  });

  it("follows a view's own meta naming the key (a timeline's Start)", async () => {
    const { memory, core } = setup();
    await core.apply(proposalOf(await core.rekeyProperty("tasks", "due", "when")));
    expect(memory.pages.get("Notes")).toContain('timeline.dateBy: when');
    expect(memory.pages.get("Notes")).toContain('"when":"<2027-01-01"');
  });

  it("deletes a database: its items' pages, its root page and its blocks on every page, another database's left; Undo puts back every page as it was", async () => {
    const { memory, core } = setup();
    const before = new Map(memory.pages);
    const proposal = proposalOf(await core.planDeleteDatabase("tasks"));
    expect([...(proposal.places?.documents ?? [])].sort()).toEqual(["Notes", "Plain"]);
    expect(proposal.plan.planned.filter((one) => "item" in one.target)).toHaveLength(1);
    await core.apply(proposal);
    expect(memory.pages.has("db-tasks")).toBe(false);
    expect(memory.pages.has("db-tasks/Fix login")).toBe(false);
    expect(memory.pages.get("Plain")).toBe("# Plain\n\n");
    // (Another database's block and the page's text left)
    expect(memory.pages.get("Notes")).toBe("# Notes\n\n```silverware-database\nid: other\nboard.groupBy: status\n```\n\n");
    await core.undo();
    expect(new Map(memory.pages)).toEqual(before);
  });

  it("leaves out of a deletion's places the pages it deletes, and a block in a list item, said as one to take out by hand", async () => {
    const { memory, core } = setup();
    const listed = "# Listed\n\n- one\n  ```silverware-database\n  id: tasks\n  ```\n";
    memory.writeOutside("Listed", listed);
    memory.writeOutside("db-tasks/Fix login", `${ITEM}\n\`\`\`silverware-database\nid: tasks\n\`\`\`\n`);
    const proposal = proposalOf(await core.planDeleteDatabase("tasks"));
    expect([...(proposal.places?.documents ?? [])].sort()).toEqual(["Notes", "Plain"]);
    expect(proposal.places?.byHand).toEqual(["Listed"]);
    await core.apply(proposal);
    expect(memory.pages.has("db-tasks/Fix login")).toBe(false);
    expect(memory.pages.get("Listed")).toBe(listed);
  });

  it("keeps a deletion to undo again where its undo was kept from making a page again, its name taken since: nothing of it lost", async () => {
    const { memory, core } = setup();
    const before = new Map(memory.pages);
    await core.apply(proposalOf(await core.planDeleteDatabase("tasks")));
    memory.writeOutside("db-tasks", "# Someone else's\n");
    await core.undo();
    expect(memory.pages.has("db-tasks/Fix login")).toBe(false);
    // The name freed, Undo tries again: every page back as it was
    memory.removeOutside("db-tasks");
    await core.undo();
    expect(new Map(memory.pages)).toEqual(before);
  });

  it("deletes none of a database whose item changed between the proposal and its apply", async () => {
    const { memory, core, told } = setup();
    const proposal = proposalOf(await core.planDeleteDatabase("tasks"));
    memory.writeOutside("db-tasks/Fix login", ITEM.replace("status: Todo", "status: Done"));
    await core.apply(proposal);
    expect(memory.pages.has("db-tasks")).toBe(true);
    expect(memory.pages.get("db-tasks/Fix login")).toContain("status: Done");
    expect(memory.pages.get("Notes")).toBe(NOTES);
    expect(told.at(-1)).toMatch(/nothing was written/);
  });
});
