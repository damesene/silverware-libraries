// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ActionPanel, Change, Context } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { marked } from "../core/cursor.ts";
import { emojiChange, type EmojiData, emojiModule } from "./emoji.ts";

const DATA: EmojiData = {
  groups: [
    { name: "Smileys", items: [["😀", "grinning face", "happy smile"], ["🥳", "partying face", "celebration party"]] },
    { name: "People", icon: "🧑", items: [["👍", "thumbs up", "good like yes"]] },
  ],
};

/** The picker opened in a panel of its own, what it wrote */
async function open() {
  const [action] = emojiModule(async () => DATA).actions();
  const element = document.createElement("div");
  document.body.append(element);
  const written: Change[] = [];
  const panel: ActionPanel = {
    doc: document,
    element,
    docked: false,
    write: (edit) => void written.push(edit(contextOf("a b", 2, 3) as Context)!),
    close: () => undefined,
    place: () => undefined,
  };
  action!.panel!(panel);
  // Loaded: the next task
  await new Promise((resolve) => setTimeout(resolve));
  const input = element.querySelector<HTMLInputElement>(".swb-search-field")!;
  const shown = () => Array.from(element.querySelectorAll(".swb-emoji")).map((b) => b.textContent);
  return { element, input, shown, written };
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe("The emoji picker", () => {
  it("is an action of a panel of its own, not a list of actions", () => {
    const [action] = emojiModule(async () => DATA).actions();
    expect(action!.id).toBe("actions.emoji");
    expect(action!.panel).toBeTypeOf("function");
    expect(action!.choices).toBeUndefined();
  });

  it("shows every emoji by its groups, the search focused", async () => {
    const { element, input, shown } = await open();
    expect(shown()).toEqual(["😀", "🥳", "👍"]);
    expect(Array.from(element.querySelectorAll(".swb-group")).map((g) => g.textContent)).toEqual(["Smileys", "People"]);
    expect(document.activeElement).toBe(input);
  });

  it("finds by name and keywords; Enter writes the current one over the selection, the cursor after it", async () => {
    const { input, shown, written } = await open();
    input.value = "party";
    input.dispatchEvent(new Event("input"));
    expect(shown()).toEqual(["🥳"]);
    input.value = "like";
    input.dispatchEvent(new Event("input"));
    expect(shown()).toEqual(["👍"]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(written).toHaveLength(1);
    const { text, select } = marked(written[0]!.insert);
    expect([written[0]!.from, written[0]!.to, text, select]).toEqual([2, 3, "👍", { from: 2, to: 2 }]);
  });

  it("leaves ← → to the field while something is typed, until ↓ goes into the emoji; an input method's Enter its own", async () => {
    const { input, written } = await open();
    input.value = "face";
    input.dispatchEvent(new Event("input"));
    const left = new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true });
    input.dispatchEvent(left);
    expect(left.defaultPrevented).toBe(false);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true }));
    const right = new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true });
    input.dispatchEvent(right);
    expect(right.defaultPrevented).toBe(true);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true }));
    expect(written).toHaveLength(0);
  });

  it("filters by a group over the search: All first and chosen, a group shows (and searches) its emoji alone", async () => {
    const { element, input, shown } = await open();
    const tabs = Array.from(element.querySelectorAll<HTMLButtonElement>(".swb-emoji-tab"));
    expect(tabs.map((t) => [t.textContent, t.getAttribute("aria-checked")])).toEqual([
      ["All", "true"],
      // Its icon, else its first emoji
      ["😀", "false"],
      ["🧑", "false"],
    ]);
    tabs[2]!.click();
    expect(shown()).toEqual(["👍"]);
    expect(tabs[2]!.getAttribute("aria-checked")).toBe("true");
    input.value = "party";
    input.dispatchEvent(new Event("input"));
    expect(shown()).toEqual([]);
    tabs[0]!.click();
    expect(shown()).toEqual(["🥳"]);
  });

  it("puts the one used last first", async () => {
    const first = await open();
    first.element.querySelectorAll<HTMLButtonElement>(".swb-emoji")[2]!.click();
    document.body.replaceChildren();
    const again = await open();
    expect(again.element.querySelector(".swb-group")!.textContent).toBe("Used last");
    expect(again.shown()[0]).toBe("👍");
  });

  it("writes an emoji over the selection, the cursor after it", () => {
    const change = emojiChange("😀", contextOf("ab", 0, 1));
    expect([change.from, change.to, marked(change.insert).text]).toEqual([0, 1, "😀"]);
  });
});
