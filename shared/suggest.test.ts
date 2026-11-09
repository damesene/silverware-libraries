// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { suggestionList } from "./suggest.ts";

const NAMES = ["ada", "bob", "adam"];
const key = (target: Element, name: string) => {
  const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};
const type = (input: HTMLInputElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event("input"));
};

function setup(whenEmpty?: boolean) {
  const input = document.createElement("input");
  const taken: string[] = [];
  document.body.append(input);
  const list = suggestionList(document, input, { base: "x", suggest: (typed) => NAMES.filter((one) => one.includes(typed.trim())), take: (name) => void taken.push(name), label: (name) => `@${name}`, ...(whenEmpty ? { whenEmpty } : {}) });
  input.after(list);
  const shown = () => (list.hidden ? [] : [...list.querySelectorAll("li")].map((one) => [one.textContent, one.getAttribute("data-x-name")]));
  return { input, list, taken, shown };
}

afterEach(() => document.body.replaceChildren());

describe("a list of names offered under a field", () => {
  it("offers once something is typed, by its labels, nothing picked until an arrow picks: Enter then takes it, Tab the first", () => {
    const { input, taken, shown } = setup();
    input.focus();
    expect(shown()).toEqual([]);
    type(input, "ad");
    expect(shown()).toEqual([
      ["@ada", "ada"],
      ["@adam", "adam"],
    ]);
    // (Enter with nothing picked: the field's, not taken)
    expect(key(input, "Enter").defaultPrevented).toBe(false);
    key(input, "ArrowDown");
    key(input, "ArrowDown");
    key(input, "Enter");
    expect([taken, shown()]).toEqual([["adam"], []]);
    type(input, "b");
    key(input, "Tab");
    expect(taken).toEqual(["adam", "bob"]);
  });

  it("offers every name with nothing typed where asked, as the field is focused (whatever it holds) and as it is cleared; Tab then leaves the field", () => {
    const { input, taken, shown } = setup(true);
    input.value = "ada";
    input.focus();
    expect(shown().map(([, name]) => name)).toEqual(NAMES);
    expect(key(input, "Tab").defaultPrevented).toBe(false);
    expect(shown().map(([, name]) => name)).toEqual(NAMES);
    type(input, "bo");
    expect(shown().map(([, name]) => name)).toEqual(["bob"]);
    type(input, "");
    expect(shown().map(([, name]) => name)).toEqual(NAMES);
    expect(key(input, "Tab").defaultPrevented).toBe(false);
    expect(taken).toEqual([]);
    // Esc closes it alone; ↓ offers again
    key(input, "Escape");
    expect(shown()).toEqual([]);
    key(input, "ArrowDown");
    expect(shown().length).toBe(3);
  });

  it("takes a name clicked, the field keeping its focus as it is pressed", () => {
    const { input, list, taken } = setup(true);
    input.focus();
    const item = list.querySelectorAll("li")[1]!;
    expect(item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }))).toBe(false);
    item.click();
    expect([taken, list.hidden]).toEqual([["bob"], true]);
  });
});
