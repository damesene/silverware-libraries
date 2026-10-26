import { afterEach, describe, expect, it } from "vitest";
import { actionsOf, customActionsAnew, defineCustomActions, resetCustomActions, withCustomActions } from "./actions.ts";
import type { Action } from "./core/action.ts";
import { contextOf } from "./core/context.ts";

afterEach(() => resetCustomActions());

const builtIn = (id: string): Action => ({ id, label: id, icon: "", group: "Format" });

describe("Custom actions", () => {
  it("are actions.<name>, after the modules' ones; one of a built-in action's name in its place", () => {
    const { actions, problems } = actionsOf([
      { name: "upper", label: "Upper case", run: () => undefined },
      { name: "clear", label: "My clear", run: () => undefined },
    ]);
    expect(problems).toEqual([]);
    defineCustomActions(actions);
    expect(withCustomActions([builtIn("actions.clear"), builtIn("formats.bold")]).map((a) => [a.id, a.label])).toEqual([
      ["actions.clear", "My clear"],
      ["formats.bold", "formats.bold"],
      ["actions.upper", "Upper case"],
    ]);
  });

  it("give the text replacing a part of the page; a function given the helpers marks the cursor", () => {
    const { actions } = actionsOf((helpers: { cursor(): string }) => ({
      name: "wrap",
      label: "Wrap",
      run: (context: { from: number; to: number }) => ({ from: context.from, to: context.to, text: `<${helpers.cursor()}>` }),
    }));
    const change = actions[0]!.run!(contextOf("a b", 1, 2));
    expect(change).toMatchObject({ from: 1, to: 2 });
    expect(change?.insert).toMatch(/^<.+>$/u);
  });

  it("are refused with what is wrong; a run giving the wrong thing or failing fails the action", () => {
    const { actions, problems } = actionsOf([{ name: "x" }, { name: "y", label: "Y" }, { name: "bad", label: "Bad", run: () => ({ from: 0, to: 99, text: "" }) }]);
    expect(problems).toEqual(["action x: it has no label", "action y: it has neither run nor choices"]);
    expect(() => actions[0]!.run!(contextOf("abc", 0, 1))).toThrow("bad's run did not give { from, to, text } within the page");
    const failing = actionsOf({ name: "boom", label: "Boom", run: () => { throw new Error("no"); } }).actions[0]!;
    expect(() => failing.run!(contextOf("abc", 0, 1))).toThrow("boom's run failed: no");
  });

  it("offer choices: a list as Turn into is, each choice an action of its own", () => {
    const { actions, problems } = actionsOf({
      name: "size",
      label: "Size",
      mixed: "Mixed sizes",
      choices: [
        { name: "small", label: "Small", run: () => undefined },
        { name: "large", label: "Large", active: () => true, run: () => undefined },
      ],
    });
    expect(problems).toEqual([]);
    expect(actions[0]).toMatchObject({ id: "actions.size", mixed: "Mixed sizes" });
    expect(actions[0]!.choices!.map((c) => c.id)).toEqual(["actions.small", "actions.large"]);
    expect(actions[0]!.choices![1]!.active!(contextOf("x", 0, 1))).toBe(true);
    expect(actionsOf({ name: "bad", label: "Bad", choices: [{ name: "c" }] }).problems).toEqual(["action bad: its choice 1: it has no label"]);
  });

  it("are replaced by the definitions made after Space Lua loads again; a name defined twice is said", () => {
    const one = actionsOf({ name: "a", label: "A", run: () => undefined }).actions;
    expect(defineCustomActions(one)).toEqual([]);
    expect(defineCustomActions(one)).toEqual(["a"]);
    customActionsAnew();
    defineCustomActions(actionsOf({ name: "b", label: "B", run: () => undefined }).actions);
    expect(withCustomActions([]).map((a) => a.id)).toEqual(["actions.b"]);
  });
});
