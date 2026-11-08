import { describe, expect, it } from "vitest";
import { readReference, readReferences, typedReferences, writeReference } from "./reference.ts";
import { TypeRegistry } from "./registry.ts";

describe("references as kept", () => {
  it("read a wiki link, its text after a bar, as written; a list of them, or one alone written by hand", () => {
    expect(readReference("[[Projects/Alpha]]")).toEqual({ target: "Projects/Alpha", written: "[[Projects/Alpha]]" });
    expect(readReference(" [[People/Ada | Ada]] ")).toEqual({ target: "People/Ada", text: "Ada", written: "[[People/Ada | Ada]]" });
    expect(readReference("[[Notes#Weekly]]")?.target).toBe("Notes#Weekly");
    for (const none of ["Projects/Alpha", "[[]]", "[[a]] and [[b]]", "[[a]b]]"]) expect(readReference(none), none).toBeUndefined();
    expect(readReferences(["[[A]]", "[[B|Bee]]"])?.map((one) => [one.target, one.text])).toEqual([
      ["A", undefined],
      ["B", "Bee"],
    ]);
    expect(readReferences("[[A|Ay]]")).toEqual([{ target: "A", text: "Ay", written: "[[A|Ay]]" }]);
    expect(readReferences(["[[A]]", "B"])).toBeUndefined();
    expect(readReferences(3)).toBeUndefined();
  });

  it("read text typed in its order, links as written and names between commas, each document once; nothing typed dropped", () => {
    expect(writeReference(" Projects/Alpha ")).toBe("[[Projects/Alpha]]");
    expect(typedReferences("[[A|Ay]], Beta notes, [[A]], Gamma")).toEqual({ written: ["[[A|Ay]]", "[[Beta notes]]", "[[Gamma]]"] });
    expect(typedReferences("Alpha, People/Ada, ,Alpha")).toEqual({ written: ["[[Alpha]]", "[[People/Ada]]"] });
    expect(typedReferences(" ")).toEqual({ written: [] });
    expect(typedReferences("[[A]], b]")).toEqual({ problem: `"b]" cannot be named by a link ([[Name]]): no bracket nor bar in it` });
  });
});

describe("the reference type", () => {
  const reference = new TypeRegistry().named("reference")!;
  it("takes a list of links to pages, each once, shown by their names or texts; typed text made links, nothing of it dropped", () => {
    expect([reference.editor, reference.look]).toEqual(["documents", "documents"]);
    expect(reference.validate(["[[A]]", "[[B]]"], {})).toBeUndefined();
    expect(reference.validate("[[A]]", {})).toBeUndefined();
    expect(reference.validate(["A"], {})).toBe("no list of links ([[Name]])");
    expect(reference.validate(["[[A]]", "[[A|again]]"], {})).toBe("one named twice");
    expect(reference.text(["[[Projects/Alpha]]", "[[People/Ada|Ada]]"], {})).toBe("Projects/Alpha, Ada");
    expect(reference.text("plain", {})).toBe("plain");
    expect(reference.parse("Alpha, [[Beta|Bee]]", {})).toEqual({ value: ["[[Alpha]]", "[[Beta|Bee]]"] });
    expect(reference.parse("a]b", {})).toHaveProperty("problem");
    expect(reference.parse(" ", {})).toEqual({ value: null });
    // (Grouped by the document a link names, whatever its text)
    expect(reference.groupValue!("[[B|bee]]", {})).toBe("[[B]]");
  });
});
