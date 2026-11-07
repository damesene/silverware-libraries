// The database playground's sample: two databases kept in memory, as the
// memory store seeds them (their keys and revisions made by the store).
import type { MemorySeed } from "../silverware-database/src/store/memory.ts";

export const SAMPLE_DATABASES: readonly MemorySeed[] = [
  {
    database: {
      id: "tasks",
      name: "Tasks",
      properties: [
        { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Doing", "Done"] }, readonly: false },
        { key: "due", label: "Due", type: "date", params: {}, readonly: false },
        { key: "estimate", label: "Estimate", type: "number", params: {}, readonly: false },
        { key: "tags", label: "Tags", type: "multi-select", params: { options: ["backend", "docs", "ui"] }, readonly: false },
        { key: "done", label: "Done", type: "checkbox", params: {}, readonly: false },
        { key: "link", label: "Link", type: "url", params: {}, readonly: false },
      ],
    },
    items: [
      { name: "Fix login", values: { status: "Doing", due: "2026-11-12", estimate: 3, tags: ["backend"], done: false }, rank: "a0" },
      { name: "Write docs", values: { status: "Todo", due: "2026-11-20", estimate: 5, tags: ["docs"], done: false, link: "https://silverbullet.md" }, rank: "a1" },
      { name: "Plan sprint", values: { status: "Done", estimate: 1, done: true }, rank: "a2" },
      // A value kept as typed by hand: shown invalid, never emptied
      { name: "Review design", values: { status: "Later", estimate: "a lot", tags: ["ui"] }, rank: "a3" },
      // Made outside the core: no rank, after the ranked
      { name: "Triage inbox", values: { status: "Todo" }, rank: undefined },
    ],
  },
  {
    database: {
      id: "reading",
      name: "Reading",
      properties: [
        { key: "author", label: "Author", type: "text", params: {}, readonly: false },
        { key: "rating", label: "Rating", type: "number", params: {}, readonly: false },
        { key: "finished", label: "Finished", type: "date", params: {}, readonly: false },
      ],
    },
    items: [
      { name: "The Pragmatic Programmer", values: { author: "Hunt, Thomas", rating: 5, finished: "2026-03-02" }, rank: "a0" },
      { name: "A Philosophy of Software Design", values: { author: "Ousterhout", rating: 4 }, rank: "a1" },
    ],
  },
];
