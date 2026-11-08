import { describe, expect, it } from "vitest";
import { guardedType, TYPE_HELPERS, validateType } from "./custom.ts";
import type { PropertyType } from "./type.ts";

const fine: PropertyType = { name: "stars", label: "Stars", validate: () => undefined, text: (value) => `★${String(value)}`, parse: (text) => ({ value: Number(text) }) };

describe("custom types", () => {
  it("are checked as they are defined: a name, a label, the methods every type has", () => {
    expect(validateType(fine)).toBeUndefined();
    expect(validateType({ ...fine, name: "Stars" })).toContain("no type's name");
    expect(validateType({ ...fine, label: " " })).toContain("has no label");
    expect(validateType({ ...fine, parse: undefined } as unknown as PropertyType)).toContain("has no parse");
    expect(validateType({ ...fine, sortKey: "x" } as unknown as PropertyType)).toContain("sortKey is no function");
    // (A built-in type's name: a property names its type by it, so it would stand for two)
    expect(validateType({ ...fine, name: "select" })).toContain("a built-in type's name");
  });

  it("keep the editor and the look they say, one of those known, so the views edit and draw them so", () => {
    const chosen: PropertyType = { ...fine, editor: "select", look: "options" };
    expect(validateType(chosen)).toBeUndefined();
    expect(validateType({ ...fine, editor: "wheel" } as unknown as PropertyType)).toContain("its editor is one of");
    expect(validateType({ ...fine, look: "sparkles" } as unknown as PropertyType)).toContain("its look is one of");
    const guarded = guardedType(chosen, () => {});
    expect([guarded.editor, guarded.look]).toEqual(["select", "options"]);
    // (A checkbox's kinds too: a type of the user's turned by a press and drawn as a box)
    expect(validateType({ ...fine, editor: "toggle", look: "check" })).toBeUndefined();
    // (Its groups' value: a function, what it gives a value, else a group per value, told)
    expect(validateType({ ...fine, groupValue: "day" } as unknown as PropertyType)).toContain("groupValue is no function");
    const told: string[] = [];
    const grouping = guardedType({ ...fine, groupValue: () => ({ odd: true }) as unknown as string }, (message) => void told.push(message));
    expect(grouping.groupValue!("x", {})).toBe("x");
    expect(told).toHaveLength(1);
    // (Values that are lists kept said so: grouped, an item in the group of each)
    expect(guardedType({ ...fine, lists: true }, () => {}).lists).toBe(true);
    // (Never a value's group the group of none)
    expect(guardedType({ ...fine, groupValue: () => "" }, () => {}).groupValue!("x", {})).toBe("x");
    // (Never one without the other: a box edited as text, or a value turned by a press shown as text with nothing to turn it)
    expect(validateType({ ...fine, editor: "toggle" })).toContain("go together");
    expect(validateType({ ...fine, editor: "select", look: "check" })).toContain("go together");
  });

  it("tell a failure once per method, whatever its message, saying what was done", () => {
    const told: string[] = [];
    const type = guardedType(
      {
        ...fine,
        validate: (value) => {
          throw new Error(`bad ${String(value)}`);
        },
      },
      (problem) => void told.push(problem),
    );
    for (const value of [1, 2, 3]) expect(type.validate(value, {})).toBe(`the type "stars" failed in validate: bad ${value}`);
    expect(told).toEqual(['the type "stars" failed in validate: bad 1 (its values shown as kept, invalid)']);
  });

  it("take an answer read one way only: a value or a problem that says why, never both", () => {
    const answers = [{ value: "v", problem: "p" }, { problem: "" }, { value: [] as string[] }, { value: new Array(2) }];
    const read = answers.map((answer) => guardedType({ ...fine, parse: () => answer as never, validate: () => "" }, () => {}));
    expect(read.map((type) => "problem" in type.parse("x", {}))).toEqual([true, true, false, true]);
    expect(read[0]!.validate("x", {})).toContain("failed in validate");
  });

  it("break nothing where a method throws or answers wrong: a value shown as kept and invalid, a text typed not read, told once a failure", () => {
    const told: string[] = [];
    const broken = guardedType(
      {
        name: "broken",
        label: "Broken",
        validate: () => {
          throw new Error("no check");
        },
        text: () => 42 as unknown as string,
        sortKey: () => {
          throw new Error("no key");
        },
        parse: () => ({ value: { not: "a value" } }) as never,
      },
      (problem) => void told.push(problem),
    );
    expect(broken.validate("x", {})).toBe('the type "broken" failed in validate: no check');
    expect(broken.text(["a", "b"], {})).toBe("a, b");
    expect(broken.sortKey!("x", {})).toBe("x");
    expect(broken.parse("7", {})).toEqual({ problem: 'the type "broken" failed in parse: it gave an object of the wrong shape' });
    expect(told).toEqual([
      'the type "broken" failed in validate: no check (its values shown as kept, invalid)',
      'the type "broken" failed in text: it gave a number (its values shown as kept)',
      'the type "broken" failed in sortKey: no key (its values sorted by their text)',
      'the type "broken" failed in parse: it gave an object of the wrong shape (the text typed not written)',
    ]);
  });

  it("answer as the type does where it works, and have no method the type has not", () => {
    const guarded = guardedType(fine, () => {});
    expect([guarded.text(3, {}), guarded.parse("4", {}), guarded.sortKey, guarded.validateParams]).toEqual(["★3", { value: 4 }, undefined, undefined]);
    expect(guardedType({ ...fine, parse: () => ({ value: Number.NaN }) }, () => {}).parse("x", {})).toHaveProperty("problem");
  });

  it("give a function of definitions what the built-in types use", () => {
    expect(TYPE_HELPERS.keptText(["a", "b"])).toBe("a, b");
    expect([TYPE_HELPERS.isEmpty(""), TYPE_HELPERS.isValue(["a", 1])]).toEqual([true, false]);
  });
});
