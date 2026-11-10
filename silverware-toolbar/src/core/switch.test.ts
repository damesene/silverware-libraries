import { describe, expect, it } from "vitest";
import { NO_ARGS, withArgs } from "./action.ts";
import { contextOf } from "./context.ts";
import { switchToolbarAction } from "./switch.ts";
import { defaultToolbars } from "./toolbars.ts";

describe("The switch of toolbars", () => {
  const toolbars = defaultToolbars();
  const context = contextOf("", 0, 0);

  it("without a toolbar given offers each to pick from, the one shown on, its parameter's choices the same toolbars", () => {
    const switched: string[] = [];
    const action = switchToolbarAction(toolbars, toolbars[1], (name) => switched.push(name));
    expect(action.choices!.map((choice) => [choice.label, choice.active!(context, NO_ARGS)])).toEqual([
      ["Float", false],
      ["Docked", true],
    ]);
    expect(action.params![0]!.choices!()).toEqual([
      { value: "Float", label: "Float" },
      { value: "Docked", label: "Docked" },
    ]);
    void action.choices![0]!.perform!(context, {} as never, NO_ARGS);
    expect(switched).toEqual(["Float"]);
  });

  it("with a toolbar given switches to it at once, named by it, on while it is the one shown", () => {
    const switched: string[] = [];
    const bound = withArgs(switchToolbarAction(toolbars, toolbars[0], (name) => switched.push(name)), { toolbar: "Docked" });
    expect([bound.label, bound.choices, bound.active!(context, NO_ARGS)]).toEqual(["Docked", undefined, false]);
    void bound.perform!(context, {} as never, NO_ARGS);
    expect(switched).toEqual(["Docked"]);
    expect(withArgs(switchToolbarAction(toolbars, toolbars[1], () => undefined), { toolbar: "Docked" }).active!(context, NO_ARGS)).toBe(true);
  });
});
