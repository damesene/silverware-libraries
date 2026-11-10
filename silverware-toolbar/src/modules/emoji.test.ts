// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ICONS_VERSION, type Icons, type PickOptions } from "../../../shared/icons.ts";
import type { ActionPanel, Change, Context } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { marked } from "../core/cursor.ts";
import { emojiChange, emojiModule } from "./emoji.ts";

/** The action's panel opened, the picker it asked for, what it wrote */
function open(icons?: Icons) {
  const [action] = emojiModule(icons ? { icons } : {}).actions();
  const element = document.createElement("div");
  document.body.append(element);
  const written: Change[] = [];
  const place = vi.fn();
  const panel: ActionPanel = {
    doc: document,
    element,
    docked: false,
    write: (edit) => void written.push(edit(contextOf("a b", 2, 3) as Context)!),
    close: () => undefined,
    place,
  };
  action!.panel!(panel);
  return { element, written, place };
}

afterEach(() => document.body.replaceChildren());

describe("The Emoji action", () => {
  it("is an action of a panel of its own, not a list of actions", () => {
    const [action] = emojiModule().actions();
    expect(action!.id).toBe("actions.emoji");
    expect(action!.panel).toBeTypeOf("function");
    expect(action!.choices).toBeUndefined();
  });

  it("opens Silverware Icons' picker in its panel, its emoji alone; one picked written over the selection, the cursor after it; the panel placed again once shown", () => {
    let options: PickOptions | undefined;
    const icons: Icons = { version: ICONS_VERSION, markup: () => "", text: (value) => value, pick: (_into, given) => ((options = given), () => undefined) };
    const { written, place } = open(icons);
    expect(options?.sets).toEqual(["emoji"]);
    options!.picked("👍");
    const { text, select } = marked(written[0]!.insert);
    expect([written[0]!.from, written[0]!.to, text, select]).toEqual([2, 3, "👍", { from: 2, to: 2 }]);
    options!.shown?.();
    expect(place).toHaveBeenCalled();
  });

  it("without Silverware Icons: its panel says it is needed", () => {
    const { element, written } = open();
    expect(element.textContent).toContain("Emoji and icons need Silverware Icons");
    expect(written).toEqual([]);
  });

  it("writes an emoji over the selection, the cursor after it", () => {
    const change = emojiChange("😀", contextOf("ab", 0, 1));
    expect([change.from, change.to, marked(change.insert).text]).toEqual([0, 1, "😀"]);
  });
});
