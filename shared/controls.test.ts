// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { segmentedControl } from "./controls.ts";

describe("A segmented control", () => {
  const units = [
    { value: "px", label: "px", title: "Pixels" },
    { value: "%", label: "%", title: "Percent of the pane" },
  ] as const;

  const make = () => {
    const told: string[] = [];
    const control = segmentedControl(document, "swl", "Unit", units, "px", (value) => told.push(value));
    document.body.replaceChildren(control.element);
    const buttons = [...control.element.querySelectorAll("button")];
    return { control, told, buttons };
  };

  it("is a radio group of joined buttons, the value given pressed", () => {
    const { control, buttons } = make();
    expect(control.element.className).toBe("swl-segments");
    expect(control.element.getAttribute("role")).toBe("radiogroup");
    expect(control.element.getAttribute("aria-label")).toBe("Unit");
    expect(buttons.map((b) => [b.className, b.getAttribute("role"), b.textContent, b.getAttribute("aria-checked"), b.tabIndex])).toEqual([
      ["swl-segment", "radio", "px", "true", 0],
      ["swl-segment", "radio", "%", "false", -1],
    ]);
    expect(buttons[1]!.title).toBe("Percent of the pane");
  });

  it("a click presses another and tells it, once", () => {
    const { told, buttons } = make();
    buttons[1]!.click();
    buttons[1]!.click();
    expect(told).toEqual(["%"]);
    expect(buttons.map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "true"]);
  });

  it("the arrow keys move the choice round, the focus with it", () => {
    const { told, buttons } = make();
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(told).toEqual(["%"]);
    expect(document.activeElement).toBe(buttons[1]);
    buttons[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(told).toEqual(["%", "px"]);
  });

  it("set presses another without telling", () => {
    const { control, told, buttons } = make();
    control.set("%");
    expect(told).toEqual([]);
    expect(buttons.map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "true"]);
  });
});
