import { describe, expect, it } from "vitest";
import { type FrontmatterValue, readFrontmatter, readKey, validateFrontmatterKey, type WriteOptions, writeKey } from "./frontmatter.ts";

const read = (text: string, key: string) => readKey(text, readFrontmatter(text), key);
const valueOf = (text: string, key: string) => {
  const { entry } = read(text, key);
  return entry?.kind === "list" ? entry.items.map((item) => item.value) : entry?.value;
};

/** The text with `key` made `value` */
function written(text: string, key: string, value: FrontmatterValue | undefined, options?: WriteOptions): string {
  const edit = writeKey(text, readFrontmatter(text), key, read(text, key).entry, value, options);
  return edit ? text.slice(0, edit.from) + edit.insert + text.slice(edit.to) : text;
}

describe("reading a key", () => {
  it("reads scalars with the value YAML gives them, dates as text", () => {
    const text = '---\nstatus: Doing # now\ndue: 2026-11-10\nestimate: 3.5\ncount: 0x1F\ndone: true\nnote: "a: b"\nempty:\nnone: ~\n---\nbody';
    expect(valueOf(text, "status")).toBe("Doing");
    expect(valueOf(text, "due")).toBe("2026-11-10");
    expect(valueOf(text, "estimate")).toBe(3.5);
    expect(valueOf(text, "count")).toBe(31);
    expect(valueOf(text, "done")).toBe(true);
    expect(valueOf(text, "note")).toBe("a: b");
    expect(valueOf(text, "empty")).toBeNull();
    expect(valueOf(text, "none")).toBeNull();
    expect(read(text, "missing")).toEqual({});
    expect(read("no frontmatter", "status")).toEqual({});
  });

  it("reads lists in brackets and block lists", () => {
    expect(valueOf("---\nlabels: [a, 'b c', 2]\n---\n", "labels")).toEqual(["a", "b c", 2]);
    expect(valueOf("---\nlabels:\n  - a\n  # a comment\n  - \"b\"\nnext: x\n---\n", "labels")).toEqual(["a", "b"]);
    expect(valueOf("---\nlabels: []\n---\n", "labels")).toEqual([]);
  });

  it("leaves alone what it does not read", () => {
    expect(read("---\n_database:\n  id: tasks\n---\n", "_database").unreadable).toBeDefined();
    expect(read("---\nnote: one\n  two\n---\n", "note").unreadable).toBeDefined();
    expect(read("---\nlabels: [a,\n  b]\n---\n", "labels").unreadable).toBeDefined();
    expect(read("---\nnote: |\n  text\n---\n", "note").unreadable).toBeDefined();
    expect(read("---\nmap: { a: 1 }\n---\n", "map").unreadable).toBeDefined();
  });
});

describe("writing a key", () => {
  it("keeps the page's form and the rest as written", () => {
    const text = "---\ntitle: X # mine\nstatus: Todo\nlabels:\n  - a\n---\nbody";
    expect(written(text, "status", "Done")).toBe("---\ntitle: X # mine\nstatus: Done\nlabels:\n  - a\n---\nbody");
    expect(written(text, "labels", ["a", "b c"])).toBe('---\ntitle: X # mine\nstatus: Todo\nlabels:\n  - a\n  - "b c"\n---\nbody');
    expect(written("---\nlabels: ['a']\n---\n", "labels", ["a", "b"])).toBe("---\nlabels: ['a', b]\n---\n");
    expect(written("---\nestimate: 3\n---\n", "estimate", 4)).toBe("---\nestimate: 4\n---\n");
  });

  it("quotes what YAML would read otherwise", () => {
    expect(written("---\nstatus: a\n---\n", "status", "yes")).toBe('---\nstatus: "yes"\n---\n');
    expect(written("---\nstatus: a\n---\n", "status", "2026-11-10")).toBe('---\nstatus: "2026-11-10"\n---\n');
    expect(written("---\nstatus: a\n---\n", "status", "two words")).toBe("---\nstatus: two words\n---\n");
    expect(written("---\nstatus: a\n---\n", "status", " padded")).toBe('---\nstatus: " padded"\n---\n');
    for (const value of ["yes", "a: b", "[x] y", "@x", "#a", " padded", "line\nbreak", "007"]) {
      expect(valueOf(written("---\nstatus: a\n---\n", "status", value), "status"), value).toBe(value);
    }
  });

  it("makes a key anew in the form asked for, and a frontmatter where there is none", () => {
    expect(written("---\ntitle: X\n---\nbody", "due", "2026-11-10")).toBe('---\ntitle: X\ndue: "2026-11-10"\n---\nbody');
    expect(written("body", "labels", ["a"], { form: "block" })).toBe("---\nlabels:\n  - a\n---\nbody");
    expect(written("body", "labels", ["a", "b"])).toBe("---\nlabels: [a, b]\n---\nbody");
    expect(written("---\nlabels:\n---\n", "labels", ["a"], { form: "block" })).toBe("---\nlabels:\n  - a\n---\n");
  });

  it("takes a key off, and a frontmatter left empty with it", () => {
    expect(written("---\ntitle: X\ndue: 1\n---\nbody", "due", undefined)).toBe("---\ntitle: X\n---\nbody");
    expect(written("---\ndue: 1\n---\nbody", "due", undefined)).toBe("body");
  });

  it("writes nothing where nothing changes", () => {
    const text = "---\nstatus: Todo\nlabels: [a, b]\n---\n";
    expect(writeKey(text, readFrontmatter(text), "status", read(text, "status").entry, "Todo")).toBeUndefined();
    expect(writeKey(text, readFrontmatter(text), "labels", read(text, "labels").entry, ["a", "b"])).toBeUndefined();
  });
});

describe("keys", () => {
  it("are plain keys at the frontmatter's top level", () => {
    for (const key of ["tags", "due_date", "_database", "status"]) expect(validateFrontmatterKey(key), key).toBeUndefined();
    for (const key of ["", "a b", "a:b", "-x", "#x", "[x]"]) expect(validateFrontmatterKey(key), key).toBeDefined();
  });
});
